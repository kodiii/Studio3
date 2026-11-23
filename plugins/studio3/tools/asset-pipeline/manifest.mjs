// @ts-check
/**
 * Asset manifest: one JSON document describing every delivery variant of an
 * asset so a viewer can pick a variant per device and know which decoders it needs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { UserError } from '../lib/log.mjs';
import { GENERATOR, sha256File } from './io.mjs';
import { inspectFile } from './inspect.mjs';
import { decoderRequirements } from './optimize.mjs';
import { PROFILE_ORDER } from './profiles.mjs';

export const MANIFEST_SCHEMA_VERSION = 1;

/** @param {string} from directory @param {string} to file */
const relPosix = (from, to) => path.relative(from, to).split(path.sep).join('/');

/** @param {string[]} used */
function compressionOf(used) {
  if (used.includes('EXT_meshopt_compression')) return 'meshopt';
  if (used.includes('KHR_draco_mesh_compression')) return 'draco';
  return 'none';
}

/**
 * @param {string} profile @param {any} inspect inspect report of the variant file @param {string} baseDir
 */
export function variantEntry(profile, inspect, baseDir) {
  return {
    profile,
    file: relPosix(baseDir, inspect.path),
    bytes: inspect.fileBytes,
    sha256: inspect.sha256 ?? sha256File(inspect.path),
    triangles: inspect.totals.renderedTriangles,
    vertices: inspect.totals.vertices,
    drawCallsEstimate: inspect.totals.drawCallsEstimate,
    textures: inspect.textures.map((/** @type {any} */ t) => ({ w: t.width, h: t.height, mime: t.mimeType, bytes: t.bytes, slots: t.slots })),
    gpuTextureBytesEstimate: inspect.totals.gpuTextureBytesEstimate,
    extensionsUsed: inspect.extensionsUsed,
    extensionsRequired: inspect.extensionsRequired,
    compression: compressionOf(inspect.extensionsUsed),
    decoders: decoderRequirements(inspect.extensionsUsed, inspect.extensionsRequired).filter((d) => d.needs).map((d) => d.needs),
  };
}

/**
 * @param {{ id: string, baseDir: string, source: { path: string, sha256: string, bytes: number } | { file: string, sha256: string | null, bytes: number | null, note?: string } | null,
 *   variants: { profile: string, inspect: any }[], thumbnail?: string | null, fallbackImage?: string | null }} o
 */
export function assetEntry(o) {
  const order = (/** @type {string} */ p) => { const i = PROFILE_ORDER.indexOf(p); return i === -1 ? PROFILE_ORDER.length : i; };
  const variants = [...o.variants].sort((a, b) => order(a.profile) - order(b.profile) || a.profile.localeCompare(b.profile));
  const ref = variants[0]?.inspect;
  /** @type {any} */
  let source = null;
  if (o.source && 'path' in o.source) source = { file: relPosix(o.baseDir, o.source.path), sha256: o.source.sha256, bytes: o.source.bytes };
  else if (o.source) source = o.source;
  /** @type {any} */
  const entry = {
    id: o.id,
    source,
    variants: variants.map((v) => variantEntry(v.profile, v.inspect, o.baseDir)),
  };
  if (o.thumbnail) entry.thumbnail = o.thumbnail;
  if (o.fallbackImage) entry.fallbackImage = o.fallbackImage;
  entry.animations = ref ? ref.animations.map((/** @type {any} */ a) => a.name).filter(Boolean) : [];
  entry.animationClips = ref ? ref.animations.map((/** @type {any} */ a) => ({ name: a.name, duration: a.duration, targets: [...new Set(a.targets.map((/** @type {any} */ t) => t.node))] })) : [];
  entry.parts = ref ? ref.namedNodes.map((/** @type {any} */ n) => n.name) : [];
  entry.materials = ref ? [...new Set(ref.materials.map((/** @type {any} */ m) => m.name).filter(Boolean))] : [];
  entry.bounds = ref?.bounds ? { min: ref.bounds.min, max: ref.bounds.max, size: ref.bounds.size, center: ref.bounds.center } : null;
  return entry;
}

