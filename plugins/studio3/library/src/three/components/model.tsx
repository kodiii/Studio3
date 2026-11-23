'use client';
/**
 * GLB loading for the three-kit.
 *
 * Design decisions (read before swapping this for drei's `useGLTF`):
 *  - **Own cache, reference counted.** drei/`useLoader` keep every loaded asset in a global cache forever unless
 *    you remember to call `useGLTF.clear()`. Here the cache entry OWNS the GPU resources (geometries, materials,
 *    textures) and disposes them ~1 s after the last consumer unmounts (the delay survives StrictMode / "Replay"
 *    remounts without a re-download).
 *  - **Consumers get clones.** `useModel()` returns a `SkeletonUtils.clone()` of the cached scene: its own node
 *    graph (safe to move, hide, explode, animate) sharing geometries/materials with the cache entry. Anything that
 *    wants to change a material must clone it first — `PartController` does.
 *  - **Honest progress.** Bytes are counted from the response stream. A fraction is only reported when the server
 *    sent a usable `Content-Length`; otherwise progress is indeterminate (`fraction === null`).
 *  - **Typed failures.** A missing file, a network failure and a decode failure are different `ModelLoadError`
 *    kinds, thrown during render so an error boundary (`ModelBoundary`, or StudioCanvas's own) can show a fallback.
 *  - **Decoders.** Meshopt (`EXT_meshopt_compression`) is always wired — the decoder is ~30 kB of embedded WASM.
 *    DRACO is only fetched when the file declares `KHR_draco_mesh_compression` and a decoder path was configured.
 */
import { Component, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { AnimationClip, Material, Object3D, Texture } from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneWithSkeletons } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { ThreeElements } from '@react-three/fiber';
import { useThree } from '@react-three/fiber';
import { disposeObject } from '../dispose';
import type { QualityProfile } from '../quality';
import { useQuality } from '../StudioCanvas';

/* ── Errors ───────────────────────────────────────────────────────────────── */

/** `missing` = HTTP 404/410, `network` = request failed or other HTTP status, `decode` = bytes arrived but could not be parsed. */
export type ModelErrorKind = 'missing' | 'network' | 'decode';

export class ModelLoadError extends Error {
  readonly kind: ModelErrorKind;
  readonly url: string;
  readonly status?: number;
  constructor(kind: ModelErrorKind, url: string, message: string, status?: number) {
    super(message);
    this.name = 'ModelLoadError';
    this.kind = kind;
    this.url = url;
    this.status = status;
  }
}
export const isModelLoadError = (e: unknown): e is ModelLoadError => e instanceof Error && e.name === 'ModelLoadError';

/* ── Manifest ─────────────────────────────────────────────────────────────── */

export type ModelVariantName = QualityProfile['modelVariant'];

/** One optimised build of a model, as written by the Studio³ asset pipeline (`*.manifest.json` → assets[].variants[]). */
export interface ModelVariantInfo {
  /** Quality profile this build targets. */
  profile: string;
  /** File path relative to the manifest. */
  file: string;
  bytes?: number;
  triangles?: number;
  vertices?: number;
  drawCallsEstimate?: number;
  textures?: readonly { w: number; h: number; mime?: string; bytes?: number; slots?: readonly string[] }[];
  gpuTextureBytesEstimate?: number;
  compression?: string;
  [k: string]: unknown;
}
/** One asset entry of a manifest file. */
export interface ModelManifest {
  id: string;
  variants: readonly ModelVariantInfo[];
  thumbnail?: string;
  /** Static preview used as poster / no-WebGL fallback (relative to the manifest). */
  fallbackImage?: string;
  animations?: readonly string[];
  parts?: readonly string[];
  materials?: readonly string[];
  bounds?: { min: number[]; max: number[]; size: number[]; center: number[] };
  [k: string]: unknown;
}
/** The file on disk: `{ assets: [...] }`. */
export interface ModelManifestFile { schemaVersion?: number; assets: readonly ModelManifest[]; [k: string]: unknown }

const ORDER: ModelVariantName[] = ['desktop', 'mobile', 'low-power'];

