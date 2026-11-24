// @ts-check
/** Shared helpers for Visual Director (Node side). */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { importDep, PLUGIN_ROOT, TOOLS_DIR } from '../lib/resolve.mjs';

export const TOOL = 'maquettekit-visual-director';

export function toolVersion() {
  for (const p of [path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), path.join(TOOLS_DIR, 'package.json')]) {
    try { const v = JSON.parse(fs.readFileSync(p, 'utf8')).version; if (v) return String(v); } catch { /* next */ }
  }
  return '0.0.0';
}

/** @param {string} route */
export function routeSlug(route) {
  const s = route.replace(/[?#].*$/, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'root';
}

/** @param {string} s */
export function nameSlug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'state';
}

/** Stable identity of an issue across passes. @param {{check:string, route?:string, viewport?:string, selector?:string, key?:string}} i */
export function fingerprint(i) {
  return [i.check, i.route ?? '', i.viewport ?? '', i.selector ?? '', i.key ?? ''].join('|');
}

/** @param {string} fp */
export function issueId(fp) {
  return 'vd-' + crypto.createHash('sha1').update(fp).digest('hex').slice(0, 10);
}

/** @param {number[]} xs */
export function median(xs) { return percentile(xs, 0.5); }

/** @param {number[]} xs @param {number} p 0..1 */
export function percentile(xs, p) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1));
  return s[i];
}

/** @param {number} n @param {number} [d] */
export function round(n, d = 2) { const f = 10 ** d; return Math.round(n * f) / f; }

/** @param {string} file @param {any} [fallback] */
export function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

/** @param {string} file @param {any} data */
export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

/** @param {number} ms */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** @param {number} bytes */
export function fmtBytes(bytes) {
  if (bytes == null || !Number.isFinite(bytes)) return 'n/a';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${round(bytes / 1024, 1)} KB`;
  return `${round(bytes / 1024 / 1024, 2)} MB`;
}

/** Load pngjs + pixelmatch lazily through the optional-dependency resolver. */
export async function loadPngTools() {
  const pngjs = await importDep('pngjs', 'PNG decoding for pixel comparison');
  const pm = await importDep('pixelmatch', 'pixel comparison');
  const PNG = pngjs.PNG ?? pngjs.default?.PNG;
  const pixelmatch = typeof pm.default === 'function' ? pm.default : pm;
  return { PNG, pixelmatch };
}

/**
 * Copy a decoded PNG onto a white canvas of the given size (top-left anchored).
 * @param {any} PNG @param {{width:number,height:number,data:Buffer}} img @param {number} width @param {number} height
 */
export function padPng(PNG, img, width, height) {
  if (img.width === width && img.height === height) return img;
  const out = new PNG({ width, height });
  out.data.fill(255);
  for (let y = 0; y < img.height; y++) {
    img.data.copy(out.data, y * width * 4, y * img.width * 4, (y + 1) * img.width * 4);
  }
  return out;
}

/**
 * Pixel-diff two PNG buffers; different sizes are padded to the max of both.
 * @param {{PNG:any, pixelmatch:Function}} tools @param {Buffer} a @param {Buffer} b @param {number} [threshold]
 */
export function diffPngBuffers(tools, a, b, threshold = 0.1) {
  const { PNG, pixelmatch } = tools;
  const ia = PNG.sync.read(a);
  const ib = PNG.sync.read(b);
  const width = Math.max(ia.width, ib.width);
  const height = Math.max(ia.height, ib.height);
  const pa = padPng(PNG, ia, width, height);
  const pb = padPng(PNG, ib, width, height);
  const diff = new PNG({ width, height });
  const changed = pixelmatch(pa.data, pb.data, diff.data, width, height, { threshold });
  return {
    width, height, changedPixels: changed, ratio: changed / (width * height),
    sizeChanged: ia.width !== ib.width || ia.height !== ib.height,
    sizes: { a: { width: ia.width, height: ia.height }, b: { width: ib.width, height: ib.height } },
    diff, a: pa, b: pb,
  };
}

/** List files recursively (relative, forward slashes). @param {string} dir @param {(f:string)=>boolean} [filter] */
export function listFiles(dir, filter) {
  /** @type {string[]} */
  const out = [];
  const walk = (d, rel) => {
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(d, e.name), r);
      else if (!filter || filter(r)) out.push(r);
    }
  };
  walk(dir, '');
  return out.sort();
}

export const SEVERITIES = ['critical', 'major', 'minor', 'info'];

/** @param {{severity:string}[]} issues */
export function summarize(issues) {
  const s = { critical: 0, major: 0, minor: 0, info: 0 };
  for (const i of issues) if (i.severity in s) s[i.severity]++;
  return s;
}

/** Existing pass numbers in a review directory, ascending. @param {string} outDir */
export function listPasses(outDir) {
  let entries = [];
  try { entries = fs.readdirSync(outDir); } catch { return []; }
  return entries.map((e) => /^pass-(\d+)$/.exec(e)).filter(Boolean).map((m) => Number(/** @type {RegExpExecArray} */ (m)[1]))
    .filter((n) => fs.existsSync(path.join(outDir, `pass-${n}`, 'report.json'))).sort((a, b) => a - b);
}
