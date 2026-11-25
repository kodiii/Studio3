// The opt-in review gate (Stop hook) and the design-critic agent shipped with the Claude Code plugin.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../../scripts/validate-plugin.mjs';
import { gate } from '../../plugins/maquettekit/hooks/review-gate.mjs';

const PLUGIN = path.join(ROOT, 'plugins', 'maquettekit');

function project(summary, loop = { passesDone: 1, maxPasses: 3 }, ageHours = 0) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-gate-'));
  const file = path.join(dir, '.maquettekit', 'check', 'check.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ summary, steps: { review: { loop } } }));
  if (ageHours) { const t = (Date.now() - ageHours * 3_600_000) / 1000; fs.utimesSync(file, t, t); }
  return dir;
}

test('off by default; blocks on critical items when enabled; "major" widens it', () => {
  const dir = project({ critical: 2, major: 3, minor: 1 });
  assert.equal(gate({ cwd: dir }, {}), null);
  assert.equal(gate({ cwd: dir }, { MAQUETTEKIT_REVIEW_GATE: '0' }), null);
  const v = gate({ cwd: dir }, { MAQUETTEKIT_REVIEW_GATE: '1' });
  assert.equal(v.decision, 'block');
  assert.match(v.reason, /2 critical item\(s\)/);
  assert.match(v.reason, /2 more pass\(es\)/);
  assert.match(gate({ cwd: dir }, { MAQUETTEKIT_REVIEW_GATE: 'major' }).reason, /2 critical and 3 major/);
  const onlyMajor = project({ critical: 0, major: 4, minor: 0 });
  assert.equal(gate({ cwd: onlyMajor }, { MAQUETTEKIT_REVIEW_GATE: '1' }), null);
  assert.equal(gate({ cwd: onlyMajor }, { MAQUETTEKIT_REVIEW_GATE: 'major' }).decision, 'block');
});

test('never blocks twice in a row, after the review budget, on stale results or without a check file', () => {
  const env = { MAQUETTEKIT_REVIEW_GATE: '1' };
  assert.equal(gate({ cwd: project({ critical: 1 }), stop_hook_active: true }, env), null);
  assert.equal(gate({ cwd: project({ critical: 1 }, { passesDone: 3, maxPasses: 3 }) }, env), null);
  assert.equal(gate({ cwd: project({ critical: 1 }, undefined, 13) }, env), null);
  assert.equal(gate({ cwd: project({ critical: 1 }, undefined, 13) }, { ...env, MAQUETTEKIT_REVIEW_GATE_MAX_AGE_HOURS: '24' }).decision, 'block');
  assert.equal(gate({ cwd: fs.mkdtempSync(path.join(os.tmpdir(), 'mk-gate-empty-')) }, env), null);
});

test('as a process: prints the block decision as JSON, exits 0, and survives bad input', () => {
  const hook = path.join(PLUGIN, 'hooks', 'review-gate.mjs');
  const dir = project({ critical: 1, major: 0, minor: 0 });
  const run = (input, env) => spawnSync(process.execPath, [hook], { input, encoding: 'utf8', env: { ...process.env, MAQUETTEKIT_REVIEW_GATE: '', ...env } });
  const on = run(JSON.stringify({ cwd: dir, hook_event_name: 'Stop', stop_hook_active: false }), { MAQUETTEKIT_REVIEW_GATE: '1' });
  assert.equal(on.status, 0);
  assert.equal(JSON.parse(on.stdout).decision, 'block');
  assert.equal(run(JSON.stringify({ cwd: dir }), {}).stdout, '');
  for (const bad of ['not json', '']) assert.equal(run(bad, { MAQUETTEKIT_REVIEW_GATE: '1' }).status, 0);
  const cfg = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'hooks', 'hooks.json'), 'utf8'));
  assert.match(cfg.hooks.Stop[0].hooks[0].command, /review-gate\.mjs/);
});

test('the design-critic agent is read-only and self-contained', () => {
  const text = fs.readFileSync(path.join(PLUGIN, 'agents', 'design-critic.md'), 'utf8');
  const fm = Object.fromEntries(text.split('\n---\n')[0].replace(/^---\n/, '').split('\n').map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1).trim()]));
  assert.equal(fm.name, 'design-critic');
  assert.ok(fm.description.length > 100);
  const tools = fm.tools.split(',').map((t) => t.trim());
  assert.deepEqual(tools.filter((t) => /^(Write|Edit|Bash|NotebookEdit)$/.test(t)), [], 'no tool that can change files');
  for (const axis of ['Composition', 'Typography', 'Hierarchy', 'Spacing', 'Originality', 'Motion purpose']) assert.ok(text.includes(`| ${axis} |`), axis);
  assert.match(text, /Verdict/);
});
