// @ts-check
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { Document, NodeIO } from '@gltf-transform/core';
import sharp from 'sharp';

import { main, help } from '../../../plugins/maquettekit/tools/asset-pipeline/index.mjs';
import { inspectFile, trianglesForMode, gpuTextureBytesEstimate } from '../../../plugins/maquettekit/tools/asset-pipeline/inspect.mjs';
import { validateFile } from '../../../plugins/maquettekit/tools/asset-pipeline/validate.mjs';
import { optimizeFile, defaultName } from '../../../plugins/maquettekit/tools/asset-pipeline/optimize.mjs';
import { resolveProfile, applyFlags, textureRuleFor, DEFAULT_PROFILES } from '../../../plugins/maquettekit/tools/asset-pipeline/profiles.mjs';
import { buildVariants } from '../../../plugins/maquettekit/tools/asset-pipeline/variants.mjs';
import { scanDirectory, parseVariantName } from '../../../plugins/maquettekit/tools/asset-pipeline/manifest.mjs';
import { detectBlender, blenderArgs, importWithBlender, CONVERT_SCRIPT } from '../../../plugins/maquettekit/tools/asset-pipeline/import.mjs';
import { detectKtx, ktxCreateArgs } from '../../../plugins/maquettekit/tools/asset-pipeline/ktx.mjs';
import { renderThumbnail } from '../../../plugins/maquettekit/tools/asset-pipeline/thumbnail.mjs';
import { readDocument } from '../../../plugins/maquettekit/tools/asset-pipeline/io.mjs';
import { createOutputGuard } from '../../../plugins/maquettekit/tools/asset-pipeline/safe-output.mjs';

const REPO = path.resolve(import.meta.dirname, '..', '..', '..');
const ORBIT = path.join(REPO, 'assets', 'models', 'orbit-token.source.glb');

/** @type {string} */
let tmp;
const io = new NodeIO();
const sha = (/** @type {string} */ f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const profile = (/** @type {string} */ name, flags = {}) => { const r = resolveProfile(name); return { ...r, profile: applyFlags(r.profile, flags) }; };
let counter = 0;
const outDir = () => path.join(tmp, `out-${++counter}`);

/** Mesh with exactly known counts: indexed quad (×2 instances), non-indexed triangle, 5-vertex strip. */
async function writeKnownFixture(file) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const mat = doc.createMaterial('Known').setBaseColorFactor([1, 0, 0, 1]).setRoughnessFactor(0.5).setDoubleSided(true);
  const acc = (/** @type {any} */ type, /** @type {any} */ array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const quad = doc.createMesh('Quad').addPrimitive(doc.createPrimitive()
    .setAttribute('POSITION', acc('VEC3', new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0])))
    .setAttribute('NORMAL', acc('VEC3', new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1])))
    .setIndices(acc('SCALAR', new Uint16Array([0, 1, 2, 0, 2, 3]))).setMaterial(mat));
  const mixed = doc.createMesh('Mixed')
    .addPrimitive(doc.createPrimitive().setAttribute('POSITION', acc('VEC3', new Float32Array([0, 0, 1, 1, 0, 1, 0, 1, 1]))).setMaterial(mat))
    .addPrimitive(doc.createPrimitive().setMode(5).setAttribute('POSITION', acc('VEC3', new Float32Array([0, 0, 2, 1, 0, 2, 0, 1, 2, 1, 1, 2, 0, 2, 2]))).setMaterial(mat));
  const a = doc.createNode('QuadA').setMesh(quad);
  const b = doc.createNode('QuadB').setMesh(quad).setTranslation([2, 0, 0]);
  const c = doc.createNode('MixedNode').setMesh(mixed);
  const scene = doc.createScene('Scene').addChild(doc.createNode('Root').addChild(a).addChild(b).addChild(c));
  doc.getRoot().setDefaultScene(scene);
  fs.writeFileSync(file, await io.writeBinary(doc));
}

/**
 * Redundant, non-indexed grid with named parts, extras, two materials, vertex colours,
 * a texture and an animation — everything the optimizer has to preserve.
 * @param {string} file @param {{ n?: number, textureSize?: number, morph?: boolean }} [o]
 */
