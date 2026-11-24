#!/usr/bin/env node
// @ts-check
/**
 * Scans the Component & Effect Library and generates:
 *   plugins/maquettekit/library/src/registry.generated.ts   typed registry (eager meta, lazy components)
 *   plugins/maquettekit/library/catalog.json                machine-readable catalog for tools + skills
 *   plugins/maquettekit/library/CATALOG.md                  human/agent-readable index
 *   apps/gallery/public/sources/<kind>/<id>.json        source files for the gallery code viewer
 * Usage: node scripts/build-catalog.mjs [--check] [--strict]
 *   --check   exit 1 if generated files are stale (implies --strict)
 *   --strict  incomplete folders (missing meta.ts/index.tsx, meta that fails to load, unknown `uses`, a relative
 *             import in a .ts/.tsx file that does not resolve) are errors. Without it they are skipped with a
 *             warning, so work in progress in one folder does not block the rest (a registered folder with a
 *             missing import would break compilation of every gallery route).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIB = path.join(ROOT, 'plugins/maquettekit/library');
const SRC = path.join(LIB, 'src');
const check = process.argv.includes('--check');
const strict = check || process.argv.includes('--strict');
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

/**
 * Relative module specifiers of a TS/TSX source: static `import … from`, `import type`, side-effect `import '…'`,
 * `export … from` and dynamic `import('…')`. Comments, string contents, template text and regex literals are masked
 * first, so code samples inside strings or comments are not mistaken for imports.
 */
