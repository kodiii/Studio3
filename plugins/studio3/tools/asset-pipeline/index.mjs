// @ts-check
/**
 * Studio³ 3D Asset Pipeline — `studio3 assets <subcommand>`.
 * Source-preserving: inputs are opened read-only; every output goes to a separate path.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from '../lib/args.mjs';
import { log, UserError } from '../lib/log.mjs';
import { resolveInput, formatBytes } from './io.mjs';

export const help = `3D Asset Pipeline — studio3 assets <subcommand> [options]

Subcommands
  inspect <file.glb|.gltf> [--json]
      Scene hierarchy, meshes, materials, textures, animations, bounds, estimates.
  validate <file> [--json] [--strict]
      Khronos glTF-Validator + Studio³ delivery checks. Exit 1 on errors (or warnings with --strict).
  optimize <file> --out <dir> [--profile desktop|mobile|low-power|<file.json>]
      [--compress meshopt|draco|none] [--meshopt-level medium|high] [--no-quantize]
      [--texture-format webp|keep|ktx2] [--texture-max <px>] [--texture-quality <1-100>]
      [--simplify <ratio 0-1>] [--simplify-error <n>] [--allow-skinned-simplify]
      [--join] [--prune-attributes] [--bounds-tolerance <fraction>]
      [--name <base>] [--force] [--json]
      dedup → prune → weld → simplify (opt-in) → reorder → quantize → textures → compression,
      then re-reads and verifies the output. Writes <name>.glb, <name>.report.json, <name>.report.md.
  variants <file> --out <dir> [--profiles desktop,mobile,low-power] [--budgets <file.json>]
      [--thumbnail] [--thumbnail-size 512] [--background '#rrggbb'|transparent]
      [--name <base>] [--force] [--json]  (+ the optimize override flags)
      One <name>.<profile>.glb per profile, <name>.manifest.json, <name>.variants.report.{json,md}.
  manifest <dir> [--out manifest.json] [--source <dir>] [--force] [--json]
      Scan a directory of GLBs (<id>.<profile>.glb) and write an asset manifest.
  thumbnail <file.glb> --out <png> [--size 512] [--background '#rrggbb'|transparent] [--require] [--force] [--json]
      Render a preview with headless Chromium + three.js. Unavailable browser/WebGL →
      status "skipped" with exit code 0 (non-zero only with --require).
  import <file.fbx|.obj|.dae|.blend|.usdz> --out <file.glb> [--blender <path>] [--dry-run] [--force] [--json]
      Convert through Blender's CLI. Blender missing → status "unavailable", exit code 3.

Rules
  • Source assets are never modified or overwritten. Existing outputs are only replaced with
    --force, after a copy to <out>/.backup/<timestamp>/.
  • Built-in profiles are default starting points, not universal budgets; override them with a
    profile/budgets file or flags.
  • A step that did not run is reported as "skipped" with its reason.
  • Nothing is uploaded or downloaded. KTX2 needs the \`ktx\` CLI (KTX-Software) on PATH;
    import needs Blender on PATH.`;

const BOOLEANS = ['json', 'strict', 'force', 'join', 'require', 'allow-skinned-simplify', 'prune-attributes', 'quantize', 'thumbnail', 'dry-run'];

/** @param {any} v @param {string} flag */
function num(v, flag) {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (v === true || !Number.isFinite(n)) throw new UserError(`${flag} expects a number (got ${JSON.stringify(v)}).`);
  return n;
}

/** @param {any} v @param {string} flag @param {string[]} allowed */
function oneOf(v, flag, allowed) {
  if (v === undefined) return undefined;
  if (!allowed.includes(v)) throw new UserError(`${flag} must be one of ${allowed.join(', ')} (got ${JSON.stringify(v)}).`);
  return v;
}

/** @param {any} v @param {string} flag */
function str(v, flag) {
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || !v) throw new UserError(`${flag} expects a value.`);
  return v;
}

