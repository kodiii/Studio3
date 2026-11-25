# Performance — budgets, animation cost and honest measurement

> **Quick card** — the must-dos from this file; read on for the reasons and the detail.
>
> - Never hide the LCP element behind JavaScript, and never lazy-load the LCP image.
> - Reserve space for late content: `width`/`height` or `aspect-ratio` on media, min-heights on async regions.
> - Animate only compositor properties (`transform`, `opacity`) in loops and scroll-linked effects; note any exception.
> - Never put `will-change` in base styles; add it just before animating and remove it after.
> - Batch layout reads before writes, and pause every rAF loop off-screen or in a hidden tab.
> - Code-split and lazy-load heavy features: charts, 3D, editors.
> - Use one WebGL canvas per view, never one per card; render on demand and ship a non-WebGL fallback.
> - Never invent a number or present a target as a result; state tool, viewport, throttling, build mode and run count.

Performance is a design material: a slow interaction is a bad interaction however it looks. This file holds
the cross-specialty rules. 3D specifics live in the `studio-3d` skill; data-rendering specifics in
`studio-data`'s `references/performance.md`.

## 1. Budgets are project-specific

There is no universal bundle size or frame time that makes a project "fast". Set a budget per project from
what it must do and who uses it, write it down in the brief, and measure against it.

| Decide | From | Example starting point (adjust, do not quote as a standard) |
|---|---|---|
| Target devices and network | Audience in the brief | Mid-range Android on 4G for consumer social; desktop on office broadband for an internal dashboard |
| Critical-path weight | What must appear for first meaningful view | HTML + critical CSS + one hero image; everything else deferred |
| Interaction budget | Most frequent interaction | Feedback painted within one or two frames of input; the full response inside the INP target |
| Animation budget | Experience profile (`experience-profiles.md`) | Essential: 1 concurrent animation; Expressive: about 3; Immersive: about 6 |
| 3D budget | Whether 3D is justified at all | One canvas, lazy-loaded, capped DPR, static fallback |

When the project already has budgets (Lighthouse CI config, bundle-size checks, performance tests), those win.

## 2. Core Web Vitals

Field targets, assessed at the 75th percentile of page loads, are the published "good" thresholds:

| Metric | Good | Needs improvement | Poor | What usually breaks it in Maquettekit work |
|---|---|---|---|---|
| LCP (Largest Contentful Paint) | ≤ 2.5 s | ≤ 4.0 s | > 4.0 s | Hero image lazy-loaded or undiscoverable; hero text hidden until fonts or JS run; entrance animation starting from `opacity: 0` on the LCP element |
| INP (Interaction to Next Paint) | ≤ 200 ms | ≤ 500 ms | > 500 ms | Heavy handlers, synchronous layout in pointer handlers, big re-renders on every keystroke, main-thread chart redraws |
| CLS (Cumulative Layout Shift) | ≤ 0.1 | ≤ 0.25 | > 0.25 | Images without dimensions, late font swap, content injected above the fold, height animations |

Rules that follow directly:

- **Never hide the LCP element behind JavaScript.** If the headline animates in, its initial hidden state must
  be applied by the same script that will reveal it (or by CSS that also contains the animation), so a
  failed or slow script leaves text visible. Prefer a reveal that starts from visible (mask, clip, transform).
- **Reserve space** for everything that loads late: `width`/`height` or `aspect-ratio` on media, min-heights on
  async regions, skeletons the same size as the content.
- **Yield in long handlers.** Paint feedback first, then do the work (`requestAnimationFrame` followed by a
  task, `scheduler.yield()` where available, or a worker).

## 3. Animation performance

### Properties
| Tier | Properties | Cost | Use |
|---|---|---|---|
| Compositor | `transform`, `opacity` (also `filter`, `clip-path` in many engines, with caveats) | No layout, usually no paint | Default for everything |
| Paint | `background-color`, `color`, `box-shadow`, `border-color`, `filter: blur()` on large areas | Repaint each frame | Small elements, short durations |
| Layout | `width`, `height`, `top`/`left`, `margin`, `padding`, `font-size`, `grid-template-*` | Layout + paint each frame, may cascade | Avoid; use FLIP, `scale`, or accept an instant change |

- Animating height: prefer a FLIP/transform technique, the `grid-template-rows: 0fr → 1fr` pattern for simple
  disclosure, or `interpolate-size`/`calc-size()` where the project's browser targets support them (verify).
- A compositor animation can still be janky if the layer is huge or its content repaints. Check in the
  browser's performance tools instead of assuming.

### `will-change` discipline
- Do not put `will-change` in base styles. Apply it shortly before an animation starts and remove it after;
  animation libraries generally do this for you.
- Each promoted layer costs GPU memory proportional to its pixel area times DPR². A page of promoted cards on a
  phone can exhaust memory and become slower.
- Never `will-change: transform` on an ancestor of fixed-position children you rely on: it creates a
  containing block and breaks `position: fixed`.

### Layout thrash
Reading layout (`getBoundingClientRect`, `offsetWidth`, `scrollTop`, `getComputedStyle`) after writing styles
forces synchronous layout. In a loop it is quadratic.

```ts
// Wrong: read/write interleaved per item
items.forEach((el) => { el.style.height = `${el.scrollHeight}px`; });

// Right: batch all reads, then all writes
const heights = items.map((el) => el.scrollHeight);
items.forEach((el, i) => { el.style.height = `${heights[i]}px`; });
```

