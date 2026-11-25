#!/usr/bin/env node
// @ts-check
/**
 * Maquettekit local installer / upgrader / uninstaller for Claude Code, Codex, OpenCode and Google Antigravity.
 *
 *   node scripts/install.mjs install   [--host claude|codex|opencode|antigravity|all] [--mode auto|plugin|skills] [--routing-rules] [--dry-run] [--force] [--verify]
 *   node scripts/install.mjs uninstall [--host claude|codex|opencode|antigravity|all] [--purge] [--dry-run]
 *   node scripts/install.mjs status    [--json]
 *
 * What it does (nothing else; no network, no telemetry):
 *  1. Copies the marketplace payload (manifests + plugins/maquettekit) to $MAQUETTEKIT_HOME/marketplace
 *     (default ~/.maquettekit/marketplace) so the install survives deleting the checkout. An existing
 *     payload is first archived to $MAQUETTEKIT_HOME/backups/.
 *  2. plugin mode: registers that directory as a local marketplace with the host CLI and installs
 *     maquettekit@maquettekit-marketplace  (claude plugin … / codex plugin …).
 *  3. skills mode (OpenCode and Antigravity always; Claude/Codex without their CLI): renders the 12 skills
 *     with ${CLAUDE_PLUGIN_ROOT} replaced by the payload's absolute path, then links them into the host's
 *     skills directory: ~/.claude/skills, ~/.agents/skills (Codex), $XDG_CONFIG_HOME/opencode/skills
 *     (default ~/.config/opencode/skills) or ~/.gemini/config/skills (Antigravity IDE and agy CLI).
 *     OpenCode also reads ~/.claude/skills and ~/.agents/skills, so it is not linked twice when those are.
 *  4. Opt-in --routing-rules: adds a marked block to each host's global rules file (Codex and OpenCode AGENTS.md,
 *     Antigravity ~/.gemini/GEMINI.md, Claude Code CLAUDE.md in skills mode) telling the agent which skill to load
 *     for which kind of UI work. Claude Code in plugin mode gets the same nudge from the plugin's prompt hook instead.
 *     Only the marked block is ever written or removed; the rest of the file is left as it was.
 *  5. Records what it did in $MAQUETTEKIT_HOME/install.json; uninstall removes exactly that.
 * Host CLIs are invoked with argument arrays (never through a shell).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MARKETPLACE = 'maquettekit-marketplace';
const PLUGIN = 'maquettekit';
const HOME = os.homedir();
const S3_HOME = path.resolve(process.env.MAQUETTEKIT_HOME ?? path.join(HOME, '.maquettekit'));
const TARGET = path.join(S3_HOME, 'marketplace');
const STATE = path.join(S3_HOME, 'install.json');
const PAYLOAD = ['.claude-plugin', '.agents', 'plugins', 'LICENSE', 'NOTICE.md', 'README.md', 'CHANGELOG.md'];
const CONFIG_HOME = process.env.XDG_CONFIG_HOME?.trim() || path.join(HOME, '.config');
const SKILL_DIRS = {
  claude: path.join(process.env.CLAUDE_CONFIG_DIR?.trim() || path.join(HOME, '.claude'), 'skills'),
  codex: path.join(HOME, '.agents', 'skills'),
  opencode: path.join(CONFIG_HOME, 'opencode', 'skills'),
  antigravity: path.join(HOME, '.gemini', 'config', 'skills'),
};
const HOSTS = Object.keys(SKILL_DIRS);
/** Hosts with a plugin CLI. OpenCode and Antigravity load plain Agent Skills folders. */
const PLUGIN_HOSTS = ['claude', 'codex'];
const detect = {
  claude: () => !!which('claude'),
  codex: () => !!which('codex'),
  opencode: () => !!which('opencode') || fs.existsSync(path.join(CONFIG_HOME, 'opencode')),
  antigravity: () => !!which('agy') || !!which('antigravity') || ['antigravity', 'antigravity-cli'].some((d) => fs.existsSync(path.join(HOME, '.gemini', d))),
};
/** Global rules files read by each host (only touched with --routing-rules). */
const RULES_FILES = {
  claude: path.join(process.env.CLAUDE_CONFIG_DIR?.trim() || path.join(HOME, '.claude'), 'CLAUDE.md'),
  codex: path.join(process.env.CODEX_HOME?.trim() || path.join(HOME, '.codex'), 'AGENTS.md'),
  opencode: path.join(CONFIG_HOME, 'opencode', 'AGENTS.md'),
  antigravity: path.join(HOME, '.gemini', 'GEMINI.md'),
};
const RULES_START = '<!-- maquettekit:routing-rules:start (added by the Maquettekit installer; removed by uninstall) -->';
const RULES_END = '<!-- maquettekit:routing-rules:end -->';
const RULES_BODY = `## Maquettekit skills

For front-end design and UI work, load the matching Maquettekit skill before planning, advising or writing code —
even for a single file or a quick question:

- product UI: landing, pricing, sign-up, onboarding and checkout pages, forms, settings, app shells → studio-product
- dashboards, charts, KPIs, data tables → studio-data
- animation, transitions, stagger, hover and press feedback, easing → studio-motion
- scroll-driven storytelling, launch pages, kinetic type → studio-cinematic
- feeds, reactions, polls, stories → studio-social
- 3D, three.js / React Three Fiber, WebGL, shaders, model viewers → studio-3d (model optimisation → studio-asset-optimizer)
- design tokens, palette, type scale → studio-design-system
- reviewing a page in a browser → studio-review; interaction quality → studio-experience
- an effect or component from the Maquettekit library → studio-components; installing or fixing Maquettekit → studio-setup`;

