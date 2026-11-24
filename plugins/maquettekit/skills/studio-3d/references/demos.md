# The five 3D demos

Full compositions in `${CLAUDE_PLUGIN_ROOT}/library/src/demos/3d/<id>/`, served by the gallery at
`/demos/3d/<id>` (the `/3d` page lists them next to the model viewer). Everything below is read from each demo's
`meta.ts` and source. All brands, copy and data are fictional. Use them to study a pattern; copy parts through
`studio-components`, not whole demos.

Every demo is covered by `tests/e2e/demos.spec.ts`: loads without errors and passes axe (serious/critical) inside
its stage, keyboard focus moves with a visible indicator, no infinite animations under reduced motion at 390 px, no
horizontal overflow, and — because all five have 3D — falls back without WebGL (`[data-maquettekit-fallback]`
visible, no `<canvas>`).

## product-configurator — "Pulse Configurator"

A configurator for a fictional portable speaker: colourways, finishes, camera presets, exploded view,
annotations and a price summary that work with or without the canvas.

| | |
|---|---|
| Files | `index.tsx`, `controls.tsx`, `config.ts` (options, prices, presets, hotspots), `meta.ts`, `styles.module.css` |
| Kit | `StudioCanvas`, `Model`, `ModelBoundary`, `useModelManifest`, `useModelProgress`, `LightingRig`, `OrbitInspect`, `CameraRig`, `PartController`, `AnimationPlayer`, `HotspotAnchors`/`HotspotLayer`/`HotspotList`, `useHotspotStore`, `SceneFallback`, `detectCapabilities` |
| Proves | One GLB, three optimised builds picked from the quality profile with the real size shown; per-material overrides that never mutate originals; exploded view from glTF extras (critically damped, staggered); interruptible camera presets; every option a native control mirrored in a text summary |
| Accessibility | Radio groups with text names; arrow/`+`/`−`/`0` keys on the focused view, wheel zoom only with focus; parts selectable from a list; hotspots as buttons plus a list; `aria-live` summary |
| Reduced motion | Presets and explode cut; the dial clip never autoplays, only runs from its Play button |
| Data | Product, brand, specifications and prices are fictional |

## cinematic-landing — "Pulse Night Edition"

An art-directed launch page: the speaker on a black stage, a skippable opening camera move, a slow key-light sweep,
and a scroll-driven camera through two chapters of editorial copy.

| | |
|---|---|
| Files | `index.tsx`, `Director.tsx`, `meta.ts`, `styles.module.css` |
| Kit and recipes | `StudioCanvas`, `Model`, `ModelBoundary`, `useModelManifest`, `LightingRig`, `PartController`, `AnimationPlayer`, `detectCapabilities`; Motion Lab `useScrollProgress`, `useStudioMotion`; recipe `split-line-reveal` for the headline |
| Proves | A choreographed opening on a centripetal Catmull-Rom path, interrupted by Skip or the first scroll; scroll progress through a pinned section driving the camera between three held poses with critically damped easing and separate portrait framings; ambient light with a Pause control |
| Loop | `frameloop` is `always` only while the ambient light plays (and not under reduced motion); otherwise demand |
| Accessibility | All copy is DOM text; the canvas is named and its scroll behaviour described; Skip for the 5.2 s opening, Pause for the light (WCAG 2.2.2); section buttons; still render plus unchanged copy without WebGL |
| Reduced motion | No opening move; camera cuts between chapter poses; lights and status ring hold still; headline appears without its rise |
| Collaborates | `cinematic` |

## particle-experience — "Drift — a particle study"

GPU particles that form and re-form a sphere, a torus and a glyph, disturbed by pointer or touch, with live
renderer readouts that are measured, never invented.

