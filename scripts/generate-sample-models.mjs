#!/usr/bin/env node
// @ts-check
/**
 * Generates Studio³'s original sample models (no third-party assets):
 *
 *   assets/models/pulse-speaker.source.glb   "Pulse" — a fictional portable speaker,
 *                                            deliberately heavy to demonstrate the optimizer
 *   assets/models/orbit-token.source.glb     a small faceted token for quick tests
 *
 * Deterministic: seeded PRNG, no timestamps. Run from the repo root:
 *   node scripts/generate-sample-models.mjs [--out assets/models]
 *
 * The part/material/clip names are a contract documented in assets/models/README.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import sharp from 'sharp';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outArg = process.argv.indexOf('--out');
const OUT_DIR = path.resolve(REPO, outArg !== -1 ? process.argv[outArg + 1] : 'assets/models');
const SEED = 0x53747564; // "Stud"

// ───────────────────────────── utilities ─────────────────────────────

/** @param {number} seed */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @typedef {{ positions: Float32Array, normals: Float32Array, uvs: Float32Array | null, indices: Uint32Array | null }} Geo
 */

const clamp = (/** @type {number} */ v, /** @type {number} */ lo, /** @type {number} */ hi) => Math.min(hi, Math.max(lo, v));
const smoothstep = (/** @type {number} */ a, /** @type {number} */ b, /** @type {number} */ x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Remove zero-area triangles (poles of lathed surfaces etc.). @param {Geo} g */
function dropDegenerate(g) {
  if (!g.indices) return g;
  const p = g.positions; const out = [];
  for (let i = 0; i < g.indices.length; i += 3) {
    const a = g.indices[i] * 3; const b = g.indices[i + 1] * 3; const c = g.indices[i + 2] * 3;
    const ux = p[b] - p[a]; const uy = p[b + 1] - p[a + 1]; const uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a]; const vy = p[c + 1] - p[a + 1]; const vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy; const ny = uz * vx - ux * vz; const nz = ux * vy - uy * vx;
    if (nx * nx + ny * ny + nz * nz > 1e-24) out.push(g.indices[i], g.indices[i + 1], g.indices[i + 2]);
  }
  g.indices = new Uint32Array(out);
  return g;
}

/**
 * Area-weighted smooth normals, shared between vertices at the same position
 * (so UV seams and poles shade continuously).
 * @param {Geo} g
 */
function smoothNormals(g) {
  const p = g.positions; const idx = /** @type {Uint32Array} */ (g.indices);
  const count = p.length / 3;
  /** @type {Map<string, number>} */
  const keyToSlot = new Map();
  const slot = new Uint32Array(count);
  for (let i = 0; i < count; i++) {
    const k = `${Math.round(p[i * 3] * 1e7)},${Math.round(p[i * 3 + 1] * 1e7)},${Math.round(p[i * 3 + 2] * 1e7)}`;
    let s = keyToSlot.get(k);
    if (s === undefined) { s = keyToSlot.size; keyToSlot.set(k, s); }
    slot[i] = s;
  }
  const acc = new Float64Array(keyToSlot.size * 3);
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3; const b = idx[i + 1] * 3; const c = idx[i + 2] * 3;
    const ux = p[b] - p[a]; const uy = p[b + 1] - p[a + 1]; const uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a]; const vy = p[c + 1] - p[a + 1]; const vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy; const ny = uz * vx - ux * vz; const nz = ux * vy - uy * vx;
    for (const v of [idx[i], idx[i + 1], idx[i + 2]]) { const s = slot[v] * 3; acc[s] += nx; acc[s + 1] += ny; acc[s + 2] += nz; }
  }
  for (let i = 0; i < count; i++) {
    const s = slot[i] * 3; const l = Math.hypot(acc[s], acc[s + 1], acc[s + 2]) || 1;
    g.normals[i * 3] = acc[s] / l; g.normals[i * 3 + 1] = acc[s + 1] / l; g.normals[i * 3 + 2] = acc[s + 2] / l;
  }
  return g;
}

/**
 * Parametric grid surface. `fn(u, v)` returns position, uv and an orientation
 * hint (roughly "outward"); winding is fixed so normals follow the hint.
 * @param {number} nu @param {number} nv
 * @param {(u: number, v: number) => { p: number[], uv?: number[], hint: number[] }} fn
 * @returns {Geo}
 */