async function writeRichFixture(file, o = {}) {
  const n = o.n ?? 24; const size = o.textureSize ?? 256;
  const doc = new Document();
  const buffer = doc.createBuffer();
  const acc = (/** @type {any} */ type, /** @type {any} */ array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  /** Wavy grid as a triangle soup (6 vertices per cell → heavy duplication). */
  const grid = () => {
    const pos = []; const nor = []; const uv = []; const col = [];
    const h = (/** @type {number} */ x, /** @type {number} */ y) => 0.05 * Math.sin(x * 6) * Math.cos(y * 5);
    const push = (/** @type {number} */ i, /** @type {number} */ j) => {
      const x = i / n; const y = j / n;
      pos.push(x, y, h(x, y)); nor.push(0, 0, 1); uv.push(x, y); col.push(x, y, 1 - x, 1);
    };
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { push(i, j); push(i + 1, j); push(i + 1, j + 1); push(i, j); push(i + 1, j + 1); push(i, j + 1); }
    return { pos: new Float32Array(pos), nor: new Float32Array(nor), uv: new Float32Array(uv), col: new Float32Array(col) };
  };
  const rnd = (() => { let s = 7; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();
  const raw = Buffer.alloc(size * size * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = Math.floor(64 + 128 * Math.sin(i / 97) ** 2 + 30 * rnd());
  const png = new Uint8Array(await sharp(raw, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer());
  const albedo = doc.createTexture('Albedo').setImage(png).setMimeType('image/png');
  const normal = doc.createTexture('NormalMap').setImage(png.slice()).setMimeType('image/png');
  const matA = doc.createMaterial('PanelPaint').setBaseColorTexture(albedo).setNormalTexture(normal).setRoughnessFactor(0.7);
  const matB = doc.createMaterial('PanelMetal').setBaseColorFactor([0.8, 0.8, 0.9, 1]).setMetallicFactor(1).setRoughnessFactor(0.3);
  const mk = (/** @type {string} */ name, /** @type {any} */ material) => {
    const g = grid();
    const prim = doc.createPrimitive().setAttribute('POSITION', acc('VEC3', g.pos)).setAttribute('NORMAL', acc('VEC3', g.nor))
      .setAttribute('TEXCOORD_0', acc('VEC2', g.uv)).setAttribute('COLOR_0', acc('VEC4', g.col)).setMaterial(material);
    if (o.morph) {
      const delta = new Float32Array(g.pos.length); for (let i = 2; i < delta.length; i += 3) delta[i] = 0.1;
      prim.addTarget(doc.createPrimitiveTarget().setAttribute('POSITION', acc('VEC3', delta)));
    }
    return doc.createMesh(name).addPrimitive(prim);
  };
  const root = doc.createNode('Assembly').setExtras({ label: 'Assembly' });
  const left = doc.createNode('PanelLeft').setMesh(mk('PanelLeftGeo', matA)).setTranslation([-1.2, 0.25, 0]).setExtras({ explodeDirection: [-1, 0, 0], explodeDistance: 0.4, label: 'Left' });
  const right = doc.createNode('PanelRight').setMesh(mk('PanelRightGeo', matB)).setTranslation([0.2, 0, 0.5]).setScale([1, 2, 1]).setExtras({ explodeDirection: [1, 0, 0], explodeDistance: 0.4, label: 'Right' });
  const marker = doc.createNode('EmptyMarker');
  root.addChild(left).addChild(right).addChild(marker);
  left.addChild(doc.createNode('LeftChild').setTranslation([0, 0, 0.3]));
  doc.getRoot().setDefaultScene(doc.createScene('Main').addChild(root));
  const sampler = doc.createAnimationSampler().setInput(acc('SCALAR', new Float32Array([0, 0.75, 1.5])))
    .setOutput(acc('VEC3', new Float32Array([0.2, 0, 0.5, 0.2, 0.3, 0.5, 0.2, 0, 0.5]))).setInterpolation('LINEAR');
  doc.createAnimation('Bounce').addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(right).setTargetPath('translation').setSampler(sampler));
  // Unused material: must be pruned without failing verification.
  doc.createMaterial('Unused');
  fs.writeFileSync(file, await io.writeBinary(doc));
  return { triangles: n * n * 2 * 2 };
}

/** World-space positions of every mesh vertex in a file. @param {string} file */
async function worldPositions(file) {
  const { document } = await readDocument(file);
  /** @type {number[][]} */
  const out = [];
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const el = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, el);
        const [x, y, z] = el; // getElement() already decodes normalized integers
        out.push([m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]);
      }
    }
  }
  return out;
}

/** Run the CLI entry point capturing stdout. @param {string[]} argv */
async function cli(argv) {
  const chunks = [];
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation((/** @type {any} */ c) => { chunks.push(String(c)); return true; });
  const logSpy = vi.spyOn(console, 'log').mockImplementation((...a) => { chunks.push(`${a.join(' ')}\n`); });
  const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try { return { code: await main(argv), stdout: chunks.join('') }; }
  finally { spy.mockRestore(); logSpy.mockRestore(); errSpy.mockRestore(); }
}

beforeAll(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'maquettekit-assets-test-')); });
afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

describe('assets: module contract', () => {
  it('exports main() and a help string naming every subcommand', () => {
    expect(typeof main).toBe('function');
    for (const sub of ['inspect', 'validate', 'optimize', 'variants', 'manifest', 'thumbnail', 'import']) expect(help).toContain(sub);
  });
  it('rejects unknown subcommands with a UserError', async () => {
    await expect(main(['frobnicate'])).rejects.toMatchObject({ name: 'UserError' });
  });
});

