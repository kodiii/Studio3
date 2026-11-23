// @ts-check
/**
 * Shared glTF I/O for the Studio³ 3D Asset Pipeline.
 * Every heavy dependency is resolved lazily through lib/resolve.mjs so the
 * installed plugin (no node_modules) fails with an actionable message instead
 * of crashing at import time.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { importDep, resolveDep, depVersion } from '../lib/resolve.mjs';
import { UserError } from '../lib/log.mjs';

export const GENERATOR = 'Studio³ Asset Pipeline';

/** Extensions whose payload needs a decoder on the consumer side. */
export const DECODER_EXTENSIONS = {
  EXT_meshopt_compression: {
    decoder: 'MeshoptDecoder',
    three: "import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'; gltfLoader.setMeshoptDecoder(MeshoptDecoder)",
  },
  KHR_draco_mesh_compression: {
    decoder: 'Draco decoder (WASM)',
    three: "import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'; gltfLoader.setDRACOLoader(new DRACOLoader().setDecoderPath('/draco/gltf/'))",
  },
  KHR_texture_basisu: {
    decoder: 'Basis Universal transcoder (WASM)',
    three: "import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'; gltfLoader.setKTX2Loader(new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer))",
  },
};

/** Extensions that need runtime support but no separate decoder module. */
export const SUPPORT_NOTES = {
  KHR_mesh_quantization: 'No decoder needed; supported natively by three.js GLTFLoader and all major engines.',
  EXT_texture_webp: 'No decoder module; requires WebP image decoding in the runtime (all current browsers).',
  EXT_texture_avif: 'No decoder module; requires AVIF image decoding in the runtime.',
};

/** @param {string} file */
export function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** @param {Uint8Array} bytes */
export function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

/**
 * Resolve and check an input model path.
 * @param {string | undefined} file
 * @param {string[]} [exts]
 */
export function resolveInput(file, exts = ['.glb', '.gltf']) {
  if (!file || typeof file !== 'string') throw new UserError(`Missing input file (expected ${exts.join(' or ')}).`);
  const abs = path.resolve(file);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) throw new UserError(`Input file not found: ${abs}`);
  const ext = path.extname(abs).toLowerCase();
  if (!exts.includes(ext)) throw new UserError(`Unsupported input "${path.basename(abs)}" — expected ${exts.join(', ')}.`);
  return abs;
}

/**
 * Read the JSON part of a .glb/.gltf without any dependency.
 * @param {string} file
 * @returns {any}
 */
export function readGltfJson(file) {
  const buf = fs.readFileSync(file);
  if (buf.length >= 20 && buf.readUInt32LE(0) === 0x46546c67) {
    const len = buf.readUInt32LE(12);
    const type = buf.readUInt32LE(16);
    if (type !== 0x4e4f534a) throw new UserError(`${path.basename(file)}: first GLB chunk is not JSON.`);
    return JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
  }
  return JSON.parse(buf.toString('utf8'));
}

/** Logger that swallows output (stdout must stay machine readable) and keeps warnings. */
function createCaptureLogger() {
  /** @type {string[]} */
  const warnings = [];
  return {
    warnings,
    debug() {}, info() {},
    /** @param {string} m */ warn(m) { warnings.push(String(m)); },
    /** @param {string} m */ error(m) { warnings.push(`error: ${String(m)}`); },
  };
}

/** @type {Promise<any> | null} */
let libs = null;
/** Load the gltf-transform packages once. */
export function loadGltfTransform() {
  libs ??= (async () => {
    const core = await importDep('@gltf-transform/core', '3D asset processing');
    const extensions = await importDep('@gltf-transform/extensions', '3D asset processing');
    const functions = await importDep('@gltf-transform/functions', '3D asset processing');
    return { core, extensions, functions };
  })();
  return libs;
}

