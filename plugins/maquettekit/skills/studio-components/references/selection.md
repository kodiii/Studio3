# Choosing a recipe

## Category map

| You need | Search category | Start with |
| - | - | - |
| A headline or text moment | `typography` | reveal on entry → mask reveal; hover/attention → variable-font recipes; data-like text → decode |
| Wayfinding | `navigation` | tabs/segmented → morphing indicator; site menu → curtain; power users → command palette |
| Scroll storytelling | `scroll` | progress indication (cheap) → parallax layers → pinned chapters / horizontal track (GSAP) |
| Rearranging content | `layout` | filter/sort → FLIP grid; list → detail → shared-element expansion; disclosure → accordion |
| Touch-first manipulation | `gestures` | each has a button/keyboard path — keep it |
| Emphasis on a surface | `cards`, `buttons` | prefer pointer-light, CSS-driven ones on dense pages |
| Waiting | `loading` | skeleton hand-off for content; determinate progress when progress is known |
| Numbers and charts | `charts` | value change → ticker; time series → morph; ranking → bar race; range → brush |
| Participation | `social` | reactions, like/save, polls, story progress |
| Illustration | `svg` | line drawing, organic morph |
| Atmosphere | `backgrounds`, `shaders` | CSS/canvas first; shaders only when the page is otherwise light |
| Depth without WebGL | `3d-transforms` | CSS 3D covers carousels, flips and layered explodes |
| Real-time 3D | `camera`, `spatial`, `shaders` | hand over to `studio-3d` for integration |

Confirm ids with `maquettekit catalog search`; the catalogue is generated and may contain more than this map.

## Decision rules

1. **Lightest technology wins**: `css` → `waapi` → `motion` → `gsap` → `three`/`r3f`. Filter with `--no-deps`
   first and only move up when the behaviour genuinely needs it (layout/gesture springs → Motion; scrubbed or
   pinned scroll timelines → GSAP; actual 3D → three).
2. **Respect the project's stack**: if the project already uses Motion, prefer `--tech motion`; if GSAP, prefer
   `--tech gsap`. One animation library per project unless there is a stated reason.
3. **Match the experience profile** (`maquettekit.design.json` → `motion.profile`):
   Essential → `--intensity subtle`, complexity 1–2, no ambient motion.
   Expressive → subtle/moderate; one bold moment per view at most.
   Immersive → bold is acceptable where it carries the narrative; still one focal motion at a time.
4. **Complexity is integration cost**, not quality: 1 drop-in, 2 needs state or layout wiring, 3 owns a subsystem
   (WebGL, timelines, focus management).
5. **Count concurrent motion**: several ambient recipes on one screen compete. Keep one ambient layer.
6. **3D budget**: one WebGL canvas per view by default. Browsers limit live contexts, and each canvas costs
   memory even when idle.

## Reading the metadata

| Field | How to use it |
| - | - |
| `dependencies` | The complete install list. Empty means platform APIs only |
| `params` | The tunable surface. Defaults are the designed values; change them with intent |
| `accessibility` | Behaviours you must preserve when adapting |
| `reducedMotion` | The exact reduced state to verify |
| `performance` | Constraints (what is animated, when loops pause, caps) |
| `interaction` | Input types handled; `scroll` recipes own a scroll container in previews — in a page, point them at the page scroller |
| `preview.stage` | `ink` recipes are designed on a dark surface; provide one or adjust colours |
