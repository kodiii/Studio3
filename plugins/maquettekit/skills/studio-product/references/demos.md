# Product Studio demos

Four reference compositions live in the library at
`${CLAUDE_PLUGIN_ROOT}/library/src/demos/product/<id>/` (fallback `../../library/src/demos/product/<id>/`
from this skill's folder). Each has a `meta.ts` (summary, highlights, recipes, accessibility, reduced-motion and
performance notes) and an `index.tsx`, and meets the craft floor in `${CLAUDE_PLUGIN_ROOT}/shared/motion-craft.md`
§1 as described below. Study them; do not paste them into a user's project wholesale. All brands, copy, prices and
data are fictional and labelled as sample content.

**The catalogue is the source of truth.** `uses` lists the recipes a demo imports; `adapts` lists recipes whose
technique it rebuilds in its own files. Confirm before citing:

```
maquettekit catalog list --kind demos
maquettekit catalog show saas-landing
maquettekit catalog show saas-landing --source
```

`product-configurator` shares its id with a 3D demo, which `catalog show` and `catalog install` return; open
`demos/product/product-configurator/` directly.

## 1. Overview

| Demo id | Proves | Profile | 3D | Load it when the task is |
|---|---|---|---|---|
| `saas-landing` | The working product as the hero, complete pricing, no fabricated proof | Expressive | No | Landing, feature or pricing page |
| `animated-onboarding` | A stepped flow where each answer visibly lands and every step is usable at once | Expressive | No | Sign-up, setup, any stepped form |
| `product-configurator` | A configurator drawn in computed SVG instead of WebGL, with page-owned state | Expressive | No | Configurators, option pickers, variant selection |
| `product-showcase` | A product page complete as photos, with real-time 3D only on request | Immersive | On request | Hardware and object product pages |

## 2. `saas-landing` — Tarn Landing Page

A conversion page for a fictional webhook inbox: a lit, working DOM inbox as the hero, then a capture → inspect →
replay walkthrough, a comparison table, pricing with a billing toggle and an FAQ.

- **Signature move:** the replay. The payload travels a drawn arc to the endpoint chip (`offset-path`), and the 500
  chips squash and spring back as 200; the history keeps the original 500.
- **Physical and lit:** light from the top-left. The hero window lifts over a two-layer shadow while a highlight and
  a lit border follow the pointer; CTAs lift, compress within a frame and spring back (`springToLinear()`).
- **Alive:** the window leans toward the pointer (≤ 2.6°, one spring per channel) and drifts slower than the page.
- **Touchable:** scrub yesterday's deliveries on a timeline; a thrown playhead settles on the nearest delivery.
  Twins: the list rows, and the playhead as a `role="slider"` (arrows, Page Up/Down, Home, End).
- **Reduced motion:** no lean, light, drift, magnet or entrance; the replay swaps the status in place; the playhead
  jumps; prices swap.
- **Recipes:** uses `split-line-reveal` (headline). Adapts `svg-path-draw` (arc), `morph-submit-button` (500 → 200),
  `brush-linked-range` (timeline), `tilt-parallax-card` and `spotlight-border-card` (window), `magnetic-button`
  (hero CTA), `press-depth-button`, `number-ticker` (`Ticker.tsx`) and `accordion-height-auto` (FAQ).

**Copy:** the scrub strip and its twins; `HeroWindow.tsx` (custom properties written from one `useRafLoop` that
sleeps at rest); one polite status line per billing change; a second confirmation before a production replay. Pair
with `patterns-conversion.md`.

## 3. `animated-onboarding` — Larder Kitchen Setup

A five-step setup for a fictional kitchen app: one question per step, "Step 2 of 5" in the heading, Skip on optional
steps, reward-early/punish-late validation, the step in the URL hash. It ends on a first real outcome, a sample prep
list.

- **Signature move:** each answer flies onto a ticket on the pass rail: it lifts off its field, arcs over on two token
  springs, changes typeface mid-flight and hands over to the real ticket line at the same pixel, with no View
  Transitions or snapshots.
- **Physical and lit:** the leaving step exits fast and staggered while the next arrives slower; the landing stamps
  its line. Controls lift over a two-layer shadow, compress on press and spring back.
- **Alive:** the ticket swings on its clip when answers land, with scroll speed, and when a pointer brushes it.
- **Touchable:** "What should Larder build first?" is pick-and-rank: drag a grip, neighbours make room, the card
  springs into its slot with the throw's velocity. Twin: the grip is a button named with its priority, moved by Arrow
  Up/Down, Home and End, each move announced.
- **Reduced motion:** a 180 ms fade per step (no flight, stamp or swing); ranking moves apply instantly; the button
  swaps labels; no shimmer.
