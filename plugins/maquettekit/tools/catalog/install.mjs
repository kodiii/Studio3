// @ts-check
/**
 * `maquettekit catalog install <id…>` — copy recipes or demos into a project, with everything they import.
 *
 * The library's relative layout is mirrored under one target folder (default `src/maquettekit`): an effect lands in
 * `<into>/effects/<id>/`, the motion engine in `<into>/motion/`, shared types in `<into>/types.ts`, so every relative
 * import in the copied files keeps resolving without rewriting. Only files reachable from the requested items are
 * copied (the transitive closure of their relative imports, plus CSS imports and url() files and the CSS-module declarations).
 *
 * Nothing is installed from npm: bare imports are reported with the versions the library is tested against, as one
 * command to run. Existing files are never overwritten unless identical (skipped) or --force is given. A manifest
 * (`maquettekit.install.json`) records what was installed, from which version, with file hashes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { builtinModules } from 'node:module';
import { PLUGIN_ROOT } from '../lib/resolve.mjs';
import { UserError } from '../lib/log.mjs';

const LIB_SRC = () => path.join(PLUGIN_ROOT, 'library', 'src');
const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];
const sha = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);

/** Import specifiers in a TS/JS/CSS source. @param {string} src @param {string} file */
export function importsOf(src, file) {
  const out = new Set();
  if (/\.(css|scss)$/.test(file)) {
    for (const m of src.matchAll(/@import\s+(?:url\()?\s*['"]?([^'")\s;]+)/g)) out.add(m[1]);
    for (const m of src.matchAll(/url\(\s*['"]?(\.{1,2}\/[^'")\s]+)/g)) out.add(m[1]);
    return [...out];
  }
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
  // statement-level forms only: `import … from 'x'`, `export … from 'x'`, `import 'x'`, `import('x')`
  for (const m of code.matchAll(/^\s*(?:import|export)\b[^;'"]*?\bfrom\s*['"]([^'"\n]+)['"]/gm)) out.add(m[1]);
  for (const m of code.matchAll(/^\s*import\s*['"]([^'"\n]+)['"]/gm)) out.add(m[1]);
  for (const m of code.matchAll(/\bimport\(\s*['"]([^'"\n]+)['"]\s*\)/g)) out.add(m[1]);
  return [...out].filter((x) => /^[@\w./:-][^\s]*$/.test(x));
}

/** Resolve a relative specifier from a file to an existing file path, or null. */
function resolveRelative(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [base, ...EXTS.map((e) => base + e), ...EXTS.map((e) => path.join(base, `index${e}`))];
  for (const c of candidates) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  return null;
}

/** npm package name for a bare specifier (scoped and subpath aware). */
export function packageOf(spec) {
  if (spec.startsWith('node:') || builtinModules.includes(spec.split('/')[0])) return null;
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/** Find a catalogue item (effect or demo) by id. */
function findItem(cat, id) {
  const effect = cat.effects.find((e) => e.id === id);
  if (effect) return { kind: 'effect', item: effect };
  const demo = cat.demos.find((d) => d.id === id);
  if (demo) return { kind: 'demo', item: demo };
  return null;
}

/** Nearest package.json at or above dir. */
function nearestPackageJson(dir) {
  for (let d = path.resolve(dir); ; d = path.dirname(d)) {
    const p = path.join(d, 'package.json');
    if (fs.existsSync(p)) { try { return { file: p, json: JSON.parse(fs.readFileSync(p, 'utf8')) }; } catch { return null; } }
    if (path.dirname(d) === d) return null;
  }
}

/** Name of the component a recipe's index exports (for the usage hint). */
function exportedComponent(file) {
  try {
    const src = fs.readFileSync(file, 'utf8');
    return /export\s+default\s+function\s+([A-Z]\w*)/.exec(src)?.[1] ?? /export\s+function\s+([A-Z]\w*)/.exec(src)?.[1] ?? /export\s+const\s+([A-Z]\w*)\s*=/.exec(src)?.[1] ?? null;
  } catch { return null; }
}

/**
 * Plan (and with apply, perform) an install.
 * @param {any} cat catalogue (from loadCatalog)
 * @param {string[]} ids
 * @param {{ into?: string, project?: string, force?: boolean, apply?: boolean, version?: string }} opts
 */
export function installItems(cat, ids, opts = {}) {
  if (!ids.length) throw new UserError('catalog install needs at least one id. Find ids with: maquettekit catalog search <words>');
  const libSrc = LIB_SRC();
  const projectDir = path.resolve(opts.project ?? '.');
  const into = path.resolve(projectDir, opts.into ?? (fs.existsSync(path.join(projectDir, 'src')) ? 'src/maquettekit' : 'maquettekit'));
  const items = [];
  const queue = [];
  for (const id of ids) {
    const found = findItem(cat, id);
    if (!found) throw new UserError(`No effect or demo with id "${id}". Try: maquettekit catalog search ${id}`);
    const dir = path.join(PLUGIN_ROOT, found.item.path);
    items.push({ id, kind: found.kind, name: found.item.name, dir });
    for (const f of found.item.files ?? fs.readdirSync(dir)) queue.push(path.join(dir, f));
  }
  // transitive closure of relative imports inside library/src
  const files = new Set(); const bare = new Map(); const unresolved = []; const assetUrls = new Set();
  while (queue.length) {
    const f = /** @type {string} */ (queue.pop());
    if (files.has(f) || !fs.existsSync(f)) continue;
    if (!path.resolve(f).startsWith(libSrc + path.sep)) { unresolved.push({ from: null, spec: f, reason: 'outside the library' }); continue; }
    files.add(f);
    if (!/\.(tsx?|jsx?|mjs|css|scss)$/.test(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/['"](\/(?:models|textures|images|fonts|media)\/[^'"]+)['"]/g)) assetUrls.add(m[1]);
    for (const spec of importsOf(src, f)) {
      if (spec.startsWith('.')) {
        const r = resolveRelative(f, spec);
        if (r) queue.push(r); else unresolved.push({ from: path.relative(libSrc, f), spec, reason: 'not found' });
      } else if (!spec.startsWith('/') && !/^(https?:|data:)/.test(spec)) {
        const pkg = packageOf(spec);
        if (pkg) { if (!bare.has(pkg)) bare.set(pkg, new Set()); bare.get(pkg).add(path.relative(libSrc, f)); }
      }
    }
  }
  if ([...files].some((f) => f.endsWith('.module.css')) && fs.existsSync(path.join(libSrc, 'global.d.ts'))) files.add(path.join(libSrc, 'global.d.ts'));

  // npm dependencies the project still needs
  const libPkg = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, 'library', 'package.json'), 'utf8'));
  const known = { ...(libPkg.devDependencies ?? {}), ...(libPkg.peerDependencies ?? {}), ...(libPkg.dependencies ?? {}) };
  const proj = nearestPackageJson(projectDir);
  const have = proj ? { ...(proj.json.dependencies ?? {}), ...(proj.json.devDependencies ?? {}), ...(proj.json.peerDependencies ?? {}) } : {};
  /** @type {{ name: string, version: string|null, usedBy: string[], present: boolean, dev: boolean }[]} */
  const deps = [...bare.keys()].sort().map((name) => ({ name, version: known[name] ?? null, usedBy: [...bare.get(name)].sort().slice(0, 4), present: name in have, dev: false }));
  const typesFor = (n) => (n === 'three' || n === 'd3') ? `@types/${n}` : null;
  for (const d of [...deps]) { const t = typesFor(d.name); if (t && !deps.some((x) => x.name === t)) deps.push({ name: t, version: known[t] ?? null, usedBy: d.usedBy, present: t in have, dev: true }); }
  const missing = deps.filter((d) => !d.present);
  const installCommand = missing.length ? [
    missing.filter((d) => !d.dev).length ? `npm install ${missing.filter((d) => !d.dev).map((d) => (d.version ? `${d.name}@${d.version}` : d.name)).join(' ')}` : null,
    missing.filter((d) => d.dev).length ? `npm install -D ${missing.filter((d) => d.dev).map((d) => (d.version ? `${d.name}@${d.version}` : d.name)).join(' ')}` : null,
  ].filter(Boolean).join(' && ') : null;

  // copy plan
  const plan = [...files].sort().map((src) => {
    const rel = path.relative(libSrc, src);
    const dest = path.join(into, rel);
    const buf = fs.readFileSync(src);
    let action = 'create';
    if (fs.existsSync(dest)) action = sha(fs.readFileSync(dest)) === sha(buf) ? 'identical' : (opts.force ? 'overwrite' : 'conflict');
    return { rel: rel.split(path.sep).join('/'), src, dest, action, hash: sha(buf) };
  });
  const conflicts = plan.filter((p) => p.action === 'conflict');
  const usage = items.map((it) => {
    const comp = exportedComponent(path.join(it.dir, 'index.tsx'));
    const modPath = path.relative(projectDir, path.join(into, path.relative(libSrc, it.dir))).split(path.sep).join('/');
    return { id: it.id, kind: it.kind, component: comp, importPath: `./${modPath}`, snippet: comp ? `import { ${comp} } from './${modPath}';` : `import * as ${it.id.replace(/-(\w)/g, (_, c) => c.toUpperCase())} from './${modPath}';` };
  });
  const result = {
    tool: 'maquettekit-catalog-install', version: opts.version ?? libPkg.version, into, project: projectDir, applied: false,
    items: items.map(({ id, kind, name }) => ({ id, kind, name })), files: plan.map(({ rel, action }) => ({ path: rel, action })),
    counts: { create: plan.filter((p) => p.action === 'create').length, overwrite: plan.filter((p) => p.action === 'overwrite').length, identical: plan.filter((p) => p.action === 'identical').length, conflict: conflicts.length },
    dependencies: deps, installCommand, assetUrls: [...assetUrls].sort(), unresolved, usage,
    notes: [
      'Copied files are TypeScript/TSX with CSS modules: the project needs a bundler that handles them (Next.js, Vite, Remix, Astro with React).',
      ...(assetUrls.size ? [`These items load files from absolute URLs (${[...assetUrls].slice(0, 3).join(', ')}${assetUrls.size > 3 ? ', …' : ''}): serve your own files at those paths (e.g. from public/), produce them with "maquettekit assets", or change the URLs.`] : []),
    ],
  };
  if (!opts.apply) return result;
  if (conflicts.length) throw new UserError(`${conflicts.length} file(s) already exist with different content (e.g. ${conflicts[0].rel}). Nothing was written. Re-run with --force to overwrite, or install into another folder with --into.`, 1);
  for (const p of plan) {
    if (p.action === 'identical') continue;
    fs.mkdirSync(path.dirname(p.dest), { recursive: true });
    fs.copyFileSync(p.src, p.dest);
  }
  const manifestFile = path.join(into, 'maquettekit.install.json');
  let manifest = { tool: 'maquettekit', note: 'Written by "maquettekit catalog install". Lists installed items and the file hashes they were installed with.', items: {}, files: {} };
  try { manifest = { ...manifest, ...JSON.parse(fs.readFileSync(manifestFile, 'utf8')) }; } catch { /* first install */ }
  for (const it of items) manifest.items[it.id] = { kind: it.kind, version: result.version, installedAt: new Date().toISOString() };
  for (const p of plan) manifest.files[p.rel] = p.hash;
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  return { ...result, applied: true, manifest: manifestFile };
}