/** Flags shared by optimize and variants. @param {any} args */
function overrideFlags(args) {
  const simplify = num(args.simplify, '--simplify');
  if (simplify !== undefined && !(simplify > 0 && simplify <= 1)) throw new UserError(`--simplify expects a ratio in (0, 1] — the fraction of triangles to keep (got ${simplify}).`);
  const textureMax = num(args['texture-max'], '--texture-max');
  if (textureMax !== undefined && !(Number.isInteger(textureMax) && textureMax >= 1)) throw new UserError('--texture-max expects a positive integer (pixels).');
  const textureQuality = num(args['texture-quality'], '--texture-quality');
  if (textureQuality !== undefined && !(textureQuality >= 1 && textureQuality <= 100)) throw new UserError('--texture-quality expects 1–100.');
  const simplifyError = num(args['simplify-error'], '--simplify-error');
  if (simplifyError !== undefined && !(simplifyError > 0)) throw new UserError('--simplify-error expects a positive number (fraction of mesh radius).');
  const boundsTolerance = num(args['bounds-tolerance'], '--bounds-tolerance');
  return {
    flags: {
      compress: oneOf(args.compress, '--compress', ['meshopt', 'draco', 'none']),
      meshoptLevel: oneOf(args['meshopt-level'], '--meshopt-level', ['medium', 'high']),
      textureFormat: oneOf(args['texture-format'], '--texture-format', ['webp', 'keep', 'ktx2']),
      textureMax, textureQuality, simplify, simplifyError,
      quantize: args.quantize === false ? false : undefined,
    },
    join: !!args.join,
    pruneAttributes: !!args['prune-attributes'],
    allowSkinnedSimplify: !!args['allow-skinned-simplify'],
    boundsTolerance,
  };
}

/** @param {any} value */
function printJson(value) { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); }

/** @param {string[]} argv */
export async function main(argv) {
  const [sub, ...rest] = argv;
  if (!sub || sub === 'help') { console.log(help); return 0; }
  const args = parseArgs(rest, { boolean: BOOLEANS });
  switch (sub) {
    case 'inspect': return cmdInspect(args);
    case 'validate': return cmdValidate(args);
    case 'optimize': return cmdOptimize(args);
    case 'variants': return cmdVariants(args);
    case 'manifest': return cmdManifest(args);
    case 'thumbnail': return cmdThumbnail(args);
    case 'import': return cmdImport(args);
    default: throw new UserError(`Unknown assets subcommand "${sub}".\n\n${help}`);
  }
}

/** @param {any} args */
async function cmdInspect(args) {
  const file = resolveInput(args._[0]);
  const { inspectFile, formatInspect } = await import('./inspect.mjs');
  const report = await inspectFile(file);
  if (args.json) printJson(report); else console.log(formatInspect(report));
  return 0;
}

/** @param {any} args */
async function cmdValidate(args) {
  const file = resolveInput(args._[0]);
  const { validateFile, formatValidate } = await import('./validate.mjs');
  const report = await validateFile(file, { strict: !!args.strict });
  if (args.json) printJson(report); else console.log(formatValidate(report));
  return report.ok ? 0 : 1;
}

/** @param {any} args */
async function cmdOptimize(args) {
  const file = resolveInput(args._[0]);
  const out = str(args.out, '--out');
  if (!out) throw new UserError('optimize requires --out <dir> (outputs never go next to the source implicitly).');
  const { optimizeFile } = await import('./optimize.mjs');
  const { resolveProfile, applyFlags } = await import('./profiles.mjs');
  const o = overrideFlags(args);
  const resolved = resolveProfile(str(args.profile, '--profile'));
  const profile = { ...resolved, profile: applyFlags(resolved.profile, o.flags) };
  const overridden = Object.entries(o.flags).filter(([, v]) => v !== undefined).map(([k]) => k);
  if (overridden.length) profile.origin += ` + flags (${overridden.join(', ')})`;
  const report = await optimizeFile(file, {
    outDir: out, name: str(args.name, '--name'), profile, force: !!args.force,
    join: o.join, pruneAttributes: o.pruneAttributes, allowSkinnedSimplify: o.allowSkinnedSimplify, boundsTolerance: o.boundsTolerance,
  });
  if (args.json) printJson(report);
  else {
    const s = report.summary;
    console.log(`${report.ok ? 'Verified' : 'VERIFICATION FAILED'}: ${report.output.file}`);
    console.log(`  size      ${formatBytes(s.bytes.before)} → ${formatBytes(s.bytes.after)} (${s.bytes.percent}%)`);
    console.log(`  triangles ${s.triangles.before.toLocaleString('en-US')} → ${s.triangles.after.toLocaleString('en-US')}   vertices ${s.vertices.before.toLocaleString('en-US')} → ${s.vertices.after.toLocaleString('en-US')}`);
    console.log(`  textures  ${formatBytes(s.textureBytes.before)} → ${formatBytes(s.textureBytes.after)} encoded, GPU estimate ${formatBytes(s.gpuTextureBytesEstimate.before)} → ${formatBytes(s.gpuTextureBytesEstimate.after)}`);
    for (const st of report.steps) console.log(`  ${st.status === 'skipped' ? '○' : '✔'} ${st.id}${st.status === 'skipped' ? ` — skipped: ${st.reason}` : ''}`);
    for (const n of report.notes) console.log(`  ! ${n}`);
    for (const c of report.verification.checks) console.log(`  ${c.status === 'pass' ? '✔' : c.status === 'skipped' ? '○' : '✖'} verify ${c.id}: ${c.detail}`);
    for (const d of report.decoderRequirements) if (d.needs) console.log(`  consumer needs ${d.needs} (${d.extension})`);
    const reports = /** @type {any} */ (report).reports;
    if (reports) console.log(`  reports: ${reports.json}, ${reports.markdown}`);
  }
  if (!report.ok) log.error('Verification failed — the output was kept for inspection; nothing was deleted.');
  return report.ok ? 0 : 1;
}

