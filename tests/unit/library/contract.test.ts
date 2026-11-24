// Static contract checks over every recipe and demo in the library (no DOM needed).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EFFECT_CATEGORIES, SPECIALTIES } from '../../../plugins/maquettekit/library/src/types';

const LIB = path.resolve('plugins/maquettekit/library');
const catalog = JSON.parse(fs.readFileSync(path.join(LIB, 'catalog.json'), 'utf8')) as {
  effects: Array<Record<string, any>>; demos: Array<Record<string, any>>;
};
const TECH = new Set(['css', 'waapi', 'view-transitions', 'motion', 'gsap', 'svg', 'canvas2d', 'd3', 'three', 'r3f', 'drei', 'rapier', 'glsl']);
const INTERACTION = new Set(['none', 'hover', 'press', 'drag', 'scroll', 'pointer', 'keyboard', 'time', 'data']);
const SPEC_IDS = new Set(SPECIALTIES.map((s) => s.id));

/** Package names imported by the source files of a folder (non-relative, react excluded). */
function importedPackages(dir: string): Set<string> {
  const out = new Set<string>();
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.(ts|tsx)$/.test(e.name) || e.name === 'meta.ts') continue;
      const src = fs.readFileSync(p, 'utf8');
      for (const m of src.matchAll(/(?:^|\n)\s*import\s+(?!type\b)[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        const spec = m[1] ?? m[2];
        if (!spec || spec.startsWith('.') || spec.startsWith('/')) continue;
        const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
        if (['react', 'react-dom'].includes(name)) continue;
        out.add(name);
      }
    }
  };
  walk(dir);
  return out;
}

/** Packages imported transitively through the shared kit folders the recipe uses. */
const KIT_DEPS: Record<string, string[]> = { three: ['three', '@react-three/fiber'] };

describe('catalogue', () => {
  it('has at least 40 effect recipes with unique kebab-case ids', () => {
    const ids = catalog.effects.map((e) => e.id);
    expect(ids.length).toBeGreaterThanOrEqual(40);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
  it('covers every effect category', () => {
    const cats = new Set(catalog.effects.map((e) => e.category));
    for (const c of EFFECT_CATEGORIES) expect(cats.has(c), `category ${c}`).toBe(true);
  });
  it('is up to date with the source folders', () => {
    const folders = fs.readdirSync(path.join(LIB, 'src/effects')).filter((d) => fs.statSync(path.join(LIB, 'src/effects', d)).isDirectory());
    expect(folders.sort()).toEqual(catalog.effects.map((e) => e.id).sort());
  });
});

describe.each(catalog.effects.map((e) => [e.id, e] as const))('effect %s', (id, e) => {
  const dir = path.join(LIB, 'src/effects', id);
  it('metadata is complete and valid', () => {
    expect(e.name.length).toBeGreaterThan(2);
    expect(e.description.length).toBeGreaterThan(40);
    expect(EFFECT_CATEGORIES).toContain(e.category);
    expect(e.specialties.length).toBeGreaterThan(0);
    for (const s of e.specialties) expect(SPEC_IDS.has(s), `specialty ${s}`).toBe(true);
    for (const t of e.technology) expect(TECH.has(t), `technology ${t}`).toBe(true);
    for (const i of e.interaction) expect(INTERACTION.has(i), `interaction ${i}`).toBe(true);
    expect([1, 2, 3]).toContain(e.complexity);
    expect(['subtle', 'moderate', 'bold']).toContain(e.intensity);
    expect(e.applications.length).toBeGreaterThan(0);
    expect(e.accessibility.length).toBeGreaterThan(0);
    expect(e.performance.length).toBeGreaterThan(0);
    expect(e.reducedMotion.length).toBeGreaterThan(15);
  });
  it('params have valid defaults', () => {
    expect(e.params.length).toBeGreaterThan(0);
    const keys = new Set<string>();
    for (const p of e.params) {
      expect(keys.has(p.key), `duplicate param ${p.key}`).toBe(false);
      keys.add(p.key);
      if (p.type === 'number') { expect(p.default).toBeGreaterThanOrEqual(p.min); expect(p.default).toBeLessThanOrEqual(p.max); expect(p.min).toBeLessThan(p.max); }
      if (p.type === 'select') expect(p.options).toContain(p.default);
      if (p.type === 'color') expect(p.default).toMatch(/^#[0-9a-f]{6}$/i);
      if (p.type === 'boolean') expect(typeof p.default).toBe('boolean');
    }
  });
  it('declares exactly the packages it imports', () => {
    const imported = importedPackages(dir);
    const src = fs.readdirSync(dir).filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
    if (/from ['"]\.\.\/\.\.\/three['"]/.test(src)) for (const k of KIT_DEPS.three) imported.add(k);
    const declared = new Set(e.dependencies.map((d: { name: string }) => d.name));
    for (const name of imported) expect(declared.has(name), `imports ${name} but does not declare it`).toBe(true);
    for (const name of declared) expect(imported.has(name), `declares ${name} but does not import it`).toBe(true);
  });
  it('implements reduced motion', () => {
    const src = fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
    expect(/useStudioMotion|useReducedMotion|prefers-reduced-motion/.test(src)).toBe(true);
  });
  it('stays portable: no Tailwind utilities and no imports outside motion/three/types', () => {
    const tsx = fs.readFileSync(path.join(dir, 'index.tsx'), 'utf8');
    for (const m of tsx.matchAll(/from\s+['"](\.\.\/[^'"]+)['"]/g)) expect(m[1], 'shared import').toMatch(/^\.\.\/\.\.\/(motion|three|types)(\/|$)/);
    expect(tsx.startsWith("'use client'") || tsx.startsWith('"use client"'), 'client component').toBe(true);
  });
});

describe.each(catalog.demos.map((d) => [`${d.specialty}/${d.id}`, d] as const))('demo %s', (_key, d) => {
  it('metadata is complete, uses existing recipes, labels data', () => {
    expect(SPEC_IDS.has(d.specialty)).toBe(true);
    expect(d.summary.length).toBeGreaterThan(20);
    expect(d.highlights.length).toBeGreaterThan(0);
    expect(d.accessibility.length).toBeGreaterThan(0);
    expect(d.performance.length).toBeGreaterThan(0);
    expect(d.reducedMotion.length).toBeGreaterThan(10);
    const ids = new Set(catalog.effects.map((e) => e.id));
    for (const u of [...d.uses, ...(d.adapts ?? [])]) expect(ids.has(u), `references unknown recipe ${u}`).toBe(true);
    // Honesty: every id in `uses` must really be imported by the demo's source.
    const dir = path.join(LIB, 'src/demos', d.specialty, d.id);
    const src = (function read(p: string): string {
      return fs.readdirSync(p, { withFileTypes: true }).map((e) => (e.isDirectory() ? read(path.join(p, e.name)) : /\.(ts|tsx)$/.test(e.name) ? fs.readFileSync(path.join(p, e.name), 'utf8') : '')).join('\n');
    })(dir);
    for (const u of d.uses) expect(src, `"${u}" is listed in uses but never imported — move it to adapts`).toMatch(new RegExp(`from\\s+['"](?:\\.\\./)+effects/${u}(?:/index)?['"]`));
    if (d.specialty === 'data') expect(d.dataNote, 'data demos state that data is simulated').toBeTruthy();
  });
});
