// The Claude Code routing-hint hook (plugins/maquettekit/hooks): suggests the right skill for UI work, stays
// silent otherwise, suggests each skill once per session, can be switched off and never fails a prompt.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, REQUIRED_SKILLS } from '../../scripts/validate-plugin.mjs';
import { suggest, ROUTES } from '../../plugins/maquettekit/hooks/route-hint.mjs';

const PLUGIN = path.join(ROOT, 'plugins', 'maquettekit');
const HOOK = path.join(PLUGIN, 'hooks', 'route-hint.mjs');
const EVALS = path.join(PLUGIN, 'evals');

function runHook(input, env = {}) {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-hint-'));
  const r = spawnSync(process.execPath, [HOOK], { input: typeof input === 'string' ? input : JSON.stringify(input), encoding: 'utf8', env: { ...process.env, CLAUDE_PLUGIN_DATA: data, MAQUETTEKIT_ROUTING_HINTS: '', ...env } });
  return { ...r, data, context: r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.additionalContext : '' };
}

test('hooks.json registers the hook for UserPromptSubmit with a short timeout', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'hooks', 'hooks.json'), 'utf8'));
  const entry = cfg.hooks.UserPromptSubmit[0].hooks[0];
  assert.equal(entry.type, 'command');
  assert.match(entry.command, /\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/route-hint\.mjs/);
  assert.ok(entry.timeout <= 10);
  for (const r of ROUTES) assert.ok(REQUIRED_SKILLS.includes(r.skill), `${r.skill} exists`);
});

test('every routing eval prompt gets its expected skill among the suggestions; the backend bug gets none', () => {
  const cases = fs.readdirSync(EVALS).filter((c) => c.startsWith('trigger-'));
  assert.ok(cases.length >= 15);
  for (const c of cases) {
    const prompt = fs.readFileSync(path.join(EVALS, c, 'prompt.md'), 'utf8').split(/\n---\n/)[1].trim();
    const want = fs.readFileSync(path.join(EVALS, c, 'graders', fs.existsSync(path.join(EVALS, c, 'graders', 'right-skill.md')) ? 'right-skill.md' : 'no-studio.md'), 'utf8').match(/\)\?(studio-[a-z0-9-]+)"/)?.[1];
    const got = suggest(prompt).map((s) => s.skill);
    if (c === 'trigger-negative-backend') assert.deepEqual(got, [], `${c}: no hint for backend work`);
    else assert.ok(got.includes(want), `${c}: expected ${want}, got ${got.join(', ') || 'nothing'}`);
  }
});

test('boundary cases: a passing topic word does not pull in the neighbouring studio', () => {
  assert.deepEqual(suggest('Design the marketing page for our analytics product. It should quote three headline numbers and have a demo-request form.').map((s) => s.skill), ['studio-product']);
  assert.ok(!suggest('What hover and press micro-interactions should the buttons on our settings screen have?').some((s) => s.skill === 'studio-cinematic'));
  assert.deepEqual(suggest('Our analytics pipeline drops events from the Kafka consumer'), [], 'a single topic word is not enough for a hint');
  assert.deepEqual(suggest('Refactor the payment service to use the repository pattern'), []);
});

test('the hook prints a JSON additionalContext hint naming the plugin skill', () => {
  const r = runHook({ session_id: 's1', prompt: 'Create cards.html: six feature cards that enter with a staggered animation.' });
  assert.equal(r.status, 0);
  assert.match(r.context, /`maquettekit:studio-motion`/);
  assert.match(r.context, /Ignore this hint if the request is not front-end or design work/);
  assert.ok(!r.stdout.includes('cards.html'), 'the prompt is never echoed');
});

test('each skill is suggested once per session; a new session gets it again', () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-hint-'));
  const env = { CLAUDE_PLUGIN_DATA: data };
  const p = { session_id: 'abc', prompt: 'Build a KPI dashboard with a line chart' };
  assert.match(runHook(p, env).context, /studio-data/);
  assert.equal(runHook(p, env).stdout, '', 'already suggested in this session');
  assert.match(runHook({ ...p, session_id: 'other' }, env).context, /studio-data/);
  const stored = fs.readFileSync(path.join(data, 'route-hints', 'abc.json'), 'utf8');
  assert.ok(!stored.includes('dashboard'), 'state holds skill names only, never the prompt');
});

test('switched off by MAQUETTEKIT_ROUTING_HINTS=0; bad input never fails the prompt', () => {
  assert.equal(runHook({ session_id: 'x', prompt: 'design a pricing page' }, { MAQUETTEKIT_ROUTING_HINTS: '0' }).stdout, '');
  for (const bad of ['not json', '', '{"prompt": 42}', '{}']) {
    const r = runHook(bad);
    assert.equal(r.status, 0, `exit 0 for ${JSON.stringify(bad)}`);
    assert.equal(r.stdout, '');
  }
});
