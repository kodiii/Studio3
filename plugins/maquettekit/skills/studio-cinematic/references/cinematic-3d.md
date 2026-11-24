# Cinematic 3D — when a story deserves a real-time scene

You decide **whether** a beat needs real-time 3D and **what the scene must do** in the story. `studio-3d`
builds the scene; `studio-asset-optimizer` prepares any model; `studio-motion` times DOM and camera together.
This file is the decision, the choreography and the handoff, not the renderer.

## 1. The decision

A scene costs a large library, assets, GPU memory, battery, a fallback per beat and a second accessibility
path. It earns its place only when it carries a beat that flat media cannot.

Real-time 3D needs **every** "must" and at least one "value" row.

| | Criterion | How to check |
|---|---|---|
| Must | The beat it serves is in the beat sheet, with what the scene shows that a still or video cannot | Point to the row in the beat sheet |
| Must | An asset exists, or the scene is procedural by design (abstract geometry is legitimate when it is the art, never as a stand-in for a real product) | Ask for the model; never fabricate one and present it as the subject |
| Must | Each beat the scene carries has a poster frame and its copy in DOM | Posters double as the fallback and first paint |
| Must | The budget survives: one canvas, lazy, poster first, render on demand (shared `performance.md` §6) | §6 below |
| Value | The camera must move through a space, and the path is the story | A journey, a building, a landscape |
| Value | An object transforms under the reader's control: assembly, material, state | Disassembly, a mechanism, a before/after in form |
| Value | Light or material response is the point | Finishes, glass, fabric under moving light |
| Value | One persistent scene carries several beats, so continuity would break with cuts | Chapters as camera stops in one world |

Not reasons: "premium", "make it pop", a decorative particle field, a rotating logo.

## 2. Lightest technique that works

| Need | Lightweight option (prefer) | Real-time 3D when the option fails |
|---|---|---|
| Camera moves through a space | Pre-rendered image sequence scrubbed on a 2D canvas; or video scrubbed by scroll | The reader must look around, or the path depends on content |
| Object turns on scroll | Image sequence, 24–72 frames | Lighting must respond, materials change, or the object is interactive |
| Depth in a hero | CSS 3D planes and parallax (`layered-depth-stack`, `parallax-depth-layers`) | The object itself must turn under light |
| Animated background | CSS gradients, `grain-gradient-mesh` | Generative motion that reacts to scroll or pointer is the content (`shader-aurora-plane`) |
| Particles | SVG or 2D canvas at small counts (`dot-grid-pointer-field`) | Thousands of points with depth (`particle-field-gpu`) |
| 3D type | DOM text under CSS 3D transforms (stays real text) | Extruded or lit type that lives inside a scene |
| Disassembly | Layered SVG exploded diagram, scrubbed | Parts must be selectable from any angle (`exploded-view`) |

**Scroll-scrubbed image sequences.** The first frame is an `<img>` with dimensions (the LCP-safe poster).
Load the rest on approach, decode ahead of the scrub position (`img.decode()` or `createImageBitmap`), draw
the nearest frame in one rAF callback, size frames for the capped DPR, and release bitmaps (`bitmap.close()`)
when the section is far away. Total weight is frames × bytes per frame: budget it. Reduced motion shows the
poster, or three key frames behind step buttons. Video scrubbing depends on keyframe spacing; test on target
devices before promising smoothness.

## 3. Scroll-controlled scenes: the contract

The page owns progress; the scene is a pure function of it.

- **Source.** ScrollTrigger `onUpdate(self)` or `useScrollProgress` writes progress (0–1 for the story, or a
  chapter index plus local progress) into a ref. No scroll listeners inside the scene.
- **Frames.** The writer calls R3F's `invalidate()` when progress changes. The scene damps toward the target
  in `useFrame` and keeps requesting frames only until it settles (`scroll-camera-dolly` works this way).
- **Copy.** Captions and chapter text are DOM, mapped to progress ranges; the canvas carries no essential text.
- **Reduced motion.** No scroll-driven travel: step buttons cut between fixed viewpoints, one rendered frame
  per step, captions in normal flow.

