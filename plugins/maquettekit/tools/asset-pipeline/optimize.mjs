// @ts-check
/**
 * `maquettekit assets optimize` — source-preserving optimisation pipeline:
 * dedup → prune → weld → (simplify, opt-in) → reorder → quantize → textures →
 * mesh compression → write GLB → re-read and verify.
 *
 * The source file is opened read-only and hashed before and after the run.
 */
import fs from 'node:fs';
import path from 'node:path';
import { UserError, log } from '../lib/log.mjs';
import {
  GENERATOR, DECODER_EXTENSIONS, SUPPORT_NOTES, loadGltfTransform, loadSharp, readDocument, sha256File, sha256Bytes,
  toolVersions, formatBytes, formatDelta,
} from './io.mjs';
import { inspectDocument } from './inspect.mjs';
import { runKhronosValidator } from './validate.mjs';
import { createOutputGuard } from './safe-output.mjs';
import { textureRuleFor, evaluateBudgets } from './profiles.mjs';
import { detectKtx, encodeKtx2 } from './ktx.mjs';

/** Default verification tolerances (labelled defaults; override with --bounds-tolerance). */
export const VERIFY_DEFAULTS = {
  /** Allowed bounding-box drift as a fraction of the source diagonal, without simplification. */
  boundsTolerance: 0.002,
  /** Same, when simplification ran (simplification may pull silhouettes in slightly). */
  boundsToleranceSimplified: 0.02,
  animationDurationTolerance: 1e-4,
  transformTolerance: 1e-5,
};

/** Default name: file name without extension and without a trailing ".source". @param {string} file */
export function defaultName(file) {
  return path.basename(file).replace(/\.(glb|gltf)$/i, '').replace(/\.source$/i, '');
}

/** @param {any} v @returns {string} */
function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v) ?? 'null';
}

/** Cheap structural snapshot used for per-step before/after stats. @param {any} document */
function snapshot(document) {
  const root = document.getRoot();
  const positions = new Set(); let primitives = 0; let triangles = 0;
  /** @type {Map<any, number>} */
  const refs = new Map();
  for (const node of root.listNodes()) { const m = node.getMesh(); if (m) refs.set(m, (refs.get(m) ?? 0) + 1); }
  for (const mesh of root.listMeshes()) {
    const instances = refs.get(mesh) ?? 0;
    for (const prim of mesh.listPrimitives()) {
      primitives++;
      const pos = prim.getAttribute('POSITION'); const idx = prim.getIndices();
      if (pos) positions.add(pos);
      const count = idx ? idx.getCount() : pos ? pos.getCount() : 0;
      const mode = prim.getMode();
      triangles += instances * (mode === 4 ? Math.floor(count / 3) : mode === 5 || mode === 6 ? Math.max(0, count - 2) : 0);
    }
  }
  let vertices = 0; for (const a of positions) vertices += /** @type {any} */ (a).getCount();
  let accessorBytes = 0; for (const a of root.listAccessors()) accessorBytes += a.getByteLength();
  let textureBytes = 0; for (const t of root.listTextures()) textureBytes += t.getImage()?.byteLength ?? 0;
  return {
    nodes: root.listNodes().length, meshes: root.listMeshes().length, primitives, vertices, triangles,
    accessors: root.listAccessors().length, accessorBytes, materials: root.listMaterials().length,
    textures: root.listTextures().length, textureBytes, animations: root.listAnimations().length,
  };
}

/**
 * Move the mesh of every named / extras-carrying node into an unnamed child so
 * that quantization (which bakes a de-quantization transform into the node that
 * owns the mesh) never alters the transform of a part node that viewers address by name.
 * @param {any} document
 */
function isolatePartMeshes(document) {
  const root = document.getRoot();
  let moved = 0;
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const hasIdentity = node.getName() || Object.keys(node.getExtras() ?? {}).length > 0;
    if (!hasIdentity || node.getSkin() || node.getExtension('EXT_mesh_gpu_instancing')) continue;
    const holder = document.createNode('').setMesh(mesh);
    const weights = node.getWeights();
    if (weights.length) holder.setWeights(weights);
    node.addChild(holder).setMesh(null);
    for (const parent of node.listParents()) {
      if (parent.propertyType === 'AnimationChannel' && parent.getTargetPath() === 'weights') parent.setTargetNode(holder);
    }
    moved++;
  }
  return moved;
}

/**
 * @typedef {{
 *   outDir: string, name?: string,
 *   profile: { name: string, profile: import('./profiles.mjs').Profile, origin: string },
 *   force?: boolean, join?: boolean, pruneAttributes?: boolean, allowSkinnedSimplify?: boolean,
 *   boundsTolerance?: number, guard?: ReturnType<typeof createOutputGuard>, writeReports?: boolean,
 *   env?: NodeJS.ProcessEnv,
 * }} OptimizeOptions
 */

/**
 * Optimise one file. Returns the report; `report.ok === false` means verification failed
 * (the output is kept on disk for inspection — nothing is deleted).
 * @param {string} input absolute path of the source (.glb/.gltf)
 * @param {OptimizeOptions} opts
 */