function gridSurface(nu, nv, fn) {
  const count = (nu + 1) * (nv + 1);
  const positions = new Float32Array(count * 3); const normals = new Float32Array(count * 3); const uvs = new Float32Array(count * 2);
  const hints = new Float32Array(count * 3);
  let k = 0;
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const s = fn(i / nu, j / nv);
      positions.set(s.p, k * 3); hints.set(s.hint, k * 3);
      uvs.set(s.uv ?? [i / nu, j / nv], k * 2);
      k++;
    }
  }
  const indices = new Uint32Array(nu * nv * 6);
  let t = 0;
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i; const b = a + 1; const c = a + nu + 1; const d = c + 1;
      indices.set([a, b, d, a, d, c], t); t += 6;
    }
  }
  /** @type {Geo} */
  const g = { positions, normals, uvs, indices };
  dropDegenerate(g);
  // Orientation: majority vote of face normals against the hint.
  let vote = 0; const p = positions; const idx = /** @type {Uint32Array} */ (g.indices);
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3; const b = idx[i + 1] * 3; const c = idx[i + 2] * 3;
    const ux = p[b] - p[a]; const uy = p[b + 1] - p[a + 1]; const uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a]; const vy = p[c + 1] - p[a + 1]; const vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy; const ny = uz * vx - ux * vz; const nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    vote += (nx * hints[a] + ny * hints[a + 1] + nz * hints[a + 2]) / l;
  }
  if (vote < 0) for (let i = 0; i < idx.length; i += 3) { const tmp = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = tmp; }
  return smoothNormals(g);
}

/** @param {THREE.BufferGeometry} geometry @returns {Geo} */
function fromThree(geometry) {
  const g = geometry;
  return {
    positions: new Float32Array(/** @type {any} */ (g.getAttribute('position')).array),
    normals: new Float32Array(/** @type {any} */ (g.getAttribute('normal')).array),
    uvs: g.getAttribute('uv') ? new Float32Array(/** @type {any} */ (g.getAttribute('uv')).array) : null,
    indices: g.index ? new Uint32Array(g.index.array) : null,
  };
}

/** @param {Geo} g @param {THREE.Matrix4} m */
function applyMatrix(g, m) {
  const v = new THREE.Vector3(); const nm = new THREE.Matrix3().getNormalMatrix(m);
  for (let i = 0; i < g.positions.length; i += 3) {
    v.fromArray(g.positions, i).applyMatrix4(m).toArray(g.positions, i);
    v.fromArray(g.normals, i).applyMatrix3(nm).normalize().toArray(g.normals, i);
  }
  return g;
}
const T = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ z) => new THREE.Matrix4().makeTranslation(x, y, z);
const RX = (/** @type {number} */ a) => new THREE.Matrix4().makeRotationX(a);
const RZ = (/** @type {number} */ a) => new THREE.Matrix4().makeRotationZ(a);
const S = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ z) => new THREE.Matrix4().makeScale(x, y, z);

/** @param {Geo[]} parts @returns {Geo} */
function merge(parts) {
  const vcount = parts.reduce((s, g) => s + g.positions.length / 3, 0);
  const icount = parts.reduce((s, g) => s + (g.indices ? g.indices.length : g.positions.length / 3), 0);
  const withUv = parts.every((g) => g.uvs);
  const positions = new Float32Array(vcount * 3); const normals = new Float32Array(vcount * 3);
  const uvs = withUv ? new Float32Array(vcount * 2) : null; const indices = new Uint32Array(icount);
  let vo = 0; let io = 0;
  for (const g of parts) {
    const n = g.positions.length / 3;
    positions.set(g.positions, vo * 3); normals.set(g.normals, vo * 3);
    if (uvs && g.uvs) uvs.set(g.uvs, vo * 2);
    if (g.indices) for (let i = 0; i < g.indices.length; i++) indices[io++] = g.indices[i] + vo;
    else for (let i = 0; i < n; i++) indices[io++] = vo + i;
    vo += n;
  }
  return { positions, normals, uvs, indices };
}

/** Expand to a non-indexed triangle soup. @param {Geo} g @param {boolean} [flat] recompute per-face normals */
function unindex(g, flat = false) {
  if (!g.indices) return g;
  const n = g.indices.length;
  const positions = new Float32Array(n * 3); const normals = new Float32Array(n * 3); const uvs = g.uvs ? new Float32Array(n * 2) : null;
  for (let i = 0; i < n; i++) {
    const s = g.indices[i];
    positions.set(g.positions.subarray(s * 3, s * 3 + 3), i * 3);
    normals.set(g.normals.subarray(s * 3, s * 3 + 3), i * 3);
    if (uvs && g.uvs) uvs.set(g.uvs.subarray(s * 2, s * 2 + 2), i * 2);
  }
  if (flat) {
    for (let i = 0; i < n; i += 3) {
      const a = i * 3;
      const ux = positions[a + 3] - positions[a]; const uy = positions[a + 4] - positions[a + 1]; const uz = positions[a + 5] - positions[a + 2];
      const vx = positions[a + 6] - positions[a]; const vy = positions[a + 7] - positions[a + 1]; const vz = positions[a + 8] - positions[a + 2];
      let nx = uy * vz - uz * vy; let ny = uz * vx - ux * vz; let nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      for (let k = 0; k < 3; k++) normals.set([nx, ny, nz], a + k * 3);
    }
  }
  return { positions, normals, uvs, indices: null };
}

/**
 * Rounded box centred on the origin with analytic normals. Each of the six
 * faces is its own grid, so face seams carry duplicated vertices on purpose.
 * @param {number[]} h half extents @param {number} r corner radius @param {number} n segments per face edge @param {number} uvScale
 * @returns {Geo}
 */
