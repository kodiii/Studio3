# three-kit

The Studio³ 3D layer: capability detection, quality profiles, an R3F canvas with a real fallback, disposal helpers,
a vanilla three.js bootstrap, and scene components (models, cameras, parts, lights, clips, annotations).
Import everything from `three/` (`import { StudioCanvas, Model } from '../../three'` inside the library,
`@studio3/library/three` from the gallery). Versions verified: three 0.187, @react-three/fiber 9.8.

Everything here is used by the `/3d` gallery page and the five demos in `demos/3d/` — read those for full examples.

## API

### Capabilities — `capabilities.ts`

| Export | Signature | Purpose |
| --- | --- | --- |
| `GraphicsCapabilities` | interface | `webgl`, `webgl2`, `webgpuApi`, `maxTextureSize`, `renderer`, `softwareRenderer`, `deviceClass` (`desktop` · `mobile` · `low-power`). |
| `detectCapabilities` | `(force?: boolean) => GraphicsCapabilities` | Probes WebGL once (cached), releases the probe context. Software rasterisers (SwiftShader, llvmpipe…) count as `low-power`. SSR-safe. |
| `detectWebGPU` | `() => Promise<{ available: boolean; reason?: string }>` | True only when an adapter is acquired. Never assume WebGPU; always ship the WebGL path. |

### Quality — `quality.ts`

| Export | Signature | Purpose |
| --- | --- | --- |
| `QualityLevel` | `'high' \| 'medium' \| 'low'` | |
| `QualityProfile` | interface | `dpr` clamp, `antialias`, `shadows`, `shadowMapSize`, `postprocessing`, `textureMax`, `modelVariant` (`desktop`/`mobile`/`low-power`), `density` (instance/particle multiplier), `envResolution`. |
| `Budgets` | interface | Soft per-frame `drawCalls`, `triangles`, `textureBytes` for diagnostics warnings. |
| `defaultQualityProfiles` | `Record<QualityLevel, QualityProfile>` | Starting points (see "Profiles and budgets"). |
| `defaultBudgets` | `Record<QualityLevel, Budgets>` | Starting points. |
| `createQualityProfiles` | `(overrides?) => Record<QualityLevel, QualityProfile>` | Per-project overrides (also `studio3.design.json → threeD.qualityProfiles`). |
| `qualityProfilesFromDesign` | `(threeD) => Partial<Record<QualityLevel, Partial<QualityProfile>>>` | studio3.design.json `threeD.qualityProfiles` (desktop → high, mobile → medium, lowPower → low) as overrides: `createQualityProfiles(qualityProfilesFromDesign(design.threeD))`; missing fields keep the defaults. |
| `pickQualityLevel` | `(caps, { saveData? }) => QualityLevel` | Initial level from coarse signals. |
| `stepDownQuality` | `(level, steps = 1) => QualityLevel` | high → medium → low, never up; what `StudioCanvas quality="auto"` applies on each adaptive `degrade`. |
| `createAdaptiveQuality` | `({ targetMs?, window?, onChange }) => { sample(dtMs), dprFactor }` | Frame-time hysteresis: steps DPR down 12.5 % per slow window, back up when fast; never oscillates. |

### Canvas — `StudioCanvas.tsx`

