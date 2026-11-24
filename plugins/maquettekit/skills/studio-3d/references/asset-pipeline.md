# Asset pipeline — from source model to the right variant on each device

Models arrive heavy: the sample `pulse-speaker.source.glb` is 19.3 MB with four 2048² PNG textures; its desktop
variant is 2.0 MB and its low-power variant 1.0 MB (`assets/models/README.md`). Never ship a source file, never
edit one, and never let the browser guess which build to fetch. Delegate the tool work to
`studio-asset-optimizer`; this file is what the scene needs to know.

## 1. Delivery format

- glTF 2.0 binary (`.glb`), one file per variant, textures embedded. Units metres, +Y up, +Z front, resting on
  y = 0, centred on x/z (the convention of the sample models).
- Parts are **named nodes**; part metadata lives in node `extras` (three exposes them as `userData`):
  `label`, `description`, `explodeDirection`, `explodeDistance` — what `PartController` and hotspots read.
- After optimisation a named part keeps its name, parent, extras and transform, but its mesh moves into an
  unnamed child (quantisation bakes a transform into the mesh-owning node). Select parts by name, then traverse.
- Clips are named (`KnobTurn`, `LightPulse` in the sample); the manifest lists them.
- Model provenance and licence are known and recorded; a stand-in is never presented as the product.

## 2. What `maquettekit assets` does

| Command | Use it to |
|---|---|
| `inspect <file>` | Read hierarchy, meshes, materials, textures, clips, extensions, bounds, size, GPU-texture and draw-call estimates |
| `validate <file> [--strict]` | Khronos glTF-Validator plus Maquettekit delivery checks (exit 1 on errors) |
| `optimize <file> --out <dir> [--profile …]` | One optimised file plus a report; verifies materials, clips, named nodes, attributes, bounds and that the source is untouched |
| `variants <file> --out <dir> [--profiles …] [--budgets …] [--thumbnail]` | `<name>.desktop|mobile|low-power.glb`, `<name>.manifest.json`, reports, optional thumbnail and fallback image |
| `manifest <dir>` | Rebuild one manifest from `<id>.<profile>.glb` files |
| `thumbnail <file> --out <png>` | A preview render (headless software WebGL: fine for posters, not colour-exact) |
| `import <file.fbx|obj|dae|blend|usdz> --out <file.glb>` | Conversion through Blender's CLI when Blender is installed |

Pipeline order (`optimize`): dedup → prune → (join, opt-in) → weld → (simplify, opt-in) → reorder → quantise →
textures → compress → write → verify. Built-in profile defaults, to tune per project:

| Profile | Mesh compression | Textures | Simplify |
|---|---|---|---|
| `desktop` | meshopt (medium) | WebP ≤ 2048 px, quality 82 | none |
| `mobile` | meshopt (medium) | WebP ≤ 1024 px, quality 80 | keep 75 % |
| `low-power` | meshopt (medium) | WebP ≤ 512 px, quality 78 | keep 50 % |

Budgets in a profile file (`maxBytes`, `maxTriangles`, `maxTextureSize`, `maxGpuTextureBytesEstimate`,
`maxDrawCallsEstimate`) are **reported** as met or over; the tool never degrades an asset to meet them. Exact
flags: `maquettekit assets --help`.

## 3. Geometry compression

