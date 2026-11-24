/**
 * ModelStats — real numbers computed from a loaded scene graph (never from a manifest or a guess).
 * GPU memory is an ESTIMATE: drivers pad, compress and mip differently; label it as such in UI.
 */
import type { AnimationClip, BufferGeometry, InstancedMesh, Material, Object3D, Texture } from 'three';

export interface ModelStats {
  /** Renderable meshes (each is at least one draw call per material group). */
  meshes: number;
  /** Triangles submitted per frame when everything is visible (instances multiplied). */
  triangles: number;
  vertices: number;
  /** Unique geometries / materials / textures. */
  geometries: number;
  materials: number;
  textures: number;
  /** Largest texture edge in px (0 when there are no textures). */
  largestTexture: { width: number; height: number };
  /** Estimated GPU bytes for textures (RGBA8 + mip chain, or the compressed payload when known). */
  estimatedTextureBytes: number;
  /** Estimated GPU bytes for vertex + index buffers. */
  estimatedGeometryBytes: number;
  animations: number;
  /** Total clip time in seconds. */
  animationSeconds: number;
  /** Named nodes (useful for part pickers). */
  nodes: number;
}

type MeshLike = Object3D & { isMesh?: boolean; isPoints?: boolean; isLine?: boolean; geometry?: BufferGeometry; material?: Material | Material[] };

export function computeModelStats(root: Object3D, animations: readonly AnimationClip[] = []): ModelStats {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  let meshes = 0, triangles = 0, vertices = 0, nodes = 0;
  root.traverse((o) => {
    if (o.name) nodes++;
    const m = o as MeshLike;
    if (!m.geometry || !(m.isMesh || m.isPoints || m.isLine)) return;
    meshes++;
    const g = m.geometry;
    const instances = (o as InstancedMesh).isInstancedMesh ? (o as InstancedMesh).count : 1;
    const pos = g.getAttribute('position');
    const count = g.index ? g.index.count : pos ? pos.count : 0;
    if (m.isMesh) triangles += Math.floor(count / 3) * instances;
    vertices += (pos ? pos.count : 0) * instances;
    geometries.add(g);
    for (const mat of m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : []) {
      materials.add(mat);
      for (const v of Object.values(mat as unknown as Record<string, unknown>)) if ((v as Texture | null)?.isTexture) textures.add(v as Texture);
    }
  });
  let geoBytes = 0;
  for (const g of geometries) {
    for (const a of Object.values(g.attributes)) geoBytes += (a.array as ArrayLike<number> & { byteLength?: number }).byteLength ?? 0;
    if (g.index) geoBytes += (g.index.array as { byteLength: number }).byteLength;
  }
  let texBytes = 0;
  const largest = { width: 0, height: 0 };
  for (const t of textures) {
    const img = t.image as { width?: number; height?: number } | null | undefined;
    const w = img?.width ?? 0, h = img?.height ?? 0;
    if (w * h > largest.width * largest.height) { largest.width = w; largest.height = h; }
    const mips = (t as Texture & { mipmaps?: { data?: { byteLength: number } }[] }).mipmaps;
    const compressed = (t as Texture & { isCompressedTexture?: boolean }).isCompressedTexture && mips?.length;
    texBytes += compressed ? mips.reduce((s, m) => s + (m.data?.byteLength ?? 0), 0) : Math.round(w * h * 4 * (t.generateMipmaps ? 4 / 3 : 1));
  }
  return {
    meshes, triangles, vertices, geometries: geometries.size, materials: materials.size, textures: textures.size,
    largestTexture: largest, estimatedTextureBytes: texBytes, estimatedGeometryBytes: geoBytes,
    animations: animations.length, animationSeconds: animations.reduce((s, c) => s + c.duration, 0), nodes,
  };
}

/** 1536 → "1.5 kB". Decimal units, matching how file sizes are quoted in manifests and devtools. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return '—';
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1e6) return `${(bytes / 1e3).toFixed(bytes < 1e4 ? 1 : 0)} kB`;
  return `${(bytes / 1e6).toFixed(bytes < 1e7 ? 2 : 1)} MB`;
}

export const formatCount = (n: number | null | undefined): string => (n == null || !Number.isFinite(n) ? '—' : Math.round(n).toLocaleString('en-US'));
