// @ts-check
/**
 * Design Intelligence Engine CLI — `studio3 design <command>`.
 * Zero runtime dependencies: works from an installed plugin without node_modules.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from '../lib/args.mjs';
import { log, UserError } from '../lib/log.mjs';
import { briefTemplate, briefFromFlags } from './brief.mjs';
import { generateDesign, regenerateDesign } from './generate.mjs';
import { validateDesign } from './validate.mjs';
import { explainDesign, SECTIONS } from './explain.mjs';
import { exportTokens, FORMATS } from './exports.mjs';
import { DIRECTIONS } from './directions.mjs';
import { resolveFont } from './fonts.mjs';
import { deepMerge } from './util.mjs';

export { generateDesign, regenerateDesign, applyOverrides } from './generate.mjs';
export { validateDesign } from './validate.mjs';
export { explainDesign } from './explain.mjs';
export { exportTokens, toCss, toTailwind, toTs, toDtcg } from './exports.mjs';
export { DIRECTIONS } from './directions.mjs';

export const help = `Studio³ Design Intelligence Engine — deterministic, context-aware design-system generator.

Usage: studio3 design <command> [options]

Commands:
  init [--out brief.json] [--force]
      Write an annotated brief template.

  generate [--brief <brief.json>] [--out studio3.design.json] [--css <file>] [--tailwind <file>]
           [--ts <file>] [--dtcg <file>] [--seed <n>] [--direction <id>] [--force | --merge] [--json]
      Generate the design decision file (+ optional token exports).
      Refuses to overwrite an existing file unless --force (replace) or --merge (keep "overrides").
      With --seed the output is byte-reproducible (no timestamp). Without a seed the brief hash seeds
      the generator and a generatedAt timestamp is recorded.
      Brief fields as flags (override --brief values):
        --category <text>        --audience <text>         --name <brand name>
        --personality a,b,c      --colors #hex,#hex        --fonts "Family A,Family B"
        --goals a,b              --devices desktop,mobile  --aesthetic <text>
        --complexity low|medium|high                       --a11y AA|AAA   --a11y-needs a,b
        --budget tight|balanced|generous  --low-end        --framework <name>  --styling <name>
        --libs a,b               --motion essential|expressive|immersive
        --3d [--3d-purpose <text>]                          --specialty product|cinematic|data|social|3d

  validate <studio3.design.json> [--json]
      Schema + semantic validation (contrast pairs, scale monotonicity, token references).
      Exit code 0 = valid, 1 = invalid.

  explain <studio3.design.json> [--section ${SECTIONS.join('|')}] [--out <file.md>]
      Markdown rationale for pasting into a design brief.

  tokens <studio3.design.json> --format ${FORMATS.join('|')} [--out <file>] [--color-format hex|oklch]
      Export tokens (json-dtcg = W3C Design Tokens Community Group format). Prints to stdout without --out.

  directions [--json]
      List the built-in art directions.

Overrides: add a top-level "overrides" object mirroring any section (e.g. {"color":{"light":{"roles":
{"primary":{"hex":"#0b5fff"}}}}}); it is deep-merged over generated values, reflected in every export,
re-validated, and preserved by "generate --merge".`;

const BOOLEANS = ['force', 'merge', 'json', '3d', 'low-end'];
const readJson = (file, what) => {
  if (!file || file === true) throw new UserError(`Missing ${what} path.`);
  const p = path.resolve(String(file));
  if (!fs.existsSync(p)) throw new UserError(`${what} not found: ${p}`);
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { throw new UserError(`${what} is not valid JSON (${p}): ${/** @type {Error} */ (e).message}`); }
};
const write = (file, content) => {
  const p = path.resolve(String(file));
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  return p;
};
const stripComments = (obj) => (obj && typeof obj === 'object' && !Array.isArray(obj) ? Object.fromEntries(Object.entries(obj).filter(([k]) => !k.startsWith('_') && k !== '$schema').map(([k, v]) => [k, stripComments(v)])) : obj);

function cmdInit(a) {
  const out = typeof a.out === 'string' ? a.out : 'brief.json';
  if (fs.existsSync(path.resolve(out)) && !a.force) throw new UserError(`${out} already exists. Use --force to overwrite.`);
  const p = write(out, `${JSON.stringify(briefTemplate(), null, 2)}\n`);
  log.ok(`Brief template written to ${p}`);
  log.info('  Next: edit it, then run  studio3 design generate --brief ' + out);
  return 0;
}

function cmdGenerate(a) {
  const fromFile = a.brief ? stripComments(readJson(a.brief, 'Brief')) : {};
  const flags = briefFromFlags(a);
  if (!a.brief && Object.keys(flags).length === 0) throw new UserError('Nothing to generate from. Pass --brief <file> or brief flags such as --category and --aesthetic (see "studio3 design --help").');
  const brief = deepMerge(fromFile, flags);
  const out = path.resolve(typeof a.out === 'string' ? a.out : 'studio3.design.json');
  if (a.force && a.merge) throw new UserError('Use either --force (replace everything) or --merge (keep overrides), not both.');
  const exists = fs.existsSync(out);
  if (exists && !a.force && !a.merge) {
    throw new UserError(`${out} already exists — refusing to overwrite a persisted design decision.\n  --merge   regenerate and keep its "overrides" (records a history entry)\n  --force   regenerate from scratch, discarding overrides (history is kept)`);
  }
  const seeded = a.seed !== undefined && a.seed !== true;
  const opts = { seed: seeded ? String(a.seed) : undefined, direction: typeof a.direction === 'string' ? a.direction : undefined, now: seeded ? undefined : new Date().toISOString() };
  let previous = null;
  if (exists) { try { previous = JSON.parse(fs.readFileSync(out, 'utf8')); } catch { if (a.merge) throw new UserError(`${out} is not valid JSON; cannot --merge. Fix it or use --force.`); } }
  const doc = previous ? regenerateDesign(brief, previous, { ...opts, keepOverrides: Boolean(a.merge) }) : generateDesign(brief, opts);
  const result = validateDesign(doc);
  write(out, `${JSON.stringify(doc, null, 2)}\n`);
  /** @type {Record<string, string>} */
  const written = { design: out };
  for (const [flag, format] of [['css', 'css'], ['tailwind', 'tailwind'], ['ts', 'ts'], ['dtcg', 'json-dtcg']]) {
    if (typeof a[flag] === 'string') written[flag] = write(a[flag], exportTokens(doc, format));
  }
  const sel = doc.meta.selection;
  if (a.json) console.log(JSON.stringify({ written, direction: doc.visualDirection.id, score: sel.chosen.score, runnerUp: sel.runnerUp.id, briefHash: doc.meta.briefHash, valid: result.valid, errors: result.errors, assumptions: doc.meta.assumptions }, null, 2));
  else {
    log.ok(`${previous ? (a.merge ? 'Regenerated (overrides kept)' : 'Regenerated') : 'Generated'} ${out}`);
    log.info(`  Direction   ${doc.visualDirection.name} (${doc.visualDirection.id}) — score ${sel.chosen.score}; runner-up ${sel.runnerUp.id} ${sel.runnerUp.score}`);
    log.info(`  Thesis      ${doc.visualDirection.thesis}`);
    log.info(`  Type        ${doc.typography.families.display.family} / ${doc.typography.families.text.family} / ${doc.typography.families.mono.family}`);
    log.info(`  Colour      brand hue ${doc.color.brand.hue}°, primary ${doc.color.light.roles.primary.hex} (light) ${doc.color.dark.roles.primary.hex} (dark); ${doc.color.light.contrast.length + doc.color.dark.contrast.length} contrast pairs, ${doc.color.adjustments.length} adjusted`);
    log.info(`  Motion      ${doc.motion.profile}${doc.threeD ? `; 3D via ${doc.threeD.technology.recommendation}` : ''}`);
    if (doc.meta.overridesApplied.length) log.info(`  Overrides   ${doc.meta.overridesApplied.length} value(s) applied`);
    for (const [k, p] of Object.entries(written)) if (k !== 'design') log.info(`  ${k.padEnd(11)} ${p}`);
    for (const s of doc.meta.assumptions) log.warn(`Assumption: ${s}`);
  }
  if (!result.valid) {
    for (const e of result.errors) log.error(`${e.path || '(root)'}: ${e.message}`);
    log.error('The generated document failed validation' + (doc.meta.overridesApplied.length ? ' — check your overrides.' : '. This is a bug in the generator; please report it.'));
    return 1;
  }
  return 0;
}

function cmdValidate(a) {
  const file = a._[1];
  const doc = readJson(file, 'Design file');
  const res = validateDesign(doc);
  if (a.json) console.log(JSON.stringify(res, null, 2));
  else {
    for (const e of res.errors) log.error(`[${e.kind}] ${e.path || '(root)'}: ${e.message}`);
    for (const w of res.warnings) log.warn(`${w.path}: ${w.message}`);
    const c = res.checks;
    const summary = `${c.contrastPairs} contrast pairs, ${c.colorTokens} colour tokens, ${c.scales} scales, ${c.tokenReferences} token references checked`;
    if (res.valid) log.ok(`Valid — ${summary}.`); else log.error(`Invalid — ${res.errors.length} error(s); ${summary}.`);
  }
  return res.valid ? 0 : 1;
}

function cmdExplain(a) {
  const md = explainDesign(readJson(a._[1], 'Design file'), { section: typeof a.section === 'string' ? a.section : undefined });
  if (typeof a.out === 'string') log.ok(`Rationale written to ${write(a.out, md)}`); else process.stdout.write(md);
  return 0;
}

function cmdTokens(a) {
  const doc = readJson(a._[1], 'Design file');
  if (typeof a.format !== 'string') throw new UserError(`--format is required: ${FORMATS.join(' | ')}`);
  const cf = a['color-format'];
  if (cf !== undefined && cf !== 'hex' && cf !== 'oklch') throw new UserError('--color-format must be hex or oklch.');
  const outText = exportTokens(doc, a.format, { colorFormat: cf });
  if (typeof a.out === 'string') log.ok(`${a.format} tokens written to ${write(a.out, outText)}`); else process.stdout.write(outText);
  return 0;
}

function cmdDirections(a) {
  if (a.json) {
    console.log(JSON.stringify(DIRECTIONS.map((d) => ({
      id: d.id, name: d.name, thesis: d.thesis,
      fonts: Object.fromEntries(Object.entries(d.fonts).map(([k, v]) => { const f = resolveFont(v, k === 'mono' ? 'mono' : k === 'display' ? 'display' : 'text'); return [k, { family: f.family, source: f.source, license: f.license }]; })),
      color: d.color, radius: d.radius, elevation: d.elevation, density: d.density, motion: d.motion, fit: d.fit,
    })), null, 2));
    return 0;
  }
  const lines = DIRECTIONS.map((d) => {
    const fam = (k) => resolveFont(d.fonts[k], k === 'mono' ? 'mono' : 'text').family;
    const best = Object.entries(d.fit.categories).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k]) => k).join(', ');
    return `${d.id}\n  ${d.name} — ${d.thesis}\n  type: ${fam('display')} / ${fam('text')} / ${fam('mono')}   shape: ${d.radius}, ${d.elevation}, ${d.density}   default mode: ${d.color.mode}\n  strongest for: ${best}`;
  });
  console.log(`${DIRECTIONS.length} built-in art directions (force one with: generate --direction <id>)\n\n${lines.join('\n\n')}`);
  return 0;
}

/** @param {string[]} argv @returns {Promise<number>} */
export async function main(argv) {
  const a = parseArgs(argv, { boolean: BOOLEANS });
  const cmd = a._[0];
  switch (cmd) {
    case 'init': return cmdInit(a);
    case 'generate': return cmdGenerate(a);
    case 'validate': return cmdValidate(a);
    case 'explain': return cmdExplain(a);
    case 'tokens': return cmdTokens(a);
    case 'directions': return cmdDirections(a);
    case undefined: console.log(help); return 0;
    default: throw new UserError(`Unknown design command "${cmd}".\n\n${help}`);
  }
}
