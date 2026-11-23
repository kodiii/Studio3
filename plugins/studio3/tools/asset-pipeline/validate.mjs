// @ts-check
/**
 * `studio3 assets validate` — Khronos glTF-Validator plus Studio³ delivery checks.
 */
import fs from 'node:fs';
import path from 'node:path';
import { resolveDep, importDep, depVersion } from '../lib/resolve.mjs';
import { loadGltfTransform, readDocument, readGltfJson, DECODER_EXTENSIONS } from './io.mjs';

const SEVERITY = ['error', 'warning', 'info', 'hint'];

/**
 * Heuristic defaults for the "absurd scale" check (glTF units are metres).
 * These are labelled defaults, not universal limits — override per call.
 */
export const SCALE_DEFAULTS = { minSize: 0.001, maxSize: 1000 };

/**
 * Run the Khronos validator on raw bytes.
 * @param {Uint8Array} bytes
 * @param {{ uri?: string, baseDir?: string }} [opts]
 * @returns {Promise<any>}
 */
export async function runKhronosValidator(bytes, opts = {}) {
  if (!resolveDep('gltf-validator')) {
    return { status: 'skipped', reason: 'gltf-validator is not installed (run "studio3 setup" or npm install -D gltf-validator).' };
  }
  const mod = await importDep('gltf-validator', 'glTF validation');
  const validator = mod.validateBytes ? mod : mod.default;
  try {
    const report = await validator.validateBytes(bytes, {
      uri: opts.uri ?? 'model.glb',
      maxIssues: 0,
      writeTimestamp: false,
      externalResourceFunction: (/** @type {string} */ uri) => new Promise((resolve, reject) => {
        if (!opts.baseDir) { reject(new Error('external resources unavailable')); return; }
        const p = path.resolve(opts.baseDir, decodeURIComponent(uri));
        fs.readFile(p, (err, data) => (err ? reject(err.toString()) : resolve(new Uint8Array(data))));
      }),
    });
    const issues = (report.issues?.messages ?? []).map((/** @type {any} */ m) => ({
      source: 'gltf-validator', code: m.code, severity: SEVERITY[m.severity] ?? String(m.severity), message: m.message, pointer: m.pointer ?? null,
    }));
    return {
      status: 'ran', version: report.validatorVersion ?? depVersion('gltf-validator'),
      numErrors: report.issues?.numErrors ?? 0, numWarnings: report.issues?.numWarnings ?? 0,
      numInfos: report.issues?.numInfos ?? 0, numHints: report.issues?.numHints ?? 0,
      truncated: !!report.issues?.truncated, issues, info: report.info ?? null,
    };
  } catch (err) {
    // The validator rejects when the input is not parseable at all.
    return {
      status: 'ran', version: depVersion('gltf-validator'), numErrors: 1, numWarnings: 0, numInfos: 0, numHints: 0, truncated: false,
      issues: [{ source: 'gltf-validator', code: 'INVALID_FILE', severity: 'error', message: String(/** @type {any} */ (err)?.message ?? err), pointer: null }],
      info: null,
    };
  }
}

/** @param {number} n */
const isPot = (n) => n > 0 && (n & (n - 1)) === 0;

/**
 * Studio³ checks that complement the Khronos validator.
 * @param {string} file absolute path
 * @param {{ scale?: { minSize?: number, maxSize?: number } }} [opts]
 * @returns {Promise<{ status: string, reason?: string, issues: any[] }>}
 */
