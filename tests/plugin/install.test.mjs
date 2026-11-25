// Installer lifecycle in an isolated HOME: install, status, upgrade (with backup), downgrade refusal, uninstall.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../../scripts/validate-plugin.mjs';

const INSTALL = path.join(ROOT, 'scripts', 'install.mjs');
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
// The installer must link every skill present in the repo (completeness of the 12 is asserted in packaging.test.mjs).
const SKILLS = fs.readdirSync(path.join(ROOT, 'plugins', 'maquettekit', 'skills')).filter((d) => fs.existsSync(path.join(ROOT, 'plugins', 'maquettekit', 'skills', d, 'SKILL.md')));

function sandbox({ fakeClis = [] } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 's3-home-'));
  const bin = path.join(home, 'bin');
  fs.mkdirSync(bin);
  const log = path.join(home, 'cli.log');
  for (const name of fakeClis) {
    fs.writeFileSync(path.join(bin, name), `#!/bin/sh\necho "${name} $*" >> "${log}"\nexit 0\n`, { mode: 0o755 });
  }
  // PATH: fake CLIs + node only — real host CLIs are deliberately invisible.
  const env = { ...process.env, HOME: home, MAQUETTEKIT_HOME: path.join(home, '.maquettekit'), PATH: `${bin}:${path.dirname(process.execPath)}:/usr/bin:/bin`, CLAUDE_CONFIG_DIR: '' };
  delete env.CLAUDE_CONFIG_DIR;
  delete env.XDG_CONFIG_HOME;
  delete env.CODEX_HOME;
  const run = (...args) => spawnSync(process.execPath, [INSTALL, ...args], { encoding: 'utf8', env });
  return { home, log, run, s3: path.join(home, '.maquettekit'), cleanup: () => fs.rmSync(home, { recursive: true, force: true }) };
}

test('skills mode: install links every skill, tools run from the payload, uninstall removes everything', () => {
  const sb = sandbox();
  try {
    const r = sb.run('install', '--host', 'all', '--mode', 'skills');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    for (const dir of [path.join(sb.home, '.claude', 'skills'), path.join(sb.home, '.agents', 'skills'), path.join(sb.home, '.gemini', 'config', 'skills')]) {
      const skills = fs.readdirSync(dir);
      assert.equal(skills.length, SKILLS.length, `${dir} has ${SKILLS.length} skills`);
      for (const s of skills) {
        assert.ok(fs.lstatSync(path.join(dir, s)).isSymbolicLink());
        assert.ok(fs.existsSync(path.join(dir, s, 'SKILL.md')), `${s} resolves`);
      }
    }
    const payload = path.join(sb.s3, 'marketplace', 'plugins', 'maquettekit');
    assert.ok(fs.existsSync(path.join(payload, '.claude-plugin', 'plugin.json')));
    assert.ok(fs.existsSync(path.join(payload, '.codex-plugin', 'plugin.json')));
    assert.ok(fs.existsSync(path.join(sb.s3, 'marketplace', '.agents', 'plugins', 'marketplace.json')));
    assert.ok(!fs.existsSync(path.join(payload, 'node_modules')));
    const v = spawnSync(process.execPath, [path.join(payload, 'tools', 'maquettekit.mjs'), '--version'], { encoding: 'utf8' });
    assert.equal(v.stdout.trim(), VERSION);
    const state = JSON.parse(fs.readFileSync(path.join(sb.s3, 'install.json'), 'utf8'));
    assert.equal(state.version, VERSION);
    assert.equal(state.hosts.claude.mode, 'skills');
    assert.equal(state.links.length, SKILLS.length * 3, 'claude, codex and antigravity linked; opencode reuses them');
    assert.equal(state.hosts.opencode.mode, 'shared');
    assert.equal(state.hosts.antigravity.mode, 'skills');
    const agSkill = fs.readFileSync(path.join(sb.home, '.gemini', 'config', 'skills', 'studio-setup', 'SKILL.md'), 'utf8');
    assert.ok(!agSkill.includes('${CLAUDE_PLUGIN_ROOT}'), 'plugin-root variable rendered for hosts that do not substitute it');
    assert.ok(agSkill.includes(`${payload}/tools/maquettekit.mjs`), 'skills point at the installed tools');

    const st = sb.run('status', '--json');
    assert.equal(JSON.parse(st.stdout).installed, true);

    const u = sb.run('uninstall');
    assert.equal(u.status, 0, u.stdout + u.stderr);
    assert.equal(fs.readdirSync(path.join(sb.home, '.claude', 'skills')).length, 0);
    assert.ok(!fs.existsSync(path.join(sb.s3, 'marketplace')));
    assert.ok(!fs.existsSync(path.join(sb.s3, 'install.json')));
  } finally { sb.cleanup(); }
});