describe('assets inspect', () => {
  it('counts triangles for every draw mode', () => {
    expect(trianglesForMode(4, 6)).toBe(2);
    expect(trianglesForMode(5, 5)).toBe(3);
    expect(trianglesForMode(6, 5)).toBe(3);
    expect(trianglesForMode(1, 6)).toBe(0);
    expect(gpuTextureBytesEstimate(1024, 1024)).toBe(Math.round((1024 * 1024 * 4 * 4) / 3));
  });

  it('reports exact counts for a known mesh', async () => {
    const file = path.join(tmp, 'known.glb');
    await writeKnownFixture(file);
    const r = await inspectFile(file);
    expect(r.totals.meshes).toBe(2);
    expect(r.totals.primitives).toBe(3);
    expect(r.totals.vertices).toBe(4 + 3 + 5);
    expect(r.totals.triangles).toBe(2 + 1 + 3);
    expect(r.totals.renderedTriangles).toBe(2 * 2 + 1 + 3);
    expect(r.totals.drawCallsEstimate).toBe(2 + 2);
    expect(r.totals.materials).toBe(1);
    expect(r.totals.textures).toBe(0);
    expect(r.totals.gpuTextureBytesEstimate).toBe(0);
    const quad = r.meshes.find((m) => m.name === 'Quad');
    expect(quad).toMatchObject({ vertices: 4, triangles: 2, instances: 2, attributes: ['POSITION', 'NORMAL'], materials: ['Known'] });
    expect(quad.primitives[0]).toMatchObject({ mode: 'TRIANGLES', indexed: true, indices: 6 });
    const mixed = r.meshes.find((m) => m.name === 'Mixed');
    expect(mixed.primitives.map((p) => [p.mode, p.indexed, p.triangles])).toEqual([['TRIANGLES', false, 1], ['TRIANGLE_STRIP', false, 3]]);
    expect(r.materials[0]).toMatchObject({ name: 'Known', alphaMode: 'OPAQUE', doubleSided: true, roughnessFactor: 0.5, textureSlots: [] });
    expect(r.bounds.min).toEqual([0, 0, 0]);
    expect(r.bounds.max).toEqual([3, 2, 2]);
    expect(r.scenes[0].nodes[0].name).toBe('Root');
    expect(r.scenes[0].nodes[0].children.map((c) => c.name)).toEqual(['QuadA', 'QuadB', 'MixedNode']);
    expect(r.fileBytes).toBe(fs.statSync(file).size);
    expect(r.sha256).toBe(sha(file));
    expect(r.extensionsRequired).toEqual([]);
  });

  it('prints JSON through the CLI', async () => {
    const file = path.join(tmp, 'known.glb');
    const { code, stdout } = await cli(['inspect', file, '--json']);
    expect(code).toBe(0);
    expect(JSON.parse(stdout).totals.triangles).toBe(6);
    const text = await cli(['inspect', file]);
    expect(text.stdout).toContain('Scene hierarchy');
    expect(text.stdout).toContain('estimate');
  });
});

describe('assets validate', () => {
  it('passes a valid file and reports infos', async () => {
    const file = path.join(tmp, 'rich-valid.glb');
    await writeRichFixture(file, { n: 4, textureSize: 100 });
    const r = await validateFile(file);
    expect(r.ok).toBe(true);
    expect(r.validator.status).toBe('ran');
    expect(r.summary.errors).toBe(0);
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain('TEXTURE_NPOT');
    expect(codes).toContain('UNUSED_DATA');
    expect(codes).toContain('EMPTY_NODE');
    expect(codes).toContain('MISSING_TANGENTS');
  });

  it('flags a deliberately broken file and exits 1', async () => {
    const dir = path.join(tmp, 'broken'); fs.mkdirSync(dir);
    const file = path.join(dir, 'broken.gltf');
    fs.writeFileSync(file, JSON.stringify({
      asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }], // min/max missing
      bufferViews: [{ buffer: 0, byteLength: 36 }],
      buffers: [{ uri: 'missing.bin', byteLength: 36 }],
    }));
    const r = await validateFile(file);
    expect(r.ok).toBe(false);
    expect(r.summary.errors).toBeGreaterThan(0);
    expect(r.issues.some((i) => i.source === 'maquettekit' && i.code === 'MISSING_EXTERNAL_RESOURCE' && i.pointer === '/buffers/0/uri')).toBe(true);
    expect(r.issues.some((i) => i.source === 'gltf-validator' && i.severity === 'error')).toBe(true);
    const { code, stdout } = await cli(['validate', file, '--json']);
    expect(code).toBe(1);
    expect(JSON.parse(stdout).ok).toBe(false);
  });

  it('--strict turns warnings into a failure', async () => {
    const file = path.join(tmp, 'huge.glb');
    const doc = new Document(); const buffer = doc.createBuffer();
    const prim = doc.createPrimitive().setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 5000, 0, 0, 0, 5000, 0])).setBuffer(buffer));
    doc.getRoot().setDefaultScene(doc.createScene().addChild(doc.createNode('Huge').setMesh(doc.createMesh('HugeGeo').addPrimitive(prim))));
    fs.writeFileSync(file, await io.writeBinary(doc));
    const lenient = await validateFile(file);
    expect(lenient.ok).toBe(true);
    expect(lenient.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['ABSURD_SCALE', 'MISSING_NORMALS']));
    expect((await cli(['validate', file, '--strict'])).code).toBe(1);
  });
});

