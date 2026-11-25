// Long reference files open with a short quick card so small-context models can stop after the essentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../../scripts/validate-plugin.mjs';

const PLUGIN = path.join(ROOT, 'plugins', 'maquettekit');
const words = (t) => t.split(/\s+/).filter(Boolean).length;
const files = [
  ...fs.readdirSync(path.join(PLUGIN, 'shared')).filter((f) => f.endsWith('.md')).map((f) => path.join(PLUGIN, 'shared', f)),
  ...fs.readdirSync(path.join(PLUGIN, 'skills')).flatMap((s) => {
    const dir = path.join(PLUGIN, 'skills', s, 'references');
    return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => path.join(dir, f)) : [];
  }),
];

/** @returns {{ start: number, bullets: string[] } | null} */
function card(lines) {
  const h1 = lines.findIndex((l) => l.startsWith('# '));
  const start = lines.findIndex((l, i) => i > h1 && i <= h1 + 3 && l.startsWith('> **Quick card**'));
  if (h1 === -1 || start === -1) return null;
  const bullets = [];
  for (let i = start + 1; i < lines.length && lines[i].startsWith('>'); i++) if (lines[i].startsWith('> - ')) bullets.push(lines[i].slice(4));
  return { start, bullets };
}

test('every reference over 1500 words opens with a quick card of 5–8 concrete bullets', () => {
  const long = [];
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    const lines = text.split('\n');
    const c = card(lines);
    const bodyWords = words(text) - (c ? words(c.bullets.join(' ')) + 15 : 0);
    if (bodyWords <= 1500) continue;
    long.push(f);
    const rel = path.relative(PLUGIN, f);
    assert.ok(c, `${rel}: quick card right after the H1`);
    assert.ok(c.bullets.length >= 5 && c.bullets.length <= 8, `${rel}: ${c.bullets.length} bullets`);
    const n = words(c.bullets.join(' '));
    assert.ok(n >= 60 && n <= 170, `${rel}: card is ${n} words`);
  }
  assert.ok(long.length >= 30, `found ${long.length} long references`);
});
