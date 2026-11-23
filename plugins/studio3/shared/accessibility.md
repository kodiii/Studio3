# Accessibility — engineering checklist (WCAG 2.2, level AA oriented)

Accessibility is a gate in every Studio³ workflow: no experience profile, visual direction or deadline
overrides it. This is an engineering checklist, not a conformance statement. Success-criterion numbers refer
to WCAG 2.2; levels are given because two cited criteria are not AA (2.3.3 is AAA; several are A). You cannot
claim conformance from automated checks alone, so never write "WCAG compliant" in a report. Write what was
checked and how.

## 1. Checklist by concern

### Structure and semantics
- [ ] One `<h1>`; headings descend without skipping levels to fake size (1.3.1 A, 2.4.6 AA).
- [ ] Landmarks: `header`, `nav`, `main`, `footer`; multiple `nav`s are labelled (1.3.1 A).
- [ ] Native elements first: `<button>` for actions, `<a href>` for navigation, `<dialog>` or a correctly
      managed modal for overlays. A `div` with a click handler is a defect.
- [ ] DOM order matches visual and reading order (1.3.2 A, 2.4.3 A). CSS `order` and absolute positioning must
      not scramble it.
- [ ] Every control has an accessible name that contains its visible label text (4.1.2 A, 2.5.3 A).
- [ ] Page has a `lang`, a descriptive `<title>`, and a skip link to `main` (3.1.1 A, 2.4.2 A, 2.4.1 A).

### Keyboard
- [ ] Everything operable by pointer is operable by keyboard (2.1.1 A), with no trap (2.1.2 A).
- [ ] Tab order follows the visual flow; no positive `tabindex`.
- [ ] Composite widgets (tabs, menus, grids, sliders, listboxes) use roving tabindex or
      `aria-activedescendant` and the expected arrow-key model. Follow the ARIA Authoring Practices pattern for
      the widget instead of inventing one.
- [ ] `Esc` closes overlays and returns focus to the invoking control. Modals contain focus while open and
      make the rest of the page inert.
- [ ] Single-character shortcuts can be turned off or remapped, or only fire on focus (2.1.4 A).

### Focus
- [ ] A visible focus indicator on every focusable element (2.4.7 AA). Use `:focus-visible`; never
      `outline: none` without a replacement. Aim for a 2 px indicator with ≥ 3:1 contrast against adjacent
      colours (the stricter appearance criterion 2.4.13 is AAA, but it is a good target).
- [ ] Focused elements are not entirely hidden by sticky headers, cookie bars, sheets or chat widgets
      (2.4.11 Focus Not Obscured (Minimum), AA). Fix with `scroll-padding-top`/`scroll-margin` sized to the
      sticky element, and by not stacking persistent overlays.
- [ ] Focus is moved deliberately on route change, dialog open/close and after destructive actions; it never
      drops to `<body>`.

### Pointer, touch and gestures
- [ ] Targets are at least 24 × 24 CSS px, or have enough spacing that a 24 px circle centred on each does not
      overlap a neighbour (2.5.8 Target Size (Minimum), AA; exceptions exist for inline links and
      user-agent-default controls). Studio³ default for primary touch actions is 44 × 44.
- [ ] Any action performed by dragging has a single-pointer alternative that needs no drag: buttons to move an
      item, tap-to-select then tap destination, steppers beside a slider (2.5.7 Dragging Movements, AA).
- [ ] Any path-based or multipoint gesture (swipe, pinch, two-finger rotate) has a single-pointer alternative
      such as a button (2.5.1 Pointer Gestures, A).
- [ ] Actions fire on pointer up and can be aborted by moving off the target (2.5.2 A).
- [ ] Nothing depends on device motion (shake, tilt) without a UI alternative and an off switch (2.5.4 A).
- [ ] Content revealed on hover or focus is dismissible, hoverable and persistent (1.4.13 AA). No hover-only
      information: touch and keyboard users must reach it.

### Colour and contrast
- [ ] Text contrast ≥ 4.5:1; large text (≥ 24 px, or ≥ 18.66 px bold) ≥ 3:1 (1.4.3 AA). Includes text over
      images, video and gradients at their worst point, and placeholder text if it conveys information.
- [ ] UI component boundaries, states and meaningful graphics (chart lines, icons, focus rings) ≥ 3:1 against
      adjacent colours (1.4.11 AA).