```tsx
import { useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CatmullRomCurve3, MathUtils, Vector3 } from 'three';

const path = new CatmullRomCurve3([new Vector3(0, 1.6, 9), new Vector3(1.5, 1.4, 3), new Vector3(0, 1.2, -4)]);
const look = new Vector3();

export function ScrollCamera({ progress }: { progress: MutableRefObject<number> }) {
  const current = useRef(progress.current);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  useFrame((_, dt) => {
    const target = progress.current;
    current.current = MathUtils.damp(current.current, target, 6, dt);   // frame-rate independent
    const t = current.current;
    path.getPointAt(t, camera.position);
    path.getPointAt(Math.min(1, t + 0.02), look);                        // look slightly ahead
    camera.lookAt(look);
    if (Math.abs(target - t) > 1e-4) invalidate();                        // stop once settled
  });
  return null;
}
```

Chapter map, shared by the DOM captions, the camera and the reduced-motion step buttons:

```ts
const chapters = [
  { id: 'arrival', range: [0, 0.2], stop: 0.0, caption: 'beat-1' },
  { id: 'hall',    range: [0.2, 0.6], stop: 0.45, caption: 'beat-3' },
  { id: 'window',  range: [0.6, 1],   stop: 1.0, caption: 'beat-4' },
] as const;
```

## 4. Camera choreography

| Rule | Why |
|---|---|
| One camera move per beat; rest at chapter boundaries | Captions are read while the camera is still; snap lands on rests |
| Travel along a curve through named stops, looking slightly ahead (or at the subject when orbiting) | Straight lerps between stops read as mechanical |
| Damp position and look target separately; the target leads | Prevents the camera swinging past the subject |
| Keep the horizon level; no roll unless the story needs it | Vestibular comfort |
| No fast field-of-view changes and no dolly-zoom ("vertigo") moves | Known vestibular triggers (shared `accessibility.md` §3) |
| Cap angular velocity; a fast fling must not whip the view | Scroll speed is the reader's, comfort is yours |
| Never pass through geometry; mind the near plane | Clipping breaks the illusion instantly |
| Frame for the layout: leave negative space where DOM copy sits; use different stops or distance for portrait | A phone in portrait needs the camera further back |
| Reversible: scrolling up runs the same path backwards | Scroll belongs to the reader |
| Buttons reach every stop (`camera-preset-rig` pattern) | Keyboard and reduced-motion access to every viewpoint |

Fitting an object of width `w` horizontally: `distance = (w / 2) / (Math.tan(vFov / 2) * aspect)`, with
`vFov` in radians. Recompute on resize, then call `invalidate()`.

## 5. Patterns

| Pattern | Beat it serves | Hand over | Recipes to confirm | Reduced-motion form |
|---|---|---|---|---|
| Fly-through | Journey, Turn | Path stops, progress ranges, captions | `scroll-camera-dolly` | Step buttons, cuts |
| Choreography around an object | Reveal, Proof | Named presets with intent, rest points | `camera-preset-rig` | Cuts between presets |
| Particles | Atmosphere, a transformation where the particles are the subject | Count × `useQuality().density`, pause control | `particle-field-gpu` | One static frame |
| 3D type | Title card | The DOM heading is the accessible copy; the scene's type is decorative | — | DOM type only |
| Spatial transitions | Hand-overs between chapters in one world | One persistent canvas; scene state per chapter | `scroll-camera-dolly`, `camera-preset-rig` | Cut between states |
| Product disassembly in a narrative | Proof | Part list in DOM; explode amount scrubbed; part focus by list | `exploded-view`, `hotspot-annotations` | Two states: assembled, exploded |
| WebGL background | Mood | Contrast with overlaid copy at the worst frame; pause control | `shader-aurora-plane`, `image-ripple-distortion` | Static frame, or a CSS gradient |

