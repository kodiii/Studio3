# The five 3D demos

> **Quick card** — the must-dos from this file; read on for the reasons and the detail.
>
> - Pick by job: configurator or viewer → `product-configurator`; scroll-driven launch → `cinematic-landing`; GPU particles → `particle-experience`; physics → `physics-playground`; graphs with a table → `spatial-data`.
> - Light the canvas and the DOM from one direction: each demo's controls take their shadows from the scene's key light.
> - Hand the main subject over with velocity (turntable inertia, a speaker that swings back, thrown blocks) and give every gesture a button or key twin.
> - Render continuously only while something animates; a settled scene draws nothing.
> - Keep the page complete without WebGL: a still render, drawing or SVG map plus the same controls and text.
> - Under reduced motion nothing moves on its own: no inertia, sway, intros or pulses; presets cut.
> - With Rapier, queue body mutations into `useBeforePhysicsStep` and check a body still exists before touching it.
> - `product-configurator` and `cinematic-landing` also exist outside 3D: name these as `3d/product-configurator` and `3d/cinematic-landing` in `catalog show` and `catalog install`.

Full compositions in `${CLAUDE_PLUGIN_ROOT}/library/src/demos/3d/<id>/`, served by the gallery at `/demos/3d/<id>`
(the `/3d` page lists them next to the model viewer). Everything below is read from each demo's `meta.ts` and
source; all brands, copy and data are fictional. The rows show how each meets the craft floor
(`${CLAUDE_PLUGIN_ROOT}/shared/motion-craft.md` §1). Use them to study a pattern; copy parts through
`studio-components`, not whole demos.

Every demo is covered by `tests/e2e/demos.spec.ts`: loads without errors and passes axe (serious/critical) inside its
stage in the light and dark gallery themes, keyboard focus moves with a visible indicator, no infinite animations
under reduced motion at 390 px, no horizontal overflow, and without WebGL a fallback (`[data-maquettekit-fallback]`
visible, no `<canvas>`).

`product-configurator` and `cinematic-landing` also name demos in `studio-product` (a 2D bike configurator) and
`studio-cinematic` (an SVG organ launch), so the bare ids are refused as ambiguous: use `3d/product-configurator` and
`3d/cinematic-landing` with `catalog show` and `catalog install`.

## product-configurator — "Pulse Configurator"

A configurator for a fictional portable speaker in a soft-box studio: colourways and finishes, camera presets,
exploded view, annotations and a price summary that all work with or without the canvas.

| | |
|---|---|
| Files | `index.tsx`, `scene.tsx` (studio lights, turntable, ground shadow, finish sweep), `controls.tsx`, `config.ts` (options, prices, presets, hotspots), `meta.ts`, `styles.module.css` |
| Kit and recipes | `StudioCanvas`, `Model`, `ModelBoundary`, `useModelManifest`, `useModelProgress`, `LightingRig`, `OrbitInspect`, `CameraRig`, `PartController`, `AnimationPlayer`, `HotspotAnchors`/`HotspotLayer`/`HotspotList`, `useHotspotStore`, `SceneFallback`, `detectCapabilities`; adapts `orbit-inspect-controls`, `number-ticker`, `press-depth-button` |
| Signature move | The finish sweep: a lit seam crosses the speaker with the old finish ahead and the new one behind, patched into the `PartController`'s material clones (originals untouched) |
| Physical and lit | The view follows the hand 1:1, then keeps the release velocity and eases out with friction. The studio lights (key upper right, generated environment) turn with the camera, so highlights glide over the finish; controls are lit from the same side; a two-layer contact shadow from the real geometry follows the exploded parts |
| Alive | Left alone, the view sways and the status ring breathes until touched (Pause motion stops both); the total counts between prices |
| Hands | Drag or flick; on the focused view ←/→ spin with inertia, ↑/↓ tilt, `+`/`−`/`0`; wheel zoom only with focus; parts selectable from a list; annotations as buttons plus a list |
| Reduced motion | No inertia, sway or breathing; presets and explode cut; the finish change is a 160 ms cross-fade; the dial clip runs only from Play |
| Copy | `Turntable` (1:1 orbit plus measured release velocity) and `GroundShadow` (re-rendered only when geometry moves) from `scene.tsx`; one GLB in three optimised builds picked by quality profile, with the real size shown; every option a native control mirrored in a text summary |

## cinematic-landing — "Pulse Night Edition"

