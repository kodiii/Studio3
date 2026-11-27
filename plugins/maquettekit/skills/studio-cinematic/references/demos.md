# Cinematic Studio demos

Four reference compositions live in the library at
`${CLAUDE_PLUGIN_ROOT}/library/src/demos/cinematic/<id>/` (fallback `../../library/src/demos/cinematic/<id>/`
from this skill's folder). Each has a `meta.ts` (summary, highlights, recipes, accessibility, reduced-motion and
performance notes) and an `index.tsx`, and meets the craft floor for its profile
(`${CLAUDE_PLUGIN_ROOT}/shared/motion-craft.md` §1) as described below. Study them for staging, pacing and
fallbacks; do not paste them into a user's project wholesale. All brands, copy and imagery are fictional, drawn with
type, CSS, SVG or procedural geometry.

**The catalogue is the source of truth.** `uses` lists the recipes a demo imports; `adapts` lists recipes whose
technique it rebuilds in its own files. Confirm before citing:

```
maquettekit catalog list --kind demos
maquettekit catalog show scroll-narrative
maquettekit catalog show scroll-narrative --source
```

`cinematic-landing` shares its id with a 3D demo, which `catalog show` and `catalog install` return; open
`demos/cinematic/cinematic-landing/` directly.

## 1. Overview

| Demo id | Proves | Profile | 3D | Load it when the task is |
|---|---|---|---|---|
| `cinematic-landing` | A five-beat launch page with a pinned turn and a still, usable ending | Immersive | No | Launch, campaign or brand page |
| `scroll-narrative` | Editorial scrollytelling: text in normal flow beside a sticky, scrubbed figure | Expressive | No | Long read, explainer, report, case study |
| `kinetic-typography` | Type as the material, with one accessible copy per line and one pause | Immersive | No | Type-led brand piece, manifesto, title sequence |
| `immersive-3d-hero` | One persistent scene carried through several beats by the page's scroll | Immersive | Yes | Story about an object or a place |

## 2. `cinematic-landing` — Larkwell, Opus 31

A launch page for a fictional organ builder's chamber organ in five beats: Hook (type painted with the page) →
Tension (the room) → Turn (a pinned zoom through an arched window into the case) → Proof ("Seven stops. Pull one.")
→ Resolution (the recital date and one link, still).

- **Signature move:** the arch, recurring as hero window, zoom-through and closing outline. The turn is a CSS-sticky
  scene on one scrubbed GSAP timeline, with rest zones either side.
- **Physical:** a pulled stop meets growing resistance, clicks over its detent and settles on `spring.press` with the
  hand's velocity; its rank rises pipe by pipe with a `spring.pop` overshoot.
- **Lit and alive:** the pointer is the west window's light (the glow leans toward it, each pipe's specular band
  slides); scroll speed is wind that swells the glow. Knob faces are domed from the upper left; control shadows fall
  lower right.
- **Touchable:** drag a drawknob out or push it back. Twins: stops are toggle buttons (tap, Enter, Space) with a
  polite summary; only a sideways drag pulls a knob (`touch-action: pan-y`).
- **Reduced motion:** no pinning, mask, parallax, light or wind; the case is a still drawing with captions in flow.
- **Recipes:** uses `split-line-reveal` (beat 2 title). Adapts `parallax-depth-layers` (façade) and
  `press-depth-button` (knobs, links).

**Copy:** the static document underneath (animated layers `aria-hidden`, one real headline); pointer parallax on the
CSS `translate` property, so it composes with GSAP's transforms; a skip link past the pinned sequence. Pair with
`scroll-choreography.md` §2 and `playbook.md` §2.

## 3. `scroll-narrative` — The Long Bend

An editorial story of how a fictional river carves its valley, in five stages (I Rain → V The floor). Step text stays
in normal flow beside a sticky survey drawing, a pure function of the stage (0–4) scrubbed by one GSAP timeline with
rest zones on every stage.

- **Signature move:** the surveyor inks the title hill from its summit outward while the river draws itself under
  "Bend"; the headline is there from first paint.
- **Physical and lit:** the section line A–A′ follows the hand on `spring.press` and a flick glides to a soft stop;
  the pointer tilts the drawing like a relief model (higher ground shifts further) and the plate casts a two-layer
  shadow from the upper-left light.
- **Alive:** flecks travel downstream at a speed set by scroll velocity and stop when the reader does.
- **Touchable:** drag the section line, or press the plan, and the inset redraws the cross-section along it. Twins: a
  slider whose value text says what the line crosses; named stage buttons that jump and move focus to each heading.
- **Reduced motion:** no sticky figure, scrub, entrance, relief or current; each stage gets its own still plate.
- **Recipes:** uses `split-line-reveal` (closing title). Adapts `svg-path-draw` (inked entrance),
  `parallax-depth-layers` (relief) and `press-depth-button` (stage buttons).