function roundedBox(h, r, n, uvScale) {
  const faces = [];
  for (let axis = 0; axis < 3; axis++) {
    for (const sign of [1, -1]) {
      const a1 = (axis + 1) % 3; const a2 = (axis + 2) % 3;
      const count = (n + 1) * (n + 1);
      const positions = new Float32Array(count * 3); const normals = new Float32Array(count * 3); const uvs = new Float32Array(count * 2);
      let k = 0;
      for (let j = 0; j <= n; j++) {
        for (let i = 0; i <= n; i++) {
          const q = [0, 0, 0];
          q[axis] = sign * h[axis]; q[a1] = (i / n * 2 - 1) * h[a1]; q[a2] = (j / n * 2 - 1) * h[a2];
          const inner = q.map((v, c) => clamp(v, -(h[c] - r), h[c] - r));
          const d = q.map((v, c) => v - inner[c]);
          const l = Math.hypot(d[0], d[1], d[2]) || 1;
          for (let c = 0; c < 3; c++) { normals[k * 3 + c] = d[c] / l; positions[k * 3 + c] = inner[c] + (r * d[c]) / l; }
          uvs[k * 2] = (q[a1] + h[a1]) * uvScale; uvs[k * 2 + 1] = (q[a2] + h[a2]) * uvScale;
          k++;
        }
      }
      const indices = new Uint32Array(n * n * 6); let t = 0;
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const a = j * (n + 1) + i; const b = a + 1; const c = a + n + 1; const d = c + 1;
          // a1 × a2 = +axis, so (a, b, d) is counter-clockwise seen from +axis.
          if (sign > 0) indices.set([a, b, d, a, d, c], t); else indices.set([a, d, b, a, c, d], t);
          t += 6;
        }
      }
      faces.push({ positions, normals, uvs, indices });
    }
  }
  return merge(faces);
}