| Option | glTF extension | Decoder at runtime | Strengths | Limits |
|---|---|---|---|---|
| Quantisation | `KHR_mesh_quantization` | None | Smaller buffers on disk and in GPU memory | Changes the transform of mesh-owning nodes (handled by the pipeline) |
| Meshopt | `EXT_meshopt_compression` | `MeshoptDecoder` (small, embedded in three's module) | Fast decode; compresses any buffer, including animation; pairs with quantisation | Ratio depends on vertex order (the pipeline reorders) |
| Draco | `KHR_draco_mesh_compression` | Draco WASM decoder files | Strong geometry ratios on some meshes | Geometry only (not animation); cannot encode morph-target primitives; the pipeline skips reorder and quantise with it; decode is slower |

Default to meshopt + quantisation (the pipeline's default). Choose Draco only when a measured file is markedly
smaller and decode time on the target device is acceptable.

## 4. Textures: download size versus GPU memory

| Format | Download | GPU memory | Notes |
|---|---|---|---|
| WebP / PNG / JPEG | WebP small, PNG large | Decoded to RGBA8: width × height × 4, × 1.33 with mipmaps (a 2048² texture ≈ 22 MB) | `EXT_texture_webp` needs no decoder |
| KTX2 / Basis Universal | Moderate | Stays compressed on the GPU (BC/ETC/ASTC chosen per device by the transcoder) | `KHR_texture_basisu`; needs the transcoder; pipeline support needs the `ktx` CLI and is documented as untested |

Choose KTX2 when GPU memory is the constraint (many or large textures on phones); WebP when download is the
constraint and memory is comfortable. Resize first: a texture larger than its on-screen use wastes both.
Colour textures are sRGB, data textures linear; the pipeline detects the slot and reports it.

## 5. Decoders in three.js 0.187 (verified paths)

Self-host the decoder files from `three/examples/jsm/libs/draco/gltf/` (`draco_decoder.js`, `draco_decoder.wasm`,
`draco_wasm_wrapper.js`) and `three/examples/jsm/libs/basis/` (`basis_transcoder.js`, `basis_transcoder.wasm`).
Register only what the variant needs; a missing decoder for a *required* extension means the file does not load.

```ts
import type { WebGLRenderer } from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { resolveModelUrl, resolveModelVariant, type ModelManifestFile, type QualityProfile } from './three';

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Vanilla: load the manifest variant for a quality profile with exactly the decoders it declares. */
export async function loadVariant(manifestUrl: string, assetId: string, profile: QualityProfile, renderer: WebGLRenderer): Promise<{ gltf: GLTF; dispose(): void }> {
  const file = (await (await fetch(manifestUrl)).json()) as ModelManifestFile;
  const asset = file.assets.find((a) => a.id === assetId);
  const variant = asset ? resolveModelVariant(asset, profile.modelVariant) : null;
  if (!variant) throw new Error(`No variant of "${assetId}" in ${manifestUrl}`);
  const ext = [...strings(variant.extensionsUsed), ...strings(variant.extensionsRequired)];
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const draco = ext.includes('KHR_draco_mesh_compression') ? new DRACOLoader().setDecoderPath('/draco/gltf/') : null;
  const ktx2 = ext.includes('KHR_texture_basisu') ? new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer) : null;
  if (draco) loader.setDRACOLoader(draco);
  if (ktx2) loader.setKTX2Loader(ktx2);
  const gltf = await loader.loadAsync(resolveModelUrl(variant.file, manifestUrl));
  return { gltf, dispose() { draco?.dispose(); ktx2?.dispose(); } };
}
```

In React, the kit's `Model`/`useModel` always wires meshopt, fetches the Draco decoder only when a file declares
it and `configureModelLoader({ dracoDecoderPath: '/draco/gltf/' })` was called, and accepts any other loader
set-up through `configure`. KTX2 needs the renderer, so register it from inside the canvas before models load:

```tsx
'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { configureModelLoader } from './three';

/** Renders children only after the kit's loader can transcode KTX2 for this renderer. */
export function WithKTX2({ transcoderPath = '/basis/', children }: { transcoderPath?: string; children: ReactNode }) {
  const gl = useThree((s) => s.gl);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const ktx2 = new KTX2Loader().setTranscoderPath(transcoderPath).detectSupport(gl);
    configureModelLoader({ configure: (loader) => { loader.setKTX2Loader(ktx2); } });
    setReady(true);
    return () => { configureModelLoader({ configure: undefined }); ktx2.dispose(); setReady(false); };
  }, [gl, transcoderPath]);
  return ready ? <>{children}</> : null;
}
```

Drei's `useGLTF` points at a Google-hosted Draco decoder and `useKTX2` at a jsDelivr transcoder by default: if a
project uses them, call `useGLTF.setDecoderPath(...)` and pass a local path to `useKTX2`, or prefer the kit loader.

## 6. Variants and manifest at runtime

The manifest (`<name>.manifest.json`, or `manifest.json` for a folder) lists per asset: `variants[]` (`profile`,
`file`, `bytes`, `triangles`, `vertices`, `drawCallsEstimate`, `textures`, `gpuTextureBytesEstimate`,
`compression`, `extensionsUsed`, `extensionsRequired`, `decoders`), plus `thumbnail`, `fallbackImage`,
`animations`, `parts`, `materials`, `bounds`. Paths are relative to the manifest.

| Need | Kit API |
|---|---|
| Read the manifest in DOM (pickers, sizes, poster) | `useModelManifest(url, id?)` → `{ manifest, error, loading }` |
| Pick the build for a level | `resolveModelVariant(manifest, quality.modelVariant)`: exact match, else the nearest of desktop → mobile → low-power |
| Resolve the file URL | `resolveModelUrl(variant.file, manifestUrl)` |
| Let the scene choose | `<Model manifest={m} manifestUrl={u} />` uses `useQuality().modelVariant` (`high` → desktop, `medium` → mobile, `low` → low-power) |
| Know the level outside the canvas | `StudioCanvas onQualityChange={setLevel}`, then `defaultQualityProfiles[level].modelVariant` (the gallery viewer does this) |
| Real progress | `useModelProgress(url)`: `fraction` only when `Content-Length` is usable, otherwise indeterminate |
| Start downloading on intent | `preloadModel(url)` on pointer-enter or focus of "View in 3D" (evicted after 10 s if nothing mounts it) |
| Failures | `ModelLoadError` (`missing`, `network`, `decode`), `ModelBoundary` with `retry()`, `describeModelError()` |

Use `fallbackImage` (WebP, 1024 px in the sample) as the poster and the no-WebGL image, and `thumbnail` for
pickers. Show the chosen variant and its size honestly if the page shows stats (the gallery viewer does).

## 7. Source preservation

- Sources (`*.source.glb`, `.blend`, `.fbx`) are read-only inputs. The tools refuse to write over them, record the
  source SHA-256 in every report and re-check it after the run.
- Outputs go to a separate folder; replacing existing outputs needs `--force` and backs them up first.
- Commit the delivery variants and the exact command that produced them; regenerate from the source rather than
  editing an output.

## 8. Checklist

- [ ] `maquettekit assets validate` ran on the source and on each shipped variant; findings addressed or reported.
- [ ] Variants exist for the profiles the page uses, with a manifest, thumbnail and fallback image.
- [ ] Decoders and transcoders are served from the project's origin; nothing loads from a public CDN.
- [ ] Variant choice follows the quality profile; the poster shows before the model; progress is real.
- [ ] Part names, extras and clips needed by the scene survived optimisation (the verification report says so).
