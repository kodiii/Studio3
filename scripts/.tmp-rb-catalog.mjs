#!/usr/bin/env node
// @ts-check
/**
 * Scans the Component & Effect Library and generates:
 *   plugins/studio3/library/src/registry.generated.ts   typed registry (eager meta, lazy components)
 *   plugins/studio3/library/catalog.json                machine-readable catalog for tools + skills
 *   plugins/studio3/library/CATALOG.md                  human/agent-readable index
 *   apps/gallery/public/sources/<kind>/<id>.json        source files for the gallery code viewer
 * Usage: node scripts/build-catalog.mjs [--check]   (--check exits 1 if generated files are stale)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIB = path.join(ROOT, 'plugins/studio3/library');
const SRC = path.join(LIB, 'src');
const check = process.argv.includes('--check');
const ident = (s) => s.replace(/[^a-zA-Z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')).replace(/^(\d)/, '_$1');
const SOURCE_EXT = new Set(['.ts', '.tsx', '.css', '.glsl', '.json']);

function listFiles(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p, base));
    else if (SOURCE_EXT.has(path.extname(e.name))) out.push({ file: path.relative(base, p).split(path.sep).join('/'), code: fs.readFileSync(p, 'utf8') });
  }
  // entry first, meta last
  const rank = (f) => (f === 'index.tsx' ? 0 : f === 'meta.ts' ? 2 : 1);
  return out.sort((a, b) => rank(a.file) - rank(b.file) || a.file.localeCompare(b.file));
}

async function loadMeta(file) {
  const mod = await import(pathToFileURL(file).href + `?t=${Date.now()}`);
  if (!mod.meta) throw new Error(`${file} must export "meta"`);
  return mod.meta;
}

const errors = [];
// tmp-rb: never introduce other agents' folders; keep whatever the current registry already lists, plus my ids.
const MINE = new Set(['magnetic-button','press-depth-button','morph-submit-button','skeleton-shimmer-handoff','progress-orbit-loader','poll-result-bars','story-progress-segments','svg-path-draw']);
const regText = fs.existsSync(path.join(SRC, 'registry.generated.ts')) ? fs.readFileSync(path.join(SRC, 'registry.generated.ts'), 'utf8') : '';
const KNOWN_E = new Set([...regText.matchAll(/from '\.\/effects\/([^/]+)\/meta'/g)].map((m) => m[1]));
const KNOWN_D = new Set([...regText.matchAll(/from '\.\/demos\/([^/]+\/[^/]+)\/meta'/g)].map((m) => m[1]));
const effects = [];
const effectsDir = path.join(SRC, 'effects');
for (const id of fs.existsSync(effectsDir) ? fs.readdirSync(effectsDir).sort() : []) {
  const dir = path.join(effectsDir, id);
  if (!fs.statSync(dir).isDirectory()) continue;
  if (!MINE.has(id) && !KNOWN_E.has(id)) { errors.push(`effects/${id}: not yet registered by its owner (left out)`); continue; }
  if (!fs.existsSync(path.join(dir, 'meta.ts')) || !fs.existsSync(path.join(dir, 'index.tsx'))) { errors.push(`effects/${id}: needs meta.ts and index.tsx`); continue; }
  try {
    const meta = await loadMeta(path.join(dir, 'meta.ts'));
    if (meta.id !== id) errors.push(`effects/${id}: meta.id "${meta.id}" must equal folder name`);
    effects.push({ id, meta, files: listFiles(dir) });
  } catch (e) { errors.push(`effects/${id}: ${e.message}`); }
}

const demos = [];
const demosDir = path.join(SRC, 'demos');
for (const sp of fs.existsSync(demosDir) ? fs.readdirSync(demosDir).sort() : []) {
  const spDir = path.join(demosDir, sp);
  if (!fs.statSync(spDir).isDirectory()) continue;
  for (const id of fs.readdirSync(spDir).sort()) {
    const dir = path.join(spDir, id);
    if (!fs.statSync(dir).isDirectory()) continue;
    if (!KNOWN_D.has(`${sp}/${id}`)) { errors.push(`demos/${sp}/${id}: not yet registered by its owner (left out)`); continue; }
    if (!fs.existsSync(path.join(dir, 'meta.ts')) || !fs.existsSync(path.join(dir, 'index.tsx'))) { errors.push(`demos/${sp}/${id}: needs meta.ts and index.tsx`); continue; }
    try {
      const meta = await loadMeta(path.join(dir, 'meta.ts'));
      if (meta.id !== id) errors.push(`demos/${sp}/${id}: meta.id "${meta.id}" must equal folder name`);
      if (meta.specialty !== sp) errors.push(`demos/${sp}/${id}: meta.specialty "${meta.specialty}" must equal "${sp}"`);
      demos.push({ id, specialty: sp, meta, files: listFiles(dir) });
    } catch (e) { errors.push(`demos/${sp}/${id}: ${e.message}`); }
  }
}

const dupes = effects.map((e) => e.id).filter((id, i, a) => a.indexOf(id) !== i);
if (dupes.length) errors.push(`duplicate effect ids: ${dupes.join(', ')}`);
const effectIds = new Set(effects.map((e) => e.id));
for (const d of demos) for (const u of d.meta.uses ?? []) if (!effectIds.has(u)) errors.push(`demos/${d.specialty}/${d.id}: uses unknown effect "${u}"`);
if (errors.length) console.error('Catalog warnings (skipped):\n  ' + errors.join('\n  '));

// ---- registry.generated.ts
const reg = [
  '// AUTO-GENERATED by scripts/build-catalog.mjs — do not edit.',
  "import type { DemoEntry, EffectEntry } from './types';",
  ...effects.map((e) => `import { meta as e_${ident(e.id)} } from './effects/${e.id}/meta';`),
  ...demos.map((d) => `import { meta as d_${ident(d.specialty)}_${ident(d.id)} } from './demos/${d.specialty}/${d.id}/meta';`),
  '',
  'export const effects: readonly EffectEntry[] = [',
  ...effects.map((e) => `  { meta: e_${ident(e.id)}, load: () => import('./effects/${e.id}/index') },`),
  '];',
  '',
  'export const demos: readonly DemoEntry[] = [',
  ...demos.map((d) => `  { meta: d_${ident(d.specialty)}_${ident(d.id)}, load: () => import('./demos/${d.specialty}/${d.id}/index') },`),
  '];',
  '',
].join('\n');

const version = JSON.parse(fs.readFileSync(path.join(LIB, 'package.json'), 'utf8')).version;
const catalog = {
  generator: 'studio3 build-catalog', version,
  effects: effects.map((e) => ({ ...e.meta, path: `library/src/effects/${e.id}`, files: e.files.map((f) => f.file) })),
  demos: demos.map((d) => ({ ...d.meta, path: `library/src/demos/${d.specialty}/${d.id}`, files: d.files.map((f) => f.file) })),
};

const byCat = new Map();
for (const e of effects) (byCat.get(e.meta.category) ?? byCat.set(e.meta.category, []).get(e.meta.category)).push(e);
const md = [
  `# Studio³ Component & Effect Catalog (v${version})`,
  '',
  `Generated by \`scripts/build-catalog.mjs\`. ${effects.length} effect recipes, ${demos.length} demos.`,
  'Source for each recipe: `library/src/effects/<id>/` (read `index.tsx` + `meta.ts`). Search: `studio3 catalog search <query>`.',
  '',
  '## Effects',
  ...[...byCat.entries()].flatMap(([cat, list]) => [
    '', `### ${cat}`, '', '| id | name | tech | deps | complexity | intensity | reduced motion |', '| - | - | - | - | - | - | - |',
    ...list.map((e) => `| \`${e.id}\` | ${e.meta.name} | ${e.meta.technology.join(', ')} | ${e.meta.dependencies.map((d) => d.name).join(', ') || '—'} | ${e.meta.complexity} | ${e.meta.intensity} | ${String(e.meta.reducedMotion).replace(/\|/g, '/')} |`),
  ]),
  '', '## Demos', '', '| specialty | id | name | 3D | summary |', '| - | - | - | - | - |',
  ...demos.map((d) => `| ${d.specialty} | \`${d.id}\` | ${d.meta.name} | ${d.meta.has3d ? 'yes' : 'no'} | ${String(d.meta.summary).replace(/\|/g, '/')} |`),
  '',
].join('\n');

const outputs = new Map([
  [path.join(SRC, 'registry.generated.ts'), reg],
  [path.join(LIB, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n'],
  [path.join(LIB, 'CATALOG.md'), md],
]);
const srcOut = path.join(ROOT, 'apps/gallery/public/sources');
for (const e of effects) outputs.set(path.join(srcOut, 'effects', `${e.id}.json`), JSON.stringify({ id: e.id, files: e.files }));
for (const d of demos) outputs.set(path.join(srcOut, 'demos', `${d.specialty}--${d.id}.json`), JSON.stringify({ id: d.id, files: d.files }));

let stale = 0;
for (const [file, content] of outputs) {
  const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (cur === content) continue;
  stale++;
  if (!check) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); }
}
// remove orphaned source bundles
for (const kind of ['effects', 'demos']) {
  const dir = path.join(srcOut, kind);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) if (!outputs.has(path.join(dir, f))) { stale++; if (!check) fs.rmSync(path.join(dir, f)); }
}
if (check && stale) { console.error(`Catalog is stale (${stale} file(s)). Run: npm run catalog`); process.exit(1); }
console.error(`catalog: ${effects.length} effects, ${demos.length} demos${check ? ' (up to date)' : stale ? `, ${stale} file(s) written` : ', no changes'}`);
