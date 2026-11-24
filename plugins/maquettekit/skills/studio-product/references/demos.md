# Product Studio demos

Four reference compositions live in the library at
`${CLAUDE_PLUGIN_ROOT}/library/src/demos/product/<id>/` (fallback `../../library/src/demos/product/<id>/`
from this skill's folder). Each has a `meta.ts` (summary, highlights, the recipes it uses, accessibility,
reduced-motion and performance notes) and an `index.tsx`.

Study them for composition and state handling; do not paste them into a user's project wholesale. All brands,
copy, prices and data in the demos are fictional and labelled as sample content.

**The catalogue is the source of truth.** The recipe lists below are the planned compositions; a demo's
`meta.uses` is what it really imports. Confirm before citing:

```
maquettekit catalog list --kind demos
maquettekit catalog show saas-landing
maquettekit catalog show saas-landing --source
```

## 1. Overview

| Demo id | Proves | Profile | 3D | Load it when the task is |
|---|---|---|---|---|
| `saas-landing` | A marketing page with a specific direction, real product UI as the hero and honest conversion patterns | Expressive | No | Landing, feature or pricing page |
| `animated-onboarding` | A multi-step flow where motion gives direction and feedback without slowing the user | Expressive | No | Sign-up, setup, any stepped form |
| `product-configurator` | Page-owned configuration state driving a 3D view, with price and options in DOM | Expressive → Immersive | Yes | Configurators, option pickers, variant selection |
| `product-showcase` | Presenting a physical product with inspection, annotation and a guided sequence | Immersive | Yes | Hardware and object product pages |

## 2. `saas-landing`

**Demonstrates**

- A hero built from the claim/clarifier/product-view/action formula, with the product view as live DOM rather
  than a screenshot.
- Section rhythm: demonstration, one argued differentiator, compact supporting capabilities, proof slots,
  pricing, objections, final action. No three-identical-cards block.
- A billing toggle that updates prices in place without layout shift and announces the change once.
- Navigation with a current-section indicator and a command menu as a secondary route.
- Proof slots that are explicitly labelled as sample content.

**Planned recipes**

| Recipe | Role in the demo |
|---|---|
| `split-line-reveal` | The single orchestrated headline entrance |
| `morphing-nav-pill` | Navigation indicator; also the billing toggle indicator |
| `command-menu-reveal` | Keyboard-first secondary navigation |
| `number-ticker` | Price change on toggle (plain value stays in accessible text) |
| `press-depth-button`, `magnetic-button` | Primary action feedback; magnetic on fine pointers only |
| `spotlight-border-card` | Pointer accent on the plan cards |
| `accordion-height-auto` | Objections / FAQ |
| `grain-gradient-mesh` or `dot-grid-pointer-field` | One restrained background texture |

**Read for:** hero layout that is not a centred stack; how the LCP element stays visible before script runs;
pricing semantics. Pair with `patterns-conversion.md`.

## 3. `animated-onboarding`

**Demonstrates**

- One question per step, honest progress, back/forward with directional transitions, state that survives
  remount.
- "Reward early, punish late" validation and error messages that say how to fix the problem.
- Submit feedback from press through loading to success, with focus management at each stage.
- Skeleton hand-off into the first real view, and a single brief celebration at the first outcome.
- Reduced-motion path: every transition becomes a short cross-fade; the celebration is removed.

**Planned recipes**

| Recipe | Role in the demo |
|---|---|
| `story-progress-segments` or `scroll-progress-rail` | Step progress |
| `morph-submit-button` | Submit → loading → success |
| `skeleton-shimmer-handoff` | Loading into the first workspace view |
| `flip-grid-reorder` | Template choice re-flowing as options filter |
| `expanding-card-detail` | Shared-element move from a chosen template to its preview |
| `accordion-height-auto` | Optional advanced settings |
| `svg-path-draw` | Completion mark |

**Read for:** the per-field validation state machine, focus movement between steps, and how durations stay
at or under the `moderate` token so the flow never waits on animation. Pair with `patterns-flows.md`.

## 4. `product-configurator`

**Demonstrates**

- Configuration state owned by the page and serialisable to the URL; the scene is a pure view of it.
- Option groups as native radio groups; price, summary and primary action in DOM with one status
  announcement per change.
- Camera presets tied to option groups so the view shows what is being changed.
- Poster-first, lazy canvas with a static fallback, and DOM buttons mirroring orbit, zoom and reset.
- Collaboration: Product leads, 3D Studio supplies the scene, Motion Lab times DOM and camera together.

**Planned recipes**

| Recipe | Role in the demo |
|---|---|
| `orbit-inspect-controls` | Inspection with limits and button equivalents |
| `camera-preset-rig` | Named camera stops per option group |
| `morphing-nav-pill` | Option group switcher |
| `number-ticker` | Total price change |
| `press-depth-button` | Primary action |
| `skeleton-shimmer-handoff` | Poster to canvas hand-over |

**Read for:** the option data model, how the canvas is isolated from business logic, and the fallback path.
Pair with `product-3d.md` §4–§6.

## 5. `product-showcase`

**Demonstrates**

- A physical product presented through inspection, annotated hotspots, an exploded view and a short guided
  sequence, each with DOM equivalents.
- Hotspot content and the parts list as real lists outside the canvas; selecting an item moves the camera.
- A guided sequence reachable by scroll and by "Previous/Next" buttons, never scroll alone.
- Reduced-motion behaviour: camera cuts instead of travels, exploded view jumps between two states.
- Where the showcase would have been better served by images, the demo's notes say so.

**Planned recipes**

| Recipe | Role in the demo |
|---|---|
| `hotspot-annotations` | Feature callouts tracking the object |
| `exploded-view` | Parts and assembly |
| `scroll-camera-dolly` | Guided sequence |
| `orbit-inspect-controls` | Free inspection |
| `scroll-pin-chapters` | DOM chapter copy alongside the scene |
| `split-line-reveal` | Chapter titles |

**Read for:** how information stays outside the canvas, and the chapter/camera synchronisation contract. For
narrative-led versions of this page, lead with `studio-cinematic`.

## 6. Using a demo as a starting point

1. Read `meta.ts` first: highlights, `uses`, accessibility and reduced-motion notes tell you what to preserve.
2. Identify the two or three ideas relevant to the task. Rebuild those in the project's stack with its tokens
   (`maquettekit.design.json`), delegating recipe adaptation to `studio-components`.
3. Replace all fictional content with the user's real content, or keep visible `Sample` labels.
4. Do not inherit the demo's visual direction: it belongs to a fictional brand. Derive the direction from the
   user's product as described in the playbook.
5. Demos are written for the library's container-query preview stage. In a real page, re-check breakpoints
   against the page's own layout.
6. If the project is not React, treat the demo as a specification: structure, states, timings and
   accessibility behaviour carry over; the code does not.