export async function optimizeFile(input, opts) {
  const { functions, extensions, core } = await loadGltfTransform();
  const profile = opts.profile.profile;
  const compress = profile.compress ?? 'none';
  const name = opts.name ?? defaultName(input);
  if (/[\\/]/.test(name)) throw new UserError(`--name must be a base file name without path separators (got "${name}").`);
  const outDir = path.resolve(opts.outDir);
  const outFile = path.join(outDir, `${name}.glb`);
  const reportJson = path.join(outDir, `${name}.report.json`);
  const reportMd = path.join(outDir, `${name}.report.md`);
  const writeReports = opts.writeReports !== false;
  const guard = opts.guard ?? createOutputGuard({ outDir, sources: [input], force: opts.force });
  if (!opts.guard) guard.check(writeReports ? [outFile, reportJson, reportMd] : [outFile]);

  const sourceHashBefore = sha256File(input);
  const sourceBytes = fs.statSync(input).size;

  // Baseline (fresh read, untouched) for verification.
  const baseline = await readDocument(input);
  const srcInspect = await inspectDocument(baseline.document, { file: input, hash: false });
  const srcValidation = await runKhronosValidator(new Uint8Array(fs.readFileSync(input)), { uri: path.basename(input), baseDir: path.dirname(input) });

  const { document, io, logger, meshopt } = await readDocument(input, { dracoEncoder: compress === 'draco' });
  const root = document.getRoot();
  /** @type {any[]} */
  const steps = [];
  /**
   * @param {string} id @param {string} title
   * @param {() => Promise<{ status?: string, reason?: string, detail?: any } | void>} fn
   */
  const step = async (id, title, fn) => {
    const before = snapshot(document);
    const t0 = performance.now();
    log.step(`${name}: ${title}`);
    /** @type {{ status?: string, reason?: string, detail?: any }} */
    const res = (await fn()) || {};
    const entry = { id, title, status: res.status ?? 'ran', reason: res.reason, detail: res.detail, before, after: snapshot(document), ms: Math.round(performance.now() - t0) };
    if (entry.status === 'skipped') log.info(`    skipped: ${entry.reason}`);
    steps.push(entry);
    return entry;
  };
  /** @param {string} reason */
  const skip = (reason) => ({ status: 'skipped', reason });

  await step('dedup', 'Deduplicate accessors, meshes, textures and materials (uniquely named properties are kept)', async () => {
    await document.transform(functions.dedup({ keepUniqueNames: true }));
  });

  await step('prune', 'Prune unreferenced data (named/empty leaf nodes, extras and vertex attributes are kept)', async () => {
    await document.transform(functions.prune({ keepLeaves: true, keepAttributes: !opts.pruneAttributes, keepExtras: true, keepSolidTextures: true }));
    return { detail: { keepLeaves: true, keepExtras: true, keepAttributes: !opts.pruneAttributes, keepSolidTextures: true } };
  });

  await step('join', 'Join compatible primitives (opt-in; named nodes and meshes are never merged)', async () => {
    if (!opts.join) return skip('Not requested (--join). Joining is opt-in because it can merge parts that viewers address individually.');
    await document.transform(functions.join({ keepNamed: true }));
    return { detail: { keepNamed: true } };
  });

  await step('weld', 'Weld bitwise-identical vertices and build index buffers', async () => {
    await document.transform(functions.weld());
  });

  let simplified = false;
  await step('simplify', 'Simplify geometry (meshoptimizer, borders locked)', async () => {
    const s = profile.simplify;
    if (!s || !(s.ratio > 0 && s.ratio < 1)) return skip('Not requested by the profile/flags; triangle count is preserved.');
    if (!meshopt) return skip('meshoptimizer is not installed (run "maquettekit setup"); geometry left unsimplified.');
    const error = s.error ?? 0.001;
    const skinnedMeshes = new Set(root.listNodes().filter((/** @type {any} */ n) => n.getSkin() && n.getMesh()).map((/** @type {any} */ n) => n.getMesh()));
    let done = 0; let skippedSkin = 0; let skippedMorph = 0; let skippedMode = 0;
    for (const mesh of root.listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const mode = prim.getMode();
        if (mode !== 4 && mode !== 5 && mode !== 6) { skippedMode++; continue; }
        if (!opts.allowSkinnedSimplify && skinnedMeshes.has(mesh)) { skippedSkin++; continue; }
        if (!opts.allowSkinnedSimplify && prim.listTargets().length) { skippedMorph++; continue; }
        if (!prim.getIndices()) functions.weldPrimitive(prim);
        const trianglesBefore = prim.getIndices().getCount() / 3;
        if (Math.floor(s.ratio * trianglesBefore) < 1) { skippedMode++; continue; }
        functions.simplifyPrimitive(prim, { simplifier: meshopt.MeshoptSimplifier, ratio: s.ratio, error, lockBorder: true });
        done++;
      }
    }
    simplified = done > 0;
    return {
      status: done ? 'ran' : 'skipped',
      reason: done ? undefined : 'No eligible triangle primitives (skinned/morph-target meshes are excluded unless --allow-skinned-simplify).',
      detail: { ratio: s.ratio, error, errorUnit: 'fraction of mesh radius', lockBorder: true, primitivesSimplified: done, skippedSkinned: skippedSkin, skippedMorphTargets: skippedMorph, skippedOther: skippedMode },
    };
  });

  await step('reorder', 'Reorder vertices/indices for compression and vertex-cache locality (meshoptimizer)', async () => {
    if (compress === 'draco') return skip('Draco reorders vertices itself; meshopt reordering would be discarded.');
    if (!meshopt) return skip('meshoptimizer is not installed (run "maquettekit setup").');
    await document.transform(functions.reorder({ encoder: meshopt.MeshoptEncoder, target: 'size' }));
    return { detail: { target: 'size' } };
  });

  const level = profile.meshoptLevel ?? 'medium';
  await step('quantize', 'Quantize vertex attributes (KHR_mesh_quantization)', async () => {
    if (compress === 'draco') return skip('Draco applies its own quantization inside the compressed stream.');
    if (profile.quantize === false) {
      if (compress === 'meshopt') return skip('Disabled by profile/flag (--no-quantize); meshopt will compress float attributes less effectively.');
      return skip('Disabled by profile/flag (--no-quantize).');
    }
    const q = profile.quantize || {};
    const isolated = isolatePartMeshes(document);
    /** @type {any} */
    const options = {
      quantizePosition: q.position ?? functions.QUANTIZE_DEFAULTS.quantizePosition,
      quantizeNormal: q.normal ?? functions.QUANTIZE_DEFAULTS.quantizeNormal,
      quantizeTexcoord: q.texcoord ?? functions.QUANTIZE_DEFAULTS.quantizeTexcoord,
      quantizeColor: q.color ?? functions.QUANTIZE_DEFAULTS.quantizeColor,
      quantizeWeight: q.weight ?? functions.QUANTIZE_DEFAULTS.quantizeWeight,
      quantizeGeneric: q.generic ?? functions.QUANTIZE_DEFAULTS.quantizeGeneric,
    };
    if (compress === 'meshopt' && level === 'high') {
      // Mirrors gltf-transform's meshopt({level:'high'}): normals/tangents stay float for the octahedral filter.
      options.pattern = /^(POSITION|TEXCOORD|JOINTS|WEIGHTS|COLOR)(_\d+)?$/;
      options.patternTargets = /^(POSITION|TEXCOORD|JOINTS|WEIGHTS|COLOR|NORMAL|TANGENT)(_\d+)?$/;
      options.quantizeNormal = Math.min(options.quantizeNormal, 8);
    }
    await document.transform(functions.quantize(options));
    const { pattern: _p, patternTargets: _pt, ...bits } = options;
    return { detail: { bits, bitsOrigin: profile.quantize ? 'profile' : 'gltf-transform defaults', partNodesIsolated: isolated, note: 'Meshes of named part nodes were moved to unnamed child nodes so the part nodes keep their original transforms.' } };
  });

  /** @type {any[]} */
  const textureLog = [];
  await step('textures', 'Resize / re-encode textures (sharp), per-slot rules', async () => {
    const textures = root.listTextures();
    if (!textures.length) return skip('The asset has no textures.');
    const wantsWork = (profile.textures?.format && profile.textures.format !== 'keep') || profile.textures?.maxSize || Object.keys(profile.textures?.slots ?? {}).length;
    if (!wantsWork) return skip('Profile keeps textures as they are (format "keep", no size limit).');
    const sharp = await loadSharp();
    if (!sharp) return skip('sharp is not installed (run "maquettekit setup"); textures left untouched.');
    const ktx = detectKtx(opts.env);
    /** @type {string[]} */
    const notes = [];
    let ktxFallback = false;
    for (const [index, texture] of textures.entries()) {
      const slots = functions.listTextureSlots(texture);
      const colorSpace = functions.getTextureColorSpace(texture) ?? 'linear';
      const rule = textureRuleFor(profile.textures, slots);
      const label = texture.getName() || texture.getURI() || `texture_${index}`;
      const size = texture.getSize();
      const srcImage = texture.getImage(); const srcMime = texture.getMimeType(); const srcUri = texture.getURI();
      const from = { mimeType: srcMime, width: size?.[0] ?? null, height: size?.[1] ?? null, bytes: srcImage?.byteLength ?? 0 };
      /** @type {any} */
      const entry = { name: label, slots, colorSpace, rule: { format: rule.format, maxSize: rule.maxSize, quality: rule.quality, lossless: rule.lossless, slotRules: rule.appliedSlots }, from, to: from, action: 'kept' };
      textureLog.push(entry);
      if (!srcImage || !size) { entry.reason = 'No readable image data.'; continue; }
      if (!['image/png', 'image/jpeg', 'image/webp', 'image/avif'].includes(srcMime)) { entry.reason = `Source format ${srcMime} is not re-encoded by this step.`; continue; }
      const needsResize = rule.maxSize != null && Math.max(size[0], size[1]) > rule.maxSize;
      let format = rule.format;
      if (format === 'ktx2' && !ktx.available) {
        format = 'webp'; ktxFallback = true;
        entry.note = 'skipped: ktx2 unavailable — fell back to WebP';
      }
      if (format === 'keep' && !needsResize) { entry.reason = 'Within its size budget and format is "keep".'; continue; }

      if (format === 'ktx2') {
        const [w, h] = needsResize ? functions.fitWithin(size, [/** @type {number} */ (rule.maxSize), /** @type {number} */ (rule.maxSize)]) : size;
        const png = await sharp(srcImage).resize(w, h, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer();
        const out = await encodeKtx2(/** @type {string} */ (ktx.path), png, { srgb: colorSpace === 'srgb', quality: rule.quality });
        texture.setImage(out).setMimeType('image/ktx2');
        if (srcUri) texture.setURI(srcUri.replace(/\.[a-z0-9]+$/i, '.ktx2'));
        entry.action = needsResize ? 'resized + encoded KTX2' : 'encoded KTX2';
      } else {
        const targetFormat = format === 'keep' ? undefined : 'webp';
        await functions.compressTexture(texture, {
          encoder: sharp, targetFormat,
          resize: needsResize ? [/** @type {number} */ (rule.maxSize), /** @type {number} */ (rule.maxSize)] : undefined,
          quality: rule.quality, lossless: rule.lossless,
        });
        const dst = texture.getImage();
        if (!needsResize && dst.byteLength >= srcImage.byteLength) {
          texture.setImage(srcImage).setMimeType(srcMime).setURI(srcUri);
          entry.reason = 'Re-encoding did not make it smaller; original bytes kept.';
          continue;
        }
        entry.action = dst === srcImage ? 'kept' : needsResize ? `resized + re-encoded ${texture.getMimeType().split('/')[1]}` : `re-encoded ${texture.getMimeType().split('/')[1]}`;
      }
      const newSize = texture.getSize();
      entry.to = { mimeType: texture.getMimeType(), width: newSize?.[0] ?? null, height: newSize?.[1] ?? null, bytes: texture.getImage().byteLength };
    }
    // Declare the texture extensions that are actually in use.
    const mimes = new Set(root.listTextures().map((/** @type {any} */ t) => t.getMimeType()));
    /** @param {any} Ext @param {string} mime */
    const sync = (Ext, mime) => {
      const had = root.listExtensionsUsed().some((/** @type {any} */ e) => e.extensionName === Ext.EXTENSION_NAME);
      if (mimes.has(mime)) document.createExtension(Ext).setRequired(true);
      else if (had) document.createExtension(Ext).dispose();
    };
    sync(extensions.EXTTextureWebP, 'image/webp');
    sync(extensions.KHRTextureBasisu, 'image/ktx2');
    if (ktxFallback) notes.push(`skipped: ktx2 unavailable — ${ktx.reason} Fell back to WebP.`);
    return {
      detail: {
        encoder: 'sharp', ktx: { requested: textureLog.some((t) => t.rule.format === 'ktx2'), available: ktx.available, reason: ktx.reason },
        notes, changed: textureLog.filter((t) => t.action !== 'kept').length, kept: textureLog.filter((t) => t.action === 'kept').length,
      },
    };
  });

  await step('compress', `Mesh compression (${compress})`, async () => {
    if (compress === 'none') return skip('Profile/flag selected no mesh compression.');
    if (compress === 'meshopt') {
      if (!meshopt) return skip('meshoptimizer is not installed (run "maquettekit setup"); output is uncompressed.');
      document.createExtension(extensions.EXTMeshoptCompression).setRequired(true).setEncoderOptions({
        method: level === 'medium' ? extensions.EXTMeshoptCompression.EncoderMethod.QUANTIZE : extensions.EXTMeshoptCompression.EncoderMethod.FILTER,
      });
      return { detail: { extension: 'EXT_meshopt_compression', level, note: 'Applied when the GLB is serialised.' } };
    }
    if (compress === 'draco') {
      const q = profile.quantize || {};
      document.createExtension(extensions.KHRDracoMeshCompression).setRequired(true).setEncoderOptions({
        method: extensions.KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,
        quantizationBits: {
          POSITION: q.position ?? 14, NORMAL: q.normal ?? 10, COLOR: q.color ?? 8, TEX_COORD: q.texcoord ?? 12, GENERIC: q.generic ?? 12,
        },
      });
      return { detail: { extension: 'KHR_draco_mesh_compression', method: 'edgebreaker', note: 'Applied when the GLB is serialised. Draco does not compress animation data.' } };
    }
    throw new UserError(`Unknown compression "${compress}" (expected meshopt, draco or none).`);
  });

  root.getAsset().generator = `${GENERATOR} (glTF-Transform ${core.VERSION ?? ''})`.replace(' )', ')');

  let outBytes;
  await step('write', `Write ${path.basename(outFile)}`, async () => {
    const bytes = await io.writeBinary(document);
    guard.write(outFile, bytes);
    outBytes = bytes.byteLength;
    return { detail: { bytes: bytes.byteLength } };
  });

  // ---- Verification: re-read what was written, compare against the untouched baseline. ----
  log.step(`${name}: verify output`);
  const outRead = await readDocument(outFile);
  const outInspect = await inspectDocument(outRead.document, { file: outFile });
  const outValidation = await runKhronosValidator(new Uint8Array(fs.readFileSync(outFile)), { uri: path.basename(outFile), baseDir: outDir });
  const boundsTolerance = opts.boundsTolerance ?? (simplified ? VERIFY_DEFAULTS.boundsToleranceSimplified : VERIFY_DEFAULTS.boundsTolerance);
  const checks = verifyOutput(srcInspect, outInspect, srcValidation, outValidation, { simplified, boundsTolerance });

  const sourceHashAfter = sha256File(input);
  checks.push({
    id: 'source-untouched', status: sourceHashAfter === sourceHashBefore ? 'pass' : 'fail',
    detail: sourceHashAfter === sourceHashBefore ? `Source SHA-256 unchanged (${sourceHashBefore}).` : `Source file changed during the run! before ${sourceHashBefore}, after ${sourceHashAfter}`,
  });
  const ok = checks.every((c) => c.status !== 'fail');

  const rel = (/** @type {string} */ p) => path.relative(outDir, p).split(path.sep).join('/');
  const extensionsRequired = outInspect.extensionsRequired;
  const report = {
    generator: GENERATOR, generatedAt: new Date().toISOString(), tools: toolVersions(),
    ok,
    name,
    source: { file: rel(input), sha256: sourceHashBefore, bytes: sourceBytes },
    output: { file: rel(outFile), sha256: sha256Bytes(fs.readFileSync(outFile)), bytes: outBytes },
    profile: { name: opts.profile.name, origin: opts.profile.origin, settings: profile, note: 'Built-in profiles are default starting points, not universal budgets.' },
    summary: {
      bytes: delta(sourceBytes, /** @type {any} */ (outBytes)),
      triangles: delta(srcInspect.totals.renderedTriangles, outInspect.totals.renderedTriangles),
      uniqueMeshTriangles: delta(srcInspect.totals.triangles, outInspect.totals.triangles),
      vertices: delta(srcInspect.totals.vertices, outInspect.totals.vertices),
      meshes: delta(srcInspect.totals.meshes, outInspect.totals.meshes),
      materials: delta(srcInspect.totals.materials, outInspect.totals.materials),
      textures: delta(srcInspect.totals.textures, outInspect.totals.textures),
      textureBytes: delta(srcInspect.totals.textureBytes, outInspect.totals.textureBytes),
      gpuTextureBytesEstimate: delta(srcInspect.totals.gpuTextureBytesEstimate, outInspect.totals.gpuTextureBytesEstimate),
      drawCallsEstimate: delta(srcInspect.totals.drawCallsEstimate, outInspect.totals.drawCallsEstimate),
      animations: delta(srcInspect.totals.animations, outInspect.totals.animations),
    },
    steps,
    notes: steps.flatMap((st) => (Array.isArray(st.detail?.notes) ? st.detail.notes.map((/** @type {string} */ n) => `${st.id}: ${n}`) : [])),
    textures: textureLog,
    verification: { ok, boundsTolerance, checks },
    budgets: evaluateBudgets(profile.budgets, outInspect),
    extensionsUsed: outInspect.extensionsUsed,
    extensionsRequired,
    decoderRequirements: decoderRequirements(outInspect.extensionsUsed, extensionsRequired),
    sourcePreserving: { sourceSha256Before: sourceHashBefore, sourceSha256After: sourceHashAfter, unchanged: sourceHashBefore === sourceHashAfter, howToRevert: 'Outputs are derived files. Delete them and re-run the pipeline from the unchanged source.' },
    backups: guard.backups.map((b) => ({ file: rel(b.file), backup: rel(b.backup) })),
    warnings: [...new Set([...baseline.logger.warnings, ...logger.warnings, ...outRead.logger.warnings])],
    inspect: { source: slim(srcInspect), output: slim(outInspect) },
  };

  if (writeReports) {
    guard.write(reportJson, `${JSON.stringify(report, null, 2)}\n`);
    guard.write(reportMd, formatOptimizeMarkdown(report));
    /** @type {any} */ (report).reports = { json: rel(reportJson), markdown: rel(reportMd) };
    /** @type {any} */ (report).backups = guard.backups.map((b) => ({ file: rel(b.file), backup: rel(b.backup) }));
  }
  Object.defineProperty(report, 'outputPath', { value: outFile, enumerable: false });
  Object.defineProperty(report, 'outputInspect', { value: outInspect, enumerable: false });
  return report;
}