/** Signed distance to a rounded rectangle. @param {number} x @param {number} y @param {number} hx @param {number} hy @param {number} r */
function sdRoundRect(x, y, hx, hy, r) {
  const qx = Math.abs(x) - (hx - r); const qy = Math.abs(y) - (hy - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

// ───────────────────────────── textures ─────────────────────────────

/** Tileable value noise. @param {number} size lattice size @param {() => number} rnd */
function makeValueNoise(size, rnd) {
  const lattice = new Float32Array(size * size);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rnd();
  return (/** @type {number} */ x, /** @type {number} */ y) => {
    const xf = Math.floor(x); const yf = Math.floor(y);
    const tx = x - xf; const ty = y - yf;
    const sx = tx * tx * (3 - 2 * tx); const sy = ty * ty * (3 - 2 * ty);
    const x0 = ((xf % size) + size) % size; const y0 = ((yf % size) + size) % size;
    const x1 = (x0 + 1) % size; const y1 = (y0 + 1) % size;
    const a = lattice[y0 * size + x0]; const b = lattice[y0 * size + x1]; const c = lattice[y1 * size + x0]; const d = lattice[y1 * size + x1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

/** @param {Uint8Array} rgb @param {number} size */
async function encodePng(rgb, size) {
  return new Uint8Array(await sharp(Buffer.from(rgb.buffer, rgb.byteOffset, rgb.byteLength), { raw: { width: size, height: size, channels: 3 } }).png({ compressionLevel: 6 }).toBuffer());
}

/**
 * Grille: perforated plate. Returns a tangent-space normal map and an ORM
 * (occlusion / roughness / metallic) map sharing the same hole layout.
 * @param {number} size @param {() => number} rnd
 */
async function grilleTextures(size, rnd) {
  const holes = 16; // staggered rows per tile
  const cell = size / holes;
  const radius = cell * 0.33; const bevel = cell * 0.09; const depth = 0.9;
  const normal = new Uint8Array(size * size * 3); const orm = new Uint8Array(size * size * 3);
  const brushed = makeValueNoise(64, rnd);
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / cell);
    const offset = row % 2 ? cell / 2 : 0;
    const cy = (row + 0.5) * cell;
    for (let x = 0; x < size; x++) {
      const xs = (((x - offset) % size) + size) % size;
      const cx = (Math.floor(xs / cell) + 0.5) * cell;
      const dx = xs - cx; const dy = y - cy;
      const d = Math.hypot(dx, dy);
      // Height: 1 on the plate, falling to 0 inside the hole across the bevel.
      const t = clamp((d - (radius - bevel)) / (2 * bevel), 0, 1);
      const slope = t > 0 && t < 1 ? (6 * t * (1 - t)) / (2 * bevel) : 0; // d/dd smoothstep
      const gx = d > 0 ? (slope * dx) / d : 0; const gy = d > 0 ? (slope * dy) / d : 0;
      let nx = -gx * depth * cell * 0.12; let ny = gy * depth * cell * 0.12; let nz = 1; // +Y up in tangent space (glTF), image y down
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const i = (y * size + x) * 3;
      normal[i] = Math.round((nx * 0.5 + 0.5) * 255); normal[i + 1] = Math.round((ny * 0.5 + 0.5) * 255); normal[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      const plate = smoothstep(radius - bevel, radius + bevel, d); // 0 in hole, 1 on plate
      const streak = brushed(x / size * 6, y / size * 64) - 0.5; // tileable horizontal brushing
      orm[i] = Math.round((0.22 + 0.78 * plate) * 255); // occlusion
      orm[i + 1] = Math.round(clamp(0.92 - 0.56 * plate + streak * 0.10 * plate, 0, 1) * 255); // roughness
      orm[i + 2] = Math.round(plate * 255); // metallic
    }
  }
  return { normal: await encodePng(normal, size), orm: await encodePng(orm, size) };
}

/** Shell: soft-touch coating, low-frequency roughness variation (G), non-metal (B = 0). @param {number} size @param {() => number} rnd */
async function shellRoughnessTexture(size, rnd) {
  const n1 = makeValueNoise(8, rnd); const n2 = makeValueNoise(32, rnd); const n3 = makeValueNoise(128, rnd);
  const rgb = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size; const v = y / size;
      const n = 0.55 * n1(u * 8, v * 8) + 0.3 * n2(u * 32, v * 32) + 0.15 * n3(u * 128, v * 128);
      const i = (y * size + x) * 3;
      rgb[i] = 255; rgb[i + 1] = Math.round(clamp(0.66 + 0.28 * n, 0, 1) * 255); rgb[i + 2] = 0;
    }
  }
  return encodePng(rgb, size);
}

/** Strap: plain-weave fabric albedo (sRGB) with an accent stripe and fibre grain. @param {number} size @param {() => number} rnd */
async function strapWeaveTexture(size, rnd) {
  const threads = 32; const cell = size / threads;
  const grain = new Float32Array(size * size);
  for (let i = 0; i < grain.length; i++) grain[i] = rnd();
  const tint = new Float32Array(threads * 2);
  for (let i = 0; i < tint.length; i++) tint[i] = 0.9 + rnd() * 0.2;
  const rgb = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    const ty = Math.floor(y / cell); const fy = y / cell - ty;
    for (let x = 0; x < size; x++) {
      const tx = Math.floor(x / cell); const fx = x / cell - tx;
      const warpOnTop = (tx + ty) % 2 === 0;
      // Cross-thread profile gives each thread a rounded look; along-thread profile dips where it goes under.
      const across = warpOnTop ? fx : fy; const along = warpOnTop ? fy : fx;
      const shade = (0.55 + 0.45 * Math.sin(Math.PI * across)) * (0.72 + 0.28 * Math.sin(Math.PI * along));
      const fibre = 0.9 + 0.2 * grain[warpOnTop ? ((y >> 2) * size + x) % grain.length : (y * size + (x >> 2)) % grain.length];
      const threadTint = warpOnTop ? tint[tx] : tint[threads + ty];
      // Accent stripe along the strap centre (v ≈ 0.5), two threads wide.
      const stripe = warpOnTop && (ty === threads / 2 - 1 || ty === threads / 2);
      const base = stripe ? [0.86, 0.36, 0.10] : warpOnTop ? [0.105, 0.11, 0.125] : [0.075, 0.08, 0.09];
      const k = shade * fibre * threadTint;
      const i = (y * size + x) * 3;
      for (let c = 0; c < 3; c++) rgb[i + c] = Math.round(clamp(Math.pow(clamp(base[c] * k, 0, 1), 1 / 2.2), 0, 1) * 255);
    }
  }
  return encodePng(rgb, size);
}

// ───────────────────────────── glTF helpers ─────────────────────────────

/**
 * @param {Document} doc @param {import('@gltf-transform/core').Buffer} buffer @param {string} name @param {Geo} g
 * @param {import('@gltf-transform/core').Material} material
 */
function addMesh(doc, buffer, name, g, material) {
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(g.positions).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(g.normals).setBuffer(buffer))
    .setMaterial(material);
  if (g.uvs) prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(g.uvs).setBuffer(buffer));
  if (g.indices) prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(g.indices).setBuffer(buffer));
  return doc.createMesh(name).addPrimitive(prim);
}

/** @param {number[]} v */
const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return v.map((x) => Math.round((x / l) * 1e4) / 1e4); };

/** @param {Geo} g */
const triCount = (g) => (g.indices ? g.indices.length : g.positions.length / 3) / 3;

// ───────────────────────────── Pulse speaker ─────────────────────────────