describe('assets optimize', () => {
  /** @type {string} */ let src;
  /** @type {{ triangles: number }} */ let info;
  beforeAll(async () => { src = path.join(tmp, 'src', 'panel.source.glb'); fs.mkdirSync(path.dirname(src)); info = await writeRichFixture(src); });

  it('preserves animations, materials, named nodes and attributes; reduces bytes; never touches the source', async () => {
    const before = sha(src); const mtime = fs.statSync(src).mtimeMs;
    const out = outDir();
    const report = await optimizeFile(src, { outDir: out, profile: profile('desktop') });
    expect(report.ok).toBe(true);
    expect(sha(src)).toBe(before);
    expect(fs.statSync(src).mtimeMs).toBe(mtime);
    expect(report.source.sha256).toBe(before);
    expect(report.sourcePreserving.unchanged).toBe(true);
    expect(report.name).toBe('panel');
    expect(fs.existsSync(path.join(out, 'panel.glb'))).toBe(true);
    expect(fs.existsSync(path.join(out, 'panel.report.json'))).toBe(true);
    expect(fs.readFileSync(path.join(out, 'panel.report.md'), 'utf8')).toContain('## Verification');
    expect(report.output.bytes).toBeLessThan(report.source.bytes * 0.5);
    expect(report.summary.vertices.after).toBeLessThan(report.summary.vertices.before);
    expect(report.summary.triangles.after).toBe(info.triangles);
    expect(report.steps.map((s) => s.id)).toEqual(['dedup', 'prune', 'join', 'weld', 'simplify', 'reorder', 'quantize', 'textures', 'compress', 'write']);
    expect(report.steps.find((s) => s.id === 'simplify')).toMatchObject({ status: 'skipped' });
    expect(report.steps.find((s) => s.id === 'join').reason).toMatch(/opt-in/);
    for (const s of report.steps) { expect(s.before).toBeTruthy(); expect(s.after).toBeTruthy(); if (s.status === 'skipped') expect(s.reason).toBeTruthy(); }
    expect(report.verification.checks.map((c) => [c.id, c.status])).toEqual([
      ['validator', 'pass'], ['animations', 'pass'], ['materials', 'pass'], ['named-nodes', 'pass'], ['attributes', 'pass'], ['bounds', 'pass'], ['triangles', 'pass'], ['source-untouched', 'pass'],
    ]);
    expect(report.decoderRequirements.find((d) => d.extension === 'EXT_meshopt_compression')).toMatchObject({ required: true, needs: 'MeshoptDecoder' });

    const o = await inspectFile(path.join(out, 'panel.glb'));
    expect(o.animations.map((a) => [a.name, a.duration, a.targets[0].node, a.targets[0].path])).toEqual([['Bounce', 1.5, 'PanelRight', 'translation']]);
    expect(o.materials.map((m) => m.name).sort()).toEqual(['PanelMetal', 'PanelPaint']);
    const names = o.namedNodes.map((n) => n.name);
    for (const n of ['Assembly', 'PanelLeft', 'PanelRight', 'EmptyMarker', 'LeftChild']) expect(names).toContain(n);
    const right = o.namedNodes.find((n) => n.name === 'PanelRight');
    expect(right.parent).toBe('Assembly');
    expect(right.extras).toEqual({ explodeDirection: [1, 0, 0], explodeDistance: 0.4, label: 'Right' });
    expect(right.translation).toEqual([expect.closeTo(0.2, 6), 0, 0.5]);
    expect(right.scale).toEqual([1, 2, 1]);
    for (const m of o.meshes) expect(m.attributes).toEqual(expect.arrayContaining(['POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0']));
    expect(o.extensionsRequired).toEqual(expect.arrayContaining(['EXT_meshopt_compression', 'KHR_mesh_quantization', 'EXT_texture_webp']));
  });

  it('meshopt output decodes and positions round-trip within quantization tolerance', async () => {
    const out = outDir();
    const report = await optimizeFile(src, { outDir: out, profile: profile('desktop') });
    const a = await worldPositions(src); const b = await worldPositions(path.join(out, 'panel.glb'));
    expect(b.length).toBeGreaterThan(0);
    expect(b.length).toBeLessThan(a.length); // welded
    // 14-bit grid over a mesh ≤ 2 units across (after node scale) → step ≈ 1.2e-4; allow 3 steps.
    const tol = (2 / 2 ** 14) * 3;
    const key = (/** @type {number[]} */ p) => p.map((v) => Math.round(v / (tol * 4))).join(',');
    const buckets = new Map();
    for (const p of b) { const k = key(p); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(p); }
    let worst = 0;
    for (let i = 0; i < a.length; i += 7) {
      const p = a[i]; let best = Infinity;
      const c = p.map((v) => Math.round(v / (tol * 4)));
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        for (const q of buckets.get(`${c[0] + dx},${c[1] + dy},${c[2] + dz}`) ?? []) best = Math.min(best, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]));
      }
      worst = Math.max(worst, best);
    }
    expect(worst).toBeLessThan(tol);
    expect(report.extensionsRequired).toContain('EXT_meshopt_compression');
  });

  it('refuses to overwrite, and backs up when forced', async () => {
    const out = outDir();
    await optimizeFile(src, { outDir: out, profile: profile('desktop') });
    const first = sha(path.join(out, 'panel.glb'));
    await expect(optimizeFile(src, { outDir: out, profile: profile('desktop') })).rejects.toMatchObject({ name: 'UserError', message: expect.stringMatching(/Refusing to overwrite/) });
    expect(sha(path.join(out, 'panel.glb'))).toBe(first);
    const forced = await optimizeFile(src, { outDir: out, profile: profile('mobile'), force: true });
    expect(forced.ok).toBe(true);
    expect(forced.backups.length).toBe(3);
    const backupDir = path.join(out, '.backup');
    const stamps = fs.readdirSync(backupDir);
    expect(stamps.length).toBe(1);
    expect(sha(path.join(backupDir, stamps[0], 'panel.glb'))).toBe(first);
  });

  it('never writes to or next to the source', async () => {
    const before = sha(src);
    // Output dir == source dir.
    await expect(optimizeFile(src, { outDir: path.dirname(src), profile: profile('desktop') })).rejects.toMatchObject({ name: 'UserError', message: expect.stringMatching(/contains the source asset/) });
    // Even --force may not target the source file itself.
    await expect(optimizeFile(src, { outDir: path.dirname(src), name: 'panel.source', profile: profile('desktop'), force: true })).rejects.toMatchObject({ name: 'UserError', message: expect.stringMatching(/source asset/) });
    expect(sha(src)).toBe(before);
    expect(fs.readdirSync(path.dirname(src))).toEqual(['panel.source.glb']);
    const guard = createOutputGuard({ outDir: path.dirname(src), sources: [src], force: true });
    expect(() => guard.write(src, 'x')).toThrow(/source asset/);
    expect(sha(src)).toBe(before);
    const { code } = await cli(['optimize', src]).catch((e) => ({ code: e.exitCode }));
    expect(code).toBe(2); // --out is mandatory
  });

  it('lowers the triangle count only when simplification is requested', async () => {
    const none = await optimizeFile(src, { outDir: outDir(), profile: profile('desktop') });
    expect(none.summary.triangles.after).toBe(info.triangles);
    const half = await optimizeFile(src, { outDir: outDir(), profile: profile('desktop', { simplify: 0.5, simplifyError: 0.05 }) });
    expect(half.ok).toBe(true);
    expect(half.steps.find((s) => s.id === 'simplify')).toMatchObject({ status: 'ran', detail: { ratio: 0.5, lockBorder: true } });
    expect(half.summary.triangles.after).toBeLessThan(info.triangles);
    expect(half.summary.triangles.after).toBeGreaterThanOrEqual(info.triangles * 0.4);
    expect(half.verification.checks.find((c) => c.id === 'triangles').status).toBe('pass');
    // Built-in defaults: desktop does not simplify; mobile / low-power opt in through the profile.
    expect(DEFAULT_PROFILES.desktop.simplify).toBeNull();
    expect(DEFAULT_PROFILES.mobile.simplify).toMatchObject({ ratio: 0.75 });
    expect(DEFAULT_PROFILES['low-power'].simplify).toMatchObject({ ratio: 0.5 });
  });

  it('does not simplify morph-target meshes unless explicitly allowed', async () => {
    const morph = path.join(tmp, 'morph.glb');
    const m = await writeRichFixture(morph, { n: 10, morph: true });
    const r = await optimizeFile(morph, { outDir: outDir(), profile: profile('desktop', { simplify: 0.5, simplifyError: 0.05 }) });
    const step = r.steps.find((s) => s.id === 'simplify');
    expect(step.status).toBe('skipped');
    expect(step.detail.skippedMorphTargets).toBe(2);
    expect(r.summary.triangles.after).toBe(m.triangles);
    expect(r.ok).toBe(true);
  });

  it('respects the texture size budget and per-slot rules', async () => {
    const r = await optimizeFile(src, { outDir: outDir(), profile: profile('desktop', { textureMax: 64 }) });
    expect(r.textures.length).toBe(2);
    for (const t of r.textures) {
      expect(t.from).toMatchObject({ width: 256, height: 256, mimeType: 'image/png' });
      expect(t.to).toMatchObject({ width: 64, height: 64, mimeType: 'image/webp' });
      expect(t.action).toMatch(/resized/);
    }
    const normal = r.textures.find((t) => t.slots.includes('normalTexture'));
    const albedo = r.textures.find((t) => t.slots.includes('baseColorTexture'));
    expect(normal.colorSpace).toBe('linear');
    expect(albedo.colorSpace).toBe('srgb');
    expect(normal.rule.quality).toBeGreaterThan(albedo.rule.quality);
    const o = /** @type {any} */ (r).outputInspect;
    expect(o.textures.map((t) => [t.width, t.height, t.mimeType])).toEqual([[64, 64, 'image/webp'], [64, 64, 'image/webp']]);
    expect(o.totals.gpuTextureBytesEstimate).toBe(2 * gpuTextureBytesEstimate(64, 64));
    // A larger budget never upscales; "keep" leaves bytes alone.
    const keep = await optimizeFile(src, { outDir: outDir(), profile: profile('desktop', { textureFormat: 'keep', textureMax: 4096 }) });
    for (const t of keep.textures) { expect(t.action).toBe('kept'); expect(t.to).toEqual(t.from); }
    // Slot rule: the most conservative rule wins when a texture feeds several slots.
    expect(textureRuleFor({ format: 'webp', maxSize: 512, quality: 70, slots: { normalTexture: { maxSize: 1024, quality: 95 } } }, ['normalTexture', 'baseColorTexture'])).toMatchObject({ maxSize: 1024, quality: 95 });
  });

  it('records an explicit skip when KTX2 is requested but the ktx CLI is unavailable', async () => {
    const env = { PATH: path.join(tmp, 'empty-bin') };
    expect(detectKtx(env)).toMatchObject({ available: false, reason: expect.stringMatching(/ktx.*KTX-Software.*not found on PATH/) });
    const r = await optimizeFile(src, { outDir: outDir(), profile: profile('desktop', { textureFormat: 'ktx2' }), env });
    expect(r.ok).toBe(true);
    expect(r.notes.join('\n')).toMatch(/skipped: ktx2 unavailable/);
    const step = r.steps.find((s) => s.id === 'textures');
    expect(step.detail.ktx).toMatchObject({ requested: true, available: false });
    for (const t of r.textures) { expect(t.note).toMatch(/skipped: ktx2 unavailable/); expect(t.to.mimeType).toBe('image/webp'); }
    expect(r.extensionsRequired).not.toContain('KHR_texture_basisu');
    expect(ktxCreateArgs({ input: 'a.png', output: 'b.ktx2', srgb: false })).toEqual(expect.arrayContaining(['create', 'R8G8B8A8_UNORM', 'uastc', 'a.png', 'b.ktx2']));
  });

  it('supports Draco and uncompressed output, reporting skipped steps', async () => {
    const draco = await optimizeFile(src, { outDir: outDir(), profile: profile('desktop', { compress: 'draco' }) });
    expect(draco.ok).toBe(true);
    expect(draco.extensionsRequired).toContain('KHR_draco_mesh_compression');
    expect(draco.steps.find((s) => s.id === 'quantize')).toMatchObject({ status: 'skipped', reason: expect.stringMatching(/Draco/) });
    expect(draco.decoderRequirements.find((d) => d.extension === 'KHR_draco_mesh_compression').three).toMatch(/DRACOLoader/);
    const none = await optimizeFile(src, { outDir: outDir(), profile: profile('desktop', { compress: 'none', quantize: false, textureFormat: 'keep' }) });
    expect(none.ok).toBe(true);
    expect(none.extensionsRequired).toEqual([]);
    expect(none.decoderRequirements).toEqual([]);
    expect(none.steps.find((s) => s.id === 'compress').status).toBe('skipped');
  });

  it('runs end-to-end through the CLI with flags', async () => {
    const out = outDir();
    const { code, stdout } = await cli(['optimize', src, '--out', out, '--profile', 'mobile', '--simplify', '0.6', '--simplify-error', '0.05', '--texture-max', '128', '--name', 'cli-panel', '--json']);
    expect(code).toBe(0);
    const r = JSON.parse(stdout);
    expect(r.ok).toBe(true);
    expect(r.profile.origin).toMatch(/built-in default \+ flags/);
    expect(r.profile.settings.simplify.ratio).toBe(0.6);
    expect(fs.existsSync(path.join(out, 'cli-panel.glb'))).toBe(true);
    await expect(main(['optimize', src, '--out', out, '--simplify', '1.5'])).rejects.toMatchObject({ name: 'UserError' });
    await expect(main(['optimize', src, '--out', out, '--compress', 'zip'])).rejects.toMatchObject({ name: 'UserError' });
  });

  it('derives default names without the .source suffix', () => {
    expect(defaultName('/x/pulse-speaker.source.glb')).toBe('pulse-speaker');
    expect(defaultName('/x/thing.gltf')).toBe('thing');
  });
});