/** @param {number} before @param {number} after */
function delta(before, after) {
  return { before, after, change: after - before, percent: before ? Math.round(((after - before) / before) * 10000) / 100 : null };
}

/** Compact inspect data kept inside reports. @param {any} i */
function slim(i) {
  return {
    totals: i.totals, bounds: i.bounds,
    meshes: i.meshes.map((/** @type {any} */ m) => ({ name: m.name, primitives: m.primitiveCount, vertices: m.vertices, triangles: m.triangles, instances: m.instances, attributes: m.attributes })),
    materials: i.materials.map((/** @type {any} */ m) => m.name),
    textures: i.textures.map((/** @type {any} */ t) => ({ name: t.name, mimeType: t.mimeType, width: t.width, height: t.height, bytes: t.bytes, slots: t.slots, gpuBytesEstimate: t.gpuBytesEstimate })),
    animations: i.animations.map((/** @type {any} */ a) => ({ name: a.name, duration: a.duration, channels: a.channels })),
    namedNodes: i.namedNodes.map((/** @type {any} */ n) => n.name),
  };
}

/**
 * What a consumer must provide to load the file.
 * @param {string[]} used @param {string[]} required
 */
export function decoderRequirements(used, required) {
  const out = [];
  for (const ext of used) {
    const d = /** @type {Record<string, any>} */ (DECODER_EXTENSIONS)[ext];
    if (d) out.push({ extension: ext, required: required.includes(ext), needs: d.decoder, three: d.three });
    else if (ext in SUPPORT_NOTES) out.push({ extension: ext, required: required.includes(ext), needs: null, note: /** @type {Record<string, string>} */ (SUPPORT_NOTES)[ext] });
  }
  return out;
}