/** Pick the variant for a quality profile, falling back to the nearest build that exists (e.g. a desktop-only asset). */
export function resolveModelVariant(manifest: ModelManifest, want: ModelVariantName | string): ModelVariantInfo | null {
  const direct = manifest.variants.find((v) => v.profile === want);
  if (direct) return direct;
  const i = ORDER.indexOf(want as ModelVariantName);
  const near = [...ORDER].sort((a, b) => Math.abs(ORDER.indexOf(a) - i) - Math.abs(ORDER.indexOf(b) - i));
  for (const n of near) { const v = manifest.variants.find((x) => x.profile === n); if (v) return v; }
  return manifest.variants[0] ?? null;
}

/** Resolve a variant file against the manifest URL (`/models/x.manifest.json` + `x.mobile.glb` → `/models/x.mobile.glb`). */
export function resolveModelUrl(file: string, manifestUrl?: string): string {
  if (/^(?:[a-z]+:)?\/\//i.test(file) || file.startsWith('/') || !manifestUrl) return file;
  return manifestUrl.slice(0, manifestUrl.lastIndexOf('/') + 1) + file.replace(/^\.\//, '');
}

export interface ManifestState { manifest: ModelManifest | null; error: Error | null; loading: boolean }
const manifestCache = new Map<string, Promise<ModelManifestFile>>();

/**
 * Fetch (and memoise) a manifest file and return one asset entry (`id`, or the first). DOM-side hook: use it
 * outside the canvas to drive pickers, byte sizes and stat panels.
 */
export function useModelManifest(url: string | null | undefined, id?: string): ManifestState {
  const [state, setState] = useState<ManifestState>({ manifest: null, error: null, loading: !!url });
  useEffect(() => {
    if (!url) { setState({ manifest: null, error: null, loading: false }); return; }
    let alive = true;
    setState({ manifest: null, error: null, loading: true });
    let p = manifestCache.get(url);
    if (!p) {
      p = fetch(url).then((r) => {
        if (!r.ok) throw new ModelLoadError(r.status === 404 ? 'missing' : 'network', url, `Model manifest request failed (${r.status})`, r.status);
        return r.json() as Promise<ModelManifestFile>;
      });
      manifestCache.set(url, p);
      p.catch(() => manifestCache.delete(url));
    }
    p.then((file) => {
      if (!alive) return;
      const manifest = (id ? file.assets?.find((a) => a.id === id) : file.assets?.[0]) ?? null;
      setState(manifest ? { manifest, error: null, loading: false } : { manifest: null, error: new ModelLoadError('missing', url, `Manifest ${url} has no asset${id ? ` "${id}"` : ''}`), loading: false });
    }, (error: Error) => { if (alive) setState({ manifest: null, error, loading: false }); });
    return () => { alive = false; };
  }, [url, id]);
  return state;
}

/* ── Loader + cache ───────────────────────────────────────────────────────── */

export interface ModelProgress {
  /** Bytes received so far. */
  loaded: number;
  /** Total bytes when the server declared them (uncompressed transfer), else null. */
  total: number | null;
  /** 0..1 when `total` is known, otherwise null → render an indeterminate indicator. */
  fraction: number | null;
  status: 'idle' | 'loading' | 'decoding' | 'ready' | 'error';
}
const IDLE: ModelProgress = { loaded: 0, total: null, fraction: null, status: 'idle' };

interface Entry {
  url: string;
  status: 'pending' | 'ready' | 'error';
  promise: Promise<void>;
  gltf?: GLTF;
  error?: ModelLoadError;
  bytes: number;
  progress: ModelProgress;
  listeners: Set<() => void>;
  refs: number;
  timer?: ReturnType<typeof setTimeout>;
}
const cache = new Map<string, Entry>();
const progressListeners = new Map<string, Set<() => void>>();

export interface ModelLoaderConfig {
  /** Folder that serves `draco_decoder.wasm` + `draco_wasm_wrapper.js`. Only requested when a file needs DRACO. */
  dracoDecoderPath?: string;
  /** Last-chance hook to add loaders/plugins (e.g. KTX2) to the GLTFLoader. */
  configure?: (loader: GLTFLoader) => void;
}
let loaderConfig: ModelLoaderConfig = {};
/** Configure optional decoders once, at app start. */
export function configureModelLoader(config: ModelLoaderConfig): void { loaderConfig = { ...loaderConfig, ...config }; }

function emit(e: Entry, patch: Partial<ModelProgress>): void {
  e.progress = { ...e.progress, ...patch };
  e.listeners.forEach((l) => l());
  progressListeners.get(e.url)?.forEach((l) => l());
}

/** Extensions declared in a GLB/glTF JSON header, without parsing the whole file twice. */
function declaredExtensions(buffer: ArrayBuffer): string[] {
  try {
    const view = new DataView(buffer);
    let json: { extensionsUsed?: string[]; extensionsRequired?: string[] };
    if (view.byteLength >= 20 && view.getUint32(0, true) === 0x46546c67) {
      const len = view.getUint32(12, true);
      json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, len)));
    } else json = JSON.parse(new TextDecoder().decode(buffer));
    return [...(json.extensionsUsed ?? []), ...(json.extensionsRequired ?? [])];
  } catch { return []; }
}