async function buildPulseSpeaker() {
  const rnd = mulberry32(SEED);
  const doc = new Document();
  doc.getRoot().getAsset().generator = 'Studio³ sample model generator (scripts/generate-sample-models.mjs)';
  doc.getRoot().getAsset().copyright = 'Studio³ contributors — original procedural asset, MIT License';
  const buffer = doc.createBuffer();
  const TEX = 2048;

  // Dimensions in metres. +Y up, +Z front. The speaker is 0.212 m wide including the strap pins.
  const BODY = { h: [0.1, 0.05, 0.04], r: 0.022, y: 0.054 };
  const FOOT_H = 0.004;
  const HOLE = { x: -0.038, y: 0, r: 0.032 };
  const PLATE = { hx: 0.088, hy: 0.04, r: 0.014, t: 0.0025 };

  // Textures.
  const grille = await grilleTextures(TEX, rnd);
  const texGrilleNormal = doc.createTexture('GrilleNormal').setImage(grille.normal).setMimeType('image/png');
  const texGrilleORM = doc.createTexture('GrilleORM').setImage(grille.orm).setMimeType('image/png');
  const texShell = doc.createTexture('ShellRoughness').setImage(await shellRoughnessTexture(TEX, rnd)).setMimeType('image/png');
  const texWeave = doc.createTexture('StrapWeave').setImage(await strapWeaveTexture(TEX, rnd)).setMimeType('image/png');

  // Materials.
  const ShellMatte = doc.createMaterial('ShellMatte').setBaseColorFactor([0.062, 0.066, 0.075, 1]).setMetallicFactor(1).setRoughnessFactor(1).setMetallicRoughnessTexture(texShell);
  const GrilleMetal = doc.createMaterial('GrilleMetal').setBaseColorFactor([0.58, 0.59, 0.6, 1]).setMetallicFactor(1).setRoughnessFactor(1)
    .setMetallicRoughnessTexture(texGrilleORM).setOcclusionTexture(texGrilleORM).setNormalTexture(texGrilleNormal).setNormalScale(1);
  const DriverRubber = doc.createMaterial('DriverRubber').setBaseColorFactor([0.022, 0.022, 0.026, 1]).setMetallicFactor(0).setRoughnessFactor(0.62);
  const AccentAnodized = doc.createMaterial('AccentAnodized').setBaseColorFactor([0.93, 0.36, 0.08, 1]).setMetallicFactor(1).setRoughnessFactor(0.34);
  const StrapFabric = doc.createMaterial('StrapFabric').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(0.94).setBaseColorTexture(texWeave);
  const LightEmissive = doc.createMaterial('LightEmissive').setBaseColorFactor([0.02, 0.03, 0.035, 1]).setMetallicFactor(0).setRoughnessFactor(0.4).setEmissiveFactor([0.25, 0.95, 1]);

  /** @type {Record<string, number>} */
  const stats = {};
  const scene = doc.createScene('PulseSpeaker');
  const root = doc.createNode('PulseSpeaker').setExtras({ label: 'Pulse', description: 'Pulse — a fictional compact portable speaker (original Studio³ sample asset).', units: 'metres', up: '+Y', front: '+Z' });
  scene.addChild(root);
  doc.getRoot().setDefaultScene(scene);

  /**
   * @param {string} name @param {Geo | null} g @param {import('@gltf-transform/core').Material | null} material
   * @param {number[]} translation @param {{ dir: number[], dist: number, label: string, description: string }} meta
   */
  const part = (name, g, material, translation, meta) => {
    const node = doc.createNode(name).setTranslation(/** @type {any} */ (translation))
      .setExtras({ explodeDirection: unit(meta.dir), explodeDistance: meta.dist, label: meta.label, description: meta.description });
    if (g && material) { node.setMesh(addMesh(doc, buffer, `${name}Geo`, g, material)); stats[name] = triCount(g); }
    return node;
  };

  // Body — rounded shell.
  const bodyGeo = roundedBox(BODY.h, BODY.r, 88, 10);
  const Body = part('Body', bodyGeo, ShellMatte, [0, BODY.y, 0], { dir: [0, 0, -1], dist: 0.03, label: 'Shell', description: 'Soft-touch matte enclosure with rounded edges.' });
  root.addChild(Body);

  // Grille — perforated front plate with a circular opening for the driver.
  {
    /** @param {number} th angle around the opening → point on the opening circle */
    const circle = (th) => [HOLE.x + HOLE.r * Math.cos(th), HOLE.y + HOLE.r * Math.sin(th)];
    /** @param {number} th → point on the rounded-rect outline along the same ray */
    const outline = (th) => {
      const dx = Math.cos(th); const dy = Math.sin(th);
      let lo = 0; let hi = 0.4;
      for (let i = 0; i < 48; i++) { const mid = (lo + hi) / 2; if (sdRoundRect(HOLE.x + dx * mid, HOLE.y + dy * mid, PLATE.hx, PLATE.hy, PLATE.r) < 0) lo = mid; else hi = mid; }
      return [HOLE.x + dx * lo, HOLE.y + dy * lo];
    };
    const uv = (/** @type {number} */ x, /** @type {number} */ y) => [x / 0.04, -y / 0.04];
    const NU = 384;
    const face = gridSurface(NU, 40, (u, v) => {
      const th = u * Math.PI * 2; const a = circle(th); const b = outline(th);
      const x = a[0] + (b[0] - a[0]) * v; const y = a[1] + (b[1] - a[1]) * v;
      return { p: [x, y, PLATE.t], uv: uv(x, y), hint: [0, 0, 1] };
    });
    const holeWall = gridSurface(NU, 2, (u, v) => {
      const th = u * Math.PI * 2; const a = circle(th);
      return { p: [a[0], a[1], PLATE.t * v], uv: uv(a[0], a[1]), hint: [-Math.cos(th), -Math.sin(th), 0] };
    });
    const outerWall = gridSurface(NU, 2, (u, v) => {
      const th = u * Math.PI * 2; const b = outline(th);
      return { p: [b[0], b[1], PLATE.t * v], uv: uv(b[0], b[1]), hint: [b[0], b[1], 0] };
    });
    const Grille = part('Grille', merge([face, holeWall, outerWall]), GrilleMetal, [0, 0, BODY.h[2]], { dir: [0, 0, 1], dist: 0.06, label: 'Grille', description: 'Perforated aluminium front plate (normal + ORM maps).' });
    Body.addChild(Grille);
  }

  // Driver — dust cap, cone and rubber surround, lathed around +Z. Deliberately non-indexed.
  {
    /** @param {number} t 0..1 from centre to rim → [radius, z] */
    const profile = (t) => {
      if (t < 0.3) { const k = t / 0.3; return [0.0105 * Math.sin((k * Math.PI) / 2), -0.0085 + 0.0045 * Math.cos((k * Math.PI) / 2)]; }
      if (t < 0.78) { const k = (t - 0.3) / 0.48; return [0.0105 + 0.0135 * k, -0.0085 + 0.0075 * Math.pow(k, 1.6)]; }
      const k = (t - 0.78) / 0.22; return [0.024 + 0.0078 * k, -0.001 + 0.0034 * Math.sin(Math.PI * k)];
    };
    const g = gridSurface(256, 96, (u, v) => {
      const th = u * Math.PI * 2; const [r, z] = profile(v);
      return { p: [r * Math.cos(th), r * Math.sin(th), z], uv: [u, v], hint: [0, 0, 1] };
    });
    Body.addChild(part('Driver', unindex(g), DriverRubber, [HOLE.x, HOLE.y, BODY.h[2]], { dir: [0, 0, 1], dist: 0.035, label: 'Driver', description: '52 mm full-range driver with rubber surround.' }));
  }

  // DriverRing — anodized trim ring around the opening.
  Body.addChild(part('DriverRing', fromThree(new THREE.TorusGeometry(HOLE.r + 0.0012, 0.0026, 40, 256)), AccentAnodized,
    [HOLE.x, HOLE.y, BODY.h[2] + PLATE.t + 0.0002], { dir: [0, 0, 1], dist: 0.085, label: 'Trim ring', description: 'Anodized aluminium trim ring.' }));

  // Badge — small plate on the grille.
  Body.addChild(part('Badge', roundedBox([0.011, 0.0035, 0.0007], 0.0006, 10, 40), AccentAnodized,
    [0.058, -0.026, BODY.h[2] + PLATE.t + 0.0005], { dir: [0.35, -0.2, 1], dist: 0.075, label: 'Badge', description: 'Pulse logo badge.' }));

  // Knob — knurled volume dial on the top face, with a pointer ridge. Animated by "KnobTurn".
  const KNOB = { x: 0.055, r: 0.014, h: 0.0105 };
  let Knob;
  {
    /** @param {number} t → [radius, y, knurl amount] */
    const profile = (t) => {
      if (t < 0.34) { const k = t / 0.34; return [0.0118 * k, KNOB.h, 0]; }
      if (t < 0.46) { const k = (t - 0.34) / 0.12; return [0.0118 + (KNOB.r - 0.0118) * Math.sin((k * Math.PI) / 2), KNOB.h - 0.0016 * (1 - Math.cos((k * Math.PI) / 2)), k]; }
      const k = (t - 0.46) / 0.54; return [KNOB.r, KNOB.h - 0.0016 - (KNOB.h - 0.0016) * k, 1];
    };
    const body = gridSurface(192, 48, (u, v) => {
      const th = u * Math.PI * 2; const [r0, y, knurl] = profile(v);
      const r = r0 * (1 + 0.022 * knurl * Math.cos(th * 48));
      return { p: [r * Math.cos(th), y, r * Math.sin(th)], uv: [u, v], hint: [Math.cos(th), 0.6, Math.sin(th)] };
    });
    const pointer = applyMatrix(roundedBox([0.0008, 0.0005, 0.0045], 0.0004, 6, 40), T(0, KNOB.h + 0.0002, -0.0062));
    Knob = part('Knob', merge([body, pointer]), AccentAnodized, [KNOB.x, BODY.h[1], 0], { dir: [0, 1, 0], dist: 0.05, label: 'Volume dial', description: 'Knurled anodized dial; clip "KnobTurn" rotates it about +Y.' });
    Body.addChild(Knob);
  }

  // StatusLight — emissive ring around the dial. Animated by "LightPulse" (uniform scale).
  const StatusLight = part('StatusLight', applyMatrix(fromThree(new THREE.TorusGeometry(0.0172, 0.0011, 24, 160)), RX(Math.PI / 2)), LightEmissive,
    [KNOB.x, BODY.h[1] + 0.0003, 0], { dir: [0, 1, 0], dist: 0.025, label: 'Status light', description: 'Emissive status ring; clip "LightPulse" pulses its scale.' });
  Body.addChild(StatusLight);

  // Strap pins — left and right.
  const PIN_Y = 0.022;
  for (const side of [-1, 1]) {
    const shaft = applyMatrix(fromThree(new THREE.CylinderGeometry(0.0046, 0.0046, 0.009, 64, 8)), RZ(Math.PI / 2));
    const head = applyMatrix(applyMatrix(fromThree(new THREE.SphereGeometry(0.0066, 64, 24)), S(0.42, 1, 1)), T(side * 0.0052, 0, 0));
    Body.addChild(part(side < 0 ? 'StrapPinL' : 'StrapPinR', merge([shaft, head]), AccentAnodized, [side * (BODY.h[0] + 0.0035), PIN_Y, 0],
      { dir: [side, 0, 0], dist: 0.04, label: side < 0 ? 'Strap pin (left)' : 'Strap pin (right)', description: 'Anodized pin anchoring the carry strap.' }));
  }

  // Strap — woven carry handle arching over the top, from pin to pin. Deliberately non-indexed.
  {
    const A = BODY.h[0] + 0.0045; const B = 0.066; const Y0 = BODY.y + PIN_Y;
    const W = 0.008; const TH = 0.0016; // half width (z), half thickness
    const length = Math.PI * Math.sqrt((A * A + B * B) / 2);
    const g = gridSurface(400, 32, (u, v) => {
      const t = Math.PI * (1 - u); // left → right
      const cx = A * Math.cos(t); const cy = Y0 + B * Math.sin(t);
      // In-plane outward normal of the ellipse.
      let nx = B * Math.cos(t); let ny = A * Math.sin(t); const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const a = v * Math.PI * 2;
      // Superellipse section: flat band with rounded edges.
      const ca = Math.cos(a); const sa = Math.sin(a);
      const e = 0.5;
      const sn = Math.sign(sa) * Math.pow(Math.abs(sa), e) * TH; const sz = Math.sign(ca) * Math.pow(Math.abs(ca), e) * W;
      return { p: [cx + nx * sn, cy + ny * sn, sz], uv: [(u * length) / (2 * W), v < 0.5 ? v * 2 : (1 - v) * 2], hint: [nx * sa, ny * sa, ca] };
    });
    root.addChild(part('Strap', unindex(g), StrapFabric, [0, 0, 0], { dir: [0, 1, 0], dist: 0.07, label: 'Carry strap', description: 'Woven fabric carry strap (tiling weave albedo).' }));
  }

  // Feet — four identical rubber feet. Each foot carries its own copy of identical data (duplicate accessors for dedup).
  {
    const Feet = part('Feet', null, null, [0, 0, 0], { dir: [0, -1, 0], dist: 0.03, label: 'Feet', description: 'Four rubber feet (identical geometry, de-duplicated by the optimizer).' });
    root.addChild(Feet);
    /** @param {number} t → [radius, y] */
    const profile = (t) => {
      if (t < 0.4) return [0.0068 * (t / 0.4), 0];
      if (t < 0.7) { const k = (t - 0.4) / 0.3; return [0.0068 + 0.0014 * Math.sin((k * Math.PI) / 2), 0.0014 * (1 - Math.cos((k * Math.PI) / 2))]; }
      const k = (t - 0.7) / 0.3; return [0.0082, 0.0014 + (FOOT_H + 0.0008 - 0.0014) * k];
    };
    const foot = () => gridSurface(64, 12, (u, v) => {
      const th = u * Math.PI * 2; const [r, y] = profile(v);
      return { p: [r * Math.cos(th), y, r * Math.sin(th)], uv: [u, v], hint: [Math.cos(th), -1, Math.sin(th)] };
    });
    let feetTris = 0;
    for (const [name, x, z] of /** @type {[string, number, number][]} */ ([['FootFL', -0.074, 0.024], ['FootFR', 0.074, 0.024], ['FootRL', -0.074, -0.024], ['FootRR', 0.074, -0.024]])) {
      const g = foot(); feetTris += triCount(g);
      const node = doc.createNode(name).setTranslation([x, 0, z]).setMesh(addMesh(doc, buffer, 'FootGeo', g, DriverRubber));
      Feet.addChild(node);
    }
    stats.Feet = feetTris;
  }

  // Animations.
  {
    const KEYS = 17;
    const knobTimes = new Float32Array(KEYS); const knobRot = new Float32Array(KEYS * 4);
    const lightTimes = new Float32Array(KEYS); const lightScale = new Float32Array(KEYS * 3);
    for (let i = 0; i < KEYS; i++) {
      const k = i / (KEYS - 1);
      knobTimes[i] = 2.0 * k;
      const angle = -THREE.MathUtils.degToRad(120) * 0.5 * (1 - Math.cos(2 * Math.PI * k)); // clockwise seen from above, there and back
      knobRot.set([0, Math.sin(angle / 2), 0, Math.cos(angle / 2)], i * 4);
      lightTimes[i] = 1.6 * k;
      const s = 1 + 0.12 * 0.5 * (1 - Math.cos(2 * Math.PI * k));
      lightScale.set([s, s, s], i * 3);
    }
    const acc = (/** @type {'SCALAR'|'VEC3'|'VEC4'} */ type, /** @type {Float32Array} */ array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
    const s1 = doc.createAnimationSampler().setInput(acc('SCALAR', knobTimes)).setOutput(acc('VEC4', knobRot)).setInterpolation('LINEAR');
    doc.createAnimation('KnobTurn').addSampler(s1).addChannel(doc.createAnimationChannel().setTargetNode(Knob).setTargetPath('rotation').setSampler(s1));
    const s2 = doc.createAnimationSampler().setInput(acc('SCALAR', lightTimes)).setOutput(acc('VEC3', lightScale)).setInterpolation('LINEAR');
    doc.createAnimation('LightPulse').addSampler(s2).addChannel(doc.createAnimationChannel().setTargetNode(StatusLight).setTargetPath('scale').setSampler(s2));
  }

  return { doc, stats };
}

// ───────────────────────────── Orbit token ─────────────────────────────

function buildOrbitToken() {
  const doc = new Document();
  doc.getRoot().getAsset().generator = 'Studio³ sample model generator (scripts/generate-sample-models.mjs)';
  doc.getRoot().getAsset().copyright = 'Studio³ contributors — original procedural asset, MIT License';
  const buffer = doc.createBuffer();
  const R = 0.028; const TUBE = 0.0035;
  /** @type {Geo[]} */
  const parts = [];
  // Rim and disc (coin axis = +Z).
  parts.push(fromThree(new THREE.TorusGeometry(R, TUBE, 10, 64)));
  parts.push(applyMatrix(fromThree(new THREE.CylinderGeometry(R, R, 0.005, 64, 1)), RX(Math.PI / 2)));
  for (const side of [1, -1]) {
    // Faceted centre gem.
    parts.push(applyMatrix(fromThree(new THREE.IcosahedronGeometry(0.0115, 5)), T(0, 0, side * 0.0025).multiply(S(1, 1, 0.38))));
    // Tilted "orbit" ring embossed on the face.
    parts.push(applyMatrix(fromThree(new THREE.TorusGeometry(0.019, 0.0012, 6, 64)), T(0, 0, side * 0.0027).multiply(RZ(side * 0.5)).multiply(S(1, 0.62, 1))));
    // Twelve studs.
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      parts.push(applyMatrix(fromThree(new THREE.OctahedronGeometry(0.0019, 1)), T(Math.cos(a) * 0.0235, Math.sin(a) * 0.0235, side * 0.0027)));
    }
  }
  const g = unindex(merge(parts.map((p) => ({ ...p, uvs: null }))), true); // flat shaded → faceted
  const TokenMetal = doc.createMaterial('TokenMetal').setBaseColorFactor([0.86, 0.6, 0.22, 1]).setMetallicFactor(1).setRoughnessFactor(0.28);
  const Token = doc.createNode('Token').setTranslation([0, R + TUBE, 0]).setMesh(addMesh(doc, buffer, 'TokenGeo', g, TokenMetal))
    .setExtras({ label: 'Orbit token', description: 'Faceted token; clip "Spin" rotates it once about +Y.', units: 'metres', up: '+Y', front: '+Z' });
  const scene = doc.createScene('OrbitToken').addChild(Token);
  doc.getRoot().setDefaultScene(scene);
  const KEYS = 9; const times = new Float32Array(KEYS); const rot = new Float32Array(KEYS * 4);
  for (let i = 0; i < KEYS; i++) {
    const k = i / (KEYS - 1); times[i] = 4 * k; const a = Math.PI * 2 * k;
    rot.set([0, Math.sin(a / 2), 0, Math.cos(a / 2)], i * 4);
  }
  const sampler = doc.createAnimationSampler()
    .setInput(doc.createAccessor().setType('SCALAR').setArray(times).setBuffer(buffer))
    .setOutput(doc.createAccessor().setType('VEC4').setArray(rot).setBuffer(buffer)).setInterpolation('LINEAR');
  doc.createAnimation('Spin').addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(Token).setTargetPath('rotation').setSampler(sampler));
  return { doc, stats: { Token: triCount(g) } };
}

// ───────────────────────────── main ─────────────────────────────

fs.mkdirSync(OUT_DIR, { recursive: true });
const io = new NodeIO();
for (const [file, build] of /** @type {[string, () => any][]} */ ([['pulse-speaker.source.glb', buildPulseSpeaker], ['orbit-token.source.glb', buildOrbitToken]])) {
  const { doc, stats } = await build();
  const bytes = await io.writeBinary(doc);
  fs.writeFileSync(path.join(OUT_DIR, file), bytes);
  const total = Object.values(stats).reduce((/** @type {number} */ s, /** @type {any} */ n) => s + n, 0);
  console.log(`${file}: ${(bytes.byteLength / 1024 / 1024).toFixed(2)} MB, ${total.toLocaleString('en-US')} triangles`);
  for (const [k, v] of Object.entries(stats)) console.log(`  ${k.padEnd(12)} ${Number(v).toLocaleString('en-US')}`);
}