- Scroll and pointer handlers are passive and do no layout reads directly; store the latest value and consume
  it in one `requestAnimationFrame` callback.
- Use `IntersectionObserver` for visibility and `ResizeObserver` for size instead of polling.
- Every rAF loop pauses when its element is off-screen or the tab is hidden. Library recipes use `useRafLoop`.
- Limit simultaneous animations to the profile's `maxConcurrent`; stagger instead of starting 30 at once.

### Scroll-linked work
- Prefer CSS scroll-driven animations where supported: they can run off the main thread for compositor
  properties. Detect with `@supports (animation-timeline: view())` and provide a static fallback.
- With JS scroll libraries, animate transforms of children, not the layout of pinned containers, and refresh
  measurements after fonts and images load (details in studio-cinematic's `references/scroll-choreography.md`).

## 4. Loading strategy

- **Code.** Split by route, and by interaction for heavy features: charts below the fold, editors, 3D,
  confetti. In React use `lazy()`/dynamic import behind a visibility or intent trigger. In Next.js, components
  that touch `window` or WebGL are client components loaded dynamically with server rendering disabled.
- **Fonts.** Self-host WOFF2, subset to the scripts you need, prefer one variable file over many static
  weights when you use three or more. `font-display: swap` for text faces, `optional` when layout shift
  matters more than the brand face. Preload only the one or two files used above the fold. Add `size-adjust` /
  `ascent-override` fallback metrics to limit shift.
- **Images.** AVIF or WebP with a fallback where the project supports them; `srcset` + `sizes`; explicit
  dimensions; `loading="lazy"` and `decoding="async"` below the fold; `fetchpriority="high"` on the LCP image
  and never lazy-load it.
- **Video.** `preload="none"` or `metadata` with a poster; muted, `playsinline`, no autoplay under reduced
  motion or data-saver; pause when off-screen.
- **Third parties.** Each one is a budget line. Load after interaction or idle where possible.

## 5. The JavaScript cost of animation libraries

Do not quote bundle sizes from memory: they change with versions, tree-shaking and which features you import.
Decide like this:

1. **Can CSS or the Web Animations API do it?** Hover, press, enter/exit of a single element, simple
   scroll-linked effects, View Transitions. Cost: zero bytes. Start here.
2. **Is one of the libraries already in the project?** Use it rather than adding a second. Two animation
   runtimes for one page is almost never justified.
3. **Does the feature need what the library is uniquely good at?** Motion: React state-driven presence, layout
   and shared-element animation, gestures with springs. GSAP + ScrollTrigger: scrubbed scroll timelines,
   pinning, long sequenced timelines. If not, go back to step 1.
4. **Measure the real cost** in this project: build before and after, compare the route's JS in the bundler's
   report, and record the delta in your summary as a measured number with the tool that produced it.
5. **Defer it** if it is not needed for first paint: dynamically import the animated section.

Licensing is part of the decision: GSAP is free to use under GreenSock's standard no-charge licence, which is
not an open-source (MIT) licence. Say so if the project has licence constraints.

## 6. 3D performance — summary only

Full guidance is in `studio-3d`. The rules every specialty must respect when it asks for 3D:

| Rule | Why |
|---|---|
| One WebGL canvas per view; never one per card or feed item | Browsers cap live contexts; each has fixed memory and compile cost |
| Lazy: load three.js and assets only when the canvas approaches the viewport or the user asks | Keeps 3D off the critical path; poster first |
| Cap device pixel ratio (commonly to about 1.5–2; lower on weak GPUs) | Fragment cost scales with DPR² |
| Render on demand (`frameloop="demand"`) unless something is actually animating; pause off-screen | A static scene should cost zero frames |
| Watch draw calls and triangles; merge, instance, share materials | CPU-side overhead dominates on mobile |
| Budget texture memory; use compressed textures and sensible resolution | GPU memory is the usual mobile crash cause |
| Dispose geometries, materials, textures and render targets on unmount | WebGL resources are not garbage-collected with JS objects |
| Always ship a non-WebGL fallback and handle context loss | Some users will never get a context |

Assets go through `maquettekit assets` (delegated to `studio-asset-optimizer`) before they are referenced.

## 7. Measurement honesty

- **Lab is not field.** A local run tells you about one machine, one network profile, one cold or warm cache.
  Core Web Vitals "good" status is a field statement about real users at the 75th percentile. Report lab
  numbers as lab numbers.
- **Headless browsers with software rendering are not representative** of real GPU performance. Frame rates,
  shader compile times and WebGL timings from such an environment say almost nothing about a user's device.
  Use them to detect regressions and errors (did it render, how many draw calls, did the context survive),
  not to claim "60 fps".
- **INP needs interaction.** A load-only run produces no INP. Either script interactions or say it was not
  measured.
- **State conditions** with every number: tool, viewport, throttling, build mode (development builds are
  slower and larger), run count.
- **Never invent a number**, and never present a target as a result. "Target: LCP ≤ 2.5 s. Measured: not run
  (no browser available)" is a correct report line.

## 8. Checklist

- [ ] Budget written down for this project and derived from its audience.
- [ ] LCP element visible without JavaScript; media dimensions reserved.
- [ ] Only compositor properties animated in loops and scroll-linked effects; exceptions noted.
- [ ] No `will-change` in static CSS; no interleaved layout reads/writes.
- [ ] Heavy features (charts, 3D, editors) code-split and lazy.
- [ ] Off-screen and hidden-tab work paused.
- [ ] Numbers in the report are labelled measured/estimated, lab/field, with conditions.
