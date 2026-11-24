#!/usr/bin/env node
// @ts-check
/**
 * Validates the Maquettekit plugin packaging for both hosts. Exit 1 on any error.
 *   node scripts/validate-plugin.mjs [--json] [--no-cli]
 * Checks: manifests (Claude + Codex), marketplaces, the 12 required skills (frontmatter, size, referenced files,
 * commands cited), shared docs, catalogue, and — when the `claude` CLI is on PATH — `claude plugin validate`.
 * Codex has no validator CLI; its manifest/marketplace are checked against the fields the Codex loader reads
 * (see docs/SOURCE-RESEARCH.md §Codex).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PLUGIN = path.join(ROOT, 'plugins', 'maquettekit');
export const REQUIRED_SKILLS = ['studio-product', 'studio-cinematic', 'studio-data', 'studio-social', 'studio-3d', 'studio-motion',
  'studio-review', 'studio-experience', 'studio-design-system', 'studio-components', 'studio-setup', 'studio-asset-optimizer'];
const COMMANDS = ['doctor', 'setup', 'design', 'review', 'experience', 'assets', 'catalog'];
const CODEX_MANIFEST_KEYS = new Set(['name', 'version', 'description', 'keywords', 'skills', 'mcpServers', 'apps', 'hooks', 'interface', 'commands']);
const CODEX_INTERFACE_KEYS = new Set(['displayName', 'shortDescription', 'longDescription', 'developerName', 'category', 'capabilities', 'websiteUrl', 'privacyPolicyUrl', 'termsOfServiceUrl', 'defaultPrompt', 'brandColor', 'composerIcon', 'logo', 'logoDark', 'screenshots']);

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

/** Minimal YAML-frontmatter reader: top-level scalars + one level of nested map. */
export function frontmatter(text) {
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---', 4);
  if (end === -1) return null;
  const out = {}; let parent = null;
  for (const line of text.slice(4, end).split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const top = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    const nested = /^\s{2,}([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    const unq = (s) => s.replace(/^(["'])(.*)\1$/, '$2');
    if (top) { if (top[2] === '') { parent = top[1]; out[parent] = {}; } else { parent = null; out[top[1]] = unq(top[2]); } }
    else if (nested && parent) out[parent][nested[1]] = unq(nested[2]);
    else return { __invalid: `unparseable line: ${line}` };
  }
  return { ...out, __body: text.slice(end + 4) };
}

export function validate({ cli = true } = {}) {
  const errors = []; const warnings = []; const info = [];
  const err = (m) => errors.push(m); const warn = (m) => warnings.push(m);
  const rel = (f) => path.relative(ROOT, f);

  // ---- manifests
  let claude = null, codex = null;
  try { claude = readJson(path.join(PLUGIN, '.claude-plugin', 'plugin.json')); } catch (e) { err(`Claude manifest: ${e.message}`); }
  try { codex = readJson(path.join(PLUGIN, '.codex-plugin', 'plugin.json')); } catch (e) { err(`Codex manifest: ${e.message}`); }
  const rootPkg = readJson(path.join(ROOT, 'package.json'));
  if (claude) {
    if (claude.name !== 'maquettekit') err('Claude manifest: name must be "maquettekit"');
    if (!/^[a-z0-9-]+$/.test(claude.name ?? '')) err('Claude manifest: name must be kebab-case');
    for (const k of ['version', 'description', 'author', 'license']) if (!claude[k]) err(`Claude manifest: missing ${k}`);
    if (claude.author && !claude.author.name) err('Claude manifest: author.name required');
    if (claude.version !== rootPkg.version) err(`Claude manifest version ${claude.version} != package.json ${rootPkg.version}`);
  }
  if (codex) {
    if (codex.name !== 'maquettekit') err('Codex manifest: name must be "maquettekit"');
    if (typeof codex.version !== 'string' || !codex.version.trim()) err('Codex manifest: version must be a non-blank string');
    if (!codex.description) err('Codex manifest: description missing');
    for (const k of Object.keys(codex)) if (!CODEX_MANIFEST_KEYS.has(k)) warn(`Codex manifest: key "${k}" is not read by the Codex loader`);
    for (const k of Object.keys(codex.interface ?? {})) if (!CODEX_INTERFACE_KEYS.has(k)) warn(`Codex manifest: interface.${k} is not read by the Codex loader`);
    for (const k of ['skills', 'hooks', 'apps']) {
      const v = codex[k];
      for (const p of typeof v === 'string' ? [v] : Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []) {
        if (!p.startsWith('./') || p.includes('..')) err(`Codex manifest: ${k} path "${p}" must start with ./ and not contain ..`);
        else if (!fs.existsSync(path.join(PLUGIN, p))) err(`Codex manifest: ${k} path "${p}" does not exist`);
      }
    }
    const dp = codex.interface?.defaultPrompt ?? [];
    if (dp.length > 3) err('Codex manifest: interface.defaultPrompt allows at most 3 entries');
    for (const p of dp) if (p.length > 512) err('Codex manifest: defaultPrompt entry exceeds 512 characters');
    if (claude && codex.version !== claude.version) err(`Manifest versions differ: claude ${claude.version}, codex ${codex.version}`);
  }

  // ---- marketplaces
  try {
    const m = readJson(path.join(ROOT, '.claude-plugin', 'marketplace.json'));
    if (!m.name || !m.owner?.name || !Array.isArray(m.plugins)) err('Claude marketplace: name, owner.name and plugins[] are required');
    const e = m.plugins?.find((p) => p.name === 'maquettekit');
    if (!e) err('Claude marketplace: no "maquettekit" entry');
    else {
      if (typeof e.source !== 'string' || !e.source.startsWith('./') || e.source.includes('..')) err('Claude marketplace: source must be a ./relative path without ..');
      else if (!fs.existsSync(path.join(ROOT, e.source, '.claude-plugin', 'plugin.json'))) err(`Claude marketplace: ${e.source} has no .claude-plugin/plugin.json`);
      if (e.version && claude && e.version !== claude.version) err('Claude marketplace: entry version differs from manifest');
    }
  } catch (e) { err(`Claude marketplace: ${e.message}`); }
  try {
    const m = readJson(path.join(ROOT, '.agents', 'plugins', 'marketplace.json'));
    if (!/^[A-Za-z0-9_-]+$/.test(m.name ?? '')) err('Codex marketplace: name must match [A-Za-z0-9_-]+');
    const e = m.plugins?.find((p) => p.name === 'maquettekit');
    if (!e) err('Codex marketplace: no "maquettekit" entry');
    else {
      const p = typeof e.source === 'string' ? e.source : e.source?.source === 'local' ? e.source.path : null;
      if (!p) err('Codex marketplace: source must be a "./path" string or { source: "local", path }');
      else if (!(p === '.' || p.startsWith('./')) || p.includes('..')) err('Codex marketplace: local path must start with ./ and not contain ..');
      else if (!fs.existsSync(path.join(ROOT, p, '.codex-plugin', 'plugin.json'))) err(`Codex marketplace: ${p} has no .codex-plugin/plugin.json`);
      if (e.policy?.installation && !['AVAILABLE', 'NOT_AVAILABLE', 'INSTALLED_BY_DEFAULT'].includes(e.policy.installation)) err('Codex marketplace: invalid policy.installation');
      if (e.policy?.authentication && !['ON_INSTALL', 'ON_USE'].includes(e.policy.authentication)) err('Codex marketplace: invalid policy.authentication');
    }
  } catch (e) { err(`Codex marketplace: ${e.message}`); }

  // ---- skills
  const skillsDir = path.join(PLUGIN, 'skills');
  const present = fs.existsSync(skillsDir) ? fs.readdirSync(skillsDir).filter((d) => fs.statSync(path.join(skillsDir, d)).isDirectory()) : [];
  for (const s of REQUIRED_SKILLS) if (!present.includes(s)) err(`skill ${s}: directory missing`);
  for (const s of present) {
    if (!REQUIRED_SKILLS.includes(s)) warn(`skill ${s}: not in the required list`);
    const dir = path.join(skillsDir, s);
    const file = path.join(dir, 'SKILL.md');
    if (!fs.existsSync(file)) { err(`skill ${s}: SKILL.md missing`); continue; }
    const text = fs.readFileSync(file, 'utf8');
    const fm = frontmatter(text);
    if (!fm) { err(`skill ${s}: frontmatter must start on line 1 and be closed`); continue; }
    if (fm.__invalid) { err(`skill ${s}: frontmatter ${fm.__invalid}`); continue; }
    if (fm.name !== s) err(`skill ${s}: frontmatter name "${fm.name}" must equal the directory name`);
    if ((fm.name ?? '').length > 64) err(`skill ${s}: name exceeds 64 characters (Codex limit)`);
    const d = fm.description ?? '';
    if (typeof d !== 'string' || d.length < 80) err(`skill ${s}: description missing or too short to trigger reliably`);
    if (d.length > 1024) err(`skill ${s}: description is ${d.length} chars (keep <= 1024; listings truncate at 1,536 combined)`);
    if (/[<>]/.test(d)) warn(`skill ${s}: angle brackets in description are escaped by Claude Code`);
    if (!/\buse (it )?when\b|\bwhen\b/i.test(d)) warn(`skill ${s}: description should state trigger conditions ("Use when …")`);
    if (!fm.metadata?.['short-description']) warn(`skill ${s}: metadata.short-description missing (shown by Codex)`);
    const body = fm.__body;
    const lines = text.split('\n').length;
    if (lines > 260) warn(`skill ${s}: SKILL.md is ${lines} lines — move detail into references/ (progressive disclosure)`);
    for (const h of ['Workflow', 'Validation']) if (!new RegExp(`^##+ .*${h}`, 'mi').test(body)) err(`skill ${s}: missing a "${h}" section`);
    if (!/^##+ .*(Tooling|Reference files)/mi.test(body)) warn(`skill ${s}: no Tooling / Reference files section`);
    if (!/^##+ .*(deliverables)/mi.test(body)) warn(`skill ${s}: no "Expected deliverables" section`);
    // referenced files must exist
    const refs = new Set();
    for (const m of body.matchAll(/`(references\/[A-Za-z0-9_./-]+\.md)`/g)) refs.add(path.join(dir, m[1]));
    for (const m of body.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([A-Za-z0-9_./-]+\.(?:md|mjs|json))/g)) refs.add(path.join(PLUGIN, m[1]));
    for (const m of body.matchAll(/`(\.\.\/\.\.\/[A-Za-z0-9_./-]+\.(?:md|mjs|json))`/g)) refs.add(path.resolve(dir, m[1]));
    for (const f of refs) if (!fs.existsSync(f)) err(`skill ${s}: references missing file ${rel(f)}`);
    const refDir = path.join(dir, 'references');
    if (fs.existsSync(refDir)) for (const f of fs.readdirSync(refDir)) {
      if (!body.includes(`references/${f}`)) warn(`skill ${s}: references/${f} is never mentioned in SKILL.md`);
      const n = fs.readFileSync(path.join(refDir, f), 'utf8').split('\n').length;
      if (n > 420) warn(`skill ${s}: references/${f} is ${n} lines`);
    }
    // commands cited as `maquettekit <cmd>` must exist
    for (const m of text.matchAll(/`maquettekit ([a-z-]+)/g)) if (!COMMANDS.includes(m[1])) err(`skill ${s}: cites unknown command "maquettekit ${m[1]}"`);
  }

  // ---- tools, shared, library
  for (const c of COMMANDS) {
    const map = { design: 'design-intelligence', review: 'visual-director', experience: 'experience-lab', assets: 'asset-pipeline' };
    const f = path.join(PLUGIN, 'tools', map[c] ?? c, 'index.mjs');
    if (!fs.existsSync(f)) err(`tool "${c}": ${rel(f)} missing`);
  }
  for (const f of ['tooling.md', 'workflow.md', 'design-principles.md', 'accessibility.md', 'performance.md', 'experience-profiles.md', 'technology-selection.md'])
    if (!fs.existsSync(path.join(PLUGIN, 'shared', f))) err(`shared/${f} missing`);
  try {
    const cat = readJson(path.join(PLUGIN, 'library', 'catalog.json'));
    info.push(`catalogue: ${cat.effects.length} effects, ${cat.demos.length} demos`);
    if (cat.effects.length < 40) err(`catalogue has ${cat.effects.length} effects; at least 40 required`);
    for (const e of cat.effects) for (const f of e.files) if (!fs.existsSync(path.join(PLUGIN, e.path, f))) err(`catalogue: ${e.path}/${f} missing`);
  } catch (e) { err(`catalogue: ${e.message}`); }
  if (fs.existsSync(path.join(PLUGIN, 'node_modules'))) err('plugins/maquettekit must not contain node_modules (hoisted to the repo root)');

  // ---- host CLI validation
  const cliResults = {};
  if (cli) {
    const has = spawnSync('which', ['claude']).status === 0;
    if (!has) cliResults.claude = { ran: false, reason: 'claude CLI not on PATH' };
    else for (const [label, dir] of [['plugin', PLUGIN], ['marketplace', ROOT]]) {
      const r = spawnSync('claude', ['plugin', 'validate', dir], { encoding: 'utf8' });
      const out = `${r.stdout}${r.stderr}`;
      const passed = r.status === 0 && /Validation passed/.test(out);
      cliResults[`claude-${label}`] = { ran: true, passed, withWarnings: /passed with warnings/.test(out) };
      if (!passed) err(`claude plugin validate (${label}) failed:\n${out.trim().split('\n').slice(-12).join('\n')}`);
    }
    cliResults.codex = { ran: false, reason: 'Codex provides no manifest validator; structural checks above were applied' };
  }
  return { ok: errors.length === 0, errors, warnings, info, cli: cliResults };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const res = validate({ cli: !process.argv.includes('--no-cli') });
  if (process.argv.includes('--json')) console.log(JSON.stringify(res, null, 2));
  else {
    for (const i of res.info) console.log(`· ${i}`);
    for (const [k, v] of Object.entries(res.cli)) console.log(`· ${k}: ${v.ran ? (v.passed ? `passed${v.withWarnings ? ' (with warnings)' : ''}` : 'FAILED') : `not run — ${v.reason}`}`);
    for (const w of res.warnings) console.log(`! ${w}`);
    for (const e of res.errors) console.log(`✖ ${e}`);
    console.log(res.ok ? `\n✔ Plugin packaging valid (${res.warnings.length} warning(s)).` : `\n✖ ${res.errors.length} error(s), ${res.warnings.length} warning(s).`);
  }
  process.exit(res.ok ? 0 : 1);
}
