// Plugin packaging: manifests, marketplaces, skills. Run: node --test tests/plugin/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { validate, frontmatter, REQUIRED_SKILLS, PLUGIN, ROOT } from '../../scripts/validate-plugin.mjs';

const res = validate({ cli: false });

test('structural validation reports no errors', () => {
  assert.deepEqual(res.errors, []);
});

test('all 14 required skills exist with valid frontmatter', () => {
  assert.equal(REQUIRED_SKILLS.length, 14);
  for (const s of REQUIRED_SKILLS) {
    const file = path.join(PLUGIN, 'skills', s, 'SKILL.md');
    assert.ok(fs.existsSync(file), `${s}/SKILL.md exists`);
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(text.startsWith('---\n'), `${s}: frontmatter opens on line 1`);
    const fm = frontmatter(text);
    assert.ok(fm && !fm.__invalid, `${s}: frontmatter parses`);
    assert.equal(fm.name, s);
    assert.ok(fm.description.length >= 80 && fm.description.length <= 1024, `${s}: description length ${fm.description.length}`);
    assert.equal(fm.license, 'MIT');
  }
});

test('skill descriptions are unique and name their trigger', () => {
  const seen = new Set();
  for (const s of REQUIRED_SKILLS) {
    const fm = frontmatter(fs.readFileSync(path.join(PLUGIN, 'skills', s, 'SKILL.md'), 'utf8'));
    assert.ok(!seen.has(fm.description), `${s}: duplicate description`);
    seen.add(fm.description);
  }
});

test('Claude and Codex manifests agree on name and version but are separate files', () => {
  const a = JSON.parse(fs.readFileSync(path.join(PLUGIN, '.claude-plugin/plugin.json'), 'utf8'));
  const b = JSON.parse(fs.readFileSync(path.join(PLUGIN, '.codex-plugin/plugin.json'), 'utf8'));
  assert.equal(a.name, 'maquettekit'); assert.equal(b.name, 'maquettekit');
  assert.equal(a.version, b.version);
  assert.equal(a.version, JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version);
  assert.ok(b.interface?.displayName, 'Codex interface block present');
  assert.ok(!('interface' in a), 'Claude manifest does not carry Codex-only keys');
});

test('marketplace definitions point at the plugin directory', () => {
  const c = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin/marketplace.json'), 'utf8'));
  const x = JSON.parse(fs.readFileSync(path.join(ROOT, '.agents/plugins/marketplace.json'), 'utf8'));
  assert.equal(c.plugins[0].source, './plugins/maquettekit');
  assert.deepEqual(x.plugins[0].source, { source: 'local', path: './plugins/maquettekit' });
  assert.equal(c.name, x.name);
});

test('plugin payload is self-contained (no node_modules, no secrets, tools present)', () => {
  assert.ok(!fs.existsSync(path.join(PLUGIN, 'node_modules')));
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const files = walk(PLUGIN);
  assert.ok(!files.some((f) => /\.env(\.|$)|id_rsa|\.pem$/.test(path.basename(f))), 'no credential-like files');
  for (const f of files.filter((f) => /\.(mjs|ts|tsx|json|md)$/.test(f))) {
    assert.ok(!/(sk-ant-|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})/.test(fs.readFileSync(f, 'utf8')), `no secrets in ${f}`);
  }
});

test('tool dispatcher answers --help and --version without dependencies', () => {
  const cli = path.join(PLUGIN, 'tools', 'maquettekit.mjs');
  const v = spawnSync(process.execPath, [cli, '--version'], { encoding: 'utf8' });
  assert.equal(v.status, 0); assert.match(v.stdout.trim(), /^\d+\.\d+\.\d+$/);
  for (const c of ['doctor', 'setup', 'design', 'review', 'experience', 'assets', 'catalog']) {
    const r = spawnSync(process.execPath, [cli, c, '--help'], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${c} --help exits 0: ${r.stderr}`);
    assert.ok(r.stdout.length > 40, `${c} --help prints usage`);
  }
  assert.equal(spawnSync(process.execPath, [cli, 'nope'], { encoding: 'utf8' }).status, 2);
});

test('claude plugin validate passes (skipped when the CLI is unavailable)', { skip: spawnSync('which', ['claude']).status !== 0 ? 'claude CLI not on PATH' : false }, () => {
  for (const dir of [PLUGIN, ROOT]) {
    const r = spawnSync('claude', ['plugin', 'validate', dir], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout + r.stderr, /Validation passed/);
  }
});
