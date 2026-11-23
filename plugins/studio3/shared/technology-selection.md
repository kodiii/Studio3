# Technology selection

One decision document for every specialty. Pick the lightest technology that fully delivers the effect, state the
reason, and record what you rejected. "Lightest" means: fewest shipped bytes, fewest concepts for the next
maintainer, least main-thread work, and no new dependency when an installed one already does the job.

Before choosing, run `studio3 review inspect --dir .` and read the project's `package.json`. The stack you find
outranks every preference below.

## 0. Rules that override the tables

1. **Use what is installed.** If the project already ships GSAP, do not add Motion for one hover (and vice versa).
2. **Never force React tooling onto a non-React project.** No React Three Fiber, Drei, Rapier bindings or Motion's
   React API in Vue, Svelte, Astro islands without React, or plain HTML. Use three.js directly
   (`createVanillaScene` in the three-kit) and CSS/WAAPI/GSAP for DOM motion.
3. **One animation owner per element.** Never let two libraries (or a library and a CSS transition) write the same
   property of the same element. Split the element or pick one.
4. **3D does not imply physics, postprocessing or a continuous loop.** Each of those is a separate decision with
   its own justification (section 2.3).
5. **WebGPU only behind detection, with a WebGL path that ships and is tested.** The API being present is not
   enough; an adapter must be acquired (`detectWebGPU()` in the three-kit). Headless CI Chromium normally has
   software WebGL and no WebGPU, so the WebGL path is the one your automated checks exercise.
6. **External services need permission.** Never upload project assets, models, screenshots or copy to a hosted
   tool (Spline, model converters, CDNs, AI services) without the user's explicit agreement.
7. **Check licences before adding.** three, React Three Fiber, Drei, React Three Rapier and Motion are MIT; D3 is
   ISC; GSAP is free of charge under GreenSock's standard "no charge" licence, which is not an open-source licence
   — read the terms for the project's use before adding it. For anything else, read the `license` field of the
   installed package.

## 1. Animation technology ladder

Climb only when the rung below cannot do the job. Stop at the first rung that can.

| Rung | Technology | Choose when | Stop and climb when | Cost |
|---|---|---|---|---|
| 1 | CSS transitions / keyframes, `@starting-style`, scroll-driven animations (`animation-timeline`) | State is expressed by a class, attribute or pseudo-class; hover/focus/press; one-shot reveals; scroll-linked progress where supported | You need runtime-computed keyframes, sequencing across elements with interruption, or values from layout measurement | No JS. Scroll-driven animations need `@supports` and a static fallback |
| 2 | Web Animations API, Motion Lab `createSequence` / `flip` / `viewTransition` | Multi-element choreography, stagger, labels, scrubbing (`seek`), FLIP layout moves, route/state transitions | You need spring physics driven by gestures, React exit animations, or automatic layout animation | No dependency. You own cleanup (`cancel()`) |
| 3 | Motion (`motion/react`) | React project; gesture-driven springs, drag, `layout`/`layoutId` shared layout, `AnimatePresence` exits, velocity hand-off | You need a scrubbed multi-track scroll timeline, pinning choreography, or it is not a React project | One dependency; React only for the component API |
| 4 | GSAP (+ ScrollTrigger, `@gsap/react`) | Long scrubbed scroll timelines with many tracks, snap, complex nested sequencing, SVG morph/draw at scale, framework-free projects that need a timeline | The subject is a real 3D object or a shader | One dependency plus plugins; licence to check; ScrollTrigger needs refresh discipline |
| 5 | three.js / React Three Fiber | Genuine 3D: meshes, materials, lighting, camera, shaders, GPU particles | — | Largest cost: renderer, assets, GPU memory, fallbacks, accessibility work |

Decision questions, in order:

1. Can a class toggle plus a CSS transition express it? Use CSS.
2. Is it scroll-linked and decorative? Use CSS scroll-driven animations inside `@supports (animation-timeline: view())`, with the final state as the default.
3. Does it need sequencing, stagger or scrubbing across elements, with no gestures? Use `createSequence`.
4. Does an element change layout position or size between states? Use `flip()`; in React with exits or drag, use Motion `layout`.
5. Is it a pinned, scrubbed, multi-track scroll scene? Use GSAP ScrollTrigger (pin with CSS `position: sticky` where you can).
6. Is the content a three-dimensional object, or per-pixel generative imagery? Go to section 2.