/** @returns {Promise<{ MeshoptDecoder: any, MeshoptEncoder: any, MeshoptSimplifier: any } | null>} */
export async function loadMeshopt() {
  if (!resolveDep('meshoptimizer')) return null;
  const m = await importDep('meshoptimizer');
  const mod = m.MeshoptEncoder ? m : m.default;
  await Promise.all([mod.MeshoptDecoder.ready, mod.MeshoptEncoder.ready, mod.MeshoptSimplifier.ready]);
  return mod;
}

/** @returns {Promise<any | null>} sharp factory or null */
export async function loadSharp() {
  if (!resolveDep('sharp')) return null;
  const m = await importDep('sharp');
  return m.default ?? m;
}

/** @type {{ decoder?: any, encoder?: any }} */
const dracoCache = {};
/** @param {'decoder' | 'encoder'} kind */
async function loadDraco(kind) {
  if (dracoCache[kind]) return dracoCache[kind];
  const m = await importDep('draco3dgltf', 'Draco mesh compression');
  const d = m.default ?? m;
  dracoCache[kind] = kind === 'decoder' ? await d.createDecoderModule() : await d.createEncoderModule();
  return dracoCache[kind];
}

/**
 * Create a NodeIO with every known extension, the meshopt codec (when
 * installed) and, on request, the Draco codec.
 * @param {{ dracoDecoder?: boolean, dracoEncoder?: boolean }} [opts]
 */
export async function createIO(opts = {}) {
  const { core, extensions } = await loadGltfTransform();
  const logger = createCaptureLogger();
  const io = new core.NodeIO().registerExtensions(extensions.ALL_EXTENSIONS);
  io.setLogger(/** @type {any} */ (logger));
  /** @type {Record<string, any>} */
  const deps = {};
  const meshopt = await loadMeshopt();
  if (meshopt) { deps['meshopt.decoder'] = meshopt.MeshoptDecoder; deps['meshopt.encoder'] = meshopt.MeshoptEncoder; }
  if (opts.dracoDecoder) deps['draco3d.decoder'] = await loadDraco('decoder');
  if (opts.dracoEncoder) deps['draco3d.encoder'] = await loadDraco('encoder');
  io.registerDependencies(deps);
  return { io, logger, meshopt, core };
}

/**
 * Read a .glb/.gltf into a gltf-transform Document. The file is only read, never written.
 * @param {string} file absolute path
 * @param {{ dracoEncoder?: boolean }} [opts]
 */
export async function readDocument(file, opts = {}) {
  let json;
  try { json = readGltfJson(file); }
  catch (err) { throw new UserError(`${path.basename(file)} is not a readable glTF/GLB file: ${/** @type {any} */ (err).message}`); }
  const used = /** @type {string[]} */ (Array.isArray(json.extensionsUsed) ? json.extensionsUsed : []);
  if (used.includes('EXT_meshopt_compression') && !resolveDep('meshoptimizer')) await importDep('meshoptimizer', 'decoding EXT_meshopt_compression');
  const ctx = await createIO({ dracoDecoder: used.includes('KHR_draco_mesh_compression'), dracoEncoder: opts.dracoEncoder });
  let document;
  try { document = await ctx.io.read(file); }
  catch (err) {
    if (err instanceof UserError) throw err;
    throw new UserError(`Could not parse ${path.basename(file)}: ${/** @type {any} */ (err).message}`);
  }
  document.setLogger(/** @type {any} */ (ctx.logger));
  return { document, json, ...ctx };
}

/** Versions of the tools that produced a result (for reports). */
export function toolVersions() {
  return {
    '@gltf-transform/core': depVersion('@gltf-transform/core'),
    meshoptimizer: depVersion('meshoptimizer'),
    draco3dgltf: depVersion('draco3dgltf'),
    sharp: depVersion('sharp'),
    'gltf-validator': depVersion('gltf-validator'),
  };
}

/** @param {number} n */
export function formatBytes(n) {
  if (!Number.isFinite(n)) return 'n/a';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/** @param {number} before @param {number} after */
export function formatDelta(before, after) {
  if (!before) return 'n/a';
  const pct = ((after - before) / before) * 100;
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
}