| Export | Signature | Purpose |
| --- | --- | --- |
| `StudioCanvas` | `(props: StudioCanvasProps) => JSX` | R3F `<Canvas>` with: capability check + `fallback`, error boundary, context-loss recovery ("Try again"), lazy mount near the viewport, pause offscreen / tab hidden, quality profile (auto or forced), adaptive DPR for continuous loops, accessible name/description, `window.__STUDIO3_3D__` diagnostics. |
| `StudioCanvasProps` | interface | `label` (required), `description`, `fallback`, `quality` (`'auto'` or a level), `profiles`, `frameloop` (`'demand'` default \| `'always'`), `paused`, `lazy`, `adaptive`, `disabled` (force the fallback, e.g. a "3D off" switch), `interactive` (wrapper `role="group"` instead of `role="img"`; OrbitInspect with `keyboard` sets it for you), `onQualityChange`, `onSceneError`, plus any `<Canvas>` prop (`camera`, `flat`, `onPointerMissed`…). Mounts only with WebGL 2 (three r163+). |
| `useQuality` | `() => QualityProfile` | The active profile — inside the canvas tree only. Outside, use `onQualityChange` + `defaultQualityProfiles[level]`. |
| `Studio3Diagnostics` | interface | `renderer` (`calls`, `triangles`, `points`, `lines`, `geometries`, `textures`, `programs` — from `renderer.info`, last frame), `frameloop`, `quality`, `dpr`, `frames`, `disposed` (canvas teardowns), `contextLost`. |

The host element carries `data-studio3-canvas`, `data-status` (`pending` · `ready` · `unsupported` · `error` · `lost` · `disabled`) and `data-quality`; the fallback carries `data-studio3-fallback`.

### Disposal — `dispose.ts`

| Export | Signature | Purpose |
| --- | --- | --- |
| `disposeMaterial` | `(material, seen?) => number` | Disposes a material and every texture in its properties/uniforms. |
| `disposeObject` | `(root) => number` | Recursively disposes geometries, materials, textures, skeletons under `root`. |
| `ResourceTracker` | class: `track(item)`, `dispose()`, `disposed` | Collect imperatively created resources; one call releases them. |
| `disposeRenderer` | `(renderer, { loseContext? }) => void` | Full teardown for vanilla renderers (R3F does this for its own). |

### Vanilla three.js — `vanilla.ts`

| Export | Signature | Purpose |
| --- | --- | --- |
| `createVanillaScene` | `(container, profile, { fov?, alpha? }) => VanillaScene` | For non-React projects: ResizeObserver sizing, render-on-demand `invalidate()`, `loop(tick)` that pauses offscreen/hidden, and `dispose()` that releases everything. Pair with `detectCapabilities().webgl` for the fallback. |

### Models — `components/model.tsx`

| Export | Signature | Purpose |
| --- | --- | --- |
| `Model` | `(props: ModelProps) => JSX` | Renders a GLB (`src`) or a manifest variant (`manifest` + `manifestUrl`, variant from `useQuality().modelVariant` unless `variant`). Suspends while loading; throws `ModelLoadError`; forwards pointer props; `onLoaded(model)` once per clone. |
| `useModel` | `(url) => LoadedModel` | Suspending hook: `{ scene (private clone), animations, nodes, bytes, url }`. |
| `useModelManifest` | `(url, id?) => { manifest, error, loading }` | DOM-side manifest fetch (memoised) for pickers, byte sizes, stats. |
| `useModelProgress` | `(url) => ModelProgress` | `loaded`, `total`, `fraction` (null unless `Content-Length` is usable — never invented), `status`. |
| `resolveModelVariant` / `resolveModelUrl` | `(manifest, want)` / `(file, manifestUrl?)` | Pick the nearest existing build; resolve file paths against the manifest. |
| `preloadModel` / `clearModel` / `modelCacheSize` | `(url)` / `(url)` / `()` | Prefetch; drop a cached (or failed) entry; leak checks. |
| `configureModelLoader` | `({ dracoDecoderPath?, configure? })` | Optional DRACO path / extra loader plugins. Meshopt is always wired. |
| `ModelBoundary` | class component: `fallback`, `onError`, `resetKey` | Error boundary that works inside the R3F tree; `retry()` clears the failed cache entry. Also a generic boundary (the physics demo wraps its lazy Rapier chunk in it). |
| `ModelLoadError`, `isModelLoadError`, `describeModelError` | | Typed failures (`missing`, `network`, `decode`) and a human sentence for alerts. |
| Types | `ModelManifest`, `ModelManifestFile`, `ModelVariantInfo`, `ModelVariantName`, `ModelProgress`, `LoadedModel`, `ModelProps`, `ModelErrorKind`, `ManifestState`, `ModelLoaderConfig` | |