/**
 * Compare an output against its untouched source.
 * @param {any} src inspect report of the source @param {any} out inspect report of the output
 * @param {any} srcVal Khronos result for the source @param {any} outVal Khronos result for the output
 * @param {{ simplified: boolean, boundsTolerance: number }} opts
 * @returns {{ id: string, status: 'pass' | 'fail' | 'skipped', detail: string }[]}
 */
export function verifyOutput(src, out, srcVal, outVal, opts) {
  /** @type {{ id: string, status: 'pass' | 'fail' | 'skipped', detail: string }[]} */
  const checks = [];
  /** @param {string} id @param {boolean} pass @param {string} detail */
  const add = (id, pass, detail) => checks.push({ id, status: pass ? 'pass' : 'fail', detail });

  // Validator: no new errors.
  if (outVal.status !== 'ran' || srcVal.status !== 'ran') {
    checks.push({ id: 'validator', status: 'skipped', detail: outVal.reason ?? srcVal.reason ?? 'Khronos validator did not run.' });
  } else {
    /** @param {any} v */
    const errorCounts = (v) => {
      /** @type {Record<string, number>} */ const m = {};
      for (const i of v.issues) if (i.severity === 'error') m[i.code] = (m[i.code] ?? 0) + 1;
      return m;
    };
    const a = errorCounts(srcVal); const b = errorCounts(outVal);
    const fresh = Object.entries(b).filter(([code, n]) => n > (a[code] ?? 0)).map(([code, n]) => `${code} ×${n - (a[code] ?? 0)}`);
    add('validator', fresh.length === 0, fresh.length
      ? `New validator errors in output: ${fresh.join(', ')}`
      : `No new validator errors (source ${srcVal.numErrors} error(s)/${srcVal.numWarnings} warning(s), output ${outVal.numErrors} error(s)/${outVal.numWarnings} warning(s)).`);
  }

  // Animations.
  const animProblems = [];
  if (src.animations.length !== out.animations.length) animProblems.push(`count ${src.animations.length} → ${out.animations.length}`);
  for (const a of src.animations) {
    const b = out.animations.find((/** @type {any} */ x) => x.name === a.name);
    if (!b) { animProblems.push(`clip "${a.name}" missing`); continue; }
    if (Math.abs(a.duration - b.duration) > VERIFY_DEFAULTS.animationDurationTolerance) animProblems.push(`clip "${a.name}" duration ${a.duration}s → ${b.duration}s`);
    if (a.channels !== b.channels) animProblems.push(`clip "${a.name}" channels ${a.channels} → ${b.channels}`);
    const ta = a.targets.map((/** @type {any} */ t) => `${t.node}.${t.path}`).sort().join('|');
    const tb = b.targets.map((/** @type {any} */ t) => `${t.node}.${t.path}`).sort().join('|');
    if (ta !== tb && !a.targets.some((/** @type {any} */ t) => t.path === 'weights')) animProblems.push(`clip "${a.name}" targets changed (${ta} → ${tb})`);
  }
  add('animations', animProblems.length === 0, animProblems.length ? animProblems.join('; ') : `${src.animations.length} clip(s) preserved: ${src.animations.map((/** @type {any} */ a) => `${a.name} (${a.duration}s)`).join(', ') || 'none'}.`);

  // Materials in use.
  /** @param {any} i */
  const usedNames = (i) => i.materials.filter((/** @type {any} */ m) => m.used).map((/** @type {any} */ m) => m.name ?? '(unnamed)').sort();
  const ma = usedNames(src); const mb = usedNames(out);
  const missingMat = [...new Set(ma)].filter((n) => !mb.includes(n));
  const distinctA = new Set(ma).size; const distinctB = new Set(mb).size;
  add('materials', missingMat.length === 0 && distinctA === distinctB, missingMat.length
    ? `Materials missing in output: ${missingMat.join(', ')}`
    : distinctA !== distinctB ? `Distinct used material names ${distinctA} → ${distinctB}`
      : `${distinctA} used material name(s) preserved (${ma.length} → ${mb.length} material objects; unused/duplicate materials may be pruned or merged).`);

  // Named nodes, hierarchy, extras, transforms.
  const nodeProblems = [];
  /** @type {Map<string, any[]>} */
  const outByName = new Map();
  for (const n of out.namedNodes) { if (!outByName.has(n.name)) outByName.set(n.name, []); /** @type {any[]} */ (outByName.get(n.name)).push(n); }
  /** @type {Map<string, number>} */
  const seen = new Map();
  for (const a of src.namedNodes) {
    const k = seen.get(a.name) ?? 0; seen.set(a.name, k + 1);
    const b = outByName.get(a.name)?.[k];
    if (!b) { nodeProblems.push(`node "${a.name}" missing`); continue; }
    if (a.parent !== b.parent) nodeProblems.push(`node "${a.name}" parent ${a.parent} → ${b.parent}`);
    if (stable(a.extras) !== stable(b.extras)) nodeProblems.push(`node "${a.name}" extras changed`);
    const scaleRef = Math.max(1e-9, ...a.worldMatrix.map(Math.abs));
    const drift = Math.max(...a.worldMatrix.map((/** @type {number} */ v, /** @type {number} */ i) => Math.abs(v - b.worldMatrix[i]))) / scaleRef;
    if (drift > VERIFY_DEFAULTS.transformTolerance) nodeProblems.push(`node "${a.name}" world transform drifted (${drift.toExponential(2)})`);
  }
  add('named-nodes', nodeProblems.length === 0, nodeProblems.length ? nodeProblems.slice(0, 12).join('; ') : `${src.namedNodes.length} named node(s) preserved with parents, extras and transforms.`);

  // Vertex attributes, skins, morph targets.
  const attrProblems = [];
  for (const a of src.namedNodes.filter((/** @type {any} */ n) => n.hasMesh)) {
    const srcMesh = src.meshes[a.mesh];
    const candidates = out.meshes.filter((/** @type {any} */ m) => m.name === srcMesh.name);
    if (srcMesh.name == null || candidates.length === 0) continue; // unnamed/deduplicated meshes are covered by the global check below
    const lost = srcMesh.attributes.filter((/** @type {string} */ s) => !candidates.some((/** @type {any} */ m) => m.attributes.includes(s)));
    if (lost.length) attrProblems.push(`mesh "${srcMesh.name}" lost ${lost.join(', ')}`);
  }
  /** @param {any} i */
  const allAttrs = (i) => new Set(i.meshes.flatMap((/** @type {any} */ m) => m.attributes));
  const lostGlobal = [...allAttrs(src)].filter((s) => !allAttrs(out).has(s));
  if (lostGlobal.length) attrProblems.push(`attributes lost globally: ${lostGlobal.join(', ')}`);
  if (src.totals.skins !== out.totals.skins) attrProblems.push(`skins ${src.totals.skins} → ${out.totals.skins}`);
  /** @param {any} i */
  const morphs = (i) => i.meshes.reduce((/** @type {number} */ s, /** @type {any} */ m) => s + m.morphTargets * m.instances, 0);
  if (morphs(src) !== morphs(out)) attrProblems.push(`morph targets ${morphs(src)} → ${morphs(out)}`);
  add('attributes', attrProblems.length === 0, attrProblems.length ? attrProblems.join('; ') : `Vertex attributes (${[...allAttrs(src)].join(', ') || 'none'}), ${src.totals.skins} skin(s) and morph targets preserved.`);

  // Bounding box.
  if (!src.bounds || !out.bounds) {
    checks.push({ id: 'bounds', status: src.bounds === out.bounds || (!src.bounds && !out.bounds) ? 'skipped' : 'fail', detail: 'No finite bounds to compare.' });
  } else {
    const diag = src.bounds.diagonal || 1;
    const drift = Math.max(...src.bounds.min.map((/** @type {number} */ v, /** @type {number} */ i) => Math.abs(v - out.bounds.min[i])), ...src.bounds.max.map((/** @type {number} */ v, /** @type {number} */ i) => Math.abs(v - out.bounds.max[i]))) / diag;
    add('bounds', drift <= opts.boundsTolerance, `Bounding box drift ${(drift * 100).toFixed(4)}% of the diagonal (tolerance ${(opts.boundsTolerance * 100).toFixed(2)}%${opts.simplified ? ', simplified' : ''}).`);
  }

  // Triangles.
  const ta = src.totals.renderedTriangles; const tb = out.totals.renderedTriangles;
  if (opts.simplified) add('triangles', tb <= ta, `Rendered triangles ${ta} → ${tb} (simplification requested; must not increase).`);
  else add('triangles', tb === ta, tb === ta ? `Rendered triangles unchanged (${ta}); no simplification ran.` : `Rendered triangles changed ${ta} → ${tb} although no simplification ran.`);

  return checks;
}

