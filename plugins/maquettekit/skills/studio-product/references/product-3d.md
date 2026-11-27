# Product 3D — when a product page deserves real-time 3D

> **Quick card** — the must-dos from this file; read on for the reasons and the detail.
>
> - Meet every §1 "must" row; without a "value" row, use real-time 3D only if explicitly asked.
> - Never fabricate a stand-in model; use the user's prices or label figures `Sample pricing`.
> - Pick the lightest technique in §2 that works; under about 30 combinations, render images.
> - Keep options, price and controls in DOM, never in the canvas; put the configuration in the URL.
> - Show the poster first at reserved aspect ratio; lazy-load one canvas per page view.
> - Never trap scroll in the canvas; add named rotate, zoom and reset buttons, at least 44 px on touch.
> - Drop autorotate under reduced motion; on error or context loss, restore the poster and keep option controls working.
> - Report diagnostics as lab values; never claim a headless browser's frame rate.

You decide **whether** 3D belongs on the page and define **what it must do**. `studio-3d` builds the scene;
`studio-asset-optimizer` prepares the model. This file is the decision and the handoff, not the implementation.

## 1. The decision

Real-time 3D is expensive: a large library, model and texture downloads, GPU memory, battery, a fallback to
build and a second accessibility path. It earns its place only when it gives the buyer something images cannot.

Score the request. Real-time 3D needs **every** "must" and at least one "value" row.

| | Criterion | How to check |
|---|---|---|
| Must | The product is a physical or spatial object (or a spatial arrangement) | Software UI, services and abstractions fail here |
| Must | A usable model exists or will be supplied (glTF/GLB, or a source format that can be converted) | Ask. Never fabricate a stand-in model and present it as the product |
| Must | A static fallback and the same information in DOM will ship | Poster image + specification list + variant controls |
| Must | The project's performance budget survives it | Lazy, one canvas, off the critical path (shared `performance.md` §6) |
| Value | Buyers need viewpoints a handful of images cannot cover | Fit, ports, underside, internal layout |
| Value | The configuration space is too large to pre-render | Count: colours × materials × options. Under about 30 combinations, render images |
| Value | Understanding depends on parts and assembly | Exploded view, cutaway, mechanism |
| Value | Scale or placement matters and an AR hand-off is wanted | Furniture, appliances, fixtures |
| Value | Material, finish or light response is what sells it | Glazes, metals, fabrics, glass: photos flatten how they catch moving light. Needs PBR materials, not a scan with baked lighting; offer lighting presets (daylight, room, lit at night) |
| Value | Handling the object is part of its appeal | Turning it over, opening a lid, pressing the controls |

If the user explicitly asks for 3D, build it, but still supply the "must" rows and say which "value" row applies
(or that none does).

## 2. Pattern → lightest technique that works

| Need | Lightweight option (prefer) | Real-time 3D (when the option fails) |
|---|---|---|
| "See it from all sides" | **Image sequence**: 24–72 pre-rendered frames scrubbed by drag, buttons and arrow keys | Free orbit needed on two axes, or zoom into detail beyond the render resolution |
| A few colours/finishes | **Pre-rendered image per variant**, cross-faded | Options multiply past what can be rendered and stored |
| Depth and presence in a hero | **CSS 3D**: layered planes with small parallax (`layered-depth-stack`, `tilt-parallax-card`, `flip-card-3d`, `css-cube-carousel`) | The object itself must rotate under light |
| A scripted reveal or disassembly | **Video** (muted, `playsinline`, poster, pause control), or a scroll-scrubbed image sequence | The user must stop anywhere and inspect, or pick parts |
| "Show what's inside" | **Layered SVG/PNG** exploded diagram with labelled parts | Parts must be selectable from any angle (`exploded-view`) |
| Annotated features | **Image with DOM hotspots** positioned over it | Hotspots must track a rotating object (`hotspot-annotations`) |
| Premium still presentation | **One excellent static render**, large, with careful crop | Never just for "premium feel" |

Costs to weigh for the lightweight options:

- Image sequences: total bytes grow with frame count × resolution. Load the first frame eagerly as the poster,
  the rest on intent (pointer enter, focus, or approach to the viewport); decode ahead of the scrub position.
- Video: cannot be paused at an exact meaningful angle cheaply, and scrubbing by scroll depends on keyframe
  spacing; test on the target devices before promising smooth scrubbing.
- CSS 3D: flat planes only. Good for cards, devices shown face-on and layered UI; it cannot show a curved
  object turning.

## 3. Product 3D patterns

| Pattern | What the user does | Requirements you hand over | Library recipes to confirm |
|---|---|---|---|
| **Viewer** | Orbits, zooms, resets | Orbit limits (no going under the floor unless useful), zoom range, initial camera, autorotate off by default or pausable, render on demand | `orbit-inspect-controls`, `camera-preset-rig` |
| **Configurator** | Chooses options; model, price and summary update | Option model as data (see §4), DOM option controls, price in DOM, shareable URL state, per-option camera preset | `camera-preset-rig`, `orbit-inspect-controls` |
| **360 spin** | Rotates on one axis | Usually an image sequence; real-time only per §2 | — |
| **Exploded view** | Separates and reassembles; selects parts | Part list with names and descriptions in DOM, a slider and buttons for the explode amount, focus per part | `exploded-view`, `hotspot-annotations` |
| **Guided showcase** | Scrolls or steps through features with camera moves | 3–6 named camera stops, each with DOM copy; steps reachable by buttons; lead with `studio-cinematic` if the page is a narrative | `scroll-camera-dolly`, `camera-preset-rig` |