- [ ] Colour is never the only carrier of meaning (1.4.1 A): add text, icon, pattern, position or shape.
- [ ] Both themes are checked. Disabled controls are exempt from contrast rules but must still be recognisable.

### Motion, flashing and time
- [ ] Anything that moves, blinks, scrolls or auto-updates, starts automatically, lasts more than five seconds
      and sits alongside other content has a pause, stop or hide control (2.2.2 A). That covers carousels,
      looping hero video, marquees, tickers, auto-advancing stories and ambient canvas animation.
- [ ] Nothing flashes more than three times in any one-second period (2.3.1 A). Treat strobing shader effects,
      rapid cuts and hard white flashes as defects.
- [ ] Motion triggered by interaction can be disabled unless essential (2.3.3, AAA). Studio³ meets this through
      the reduced-motion policy in §2 and treats it as mandatory although it is beyond AA.
- [ ] Time limits can be turned off, adjusted or extended (2.2.1 A). No auto-dismissing toast is the only
      record of an error.
- [ ] No audio plays automatically for more than three seconds without a control (1.4.2 A). Studio³ default:
      no autoplaying sound at all.

### Reflow, zoom and text
- [ ] Content reflows at 320 CSS px wide without two-dimensional scrolling (1.4.10 AA). Data tables, maps,
      diagrams and similar content that needs two dimensions are exempt, but their container must scroll,
      not the page.
- [ ] Text can be resized to 200 % without loss (1.4.4 AA): use `rem`/`em`, no fixed-height text containers.
- [ ] Layout survives user text-spacing overrides (1.4.12 AA).
- [ ] Orientation is not locked (1.3.4 AA).

### Forms and errors
- [ ] Every field has a programmatic, visible label; placeholders are not labels (3.3.2 A, 1.3.1 A).
- [ ] Errors are identified in text and tied to the field with `aria-describedby`; `aria-invalid` is set
      (3.3.1 A). The message says how to fix it (3.3.3 AA).
- [ ] Legal, financial or data-destroying submissions are reversible, checked, or confirmed (3.3.4 AA).
- [ ] Information already entered in a process is not asked for again (3.3.7 Redundant Entry, A).
- [ ] Authentication does not depend on a cognitive function test without an alternative; allow paste and
      password managers (3.3.8 Accessible Authentication (Minimum), AA).
- [ ] `autocomplete` tokens on personal-data fields (1.3.5 AA).

### Status messages and live regions
- [ ] Results of actions that do not move focus are announced through `role="status"` (polite) or
      `role="alert"` (assertive, errors only) (4.1.3 AA).
- [ ] The live region exists in the DOM before its content changes; insert text into it, do not mount it.
- [ ] Streaming or rapidly changing values are not announced on every tick. Announce summaries or thresholds
      (see studio-data for live data).

### Media
- [ ] Informative images have text alternatives; decorative ones have `alt=""` or `aria-hidden` (1.1.1 A).
- [ ] Prerecorded video has captions (1.2.2 A) and audio description where the visuals carry information not
      in the soundtrack (1.2.5 AA). Audio-only has a transcript (1.2.1 A).
- [ ] Media controls are keyboard operable and labelled.

## 2. Reduced motion — the three-tier policy

Read the preference once, from one place. In library recipes that is `useStudioMotion().reduced`, which merges
the operating-system setting with an in-app toggle; the toggle can add reduction but never remove it. In plain
CSS, gate motion with `@media (prefers-reduced-motion: no-preference)` or neutralise it under `reduce`.

| Tier | What it covers | Under reduced motion |
|---|---|---|
| 1. Remove | Decorative motion: parallax, ambient loops, background shaders, hover flourishes, scroll-linked scaling, confetti | Gone. Show the resting state. |
| 2. Replace | Motion that explains a state change: panel open, route change, item added, reorder | An opacity cross-fade of 200 ms or less, or an instant change. No translation, scale or rotation. |
| 3. Keep behind control | Motion that *is* the content: a video, a 3D model turntable, an animated chart replay | Does not start by itself. A visible play control starts it; it can be paused. |

```css
.panel { transition: transform var(--s3-duration-moderate, 360ms) var(--s3-ease-emphasized, ease-out),
                     opacity var(--s3-duration-base, 240ms) linear; }
@media (prefers-reduced-motion: reduce) {
  .panel { transition: opacity 160ms linear; transform: none !important; }
}
```