/** @param {any[]} assets */
export function manifestDocument(assets) {
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    generator: GENERATOR,
    generatedAt: new Date().toISOString(),
    notes: {
      triangles: 'Triangles rendered per frame, counting every instance of shared meshes. vertices = unique vertices uploaded.',
      gpuTextureBytesEstimate: 'Estimate: uncompressed RGBA8 with mip chain.',
      drawCallsEstimate: 'Estimate: primitives × instances.',
      paths: 'All file paths are relative to this manifest.',
    },
    assets,
  };
}

/**
 * Split "<id>.<profile>.glb" → { id, profile }. Files without a profile segment get profile "default".
 * @param {string} fileName
 */
export function parseVariantName(fileName) {
  const base = fileName.replace(/\.glb$/i, '');
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return { id: base, profile: 'default' };
  return { id: base.slice(0, dot), profile: base.slice(dot + 1) };
}

/**
 * Scan a directory of GLBs and build a manifest.
 * Source lookup per asset id, in order: `<id>.source.glb` in the directory;
 * `<id>.source.glb` / `<id>.glb` / `<id>.gltf` in `sourceDir`; the source recorded
 * in an existing `<id>.manifest.json` or `<id>*.report.json` (marked `fromReport`).
 * @param {string} dir @param {{ sourceDir?: string, manifestDir?: string }} [opts]
 */
export async function scanDirectory(dir, opts = {}) {
  const abs = path.resolve(dir);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) throw new UserError(`Not a directory: ${abs}`);
  const baseDir = path.resolve(opts.manifestDir ?? abs);
  const files = fs.readdirSync(abs).filter((f) => /\.glb$/i.test(f)).sort();
  if (!files.length) throw new UserError(`No .glb files found in ${abs}.`);
  /** @type {Map<string, { profile: string, inspect: any }[]>} */
  const groups = new Map();
  /** @type {Map<string, string>} */
  const localSources = new Map();
  for (const f of files) {
    const { id, profile } = parseVariantName(f);
    if (profile === 'source') { localSources.set(id, path.join(abs, f)); continue; }
    const inspect = await inspectFile(path.join(abs, f));
    if (!groups.has(id)) groups.set(id, []);
    /** @type {any[]} */ (groups.get(id)).push({ profile, inspect });
  }
  const assets = [];
  for (const [id, variants] of groups) {
    /** @type {any} */
    let source = null;
    const candidates = [localSources.get(id)];
    if (opts.sourceDir) for (const n of [`${id}.source.glb`, `${id}.glb`, `${id}.source.gltf`, `${id}.gltf`]) candidates.push(path.resolve(opts.sourceDir, n));
    const found = candidates.find((c) => c && fs.existsSync(c) && !variants.some((v) => v.inspect.path === c));
    if (found) source = { path: found, sha256: sha256File(found), bytes: fs.statSync(found).size };
    else {
      for (const n of [`${id}.manifest.json`, `${id}.variants.report.json`, ...variants.map((v) => `${id}.${v.profile}.report.json`), `${id}.report.json`]) {
        const p = path.join(abs, n);
        if (!fs.existsSync(p)) continue;
        try {
          const j = JSON.parse(fs.readFileSync(p, 'utf8'));
          const s = j.source ?? j.assets?.find((/** @type {any} */ a) => a.id === id)?.source;
          if (s?.sha256) {
            const srcAbs = path.resolve(abs, s.file);
            source = { file: relPosix(baseDir, srcAbs), sha256: s.sha256, bytes: s.bytes ?? null, fromReport: n };
            break;
          }
        } catch { /* ignore unreadable report */ }
      }
    }
    const png = path.join(abs, `${id}.png`); const webp = path.join(abs, `${id}.webp`);
    const thumbnail = fs.existsSync(png) ? relPosix(baseDir, png) : null;
    const fallbackImage = fs.existsSync(webp) ? relPosix(baseDir, webp) : thumbnail;
    assets.push(assetEntry({ id, baseDir, source, variants, thumbnail, fallbackImage }));
  }
  return manifestDocument(assets);
}
