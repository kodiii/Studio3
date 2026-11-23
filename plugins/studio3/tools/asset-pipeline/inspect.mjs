// @ts-check
/**
 * `studio3 assets inspect` — structural report of a glTF/GLB asset.
 * Numbers are exact counts read from the file unless a field name ends in
 * `Estimate` (GPU texture memory, draw calls), which are labelled estimates.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadGltfTransform, readDocument, sha256File, formatBytes, DECODER_EXTENSIONS } from './io.mjs';

const MODE_NAMES = ['POINTS', 'LINES', 'LINE_LOOP', 'LINE_STRIP', 'TRIANGLES', 'TRIANGLE_STRIP', 'TRIANGLE_FAN'];

/**
 * Triangles drawn by a primitive, for every draw mode, indexed or not.
 * @param {number} mode @param {number} elementCount index count, or vertex count when non-indexed
 */
export function trianglesForMode(mode, elementCount) {
  if (mode === 4) return Math.floor(elementCount / 3);
  if (mode === 5 || mode === 6) return Math.max(0, elementCount - 2);
  return 0;
}

/**
 * Uncompressed RGBA8 GPU footprint including a full mip chain (×4/3). Estimate:
 * real usage depends on the format the engine uploads (KTX2 stays compressed on the GPU).
 * @param {number} w @param {number} h
 */
export function gpuTextureBytesEstimate(w, h) {
  return Math.round((w * h * 4 * 4) / 3);
}

/** @param {number[]} a */
const round = (a) => a.map((v) => Math.round(v * 1e6) / 1e6);

/**
 * @param {any} document gltf-transform Document
 * @param {{ file?: string, hash?: boolean }} [opts]
 */
