#!/usr/bin/env node
// @ts-check
/**
 * Builds release archives in dist/:
 *   studio3-plugin-<version>.tar.gz   installable payload: marketplace manifests, plugins/studio3, installer, docs
 *   studio3-source-<version>.tar.gz   full source of HEAD (git archive) — requires a clean, committed tree
 *   studio3-source-<version>.zip      same, zip
 *   SHA256SUMS                        checksums of the above
 * Usage: node scripts/package-release.mjs [--allow-dirty] [--out dist] [--skip-checks]
 *   --skip-checks  local smoke builds only: skip the catalogue/validation preconditions (never for a real release)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const OUT = path.resolve(ROOT, args.includes('--out') ? args[args.indexOf('--out') + 1] : 'dist');
const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

const run = (cmd, a, opts = {}) => {
  const r = spawnSync(cmd, a, { cwd: ROOT, encoding: 'utf8', ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${a.join(' ')} failed:\n${r.stderr || r.stdout}`);
  return r.stdout;
};

// 1. preconditions
for (const [label, file] of [['claude', 'plugins/studio3/.claude-plugin/plugin.json'], ['codex', 'plugins/studio3/.codex-plugin/plugin.json']]) {
  const v = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')).version;
  if (v !== version) throw new Error(`${label} manifest version ${v} != package.json ${version}`);
}
if (!args.includes('--skip-checks')) {
  run(process.execPath, ['scripts/build-catalog.mjs', '--check']);
  const val = spawnSync(process.execPath, ['scripts/validate-plugin.mjs', '--no-cli'], { cwd: ROOT, encoding: 'utf8' });
  if (val.status !== 0) throw new Error(`Plugin validation failed:\n${val.stdout}`);
} else console.error('! --skip-checks: preconditions skipped — not a releasable build');
const dirty = run('git', ['status', '--porcelain']).trim();
if (dirty && !args.includes('--allow-dirty')) throw new Error('Working tree is not clean; commit first (or pass --allow-dirty for a local test build).');

fs.mkdirSync(OUT, { recursive: true });

// 2. plugin payload
const PAYLOAD = ['.claude-plugin', '.agents', 'plugins/studio3', 'install.sh', 'uninstall.sh', 'scripts/install.mjs',
  'LICENSE', 'NOTICE.md', 'README.md', 'CHANGELOG.md', 'docs'];
const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'studio3-release-'));
const stage = path.join(stageRoot, `studio3-${version}`);
const skip = /(^|[\\/])(node_modules|\.next|\.studio3|test-results|dist|\.DS_Store)([\\/]|$)/;
for (const item of PAYLOAD) {
  const src = path.join(ROOT, item);
  if (!fs.existsSync(src)) throw new Error(`payload item missing: ${item}`);
  fs.cpSync(src, path.join(stage, item), { recursive: true, filter: (s) => !skip.test(path.relative(ROOT, s)) });
}
const pluginTar = path.join(OUT, `studio3-plugin-${version}.tar.gz`);
run('tar', ['-czf', pluginTar, '-C', stageRoot, `studio3-${version}`]);
fs.rmSync(stageRoot, { recursive: true, force: true });

// 3. source archives of HEAD
const outputs = [pluginTar];
if (!dirty) {
  for (const fmt of ['tar.gz', 'zip']) {
    const file = path.join(OUT, `studio3-source-${version}.${fmt}`);
    run('git', ['archive', '--format', fmt, '--prefix', `studio3-${version}/`, '-o', file, 'HEAD']);
    outputs.push(file);
  }
} else console.error('! dirty tree: source archives skipped (they are built from HEAD)');

// 4. checksums
const sums = outputs.map((f) => `${crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')}  ${path.basename(f)}`);
fs.writeFileSync(path.join(OUT, 'SHA256SUMS'), sums.join('\n') + '\n');
for (const f of outputs) console.log(`${path.relative(ROOT, f)}  ${(fs.statSync(f).size / 1024 / 1024).toFixed(2)} MB`);
console.log(`${path.relative(ROOT, path.join(OUT, 'SHA256SUMS'))}`);