describe('assets variants + manifest', () => {
  it('writes one GLB per profile, a manifest with the documented schema and a combined report', async () => {
    const src = path.join(tmp, 'vsrc', 'widget.source.glb'); fs.mkdirSync(path.dirname(src));
    await writeRichFixture(src, { n: 16 });
    const before = sha(src);
    const out = outDir();
    const budgets = path.join(tmp, 'budgets.json');
    fs.writeFileSync(budgets, JSON.stringify({ profiles: { mobile: { simplify: { ratio: 0.6, error: 0.05 }, textures: { maxSize: 128 }, budgets: { maxTriangles: 10 } }, kiosk: { compress: 'none', textures: { format: 'keep' } } } }));
    const res = await buildVariants(src, { outDir: out, profiles: ['desktop', 'mobile', 'kiosk'], budgets });
    expect(res.ok).toBe(true);
    expect(sha(src)).toBe(before);
    for (const f of ['widget.desktop.glb', 'widget.mobile.glb', 'widget.kiosk.glb', 'widget.manifest.json', 'widget.variants.report.json', 'widget.variants.report.md']) expect(fs.existsSync(path.join(out, f))).toBe(true);
    expect(res.thumbnail.status).toBe('skipped');
    expect(res.variants[1].profile.origin).toMatch(/budgets file/);
    expect(res.variants[1].budgets).toEqual([expect.objectContaining({ budget: 'maxTriangles', limit: 10, ok: false })]);

    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'widget.manifest.json'), 'utf8'));
    expect(manifest.generator).toBe('Maquettekit Asset Pipeline');
    expect(Number.isNaN(Date.parse(manifest.generatedAt))).toBe(false);
    expect(manifest.assets).toHaveLength(1);
    const asset = manifest.assets[0];
    expect(asset.id).toBe('widget');
    expect(asset.source).toEqual({ file: path.relative(out, src).split(path.sep).join('/'), sha256: before, bytes: fs.statSync(src).size });
    expect(asset.variants.map((v) => v.profile)).toEqual(['desktop', 'mobile', 'kiosk']);
    for (const v of asset.variants) {
      expect(v).toEqual(expect.objectContaining({
        file: `widget.${v.profile}.glb`, bytes: fs.statSync(path.join(out, v.file)).size,
        triangles: expect.any(Number), vertices: expect.any(Number), gpuTextureBytesEstimate: expect.any(Number),
        extensionsRequired: expect.any(Array), compression: expect.stringMatching(/^(meshopt|draco|none)$/),
      }));
      for (const t of v.textures) expect(t).toEqual(expect.objectContaining({ w: expect.any(Number), h: expect.any(Number), mime: expect.stringMatching(/^image\//) }));
    }
    const [desktop, mobile, kiosk] = asset.variants;
    expect(desktop.compression).toBe('meshopt');
    expect(kiosk.compression).toBe('none');
    expect(mobile.triangles).toBeLessThan(desktop.triangles);
    expect(mobile.textures.every((t) => t.w === 128)).toBe(true);
    expect(desktop.textures.every((t) => t.w === 256 && t.mime === 'image/webp')).toBe(true);
    expect(asset.animations).toEqual(['Bounce']);
    expect(asset.parts).toEqual(expect.arrayContaining(['Assembly', 'PanelLeft', 'PanelRight']));
    expect(asset.bounds.size).toHaveLength(3);
    expect(asset).not.toHaveProperty('thumbnail');

    // `manifest <dir>` rebuilds the same information by scanning the directory.
    const scanned = await scanDirectory(out);
    expect(scanned.assets).toHaveLength(1);
    expect(scanned.assets[0].variants.map((v) => [v.profile, v.bytes])).toEqual(asset.variants.map((v) => [v.profile, v.bytes]));
    expect(scanned.assets[0].source).toMatchObject({ sha256: before, bytes: fs.statSync(src).size });
    const { code } = await cli(['manifest', out, '--json']);
    expect(code).toBe(0);
    expect(JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8')).assets[0].id).toBe('widget');
    await expect(main(['manifest', out])).rejects.toMatchObject({ name: 'UserError' }); // refuses to overwrite
    expect(parseVariantName('pulse-speaker.low-power.glb')).toEqual({ id: 'pulse-speaker', profile: 'low-power' });
    expect(parseVariantName('plain.glb')).toEqual({ id: 'plain', profile: 'default' });
  });

  it('rejects unknown profiles and malformed profile files', () => {
    expect(() => resolveProfile('ultra')).toThrow(/Unknown profile/);
    const bad = path.join(tmp, 'bad-profile.json');
    fs.writeFileSync(bad, JSON.stringify({ compress: 'zip' }));
    expect(() => resolveProfile(bad)).toThrow(/compress must be/);
    const good = path.join(tmp, 'tv.json');
    fs.writeFileSync(good, JSON.stringify({ extends: 'mobile', textures: { maxSize: 4096 } }));
    const r = resolveProfile(good);
    expect(r.name).toBe('tv');
    expect(r.profile.textures.maxSize).toBe(4096);
    expect(r.profile.simplify.ratio).toBe(0.75);
  });
});

describe('assets import (Blender)', () => {
  it('builds an argv array for blender -b -P convert.py -- in out', () => {
    expect(blenderArgs('/in/model one.fbx', '/out/model.glb')).toEqual(['-b', '-P', CONVERT_SCRIPT, '--', '/in/model one.fbx', '/out/model.glb']);
    expect(fs.existsSync(CONVERT_SCRIPT)).toBe(true);
    expect(fs.readFileSync(CONVERT_SCRIPT, 'utf8')).toContain('export_scene.gltf');
  });

  it('detects Blender from PATH or an explicit override', () => {
    const empty = path.join(tmp, 'no-bin'); fs.mkdirSync(empty, { recursive: true });
    expect(detectBlender({ env: { PATH: empty } })).toMatchObject({ available: false, reason: expect.stringMatching(/Blender is not installed or not on PATH/) });
    const bin = path.join(tmp, 'fake-bin'); fs.mkdirSync(bin, { recursive: true });
    const fake = path.join(bin, process.platform === 'win32' ? 'blender.exe' : 'blender');
    fs.writeFileSync(fake, '#!/bin/sh\nexit 0\n'); fs.chmodSync(fake, 0o755);
    expect(detectBlender({ env: { PATH: bin, PATHEXT: '.EXE' } })).toEqual({ available: true, path: fake });
    expect(detectBlender({ blender: fake, env: { PATH: '' } })).toEqual({ available: true, path: fake });
    expect(detectBlender({ blender: path.join(bin, 'nope'), env: { PATH: bin } }).available).toBe(false);
  });

  it('reports "unavailable" with exit code 3 when Blender is missing', async () => {
    const input = path.join(tmp, 'model.obj');
    fs.writeFileSync(input, 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n');
    const out = path.join(outDir(), 'model.glb');
    const res = await importWithBlender(input, out, { env: { PATH: path.join(tmp, 'no-bin') } });
    expect(res.status).toBe('unavailable');
    expect(res.reason).toMatch(/Blender/);
    expect(fs.existsSync(out)).toBe(false);
    if (!detectBlender().available) {
      const { code, stdout } = await cli(['import', input, '--out', out, '--json']);
      expect(code).toBe(3);
      expect(JSON.parse(stdout)).toMatchObject({ status: 'unavailable' });
      expect(fs.existsSync(out)).toBe(false);
    }
    await expect(main(['import', path.join(tmp, 'known.glb'), '--out', out])).rejects.toMatchObject({ name: 'UserError' }); // .glb is not an import format
  });
});

describe('assets thumbnail', () => {
  it('produces a non-blank PNG, or an explicit skip with a reason', async () => {
    const file = path.join(tmp, 'known.glb');
    const out = path.join(outDir(), 'thumb.png');
    const { code, stdout } = await cli(['thumbnail', file, '--out', out, '--size', '128', '--background', '#202030', '--json']);
    const r = JSON.parse(stdout);
    expect(code).toBe(0);
    expect(['ok', 'skipped']).toContain(r.status);
    if (r.status === 'ok') {
      const meta = await sharp(out).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual(['png', 128, 128]);
      const stats = await sharp(out).stats();
      expect(Math.max(...stats.channels.map((c) => c.stdev))).toBeGreaterThan(1);
      expect(r.blank).toBe(false);
      expect(r.triangles).toBe(2 * 2 + 1 + 3);
    } else {
      console.warn(`thumbnail skipped: ${r.reason}`);
      expect(r.reason).toBeTruthy();
      expect(fs.existsSync(out)).toBe(false);
    }
  }, 120_000);

  it('skips explicitly (exit 0, or 3 with --require) when WebGL is unavailable', async () => {
    const file = path.join(tmp, 'known.glb');
    const res = await renderThumbnail(file, { size: 64, gpu: false });
    expect(res.status).toBe('skipped');
    expect(/** @type {any} */ (res).reason).toBeTruthy();
  }, 120_000);

  it('validates its arguments', async () => {
    const file = path.join(tmp, 'known.glb');
    await expect(main(['thumbnail', file, '--out', path.join(tmp, 't.jpg')])).rejects.toMatchObject({ name: 'UserError' });
    await expect(main(['thumbnail', file, '--out', path.join(tmp, 't.png'), '--background', 'blue'])).rejects.toMatchObject({ name: 'UserError' });
    await expect(main(['thumbnail', file])).rejects.toMatchObject({ name: 'UserError' });
  });
});

describe('sample models (smoke)', () => {
  it.skipIf(!fs.existsSync(ORBIT))('optimizes orbit-token and keeps its contract (node Token, clip Spin)', async () => {
    const before = sha(ORBIT);
    const src = await inspectFile(ORBIT);
    expect(src.namedNodes.map((n) => n.name)).toEqual(['Token']);
    expect(src.animations.map((a) => [a.name, a.duration])).toEqual([['Spin', 4]]);
    expect(src.materials.map((m) => m.name)).toEqual(['TokenMetal']);
    expect(src.totals.triangles).toBeGreaterThan(4000);
    expect(src.totals.triangles).toBeLessThan(6500);
    const report = await optimizeFile(ORBIT, { outDir: outDir(), profile: profile('desktop') });
    expect(report.ok).toBe(true);
    expect(report.name).toBe('orbit-token');
    expect(report.output.bytes).toBeLessThan(report.source.bytes);
    expect(report.summary.triangles.after).toBe(src.totals.triangles);
    expect(sha(ORBIT)).toBe(before);
  });
});