export async function inspectDocument(document, opts = {}) {
  const { core, functions } = await loadGltfTransform();
  const root = document.getRoot();
  const NodeClass = core.Node;

  /** @type {Map<any, number>} */
  const meshInstances = new Map();
  /** @type {Set<any>} */
  const skinnedMeshes = new Set();
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    let count = 1;
    const inst = node.getExtension('EXT_mesh_gpu_instancing');
    if (inst) {
      const first = inst.listAttributes?.()[0];
      if (first) count = first.getCount();
    }
    meshInstances.set(mesh, (meshInstances.get(mesh) ?? 0) + count);
    if (node.getSkin()) skinnedMeshes.add(mesh);
  }

  /** @type {Set<any>} */
  const positionAccessors = new Set();
  let totalPrimitives = 0; let totalTriangles = 0; let renderedTriangles = 0; let drawCalls = 0; let renderedVertices = 0;

  const meshes = root.listMeshes().map((/** @type {any} */ mesh, /** @type {number} */ index) => {
    const instances = meshInstances.get(mesh) ?? 0;
    const attributes = new Set();
    const materials = new Set();
    let vertices = 0; let triangles = 0;
    const primitives = mesh.listPrimitives().map((/** @type {any} */ prim) => {
      const position = prim.getAttribute('POSITION');
      const indices = prim.getIndices();
      const vertexCount = position ? position.getCount() : 0;
      const elementCount = indices ? indices.getCount() : vertexCount;
      const mode = prim.getMode();
      const tris = trianglesForMode(mode, elementCount);
      if (position) positionAccessors.add(position);
      const semantics = prim.listSemantics();
      semantics.forEach((/** @type {string} */ s) => attributes.add(s));
      const material = prim.getMaterial();
      if (material) materials.add(material.getName() || `(unnamed material ${root.listMaterials().indexOf(material)})`);
      vertices += vertexCount; triangles += tris;
      return {
        mode: MODE_NAMES[mode] ?? String(mode),
        indexed: !!indices,
        vertices: vertexCount,
        indices: indices ? indices.getCount() : 0,
        triangles: tris,
        attributes: semantics.map((/** @type {string} */ s) => {
          const a = prim.getAttribute(s);
          return { semantic: s, type: a.getType(), componentType: componentName(a.getComponentType()), normalized: a.getNormalized() };
        }),
        material: material ? material.getName() || null : null,
        morphTargets: prim.listTargets().length,
      };
    });
    totalPrimitives += primitives.length;
    totalTriangles += triangles;
    renderedTriangles += triangles * instances;
    renderedVertices += vertices * instances;
    drawCalls += primitives.length * instances;
    return {
      index, name: mesh.getName() || null, primitives, primitiveCount: primitives.length,
      vertices, triangles, attributes: [...attributes], materials: [...materials], instances,
      morphTargets: primitives.reduce((/** @type {number} */ m, /** @type {any} */ p) => Math.max(m, p.morphTargets), 0),
      skinned: skinnedMeshes.has(mesh),
    };
  });

  let uniqueVertices = 0;
  for (const a of positionAccessors) uniqueVertices += a.getCount();

  const materials = root.listMaterials().map((/** @type {any} */ m, /** @type {number} */ index) => {
    /** @type {Record<string, string>} */
    const textures = {};
    const slotGetters = {
      baseColorTexture: 'getBaseColorTexture', metallicRoughnessTexture: 'getMetallicRoughnessTexture',
      normalTexture: 'getNormalTexture', occlusionTexture: 'getOcclusionTexture', emissiveTexture: 'getEmissiveTexture',
    };
    for (const [slot, getter] of Object.entries(slotGetters)) {
      const t = m[getter]();
      if (t) textures[slot] = textureLabel(t, root);
    }
    return {
      index, name: m.getName() || null,
      baseColorFactor: round(m.getBaseColorFactor()),
      metallicFactor: m.getMetallicFactor(), roughnessFactor: m.getRoughnessFactor(),
      emissiveFactor: round(m.getEmissiveFactor()),
      alphaMode: m.getAlphaMode(), alphaCutoff: m.getAlphaCutoff(), doubleSided: m.getDoubleSided(),
      textures, textureSlots: Object.keys(textures),
      extensions: m.listExtensions().map((/** @type {any} */ e) => e.extensionName),
      used: m.listParents().some((/** @type {any} */ p) => p.propertyType === 'Primitive'),
    };
  });

  let gpuTotal = 0; let textureBytes = 0;
  const textures = root.listTextures().map((/** @type {any} */ t, /** @type {number} */ index) => {
    const size = t.getSize();
    const image = t.getImage();
    const bytes = image ? image.byteLength : 0;
    const gpu = size ? gpuTextureBytesEstimate(size[0], size[1]) : null;
    if (gpu) gpuTotal += gpu;
    textureBytes += bytes;
    const [w, h] = size ?? [null, null];
    return {
      index, name: textureLabel(t, root), uri: t.getURI() || null, mimeType: t.getMimeType() || null,
      width: w, height: h, bytes,
      powerOfTwo: size ? isPot(size[0]) && isPot(size[1]) : null,
      slots: functions.listTextureSlots(t),
      colorSpace: functions.getTextureColorSpace(t) ?? 'linear',
      gpuBytesEstimate: gpu,
    };
  });

  const animations = root.listAnimations().map((/** @type {any} */ a, /** @type {number} */ index) => {
    let duration = 0;
    for (const s of a.listSamplers()) {
      const input = s.getInput();
      if (!input) continue;
      const max = input.getMax([]);
      if (max.length && max[0] > duration) duration = max[0];
    }
    const targets = a.listChannels().map((/** @type {any} */ c) => ({
      node: c.getTargetNode()?.getName() || null, path: c.getTargetPath(),
      interpolation: c.getSampler()?.getInterpolation() ?? null,
      keyframes: c.getSampler()?.getInput()?.getCount() ?? 0,
    }));
    return { index, name: a.getName() || null, channels: targets.length, samplers: a.listSamplers().length, duration: Math.round(duration * 1e6) / 1e6, targets };
  });

  const skins = root.listSkins().map((/** @type {any} */ s, /** @type {number} */ index) => ({
    index, name: s.getName() || null, joints: s.listJoints().length, skeleton: s.getSkeleton()?.getName() || null,
  }));

  /** @param {any} node @returns {any} */
  const nodeTree = (node) => {
    const mesh = node.getMesh();
    /** @type {any} */
    const out = { name: node.getName() || null };
    if (mesh) out.mesh = mesh.getName() || `(mesh ${root.listMeshes().indexOf(mesh)})`;
    if (node.getSkin()) out.skin = node.getSkin().getName() || true;
    if (node.getCamera()) out.camera = node.getCamera().getName() || true;
    if (node.getExtension('KHR_lights_punctual')) out.light = true;
    if (node.getExtension('EXT_mesh_gpu_instancing')) out.gpuInstancing = true;
    const extras = node.getExtras();
    if (extras && Object.keys(extras).length) out.extras = extras;
    out.translation = round(node.getTranslation());
    const r = node.getRotation(); const s = node.getScale();
    if (r.some((/** @type {number} */ v, /** @type {number} */ i) => Math.abs(v - (i === 3 ? 1 : 0)) > 1e-9)) out.rotation = round(r);
    if (s.some((/** @type {number} */ v) => Math.abs(v - 1) > 1e-9)) out.scale = round(s);
    const children = node.listChildren().map(nodeTree);
    if (children.length) out.children = children;
    return out;
  };

  const defaultScene = root.getDefaultScene() ?? root.listScenes()[0] ?? null;
  const scenes = root.listScenes().map((/** @type {any} */ scene, /** @type {number} */ index) => ({
    index, name: scene.getName() || null, default: scene === defaultScene, nodes: scene.listChildren().map(nodeTree),
  }));

  let bounds = null;
  if (defaultScene) {
    const b = functions.getBounds(defaultScene);
    if (b.min.every(Number.isFinite) && b.max.every(Number.isFinite)) {
      const size = b.max.map((/** @type {number} */ v, /** @type {number} */ i) => v - b.min[i]);
      bounds = {
        min: round(b.min), max: round(b.max), size: round(size),
        center: round(b.min.map((/** @type {number} */ v, /** @type {number} */ i) => (v + b.max[i]) / 2)),
        diagonal: Math.round(Math.hypot(size[0], size[1], size[2]) * 1e6) / 1e6,
      };
    }
  }

  const nodes = root.listNodes();
  const namedNodes = nodes.filter((/** @type {any} */ n) => n.getName()).map((/** @type {any} */ n) => {
    const parent = n.getParentNode?.() ?? n.listParents().find((/** @type {any} */ p) => p instanceof NodeClass) ?? null;
    return { name: n.getName(), parent: parent ? parent.getName() || null : null, extras: n.getExtras() ?? {}, hasMesh: !!n.getMesh() };
  });

  const extensionsUsed = root.listExtensionsUsed().map((/** @type {any} */ e) => e.extensionName).sort();
  const extensionsRequired = root.listExtensionsRequired().map((/** @type {any} */ e) => e.extensionName).sort();

  /** @type {any} */
  const report = {
    file: opts.file ? path.basename(opts.file) : null,
    path: opts.file ?? null,
    fileBytes: null,
    asset: root.getAsset(),
    totals: {
      scenes: scenes.length, nodes: nodes.length, namedNodes: namedNodes.length,
      meshes: meshes.length, primitives: totalPrimitives,
      vertices: uniqueVertices, triangles: totalTriangles,
      renderedVertices, renderedTriangles,
      materials: materials.length, textures: textures.length, textureBytes,
      animations: animations.length, skins: skins.length, cameras: root.listCameras().length,
      accessors: root.listAccessors().length,
      gpuTextureBytesEstimate: gpuTotal,
      drawCallsEstimate: drawCalls,
    },
    notes: {
      vertices: 'Sum of POSITION accessor counts over unique accessors (vertices uploaded to the GPU).',
      triangles: 'Per unique mesh, all draw modes; renderedTriangles multiplies by instance count.',
      gpuTextureBytesEstimate: 'Estimate: uncompressed RGBA8 with full mip chain (w×h×4×4/3). GPU-compressed formats (KTX2/Basis) use less.',
      drawCallsEstimate: 'Estimate: primitives × node instances, before any engine-side batching, culling or multi-pass rendering.',
    },
    bounds,
    scenes, meshes, materials, textures, animations, skins, namedNodes,
    extensionsUsed, extensionsRequired,
    decoders: extensionsUsed.filter((e) => e in DECODER_EXTENSIONS),
  };
  if (opts.file && fs.existsSync(opts.file)) {
    report.fileBytes = fs.statSync(opts.file).size;
    if (opts.hash !== false) report.sha256 = sha256File(opts.file);
  }
  return report;
}

