# Accessibility — a scene everyone can use

A `<canvas>` is a picture to assistive technology. Treat the scene as an enhancement over a complete DOM
experience: every fact and every action exists without it, and the scene itself is named, described, operable by
keyboard and pausable. The shared `accessibility.md` §3 is the summary; this file is the implementation.

## 1. Success criteria that apply to 3D (WCAG 2.2)

| Criterion | Level | What it means for a scene |
|---|---|---|
| 1.1.1 Non-text Content | A | The canvas has a name; informative scenes have a text alternative; the fallback image has alt text |
| 1.3.1 Info and Relationships | A | Parts, options and data shown in the scene also exist as structured DOM (lists, tables, fieldsets) |
| 1.4.1 Use of Color | A | Selection, state and categories are not shown by colour alone |
| 1.4.3 Contrast (Minimum) | AA | DOM text over the scene keeps 4.5:1 at the worst point: use a solid or scrim surface |
| 1.4.11 Non-text Contrast | AA | Hotspot markers, focus rings and control boundaries reach 3:1 against what is behind them |
| 1.4.13 Content on Hover or Focus | AA | Hover tooltips over parts are dismissible, hoverable and persistent, and reachable without hover |
| 2.1.1 Keyboard / 2.1.2 No Keyboard Trap | A | Everything works by keyboard; Tab always leaves the canvas |
| 2.1.4 Character Key Shortcuts | A | Single-key camera shortcuts only act while the canvas has focus (`OrbitInspect` does this) |
| 2.2.2 Pause, Stop, Hide | A | Auto-rotate, ambient motion, looping clips and particle fields longer than 5 s have a pause control |
| 2.3.1 Three Flashes or Below Threshold | A | No strobing shaders, glitch flashes or rapid cuts |
| 2.3.3 Animation from Interactions | AAA | Maquettekit policy treats it as required: reduced motion turns interaction-triggered motion into cuts |
| 2.4.3 Focus Order / 2.4.7 Focus Visible | A / AA | Canvas, then its controls, in reading order; a visible ring on the focused canvas |
| 2.4.11 Focus Not Obscured (Minimum) | AA | Overlays and toolbars on the canvas never cover the focused control |
| 2.5.1 Pointer Gestures | A | Pinch and two-finger rotate have single-pointer alternatives (buttons) |
| 2.5.2 Pointer Cancellation | A | Picking happens on release, and moving off cancels |
| 2.5.7 Dragging Movements | AA | Orbit, drag-to-move and sliders have click or keyboard alternatives |
| 2.5.8 Target Size (Minimum) | AA | Markers and controls at least 24 × 24 px (44 px for primary touch controls) |
| 4.1.2 Name, Role, Value | A | DOM controls that mirror the scene expose state (`aria-pressed`, `aria-valuetext`) |
| 4.1.3 Status Messages | AA | Selection, loading results and errors announced through `role="status"` / `role="alert"` |

Never claim conformance from these checks; report what was checked and how.

## 2. Name, role and description