An art-directed launch page: the Pulse speaker on a stone plinth in a dark room, a skippable opening camera move, one
key light shared by scene and copy, and a scroll-driven camera through two chapters in which you can turn the
speaker and its dial by hand. Collaborates with `studio-cinematic`.

| | |
|---|---|
| Files | `index.tsx`, `Director.tsx` (camera, light, hands), `stage.ts` (shots, light plan, springs, plinth and shadow builders), `MagneticPill.tsx`, `meta.ts`, `styles.module.css` |
| Kit and recipes | `StudioCanvas`, `Model`, `ModelBoundary`, `useModelManifest`, `LightingRig`, `PartController`, `AnimationPlayer`, `useQuality`, `detectCapabilities`; Motion Lab `useScrollProgress`, `useStudioMotion`, `useRafLoop`; uses `split-line-reveal`; adapts `magnetic-button` and `press-depth-button` (`MagneticPill.tsx`) |
| Signature move | The staged opening (2.5 × the `epic` token, 3.5 s, skippable): the rim light draws the silhouette, the key comes up, the ring glows, while the camera arcs in. Chapter changes swing and pull back, or crane up as the speaker turns half round |
| Physical and lit | A filleted stone plinth fading into the dark, a two-layer contact shadow, a key-light shadow where the profile allows, fog for depth; the key light's angle also drives the headline's sheen and the controls' lit edges and shadows |
| Alive | The key light and environment swing toward the pointer through critically damped smoothing; the camera sways ±3° |
| Hands | Drag the speaker, or ←/→ on the focused stage: it keeps the release velocity and swings back on `glide`. In the dial chapter the same gesture turns the dial through 30 detents that snap on `press`; Turn the dial down/up buttons do the same |
| Reduced motion | No opening, sway, light drift or breathing ring; camera and pose cut per chapter; drags still turn speaker and dial but return or snap without springing |
| Copy | `stage.ts` shots (spherical plus a lens shift, so the speaker sits opposite the copy without keystoning); a scrim under every copy block (5.8:1 or better for body text at each held chapter); passive listeners into refs, so React renders only on chapter or volume changes |

## particle-experience — "Drift — a particle study"

A full-bleed field of glowing GPU particles that forms and re-forms a sphere, a torus and an abstract glyph, turns
toward the pointer and is pushed around by a pointer or a finger, with renderer readouts that are measured, never
invented.

| | |
|---|---|
| Files | `index.tsx`, `Field.tsx`, `shaders.ts`, `shapes.ts` (seeded forms), `meta.ts`, `styles.module.css` |
| Kit and recipes | `StudioCanvas`, `useQuality`, `useCanvasDiagnostics`, `useFrameTiming`, `formatCount`, `detectCapabilities`; adapts `press-depth-button` |
| Signature move | Morphs staggered per particle that bloom outwards mid-flight, all in the vertex shader (each particle stores its point on three forms plus a seed; the CPU updates uniforms only) |
| Physical and lit | Glow and depth from the shader, not postprocessing: a white-hot core in a soft halo, additive blending turning overlaps into bloom, points off the focus plane dimmer and wider. The control keys are lit from above by the field and spring back on a `linear()` curve |
| Alive | The field turns a little toward the pointer; an ember nebula and a soft light follow the pointer behind the canvas |
| Hands | A pointer or a sideways touch drag pushes the field (vertical swipes still scroll); keyboard twin: the Pulse key. Pause sits next to the animation (WCAG 2.2.2) |
| Reduced motion | A still frame rendered on demand: no flow, cycling or turning; forms cut; push and Pulse off |
| Copy | Count = requested × profile density (1 / 0.6 / 0.3), quality switchable live; readouts from last-frame `renderer.info` and the rAF interval, labelled as measured on this device; one draw call; form buffers rebuilt per count, old geometry disposed |

## physics-playground — "Blockwerk Play Table"

Rigid-body physics with Rapier on a lit wooden workbench: lacquered blocks drop in, lift when you point at them, and
can be picked up, thrown, stacked and tilted, with a keyboard path through a body list and a render loop that goes
idle once everything sleeps.