function relativeImports(code) {
  const strs = [];
  let out = '';
  let i = 0;
  const n = code.length;
  const tpl = []; // brace depth at each open `${`
  let depth = 0;
  let prev = ''; // last significant code character (regex-vs-division heuristic)
  const scanTemplate = () => { // from just after a backtick or a closing `}` of `${…}`
    while (i < n) {
      if (code[i] === '\\') { i += 2; continue; }
      if (code[i] === '`') { i++; out += '`'; prev = '`'; return; }
      if (code[i] === '$' && code[i + 1] === '{') { i += 2; out += '${'; tpl.push(depth); depth++; prev = '{'; return; }
      if (code[i] === '\n') out += '\n';
      i++;
    }
  };
  while (i < n) {
    const c = code[i];
    const d = code[i + 1];
    if (c === '/' && d === '/') { const e = code.indexOf('\n', i); i = e < 0 ? n : e; continue; }
    if (c === '/' && d === '*') { const e = code.indexOf('*/', i + 2); out += code.slice(i, e < 0 ? n : e).replace(/[^\n]/g, '') + ' '; i = e < 0 ? n : e + 2; continue; }
    if (c === "'" || c === '"') {
      let j = i + 1;
      let s = '';
      while (j < n && code[j] !== c && code[j] !== '\n') { if (code[j] === '\\') { s += code[j + 1] ?? ''; j += 2; } else s += code[j++]; }
      strs.push(s);
      out += `${c}${strs.length - 1}${c}`;
      i = code[j] === c ? j + 1 : j;
      prev = c;
      continue;
    }
    if (c === '`') { i++; out += '`'; scanTemplate(); continue; }
    if (c === '/' && (prev === '' || '(,=:[!&|?{};+-*%~^'.includes(prev))) { // regex literal
      let j = i + 1;
      let cls = false;
      while (j < n && code[j] !== '\n' && (cls || code[j] !== '/')) { if (code[j] === '\\') j++; else if (code[j] === '[') cls = true; else if (code[j] === ']') cls = false; j++; }
      i = j + 1;
      out += ' ';
      prev = ')';
      continue;
    }
    if (c === '{') depth++;
    if (c === '}') {
      depth--;
      if (tpl.length && depth === tpl[tpl.length - 1]) { tpl.pop(); i++; out += '}'; scanTemplate(); continue; }
    }
    out += c;
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  const specs = [];
  const patterns = [
    /(?:^|[;\n])\s*import\s*(?:type\s+)?(?:(?:[\w$]+\s*,?\s*)?(?:\{[^{}]*\}|\*\s*as\s+[\w$]+)?\s*from\s*)?(['"])(\d+)\1/g,
    /(?:^|[;\n])\s*export\s+(?:type\s+)?(?:\{[^{}]*\}|\*(?:\s*as\s+[\w$]+)?)\s*from\s*(['"])(\d+)\1/g,
    /(?<![\w$.])import\s*\(\s*(['"])(\d+)\1\s*[,)]/g,
  ];
  for (const re of patterns) for (const m of out.matchAll(re)) specs.push(strs[Number(m[2])]);
  return specs.filter((s) => s.startsWith('./') || s.startsWith('../'));
}

const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
/** Exact file, then + .ts/.tsx/.js/.mjs, then /index.ts(x); `.css` must exist exactly; './a.js' may name a.ts(x). */
function resolvesImport(fromFile, spec) {
  const target = path.resolve(path.dirname(fromFile), spec.replace(/[?#].*$/, ''));
  if (target.endsWith('.css')) return isFile(target);
  if (isFile(target) || ['.ts', '.tsx', '.js', '.mjs'].some((x) => isFile(target + x))) return true;
  if (['index.ts', 'index.tsx'].some((x) => isFile(path.join(target, x)))) return true;
  const js = /\.(m?js|jsx)$/.exec(target);
  return !!js && ['.ts', '.tsx'].some((x) => isFile(target.slice(0, -js[0].length) + x));
}

/** "file → spec" for every relative import in the folder's .ts/.tsx files that does not resolve. */
function unresolvedImports(dir, files) {
  const out = [];
  for (const f of files) {
    if (!/\.tsx?$/.test(f.file)) continue;
    const abs = path.join(dir, f.file);
    for (const spec of new Set(relativeImports(f.code))) if (!resolvesImport(abs, spec)) out.push(`${f.file} → ${spec}`);
  }
  return out;
}

async function loadMeta(file) {
  const mod = await import(pathToFileURL(file).href + `?t=${Date.now()}`);
  if (!mod.meta) throw new Error(`${file} must export "meta"`);
  return mod.meta;
}

const errors = [];
const skipped = [];
/** Problems caused by work in progress: errors in strict mode, warnings otherwise. */
const incomplete = (msg) => (strict ? errors : skipped).push(msg);
const effects = [];
const effectsDir = path.join(SRC, 'effects');
for (const id of fs.existsSync(effectsDir) ? fs.readdirSync(effectsDir).sort() : []) {
  const dir = path.join(effectsDir, id);
  if (!fs.statSync(dir).isDirectory()) continue;
  if (!fs.existsSync(path.join(dir, 'meta.ts')) || !fs.existsSync(path.join(dir, 'index.tsx'))) { incomplete(`effects/${id}: needs meta.ts and index.tsx`); continue; }
  const files = listFiles(dir);
  const missing = unresolvedImports(dir, files);
  if (missing.length) { incomplete(`effects/${id}: unresolved import(s): ${missing.join(', ')}`); continue; }
  try {
    const meta = await loadMeta(path.join(dir, 'meta.ts'));
    if (meta.id !== id) errors.push(`effects/${id}: meta.id "${meta.id}" must equal folder name`);
    effects.push({ id, meta, files });
  } catch (e) { incomplete(`effects/${id}: ${e.message}`); }
}

const demos = [];
const demosDir = path.join(SRC, 'demos');
for (const sp of fs.existsSync(demosDir) ? fs.readdirSync(demosDir).sort() : []) {
  const spDir = path.join(demosDir, sp);
  if (!fs.statSync(spDir).isDirectory()) continue;
  for (const id of fs.readdirSync(spDir).sort()) {
    const dir = path.join(spDir, id);
    if (!fs.statSync(dir).isDirectory()) continue;
    if (!fs.existsSync(path.join(dir, 'meta.ts')) || !fs.existsSync(path.join(dir, 'index.tsx'))) { incomplete(`demos/${sp}/${id}: needs meta.ts and index.tsx`); continue; }
    const files = listFiles(dir);
    const missing = unresolvedImports(dir, files);
    if (missing.length) { incomplete(`demos/${sp}/${id}: unresolved import(s): ${missing.join(', ')}`); continue; }
    try {
      const meta = await loadMeta(path.join(dir, 'meta.ts'));
      if (meta.id !== id) errors.push(`demos/${sp}/${id}: meta.id "${meta.id}" must equal folder name`);
      if (meta.specialty !== sp) errors.push(`demos/${sp}/${id}: meta.specialty "${meta.specialty}" must equal "${sp}"`);
      demos.push({ id, specialty: sp, meta, files });
    } catch (e) { incomplete(`demos/${sp}/${id}: ${e.message}`); }
  }
}

const dupes = effects.map((e) => e.id).filter((id, i, a) => a.indexOf(id) !== i);
if (dupes.length) errors.push(`duplicate effect ids: ${dupes.join(', ')}`);
const effectIds = new Set(effects.map((e) => e.id));
for (const d of demos) for (const u of d.meta.uses ?? []) if (!effectIds.has(u)) incomplete(`demos/${d.specialty}/${d.id}: uses unknown effect "${u}"`);
if (skipped.length) console.error(`Catalog warnings (skipped; run with --strict to fail):\n  ${skipped.join('\n  ')}`);
if (errors.length) { console.error('Catalog errors:\n  ' + errors.join('\n  ')); process.exit(1); }

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
  generator: 'maquettekit build-catalog', version,
  effects: effects.map((e) => ({ ...e.meta, path: `library/src/effects/${e.id}`, files: e.files.map((f) => f.file) })),
  demos: demos.map((d) => ({ ...d.meta, path: `library/src/demos/${d.specialty}/${d.id}`, files: d.files.map((f) => f.file) })),
};

const byCat = new Map();
for (const e of effects) (byCat.get(e.meta.category) ?? byCat.set(e.meta.category, []).get(e.meta.category)).push(e);
const md = [
  `# Maquettekit Component & Effect Catalog (v${version})`,
  '',
  `Generated by \`scripts/build-catalog.mjs\`. ${effects.length} effect recipes, ${demos.length} demos.`,
  'Source for each recipe: `library/src/effects/<id>/` (read `index.tsx` + `meta.ts`). Search: `maquettekit catalog search <query>`.',
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
