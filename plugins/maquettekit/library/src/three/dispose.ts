/**
 * Explicit GPU resource lifecycle helpers for three.js.
 * three.js does not garbage-collect GPU resources: geometries, materials,
 * textures and render targets must be disposed when a scene goes away.
 */
import type { BufferGeometry, Material, Object3D, Texture, WebGLRenderer } from 'three';

type Disposable = { dispose: () => void };
const isTexture = (v: unknown): v is Texture => !!v && typeof v === 'object' && (v as { isTexture?: boolean }).isTexture === true;

/** Dispose a material and every texture referenced by its properties/uniforms. */
export function disposeMaterial(material: Material, seen: Set<unknown> = new Set()): number {
  if (seen.has(material)) return 0;
  seen.add(material);
  let n = 0;
  for (const value of Object.values(material as unknown as Record<string, unknown>)) {
    if (isTexture(value) && !seen.has(value)) { seen.add(value); value.dispose(); n++; }
  }
  const uniforms = (material as unknown as { uniforms?: Record<string, { value: unknown }> }).uniforms;
  if (uniforms) for (const u of Object.values(uniforms)) {
    if (isTexture(u?.value) && !seen.has(u.value)) { seen.add(u.value); u.value.dispose(); n++; }
  }
  material.dispose();
  return n + 1;
}

/** Recursively dispose geometries, materials and textures under `root`. Returns the number of resources released. */
export function disposeObject(root: Object3D | null | undefined): number {
  if (!root) return 0;
  const seen = new Set<unknown>();
  let count = 0;
  root.traverse((obj) => {
    const mesh = obj as Object3D & { geometry?: BufferGeometry; material?: Material | Material[]; skeleton?: Disposable };
    if (mesh.geometry && !seen.has(mesh.geometry)) { seen.add(mesh.geometry); mesh.geometry.dispose(); count++; }
    if (mesh.material) for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) count += disposeMaterial(m, seen);
    mesh.skeleton?.dispose?.();
  });
  return count;
}

/** Collects disposables created imperatively so teardown is a single call. */
export class ResourceTracker {
  private items = new Set<Disposable | Object3D>();
  disposed = 0;
  track<T extends Disposable | Object3D>(item: T): T { this.items.add(item); return item; }
  dispose(): number {
    let n = 0;
    for (const item of this.items) {
      if ((item as Object3D).isObject3D) { n += disposeObject(item as Object3D); (item as Object3D).removeFromParent(); }
      else { (item as Disposable).dispose(); n++; }
    }
    this.items.clear();
    this.disposed += n;
    return n;
  }
}

/** Full renderer teardown for vanilla three.js scenes (R3F does this for its own renderer). */
export function disposeRenderer(renderer: WebGLRenderer, opts: { loseContext?: boolean } = {}): void {
  renderer.setAnimationLoop(null);
  renderer.renderLists.dispose();
  renderer.dispose();
  if (opts.loseContext !== false) renderer.forceContextLoss();
  renderer.domElement.remove();
}
