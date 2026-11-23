# three-kit API reference

Generated from `${CLAUDE_PLUGIN_ROOT}/library/src/three/` (re-checked against the source when this skill was
written). Everything is re-exported from `library/src/three/index.ts` (package path `@studio3/library/three` in the
Studio³ repository; in a project, wherever the folder was copied). React parts need `react`, `three` and
`@react-three/fiber`; `capabilities`, `quality`, `dispose` and `vanilla` need only `three`. If an export below is
missing in your copy, the copy is older: re-copy the folder. The kit's own overview is
`library/src/three/README.md`.

## capabilities.ts

| Export | Signature | Purpose |
|---|---|---|
| `GraphicsCapabilities` | `{ webgl, webgl2, webgpuApi, maxTextureSize, renderer, softwareRenderer, deviceClass }` | Result of a probe; `deviceClass` is `'desktop' \| 'mobile' \| 'low-power'` from public signals |
| `detectCapabilities` | `(force = false) => GraphicsCapabilities` | Cached probe on a throwaway canvas (released with `loseContext()`); SSR-safe (returns "none") |
| `detectWebGPU` | `() => Promise<{ available: boolean; reason?: string }>` | `navigator.gpu` **and** an adapter; always pair with a WebGL path |

Usage: `if (!detectCapabilities().webgl2) showPoster();` — three 0.187 needs WebGL 2.

## quality.ts

| Export | Signature | Purpose |
|---|---|---|
| `QualityLevel` | `'high' \| 'medium' \| 'low'` | |
| `QualityProfile` | `{ level, dpr: [min, max], antialias, shadows, shadowMapSize, postprocessing, textureMax, modelVariant, density, envResolution }` | What a level allows |
| `Budgets` | `{ drawCalls, triangles, textureBytes }` | Soft budgets type |
| `defaultQualityProfiles` | `Record<QualityLevel, QualityProfile>` | Starting points (values in `performance.md` §1) |
| `defaultBudgets` | `Record<QualityLevel, Budgets>` | high 200 / 1.5 M / 256 MB, medium 120 / 500 k / 96 MB, low 60 / 150 k / 32 MB; not consumed by any component |
| `createQualityProfiles` | `(overrides?: Partial<Record<QualityLevel, Partial<QualityProfile>>>) => Record<QualityLevel, QualityProfile>` | Merge project values over the defaults |
| `pickQualityLevel` | `(caps, { saveData? }) => QualityLevel` | First guess from capabilities |
| `createAdaptiveQuality` | `({ targetMs = 20, window = 45, onChange }) => { sample(dtMs), dprFactor }` | Frame-time DPR factor 0.5–1 in 0.125 steps; `onChange({ dprFactor, degrade })` |

## dispose.ts

| Export | Signature | Purpose |
|---|---|---|
| `disposeMaterial` | `(material, seen?) => number` | Material plus textures in its properties and `uniforms` |
| `disposeObject` | `(root) => number` | Geometries, materials, textures and skeletons under `root` (owned resources only) |
| `ResourceTracker` | `class { track(item), dispose(): number, disposed }` | Collects disposables and Object3Ds; `dispose()` also removes Object3Ds from their parent |
| `disposeRenderer` | `(renderer, { loseContext = true }) => void` | Vanilla teardown: stop loop, dispose render lists and renderer, force context loss, remove canvas |

## vanilla.ts

`createVanillaScene(container, profile, { fov = 35, alpha = true }) => VanillaScene` — `{ scene, camera, renderer,
invalidate(), loop(tick) → stop, dispose() }`. Renderer from the profile (antialias, power preference, shadows),
camera `PerspectiveCamera(fov, aspect, 0.1, 100)`, `ResizeObserver` sizing with DPR clamped to `profile.dpr`, render
on demand, loop paused off-screen and in hidden tabs, full teardown. No capability check and no context-loss
handling: add both (`lifecycle.md` §4).

## StudioCanvas.tsx

`StudioCanvas(props: StudioCanvasProps)` — the React entry point (`lifecycle.md` §2).