/** Remove the marked block, leaving the rest of the text as it was. @param {string} text */
function stripRules(text) {
  const s = text.indexOf(RULES_START);
  const e = s === -1 ? -1 : text.indexOf(RULES_END, s);
  if (s === -1 || e === -1) return text;
  const before = text.slice(0, s).replace(/\n*$/, '');
  const after = text.slice(e + RULES_END.length).replace(/^\n*/, '');
  if (before && after) return `${before}\n\n${after}`;
  return before ? `${before}\n` : after;
}

function writeRules(host, state) {
  const file = RULES_FILES[host];
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  const base = existing === null ? '' : stripRules(existing).replace(/\s*$/, '');
  act(`${existing === null ? 'create' : 'add'} Maquettekit routing rules in ${file}`);
  if (!DRY) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${base ? `${base}\n\n` : ''}${RULES_START}\n${RULES_BODY}\n${RULES_END}\n`); }
  state.rules.push({ host, file, created: existing === null });
}

/** @param {{ file: string, created: boolean }} entry */
function removeRules(entry) {
  if (!fs.existsSync(entry.file)) return;
  const text = fs.readFileSync(entry.file, 'utf8');
  if (!text.includes(RULES_START)) return;
  const left = stripRules(text);
  act(`remove Maquettekit routing rules from ${entry.file}`);
  if (DRY) return;
  if (entry.created && !left.trim()) fs.rmSync(entry.file);
  else fs.writeFileSync(entry.file, left);
}

const INVOKE = {
  claude: (plugin) => (plugin ? '/maquettekit:studio-product' : '/studio-product'),
  codex: (plugin) => (plugin ? '$maquettekit:studio-product' : '$studio-product'),
  opencode: () => 'ask for the task, or "use the studio-product skill" (OpenCode loads skills on demand)',
  antigravity: () => '/studio-product, or describe the task and the agent picks the skill',
};

const argv = process.argv.slice(2);
const cmd = argv[0] && !argv[0].startsWith('-') ? argv[0] : 'install';
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const DRY = flag('dry-run');
const say = (s) => console.log(s);
const act = (s) => say(`${DRY ? '[dry-run] ' : ''}${s}`);

const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const which = (bin) => { const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim().split('\n')[0] : null; };
const cmpVersion = (a, b) => { const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0); } return 0; };

function run(bin, args, { allowFail = false } = {}) {
  act(`$ ${bin} ${args.join(' ')}`);
  if (DRY) return { ok: true, out: '' };
  const r = spawnSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
  if (out) say(out.split('\n').map((l) => `    ${l}`).join('\n'));
  if (r.status !== 0 && !allowFail) throw new Error(`${bin} ${args.join(' ')} failed (exit ${r.status})`);
  return { ok: r.status === 0, out };
}

function sourceVersion() {
  const a = readJson(path.join(REPO, 'plugins', PLUGIN, '.claude-plugin', 'plugin.json'));
  const b = readJson(path.join(REPO, 'plugins', PLUGIN, '.codex-plugin', 'plugin.json'));
  if (!a?.version || !b?.version) throw new Error('Plugin manifests not found — run this from a Maquettekit checkout or release archive.');
  if (a.version !== b.version) throw new Error(`Manifest versions differ (claude ${a.version}, codex ${b.version}).`);
  return a.version;
}

function copyDir(src, dst) {
  fs.cpSync(src, dst, { recursive: true, filter: (s) => !/(^|[\\/])(node_modules|\.git|\.next|\.maquettekit|test-results|evals[\\/]results)([\\/]|$)/.test(path.relative(REPO, s)) });
}

function backupExisting(oldVersion) {
  if (!fs.existsSync(TARGET)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(S3_HOME, 'backups', `maquettekit-${oldVersion ?? 'unknown'}-${stamp}`);
  act(`backup ${TARGET} → ${dest}`);
  if (!DRY) { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.renameSync(TARGET, dest); }
  return dest;
}

function stagePayload() {
  act(`copy payload → ${TARGET}`);
  if (DRY) return;
  fs.mkdirSync(TARGET, { recursive: true });
  for (const item of PAYLOAD) {
    const src = path.join(REPO, item);
    if (!fs.existsSync(src)) continue;
    const dst = path.join(TARGET, item);
    fs.statSync(src).isDirectory() ? copyDir(src, dst) : fs.copyFileSync(src, dst);
  }
}

const RENDERED = path.join(TARGET, 'rendered-skills');

/** Copy the skills with ${CLAUDE_PLUGIN_ROOT} made absolute, so hosts that do not substitute it still find the tools. */
function renderSkills() {
  if (DRY || fs.existsSync(RENDERED)) return;
  const root = path.join(TARGET, 'plugins', PLUGIN);
  fs.cpSync(path.join(root, 'skills'), RENDERED, { recursive: true });
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (/\.(md|txt)$/.test(e.name)) {
        const t = fs.readFileSync(f, 'utf8');
        if (t.includes('${CLAUDE_PLUGIN_ROOT}')) fs.writeFileSync(f, t.replaceAll('${CLAUDE_PLUGIN_ROOT}', root.split(path.sep).join('/')));
      }
    }
  };
  walk(RENDERED);
}

function linkSkills(host, state) {
  const dir = SKILL_DIRS[host];
  renderSkills();
  const skillsSrc = RENDERED;
  const names = DRY ? fs.readdirSync(path.join(REPO, 'plugins', PLUGIN, 'skills')) : fs.readdirSync(skillsSrc);
  act(`link ${names.length} skills → ${dir}`);
  for (const name of names) {
    const link = path.join(dir, name);
    if (DRY) continue;
    fs.mkdirSync(dir, { recursive: true });
    const st = fs.lstatSync(link, { throwIfNoEntry: false });
    if (st) {
      const ours = st.isSymbolicLink() && path.resolve(dir, fs.readlinkSync(link)).startsWith(S3_HOME);
      if (!ours && !flag('force')) { say(`  ! ${link} exists and is not managed by Maquettekit — skipped (use --force to replace)`); continue; }
      fs.rmSync(link, { recursive: true, force: true });
    }
    fs.symlinkSync(path.join(skillsSrc, name), link, 'dir');
    state.links.push(link);
  }
}

function installHost(host, mode, state) {
  if (!PLUGIN_HOSTS.includes(host)) {
    if (mode === 'plugin') throw new Error(`${host} has no plugin CLI — install it with --mode skills (or auto).`);
    // OpenCode also scans ~/.claude/skills and ~/.agents/skills: linking a third copy would list every skill twice.
    const via = host === 'opencode' && ['claude', 'codex'].find((h) => state.hosts[h]?.mode === 'skills');
    if (via) { say(`  opencode: already sees the skills in ${SKILL_DIRS[via]} — not linked again`); state.hosts[host] = { mode: 'shared', dir: SKILL_DIRS[via] }; return; }
    linkSkills(host, state);
    state.hosts[host] = { mode: 'skills', dir: SKILL_DIRS[host] };
    return;
  }
  const bin = which(host);
  const usePlugin = mode === 'plugin' || (mode === 'auto' && !!bin);
  if (mode === 'plugin' && !bin) throw new Error(`--mode plugin needs the "${host}" CLI on PATH.`);
  if (usePlugin) {
    const sub = host === 'claude' ? { add: ['plugin', 'install', `${PLUGIN}@${MARKETPLACE}`], rm: ['plugin', 'uninstall', `${PLUGIN}@${MARKETPLACE}`] }
      : { add: ['plugin', 'add', `${PLUGIN}@${MARKETPLACE}`], rm: ['plugin', 'remove', `${PLUGIN}@${MARKETPLACE}`] };
    // Re-register so an upgraded payload is picked up; failures to remove a non-existent entry are fine.
    run(bin, sub.rm, { allowFail: true });
    run(bin, ['plugin', 'marketplace', 'remove', MARKETPLACE], { allowFail: true });
    run(bin, ['plugin', 'marketplace', 'add', TARGET]);
    run(bin, sub.add);
    state.hosts[host] = { mode: 'plugin', cli: bin };
  } else {
    linkSkills(host, state);
    state.hosts[host] = { mode: 'skills', dir: SKILL_DIRS[host] };
  }
}

function hostsFrom(arg, { forUninstall = false, state = null } = {}) {
  const picked = String(arg).split(',').map((h) => h.trim()).filter(Boolean);
  if (picked.length && picked.every((h) => HOSTS.includes(h))) return HOSTS.filter((h) => picked.includes(h));
  if (arg !== 'all' && arg !== 'auto') throw new Error(`--host must be ${HOSTS.join(', ')}, a comma-separated list of them, or all`);
  if (forUninstall) return Object.keys(state?.hosts ?? {});
  if (arg === 'all') return HOSTS;
  const found = HOSTS.filter((h) => detect[h]());
  return found.length ? found : PLUGIN_HOSTS;
}

function install() {
  const [maj, min] = process.versions.node.split('.').map(Number);
  if (maj < 20 || (maj === 20 && min < 11)) throw new Error(`Node.js >= 20.11 required (found ${process.versions.node}).`);
  const version = sourceVersion();
  const prev = readJson(STATE);
  const mode = opt('mode', 'auto');
  if (!['auto', 'plugin', 'skills'].includes(mode)) throw new Error('--mode must be auto, plugin or skills');
  say(`Maquettekit installer — v${version}  (source: ${REPO})`);
  if (prev?.version) {
    const c = cmpVersion(version, prev.version);
    say(c > 0 ? `Upgrading ${prev.version} → ${version}` : c === 0 ? `Reinstalling ${version}` : `Installed version ${prev.version} is newer than ${version}`);
    if (c < 0 && !flag('force')) throw new Error('Refusing to downgrade. Re-run with --force to proceed.');
  }
  const state = { version, installedAt: new Date().toISOString(), source: REPO, target: TARGET, hosts: {}, links: [], rules: [], backup: null, previousVersion: prev?.version ?? null };
  // remove links and routing rules from the previous install before the payload moves
  for (const l of prev?.links ?? []) { if (!DRY && fs.lstatSync(l, { throwIfNoEntry: false })?.isSymbolicLink()) fs.rmSync(l); }
  for (const r of prev?.rules ?? []) removeRules(r);
  state.backup = backupExisting(prev?.version);
  stagePayload();
  for (const host of hostsFrom(opt('host', 'auto'))) installHost(host, mode, state);
  if (flag('routing-rules')) {
    for (const [host, info] of Object.entries(state.hosts)) {
      if (host === 'claude' && info.mode === 'plugin') continue; // the plugin's UserPromptSubmit hook gives the same nudge
      writeRules(host, state);
    }
  }
  if (!DRY) { fs.mkdirSync(S3_HOME, { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + '\n'); }
  say(`\n✔ Maquettekit v${version} installed.`);
  for (const [h, i] of Object.entries(state.hosts)) {
    const where = i.mode === 'plugin' ? `plugin ${PLUGIN}@${MARKETPLACE}` : i.mode === 'shared' ? `skills read from ${i.dir}` : `skills linked in ${i.dir}`;
    say(`  ${h}: ${where}  →  invoke with ${INVOKE[h](i.mode === 'plugin')}`);
  }
  if (state.hosts.opencode || state.hosts.antigravity) say('  Restart OpenCode / Antigravity (or start a new chat) so they pick up the new skills.');
  for (const r of state.rules) say(`  routing rules for ${r.host}: ${r.file}`);
  if (!flag('routing-rules') && Object.entries(state.hosts).some(([h, i]) => !(h === 'claude' && i.mode === 'plugin'))) say('  Tip: --routing-rules adds a short "which skill for which UI work" rule to each host\'s global rules file, which helps smaller models load the skills.');
  say(`  Tools: node "${path.join(TARGET, 'plugins', PLUGIN, 'tools', 'maquettekit.mjs')}" doctor`);
  say(`  MCP server (typed tool calls): node "${path.join(TARGET, 'plugins', PLUGIN, 'tools', 'maquettekit.mjs')}" mcp — the Claude Code plugin registers it itself; for Codex, OpenCode and Antigravity add it to their MCP settings (README → "MCP server").`);
  say('  Optional tool dependencies (Playwright, glTF tooling): run the "setup" command of the same script.');
  if (flag('verify') && !DRY) {
    const r = spawnSync(process.execPath, [path.join(TARGET, 'plugins', PLUGIN, 'tools', 'maquettekit.mjs'), 'doctor'], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('doctor reported failures');
  }
}

function uninstall() {
  const state = readJson(STATE);
  if (!state) { say('Maquettekit is not installed (no install record found).'); return; }
  for (const host of hostsFrom(opt('host', 'all'), { forUninstall: true, state })) {
    const info = state.hosts[host];
    if (!info) continue;
    if (info.mode === 'plugin') {
      const bin = which(host) ?? info.cli;
      run(bin, host === 'claude' ? ['plugin', 'uninstall', `${PLUGIN}@${MARKETPLACE}`] : ['plugin', 'remove', `${PLUGIN}@${MARKETPLACE}`], { allowFail: true });
      run(bin, ['plugin', 'marketplace', 'remove', MARKETPLACE], { allowFail: true });
    }
    delete state.hosts[host];
  }
  const keptRules = [];
  for (const r of state.rules ?? []) { if (state.hosts[r.host]) keptRules.push(r); else removeRules(r); }
  state.rules = keptRules;
  const oc = state.hosts.opencode;
  if (oc?.mode === 'shared' && !Object.values(state.hosts).some((i) => i.mode === 'skills' && i.dir === oc.dir)) {
    say('  opencode was reading the skills removed above — run install --host opencode to give it its own copy.');
    delete state.hosts.opencode;
  }
  const keep = [];
  for (const l of state.links ?? []) {
    const host = Object.entries(SKILL_DIRS).find(([, d]) => l.startsWith(d + path.sep))?.[0];
    if (host && state.hosts[host]) { keep.push(l); continue; }
    act(`remove link ${l}`);
    if (!DRY && fs.lstatSync(l, { throwIfNoEntry: false })?.isSymbolicLink()) fs.rmSync(l);
  }
  state.links = keep;
  if (Object.keys(state.hosts).length) {
    if (!DRY) fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + '\n');
    say('✔ Removed from the selected host. Other hosts remain installed.');
    return;
  }
  act(`remove ${TARGET}`);
  if (!DRY) { fs.rmSync(TARGET, { recursive: true, force: true }); fs.rmSync(STATE, { force: true }); }
  if (flag('purge')) { act(`purge ${S3_HOME} (backups, deps)`); if (!DRY) fs.rmSync(S3_HOME, { recursive: true, force: true }); }
  else say(`  Backups and tool dependencies kept in ${S3_HOME} (remove with --purge).`);
  say('✔ Maquettekit uninstalled.');
}

function status() {
  const state = readJson(STATE);
  const info = { installed: !!state, sourceVersion: (() => { try { return sourceVersion(); } catch { return null; } })(), ...(state ?? {}), home: S3_HOME };
  if (flag('json')) { say(JSON.stringify(info, null, 2)); return; }
  if (!state) { say(`Maquettekit is not installed. Source version: ${info.sourceVersion ?? 'unknown'}`); return; }
  say(`Maquettekit v${state.version} installed ${state.installedAt}\n  payload: ${state.target}`);
  for (const [h, i] of Object.entries(state.hosts)) say(`  ${h}: ${i.mode}`);
  if (info.sourceVersion && cmpVersion(info.sourceVersion, state.version) > 0) say(`  Update available: ${state.version} → ${info.sourceVersion} (run install again)`);
}

try {
  if (flag('help') || flag('h')) say(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].split('/**')[1].replace(/^ \* ?/gm, ''));
  else if (cmd === 'install' || cmd === 'upgrade') install();
  else if (cmd === 'uninstall') uninstall();
  else if (cmd === 'status') status();
  else throw new Error(`Unknown command "${cmd}" (install | upgrade | uninstall | status)`);
} catch (e) {
  console.error(`✖ ${/** @type {Error} */ (e).message}`);
  process.exit(1);
}
