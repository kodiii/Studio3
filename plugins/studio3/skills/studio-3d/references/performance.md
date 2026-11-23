# Performance — profiles, budgets, levers and honest measurement

A 3D page is fast when the first view never waits for it, a static scene costs nothing, and the device's GPU
memory is respected. Budgets are project values set from the target devices; nothing in this file is a universal
limit. Page-level rules (Core Web Vitals, loading, measurement honesty) are in the shared `performance.md`.

## 1. Profiles

The three-kit has three quality levels; "reduced motion" and "unsupported" are separate states, not GPU tiers.

| State | Kit level / behaviour | Defaults (`defaultQualityProfiles`) |
|---|---|---|
| Desktop | `high` | DPR 1–2, antialias, shadow map 2048, postprocessing allowed, textures ≤ 2048, `desktop` variant, density 1, env 256 |
| Mobile | `medium` | DPR 1–1.5, antialias, shadow map 1024, no postprocessing, textures ≤ 1024, `mobile` variant, density 0.6, env 128 |
| Low-power | `low` | DPR 0.75–1, no antialias, no shadows, textures ≤ 512, `low-power` variant, density 0.3, env 64 |
| Reduced motion | Any level | Demand rendering, no ambient motion or autoplay, cuts instead of camera travel (`animation.md` §8) |
| Unsupported | No canvas | Fallback: static render plus the same DOM information and actions |

`pickQualityLevel(caps, { saveData })`: no WebGL → `low`; device class `low-power` or Save-Data → `low`; `mobile`
or no WebGL 2 → `medium`; otherwise `high`. The device class comes from public signals only: a software renderer,
or a coarse pointer with ≤ 4 GB `deviceMemory` or ≤ 4 cores → `low-power`; a coarse pointer → `mobile`. Treat it as
a first guess, not a verdict. `quality="auto"` on `StudioCanvas` uses it; a user-facing quality control (the gallery
viewer has one) overrides it.

Kit caveats you must know:

- three 0.187 needs WebGL 2, but `StudioCanvas` mounts whenever any WebGL context can be created. On a WebGL 1-only
  device the renderer throws, the error boundary shows the fallback with "The 3D scene failed to load." rather than
  "cannot display interactive 3D". In vanilla code, gate on `detectCapabilities().webgl2`.
- `envResolution` below 256 has no effect in `LightingRig`: three's PMREM generator renders at least 256.
- `defaultBudgets` exists in `quality.ts` but nothing consumes it; budgets are enforced only by your review run.

## 2. Applying `studio3.design.json → threeD.qualityProfiles`

The design file describes tiers as `desktop`/`mobile`/`lowPower` with `dprMax`, `textureMaxPx` and prose for
`shadows`, `postprocessing`, `antialias` and sometimes `frameloop`. Nothing maps them automatically. Translate by
hand, note each judgement, and pass the result to the canvas:

```ts
import { createQualityProfiles } from './three';

// design: desktop / mobile / lowPower → kit: high / medium / low
export const projectProfiles = createQualityProfiles({
  high: { dpr: [1, 2], textureMax: 2048, shadows: true, postprocessing: false }, // "tone mapping only" → no composer
  medium: { dpr: [1, 1.5], textureMax: 1024, shadows: false },                   // "contact/blob or 1024 map" → blob chosen
  low: { dpr: [0.75, 1], textureMax: 512, shadows: false, antialias: false },
});
```

Use it as `<StudioCanvas profiles={projectProfiles}>`; `LightingRig shadow="auto"` then picks a shadow map or the
contact blob from `shadows`. In vanilla code pass `projectProfiles[level]` to `createVanillaScene`.

## 3. Budgets are configurable, and there are three of them

| Where | Keys | Defaults | Used by |
|---|---|---|---|
| `studio3.design.json → threeD.budget` | `modelTransferKb`, `texturesTransferKb`, `drawCalls`, `triangles` | From the brief (tight/balanced/generous) | You: the project's statement |
| `studio3 assets` profile `budgets` | `maxBytes`, `maxTriangles`, `maxVertices`, `maxTextureSize`, `maxGpuTextureBytesEstimate`, `maxDrawCallsEstimate` | None | Asset reports (met/over, never enforced) |
| `studio3 review run --budgets` | `drawCallsPerFrame`, `trianglesPerFrame`, `textureBytes`, `geometryBytes` | 200 / 500 000 / 128 MB / 64 MB | `3d-budgets` check |

Write the project's numbers once (from the design file and the target devices), pass the same values to the asset
pipeline and the review run, and quote the source in the report. A budget is per view and per quality level:
state which level a measurement was taken at.

## 4. Levers, cheapest first