async function fetchAndParse(e: Entry): Promise<void> {
  const { url } = e;
  let res: Response;
  try { res = await fetch(url); }
  catch (err) { throw new ModelLoadError('network', url, `Could not reach ${url}: ${err instanceof Error ? err.message : 'request failed'}`); }
  if (!res.ok) {
    const missing = res.status === 404 || res.status === 410;
    throw new ModelLoadError(missing ? 'missing' : 'network', url, missing ? `Model not found: ${url}` : `Model request failed with HTTP ${res.status}: ${url}`, res.status);
  }
  // Content-Length describes the encoded body; with Content-Encoding the decoded stream is longer, so the total is unknown.
  const declared = Number(res.headers.get('content-length'));
  const total = Number.isFinite(declared) && declared > 0 && !res.headers.get('content-encoding') ? declared : null;
  emit(e, { status: 'loading', total, fraction: total ? 0 : null });
  let buffer: ArrayBuffer;
  try {
    if (res.body) {
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let loaded = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.byteLength;
        emit(e, { loaded, fraction: total ? Math.min(1, loaded / total) : null });
      }
      const all = new Uint8Array(loaded);
      let o = 0;
      for (const c of chunks) { all.set(c, o); o += c.byteLength; }
      buffer = all.buffer;
    } else {
      buffer = await res.arrayBuffer();
      emit(e, { loaded: buffer.byteLength, fraction: total ? 1 : null });
    }
  } catch (err) { throw new ModelLoadError('network', url, `Download interrupted for ${url}: ${err instanceof Error ? err.message : 'stream error'}`); }
  e.bytes = buffer.byteLength;
  emit(e, { status: 'decoding' });

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const ext = declaredExtensions(buffer);
  let draco: { dispose(): void } | null = null;
  try {
    if (ext.includes('KHR_draco_mesh_compression')) {
      if (!loaderConfig.dracoDecoderPath) throw new Error('file uses DRACO compression but no decoder path is configured (configureModelLoader({ dracoDecoderPath }))');
      const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js');
      const d = new DRACOLoader();
      d.setDecoderPath(loaderConfig.dracoDecoderPath);
      loader.setDRACOLoader(d);
      draco = d;
    }
    loaderConfig.configure?.(loader);
    e.gltf = await loader.parseAsync(buffer, url.slice(0, url.lastIndexOf('/') + 1));
  } catch (err) {
    throw new ModelLoadError('decode', url, `Could not decode ${url}: ${err instanceof Error ? err.message : String(err)}`);
  } finally { draco?.dispose(); }
}

function getEntry(url: string): Entry {
  let e = cache.get(url);
  if (e) return e;
  const entry: Entry = { url, status: 'pending', promise: Promise.resolve(), bytes: 0, progress: { ...IDLE, status: 'loading' }, listeners: new Set(), refs: 0 };
  e = entry;
  cache.set(url, entry);
  entry.promise = fetchAndParse(entry).then(
    () => {
      entry.status = 'ready';
      emit(entry, { status: 'ready', fraction: entry.progress.total ? 1 : null });
      // Loaded but never mounted (consumer went away while suspended): do not hold GPU-bound data forever.
      entry.timer = setTimeout(() => { if (entry.refs === 0) evict(entry); }, 10_000);
    },
    (err: unknown) => {
      entry.status = 'error';
      entry.error = isModelLoadError(err) ? err : new ModelLoadError('decode', url, err instanceof Error ? err.message : String(err));
      emit(entry, { status: 'error' });
    },
  );
  return entry;
}

