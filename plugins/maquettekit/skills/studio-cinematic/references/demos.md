# Cinematic Studio demos

Four reference compositions are planned for the library at
`${CLAUDE_PLUGIN_ROOT}/library/src/demos/cinematic/<id>/` (fallback `../../library/src/demos/cinematic/<id>/`
from this skill's folder). Each will have a `meta.ts` (summary, highlights, the recipes it uses,
accessibility, reduced-motion and performance notes) and an `index.tsx`.

**Status: planned.** When this file was written no cinematic demo existed in the catalogue. Before citing a
demo or opening its files, confirm it exists:

```
maquettekit catalog list --kind demos
maquettekit catalog show cinematic-landing
maquettekit catalog show cinematic-landing --source
```

If a demo is missing, use this file as a specification of what it would prove and build from the recipes
directly. The recipe lists below are the planned compositions; a demo's `meta.uses` is what it really
imports. Several recipes named here are planned too (confirm with `maquettekit catalog search <id>`).

Study demos for staging, pacing and fallbacks; do not paste them into a user's project wholesale. All brands,
copy and imagery in demos are fictional and drawn with type, CSS, SVG or procedural geometry.

## 1. Overview

| Demo id | Proves | Profile | 3D | Load it when the task is |
|---|---|---|---|---|
| `cinematic-landing` | A launch page told in five beats that still converts at the end | Immersive | No | Launch, campaign or brand page |
| `scroll-narrative` | Editorial scrollytelling: sticky graphics, stepped text, a horizontal passage | Expressive | No | Long read, explainer, report, case study |
| `kinetic-typography` | Type as the main material: splits, variable axes, masks, marquee, decode | Immersive | No | Type-led brand piece, manifesto, title sequence |
| `immersive-3d-hero` | One persistent scene carrying several beats through camera choreography | Immersive | Yes | Story about an object or a space |

## 2. `cinematic-landing`

**Intent.** Show that a launch page can be memorable and honest: a hook visible at first paint, one pinned
turn, proof made of real-looking specifics labelled as sample content, and a calm, static ending with one
action.

**Planned beat sheet.** Hook (static display line, LCP-safe) → Tension (two lines rising from masks) → Turn
(pinned 2–3 vh, layered depth) → Proof (chapters with numerals and line art) → Resolution (date, one button).

**Planned recipes**

| Recipe | Role in the demo |
|---|---|
| `split-line-reveal` | Beat 2 headline entrance (beat 1 stays static) |
| `parallax-depth-layers` | Beat 3 layered depth |
| `scroll-pin-chapters` | Beat 4 proof chapters with progress dots |
| `scroll-progress-rail` | Chapter index with jump links |
| `fullscreen-menu-curtain` | Brand-led navigation |
| `grain-gradient-mesh` | One restrained background texture across the colour script |
| `kinetic-marquee` | A band between beats with a pause control; static under reduced motion |

**Read for:** the static document underneath the choreography; rest zones inside the pinned turn; how the
ending stays still and immediately usable; skip links before the pinned passage.

## 3. `scroll-narrative`

**Intent.** Demonstrate the editorial pattern: a sticky graphic that changes state as text steps scroll past
it, plus one horizontal passage, all collapsing to a readable article under reduced motion.

**Planned structure.** Title card → five text steps beside a sticky figure (each step changes the figure
once) → a horizontal passage of plates → a closing summary with sources.

**Planned recipes**

| Recipe | Role in the demo |
|---|---|
| `scroll-pin-chapters` | Sticky figure and stepped states |
| `svg-path-draw` | The figure's line work building per step |
| `horizontal-scroll-gallery` | The plate passage, with focus-driven scrolling |
| `scroll-progress-rail` | Reading progress named by section |
| `layered-depth-stack` | One exploded diagram in the middle of the story |
| `split-line-reveal` | Section titles |

**Read for:** step text that stays in normal flow (so it is the reduced-motion version too); how the figure's
states are keyed to step ids rather than scroll pixels; `containerAnimation` use in the passage.

## 4. `kinetic-typography`

**Intent.** A type specimen and manifesto that proves every effect in `kinetic-typography.md` can keep
exactly one accessible copy, survive zoom and text-spacing overrides, and become still under reduced motion.

**Planned structure.** A title card per statement; each uses a different technique: line masks, a word
emphasis by weight, a decode, a marquee band with a pause button, and a final still statement.

**Planned recipes**

| Recipe | Role in the demo |
|---|---|
| `split-line-reveal` | Line and word reveals |
| `variable-weight-wave` | Weight following pointer and keyboard focus |
| `scramble-decode` | A decoded statement with the final string announced once |
| `kinetic-marquee` | Velocity-reactive band with a visible pause control |
| `blob-morph` | A shape used as a mask behind one statement |

**Read for:** pattern A versus pattern B accessible copies; locked lines under variable-font animation; the
timing table applied with profile scaling; RTL mirroring of directional sweeps.

## 5. `immersive-3d-hero`

**Intent.** Show the cinematic–3D collaboration end to end: the page owns scroll progress, one persistent
canvas renders on demand, captions are DOM, every viewpoint is reachable by buttons, and the story is
complete with WebGL disabled.

**Planned structure.** Poster-first hero → a fly-through of three chapters with DOM captions → an object
presented with camera presets → a static resolution.

**Planned recipes**

| Recipe | Role in the demo |
|---|---|
| `scroll-camera-dolly` | Scroll-driven travel with step-button fallback |
| `camera-preset-rig` | Named viewpoints around the object |
| `shader-aurora-plane` | The atmospheric background with pause control |
| `particle-field-gpu` | Particles scaled by the quality profile, paused by default under reduced motion |
| `split-line-reveal` | Caption headlines |

Collaborates with `studio-3d` (scene) and `studio-motion` (DOM and camera timing).

**Read for:** the chapter map shared by captions, camera and step buttons; poster-to-canvas hand-over without
layout shift; quality tiers; the handoff table in `cinematic-3d.md` §6 filled in for a real case.

## 6. Using a demo as a starting point

1. Read `meta.ts` first: highlights, `uses`, accessibility and reduced-motion notes tell you what to keep.
2. Take the two or three ideas relevant to the task and rebuild them in the project's stack with its tokens
   (`maquettekit.design.json`), delegating recipe adaptation to `studio-components`.
3. Write the user's own beat sheet (`playbook.md` §2); never inherit the demo's story or structure unexamined.
4. Replace all fictional content with the user's real content, or keep visible `Sample` labels.
5. Do not inherit the demo's visual direction: it belongs to a fictional brand.
6. Demos are written for the library's container-query preview stage. In a real page, re-check pinning,
   heights in `svh` and breakpoints against the page's own scroll container.
7. If the project is not React, treat the demo as a specification: beats, timings, fallbacks and
   accessibility behaviour carry over; the code does not.