/** @param {any} r optimize report */
export function formatOptimizeMarkdown(r) {
  const s = r.summary;
  const L = [];
  L.push(`# Asset optimisation report — ${r.name}`);
  L.push('');
  L.push(`- Result: **${r.ok ? 'verified' : 'VERIFICATION FAILED'}**`);
  L.push(`- Source: \`${r.source.file}\` — ${formatBytes(r.source.bytes)} — sha256 \`${r.source.sha256}\``);
  L.push(`- Output: \`${r.output.file}\` — ${formatBytes(r.output.bytes)} (${formatDelta(r.source.bytes, r.output.bytes)}) — sha256 \`${r.output.sha256}\``);
  L.push(`- Profile: \`${r.profile.name}\` (${r.profile.origin}). ${r.profile.note}`);
  L.push(`- Generated: ${r.generatedAt} by ${r.generator}`);
  L.push(`- Source preserved: ${r.sourcePreserving.unchanged ? 'yes — source hash identical before and after' : 'NO — source hash changed'}. ${r.sourcePreserving.howToRevert}`);
  for (const n of r.notes ?? []) L.push(`- Note — ${n}`);
  L.push('');
  L.push('## Summary');
  L.push('');
  L.push('| Metric | Source | Output | Change |');
  L.push('| --- | ---: | ---: | ---: |');
  /** @param {string} label @param {any} d @param {(n: number) => string} [f] */
  const row = (label, d, f = (n) => n.toLocaleString('en-US')) => L.push(`| ${label} | ${f(d.before)} | ${f(d.after)} | ${d.percent == null ? 'n/a' : `${d.percent > 0 ? '+' : ''}${d.percent}%`} |`);
  row('File size', s.bytes, formatBytes);
  row('Triangles (rendered, incl. instances)', s.triangles);
  row('Triangles (unique mesh data)', s.uniqueMeshTriangles);
  row('Vertices', s.vertices);
  row('Meshes', s.meshes);
  row('Materials', s.materials);
  row('Textures', s.textures);
  row('Texture bytes (encoded)', s.textureBytes, formatBytes);
  row('GPU texture memory (estimate)', s.gpuTextureBytesEstimate, formatBytes);
  row('Draw calls (estimate)', s.drawCallsEstimate);
  row('Animations', s.animations);
  L.push('');
  L.push('## Steps');
  L.push('');
  L.push('| Step | Status | Vertices (unique) | Triangles (rendered) | Accessor bytes | Texture bytes | Notes |');
  L.push('| --- | --- | ---: | ---: | ---: | ---: | --- |');
  for (const st of r.steps) {
    const note = st.status === 'skipped' ? st.reason : st.detail ? summariseDetail(st.detail) : '';
    L.push(`| ${st.id} | ${st.status} | ${st.before.vertices.toLocaleString('en-US')} → ${st.after.vertices.toLocaleString('en-US')} | ${st.before.triangles.toLocaleString('en-US')} → ${st.after.triangles.toLocaleString('en-US')} | ${formatBytes(st.before.accessorBytes)} → ${formatBytes(st.after.accessorBytes)} | ${formatBytes(st.before.textureBytes)} → ${formatBytes(st.after.textureBytes)} | ${String(note ?? '').replace(/\|/g, '\\|')} |`);
  }
  L.push('');
  L.push('Accessor bytes are in-memory sizes before mesh compression; compression is applied while writing the GLB.');
  if (r.textures.length) {
    L.push('');
    L.push('## Textures');
    L.push('');
    L.push('| Texture | Slots | Colour space | Before | After | Action |');
    L.push('| --- | --- | --- | --- | --- | --- |');
    for (const t of r.textures) {
      L.push(`| ${t.name} | ${t.slots.join(', ') || 'unused'} | ${t.colorSpace} | ${t.from.mimeType} ${t.from.width}×${t.from.height} ${formatBytes(t.from.bytes)} | ${t.to.mimeType} ${t.to.width}×${t.to.height} ${formatBytes(t.to.bytes)} | ${t.action}${t.note ? ` (${t.note})` : ''}${t.reason ? ` — ${t.reason}` : ''}; rule: max ${t.rule.maxSize ?? '∞'} px, q${t.rule.quality}${t.rule.lossless ? ', lossless' : ''} |`);
    }
  }
  L.push('');
  L.push('## Verification');
  L.push('');
  for (const c of r.verification.checks) L.push(`- ${c.status === 'pass' ? '✔' : c.status === 'skipped' ? '○ skipped' : '✖ FAILED'} **${c.id}** — ${c.detail}`);
  if (r.budgets.length) {
    L.push('');
    L.push('## Budgets (from the profile)');
    L.push('');
    for (const b of r.budgets) L.push(`- ${b.ok ? '✔' : '✖ over budget'} ${b.budget}: ${b.actual.toLocaleString('en-US')} (limit ${b.limit.toLocaleString('en-US')})`);
  }
  L.push('');
  L.push('## Consumer requirements');
  L.push('');
  if (!r.decoderRequirements.length) L.push('- No decoder or special runtime support required.');
  for (const d of r.decoderRequirements) L.push(`- \`${d.extension}\`${d.required ? ' (required)' : ''}: ${d.needs ? `needs ${d.needs}. three.js: \`${d.three}\`` : d.note}`);
  if (r.backups.length) {
    L.push('');
    L.push('## Backups (--force)');
    L.push('');
    for (const b of r.backups) L.push(`- \`${b.file}\` → \`${b.backup}\``);
  }
  if (r.warnings.length) {
    L.push('');
    L.push('## Warnings from tools');
    L.push('');
    for (const w of r.warnings) L.push(`- ${w}`);
  }
  L.push('');
  return L.join('\n');
}

/** @param {any} d */
function summariseDetail(d) {
  const parts = [];
  for (const [k, v] of Object.entries(d)) {
    if (k === 'note' || k === 'notes') continue;
    if (v && typeof v === 'object') parts.push(`${k}: ${JSON.stringify(v)}`);
    else parts.push(`${k}: ${v}`);
  }
  if (Array.isArray(d.notes)) parts.push(...d.notes);
  return parts.join('; ');
}