| | |
|---|---|
| Files | `index.tsx`, `World.tsx` (the lazy physics chunk), `Table.tsx` (workbench and light, no physics import), `wood.ts` (procedural grain), `bodies.ts` (shapes, colours, `MAX_BODIES = 40`), `meta.ts`, `styles.module.css` |
| Kit and recipes | `StudioCanvas`, `CameraRig`, `LightingRig`, `ModelBoundary`, `useQuality`, `useCanvasDiagnostics`, `formatCount`, `detectCapabilities`; Rapier `Physics`, `RigidBody`, `CuboidCollider`, `BallCollider`, `CylinderCollider`, `useRapier`, `useBeforePhysicsStep`, `useAfterPhysicsStep`; adapts `press-depth-button` |
| Signature move | A motion language on token springs: blocks drop in lowest first and squash on landing (what they land on gives a little too); real landings squash by impact speed |
| Physical and lit | A grabbed block rises before it follows the hand, and keeps its velocity and spin when thrown. Bevelled blocks with object-space wood grain, lacquer on the high profile, one window light from the upper left; table and DOM shadows fall down and to the right |
| Alive | The block under the pointer lifts and rim-lights while its shadow spreads; the visual springs act on meshes only, never on bodies |
| Hands | Drag, throw, stack, tilt gravity. Keyboard: pick a body in a radio group, then Nudge, Lift, Drop or Remove; body state as text, changes announced; the first press lands the drop-in |
| Reduced motion | No drop-in, squash or hover lift; the simulation starts paused and runs only after "Run simulation"; camera views cut |
| Copy | `World.tsx`'s two rules: queue every event-driven body mutation into `useBeforePhysicsStep`, and check a body still exists before touching it (`@react-three/rapier` 2.2 never calls a ref with `null` on removal, and a stale handle used to panic Rapier). Rapier code-split with `React.lazy`; a fixed 1/60 s step on a clamped clock; frames only while a body is awake |

## spatial-data — "Meridian Service Atlas"

A seeded, fictional map of 43 services in five clusters, lit like objects on a map table, with a flat 2D layout for
honest comparison and a sortable table kept in sync with the scene. Collaborates with `studio-data`.

| | |
|---|---|
| Files | `index.tsx`, `Atlas.tsx` (the scene), `data.ts` (seeded data, layout relaxation), `meta.ts`, `styles.module.css` |
| Kit and recipes | `StudioCanvas`, `OrbitInspect`, `CameraRig`, `LightingRig`, `useQuality`, `useCanvasDiagnostics`, `formatCount`; R3F `addAfterEffect` for label projection; no recipes |
| Signature move | Selection answers physically: the node pops on a spring, a halo settles round it, two pulses run along each incident link from caller to callee and the far node bumps when one arrives; the scene is still again in about 2.5 s |
| Physical and lit | Fog into the paper, contact shadows projected along the key light (a floor in 3D, the paper in 2D), glazed env-lit nodes with a fresnel rim, the key light kept at the upper left of the view like every DOM shadow. Links are one instanced tube bent along a quadratic curve in the vertex shader |
| Alive | The graph turns a few degrees toward the pointer and the key light drifts with it (3D only) |
| Hands | Drag, wheel after focusing, or arrow / Shift+arrow / `+` / `−` on the focused map; selecting in the scene, the details card or the table selects everywhere. The sortable table (`aria-sort`) is the full equivalent; cluster is never colour alone |
| Reduced motion | Layout switches and node focus cut; no parallax, pointer light, pulses, pops or bumps |
| Copy | The deterministic force relaxation (the same atlas on every load); seven draw calls at most (one instanced mesh per node shape, one for all 74 links, one for contact shadows, one for the halo), restyled through instance attributes; a memoised scene the diagnostics poll cannot wake; a details card of fixed height, so the table never moves under the pointer |

## Which demo to study

| You are building | Study |
|---|---|
| A configurator or viewer with parts, materials, hotspots | `product-configurator`, then the gallery `/3d` viewer (`apps/gallery/src/components/three-gallery/ModelViewer.tsx`) |
| A launch or story page with a scroll-driven camera | `cinematic-landing` (with `studio-cinematic`) |
| Shader-driven particles, measured readouts | `particle-experience` |
| Physics, drag and throw, idle loop | `physics-playground` |
| Graphs, networks, 3D data with a table equivalent | `spatial-data` (with `studio-data`) |

Four demos in other studios also carry a canvas: `product-showcase` (`studio-product`), `immersive-3d-hero`
(`studio-cinematic`), `spatial-data-viz` (`studio-data`) and `3d-social-post` (`studio-social`). Re-check with
`maquettekit catalog list --kind demos` before citing a demo; ids are authoritative there.