### Statistics and diagnostics — `components/modelStats.ts`, `components/diagnostics.ts`

| Export | Signature | Purpose |
| --- | --- | --- |
| `computeModelStats` | `(root, animations?) => ModelStats` | Counted from the loaded scene graph: meshes, triangles (instances multiplied), vertices, unique geometries/materials/textures, largest texture, estimated texture/geometry bytes (label as estimates), clips. |
| `formatBytes` / `formatCount` | `(n) => string` | Decimal units; `—` for unknown. |
| `useCanvasDiagnostics` | `(intervalMs?) => Studio3Diagnostics \| null` | Polls `window.__STUDIO3_3D__` without re-rendering when nothing changed. |
| `useFrameTiming` | `(enabled, windowSize?) => { medianMs, p95Ms, samples }` | rAF interval measured on this device while enabled; label it so. |
| `CameraProbe` | `() => null` (inside a canvas) | Writes the camera position to the canvas host as `data-camera="x,y,z"` after each rendered frame — an observable for tests. |

### Scene components

| Export | Key props / handle | Purpose |
| --- | --- | --- |
| `OrbitInspect` | `target`, distance/polar/azimuth limits, `damping`, `enablePan`, `wheel` (`'focus'` default), `touchScroll` (`'pan-y'`), `keyboard`; handle `rotate(az, polar)`, `zoom(f)`, `pan(dx, dy)`, `reset()`, `saveHome()` | Accessible orbit: renders only while moving, wheel zoom only when focused, keyboard on the canvas (arrows, + / −, 0), registers as R3F `controls`. When the keyboard is on it names the canvas and turns the wrapper's `img` role into `group`. |
| `CameraRig` | `presets`, `preset` (controlled), `smoothTime`, `referenceAspect`, `onArrive`, `onInterrupt`; handle `goTo(pose \| name)`, `fitToBounds(obj \| box)`, `getPose()`, `stop()`, `moving` | Critically damped, interruptible moves in spherical space; cuts under reduced motion; widens poses on narrow canvases. |
| `PartController` / `PartControllerCore` | `root`, `overrides` (`'part:Name'` / `'material:Name'` → `MaterialOverride`), `highlight`, `selected`, `hidden`, `explode` (0..1, from node extras), `onReady(parts, core)` | Per-part materials (lazy clones; originals never mutated, restored on dispose), emissive highlight, visibility, staggered exploded view. `core.partOf(object)` maps a raycast hit to its part. |
| `LightingRig` | `preset` (`studio-soft`, `product-contrast`, `warm-evening`, `technical-flat`, or a `LightingPreset`), `intensity`, `shadow` (`auto` · `map` · `blob` · `none`), `groundY`, `shadowRadius`; handle `key`, `fill`, `rim`, `ambient` | Direct lights + an environment generated in the browser (PMREM of emissive panels — no HDRI download). Shadow map or a one-quad contact blob per profile. `lightingPresets` exported. |
| `AnimationPlayer` | `root`, `clips`, `clip`, `autoPlay`, `speed`, `loop`, `crossFade`, `onState`; handle `play`, `pause`, `toggle`, `seek(s)`, `getState()` | One mixer; ticks only while playing; never auto-plays under reduced motion (explicit `play()` still works). |
| `HotspotAnchors` + `HotspotLayer` + `HotspotList` (+ `useHotspotStore`) | `hotspots` (`node` and/or `position`), `active`, `onSelect` | Annotations as real DOM buttons projected after each rendered frame (with occlusion fade), plus the same list as an ordered list for keyboard / no-WebGL. |
| `SceneFallback` | `title`, `image`, `imageAlt`, `description`, `facts`, `reason`, `layout` | The standard static preview for `fallback` and model errors. |

## Lifecycle and disposal

- **R3F owns what JSX declares.** Geometries, materials and objects declared as elements are disposed on unmount;
  the renderer is disposed and its context force-lost when `StudioCanvas` unmounts (`__STUDIO3_3D__.disposed` counts it).