test('OpenCode and Antigravity: skills-only hosts, own directories, auto-detected, cleanly removed', () => {
  const sb = sandbox();
  try {
    const plugin = sb.run('install', '--host', 'opencode', '--mode', 'plugin');
    assert.equal(plugin.status, 1);
    assert.match(plugin.stderr, /opencode has no plugin CLI/);

    const oc = path.join(sb.home, '.config', 'opencode', 'skills');
    const ag = path.join(sb.home, '.gemini', 'config', 'skills');
    const r = sb.run('install', '--host', 'opencode,antigravity');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    for (const dir of [oc, ag]) {
      assert.deepEqual(fs.readdirSync(dir).sort(), [...SKILLS].sort(), dir);
      const md = fs.readFileSync(path.join(dir, 'studio-product', 'SKILL.md'), 'utf8');
      assert.match(md, /^---\nname: studio-product\n/, 'Agent Skills frontmatter intact');
    }
    assert.ok(!fs.existsSync(path.join(sb.home, '.claude')) && !fs.existsSync(path.join(sb.home, '.agents')), 'other hosts untouched');
    assert.match(r.stdout, /antigravity: skills linked in .*→  invoke with \/studio-product/);

    assert.equal(sb.run('uninstall', '--host', 'antigravity').status, 0);
    assert.equal(fs.readdirSync(ag).length, 0);
    assert.equal(fs.readdirSync(oc).length, SKILLS.length, 'opencode kept');
    assert.equal(sb.run('uninstall').status, 0);
    assert.equal(fs.readdirSync(oc).length, 0);
    assert.ok(!fs.existsSync(path.join(sb.s3, 'marketplace')));

    // auto mode picks up hosts from their config directories
    fs.mkdirSync(path.join(sb.home, '.gemini', 'antigravity'), { recursive: true });
    fs.mkdirSync(path.join(sb.home, '.config', 'opencode'), { recursive: true });
    const auto = sb.run('install');
    assert.equal(auto.status, 0, auto.stdout + auto.stderr);
    const st = JSON.parse(fs.readFileSync(path.join(sb.s3, 'install.json'), 'utf8'));
    // (a real claude/codex CLI next to node on PATH may be detected too — only the two new hosts are asserted)
    assert.ok(st.hosts.antigravity && st.hosts.opencode, JSON.stringify(st.hosts));
  } finally { sb.cleanup(); }
});

test('uninstalling the host OpenCode shares with leaves no dangling record', () => {
  const sb = sandbox();
  try {
    assert.equal(sb.run('install', '--host', 'codex,opencode', '--mode', 'skills').status, 0);
    const u = sb.run('uninstall', '--host', 'codex');
    assert.equal(u.status, 0, u.stdout + u.stderr);
    assert.match(u.stdout, /install --host opencode/);
    assert.ok(!fs.existsSync(path.join(sb.s3, 'install.json')), 'nothing left installed');
  } finally { sb.cleanup(); }
});