/** @param {any} t @param {any} root */
function textureLabel(t, root) {
  return t.getName() || t.getURI() || `texture_${root.listTextures().indexOf(t)}`;
}
/** @param {number} n */
function isPot(n) { return n > 0 && (n & (n - 1)) === 0; }
/** @param {number} c */
function componentName(c) {
  return /** @type {Record<number, string>} */ ({ 5120: 'BYTE', 5121: 'UNSIGNED_BYTE', 5122: 'SHORT', 5123: 'UNSIGNED_SHORT', 5125: 'UNSIGNED_INT', 5126: 'FLOAT' })[c] ?? String(c);
}

/**
 * Inspect a file on disk (read-only).
 * @param {string} file absolute path
 */
export async function inspectFile(file) {
  const { document } = await readDocument(file);
  return inspectDocument(document, { file });
}

/** Human-readable rendering of an inspect report. @param {any} r */
export function formatInspect(r) {
  const L = [];
  const t = r.totals;
  L.push(`${r.file ?? '(document)'} — ${r.fileBytes != null ? formatBytes(r.fileBytes) : 'in memory'}${r.sha256 ? `  sha256 ${r.sha256.slice(0, 16)}…` : ''}`);
  L.push(`generator: ${r.asset?.generator ?? 'unknown'}   glTF ${r.asset?.version ?? '?'}`);
  L.push('');
  L.push('Totals');
  L.push(`  meshes ${t.meshes}  primitives ${t.primitives}  vertices ${t.vertices.toLocaleString('en-US')}  triangles ${t.triangles.toLocaleString('en-US')}`);
  L.push(`  materials ${t.materials}  textures ${t.textures} (${formatBytes(t.textureBytes)} encoded)  animations ${t.animations}  skins ${t.skins}`);
  L.push(`  GPU texture memory (estimate, RGBA8 + mips): ${formatBytes(t.gpuTextureBytesEstimate)}`);
  L.push(`  draw calls (estimate, primitives × instances): ${t.drawCallsEstimate}`);
  if (r.bounds) L.push(`  bounds min [${r.bounds.min.join(', ')}] max [${r.bounds.max.join(', ')}] size [${r.bounds.size.join(', ')}]`);
  L.push(`  extensionsUsed: ${r.extensionsUsed.join(', ') || 'none'}`);
  L.push(`  extensionsRequired: ${r.extensionsRequired.join(', ') || 'none'}`);
  L.push('');
  L.push('Scene hierarchy');
  /** @param {any} n @param {string} indent */
  const walk = (n, indent) => {
    const flags = [n.mesh ? `mesh:${n.mesh}` : '', n.skin ? 'skin' : '', n.camera ? 'camera' : '', n.light ? 'light' : '', n.gpuInstancing ? 'instanced' : '', n.extras ? 'extras' : ''].filter(Boolean);
    L.push(`${indent}- ${n.name ?? '(unnamed)'}${flags.length ? `  [${flags.join(', ')}]` : ''}`);
    for (const c of n.children ?? []) walk(c, `${indent}  `);
  };
  for (const s of r.scenes) {
    L.push(`  scene ${s.index}${s.name ? ` "${s.name}"` : ''}${s.default ? ' (default)' : ''}`);
    for (const n of s.nodes) walk(n, '    ');
  }
  L.push('');
  L.push('Meshes');
  for (const m of r.meshes) {
    L.push(`  ${m.name ?? `(mesh ${m.index})`}: ${m.primitiveCount} prim, ${m.vertices.toLocaleString('en-US')} verts, ${m.triangles.toLocaleString('en-US')} tris, ×${m.instances} instance(s)${m.skinned ? ', skinned' : ''}${m.morphTargets ? `, ${m.morphTargets} morph targets` : ''}`);
    L.push(`    attributes: ${m.attributes.join(', ')}   materials: ${m.materials.join(', ') || 'default'}   ${m.primitives.map((/** @type {any} */ p) => `${p.mode}${p.indexed ? '/indexed' : '/non-indexed'}`).join(', ')}`);
  }
  L.push('');
  L.push('Materials');
  for (const m of r.materials) {
    L.push(`  ${m.name ?? `(material ${m.index})`}: baseColor [${m.baseColorFactor.join(', ')}] metallic ${m.metallicFactor} roughness ${m.roughnessFactor} emissive [${m.emissiveFactor.join(', ')}] alpha ${m.alphaMode}${m.doubleSided ? ' double-sided' : ''}`);
    if (m.textureSlots.length) L.push(`    textures: ${Object.entries(m.textures).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  }
  if (r.textures.length) {
    L.push('');
    L.push('Textures');
    for (const x of r.textures) L.push(`  ${x.name}: ${x.mimeType} ${x.width}×${x.height} ${formatBytes(x.bytes)} [${x.slots.join(', ') || 'unused'}] ${x.colorSpace}  GPU≈${x.gpuBytesEstimate != null ? formatBytes(x.gpuBytesEstimate) : 'n/a'} (estimate)`);
  }
  if (r.animations.length) {
    L.push('');
    L.push('Animations');
    for (const a of r.animations) L.push(`  ${a.name ?? `(animation ${a.index})`}: ${a.channels} channel(s), ${a.duration}s → ${a.targets.map((/** @type {any} */ c) => `${c.node ?? '?'}.${c.path}`).join(', ')}`);
  }
  if (r.skins.length) {
    L.push('');
    L.push('Skins');
    for (const s of r.skins) L.push(`  ${s.name ?? `(skin ${s.index})`}: ${s.joints} joints`);
  }
  return L.join('\n');
}