function disposeGltf(gltf: GLTF): number {
  const bitmaps = new Set<{ close?: () => void }>();
  for (const scene of gltf.scenes ?? [gltf.scene]) scene.traverse((o) => {
    const m = (o as Object3D & { material?: Material | Material[] }).material;
    for (const mat of m ? (Array.isArray(m) ? m : [m]) : []) for (const v of Object.values(mat as unknown as Record<string, unknown>)) {
      const img = (v as Texture | null)?.isTexture ? (v as Texture).image as { close?: () => void } | null : null;
      if (img && typeof img.close === 'function') bitmaps.add(img);
    }
  });
  let n = 0;
  for (const scene of gltf.scenes ?? [gltf.scene]) n += disposeObject(scene);
  bitmaps.forEach((b) => b.close?.()); // GLTFLoader decodes to ImageBitmap; texture.dispose() does not release it
  return n;
}

function evict(e: Entry): void {
  if (cache.get(e.url) !== e) return;
  if (e.timer) clearTimeout(e.timer);
  cache.delete(e.url);
  if (e.gltf) disposeGltf(e.gltf);
  e.gltf = undefined;
  progressListeners.get(e.url)?.forEach((l) => l());
}

/** Start loading without rendering (hover intent, route prefetch). The entry is evicted if nothing mounts it within 10 s of loading. */
export function preloadModel(url: string): void { getEntry(url); }

/** Drop a cached model (and its error state) so the next `useModel(url)` starts a fresh request. No-op while it is mounted. */
export function clearModel(url: string): void {
  const e = cache.get(url);
  if (e && e.refs === 0) evict(e);
}

/** Number of live cache entries — for leak tests. */
export const modelCacheSize = (): number => cache.size;

export interface LoadedModel {
  /** A private clone of the scene graph (shared geometries/materials — clone a material before mutating it). */
  scene: Object3D;
  animations: AnimationClip[];
  /** Named nodes of the clone. */
  nodes: Record<string, Object3D>;
  /** Transferred file size in bytes (measured from the response body). */
  bytes: number;
  url: string;
}

/** Shared by `useModel` and `<Model onError>`: suspends while pending; on failure throws or returns the error. */
function useEntryModel(url: string, throwOnError: boolean): { model: LoadedModel | null; error: ModelLoadError | null } {
  const entry = getEntry(url);
  if (entry.status === 'pending') throw entry.promise;
  if (entry.status === 'error' && throwOnError) throw entry.error;
  const gltf = entry.gltf;
  const model = useMemo<LoadedModel | null>(() => {
    if (!gltf) return null;
    const scene = cloneWithSkeletons(gltf.scene);
    const nodes: Record<string, Object3D> = {};
    scene.traverse((o) => { if (o.name && !nodes[o.name]) nodes[o.name] = o; });
    return { scene, animations: gltf.animations, nodes, bytes: entry.bytes, url };
  }, [gltf, entry, url]);
  useEffect(() => {
    if (!gltf) return;
    entry.refs++;
    if (entry.timer) { clearTimeout(entry.timer); entry.timer = undefined; }
    return () => {
      entry.refs--;
      if (entry.refs === 0) entry.timer = setTimeout(() => { if (entry.refs === 0) evict(entry); }, 1000);
    };
  }, [entry, gltf]);
  return { model, error: entry.status === 'error' ? entry.error ?? null : null };
}

/**
 * Suspends until `url` is loaded, then returns a private clone. Throws `ModelLoadError` to the nearest error
 * boundary on failure. Must be rendered under `<Suspense>`.
 * Note: React Three Fiber 9 reports errors caught by boundaries INSIDE a canvas through `window.reportError`, so a
 * thrown load failure also surfaces as a global error event. Use `<Model onError>` to handle failures without throwing.
 */
export function useModel(url: string): LoadedModel {
  return useEntryModel(url, true).model as LoadedModel;
}

/** Live download/decode progress for a URL. Works outside the canvas (DOM progress bars). Never invents a percentage. */
export function useModelProgress(url: string | null | undefined): ModelProgress {
  return useSyncExternalStore(
    (cb) => {
      if (!url) return () => {};
      let set = progressListeners.get(url);
      if (!set) { set = new Set(); progressListeners.set(url, set); }
      set.add(cb);
      return () => { set.delete(cb); if (!set.size) progressListeners.delete(url); };
    },
    () => (url ? cache.get(url)?.progress ?? IDLE : IDLE),
    () => IDLE,
  );
}

/* ── Components ───────────────────────────────────────────────────────────── */