| Prop | Default | |
|---|---|---|
| `label` | required | Accessible name (`aria-label` on the R3F wrapper, `role="img"` unless you pass `role`) |
| `description` | — | Visually hidden text linked by `aria-describedby` |
| `fallback` | the label as text | Shown when unsupported, on render error, after context loss, or when `disabled` |
| `quality` | `'auto'` | Or a fixed level |
| `profiles` | `defaultQualityProfiles` | From `createQualityProfiles` |
| `frameloop` | `'demand'` | `'always'` only while something animates; becomes `'never'` when paused, off-screen or hidden |
| `paused` | `false` | User pause control |
| `lazy` | `true` | Mount the context within 200 px of the viewport |
| `adaptive` | `true` | Adaptive DPR, only with `frameloop="always"` |
| `disabled` | `false` | Force the fallback (user "Turn off 3D", tests) |
| `onQualityChange`, `onSceneError` | — | Level chosen; error that caused the fallback |
| any R3F `Canvas` prop | — | `camera`, `flat`, `shadows`, `gl` (replaces the kit's renderer defaults), `onPointerMissed`, … |

Host attributes: `data-studio3-canvas`, `data-status` (`pending`, `ready`, `unsupported`, `error`, `lost`,
`disabled`), `data-quality`; fallback container `data-studio3-fallback`.

| Other export | Signature | Purpose |
|---|---|---|
| `useQuality` | `() => QualityProfile` | Active profile; only inside a `StudioCanvas` tree (outside it returns `medium`) |
| `Studio3Diagnostics` | `{ renderer: { calls, triangles, points, lines, geometries, textures, programs }, frameloop, quality, dpr, frames, disposed, contextLost }` | Written to `window.__STUDIO3_3D__` after every rendered frame; read by Visual Director |

## components/model.tsx

| Export | Signature | Purpose |
|---|---|---|
| `Model` | `(props: ModelProps)` — group props plus `src?`, `manifest?`, `manifestUrl?`, `variant = 'auto'`, `castShadow`, `receiveShadow`, `onLoaded(model)` | Renders a GLB; suspends while loading; pointer props are forwarded so `e.object` is the hit mesh |
| `useModel` | `(url) => LoadedModel` | Suspends, then returns a private clone: `{ scene, animations, nodes, bytes, url }` |
| `ModelBoundary` | `class` — `fallback?: ReactNode \| (error, retry) => ReactNode`, `onError?`, `resetKey?` | Error boundary for model subtrees; `retry()` clears the failed entry |
| `useModelManifest` | `(url, id?) => { manifest, error, loading }` | Fetch and memoise a manifest (DOM side) |
| `resolveModelVariant` | `(manifest, want) => ModelVariantInfo \| null` | Exact profile or nearest of desktop → mobile → low-power |
| `resolveModelUrl` | `(file, manifestUrl?) => string` | Variant path relative to the manifest |
| `useModelProgress` | `(url) => ModelProgress` | `{ loaded, total, fraction, status }`; `fraction` null when the size is unknown |
| `preloadModel`, `clearModel`, `modelCacheSize` | `(url) => void`, `(url) => void`, `() => number` | Prefetch on intent; drop an unmounted entry; leak tests |
| `configureModelLoader` | `({ dracoDecoderPath?, configure?(loader) }) => void` | Once at start: Draco decoder folder; extra loader set-up (KTX2) |
| `ModelLoadError`, `isModelLoadError`, `describeModelError` | `kind: 'missing' \| 'network' \| 'decode'`, `url`, `status?`; `(error) => string` | Typed failures and user-facing sentences |
| Types | `ModelManifest`, `ModelManifestFile`, `ModelVariantInfo`, `ModelVariantName`, `ManifestState`, `ModelProgress`, `ModelLoaderConfig`, `LoadedModel`, `ModelProps`, `ModelErrorKind` | |

Cache: reference counted; GPU resources (and decoded `ImageBitmap`s) released about 1 s after the last consumer
unmounts, 10 s after loading if never mounted. Meshopt always wired; Draco only when declared and configured.

## components/OrbitInspect.tsx, CameraRig.tsx

| Export | Signature | Purpose |
|---|---|---|
| `OrbitInspect` | `forwardRef<OrbitInspectHandle, OrbitInspectProps>` | Orbit/zoom/pan with clamps, focus-gated wheel, `pan-y` touch, keyboard, reduced-motion damping off; registers as default controls |
| `OrbitInspectHandle` | `{ rotate(az, polar?), zoom(factor), pan(dx, dy), reset(), saveHome(), controls }` | Drive from DOM buttons |
| `CameraRig` | `forwardRef<CameraRigHandle, CameraRigProps>` | Named poses, critically damped spherical transitions, portrait widening, cuts under reduced motion |
| `CameraRigHandle` | `{ goTo(pose, { immediate }), fitToBounds(subject, { padding, direction, immediate }), getPose(), stop(), moving }` | |
| `CameraPose`, `Vec3` | `{ position: Vec3; target: Vec3; fov? }`, `[number, number, number]` | |

Prop defaults are listed in `interaction.md` §2–3.

## components/PartController.tsx

| Export | Signature | Purpose |
|---|---|---|
| `PartController` | `forwardRef<PartControllerCore \| null, PartControllerProps>` — `root`, `overrides`, `highlight`, `selected`, `hidden`, `explode`, `explodeTime = 0.6`, `highlightColor = '#ffb347'`, `highlightIntensity = 0.35`, `onReady(parts, core)` | Declarative overrides, highlight, visibility, exploded view; invalidates on change |
| `PartControllerCore` | `class(root, opts)` — `parts`, `partOf(object)`, `setOverrides`, `setHighlight`, `setSelected`, `setHidden`, `setExplode`, `explodeAmount`, `dispose()` | Imperative core (vanilla use too) |
| `PartInfo`, `MaterialOverride`, `PartSelector` | `{ name, label, description?, explodes, materials, object }`; switchable PBR fields; `` `part:${string}` \| `material:${string}` `` | |

Clones a material the first time a slot needs to differ; restores originals and disposes clones in `dispose()`.
StrictMode caveat in `lifecycle.md` §3.

## components/LightingRig.tsx

| Export | Signature | Purpose |
|---|---|---|
| `LightingRig` | `forwardRef<LightingRigHandle, LightingRigProps>` — `preset = 'studio-soft'`, `intensity = 1`, `shadow = 'auto' \| 'map' \| 'blob' \| 'none'`, `groundY = 0`, `shadowRadius = 2`, `shadowOpacity = 0.35`, `background = false`, `environment = true` | Ambient + key/fill/rim lights and a generated PMREM environment (no download); shadow map or contact blob from the profile; restores previous environment and exposure |
| `lightingPresets`, `LightingPresetName` | `'studio-soft' \| 'product-contrast' \| 'warm-evening' \| 'technical-flat'` | Each `{ label, description, exposure, ambient, key, fill?, rim?, env }` |
| `LightingPreset`, `DirectLight`, `EnvPanel`, `LightingRigHandle` | | Custom presets; handle exposes the light objects |

## components/AnimationPlayer.tsx

`AnimationPlayer` — `forwardRef<AnimationPlayerHandle, AnimationPlayerProps>`: `root`, `clips`, `clip`,
`autoPlay = false` (ignored under reduced motion), `speed = 1`, `loop = true`, `crossFade = 0.3`, `onState`,
`stateInterval = 100`. Handle: `play()`, `pause()`, `toggle()`, `seek(seconds)`, `getState()` →
`AnimationState { clip, time, duration, playing }`. Ticks and invalidates only while playing.

## components/Hotspots.tsx

| Export | Signature | Purpose |
|---|---|---|
| `useHotspotStore` | `() => HotspotStore` | Shared element registry |
| `HotspotAnchors` | `({ store, hotspots, root?, occlude = true })` | Inside the canvas: projects anchors per rendered frame, occlusion raycast per hotspot |
| `HotspotLayer` | `({ store, hotspots, active?, onSelect?, card = true, style? })` | DOM overlay of numbered marker buttons and the open card |
| `HotspotList` | `({ hotspots, active?, onSelect?, label = 'Annotations', renderItem?, className?, style? })` | Mirrored list (keyboard, screen readers, fallback) |
| `Hotspot` | `{ id, label, description?, node?, position? }` | Anchor to a named node's box centre plus offset, or a point |

## components/SceneFallback.tsx, modelStats.ts, diagnostics.ts

| Export | Signature | Purpose |
|---|---|---|
| `SceneFallback` | `({ title, image?, imageAlt = '', description?, facts?, reason?, children?, layout = 'stack' \| 'cover', style? })` | Standard fallback block (`accessibility.md` §6) |
| `computeModelStats` | `(root, animations?) => ModelStats` | Counts plus texture/geometry byte **estimates** from the loaded scene |
| `formatBytes`, `formatCount` | `(n) => string` | Decimal units; `'—'` for missing values |
| `useCanvasDiagnostics` | `(intervalMs = 500) => Studio3Diagnostics \| null` | Polls `window.__STUDIO3_3D__` for stat panels |
| `useFrameTiming` | `(enabled, windowSize = 60) => { medianMs, p95Ms, samples }` | rAF cadence on this device |
| `CameraProbe` | `() => null` | Inside the canvas: writes `data-camera="x,y,z"` on the host after each rendered frame (tests, review) |

## Minimal scene

```tsx
'use client';
import { Suspense } from 'react';
import { LightingRig, Model, ModelBoundary, OrbitInspect, SceneFallback, StudioCanvas } from './three';

export function MinimalViewer({ manifestUrl, manifest }: { manifestUrl: string; manifest: Parameters<typeof Model>[0]['manifest'] }) {
  return (
    <div style={{ position: 'relative', aspectRatio: '1 / 1' }}>
      <StudioCanvas label="Interactive 3D view of the token" role="group" camera={{ fov: 30, near: 0.01, far: 10, position: [0.15, 0.1, 0.2] }}
        fallback={<SceneFallback title="Orbit token" description="A small faceted metal token." />}>
        <LightingRig preset="product-contrast" shadowRadius={0.05} />
        <OrbitInspect target={[0, 0.03, 0]} minDistance={0.08} maxDistance={0.5} />
        <ModelBoundary resetKey={manifestUrl}>
          <Suspense fallback={null}><Model manifest={manifest} manifestUrl={manifestUrl} /></Suspense>
        </ModelBoundary>
      </StudioCanvas>
    </div>
  );
}
```