Run `maquettekit catalog search <term> --specialty 3d` (or `--category spatial`, `--category camera`) to confirm
ids before citing them.

## 4. Configurator: the page owns the state

The scene is a view of the configuration, never its source of truth. Keep state in the page (URL-serialisable),
render controls and price in DOM, and pass the configuration into the canvas as props.

```ts
type OptionId = string;

interface ConfigOption {
  id: OptionId;
  label: string;            // visible and accessible name
  priceDelta: number;       // minor units of the currency; real prices from the user, never invented
  swatch?: string;          // CSS colour for the control
  cameraPreset?: string;    // named stop the scene moves to when this group gains focus
  unavailableWith?: OptionId[];
}

interface ConfigGroup { id: string; label: string; options: ConfigOption[]; default: OptionId }

type Selection = Record<string /* group id */, OptionId>;

const total = (base: number, groups: ConfigGroup[], sel: Selection): number =>
  groups.reduce((sum, g) => sum + (g.options.find((o) => o.id === sel[g.id])?.priceDelta ?? 0), base);
```

Page rules:

- Each group is a `fieldset` of radio inputs (or a listbox), fully keyboard-operable, with visible labels.
  Colour swatches carry the colour name as text.
- Selecting an option updates the price and summary in the same frame; the scene may animate afterwards.
- Incompatible options are explained in text, not silently disabled.
- The summary (selected options, total, primary action) is DOM, and announced through one `role="status"`
  line per change ("Frame: graphite. Total £1,240").
- The configuration is in the URL so it can be shared, restored and rendered on the server as a poster.
- Prices, availability and lead times come from the user's data. If none is supplied, label the figures
  `Sample pricing` in the UI.

## 5. Handoff contract to studio-3d

Give `studio-3d` this, filled in. Anything left blank becomes an assumption they must report.

| Field | You provide |
|---|---|
| Purpose | Which pattern from §3 and the "value" criterion that justifies it |
| Asset | Path to the model, its licence/source, whether it has been through `maquettekit assets` (delegate `inspect`, `validate`, `optimize` to `studio-asset-optimizer`) |
| Container | The DOM element and its sizing rules (aspect ratio, min/max height, behaviour at 320 px) |
| Props in | The configuration object, active camera preset, explode amount, paused flag |
| Events out | `ready`, `error`, part/hotspot selected, camera preset reached |
| Camera | Named presets with intent ("three-quarter front", "ports"), orbit and zoom limits |
| Look | Tokens from `maquettekit.design.json` for background, accent and focus; lighting mood in one sentence |
| Profile | Experience profile and what is allowed (autorotate, ambient motion) |
| Fallback | The poster image and the DOM content that stands in when WebGL is unavailable, lost, or reduced motion is on |
| Accessibility | Canvas label and description text; the DOM controls that mirror every scene interaction |
| Budget | Target devices; the page's weight budget for the 3D chunk and assets; "render on demand" expectation |
| Loading | Trigger (in view, on intent, on click), poster-first, progress indication |

What you require back from `studio-3d`:

- A component that renders inside the Maquettekit canvas wrapper (label, fallback, demand-driven frame loop,
  capped pixel ratio, disposal on unmount).
- No essential text, price or control inside the canvas.
- Measured diagnostics from the review run (draw calls, triangles, textures, context loss), reported with the
  caveat that headless software rendering is not representative of real devices.

## 6. Page integration rules

- **Poster first.** The server-rendered page shows the product image at the canvas position with reserved
  aspect ratio. The canvas replaces it when ready, with a cross-fade no longer than the `base` token. No
  layout shift.
- **One canvas** per page view. A gallery of products uses images; the viewer opens for one product at a time.
- **Lazy.** The 3D code is a dynamically imported chunk, requested when the container nears the viewport or
  on intent. On slow connections or data-saver, wait for an explicit "View in 3D" press.
- **Scroll safety.** The canvas must not swallow page scroll: vertical touch gestures scroll the page unless
  the user has engaged the viewer; wheel zoom only after interaction or with a modifier. Provide zoom buttons.
- **Controls outside the canvas**: rotate left/right, zoom in/out, reset, play/pause autorotate, fullscreen.
  Each at least 44 px on touch, with names.
- **Reduced motion**: no autorotate, camera changes cut or cross-fade, exploded view jumps between states.
- **Failure**: on error or context loss, restore the poster and keep every option control working.

## 7. Do / do not

| Do | Do not |
|---|---|
| Ask for the real model and real prices | Generate a primitive-shape stand-in and call it the product |
| Start with the cheapest technique in §2 | Reach for WebGL because the brief says "premium" |
| Keep price, options and actions in DOM | Draw buttons or prices inside the canvas |
| Let the page scroll past the viewer freely | Trap wheel and touch in the canvas |
| Show a poster and load on intent | Block first paint on a model download |
| Offer buttons for rotate and zoom | Depend on drag and pinch alone (WCAG 2.5.7, 2.5.1) |
| Report diagnostics as lab values | Claim a frame rate measured in a headless browser |

## 8. Checklist

- [ ] Every "must" in §1 holds and the "value" row is named in the report.
- [ ] The lightest technique in §2 that satisfies the need was chosen; the reason for rejecting lighter ones
      is stated.
- [ ] Handoff table in §5 completed; blanks listed as assumptions.
- [ ] Poster, DOM information, keyboard controls and reduced-motion behaviour verified with the canvas disabled.
- [ ] One canvas, lazy chunk, no layout shift on hand-over from poster.