export async function runOwnChecks(file, opts = {}) {
  /** @type {any[]} */
  const issues = [];
  /** @param {string} code @param {string} severity @param {string} message @param {string | null} [pointer] */
  const add = (code, severity, message, pointer = null) => issues.push({ source: 'studio3', code, severity, message, pointer });

  let json;
  try { json = readGltfJson(file); }
  catch (err) { return { status: 'skipped', reason: `File is not parseable as glTF: ${/** @type {any} */ (err).message}`, issues }; }

  // 1. Missing external resources (checked on the raw JSON so a broken reference is reported, not thrown).
  const baseDir = path.dirname(file);
  let missing = 0;
  for (const [kind, list] of /** @type {[string, any[]][]} */ ([['buffers', json.buffers ?? []], ['images', json.images ?? []]])) {
    list.forEach((entry, i) => {
      const uri = entry?.uri;
      if (typeof uri !== 'string' || uri.startsWith('data:')) return;
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(uri)) { add('EXTERNAL_RESOURCE_REMOTE', 'warning', `${kind}[${i}] references a remote URI (${uri}); it is not fetched or checked.`, `/${kind}/${i}/uri`); return; }
      const p = path.resolve(baseDir, decodeURIComponent(uri));
      if (!fs.existsSync(p)) { missing++; add('MISSING_EXTERNAL_RESOURCE', 'error', `${kind}[${i}] references "${uri}", which does not exist next to the file.`, `/${kind}/${i}/uri`); }
    });
  }

  // 2. Extensions that require a decoder on the consumer side.
  const used = Array.isArray(json.extensionsUsed) ? json.extensionsUsed : [];
  const required = Array.isArray(json.extensionsRequired) ? json.extensionsRequired : [];
  for (const ext of used) {
    const d = /** @type {Record<string, any>} */ (DECODER_EXTENSIONS)[ext];
    if (d) add('REQUIRES_DECODER', 'info', `${ext}${required.includes(ext) ? ' (required)' : ''}: consumers need ${d.decoder}. three.js: ${d.three}`, '/extensionsUsed');
  }

  if (missing) return { status: 'partial', reason: 'Document-level checks skipped: external resources are missing.', issues };

  let document;
  try { ({ document } = await readDocument(file)); }
  catch (err) { return { status: 'partial', reason: `Document-level checks skipped: ${/** @type {any} */ (err).message.split('\n')[0]}`, issues }; }
  const { functions } = await loadGltfTransform();
  const root = document.getRoot();

  // 3. Non-power-of-two textures (info: fine in WebGL2/WebGPU, restricts mipmaps/wrapping in WebGL1).
  root.listTextures().forEach((/** @type {any} */ t, /** @type {number} */ i) => {
    const size = t.getSize();
    if (size && (!isPot(size[0]) || !isPot(size[1]))) add('TEXTURE_NPOT', 'info', `Texture "${t.getName() || t.getURI() || i}" is ${size[0]}×${size[1]} (not power-of-two): fine in WebGL2/WebGPU, limits mipmapping and repeat wrapping in WebGL1.`, `/textures/${i}`);
  });

  // 4. Unused data.
  /** @param {any} p */
  const onlyRoot = (p) => p.listParents().every((/** @type {any} */ x) => x.propertyType === 'Root');
  const unused = {
    accessors: root.listAccessors().filter(onlyRoot).length,
    meshes: root.listMeshes().filter(onlyRoot).length,
    materials: root.listMaterials().filter(onlyRoot).length,
    textures: root.listTextures().filter(onlyRoot).length,
    nodes: root.listNodes().filter((/** @type {any} */ n) => functions.listNodeScenes(n).length === 0).length,
  };
  for (const [kind, count] of Object.entries(unused)) {
    if (count) add('UNUSED_DATA', 'info', `${count} unused ${kind} (not reachable from any scene or primitive); "assets optimize" prunes them.`, `/${kind}`);
  }

  // 5. Normals / tangents / UV sets.
  root.listMeshes().forEach((/** @type {any} */ mesh, /** @type {number} */ mi) => {
    mesh.listPrimitives().forEach((/** @type {any} */ prim, /** @type {number} */ pi) => {
      const pointer = `/meshes/${mi}/primitives/${pi}`;
      const label = `Mesh "${mesh.getName() || mi}" primitive ${pi}`;
      const mode = prim.getMode();
      const isTri = mode >= 4;
      const material = prim.getMaterial();
      if (isTri && !prim.getAttribute('NORMAL')) add('MISSING_NORMALS', 'warning', `${label} has no NORMAL attribute; engines fall back to flat shading computed at runtime.`, pointer);
      if (material?.getNormalTexture()) {
        const tc = material.getNormalTextureInfo()?.getTexCoord() ?? 0;
        if (!prim.getAttribute(`TEXCOORD_${tc}`)) add('NORMAL_MAP_WITHOUT_UV', 'error', `${label} uses a normal map (material "${material.getName()}") but has no TEXCOORD_${tc}.`, pointer);
        else if (!prim.getAttribute('TANGENT')) add('MISSING_TANGENTS', 'info', `${label} uses a normal map without TANGENT; runtimes derive tangents (screen-space derivatives in three.js), which can differ from the bake tangent basis.`, pointer);
      }
      const uvSets = prim.listSemantics().filter((/** @type {string} */ s) => s.startsWith('TEXCOORD_'));
      if (uvSets.length > 1) add('MULTIPLE_UV_SETS', 'info', `${label} has ${uvSets.length} UV sets (${uvSets.join(', ')}); make sure the viewer's materials use the intended set.`, pointer);
    });
  });
  root.listMaterials().forEach((/** @type {any} */ m, /** @type {number} */ i) => {
    const infos = functions.listTextureInfoByMaterial(m);
    const sets = [...new Set(infos.map((/** @type {any} */ t) => t.getTexCoord()))].filter((/** @type {number} */ s) => s > 0);
    if (sets.length) add('MATERIAL_USES_SECONDARY_UV', 'info', `Material "${m.getName() || i}" samples UV set(s) ${sets.join(', ')} in addition to TEXCOORD_0.`, `/materials/${i}`);
  });

  // 6. Empty nodes.
  const jointSet = new Set(root.listSkins().flatMap((/** @type {any} */ s) => s.listJoints()));
  const animated = new Set(root.listAnimations().flatMap((/** @type {any} */ a) => a.listChannels().map((/** @type {any} */ c) => c.getTargetNode())));
  root.listNodes().forEach((/** @type {any} */ n, /** @type {number} */ i) => {
    const empty = !n.getMesh() && !n.getCamera() && !n.getSkin() && n.listChildren().length === 0 && n.listExtensions().length === 0
      && !jointSet.has(n) && !animated.has(n) && Object.keys(n.getExtras() ?? {}).length === 0;
    if (empty) add('EMPTY_NODE', 'info', `Node "${n.getName() || i}" is an empty leaf (no mesh, camera, children or extras). Kept by the optimizer when named.`, `/nodes/${i}`);
    const s = n.getScale();
    if (s.some((/** @type {number} */ v) => v === 0)) add('NODE_ZERO_SCALE', 'warning', `Node "${n.getName() || i}" has a zero scale component [${s.join(', ')}].`, `/nodes/${i}/scale`);
    else if (s[0] * s[1] * s[2] < 0) add('NODE_NEGATIVE_SCALE', 'info', `Node "${n.getName() || i}" has a mirroring (negative determinant) scale; winding is flipped at runtime.`, `/nodes/${i}/scale`);
  });

  // 7. Absurd scale (heuristic default thresholds, glTF unit = metre).
  const limits = { ...SCALE_DEFAULTS, ...(opts.scale ?? {}) };
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  if (scene) {
    const b = functions.getBounds(scene);
    if (b.min.every(Number.isFinite) && b.max.every(Number.isFinite)) {
      const maxDim = Math.max(...b.max.map((/** @type {number} */ v, /** @type {number} */ i) => v - b.min[i]));
      if (maxDim > limits.maxSize) add('ABSURD_SCALE', 'warning', `Scene is ${maxDim.toPrecision(4)} units across; glTF units are metres (default heuristic limit ${limits.maxSize} m — likely exported in mm/cm).`, '/scenes');
      else if (maxDim > 0 && maxDim < limits.minSize) add('ABSURD_SCALE', 'warning', `Scene is only ${maxDim.toPrecision(4)} m across (default heuristic limit ${limits.minSize} m — check export units).`, '/scenes');
    }
  }

  return { status: 'ran', issues };
}