export type ModelProps = Omit<ThreeElements['group'], 'children'> & {
  /** Direct GLB URL. */
  src?: string;
  /** Or a manifest: the variant is chosen from `useQuality().modelVariant` unless `variant` is set. */
  manifest?: ModelManifest;
  manifestUrl?: string;
  variant?: ModelVariantName | 'auto' | (string & {});
  castShadow?: boolean;
  receiveShadow?: boolean;
  /** Called once per loaded clone — the place to grab nodes, compute stats, hand the scene to controllers. */
  onLoaded?: (model: LoadedModel) => void;
  /**
   * Handle load failures without throwing: the model renders nothing and this is called with the `ModelLoadError`
   * (preferred inside a canvas — R3F reports boundary-caught errors globally). Without it, failures throw to the
   * nearest error boundary. The failed cache entry is dropped on unmount, so remounting retries the download.
   */
  onError?: (error: ModelLoadError) => void;
  children?: ReactNode;
};

/**
 * Renders a GLB. Suspends while loading; throws `ModelLoadError` on failure. Pointer props (`onClick`,
 * `onPointerMove` …) are forwarded to the group, so R3F raycasting reports the hit mesh in `event.object`.
 */
export function Model({ src, manifest, manifestUrl, variant = 'auto', castShadow = false, receiveShadow = false, onLoaded, onError, children, ...group }: ModelProps) {
  const quality = useQuality();
  const invalidate = useThree((s) => s.invalidate);
  let url = src;
  if (!url && manifest) {
    const v = resolveModelVariant(manifest, variant === 'auto' ? quality.modelVariant : variant);
    if (!v) throw new ModelLoadError('missing', manifestUrl ?? manifest.id, `Manifest "${manifest.id}" lists no variants`);
    url = resolveModelUrl(v.file, manifestUrl);
  }
  if (!url) throw new Error('<Model> needs `src` or `manifest`');
  const { model, error } = useEntryModel(url, !onError);
  const failed = useRef(onError);
  failed.current = onError;
  useEffect(() => {
    if (!error) return;
    failed.current?.(error);
    const u = url as string;
    return () => clearModel(u);
  }, [error, url]);
  useEffect(() => {
    if (!model) return;
    model.scene.traverse((o) => { if ((o as Object3D & { isMesh?: boolean }).isMesh) { o.castShadow = castShadow; o.receiveShadow = receiveShadow; } });
    invalidate();
  }, [model, castShadow, receiveShadow, invalidate]);
  useEffect(() => { if (model) { onLoaded?.(model); invalidate(); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [model]);
  if (!model) return null;
  return (
    <group {...group}>
      <primitive object={model.scene} />
      {children}
    </group>
  );
}

interface BoundaryProps {
  /** Rendered (inside the canvas) instead of the failed subtree. Default: nothing. */
  fallback?: ReactNode | ((error: Error, retry: () => void) => ReactNode);
  /** Report the failure to DOM state so a static fallback / message can be shown outside the canvas. */
  onError?: (error: Error) => void;
  /** Change to reset the boundary (e.g. the model URL). */
  resetKey?: unknown;
  children: ReactNode;
}

/**
 * Error boundary for model subtrees. Works inside the R3F tree (keeps the rest of the scene alive) and in the DOM.
 * `retry()` clears the failed cache entry and re-renders the children.
 */
export class ModelBoundary extends Component<BoundaryProps, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { this.props.onError?.(error); }
  componentDidUpdate(prev: BoundaryProps) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.retry();
  }
  componentWillUnmount() { const e = this.state.error; if (isModelLoadError(e)) clearModel(e.url); }
  retry = (): void => {
    const e = this.state.error;
    if (isModelLoadError(e)) clearModel(e.url);
    this.setState({ error: null });
  };
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const { fallback } = this.props;
    return typeof fallback === 'function' ? fallback(error, this.retry) : fallback ?? null;
  }
}

/** Human-readable sentence for a load failure (for fallbacks and `role="alert"` messages). */
export function describeModelError(error: Error | null | undefined): string {
  if (!error) return '';
  if (!isModelLoadError(error)) return 'The 3D scene failed to load.';
  return error.kind === 'missing' ? 'The 3D model file could not be found.'
    : error.kind === 'network' ? 'The 3D model could not be downloaded. Check the connection and try again.'
    : 'The 3D model was downloaded but could not be decoded on this device.';
}
