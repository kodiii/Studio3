# Technology selection

One decision document for every specialty. Pick the lightest technology that fully delivers the effect, state the
reason, and record what you rejected. "Lightest" means: fewest shipped bytes, fewest concepts for the next
maintainer, least main-thread and GPU work, and no new dependency when an installed one already does the job.

Before choosing, run `studio3 review inspect --dir .` (framework, styling, animation and 3D libraries, model files)
and read the project's `package.json`. The stack you find outranks every preference below. When
`studio3.design.json` exists, its `threeD.technology` block (recommendation, packages, options considered, WebGPU
note) and `motion.profile` are the starting point: confirm or overrule them with a stated reason (§2.5).

## 0. Rules that override the tables

1. **Use what is installed.** If the project already ships GSAP, do not add Motion for one hover (and vice versa).
2. **Never force React tooling onto a non-React project.** No React Three Fiber, Drei, `@react-three/rapier` or
   `motion/react` in Vue, Svelte, Angular, Astro islands without React, or plain HTML. Use three.js directly
   (`createVanillaScene` in the three-kit), CSS/WAAPI, Motion's framework-free `animate()`/`scroll()` from `motion`,
   or vanilla GSAP. Community bindings (TresJS, Threlte) are separate decisions, not part of Studio³.
3. **One animation owner per element and property.** Never let two libraries (or a library and a CSS transition)
   write the same property of the same element. Split the element (outer wrapper / inner content) or pick one.
4. **3D does not imply physics, postprocessing or a continuous loop.** Each is a separate decision with its own
   justification (§2.3). The default scene renders on demand, has no physics and no postprocessing.
5. **WebGPU only behind detection, with a WebGL path that ships and is tested.** `navigator.gpu` existing is not
   enough; an adapter must be acquired (`detectWebGPU()` in the three-kit). Headless CI Chromium normally has
   software WebGL and no WebGPU, so the WebGL path is the one automated checks exercise.
6. **External services need permission.** Never upload project assets, models, screenshots or copy to a hosted tool
   (Spline, online converters, CDNs, AI services) without the user's explicit agreement.
7. **No silent network fetches.** Several Drei helpers download from public CDNs by default (§2.2, Drei row). Ship
   decoders, fonts and environment maps from the project's own origin.
8. **Check licences before adding**, from the installed package, not from memory:

| Package (installed version) | Licence as declared | Note |
|---|---|---|
| `three` 0.187, `@react-three/fiber` 9.8, `@react-three/drei` 10.7, `motion` 14.14 | MIT | |
| `@react-three/rapier` 2.2 | no `license` field in the installed `package.json` | Upstream repository states MIT; confirm before relying on it. Its engine `@dimforge/rapier3d-compat` 0.19 is Apache-2.0 |
| `gsap` 3.15, `@gsap/react` 2.1 | GreenSock standard "no charge" licence | Free of charge, not an open-source licence. Both packages, the React hook included. Read the terms for the project's use |
| `d3` 7.9 | ISC | |

For anything else, read the `license` field of the installed package and say what you read.

## 1. Animation technology ladder

Climb only when the rung below cannot do the job. Stop at the first rung that can.

| Rung | Technology | Choose when | Climb when | Cost and obligations |
|---|---|---|---|---|
| 1 | CSS transitions/keyframes, `@starting-style`, scroll-driven animations (`animation-timeline`) | State is a class, attribute or pseudo-class; hover/focus/press; one-shot reveals; decorative scroll-linked progress | Keyframes depend on runtime measurement; sequencing across elements with interruption; scrubbing from script | No JS. Scroll-driven animations need `@supports` and a usable static default |
| 2 | Web Animations API via Motion Lab: `createSequence`, `flip`, `viewTransition` | Multi-element choreography, stagger, labels, reverse, scrubbing with `seek()`, FLIP layout moves, state/route transitions | Gesture-driven springs with velocity, React exit animations, automatic layout animation of many components | No dependency. You own cleanup (`cancel()`) |
| 3 | Motion: `motion/react` in React; `animate()`/`scroll()` from `motion` elsewhere | React state-driven presence (`AnimatePresence`), `layout`/`layoutId`, drag and gestures with springs, interruption with velocity hand-off | A long scrubbed multi-track scroll timeline, pinning choreography, complex nested timelines | One dependency (MIT) |
| 4 | GSAP (+ ScrollTrigger; `useGSAP` from `@gsap/react` in React) | Long scrubbed scroll timelines with many tracks, snap, nested sequencing, SVG morph/draw at scale, framework-free timelines | The subject is a real 3D object or per-pixel imagery | One dependency plus plugins; GreenSock licence; ScrollTrigger refresh discipline |
| 5 | three.js / React Three Fiber | Genuine 3D: meshes, materials, lighting, camera, shaders, GPU particles | — | Largest cost: renderer, assets, GPU memory, fallbacks, a second accessibility path |

### Need → first rung that does it

