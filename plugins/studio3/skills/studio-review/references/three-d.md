# 3D diagnostics

`review run` instruments `getContext`, WebGL draw/texture/buffer calls and context-loss events with an init script,
and reads the optional `window.__STUDIO3_3D__` hook (set automatically by the Studio³ `StudioCanvas`). Diagnostics
run when a WebGL/WebGPU context exists; otherwise every 3D check reports `not-applicable`.

## Checks and how to act

| Check | Fails when | Usual fix |
| - | - | - |
| `3d-canvas-init` | context requested but not obtained, or a canvas exists with no context | detect capability before mounting (`detectCapabilities()`), render the fallback instead of an empty canvas |
| `3d-context-lost` | `webglcontextlost` fired | reduce GPU memory (texture sizes, render targets), handle loss (`preventDefault`, offer retry); StudioCanvas does this |
| `3d-assets` | model/texture requests failed, loader errors in the console | fix paths, ensure decoders are wired (meshopt: `setMeshoptDecoder`; Draco: `DRACOLoader`; KTX2: `KTX2Loader.detectSupport(renderer)`), show an error state |
| `3d-budgets` | draw calls / triangles / texture or geometry bytes above the configured budgets | instancing, merging static meshes, LOD or a lighter variant (`studio-asset-optimizer`), smaller textures; budgets come from `--budgets` or `studio3.design.json` — defaults are not universal |
| `3d-frame-time` | always `limited` | headless software rendering: use it only to spot pathological spikes; never report it as device performance |
| `3d-render-loop` | info: draws continue during a 2 s idle window | if the scene is static at rest, switch to render-on-demand (`frameloop="demand"` + `invalidate()`); a continuous loop is fine while something actually animates |
| `3d-resize` | drawing buffer does not follow the CSS size, or the image is stretched | ResizeObserver-driven sizing, update camera aspect, clamp DPR from the quality profile |
| `3d-interaction` | new errors after pointer/touch drag or wheel | guard handlers for zero-size canvases, release pointer capture, avoid allocating in move handlers |
| `3d-cleanup` | re-initialisation errors after navigating away and back; `limited` without the hook | dispose geometries/materials/textures/render targets you created imperatively; stop loops; remove listeners (see `studio-3d` lifecycle reference) |
| `3d-fallback` | no visible fallback content or uncaught errors with WebGL disabled | mark the fallback container with `data-studio3-fallback`, include a static image and the essential information/actions |
| `3d-webgpu` | `unavailable` is a status, not a failure | WebGPU must always have a WebGL path; report availability honestly |

## Budgets

Pass the project's budgets explicitly:

```bash
studio3 review run --url http://localhost:3000 --routes /product --budgets '{"drawCallsPerFrame":120,"trianglesPerFrame":500000,"textureBytes":100663296,"geometryBytes":67108864}'
```

Derive them from the target devices in `studio3.design.json → threeD.qualityProfiles` and verify on real devices.
The texture byte figure is an estimate (width × height × 4, × 1.33 with mipmaps); say "estimated" when you quote it.

## What cannot be measured here

Real GPU time, thermal throttling, memory pressure on phones, WebGPU rendering in browsers without an adapter, work
in Web Workers/OffscreenCanvas, and context release on navigation. List these under limitations instead of
implying coverage.