- **You own what you `new`.** Anything created in `useMemo`/effects (geometries, materials, render targets, textures,
  mixers, controls) needs a matching `dispose()` in an effect cleanup — every kit component does this, and so do the demos.
- **Models are reference counted.** The cache entry owns the GPU resources and is evicted ~1 s after the last consumer
  unmounts (StrictMode-safe); consumers get clones that share geometry/materials. Clone a material before changing it
  (`PartController` does).
- **One canvas per view.** Need a different context configuration (e.g. antialiasing)? Re-key the `StudioCanvas`
  — the old context is released first (the particle demo does this on quality changes).

## Render on demand

`frameloop="demand"` is the default: nothing is drawn until something calls `invalidate()`. The kit's components
request frames only while something changes (orbit damping tail, camera transitions, explode easing, playing clips,
hotspot projection rides on rendered frames). Use `frameloop="always"` only for content that moves every frame
without input (the particle field, the cinematic light sweep) and give it a pause control; switch back to `demand`
when paused or under reduced motion. Physics fits the same model: Rapier requests frames while bodies are awake, so a
settled scene draws nothing.

## Quality profiles and budgets

`StudioCanvas` picks a level from `detectCapabilities()` (software WebGL and small touch devices → `low`; touch → `medium`;
otherwise `high`) unless `quality` forces one. Defaults:

| Level | DPR | AA | Shadows (map) | Model variant | Density | Env | Budget (calls / triangles / texture bytes) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| high | 1–2 | yes | yes (2048) | desktop | 1 | 256 | 200 / 1.5M / 256 MB |
| medium | 1–1.5 | yes | yes (1024) | mobile | 0.6 | 128 | 120 / 500k / 96 MB |
| low | 0.75–1 | no | no (contact blob) | low-power | 0.3 | 64 | 60 / 150k / 32 MB |

Env values below 256 have no effect on PMREM-prefiltered environments (`LightingRig`, drei `<Environment>`): three's
PMREMGenerator never builds a cube smaller than 256 px.

These are **starting points, not universal budgets**: measure on the project's target devices and override with
`createQualityProfiles()` / `profiles={…}`. Asset variants come from the pipeline
(`studio3 assets variants … && studio3 assets manifest …`); the manifest records bytes, triangles and texture sizes per
build, and the gallery shows the real byte size of the build it loaded.

## Choosing the technology

Read `plugins/studio3/shared/technology-selection.md` §2 before reaching for this kit. In short: real-time 3D only when
the user gains free inspection, a configuration space, spatial data or a reactive surface; render on demand unless
something moves on its own; physics only when unscripted contact is the content; generated environments instead of
remote HDRIs; WebGPU only behind `detectWebGPU()` with a tested WebGL path; non-React projects use `createVanillaScene`.

## Accessibility patterns

- Name the scene (`label`) and describe it (`description`); keep the description in step with state (selected part,
  colourway, chapter).
- Every pointer interaction gets a DOM equivalent: camera preset buttons and zoom buttons next to `OrbitInspect`;
  part lists next to click-to-select; `HotspotList` next to `HotspotLayer`; a body list with nudge/lift/drop next to
  physics dragging; a sortable table next to a 3D graph.
- Never rely on the canvas for information: prices, options, stats and annotations are text outside it, so the
  `fallback` (still image + facts) loses nothing.
- Reduced motion (`useStudioMotion().reduced`): camera moves and layout morphs cut, clips never auto-play, continuous
  loops become still frames rendered on demand; motion that is the content (a physics run, a clip) waits behind an
  explicit control.
- Wheel zoom only when the canvas has focus; one-finger vertical swipes keep scrolling the page (`touchScroll="pan-y"`),
  unless the stage is a touch surface on purpose (particles, physics) and is sized so the page can still be scrolled.
- Show measured numbers only: `renderer.info`, counted geometry, bytes received, rAF intervals "measured on this device";
  estimates are labelled as estimates.