| Need | Rung | Studio³ building block |
|---|---|---|
| Hover, press, focus feedback | 1 | CSS with `--s3-duration-*` / `--s3-ease-*` |
| Element enters once, no orchestration | 1 | CSS keyframes, or `@starting-style` for elements that appear |
| Decorative progress tied to scroll | 1 | `animation-timeline: scroll()/view()` in `@supports`, JS fallback `useScrollProgress` |
| Several elements in sequence, stagger, reversible | 2 | `createSequence()` |
| Element changes position/size between states | 2 (3 in React with exits) | `flip()`; Motion `layout` |
| Shared element between routes or states | 2 | `viewTransition()` (falls back to an instant update) |
| Spring that follows a drag and keeps velocity | 3 | Motion `drag`, `useSpring`; tokens `spring.*` |
| Spring feel without a JS loop | 1–2 | `springToLinear()` → CSS/WAAPI `linear()` easing |
| Pinned, scrubbed, multi-track scroll scene | 4 | GSAP ScrollTrigger; pin with CSS `position: sticky` where possible |
| Camera, uniforms or meshes in sync with page scroll | 4 or 2 → 5 | Scroll progress (ScrollTrigger or `useScrollProgress`) driving a ref; `invalidate()` (studio-3d `animation.md`) |
| An object the user turns over, configures or explores | 5 | `StudioCanvas` or `createVanillaScene` |

Decision questions, in order:

1. Can a class toggle plus a CSS transition express it? Use CSS.
2. Is it scroll-linked and decorative? CSS scroll-driven animation inside `@supports (animation-timeline: view())`,
   with the final state as the default; JS fallback only if the effect matters on unsupported engines.
3. Sequencing, stagger or scrubbing across elements, no gestures? `createSequence()`.
4. Layout position or size changes between states? `flip()`; in React with exits or drag, Motion `layout`.
5. A pinned, scrubbed, multi-track scroll scene? GSAP ScrollTrigger.
6. A three-dimensional object, or per-pixel generative imagery? Go to §2.