- **Recipes:** adapts `morph-submit-button` (async steps), `drag-reorder-list` (ranking), `skeleton-shimmer-handoff`
  (prep list) and `press-depth-button`.

**Copy:** `choreo.ts` (a step change's animations, timers and flyers, all cancelled when another change
interrupts); focus to each new step's heading; the validation timing; the ticket as a labelled `aside` with a
definition list, so the summary exists without the animation. Pair with `patterns-flows.md`.

## 4. `product-configurator` — Hollin Drover Build Sheet

A bike configurator that picks the cheaper technique on purpose: bikes are judged side-on, so a parametric SVG
elevation (about two hundred elements from a dozen numbers) answers what a 3D model would, with no download. Native
radio groups, URL-hash state, an incompatibility handled in words (45 mm tyres remove fenders, with Undo), and a link
to the 3D configurator for when 3D is worth it.

- **Signature move:** each choice changes the drawing its own way: paint flows down the tubes, fitted parts drop in
  on a spring as old ones lift away, size changes reshape the frame on a spring.
- **Physical and lit:** the cranks drive the rear wheel through a freehub; released parts keep their velocity until
  bearing friction stops them. Parts light up and lift under the pointer; option cards lift over a two-layer shadow.
- **Alive:** with lights fitted, the dynamo's beam glows with the front wheel's speed; the entrance draws outlines in
  ink before paint washes in.
- **Touchable:** drag the cranks or either wheel; press a part to focus the option group that changes it. Twins: "Hold
  to pedal" (Space or Enter held) and "Spin front wheel".
- **Reduced motion:** state applies at once and the price swaps; wheels and cranks still turn while dragged or held,
  and stop on release.
- **Recipes:** adapts `number-ticker` (price), `svg-path-draw` (entrance) and `press-depth-button`.

**Copy:** the decision itself (`product-3d.md` §1–§2); `bike.ts` (options and the parametric elevation); angles
written straight to rotation groups from one `useRafLoop` that sleeps when still, so React never renders mid-spin; a
blocked option that stays focusable (`aria-disabled`) beside its reason. When 3D is needed: `product-3d.md` §4–§6.

## 5. `product-showcase` — Pulse Product Page

A storytelling page for the fictional Pulse speaker, complete as photos: numbered details, chapters, colourways and
a specification table. "Explore in 3D" lazy-loads a chunk with `StudioCanvas`, orbit with limits, camera presets
and tracked hotspots.

- **Signature move:** the pointer is the key light. The render leans toward it (≤ 4°), a sheen masked to the
  product's silhouette sits under it and the two-layer floor shadow slides away; at rest the light sits top-left.
- **Physical and lit:** the speaker settles onto its shadow on a spring; controls lift over a two-layer shadow and
  release on a `springToLinear()` spring; colourways wipe in.
- **Alive:** chapters dolly in once, then zoom by at most 10 % with the scroll.
- **Touchable:** drag a loupe over the speaker for a 2× look; thrown, it keeps its velocity and is pulled onto a
  nearby detail. Twins: Enter or Space steps it through the details, arrows move it, Escape docks it; every 3D action
  has a DOM button.
- **Reduced motion:** no tilt, light, entrance or zoom; colourways cross-fade in 160 ms; the loupe jumps; the 3D camera
  cuts.
- **Recipes:** adapts `tilt-parallax-card` (lean and sheen), `split-line-reveal` (headline) and `press-depth-button`.

**Copy:** poster first (three.js, R3F and the 1.0–2.0 MB model arrive only on the button press; without WebGL 2 a
sentence replaces the button); `recolour.ts` (colourways tinted from one 66 KB render); `Viewer3D.tsx` as a pure view
of page state, disposed on return to the photo. Pair with `product-3d.md` §5–§6; narrative-led versions start in
`studio-cinematic`.

## 6. Using a demo as a starting point

1. Read `meta.ts` first: highlights, `uses`, `adapts`, accessibility and reduced-motion notes say what to preserve.
2. Write the user's motion brief (`motion-craft.md` §6) first: a demo's signature move and visual direction belong to
   its fictional brand.
3. Take the two or three ideas the task needs. A `uses` recipe installs as it is
   (`maquettekit catalog install <id>`); an `adapts` technique lives in the demo's files: lift it, or adapt the recipe
   through `studio-components`, with the project's tokens (`maquettekit.design.json`).
4. Keep each gesture's button and keyboard twin and each reduced-motion form: they are part of the pattern.
5. Replace all fictional content with the user's real content, or keep visible `Sample` labels.
6. Demos are written for the library's container-query preview stage; re-check breakpoints in the real layout.
7. If the project is not React, treat the demo as a specification: structure, states, timings and accessibility
   behaviour carry over; the code does not.