Reduced motion is not "no feedback". Keep colour, opacity and text changes so state remains perceivable.
Scroll-driven sequences collapse to a normal, readable document: unpinned, every chapter visible in order.

## 3. 3D and canvas accessibility

A `<canvas>` is opaque to assistive technology. Treat it as an image that happens to move.

- **Name and describe it.** Give the canvas container a role and name (`role="img"` with `aria-label` for a
  non-interactive scene; a labelled group with real controls for an interactive one) and a longer description
  nearby when the scene carries information. `StudioCanvas` requires a `label` and accepts a `description`.
- **Information lives outside the canvas.** Prices, specifications, data values, hotspot text, navigation and
  calls to action are DOM elements. If the canvas fails to render, nothing essential is lost.
- **Keyboard equivalents.** Every pointer interaction in the scene has a DOM control: buttons for
  rotate/zoom/reset, a list of hotspots that moves the camera, a select for variants. Do not rely on focus
  inside the canvas.
- **Fallback.** Provide static content for no-WebGL, context loss, low-capability devices and reduced motion
  (a rendered poster plus the same DOM information). `StudioCanvas` takes a `fallback`.
- **Motion.** Autorotation and ambient camera drift are tier 1 or tier 3: off under reduced motion, pausable
  otherwise. Camera moves on scroll must not induce large, fast field-of-view changes.
- **No dragging-only orbit** (2.5.7) and no pinch-only zoom (2.5.1): provide buttons.
- **Spatial data** always ships with an equivalent table (see studio-data).

## 4. How to test, and what each method really covers

Automated tools find a minority of accessibility problems. Report coverage honestly.

| Concern | Studio³ automated coverage | Still needs manual review |
|---|---|---|
| Names, roles, landmarks, heading order, missing alt, form labels | Visual Director accessibility checks during `studio3 review run` | Whether names and alt text are *meaningful* |
| Text contrast | Checked for text on solid backgrounds | Text over images, gradients, video, canvas; hover/focus/disabled states |
| Non-text contrast (1.4.11) | Partial at best | Chart marks, icons, focus rings, input borders |
| Keyboard reachability, focus visibility, traps | Visual Director keyboard walk (tabs through the page, records focus order and indicator presence) | Arrow-key models inside widgets, focus return after dialogs, logical order |
| Focus not obscured (2.4.11) | May flag focused elements under fixed layers | Confirm by tabbing at 320 px and with every sticky layer open |
| Target size (2.5.8) | Measured from rendered boxes | Spacing exception, inline links |
| Dragging and gesture alternatives (2.5.7, 2.5.1) | Not detectable | Operate every drag/swipe feature with single clicks and with keyboard |
| Reduced motion | Capture under emulated `prefers-reduced-motion: reduce`; motion checks flag long-running animation | Whether tier 2/3 replacements are right; whether meaning is preserved |
| Pause/stop/hide (2.2.2) | Long-running animation may be flagged | Presence and operability of the control |
| Flashing (2.3.1) | Not measured | Inspect any strobing, glitch or rapid-cut effect by eye; when in doubt remove it |
| Reflow (1.4.10) | Captures at narrow widths; horizontal overflow detection | 400 % zoom behaviour, text-spacing overrides |
| Live regions, status messages | Presence only | Listen with a screen reader: is it announced once, at the right time? |
| 3D alternatives | 3D diagnostics confirm a canvas rendered and whether fallback content exists | Whether the alternative is equivalent in information |
| Experience heuristics | `studio3 experience assess` scores interaction quality heuristically | Not an accessibility audit; do not cite it as one |

The exact set of checks is whatever your installed build implements: run `studio3 review run --help` and read
the generated report to see which checks ran. A check that was skipped (for example because no browser is
installed; see `studio3 doctor --browser`) is reported as **not run**, never as passed.

**Manual pass you can always do without tools**

1. Unplug the mouse: complete the primary task with Tab, Shift+Tab, Enter, Space, Esc and arrows.
2. Set the viewport to 320 px wide and zoom text to 200 %.
3. Turn on reduced motion at OS or emulation level and reload.
4. Read the page with styles off or through the accessibility tree: does the order make sense?
5. If a screen reader is available, complete the primary task with it. If not, state that it was not tested.
