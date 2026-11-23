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

function sandbox({ fakeClis = [] } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 's3-home-'));
  const bin = path.join(home, 'bin');
  fs.mkdirSync(bin);
  const log = path.join(home, 'cli.log');
  for (const name of fakeClis) {
    fs.writeFileSync(path.join(bin, name), `#!/bin/sh\necho "${name} $*" >> "${log}"\nexit 0\n`, { mode: 0o755 });
  }
  // PATH: fake CLIs + node only — real host CLIs are deliberately invisible.
  const env = { ...process.env, HOME: home, STUDIO3_HOME: path.join(home, '.studio3'), PATH: `${bin}:${path.dirname(process.execPath)}:/usr/bin:/bin`, CLAUDE_CONFIG_DIR: '' };
  delete env.CLAUDE_CONFIG_DIR;
  const run = (...args) => spawnSync(process.execPath, [INSTALL, ...args], { encoding: 'utf8', env });
  return { home, log, run, s3: path.join(home, '.studio3'), cleanup: () => fs.rmSync(home, { recursive: true, force: true }) };
}

test('skills mode: install links 12 skills, tools run from the payload, uninstall removes everything', () => {
  const sb = sandbox();
  try {
    const r = sb.run('install', '--host', 'all', '--mode', 'skills');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    for (const dir of [path.join(sb.home, '.claude', 'skills'), path.join(sb.home, '.agents', 'skills')]) {
      const skills = fs.readdirSync(dir);
      assert.equal(skills.length, 12, `${dir} has 12 skills`);
      for (const s of skills) {
        assert.ok(fs.lstatSync(path.join(dir, s)).isSymbolicLink());
        assert.ok(fs.existsSync(path.join(dir, s, 'SKILL.md')), `${s} resolves`);
      }
    }
    const payload = path.join(sb.s3, 'marketplace', 'plugins', 'studio3');
    assert.ok(fs.existsSync(path.join(payload, '.claude-plugin', 'plugin.json')));
    assert.ok(fs.existsSync(path.join(payload, '.codex-plugin', 'plugin.json')));
    assert.ok(fs.existsSync(path.join(sb.s3, 'marketplace', '.agents', 'plugins', 'marketplace.json')));
    assert.ok(!fs.existsSync(path.join(payload, 'node_modules')));
    const v = spawnSync(process.execPath, [path.join(payload, 'tools', 'studio3.mjs'), '--version'], { encoding: 'utf8' });
    assert.equal(v.stdout.trim(), VERSION);
    const state = JSON.parse(fs.readFileSync(path.join(sb.s3, 'install.json'), 'utf8'));
    assert.equal(state.version, VERSION);
    assert.equal(state.hosts.claude.mode, 'skills');
    assert.equal(state.links.length, 24);

    const st = sb.run('status', '--json');
    assert.equal(JSON.parse(st.stdout).installed, true);

    const u = sb.run('uninstall');
    assert.equal(u.status, 0, u.stdout + u.stderr);
    assert.equal(fs.readdirSync(path.join(sb.home, '.claude', 'skills')).length, 0);
    assert.ok(!fs.existsSync(path.join(sb.s3, 'marketplace')));
    assert.ok(!fs.existsSync(path.join(sb.s3, 'install.json')));
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
    assert.match(backups[0], /^studio3-3\.9\.0-/);
    assert.ok(fs.existsSync(path.join(sb.s3, 'backups', backups[0], 'MARKER')), 'old payload preserved in backup');
    assert.ok(!fs.existsSync(path.join(sb.s3, 'marketplace', 'MARKER')), 'new payload is clean');
    assert.equal(JSON.parse(fs.readFileSync(stateFile, 'utf8')).previousVersion, '3.9.0');
    assert.equal(fs.readdirSync(path.join(sb.home, '.agents', 'skills')).length, 12, 'links re-created once');

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
    assert.ok(log.includes('claude plugin install studio3@studio3-marketplace'));
    assert.ok(log.includes(`codex plugin marketplace add ${target}`));
    assert.ok(log.includes('codex plugin add studio3@studio3-marketplace'), 'Codex uses "plugin add", not "plugin install"');
    assert.ok(!log.includes('codex plugin install'));
    fs.writeFileSync(sb.log, '');
    assert.equal(sb.run('uninstall').status, 0);
    const out = fs.readFileSync(sb.log, 'utf8');
    assert.ok(out.includes('claude plugin uninstall studio3@studio3-marketplace'));
    assert.ok(out.includes('codex plugin remove studio3@studio3-marketplace'));
    assert.ok(out.includes('plugin marketplace remove studio3-marketplace'));
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
    assert.match(s.stdout, /not managed by Studio³ — skipped/);
    assert.equal(fs.readFileSync(path.join(mine, 'SKILL.md'), 'utf8'), 'user file');
  } finally { sb.cleanup(); }
});

const hasClaude = spawnSync('which', ['claude']).status === 0;
test('real Claude Code CLI: marketplace add → install → details → uninstall', { skip: hasClaude ? false : 'claude CLI not on PATH' }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 's3-claude-'));
  const env = { ...process.env, HOME: home, STUDIO3_HOME: path.join(home, '.studio3') };
  delete env.CLAUDE_CONFIG_DIR;
  try {
    const r = spawnSync(process.execPath, [INSTALL, 'install', '--host', 'claude', '--mode', 'plugin'], { encoding: 'utf8', env });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const list = spawnSync('claude', ['plugin', 'list'], { encoding: 'utf8', env });
    assert.match(list.stdout + list.stderr, /studio3@studio3-marketplace/);
    const details = spawnSync('claude', ['plugin', 'details', 'studio3'], { encoding: 'utf8', env });
    assert.match(details.stdout + details.stderr, /Skills \(12\)/);
    const u = spawnSync(process.execPath, [INSTALL, 'uninstall'], { encoding: 'utf8', env });
    assert.equal(u.status, 0, u.stdout + u.stderr);
    const after = spawnSync('claude', ['plugin', 'list'], { encoding: 'utf8', env });
    assert.doesNotMatch(after.stdout + after.stderr, /studio3@studio3-marketplace/);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('Codex CLI install (skipped: no Codex CLI in this environment)', { skip: spawnSync('which', ['codex']).status === 0 ? 'covered by the fake-CLI test; a live Codex run needs an authenticated CLI' : 'codex CLI not on PATH — command syntax verified against the Codex source and the fake-CLI test' }, () => {});