/** @param {any} args */
async function cmdVariants(args) {
  const file = resolveInput(args._[0]);
  const out = str(args.out, '--out');
  if (!out) throw new UserError('variants requires --out <dir>.');
  const { buildVariants } = await import('./variants.mjs');
  const { parseBackground } = await import('./thumbnail.mjs');
  const o = overrideFlags(args);
  const profiles = typeof args.profiles === 'string' ? args.profiles.split(',').map((/** @type {string} */ s) => s.trim()).filter(Boolean) : undefined;
  const result = await buildVariants(file, {
    outDir: out, name: str(args.name, '--name'), profiles, budgets: str(args.budgets, '--budgets'), force: !!args.force,
    flags: o.flags, join: o.join, pruneAttributes: o.pruneAttributes, allowSkinnedSimplify: o.allowSkinnedSimplify, boundsTolerance: o.boundsTolerance,
    thumbnail: !!args.thumbnail, thumbnailSize: num(args['thumbnail-size'], '--thumbnail-size'), background: parseBackground(args.background === true ? undefined : args.background),
  });
  const { manifestDoc, manifestPath, reportJson, reportMd, ...printable } = result;
  if (args.json) printJson(printable);
  else {
    console.log(`${result.ok ? 'Verified' : 'VERIFICATION FAILED'}: ${result.name} — source ${formatBytes(result.source.bytes)}`);
    for (const v of result.variants) {
      console.log(`  ${v.profile.name.padEnd(10)} ${v.output.file}  ${formatBytes(v.output.bytes)} (${v.summary.bytes.percent}%)  ${v.summary.triangles.after.toLocaleString('en-US')} tris  ${v.ok ? 'verified' : 'FAILED'}`);
    }
    console.log(`  thumbnail: ${result.thumbnail.status}${result.thumbnail.reason ? ` — ${result.thumbnail.reason}` : ''}`);
    console.log(`  manifest: ${manifestPath}`);
    console.log(`  report:   ${reportJson}`);
  }
  if (!result.ok) log.error('Verification failed for at least one variant — outputs were kept for inspection.');
  return result.ok ? 0 : 1;
}