| | |
|---|---|
| Files | `index.tsx`, `Field.tsx`, `shaders.ts`, `shapes.ts`, `meta.ts`, `styles.module.css` |
| Kit | `StudioCanvas`, `useQuality`, `useCanvasDiagnostics`, `useFrameTiming`, `formatCount`, `detectCapabilities` |
| Proves | All motion in the vertex shader (each particle stores its point on three forms plus a seed; the CPU updates uniforms only); count = requested × profile density; quality switchable live; readouts are last-frame `renderer.info` and the rAF interval labelled as measured on this device |
| Loop | `frameloop` is `always` only while the field animates; paused or reduced → demand |
| Accessibility | Native labelled controls; the pointer push has a keyboard equivalent (Pulse button); Pause control; text description follows form and count; still SVG of the sphere without WebGL |
| Reduced motion | A still frame rendered on demand: no flow or cycling, forms cut, push and Pulse off |
| Performance notes | One draw call; additive blending without depth writes; seeded form buffers rebuilt per count and the old geometry disposed |

## physics-playground — "Blockwerk Play Table"

Rigid-body physics with Rapier: drag, throw and stack blocks, tilt gravity, and watch rendering stop once
everything sleeps, with a full keyboard path through a body list.

| | |
|---|---|
| Files | `index.tsx`, `World.tsx` (lazy-loaded), `bodies.ts` (shapes, colours, `MAX_BODIES = 40`), `meta.ts`, `styles.module.css` |
| Kit | `StudioCanvas`, `CameraRig`, `ModelBoundary`, `useQuality`, `useCanvasDiagnostics`, `formatCount`, `detectCapabilities`; Rapier `Physics`, `RigidBody`, `CuboidCollider`, `BallCollider`, `CylinderCollider`, `useRapier`, `useBeforePhysicsStep`, `useAfterPhysicsStep` |
| Proves | Rapier (WASM included) code-split with `React.lazy`, fetched only when the canvas starts; `<Physics paused timeStep={1/60}>` stepped from `useFrame` with a clamped delta so the loop idles when all bodies sleep; a 40-body cap recycling the oldest; kinematic drag on a camera-facing plane with a velocity throw |
| Accessibility | Keyboard path: pick a body in a radio group, then Nudge/Lift/Drop/Remove; body state as text; changes announced politely; gravity as named radios and a labelled slider |
| Reduced motion | The simulation starts paused and runs only after "Run simulation"; camera views cut |
| Without WebGL | A drawing of the starting arrangement; the physics engine is never downloaded |

## spatial-data — "Meridian Service Atlas"

A seeded, fictional map of 43 services in five clusters: instanced nodes and one line batch in 3D, a flat 2D
layout for honest comparison, and a sortable table kept in sync with the scene.

| | |
|---|---|
| Files | `index.tsx`, `Atlas.tsx`, `data.ts` (seeded data, layout relaxation), `meta.ts`, `styles.module.css` |
| Kit | `StudioCanvas`, `OrbitInspect`, `CameraRig`, `useCanvasDiagnostics`, `formatCount`; R3F `addAfterEffect` for label projection |
| Proves | Five draw calls for the graph (one instanced mesh per node shape, one `LineSegments` for all 74 links); selection shared between scene, details panel and table; an on-demand morph to a 2D layout, with copy on why the flat view is the accurate one |
| Accessibility | The sortable table is the full equivalent (with `aria-sort`); cluster is never colour alone (spatial neighbourhoods with names; node type is shape, with a legend); keyboard map controls; an SVG flat map without WebGL |
| Reduced motion | Layout switches and node focus cut; nothing moves on its own |
| Data | Simulated from a fixed seed; describes no real system |
| Collaborates | `data` |

## Which demo to study

| You are building | Study |
|---|---|
| A configurator or viewer with parts, materials, hotspots | `product-configurator`, then the gallery `/3d` viewer (`apps/gallery/src/components/three-gallery/ModelViewer.tsx`) |
| A launch or story page with a scroll-driven camera | `cinematic-landing` (with `studio-cinematic`) |
| Shader-driven particles, measured readouts | `particle-experience` |
| Physics, drag and throw, idle loop | `physics-playground` |
| Graphs, networks, 3D data with a table equivalent | `spatial-data` (with `studio-data`) |

Re-check this list with `maquettekit catalog list --kind demos` before citing a demo; ids are authoritative there.