Bundle reasoning without numbers: do not quote library sizes from memory. If size matters to the decision, measure
it in the project (`npm run build` output, or the bundler's analyser) and quote what you measured.

## 2. 3D technology selection

### 2.1 First decide whether 3D is justified

Real-time 3D is justified when the user gains something a still, a video or CSS cannot give: free inspection of
an object, a configuration space too large to pre-render, spatial data that reads better with depth, or a
generative surface that must react. If none applies, choose a static render, an image sequence, video or CSS 3D
and say so.

### 2.2 Options

| Option | Choose when | Do not choose when | Costs and obligations |
|---|---|---|---|
| Static 3D renders (stills, image sequence, short muted video) | Decorative depth; tight budgets; the fallback tier of every real-time scene | The user must control the view or configuration freely | Art pipeline only; needs alt text; video needs pause control |
| Native CSS 3D (`perspective`, `transform-style: preserve-3d`) | Planar things in depth: cards, flips, cubes, layered parallax, tilt | Meshes, lighting, materials, hundreds of elements | No dependency; DOM stays accessible; watch for blurry text on rotated layers and large composited areas |
| three.js (vanilla) | Non-React project, or a self-contained scene embedded in any page | A React app where scene state follows component state | You own the lifecycle: resize, loop, pause, disposal (`createVanillaScene` gives you these) |
| React Three Fiber | React project; scene state driven by props/state; composition with the app | Non-React projects | Reconciler cost is small, but per-frame React state is a bug; use refs and `useFrame` |
| Drei | You need a specific helper (text, bounds, instancing helpers, HTML overlays) | You only want one trivial helper you can write in ten lines; or its helper fetches remote assets you cannot ship (HDRI presets) | Import individual components; check each helper's network and loop behaviour |
| React Three Rapier | Collisions, stacking, joints or constraints are the content | Motion that springs, eases or follows a path — that is maths, not physics | WASM download and init; fixed timestep; body caps; lazy-load |
| GSAP with three | A scroll- or time-driven timeline must drive camera, uniforms or object transforms in sync with DOM motion | Simple damping toward a target (write it in the frame callback) | Tween plain objects; call `invalidate()` on update; kill on unmount |
| Spline integration | The scene is authored and maintained by a designer in Spline and that is the source of truth | You need control over loading, quality tiers, disposal, accessibility, or offline/self-hosted delivery | External runtime; scenes are usually hosted by the service; read the service's current licence/terms and export options; confirm hosting, privacy and permission before anything is uploaded |
| Raw WebGL (no library) | A single full-screen shader with no scene graph, in a project that must not add three | Anything with models, lights or a camera rig | You write context loss handling, resize and state management yourself |
| WebGPU (`three/webgpu`, TSL) | A measured need (compute, very high instance counts) and a team that accepts two code paths | As a default; when the WebGL path would not be maintained | Detection, fallback, two sets of tests; verify the installed three version's API before writing code |

### 2.3 Add-ons are separate decisions

| Add-on | Justified when | Otherwise |
|---|---|---|
| Continuous render loop | Something moves every frame without input (simulation, time-driven shader) | Render on demand; invalidate on change |
| Physics | Unscripted collisions or constraints are what the user came for | Damped springs, easing, path following |
| Postprocessing | The art direction names an effect the materials cannot produce, and the quality profile allows it | Tone mapping and good lighting |
| Shadow maps | The subject's contact with the ground must move with it | Baked or blob contact shadow |
| HDRI environment | A specific real location matters | Generated environment (`LightingRig`) — no remote file |

### 2.4 React versus non-React summary

| Project | Scene bootstrap | Controls and rigs | Motion sync |
|---|---|---|---|
| React (Next, Vite, Remix…) | `StudioCanvas` | three-kit components | `useFrame`, Motion Lab, GSAP if installed |
| Anything else | `createVanillaScene` | three's own controls from `three/examples/jsm` | `scene.invalidate()`, GSAP or WAAPI |

## 3. Data-visualisation technology

| Renderer | Choose when | Limits |
|---|---|---|
| SVG | Up to low thousands of marks; crisp text and axes; per-mark focus, tooltips and ARIA; CSS styling and transitions | DOM cost grows with mark count; avoid animating thousands of nodes |
| Canvas 2D | Tens of thousands of marks, dense scatter/heatmaps, streaming series | No per-mark DOM: build a parallel accessible table/summary and your own hit testing; handle `devicePixelRatio` |
| WebGL (three or a dedicated layer) | Hundreds of thousands of points, 3D/spatial data, GPU-side transitions | All Canvas obligations plus context loss, fallbacks and asset budgets |

Rules:

- **D3 for maths, the framework for DOM.** Use `d3-scale`, `d3-shape`, `d3-array`, `d3-interpolate`, layouts and
  formatters to compute; let React/Vue/Svelte render. Use `d3-selection` and `d3-transition` only in non-framework
  code or inside one ref-owned subtree where the framework never renders children — never both on the same nodes.
- Mix renderers by layer: Canvas or WebGL for marks, SVG or HTML for axes, labels and focusable targets.
- Whatever renders the marks, the data must also be reachable as text (table, summary, or list).
- Start from the count you measured in the data, not the count in the mock.

## 4. Explain your choice

Fill this in and include it in your report whenever you add or select an animation, 3D or chart technology.

```
Technology decision
- Need: <what the user must see or do, in one sentence>
- Stack found: <framework, installed animation/3D/chart libraries>
- Chosen: <technology + packages added, or "nothing added">
- Why this rung/option: <the criterion from the table that it meets>
- Rejected: <lighter option> because <the specific thing it cannot do>; <heavier option> because <cost not needed>
- Add-ons (3D only): loop <demand|always> because …; physics <no|yes> because …; postprocessing <no|yes> because …
- Fallback: <what users get without JS / without WebGL / with reduced motion>
- Licence: <licence of each added package, as read from its package.json>
- Cost check: <what was measured (bundle output, review run) or "not measured">
```