**Copy:** `valley.ts` (deterministic geometry, so the scrubbed figure, the still plates and a mid-page reload agree);
figure states keyed to the stage value, not scroll pixels; the figure sticking above the text at narrow widths. Pair
with `scroll-choreography.md` §2–§3.

## 4. `kinetic-typography` — Radio Haar, the night forecast

A kinetic type piece staged as a fictional coast's late-night shipping forecast: each cue uses a different type
technique, and one Pause motion toggle stills them all (WCAG 2.2.2).

- **Signature move:** the needle caught by the detent. Thrown in the entrance or by hand, the tuning needle keeps its
  velocity, slows with friction and is caught on 97.4 with a `spring.pop` overshoot.
- **Lit:** the pointer is a desk lamp: display type casts a contact and a soft shadow away from it, with a rim on its
  lit side, em-scaled so the biggest type stands highest.
- **Alive:** wind force drives each sea area's `wght`, `wdth` and `opsz`, scrubbed by scroll; scroll velocity leans
  the list like a gust; area names run along a drawn coastline as a pausable ticker.
- **Touchable:** drag the needle or press the scale. Twin: a slider named Tuning (arrows 0.1 MHz, Page Up/Down
  1 MHz, Home/End) whose value text says clear, faint or static.
- **Reduced motion:** everything still: fixed lamp, the dial on the station, rows at their force axes, recipes in
  final states.
- **Recipes:** uses `variable-weight-wave` (headline), `scramble-decode` (tuning in), `split-line-reveal` (sea
  state) and `kinetic-marquee` (gale warnings). Adapts `press-depth-button`.

**Copy:** one accessible copy per animated line (the coastline is a described image followed by a plain list); wind
force in words in every row, the axes only reinforcing it; axis changes limited to six short `nowrap` lines, one
reflow per frame. Pair with `kinetic-typography.md` §2–§3.

## 5. `immersive-3d-hero` — Kelda Ridge, night walks

An immersive hero for a fictional guided night walk: a procedural contour-line landscape, a dusk-to-aurora sky and
layered type. One persistent `StudioCanvas` sits behind four DOM slides; the page owns scroll progress and the scene
damps toward it through three stops (Lake, Ridge, Sky) before plain content. Collaborates with `studio-3d`.

- **Signature move:** the climb from the lake at dusk to the summit, where the aurora reaches full strength; fast
  scrolling flares the curtains.
- **Physical:** horizontal drag looks around ±20° with a rubber band; release keeps the throw's velocity and
  `spring.release` brings the view home.
- **Lit:** one light from the north sky rims slopes with aurora green and tints the top edges of DOM panels and
  controls; every shadow falls below.
- **Alive:** the pointer aims a warm head-torch at the ground; the camera sways ±1.5° with it and the layered title
  moves in depth.
- **Touchable:** drag to look. Twins: Look left / Look right (press glances, hold keeps looking); viewpoint buttons
  mirror the scroll camera; Pause sky and Turn off 3D.
- **Reduced motion:** a framed still whose viewpoint buttons cut between the stops; the torch still answers the
  pointer, as light only.
- **Recipes:** uses `split-line-reveal` (schedule title). Adapts `shader-aurora-plane` (sky) and
  `press-depth-button`.

**Copy:** the bridge in `Scene.tsx` (the page writes scroll progress; the scene reads it and requests frames only
until everything settles); `Poster.tsx`, an SVG poster that paints first and is the whole picture without
WebGL; a drag that claims the pointer only once movement is clearly horizontal. Pair with `cinematic-3d.md` §3 and
§6.

## 6. Using a demo as a starting point

1. Read `meta.ts` first: highlights, `uses`, `adapts`, accessibility and reduced-motion notes say what to keep.
2. Write the user's own beat sheet (`playbook.md` §2) and motion brief (`motion-craft.md` §6); never inherit a demo's
   story, structure, signature move or visual direction unexamined.
3. Rebuild the two or three ideas the task needs in the project's stack with its tokens (`maquettekit.design.json`),
   delegating recipe adaptation to `studio-components`. A `uses` recipe installs as it is
   (`maquettekit catalog install <id>`); an `adapts` technique lives in the demo's own files.
4. Keep the static document underneath, every pause, skip and keyboard twin, and each reduced-motion form.
5. Replace all fictional content with the user's real content, or keep visible `Sample` labels.
6. Demos are written for the library's container-query preview stage; in a real page, re-check pinning, `svh`
   heights and breakpoints against its own scroll container.
7. If the project is not React, treat the demo as a specification: beats, timings, fallbacks and accessibility
   behaviour carry over; the code does not.