/** @param {any} args */
async function cmdManifest(args) {
  const dir = args._[0];
  if (!dir) throw new UserError('manifest requires a directory of .glb files.');
  const { scanDirectory } = await import('./manifest.mjs');
  const { createOutputGuard } = await import('./safe-output.mjs');
  const outPath = path.resolve(str(args.out, '--out') ?? path.join(dir, 'manifest.json'));
  const guard = createOutputGuard({ outDir: path.dirname(outPath), force: !!args.force });
  guard.check([outPath]);
  const manifest = await scanDirectory(dir, { sourceDir: str(args.source, '--source'), manifestDir: path.dirname(outPath) });
  guard.write(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
  if (args.json) printJson(manifest);
  else {
    console.log(`Wrote ${outPath} — ${manifest.assets.length} asset(s)`);
    for (const a of manifest.assets) console.log(`  ${a.id}: ${a.variants.map((/** @type {any} */ v) => `${v.profile} ${formatBytes(v.bytes)}`).join(', ')}${a.source ? '' : '  (source unknown)'}`);
  }
  return 0;
}

/** @param {any} args */
async function cmdThumbnail(args) {
  const file = resolveInput(args._[0]);
  const out = str(args.out, '--out');
  if (!out) throw new UserError('thumbnail requires --out <file.png>.');
  const outPath = path.resolve(out);
  if (path.extname(outPath).toLowerCase() !== '.png') throw new UserError('--out must be a .png file.');
  const { renderThumbnail, parseBackground } = await import('./thumbnail.mjs');
  const { createOutputGuard } = await import('./safe-output.mjs');
  const guard = createOutputGuard({ outDir: path.dirname(outPath), sources: [file], force: !!args.force });
  guard.check([outPath]);
  const size = num(args.size, '--size') ?? 512;
  const background = parseBackground(args.background === true ? undefined : args.background);
  /** @type {any} */
  let res;
  try { res = await renderThumbnail(file, { size, background }); }
  catch (err) {
    if (err instanceof UserError && err.exitCode === 3) res = { status: 'skipped', reason: err.message.split('\n')[0] };
    else throw err;
  }
  /** @type {any} */
  let result;
  if (res.status === 'ok') {
    guard.write(outPath, res.png);
    result = { status: 'ok', file: outPath, size, background: background ?? 'transparent', bytes: res.png.length, meshes: res.meshes, triangles: res.triangles, renderer: res.renderer, three: res.three, blank: res.blank };
  } else result = { status: res.status, reason: res.reason, file: null };
  if (args.json) printJson(result);
  else if (result.status === 'ok') console.log(`Wrote ${outPath} (${size}×${size}, ${formatBytes(result.bytes)}, renderer: ${result.renderer})`);
  else console.log(`Thumbnail ${result.status}: ${result.reason}`);
  if (result.status === 'ok') return 0;
  if (result.status === 'skipped') return args.require ? 3 : 0;
  return 1;
}

/** @param {any} args */
async function cmdImport(args) {
  const { IMPORT_EXTENSIONS, importWithBlender } = await import('./import.mjs');
  const file = resolveInput(args._[0], IMPORT_EXTENSIONS);
  const out = str(args.out, '--out');
  if (!out) throw new UserError('import requires --out <file.glb>.');
  const outPath = path.resolve(out);
  if (path.extname(outPath).toLowerCase() !== '.glb') throw new UserError('--out must be a .glb file.');
  const { createOutputGuard } = await import('./safe-output.mjs');
  const guard = createOutputGuard({ outDir: path.dirname(outPath), sources: [file], force: !!args.force });
  guard.check([outPath]);
  // Blender writes the file itself, so convert to a temporary name and move it through the guard.
  const tmp = path.join(path.dirname(outPath), `.studio3-import-${process.pid}-${path.basename(outPath)}`);
  const res = await importWithBlender(file, tmp, { blender: str(args.blender, '--blender'), dryRun: !!args['dry-run'] });
  /** @type {any} */
  const result = { ...res, input: file };
  if (res.status === 'converted') {
    try { guard.write(outPath, fs.readFileSync(tmp)); } finally { fs.rmSync(tmp, { force: true }); }
    result.output = outPath;
    result.command = res.command.map((/** @type {string} */ c) => (c === tmp ? outPath : c));
  } else if (res.command) result.command = res.command.map((/** @type {string} */ c) => (c === tmp ? outPath : c));
  if (res.status === 'dry-run') result.output = outPath;
  if (args.json) printJson(result);
  else if (res.status === 'converted') console.log(`Converted ${path.basename(file)} → ${outPath} (${formatBytes(/** @type {any} */ (res).bytes)}). Run "studio3 assets validate" and "optimize" next.`);
  else if (res.status === 'dry-run') console.log(`Would run: ${result.command.map((/** @type {string} */ c) => JSON.stringify(c)).join(' ')}`);
  else console.log(`Import ${res.status}: ${res.reason}${/** @type {any} */ (res).log ? `\n${/** @type {any} */ (res).log.join('\n')}` : ''}`);
  if (res.status === 'converted' || res.status === 'dry-run') return 0;
  return res.status === 'unavailable' ? 3 : 1;
}