3D type notes: text helpers built on troika (drei's `Text`) resolve a font from a public CDN when no `font` is
given, and for glyphs the font lacks. Pass a self-hosted font file and check the network panel. Extruded
`TextGeometry` is heavy; keep it to a word or two.

Run `maquettekit catalog search <term> --specialty cinematic` (or `--category camera`, `--category shaders`) to
confirm ids before citing them; several above are planned and may not exist yet.

## 6. Handoff contract to studio-3d

Give `studio-3d` this table, filled in. Anything blank becomes an assumption they must report.

| Field | You provide |
|---|---|
| Beats | Which beat-sheet rows the scene carries and the "value" criterion from §1 |
| Asset | Model path, licence and source, and whether it went through `maquettekit assets` (delegate `inspect`, `validate`, `optimize`, `variants` to `studio-asset-optimizer`) |
| Container | The sticky frame, its sizes, its layering with DOM copy, behaviour at 390 px |
| Props in | Progress ref or chapter index + local progress, `paused`, `reduced` |
| Events out | `ready`, `error`, first frame rendered, chapter stop reached |
| Camera | Path stops or presets with intent ("over the shoulder at the window"), FOV range, limits |
| Look | Tokens from `maquettekit.design.json`; the colour script per beat; lighting mood in one sentence |
| Motion | Damping constant, rest zones, maximum angular speed |
| Profile | Experience profile and what is allowed: ambient motion, continuous loop, postprocessing |
| Fallback | Poster per beat and the DOM copy shown without WebGL, after context loss or under reduced motion |
| Accessibility | Canvas label and description; DOM step buttons and pause control mirroring every scene interaction |
| Budget | Target devices, chunk weight, draw calls, triangles, texture memory |
| Loading | Trigger (approach, intent), poster first, progress indication |

Budgets are project-specific. The three-kit's default soft budgets are starting points only: low 60 draw
calls / 150k triangles / 32 MB textures; medium 120 / 500k / 96 MB; high 200 / 1.5M / 256 MB. Pass the
project's own numbers to `maquettekit review run --budgets` (see `--help` for the shape).

What you require back: a component inside `StudioCanvas` (label, `fallback`, `frameloop="demand"` unless
something truly animates every frame, DPR from `useQuality()`, disposal on unmount); no essential text or
control inside the canvas; review-run diagnostics (draw calls, triangles, textures, context loss), reported
with the caveat that headless software rendering says nothing about frame rate on real devices.

## 7. Budgets and fallbacks on the page

- **One canvas per view**, persistent across chapters. Move the camera; never mount a canvas per section.
- **Lazy.** The scene is a dynamically imported chunk; `StudioCanvas` mounts its context only as the frame
  nears the viewport (`lazy` is on by default) and pauses when off-screen or the tab is hidden.
- **Poster first.** The poster for the first scene beat is server-rendered at the canvas position with its
  aspect ratio reserved; the canvas replaces it with a cross-fade no longer than the `base` token.
- **Fallback triggers:** no WebGL, context loss, low-power devices, data saver, reduced motion (the scene is
  tier 3: still frame, motion only on request), and a visible "Turn off 3D" control (`StudioCanvas disabled`).
- **Quality.** Particle and instance counts scale with `useQuality().density`; shadows and postprocessing
  only where the profile allows.
- **Continuous loops** (a time-driven shader) get a pause control wired to `StudioCanvas paused`.
- **Scroll safety.** A background canvas has `pointer-events: none`; no canvas captures wheel or touch.
- **Text over WebGL.** DOM text sits above the canvas; contrast is checked at the worst frame; add a scrim.
- **Measure** with `maquettekit review run` (it includes 3D diagnostics); report lab numbers as lab numbers.

## 8. Do / do not

| Do | Do not |
|---|---|
| Earn the scene with a beat and a "value" row | Add WebGL because the brief says "immersive" |
| Keep progress in the page and the scene a pure view of it | Read scroll inside the scene |
| Render on demand and stop when settled | Run a continuous loop for a static frame |
| Keep copy, captions and controls in DOM | Draw essential text inside the canvas |
| Give every camera stop a button | Make scroll the only way to reach a viewpoint |
| Ship a poster per beat | Leave a blank box while three.js downloads |
| Cap angular speed and keep the horizon level | Whip, roll or dolly-zoom the camera |

## 9. Checklist

- [ ] Every "must" in §1 holds; the "value" row is named in the report.
- [ ] The lightest technique in §2 was considered; why it was rejected is stated.
- [ ] Handoff table in §6 completed; blanks listed as assumptions.
- [ ] One persistent canvas, lazy, poster first, demand rendering; pause control for any continuous loop.
- [ ] Reduced motion: no scroll travel, step buttons cut between viewpoints, captions in flow.
- [ ] With WebGL disabled the story is complete: posters, copy and controls.