| Problem | Lever |
|---|---|
| Renders when nothing changes | `frameloop="demand"`, settle-then-stop animations, physics `updateLoop="independent"` (`lifecycle.md` §6) |
| Fill rate (big canvas, high DPR, transparent layers) | DPR clamp from the profile, adaptive DPR (§5), fewer full-screen passes, opaque materials |
| Draw calls | Merge static meshes (`studio3 assets optimize --join`), share materials, instancing (`InstancedMesh`, `BatchedMesh`), texture atlases |
| Triangles | Variant per device (`--simplify` via the profile), LOD for large scenes, fewer segments on procedural geometry (`density`) |
| GPU memory | Smaller textures (`textureMax`), KTX2 where memory is the constraint (`asset-pipeline.md` §4), one environment map, dispose on unmount |
| Shader cost | Built-in materials over custom; gate clearcoat, transmission, sheen by level; no per-pixel loops on `low` |
| Shadows | Contact blob on `medium`/`low` (`LightingRig shadow="blob"`); one shadow-casting light; tight shadow camera |
| Postprocessing | Only on `high`, only when art direction names it (`graphics.md` §11) |
| Main thread | No React state per frame; no allocation in `useFrame`; physics bodies capped |

LOD: three's `LOD` (`addLevel(object, distance, hysteresis)`) or Drei `<Detailed distances={[…]}>`. The asset
pipeline produces per-device variants, not distance LOD chains: export the levels yourself (for example by running
`optimize` with different `--simplify` ratios) and load them lazily.

## 5. Adaptive DPR

With `frameloop="always"` and `adaptive` (default on), `StudioCanvas` feeds frame deltas to
`createAdaptiveQuality`: 45-frame windows, target 20 ms; a slow median lowers the DPR factor by 0.125 (down to 0.5),
a fast one raises it again. Demand-rendered scenes are not adapted (their frames are sporadic). Do not stack a second
mechanism (Drei `PerformanceMonitor`/`AdaptiveDpr`) on top; pick one. The level never changes automatically: the
`degrade` signal is unused, so add your own step-down if a scene must drop shadows or effects at runtime.

## 6. Measuring: what each source can and cannot tell you

| Source | Measures | Does not measure |
|---|---|---|
| `renderer.info` (`window.__STUDIO3_3D__`, `useCanvasDiagnostics()`) | Last frame's draw calls, triangles, points, lines; live geometries, textures, programs; DPR; frames rendered; context losses on the kit's canvas | Time, memory in bytes, other canvases |
| `computeModelStats(scene)` | Meshes, triangles, vertices, materials, textures, largest texture; byte figures as **estimates** | What the driver really allocates |
| `useFrameTiming(enabled)` | rAF cadence on this device | Anything about other devices; it is not a benchmark |
| `studio3 review run` 3D checks | Context creation, losses, failed model/texture requests, draw calls and triangles per frame (instrumented WebGL calls), texture and buffer bytes (estimates), idle rendering, resize correctness, errors after pointer/touch input, re-initialisation after navigation, the no-WebGL fallback, WebGPU adapter availability | Real GPU time, thermals, phone memory pressure, hidden-tab behaviour, work in workers, context release on navigation |
| `3d-frame-time` | rAF intervals in headless Chromium | Always `limited`: software rendering; never quote it as device performance |

Counts (draw calls, triangles, textures) are properties of the scene, variant, level and viewport, so headless
runs are valid regression checks for them. Timings from software-rendered CI are not device numbers: report frame
rates only from a named real device, with conditions.

Known Visual Director artefact: `detectCapabilities()` probes WebGL on a throwaway canvas and releases it with
`WEBGL_lose_context.loseContext()`. The review counts that as a context loss, so a `StudioCanvas` page can report
one major `3d-context-lost` ("lost 1 time(s) … 0 restored") at load. Confirm with
`window.__STUDIO3_3D__.contextLost` (the kit counts only its own canvas); if it is 0, report the finding as the
probe, not as a scene defect. `3d-cleanup` is usually `limited` on `StudioCanvas` pages: React does not unmount on a
full navigation, so `disposed` does not change at `pagehide`; verify disposal by remounting instead
(`lifecycle.md` §5).

## 7. Loading

- Poster first (the manifest's `fallbackImage`), at the canvas size, so there is no layout shift.
- The 3D code is its own chunk: dynamic import (`React.lazy`, or `next/dynamic` with `ssr: false` in Next.js) of
  the component that renders `StudioCanvas`. `StudioCanvas lazy` (default) mounts within 200 px of the viewport.
- Start the model download on intent with `preloadModel(url)`; on Save-Data or the `low` level, wait for an
  explicit "View in 3D" press.
- Physics and postprocessing load only with the scene that uses them.

## 8. Checklist

- [ ] Budgets written down with their source; the same numbers passed to `studio3 assets` and `studio3 review run`.
- [ ] Each quality level was exercised (force `quality="low"` and `"medium"`) and still looks intentional.
- [ ] Idle scene: `3d-render-loop` shows no continuous drawing; off-screen and hidden tabs render nothing.
- [ ] Draw calls, triangles and texture memory within budget at each level; byte figures labelled as estimates.
- [ ] Timings are reported only with device and conditions; headless results labelled as such.