Bundle reasoning without numbers: do not quote library sizes from memory. If size matters to the decision, measure
it in the project (`npm run build` output, the bundler's analyser) and quote what you measured.

## 2. 3D technology selection

### 2.1 First decide whether 3D is justified

Real-time 3D is justified when the user gains something a still, a video or CSS cannot give: free inspection of an
object, a configuration space too large to pre-render, spatial data that reads better with depth, or a generative
surface that must react to input. If none applies, choose a static render, an image sequence, video or CSS 3D, and
say so. The specialty's own criteria (studio-product `product-3d.md`, studio-cinematic `cinematic-3d.md`,
studio-data's spatial-data guidance) are stricter and win for their surfaces.

### 2.2 Options

| Option | Choose when | Do not choose when | Costs and obligations |
|---|---|---|---|
| Static renders (stills, image sequence, short muted video) | Decorative depth; tight budgets; the fallback tier of every real-time scene | The user must control the view or configuration freely | Art pipeline only; alt text; video needs a pause control and a poster |
| Native CSS 3D (`perspective`, `transform-style: preserve-3d`) | Planar things in depth: cards, flips, cubes, layered parallax, tilt | Meshes, lighting, materials, hundreds of elements | No dependency; DOM stays accessible; rotated text can blur; large composited layers cost GPU memory |
| three.js (vanilla) | Non-React project, or a self-contained scene embedded in any page | A React app whose scene state follows component state | You own the lifecycle: resize, loop, pause, context loss, disposal (`createVanillaScene` covers most) |
| React Three Fiber | React project; scene state from props; composition with the app | Non-React projects | Per-frame React state is a bug: mutate refs in `useFrame`; dispose what you create imperatively |
| Drei | A specific helper you would otherwise write (instancing, bounds, BVH raycasting, text, HTML overlays, `Lightformer` environments) | One trivial helper; or a helper whose default fetches remote files you cannot ship | Import named helpers only. Verified CDN defaults in 10.7: `Environment preset` (HDR files), `useGLTF` Draco decoder, `useKTX2` transcoder, `Text` without `font` (font resolver), `useDetectGPU` (benchmarks), `MatcapTexture`, `NormalTexture`, `Cloud` textures |
| React Three Rapier | Unscripted collisions, stacking, joints or constraints are the content | Motion that springs, eases or follows a path: that is maths, not physics | WASM engine inlined in a large JS module, loaded on mount (suspends); fixed timestep; body caps; pause off-screen |
| GSAP with three | A scroll- or time-driven timeline must drive camera, uniforms or transforms in step with DOM motion | Simple damping toward a target (a few lines in the frame callback) | Tween plain objects or uniforms; `invalidate()` in `onUpdate`; revert on unmount |
| Spline | The scene is authored and maintained by a designer in Spline and that file is the source of truth | You need control over loading, quality tiers, disposal, accessibility or self-hosted delivery | External runtime (`@splinetool/runtime`, `@splinetool/react-spline`; not installed here, API unverified); scenes are often hosted by the service; read its current terms and export options; nothing is uploaded without permission |
| Raw WebGL (no library) | One full-screen shader, no scene graph, in a project that must not add three | Models, lights, camera rigs | You write context-loss handling, resize, DPR and state yourself |
| WebGPU (`three/webgpu`, TSL from `three/tsl`) | A measured need (compute, very high instance counts) and a team that accepts a second code path | As a default; when the WebGL path would not be maintained | `WebGPURenderer` falls back to its own WebGL 2 backend when no adapter exists, but it runs node materials only: GLSL `ShaderMaterial`, `onBeforeCompile` and the three-kit's WebGL components do not carry over. Verify the installed API before writing code |

Platform facts for the installed three.js (0.187): `WebGLRenderer` requires WebGL 2 (WebGL 1 support was removed in
r163), so "has WebGL" must mean `detectCapabilities().webgl2` for three-based scenes.

### 2.3 Add-ons are separate decisions

| Add-on | Justified when | Otherwise |
|---|---|---|
| Continuous render loop | Something moves every frame without input (simulation, time-driven shader, playing clip) | Render on demand; `invalidate()` on change |
| Physics | Unscripted collisions or constraints are what the user came for | Damped springs, easing, path following |
| Postprocessing | Art direction names an effect materials cannot produce and the quality profile allows it | Tone mapping and good lighting |
| Shadow maps | The subject's contact with the ground must move with it | Baked or blob contact shadow (`LightingRig shadow="blob"`) |
| HDRI environment file | A specific real location must be reflected | Generated environment (`LightingRig`, or Drei `Environment` with `Lightformer` children): no download |
| Transmission/refraction materials | Glass or liquid is the product | Roughness, clearcoat, opacity; each transmissive mesh adds a render pass |

### 2.4 React versus non-React

| Project | Scene bootstrap | Controls and rigs | Motion sync |
|---|---|---|---|
| React (Next, Vite, Remix…) | `StudioCanvas` | three-kit components (`OrbitInspect`, `CameraRig`, `PartController`…) | `useFrame`, Motion Lab, GSAP if installed |
| Anything else | `createVanillaScene` + `detectCapabilities()` + a DOM fallback | three's own add-ons (`three/addons/controls/OrbitControls.js`) | `scene.invalidate()`, WAAPI, GSAP or Motion's `animate()` |

### 2.5 Reconciling with `studio3.design.json`

`threeD.technology.recommendation` is one of `CSS 3D`, `Three.js`, `React Three Fiber`, `Spline embed`,
`Static renders`, chosen from keywords in the brief. It cannot see the code. Keep it when the repository agrees;
overrule it when it does not (for example "React Three Fiber" recommended but the project is Vue) and record why in
the report. Its `qualityProfiles` (`desktop`/`mobile`/`lowPower`) map to the three-kit levels `high`/`medium`/`low`
by hand (studio-3d `performance.md`).

## 3. Data-visualisation technology

| Renderer | Choose when | Limits |
|---|---|---|
| SVG | Up to low thousands of marks; crisp text and axes; per-mark focus, tooltips and ARIA; CSS styling and transitions | DOM cost grows with mark count; avoid animating thousands of nodes |
| Canvas 2D | Tens of thousands of marks, dense scatter/heatmaps, streaming series | No per-mark DOM: build a parallel accessible table/summary and your own hit testing; handle `devicePixelRatio` |
| WebGL (three or a dedicated layer) | Hundreds of thousands of points, 3D/spatial data, GPU-side transitions | All Canvas obligations plus context loss, fallbacks and asset budgets |

Rules:

- **D3 for maths, the framework for DOM.** Use `d3-scale`, `d3-shape`, `d3-array`, `d3-interpolate`, layouts and
  formatters to compute; let React/Vue/Svelte render. Use `d3-selection`/`d3-transition` only in non-framework code
  or inside one ref-owned subtree the framework never renders into — never both on the same nodes.
- Mix renderers by layer: Canvas or WebGL for marks, SVG or HTML for axes, labels and focusable targets.
- Whatever renders the marks, the data is also reachable as text (table, summary or list).
- Start from the count you measured in the data, not the count in the mock. 3D charts need studio-data's criteria
  first; depth that encodes nothing is decoration.

## 4. Explain your choice

Fill this in and include it in your report whenever you add or select an animation, 3D or chart technology.

```
Technology decision
- Need: <what the user must see or do, in one sentence>
- Stack found: <framework, installed animation/3D/chart libraries, from review inspect>
- Design file: <threeD.technology.recommendation / motion.profile, kept or overruled because …, or "none">
- Chosen: <technology + packages added, or "nothing added">
- Why this rung/option: <the criterion from the tables that it meets>
- Rejected: <lighter option> because <the specific thing it cannot do>; <heavier option> because <cost not needed>
- Add-ons (3D only): loop <demand|always> because …; physics <no|yes> because …; postprocessing <no|yes> because …
- WebGPU (3D only): <not used | behind detectWebGPU() with WebGL path …>
- Fallback: <what users get without JS / without WebGL / with reduced motion>
- Network: <files fetched at runtime and from which origin; "own origin only">
- Licence: <licence of each added package, as read from its package.json>
- Cost check: <what was measured (bundle output, review run) or "not measured">
```
