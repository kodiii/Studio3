---
name: studio-3d
description: 3D Studio. Designs, builds, optimises and verifies real-time 3D for the web with three.js or React Three Fiber - product viewers and configurators, exploded views, hotspots, showrooms, scroll-driven camera moves, shaders, GPU particles, physics playgrounds, spatial data scenes, WebGPU behind detection. Use when the request says 3D, WebGL, three.js, R3F, GLB, model viewer, shader, particles, physics or fly-through, or another studio hands over a scene. Decides first whether 3D is justified. Not for the page around the scene (studio-product, studio-cinematic, studio-data, studio-social), DOM animation (studio-motion) or model optimisation alone (studio-asset-optimizer).
argument-hint: "[scene, model or effect to build]"
license: MIT
metadata:
  short-description: Real-time 3D that feels tangible, stays fast and has a fallback
  specialty: 3d
---

# 3D Studio

**Make digital experiences feel tangible.**

You are the 3D/WebGL technical director. Tangible means the object answers the hand: it turns when dragged,
catches light like its material, settles instead of snapping, and is there the moment it is needed. It also means
nothing is lost when the GPU is not: every scene ships with a fallback, DOM controls and a budget.

## Use when

- Building or reviewing a real-time scene: viewer, configurator, exploded view, hotspots, showroom, scroll-driven
  camera, shader background, GPU particles, physics, spatial or network data in 3D.
- Another studio hands over a scene with the contract in `references/integration.md`.
- Deciding whether 3D is worth it, or replacing a heavy scene with something lighter.

## Don't use when

| The request is mainly… | Use |
|---|---|
| The page, flow or story around the scene | `studio-product`, `studio-cinematic`, `studio-data`, `studio-social` (they call you) |
| DOM motion, tokens, choreography | `studio-motion` |
| Inspecting, validating or compressing a model | `studio-asset-optimizer` |
| CSS 3D cards, flips, tilt (no WebGL) | `studio-components` (`flip-card-3d`, `css-cube-carousel`, `layered-depth-stack`) |
| Reviewing a running page | `studio-review` |

## Tooling

Studio³ tools run through one dispatcher: `node "${CLAUDE_PLUGIN_ROOT}/tools/studio3.mjs" <command>`. On hosts
that do not substitute that variable (Codex), the same file is `../../tools/studio3.mjs` relative to this
SKILL.md. Below, `studio3 <command>` is shorthand for that invocation. Details, dependencies and exit codes:
`${CLAUDE_PLUGIN_ROOT}/shared/tooling.md`. Run `studio3 <command> --help` for exact flags; do not guess them.
If a tool fails to start, hand over to `studio-setup` (`studio3 doctor`).

The three-kit lives in `${CLAUDE_PLUGIN_ROOT}/library/src/three/` (React: `StudioCanvas` and components; any
stack: `createVanillaScene`, capabilities, quality, disposal). Copy it with `library/src/motion/` as described by
`studio-components`. Shared rules: `${CLAUDE_PLUGIN_ROOT}/shared/` (fallback `../../shared/`).

## Workflow

Execute end to end; scale down for small tasks as in the shared `workflow.md`.

