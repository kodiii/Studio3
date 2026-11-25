// @ts-check
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from '../lib/args.mjs';
import { PLUGIN_ROOT, TOOLS_DIR, depVersion, depsDir, hasDep } from '../lib/resolve.mjs';
import { color } from '../lib/log.mjs';

export const help = `maquettekit doctor — setup verification and dependency diagnostics

  doctor [--json] [--browser] [--strict]

Checks the runtime, plugin integrity (manifests, skills, catalog), optional tool dependencies,
optional CLIs (ktx, blender) and host installs (Claude Code, Codex).
  --browser  also launch headless Chromium and probe WebGL / WebGPU
  --strict   exit 1 when any check is "fail" or "warn" (default: only on "fail")`;

export const REQUIRED_SKILLS = ['studio-product', 'studio-cinematic', 'studio-data', 'studio-social', 'studio-3d', 'studio-motion',
  'studio-review', 'studio-experience', 'studio-design-system', 'studio-components', 'studio-setup', 'studio-asset-optimizer', 'studio-launch', 'studio-match'];

const which = (cmd) => {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim().split('\n')[0] : null;
};
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

/** Parse SKILL.md frontmatter (flat `key: value` YAML subset). Exported for tests. */
export function parseFrontmatter(text) {
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---', 4);
  if (end === -1) return null;
  const out = {};
  let key = null;
  for (const line of text.slice(4, end).split('\n')) {
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (m) { key = m[1]; out[key] = m[2].replace(/^["']|["']$/g, ''); if (/^[>|][-+]?$/.test(m[2])) out[key] = ''; }
    else if (key && /^\s+\S/.test(line)) out[key] = (out[key] ? out[key] + ' ' : '') + line.trim();
  }
  return out;
}

export async function collect(opts = {}) {
  /** @type {{ id: string, group: string, status: 'ok'|'warn'|'fail'|'info', detail: string, fix?: string }[]} */
  const checks = [];
  const add = (group, id, status, detail, fix) => checks.push({ group, id, status, detail, ...(fix ? { fix } : {}) });

  const [maj, min] = process.versions.node.split('.').map(Number);
  add('runtime', 'node', maj > 20 || (maj === 20 && min >= 11) ? 'ok' : 'fail', `Node ${process.versions.node} (${process.platform} ${process.arch})`, 'Install Node.js >= 20.11');
  add('runtime', 'npm', which('npm') ? 'ok' : 'warn', which('npm') ?? 'npm not found on PATH', 'npm is needed for "maquettekit setup"');

  const claudeManifest = readJson(path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'));
  const codexManifest = readJson(path.join(PLUGIN_ROOT, '.codex-plugin', 'plugin.json'));
  add('plugin', 'claude-manifest', claudeManifest?.name === 'maquettekit' ? 'ok' : 'fail', claudeManifest ? `maquettekit v${claudeManifest.version}` : 'missing .claude-plugin/plugin.json');
  add('plugin', 'codex-manifest', codexManifest?.name === 'maquettekit' ? 'ok' : 'fail', codexManifest ? `maquettekit v${codexManifest.version}` : 'missing .codex-plugin/plugin.json');
  if (claudeManifest && codexManifest) add('plugin', 'version-match', claudeManifest.version === codexManifest.version ? 'ok' : 'fail', `claude ${claudeManifest.version} / codex ${codexManifest.version}`);
  for (const s of REQUIRED_SKILLS) {
    const f = path.join(PLUGIN_ROOT, 'skills', s, 'SKILL.md');
    const fm = fs.existsSync(f) ? parseFrontmatter(fs.readFileSync(f, 'utf8')) : null;
    const ok = fm && fm.name === s && (fm.description ?? '').length >= 40;
    add('skills', s, ok ? 'ok' : 'fail', !fs.existsSync(f) ? 'SKILL.md missing' : !fm ? 'frontmatter missing' : ok ? 'valid frontmatter' : 'name/description invalid');
  }
  const catalog = readJson(path.join(PLUGIN_ROOT, 'library', 'catalog.json'));
  add('library', 'catalog', catalog ? (catalog.effects.length >= 40 ? 'ok' : 'warn') : 'fail', catalog ? `${catalog.effects.length} effects, ${catalog.demos.length} demos` : 'library/catalog.json missing');

  const deps = [
    ['playwright', 'Visual Director, Experience Lab, thumbnails'], ['axe-core', 'accessibility checks'], ['pixelmatch', 'screenshot diff'], ['pngjs', 'screenshot diff'],
    ['@gltf-transform/core', '3D Asset Pipeline'], ['@gltf-transform/functions', '3D Asset Pipeline'], ['@gltf-transform/extensions', '3D Asset Pipeline'],
    ['meshoptimizer', 'mesh compression/simplification'], ['draco3dgltf', 'Draco compression (optional)'], ['sharp', 'texture resize/encode'], ['gltf-validator', 'glTF validation'],
  ];
  for (const [name, purpose] of deps) {
    const ok = hasDep(name);
    add('dependencies', name, ok ? 'ok' : 'warn', ok ? `v${depVersion(name) ?? '?'} — ${purpose}` : `not installed — needed for ${purpose}`, ok ? undefined : `node "${path.join(TOOLS_DIR, 'maquettekit.mjs')}" setup`);
  }
  add('dependencies', 'deps-dir', 'info', depsDir());
  for (const [cli, purpose] of [['ktx', 'KTX2/Basis texture compression (KTX-Software)'], ['blender', 'FBX/OBJ/USD → glTF import']]) {
    const p = which(cli);
    add('optional-cli', cli, 'info', p ? `${p} — ${purpose}` : `not found — ${purpose} will be skipped`);
  }

  if (opts.browser) {
    if (!hasDep('playwright')) add('browser', 'chromium', 'warn', 'skipped: playwright is not installed');
    else {
      try {
        const { launchBrowser } = await import('../lib/browser.mjs');
        const browser = await launchBrowser();
        const page = await browser.newPage();
        const gfx = await page.evaluate(async () => {
          const c = document.createElement('canvas');
          const gl = c.getContext('webgl2') || c.getContext('webgl');
          const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
          const gpu = /** @type {any} */ (navigator).gpu;
          return { webgl: !!gl, webgl2: !!c.getContext('webgl2'), renderer: gl && ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null, webgpu: gpu ? !!(await gpu.requestAdapter().catch(() => null)) : false };
        });
        const v = browser.version();
        await browser.close();
        add('browser', 'chromium', 'ok', `Chromium ${v} launches headless`);
        add('browser', 'webgl', gfx.webgl ? 'ok' : 'warn', gfx.webgl ? `WebGL${gfx.webgl2 ? '2' : ''} available (${gfx.renderer ?? 'renderer hidden'})` : 'WebGL unavailable: 3D diagnostics will be limited');
        add('browser', 'webgpu', 'info', gfx.webgpu ? 'WebGPU adapter available' : 'WebGPU unavailable in this browser build (WebGPU checks will report "unavailable")');
      } catch (e) {
        add('browser', 'chromium', 'warn', `could not launch: ${String(/** @type {any} */ (e).message).split('\n')[0]}`, 'npx playwright install chromium');
      }
    }
  }

  const home = os.homedir();
  const claudeBin = which('claude');
  add('hosts', 'claude-cli', 'info', claudeBin ?? 'Claude Code CLI not found on PATH');
  const installed = readJson(path.join(home, '.claude', 'plugins', 'installed_plugins.json'));
  const claudeKeys = installed?.plugins ? Object.keys(installed.plugins).filter((k) => k.startsWith('maquettekit@')) : [];
  add('hosts', 'claude-plugin', 'info', claudeKeys.length ? `installed: ${claudeKeys.join(', ')}` : 'maquettekit is not installed as a Claude Code plugin (or this is a --plugin-dir / repo run)');
  const codexBin = which('codex');
  add('hosts', 'codex-cli', 'info', codexBin ?? 'Codex CLI not found on PATH');
  const codexCfg = path.join(process.env.CODEX_HOME ?? path.join(home, '.codex'), 'config.toml');
  const cfg = fs.existsSync(codexCfg) ? fs.readFileSync(codexCfg, 'utf8') : '';
  add('hosts', 'codex-plugin', 'info', /\[plugins\."maquettekit@[^"]+"\]/.test(cfg) ? 'enabled in Codex config.toml' : 'maquettekit is not enabled in Codex config.toml');
  const agentsSkills = path.join(home, '.agents', 'skills');
  const standalone = fs.existsSync(agentsSkills) ? fs.readdirSync(agentsSkills).filter((d) => d.startsWith('studio-')) : [];
  if (standalone.length) add('hosts', 'standalone-skills', 'info', `${standalone.length} Maquettekit skills in ~/.agents/skills`);

  const summary = { ok: 0, warn: 0, fail: 0, info: 0 };
  for (const c of checks) summary[c.status]++;
  return { tool: 'maquettekit-doctor', version: claudeManifest?.version ?? null, pluginRoot: PLUGIN_ROOT, summary, checks };
}

export async function main(argv) {
  const args = parseArgs(argv, { boolean: ['json', 'browser', 'strict'] });
  const report = await collect({ browser: !!args.browser });
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else {
    const icon = { ok: color.green('✔'), warn: color.yellow('!'), fail: color.red('✖'), info: color.dim('·') };
    let group = '';
    console.log(`Maquettekit doctor — v${report.version ?? '?'}  (${report.pluginRoot})`);
    for (const c of report.checks) {
      if (c.group !== group) { group = c.group; console.log(`\n${color.bold(group)}`); }
      console.log(`  ${icon[c.status]} ${c.id.padEnd(26)} ${c.detail}${c.fix && c.status !== 'ok' ? color.dim(`\n      fix: ${c.fix}`) : ''}`);
    }
    const s = report.summary;
    console.log(`\n${s.ok} ok, ${s.warn} warning(s), ${s.fail} failure(s). ${args.browser ? '' : 'Run with --browser to probe Chromium/WebGL.'}`);
  }
  return report.summary.fail > 0 || (args.strict && report.summary.warn > 0) ? 1 : 0;
}