test('--routing-rules: marked block in each host rules file, user content kept, removed exactly on uninstall', () => {
  const sb = sandbox();
  try {
    const oc = path.join(sb.home, '.config', 'opencode', 'AGENTS.md');
    const ag = path.join(sb.home, '.gemini', 'GEMINI.md');
    const cx = path.join(sb.home, '.codex', 'AGENTS.md');
    fs.mkdirSync(path.dirname(oc), { recursive: true });
    const mine = '# My OpenCode rules\n\nAlways answer in British English.\n';
    fs.writeFileSync(oc, mine);
    const block = /<!-- maquettekit:routing-rules:start[^>]*-->\n## Maquettekit skills[\s\S]*studio-motion[\s\S]*<!-- maquettekit:routing-rules:end -->/;

    // without the flag nothing is written
    assert.equal(sb.run('install', '--host', 'antigravity').status, 0);
    assert.ok(!fs.existsSync(ag));

    const r = sb.run('install', '--host', 'codex,opencode,antigravity', '--mode', 'skills', '--routing-rules');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    for (const f of [oc, ag, cx]) assert.match(fs.readFileSync(f, 'utf8'), block, f);
    assert.ok(fs.readFileSync(oc, 'utf8').startsWith(mine.trimEnd()), 'user rules kept above the block');
    // reinstall: still exactly one block
    assert.equal(sb.run('install', '--host', 'codex,opencode,antigravity', '--mode', 'skills', '--routing-rules', '--force').status, 0);
    assert.equal(fs.readFileSync(oc, 'utf8').split('maquettekit:routing-rules:start').length, 2);

    // removing one host removes its block only; a file the installer created is deleted
    assert.equal(sb.run('uninstall', '--host', 'antigravity').status, 0);
    assert.ok(!fs.existsSync(ag), 'GEMINI.md was created by the installer and is now empty');
    assert.match(fs.readFileSync(oc, 'utf8'), block);
    assert.equal(sb.run('uninstall').status, 0);
    assert.equal(fs.readFileSync(oc, 'utf8'), mine, 'user file restored exactly');
    assert.ok(!fs.existsSync(cx));
  } finally { sb.cleanup(); }
});

test('--routing-rules skips Claude Code in plugin mode (the plugin hook covers it)', () => {
  const sb = sandbox({ fakeClis: ['claude'] });
  try {
    const r = sb.run('install', '--host', 'claude', '--routing-rules');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(!fs.existsSync(path.join(sb.home, '.claude', 'CLAUDE.md')));
    const skills = sb.run('install', '--host', 'claude', '--mode', 'skills', '--routing-rules', '--force');
    assert.equal(skills.status, 0, skills.stdout + skills.stderr);
    assert.match(fs.readFileSync(path.join(sb.home, '.claude', 'CLAUDE.md'), 'utf8'), /maquettekit:routing-rules:start/);
    assert.equal(sb.run('uninstall').status, 0);
    assert.ok(!fs.existsSync(path.join(sb.home, '.claude', 'CLAUDE.md')));
  } finally { sb.cleanup(); }
});

test('upgrade backs up the previous payload; downgrade is refused without --force', () => {
  const sb = sandbox();
  try {
    assert.equal(sb.run('install', '--host', 'codex', '--mode', 'skills').status, 0);
    const stateFile = path.join(sb.s3, 'install.json');
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    fs.writeFileSync(path.join(sb.s3, 'marketplace', 'MARKER'), 'old');
    fs.writeFileSync(stateFile, JSON.stringify({ ...state, version: '3.9.0' }));
    const up = sb.run('install', '--host', 'codex', '--mode', 'skills');
    assert.equal(up.status, 0, up.stdout + up.stderr);
    assert.match(up.stdout, /Upgrading 3\.9\.0 → /);
    const backups = fs.readdirSync(path.join(sb.s3, 'backups'));
    assert.equal(backups.length, 1);
    assert.match(backups[0], /^maquettekit-3\.9\.0-/);
    assert.ok(fs.existsSync(path.join(sb.s3, 'backups', backups[0], 'MARKER')), 'old payload preserved in backup');
    assert.ok(!fs.existsSync(path.join(sb.s3, 'marketplace', 'MARKER')), 'new payload is clean');
    assert.equal(JSON.parse(fs.readFileSync(stateFile, 'utf8')).previousVersion, '3.9.0');
    assert.equal(fs.readdirSync(path.join(sb.home, '.agents', 'skills')).length, SKILLS.length, 'links re-created once');

    fs.writeFileSync(stateFile, JSON.stringify({ ...state, version: '99.0.0' }));
    const down = sb.run('install', '--host', 'codex', '--mode', 'skills');
    assert.equal(down.status, 1);
    assert.match(down.stderr, /Refusing to downgrade/);
    assert.equal(sb.run('install', '--host', 'codex', '--mode', 'skills', '--force').status, 0);
  } finally { sb.cleanup(); }
});