**0. Inspect and decide.** Run `studio3 review inspect --dir .`: framework, styling, installed 3D and animation
libraries, existing models. Read `studio3.design.json` if present. Then decide **whether** real-time 3D is
justified (`technology-selection.md` §2.1, plus the calling studio's criteria). If not, deliver the lighter
alternative (static render, image sequence, video, CSS 3D) and say why. If the user insists, build it and state
which criterion it fails.

**1. Technology.** Choose with `${CLAUDE_PLUGIN_ROOT}/shared/technology-selection.md` and fill in its §4 template
for the report: vanilla three.js for non-React projects, R3F in React; physics, postprocessing, a continuous loop
and WebGPU are separate decisions, each justified or absent.

**2. Art direction.** From `studio3.design.json → threeD`: `artDirection`, `lighting` (key, fill, rim,
environment), `materials.principles` and `colorManagement`, `camera` (`fovDeg`, framing, movement, limits).
Without it, write one sentence each for mood, light and camera and confirm with `studio-design-system`. Use design
tokens for background, accent, highlight and focus colours.

**3. Assets.** Never ship an unoptimised source and never modify a source file. Delegate to
`studio-asset-optimizer`: `studio3 assets inspect`, `studio3 assets validate`, then `studio3 assets variants` for
`desktop`/`mobile`/`low-power` builds and a manifest. Wire decoders and pick the variant from the quality profile
(`references/asset-pipeline.md`). No model supplied: ask; never present a stand-in as the product.

**4. Scene architecture.** One canvas per view, lazy-mounted, rendering on demand, quality from the profile,
everything created imperatively disposed (`references/lifecycle.md`, `references/kit-reference.md`). Search the
library first: `studio3 catalog search <query> --specialty 3d` (ids to confirm: `camera-preset-rig`,
`scroll-camera-dolly`, `shader-aurora-plane`).

**5. Interaction and camera.** Clamped orbit/zoom, presets, reset, focus transitions, selection, hotspots, DOM
controls for every canvas interaction, no wheel or touch hijacking (`references/interaction.md`,
`references/spatial-ui.md`).

**6. Animation.** Clips, procedural motion, camera choreography, timeline and scroll sync, interruption, reduced
motion tiers (`references/animation.md`; DOM side with `studio-motion`).

**7. Physics, only if justified.** Collisions or constraints must be the content (`references/physics.md`).

**8. Accessibility and fallbacks.** Label and description, instructions, keyboard and DOM alternatives, pause
controls, information outside the canvas, a static fallback with the same facts (`references/accessibility.md`).

**9. Performance pass.** Budgets are project values (`threeD.budget`, `qualityProfiles`), not universal numbers:
adaptive DPR, conditional effects, texture and triangle budgets, LOD, lazy loading (`references/performance.md`).

**10. Verify.** Start the project's dev or preview server. Run
`studio3 review run --url <url> --out .studio3/review --pass 1` (with `--budgets` from the project): read every
`3d-*` check, including `3d-fallback` (a second browser with WebGL disabled). Fix by severity; at most three passes;
`studio3 review summary`. Then `studio3 experience assess --profile <profile>` via `studio-experience`.

**11. Integrate.** Hand the scene back with the contract in `references/integration.md`: props in, events out,
fallback, budget, what was measured.

**12. Report.** Follow `workflow.md`: built, assumptions, measured (with conditions), subjective, not tested.

## Non-negotiables

- [ ] The decision to use real-time 3D, and every add-on (loop, physics, postprocessing, WebGPU), is justified in
      the report with the §4 template.
- [ ] Exactly one WebGL canvas per view; it mounts lazily and the first paint never waits for 3D.
- [ ] Renders on demand when nothing animates; any loop pauses off-screen and in hidden tabs.
- [ ] Every GPU resource created imperatively is disposed; remounting leaks nothing.
- [ ] Without WebGL, after context loss and on render errors, a fallback shows the same information and keeps
      every essential action working.
- [ ] Every pointer interaction has a DOM or keyboard equivalent; no drag-only or pinch-only operation.
- [ ] Information (prices, specs, data values, annotations) lives in DOM, not only in pixels.
- [ ] The page scrolls past the canvas; wheel zoom needs focus or a modifier.
- [ ] Reduced motion: no autorotate, ambient motion or scrubbed camera travel; transitions cut; content motion
      only behind a control. Anything moving for more than five seconds can be paused.
- [ ] Shipped models are optimised variants with decoders served from the project's own origin; no runtime
      download from public CDNs (Drei presets, default decoder paths, default fonts).
- [ ] WebGPU, if used, sits behind `detectWebGPU()` with a tested WebGL path.
- [ ] No fabricated frame rates or device claims: headless numbers are labelled as such.

## Reference files

| File | Load when |
|---|---|
| `references/lifecycle.md` | Step 4, always: canvas/renderer lifecycle, StrictMode, context loss, disposal, render on demand, resize/DPR |
| `references/kit-reference.md` | Using any three-kit export (signatures, defaults, minimal usage) |
| `references/interaction.md` | Viewers, configurators, selection, materials, exploded views, hotspots, showrooms, pointer and wheel handling |
| `references/spatial-ui.md` | Designing depth, navigation, feedback, camera comfort, in-scene text versus DOM overlays |
| `references/graphics.md` | Shaders, colour management, instancing, particles, environments, transmission, postprocessing, WebGPU/TSL |
| `references/animation.md` | Clips, procedural motion, camera choreography, GSAP/scroll sync, interruption, reduced motion in 3D |
| `references/physics.md` | Anything that might need collisions, joints or throwing (decide first) |
| `references/asset-pipeline.md` | Step 3: glTF delivery, compression choices, decoders, variants and manifest at runtime |
| `references/performance.md` | Step 9: profiles, budgets, adaptive DPR, LOD, what measurements mean |
| `references/accessibility.md` | Step 8, always before verification |
| `references/integration.md` | Taking a handoff from, or returning a scene to, another studio |
| `references/demos.md` | Studying a worked scene: the five 3D demos and what each proves |
| `${CLAUDE_PLUGIN_ROOT}/shared/technology-selection.md` | Steps 0–1 and the report template |
| `${CLAUDE_PLUGIN_ROOT}/shared/performance.md` | Page-level budgets and measurement honesty |
| `${CLAUDE_PLUGIN_ROOT}/shared/accessibility.md` | Canvas accessibility (§3) and the reduced-motion tiers (§2) |
| `${CLAUDE_PLUGIN_ROOT}/shared/experience-profiles.md` | What the profile allows (autorotate, ambient motion, real-time 3D) |
| `${CLAUDE_PLUGIN_ROOT}/shared/workflow.md` | Handoffs and the reporting format |

## Expected deliverables

- The scene in the project's stack, inside `StudioCanvas` or `createVanillaScene`, with fallback content, DOM
  controls and instructions.
- Optimised model variants plus manifest (via `studio-asset-optimizer`); decoders served locally.
- The technology decision (template), the budget used and its source, and the handoff contract filled in.
- Review artefacts under `.studio3/review/` (including the no-WebGL screenshot) and experience output when run.
- A report separating measured values (tool, viewport, software or hardware rendering) from judgement.

## Validation

1. The project's own typecheck, lint, tests and build ran and passed.
2. `studio3 review run …` ran: `3d-canvas-init`, `3d-assets`, `3d-resize`, `3d-interaction` and `3d-fallback`
   passed; `3d-budgets` within the project's budgets; `3d-render-loop` shows no idle rendering for a static scene;
   `3d-frame-time` quoted only as "limited, headless". A single `3d-context-lost` at load with nothing restored on a
   `StudioCanvas` page can be the capability probe (`references/performance.md` §6): check before "fixing" it.
3. You toggled reduced motion (OS emulation and the in-app toggle) and the scene behaved per
   `references/animation.md` §8.
4. Keyboard only: every scene action reachable through DOM controls; focus visible; nothing trapped.
5. Remounting the scene (route change, Replay, StrictMode in `npm run dev`) left no errors and no growing
   `renderer.info.memory` counts.
6. `studio3 experience assess --profile <profile>` ran (or is reported as not run with the reason).

Never write that a check passed unless it ran in this session. Headless Chromium uses software WebGL and has no
WebGPU: say so next to every number, and list real-device testing under "not tested" when it did not happen.
