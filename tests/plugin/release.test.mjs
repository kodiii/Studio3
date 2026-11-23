// Release archive: builds the plugin payload archive and installs it from a clean extraction.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../../scripts/validate-plugin.mjs';

const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

test('plugin archive contains a self-sufficient installable payload', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 's3-dist-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 's3-relhome-'));
  try {
    const r = spawnSync(process.execPath, ['scripts/package-release.mjs', '--allow-dirty', '--out', out], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const tar = path.join(out, `studio3-plugin-${version}.tar.gz`);
    assert.ok(fs.existsSync(tar));
    assert.match(fs.readFileSync(path.join(out, 'SHA256SUMS'), 'utf8'), new RegExp(`[0-9a-f]{64}  studio3-plugin-${version}\\.tar\\.gz`));
    const listing = spawnSync('tar', ['-tzf', tar], { encoding: 'utf8' }).stdout.split('\n');
    const has = (p) => listing.some((l) => l === `studio3-${version}/${p}` || l.startsWith(`studio3-${version}/${p}/`));
    for (const p of ['.claude-plugin/marketplace.json', '.agents/plugins/marketplace.json', 'plugins/studio3/.claude-plugin/plugin.json',
      'plugins/studio3/.codex-plugin/plugin.json', 'plugins/studio3/tools/studio3.mjs', 'plugins/studio3/library/catalog.json',
      'install.sh', 'uninstall.sh', 'scripts/install.mjs', 'LICENSE', 'NOTICE.md', 'README.md', 'CHANGELOG.md']) {
      assert.ok(has(p), `archive contains ${p}`);
    }
    assert.ok(!listing.some((l) => l.includes('node_modules')), 'no node_modules in the archive');

    const x = fs.mkdtempSync(path.join(os.tmpdir(), 's3-extract-'));
    spawnSync('tar', ['-xzf', tar, '-C', x]);
    const dir = path.join(x, `studio3-${version}`);
    const env = { ...process.env, HOME: home, STUDIO3_HOME: path.join(home, '.studio3'), PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin` };
    delete env.CLAUDE_CONFIG_DIR;
    const inst = spawnSync('bash', [path.join(dir, 'install.sh'), '--mode', 'skills', '--host', 'all'], { encoding: 'utf8', env });
    assert.equal(inst.status, 0, inst.stdout + inst.stderr);
    const doctor = spawnSync(process.execPath, [path.join(home, '.studio3', 'marketplace', 'plugins', 'studio3', 'tools', 'studio3.mjs'), 'doctor', '--json'], { encoding: 'utf8', env });
    const report = JSON.parse(doctor.stdout);
    assert.equal(report.version, version);
    const failed = report.checks.filter((c) => c.status === 'fail').map((c) => `${c.group}/${c.id}: ${c.detail}`);
    assert.deepEqual(failed, [], 'doctor reports no failures on the installed payload');
    const un = spawnSync('bash', [path.join(dir, 'uninstall.sh')], { encoding: 'utf8', env });
    assert.equal(un.status, 0, un.stdout + un.stderr);
    fs.rmSync(x, { recursive: true, force: true });
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});
