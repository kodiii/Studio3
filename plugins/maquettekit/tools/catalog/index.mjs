// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from '../lib/args.mjs';
import { PLUGIN_ROOT } from '../lib/resolve.mjs';
import { UserError } from '../lib/log.mjs';

export const help = `maquettekit catalog — search the Component & Effect Library

  catalog list [--kind effects|demos] [--json]
  catalog search <query…> [--category <c>] [--tech <t>] [--specialty <s>] [--interaction <i>]
                          [--intensity subtle|moderate|bold] [--max-complexity 1|2|3] [--no-deps] [--limit 10] [--json]
  catalog show <id> [--source] [--json]     print metadata, file paths and (with --source) the recipe source
  catalog install <id…> [--into src/maquettekit] [--project .] [--dry-run] [--force] [--json]
      copy recipes or demos into a project with everything they import (motion engine, three-kit, types,
      other recipes), mirroring the library layout so relative imports keep working. Prints the npm packages
      still missing (with tested versions) as one command — nothing is installed from npm. Existing files are
      never overwritten unless --force; identical files are skipped. Records maquettekit.install.json.

  catalog export <id…> --format web-component [--out maquettekit-elements] [--json]
      for projects without React (Vue, Svelte, Astro, plain HTML): bundle effect recipes with React into one ES
      module each that registers <mk-<id>> (attributes = params), plus its CSS and a demo page. Every recipe has
      client behaviour, so there is no static HTML/CSS export. Needs vite, react, react-dom (setup --only export).

Recipes live in <plugin>/library/src/effects/<id>/ and demos in <plugin>/library/src/demos/<specialty>/<id>/.`;

