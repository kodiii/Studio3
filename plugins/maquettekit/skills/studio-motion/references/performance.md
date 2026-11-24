# Performance — smooth motion on real devices

The property tiers, `will-change` discipline, layout-thrash rules and measurement honesty are in the shared
`performance.md` §3 and §7; read them first. This file adds what matters when building motion.

## 1. Properties

| Animate | Instead of | Why |
|---|---|---|
| `transform` (`translate`, `scale`, `rotate`; the individual CSS properties compose with `transform`) | `top`/`left`/`margin`, `width`/`height` | Compositor-only: no layout, usually no paint |
| `opacity` | `visibility` toggles mid-animation, `display` changes | Compositor-only; for appearing elements use `@starting-style` |
| Opacity of a pseudo-element carrying the shadow | `box-shadow` | Shadows repaint every frame |
| `clip-path` (inset, circle) | Animated `height` masks | Usually cheap; verify in the target browsers |
| `grid-template-rows: 0fr → 1fr`, FLIP | `height: auto` | Disclosure without per-frame layout |
| `filter: blur()` on small elements only | Blur on large areas | Large blurs repaint the area each frame |

Individual transform properties (`translate`, `scale`, `rotate`) let two features animate different parts of a
transform without overwriting each other (hover scale on the element, entrance translate from a sequence) — still
one owner per property.

## 2. `will-change`

- Libraries promote during their animations (WAAPI, Motion and GSAP transform animations); you rarely need it.
- Add it just before a heavy, repeated interaction (a drag start) and remove it at the end; never in base styles,
  never on many elements.
- `will-change: transform` (or a `transform`) on an ancestor makes it the containing block for fixed descendants:
  pinned and fixed layers break.

## 3. Layout and the main thread

- Measure once, then write: read every rect, then set every style (`flip()` and the scroll recipes batch this way).
- Do not read layout inside scroll or pointer handlers; store the latest event value and process it in one
  `requestAnimationFrame` (`useScrollProgress`, `useRafLoop`).
- Feedback first: paint the pressed or selected state within a frame, then do the expensive work (data fetch,
  big re-render) — yield with `requestAnimationFrame` followed by a task, or `scheduler.yield()` where available.
- No React state per animation frame. Write to refs, styles, CSS custom properties or motion values; set state
  only when something discrete changes (the active step).
- Text splitting multiplies elements: split into words or lines, not characters, unless the effect needs it, and
  keep one accessible copy (`split-line-reveal` uses `aria-label` plus hidden pieces).

## 4. Concurrency and scale

- Respect the profile's `maxConcurrent` (1 / 3 / 6): independent motions compete for attention and frame time.
- Stagger instead of starting thirty animations at once; cap staggered items (design file `stagger.maxItems`).
- Off-screen and hidden-tab motion stops: `useRafLoop` pauses itself; CSS animations of off-screen elements still
  cost style work in some engines — pause long loops with `animation-play-state` from an `IntersectionObserver`.
- Prefer one loop that updates many elements over one loop per element.

## 5. Measuring

| Tool | Tells you | Limits |
|---|---|---|
| DevTools Performance panel (with CPU throttling) | Frame timeline, long tasks, layout and paint per frame, layer count | Your machine; throttling approximates, it does not emulate a phone GPU |
| `document.getAnimations()` | Running CSS/WAAPI animations, their targets and timing | Not GSAP or rAF-driven motion |
| `PerformanceObserver` with `long-animation-frame` (where supported) | Frames delayed by scripts, with attribution | Engine support varies: feature-detect |
| `maquettekit review run` → `motion-summary` | Animation counts, durations, infinite animations, animated properties with layout-property hints, rAF cadence | Headless software rendering: cadence is not device performance |
| `maquettekit review run` → `reduced-motion` | Animations still running and pixel change under reduced motion | Canvas and video may legitimately change |
| A real mid-range phone | Whether it actually feels smooth | Needs a device; say when you had none |

Report numbers with the tool, viewport, throttling and build mode (development builds are slower); never claim
"60 fps" from a headless run.

## 6. Checklist

- [ ] Loops and scroll-linked effects animate only compositor properties; exceptions are stated.
- [ ] No layout reads in event handlers; reads and writes batched in rAF.
- [ ] No per-frame React state; no `will-change` left on elements at rest.
- [ ] Concurrency within the profile; off-screen loops paused.
- [ ] Measurements labelled with their conditions; device testing reported as done or not done.
