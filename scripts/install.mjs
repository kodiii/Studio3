#!/usr/bin/env node
// @ts-check
/**
 * Studio³ local installer / upgrader / uninstaller for Claude Code and Codex.
 *
 *   node scripts/install.mjs install   [--host claude|codex|all] [--mode auto|plugin|skills] [--dry-run] [--force] [--verify]
 *   node scripts/install.mjs uninstall [--host claude|codex|all] [--purge] [--dry-run]
 *   node scripts/install.mjs status    [--json]
 *
 * What it does (nothing else; no network, no telemetry):
 *  1. Copies the marketplace payload (manifests + plugins/studio3) to $STUDIO3_HOME/marketplace
 *     (default ~/.studio3/marketplace) so the install survives deleting the checkout. An existing
 *     payload is first archived to $STUDIO3_HOME/backups/.
 *  2. plugin mode: registers that directory as a local marketplace with the host CLI and installs
 *     studio3@studio3-marketplace  (claude plugin … / codex plugin …).
 *  3. skills mode (hosts without a plugin CLI): links the 12 skills into the host's skills directory
 *     (~/.claude/skills or ~/.agents/skills). Skills locate tools through ~/.studio3/marketplace.
 *  4. Records what it did in $STUDIO3_HOME/install.json; uninstall removes exactly that.
 * Host CLIs are invoked with argument arrays (never through a shell).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MARKETPLACE = 'studio3-marketplace';
const PLUGIN = 'studio3';
const HOME = os.homedir();
const S3_HOME = path.resolve(process.env.STUDIO3_HOME ?? path.join(HOME, '.studio3'));
const TARGET = path.join(S3_HOME, 'marketplace');
const STATE = path.join(S3_HOME, 'install.json');
const PAYLOAD = ['.claude-plugin', '.agents', 'plugins', 'LICENSE', 'NOTICE.md', 'README.md', 'CHANGELOG.md'];
const SKILL_DIRS = { claude: path.join(process.env.CLAUDE_CONFIG_DIR ?? path.join(HOME, '.claude'), 'skills'), codex: path.join(HOME, '.agents', 'skills') };

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
  if (!a?.version || !b?.version) throw new Error('Plugin manifests not found — run this from a Studio³ checkout or release archive.');
  if (a.version !== b.version) throw new Error(`Manifest versions differ (claude ${a.version}, codex ${b.version}).`);
  return a.version;
}

function copyDir(src, dst) {
  fs.cpSync(src, dst, { recursive: true, filter: (s) => !/(^|[\\/])(node_modules|\.git|\.next|\.studio3|test-results)([\\/]|$)/.test(path.relative(REPO, s)) });
}

function backupExisting(oldVersion) {
  if (!fs.existsSync(TARGET)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(S3_HOME, 'backups', `studio3-${oldVersion ?? 'unknown'}-${stamp}`);
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

function linkSkills(host, state) {
  const dir = SKILL_DIRS[host];
  const skillsSrc = path.join(TARGET, 'plugins', PLUGIN, 'skills');
  const names = DRY ? fs.readdirSync(path.join(REPO, 'plugins', PLUGIN, 'skills')) : fs.readdirSync(skillsSrc);
  act(`link ${names.length} skills → ${dir}`);
  for (const name of names) {
    const link = path.join(dir, name);
    if (DRY) continue;
    fs.mkdirSync(dir, { recursive: true });
    const st = fs.lstatSync(link, { throwIfNoEntry: false });
    if (st) {
      const ours = st.isSymbolicLink() && path.resolve(dir, fs.readlinkSync(link)).startsWith(S3_HOME);
      if (!ours && !flag('force')) { say(`  ! ${link} exists and is not managed by Studio³ — skipped (use --force to replace)`); continue; }
      fs.rmSync(link, { recursive: true, force: true });
    }
    fs.symlinkSync(path.join(skillsSrc, name), link, 'dir');
    state.links.push(link);
  }
}

function installHost(host, mode, state) {
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
  if (arg === 'claude' || arg === 'codex') return [arg];
  if (arg !== 'all' && arg !== 'auto') throw new Error('--host must be claude, codex or all');
  if (forUninstall) return Object.keys(state?.hosts ?? {});
  if (arg === 'all') return ['claude', 'codex'];
  const found = ['claude', 'codex'].filter((h) => which(h));
  return found.length ? found : ['claude', 'codex'];
}

function install() {
  const [maj, min] = process.versions.node.split('.').map(Number);
  if (maj < 20 || (maj === 20 && min < 11)) throw new Error(`Node.js >= 20.11 required (found ${process.versions.node}).`);
  const version = sourceVersion();
  const prev = readJson(STATE);
  const mode = opt('mode', 'auto');
  if (!['auto', 'plugin', 'skills'].includes(mode)) throw new Error('--mode must be auto, plugin or skills');
  say(`Studio³ installer — v${version}  (source: ${REPO})`);
  if (prev?.version) {
    const c = cmpVersion(version, prev.version);
    say(c > 0 ? `Upgrading ${prev.version} → ${version}` : c === 0 ? `Reinstalling ${version}` : `Installed version ${prev.version} is newer than ${version}`);
    if (c < 0 && !flag('force')) throw new Error('Refusing to downgrade. Re-run with --force to proceed.');
  }
  const state = { version, installedAt: new Date().toISOString(), source: REPO, target: TARGET, hosts: {}, links: [], backup: null, previousVersion: prev?.version ?? null };
  // remove links from the previous install before the payload moves
  for (const l of prev?.links ?? []) { if (!DRY && fs.lstatSync(l, { throwIfNoEntry: false })?.isSymbolicLink()) fs.rmSync(l); }
  state.backup = backupExisting(prev?.version);
  stagePayload();
  for (const host of hostsFrom(opt('host', 'auto'))) installHost(host, mode, state);
  if (!DRY) { fs.mkdirSync(S3_HOME, { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + '\n'); }
  say(`\n✔ Studio³ v${version} installed.`);
  for (const [h, i] of Object.entries(state.hosts)) {
    say(`  ${h}: ${i.mode === 'plugin' ? `plugin ${PLUGIN}@${MARKETPLACE}` : `skills linked in ${i.dir}`}  →  invoke with ${h === 'claude' ? (i.mode === 'plugin' ? '/studio3:studio-product' : '/studio-product') : (i.mode === 'plugin' ? '$studio3:studio-product' : '$studio-product')}`);
  }
  say(`  Tools: node "${path.join(TARGET, 'plugins', PLUGIN, 'tools', 'studio3.mjs')}" doctor`);
  say('  Optional tool dependencies (Playwright, glTF tooling): run the "setup" command of the same script.');
  if (flag('verify') && !DRY) {
    const r = spawnSync(process.execPath, [path.join(TARGET, 'plugins', PLUGIN, 'tools', 'studio3.mjs'), 'doctor'], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('doctor reported failures');
  }
}

function uninstall() {
  const state = readJson(STATE);
  if (!state) { say('Studio³ is not installed (no install record found).'); return; }
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
  const keep = [];
  for (const l of state.links ?? []) {
    const host = Object.entries(SKILL_DIRS).find(([, d]) => l.startsWith(d))?.[0];
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
  say('✔ Studio³ uninstalled.');
}

function status() {
  const state = readJson(STATE);
  const info = { installed: !!state, sourceVersion: (() => { try { return sourceVersion(); } catch { return null; } })(), ...(state ?? {}), home: S3_HOME };
  if (flag('json')) { say(JSON.stringify(info, null, 2)); return; }
  if (!state) { say(`Studio³ is not installed. Source version: ${info.sourceVersion ?? 'unknown'}`); return; }
  say(`Studio³ v${state.version} installed ${state.installedAt}\n  payload: ${state.target}`);
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