test('plugin mode drives each host CLI with its own command syntax', () => {
  const sb = sandbox({ fakeClis: ['claude', 'codex'] });
  try {
    const r = sb.run('install');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const log = fs.readFileSync(sb.log, 'utf8');
    const target = path.join(sb.s3, 'marketplace');
    assert.ok(log.includes(`claude plugin marketplace add ${target}`));
    assert.ok(log.includes('claude plugin install maquettekit@maquettekit-marketplace'));
    assert.ok(log.includes(`codex plugin marketplace add ${target}`));
    assert.ok(log.includes('codex plugin add maquettekit@maquettekit-marketplace'), 'Codex uses "plugin add", not "plugin install"');
    assert.ok(!log.includes('codex plugin install'));
    fs.writeFileSync(sb.log, '');
    assert.equal(sb.run('uninstall').status, 0);
    const out = fs.readFileSync(sb.log, 'utf8');
    assert.ok(out.includes('claude plugin uninstall maquettekit@maquettekit-marketplace'));
    assert.ok(out.includes('codex plugin remove maquettekit@maquettekit-marketplace'));
    assert.ok(out.includes('plugin marketplace remove maquettekit-marketplace'));
  } finally { sb.cleanup(); }
});

test('--dry-run changes nothing', () => {
  const sb = sandbox();
  try {
    const r = sb.run('install', '--mode', 'skills', '--dry-run');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /\[dry-run\]/);
    assert.ok(!fs.existsSync(sb.s3));
    assert.ok(!fs.existsSync(path.join(sb.home, '.agents')));
  } finally { sb.cleanup(); }
});

test('--mode plugin without the host CLI fails clearly; unmanaged skill dirs are not overwritten', () => {
  const sb = sandbox();
  try {
    const r = sb.run('install', '--host', 'codex', '--mode', 'plugin');
    assert.equal(r.status, 1);
    assert.match(r.stderr, /needs the "codex" CLI/);
    const mine = path.join(sb.home, '.agents', 'skills', 'studio-product');
    fs.mkdirSync(mine, { recursive: true });
    fs.writeFileSync(path.join(mine, 'SKILL.md'), 'user file');
    const s = sb.run('install', '--host', 'codex', '--mode', 'skills');
    assert.equal(s.status, 0);
    assert.match(s.stdout, /not managed by Maquettekit — skipped/);
    assert.equal(fs.readFileSync(path.join(mine, 'SKILL.md'), 'utf8'), 'user file');
  } finally { sb.cleanup(); }
});

const hasClaude = spawnSync('which', ['claude']).status === 0;
test('real Claude Code CLI: marketplace add → install → details → uninstall', { skip: hasClaude ? false : 'claude CLI not on PATH' }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 's3-claude-'));
  const env = { ...process.env, HOME: home, MAQUETTEKIT_HOME: path.join(home, '.maquettekit') };
  delete env.CLAUDE_CONFIG_DIR;
  try {
    const r = spawnSync(process.execPath, [INSTALL, 'install', '--host', 'claude', '--mode', 'plugin'], { encoding: 'utf8', env });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const list = spawnSync('claude', ['plugin', 'list'], { encoding: 'utf8', env });
    assert.match(list.stdout + list.stderr, /maquettekit@maquettekit-marketplace/);
    const details = spawnSync('claude', ['plugin', 'details', 'maquettekit'], { encoding: 'utf8', env });
    assert.match(details.stdout + details.stderr, new RegExp(`Skills \\(${SKILLS.length}\\)`));
    const u = spawnSync(process.execPath, [INSTALL, 'uninstall'], { encoding: 'utf8', env });
    assert.equal(u.status, 0, u.stdout + u.stderr);
    const after = spawnSync('claude', ['plugin', 'list'], { encoding: 'utf8', env });
    assert.doesNotMatch(after.stdout + after.stderr, /maquettekit@maquettekit-marketplace/);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('Codex CLI install (skipped: no Codex CLI in this environment)', { skip: spawnSync('which', ['codex']).status === 0 ? 'covered by the fake-CLI test; a live Codex run needs an authenticated CLI' : 'codex CLI not on PATH — command syntax verified against the Codex source and the fake-CLI test' }, () => {});
