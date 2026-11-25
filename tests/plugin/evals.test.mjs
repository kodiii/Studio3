// The skill eval suite (plugins/maquettekit/evals, run with `claude plugin eval`) stays well-formed:
// every case loads, every grader is a known type with a compilable pattern, and every skill has a routing case.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, REQUIRED_SKILLS } from '../../scripts/validate-plugin.mjs';

const EVALS = path.join(ROOT, 'plugins', 'maquettekit', 'evals');
const GRADER_TYPES = new Set(['regex', 'tool_used', 'tool_order', 'file_exists', 'llm', 'baseline']);
const unquote = (v) => (/^'.*'$/s.test(v) ? v.slice(1, -1).replace(/''/g, "'") : v);
function frontmatter(file) {
  const m = fs.readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  assert.ok(m, `${file}: frontmatter`);
  const data = {};
  for (const line of m[1].split('\n')) { const i = line.indexOf(':'); if (i > 0) data[line.slice(0, i).trim()] = unquote(line.slice(i + 1).trim()); }
  return { data, body: m[2].trim() };
}
const cases = fs.readdirSync(EVALS, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== 'results').map((d) => d.name);

test('eval suite: every case and grader is well-formed', () => {
  assert.ok(cases.length >= 20, `found ${cases.length} cases`);
  for (const c of cases) {
    const { data, body } = frontmatter(path.join(EVALS, c, 'prompt.md'));
    assert.equal(data.name, c, `${c}: name matches directory`);
    assert.ok(body.length > 20, `${c}: has a prompt`);
    assert.ok(Number(data.max_turns) > 0 && Number(data.timeout_seconds) > 0, `${c}: bounded`);
    const graders = fs.readdirSync(path.join(EVALS, c, 'graders'));
    assert.ok(graders.length, `${c}: has graders`);
    for (const g of graders) {
      const { data: gd, body: gb } = frontmatter(path.join(EVALS, c, 'graders', g));
      assert.ok(GRADER_TYPES.has(gd.type), `${c}/${g}: grader type ${gd.type}`);
      for (const k of ['pattern', 'input_match']) if (gd[k]) assert.doesNotThrow(() => new RegExp(gd[k], gd.flags ?? ''), `${c}/${g}: ${k} compiles`);
      if (gd.type === 'llm') assert.ok(gb.length > 40, `${c}/${g}: llm grader has criteria`);
      if (gd.type === 'regex' || gd.type === 'tool_used') assert.ok(gd.pattern || gd.input_match || gd.tool, `${c}/${g}: has something to match`);
    }
  }
});

test('eval suite: scaffolded project cases ship an executable scaffold and a fixture project', () => {
  const scaffolded = cases.filter((c) => fs.existsSync(path.join(EVALS, c, 'case.yaml')));
  assert.ok(scaffolded.length >= 3, `found ${scaffolded.length} scaffolded cases`);
  for (const c of scaffolded) {
    const yaml = fs.readFileSync(path.join(EVALS, c, 'case.yaml'), 'utf8');
    assert.match(yaml, /schema_version:\s*"1\.1"/, `${c}: case.yaml schema version`);
    assert.match(yaml, new RegExp(`name:\\s*${c}\\b`), `${c}: case.yaml name matches directory`);
    const script = yaml.match(/scaffold_script:\s*(\S+)/)?.[1];
    assert.ok(script, `${c}: declares a scaffold_script`);
    const file = path.join(EVALS, c, script);
    assert.ok(fs.existsSync(file) && (fs.statSync(file).mode & 0o111), `${c}: ${script} exists and is executable`);
    const fixture = path.join(EVALS, c, 'fixture');
    assert.ok(fs.existsSync(fixture) && fs.readdirSync(fixture).length > 1, `${c}: has a multi-file fixture`);
    // every file a grader reads must exist in the fixture (the agent edits it, it does not create it)
    for (const g of fs.readdirSync(path.join(EVALS, c, 'graders'))) {
      const m = fs.readFileSync(path.join(EVALS, c, 'graders', g), 'utf8').match(/(?:target|focus):\s*\{source:\s*file,\s*path:\s*([^}\s]+)\s*\}/);
      if (m) assert.ok(fs.existsSync(path.join(fixture, m[1])), `${c}/${g}: ${m[1]} is in the fixture`);
    }
  }
});

test('eval suite: every skill has a routing case and every routed skill exists', () => {
  const routed = new Set();
  for (const c of cases.filter((x) => x.startsWith('trigger-'))) {
    for (const g of fs.readdirSync(path.join(EVALS, c, 'graders'))) {
      const m = frontmatter(path.join(EVALS, c, 'graders', g)).data.input_match?.match(/\)\?(studio-[a-z0-9-]+)"$/);
      if (m) routed.add(m[1]);
    }
  }
  for (const s of routed) assert.ok(REQUIRED_SKILLS.includes(s), `routed skill ${s} exists`);
  for (const s of REQUIRED_SKILLS) assert.ok(routed.has(s), `${s} has a trigger case`);
});