- `StudioCanvas label` (required) names the scene; `description` becomes visually hidden text linked with
  `aria-describedby`. Describe what is visible and its current state, and update it when the state changes (the
  gallery viewer's description includes colourway, finish and lighting).
- Role: the kit puts `role="img"` on the R3F wrapper. For an interactive viewer with a focusable canvas
  (`OrbitInspect keyboard`), pass `role="group"`: an image's children are presentational, which hides the
  focusable canvas from some assistive technology.
- `OrbitInspect` gives the `<canvas>` `tabindex="0"`, `role="application"` and `aria-keyshortcuts`. Give the
  canvas a visible focus ring; the R3F wrapper clips overflow, so draw it inside:

```css
[data-maquettekit-canvas] canvas:focus-visible { outline: 2px solid var(--mk-focus, #2748d6); outline-offset: -2px; }
```

## 3. Instructions

Visible text next to the viewer, not only in an `aria-label`: what can be done and how, for pointer, touch and
keyboard ("Drag to orbit, pinch to zoom. With the view focused: arrow keys rotate, + and − zoom, 0 resets.").
Mention that wheel zoom needs focus. Keep instructions available after the first interaction.

## 4. Keyboard and DOM alternatives

| Scene interaction | DOM or keyboard equivalent |
|---|---|
| Orbit, zoom, pan | Arrow keys / `+` `−` / Shift+arrows on the focused canvas; buttons calling `OrbitInspect`'s handle |
| Presets and focus | Buttons or a radio group calling `CameraRig.goTo` |
| Pick a part | A list of parts as buttons (`aria-pressed`), mirrored selection |
| Hotspots | `HotspotList` (buttons, 44 px rows) beside `HotspotLayer` markers |
| Explode | Range input plus Assemble/Explode buttons |
| Play a clip | Play/Pause (`aria-pressed`), scrub range with `aria-valuetext` in seconds |
| Drag or throw a body | Buttons that push, drop or reset; keys on a focused control |
| Change material or colour | Radio groups with text names (the swatch is decoration) |

Controls live outside the canvas or in an overlay that never covers the focused element. A toolbar of plain buttons
is a labelled `role="group"`; use `role="toolbar"` only with the arrow-key model.

## 5. Motion and pause

- Reduced motion follows `animation.md` §8: decoration removed, transitions cut, content motion behind a control.
- Read it from `useStudioMotion().reduced` so the in-app toggle (`StudioMotionProvider reduced`) also works.
- Pausing: freeze rendering with `StudioCanvas paused`, stop clips with `AnimationPlayer.pause()`, set
  `autoRotate={false}`, pause physics. A pause control is a visible button with a state, not a keyboard secret.
- Offer "Turn off 3D" (`StudioCanvas disabled`) where the scene is large or moves: it shows the fallback, which
  must be complete.

## 6. Fallback content

`StudioCanvas fallback` renders inside `[data-maquettekit-fallback]` (a labelled group, plus a `role="status"`
reason and a retry for errors and context loss). Use `SceneFallback` for the standard block:

| Prop | Content |
|---|---|
| `title` | What the scene shows ("Pulse speaker") |
| `image`, `imageAlt` | The poster (manifest `fallbackImage`); alt text describes it, `''` if purely decorative |
| `description` | One or two sentences of what the scene would show |
| `facts` | The same facts as the scene: dimensions, selected options, data values |
| `reason` | Why the fallback shows (for model-load errors; `role="alert"`) |
| `children` | Actions, such as "Try again" |
| `layout` | `stack` (text under the image) or `cover` (image fills, text panel overlays) |

The fallback is also what users see when the model fails, the context is lost or the user turned 3D off. The
Visual Director's `3d-fallback` check and the repository's e2e test (`falls back gracefully without WebGL` in
`tests/e2e/demos.spec.ts`) look for visible `[data-maquettekit-fallback]` content and no uncaught errors.

## 7. Information and actions outside the canvas

- Prices, specifications, option names, data values, annotations, calls to action: DOM, always.
- A configurator's selection summary is DOM text updated in the same frame as the choice, announced once per change
  through `role="status"`.
- Essential tasks (buy, choose a variant, compare, read the data, navigate) complete with 3D disabled. Test it:
  `StudioCanvas disabled`, then do the task.
- Spatial or network data ships an equivalent table or list (studio-data).

## 8. Testing

1. Keyboard only: reach the canvas, operate it with keys, Tab out; operate every DOM equivalent.
2. Screen reader where available: the label and description are read; selection and errors are announced once.
3. Reduced motion: OS emulation and the in-app toggle; nothing autoplays; transitions cut.
4. 3D off and no WebGL: `disabled`, then `maquettekit review run` (its `3d-fallback` pass uses a GPU-less browser).
5. 320 px wide and 200 % zoom: overlays and controls reflow; nothing essential is clipped by the canvas.
6. axe runs on the page (`maquettekit review run`, or the e2e axe step in the repository); it cannot judge whether the
   description is equivalent: you judge that and say so.

## 9. Checklist

- [ ] Label, description (kept current) and the right role; visible focus ring on a focusable canvas.
- [ ] Visible instructions; every interaction in §4 has its equivalent.
- [ ] Pause for anything moving longer than 5 s; reduced motion honoured; "Turn off 3D" where appropriate.
- [ ] Fallback has the same facts and actions; essential tasks work with 3D disabled.
- [ ] Status messages for selection, loading and errors; colour never the only cue.