export function loadCatalog() {
  const file = path.join(PLUGIN_ROOT, 'library', 'catalog.json');
  if (!fs.existsSync(file)) throw new UserError(`Catalog not found at ${file}. In a repo checkout run: node scripts/build-catalog.mjs`, 4);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Rank effects against free-text + facet filters. Pure function (unit-tested). */
export function searchEffects(effects, query, f = {}) {
  const terms = String(query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const has = (arr, v) => !v || arr.map(String).includes(String(v));
  const out = [];
  for (const e of effects) {
    if (f.category && e.category !== f.category) continue;
    if (!has(e.technology, f.tech) || !has(e.specialties, f.specialty) || !has(e.interaction, f.interaction)) continue;
    if (f.intensity && e.intensity !== f.intensity) continue;
    if (f.maxComplexity && e.complexity > Number(f.maxComplexity)) continue;
    if (f.noDeps && e.dependencies.length) continue;
    let score = terms.length ? 0 : 1;
    for (const t of terms) {
      if (e.id.includes(t)) score += 6;
      if (e.name.toLowerCase().includes(t)) score += 5;
      if (e.category.includes(t)) score += 4;
      if (e.technology.some((x) => x.includes(t))) score += 3;
      if (e.applications.some((a) => a.toLowerCase().includes(t))) score += 3;
      if (e.description.toLowerCase().includes(t)) score += 2;
      if (e.specialties.some((x) => x === t)) score += 2;
    }
    if (score > 0) out.push({ score, effect: e });
  }
  return out.sort((a, b) => b.score - a.score || a.effect.complexity - b.effect.complexity || a.effect.id.localeCompare(b.effect.id));
}

const row = (e) => `${e.id.padEnd(30)} ${e.category.padEnd(14)} ${e.technology.join('+').padEnd(22)} c${e.complexity} ${e.intensity.padEnd(8)} ${e.name}`;

export async function main(argv) {
  const args = parseArgs(argv, { boolean: ['json', 'source', 'deps', 'force', 'dry-run'] });
  const [sub = 'list', ...rest] = args._;
  const cat = loadCatalog();
  if (sub === 'list') {
    const kind = args.kind ?? 'effects';
    if (args.json) { console.log(JSON.stringify(cat[kind], null, 2)); return 0; }
    if (kind === 'demos') for (const d of cat.demos) console.log(`${d.specialty.padEnd(10)} ${d.id.padEnd(26)} ${d.name}`);
    else for (const e of cat.effects) console.log(row(e));
    return 0;
  }
  if (sub === 'search') {
    const hits = searchEffects(cat.effects, rest.join(' '), {
      category: args.category, tech: args.tech, specialty: args.specialty, interaction: args.interaction,
      intensity: args.intensity, maxComplexity: args['max-complexity'], noDeps: args.deps === false,
    }).slice(0, Number(args.limit ?? 10));
    if (args.json) console.log(JSON.stringify(hits.map((h) => ({ score: h.score, ...h.effect })), null, 2));
    else if (!hits.length) console.log('No matching recipes.');
    else for (const h of hits) console.log(row(h.effect));
    return 0;
  }
  if (sub === 'show') {
    const id = rest[0];
    const item = cat.effects.find((e) => e.id === id) ?? cat.demos.find((d) => d.id === id);
    if (!item) throw new UserError(`No effect or demo with id "${id}". Try: maquettekit catalog search ${id ?? ''}`);
    const dir = path.join(PLUGIN_ROOT, item.path);
    const sources = args.source ? Object.fromEntries(item.files.map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')])) : undefined;
    if (args.json) { console.log(JSON.stringify({ ...item, directory: dir, sources }, null, 2)); return 0; }
    console.log(`${item.name}  (${item.id})\n${item.description ?? item.summary}\n\nDirectory: ${dir}\nFiles: ${item.files.join(', ')}`);
    if (item.dependencies) console.log(`Dependencies: ${item.dependencies.map((d) => `${d.name}@${d.version}`).join(', ') || 'none'}`);
    if (item.params) console.log(`Params: ${item.params.map((p) => `${p.key} (${p.type}, default ${JSON.stringify(p.default)})`).join('; ')}`);
    if (item.reducedMotion) console.log(`Reduced motion: ${item.reducedMotion}`);
    for (const k of ['accessibility', 'performance']) if (item[k]) console.log(`${k[0].toUpperCase() + k.slice(1)}:\n${item[k].map((s) => `  - ${s}`).join('\n')}`);
    if (sources) for (const [f, code] of Object.entries(sources)) console.log(`\n───── ${f} ─────\n${code}`);
    return 0;
  }
  if (sub === 'install') {
    const { installItems } = await import('./install.mjs');
    const r = installItems(cat, rest, { into: typeof args.into === 'string' ? args.into : undefined, project: typeof args.project === 'string' ? args.project : undefined, force: !!args.force, apply: !args['dry-run'] });
    if (args.json) { console.log(JSON.stringify(r, null, 2)); return 0; }
    const verb = r.applied ? 'Installed' : 'Would install';
    console.log(`${verb} ${r.items.map((i) => i.id).join(', ')} into ${r.into}`);
    console.log(`  files: ${r.counts.create} new, ${r.counts.overwrite} overwritten, ${r.counts.identical} unchanged${r.counts.conflict ? `, ${r.counts.conflict} CONFLICT (use --force)` : ''}`);
    for (const f of r.files.filter((x) => x.action !== 'identical')) console.log(`    ${f.action.padEnd(9)} ${f.path}`);
    if (r.installCommand) console.log(`  npm packages to add:\n    ${r.installCommand}`);
    else console.log('  npm packages: all present');
    for (const u of r.usage) console.log(`  use: ${u.snippet}`);
    for (const n of r.notes) console.log(`  note: ${n}`);
    if (r.unresolved.length) console.log(`  unresolved imports: ${r.unresolved.map((u) => `${u.spec} (${u.from})`).join(', ')}`);
    return 0;
  }
  if (sub === 'export') {
    if ((args.format ?? 'web-component') !== 'web-component') throw new UserError('--format must be web-component (recipes need their behaviour; there is no static export)');
    const { exportWebComponents } = await import('./export.mjs');
    const r = await exportWebComponents(cat, rest, { out: typeof args.out === 'string' ? args.out : undefined });
    if (args.json) { console.log(JSON.stringify(r, null, 2)); return 0; }
    console.log(`Exported ${r.elements.length} element(s) to ${r.out}`);
    for (const e of r.elements) console.log(`  <${e.element}${e.attributes.map((a) => ` ${a.name}="${a.default}"`).join('')}>  ${e.jsKb} KB js${e.css ? ' + css' : ''} · demo: ${e.demo}`);
    for (const n of r.notes) console.log(`  note: ${n}`);
    return 0;
  }
  throw new UserError(`Unknown catalog subcommand "${sub}".\n\n${help}`);
}