/**
 * Validate a file with both layers.
 * @param {string} file absolute path
 * @param {{ strict?: boolean }} [opts]
 */
export async function validateFile(file, opts = {}) {
  const bytes = new Uint8Array(fs.readFileSync(file));
  const khronos = await runKhronosValidator(bytes, { uri: path.basename(file), baseDir: path.dirname(file) });
  const own = await runOwnChecks(file);
  const issues = [...(khronos.issues ?? []), ...own.issues];
  /** @param {string} s */
  const count = (s) => issues.filter((i) => i.severity === s).length;
  const summary = { errors: count('error'), warnings: count('warning'), infos: count('info'), hints: count('hint') };
  const ok = summary.errors === 0 && (!opts.strict || summary.warnings === 0);
  return {
    file: path.basename(file), path: file, strict: !!opts.strict, ok, summary,
    validator: { status: khronos.status, reason: khronos.reason, version: khronos.version, numErrors: khronos.numErrors, numWarnings: khronos.numWarnings, numInfos: khronos.numInfos, numHints: khronos.numHints, truncated: khronos.truncated },
    checks: { status: own.status, reason: own.reason },
    issues,
  };
}

/** @param {any} r */
export function formatValidate(r) {
  const L = [];
  L.push(`${r.file}: ${r.ok ? 'OK' : 'FAILED'} — ${r.summary.errors} error(s), ${r.summary.warnings} warning(s), ${r.summary.infos} info(s), ${r.summary.hints} hint(s)${r.strict ? ' [strict]' : ''}`);
  L.push(`  Khronos glTF-Validator: ${r.validator.status}${r.validator.version ? ` (${r.validator.version})` : ''}${r.validator.reason ? ` — ${r.validator.reason}` : ''}`);
  L.push(`  Studio³ checks: ${r.checks.status}${r.checks.reason ? ` — ${r.checks.reason}` : ''}`);
  const order = ['error', 'warning', 'info', 'hint'];
  const sorted = [...r.issues].sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
  // Collapse repeated codes so thousands of identical hints stay readable.
  /** @type {Map<string, any[]>} */
  const groups = new Map();
  for (const i of sorted) { const k = `${i.severity}|${i.source}|${i.code}`; if (!groups.has(k)) groups.set(k, []); /** @type {any[]} */ (groups.get(k)).push(i); }
  for (const list of groups.values()) {
    const first = list[0];
    L.push(`  ${first.severity.toUpperCase().padEnd(7)} ${first.code} [${first.source}]${list.length > 1 ? ` ×${list.length}` : ''}`);
    for (const i of list.slice(0, 3)) L.push(`      ${i.message}${i.pointer ? `  @ ${i.pointer}` : ''}`);
    if (list.length > 3) L.push(`      … ${list.length - 3} more (use --json for all)`);
  }
  return L.join('\n');
}
