# Scroll — linked progress, CSS timelines, ScrollTrigger

Scroll is the user's. Scroll-linked motion may follow it, never steer it: native speed and direction, no hidden
wheel handlers, every pinned passage leavable by continuing to scroll. The narrative side of scroll (beats,
pacing, chapter length) belongs to studio-cinematic's `references/scroll-choreography.md`; this file is the
mechanics.

## 1. Choose the mechanism

| Effect | First choice | Fallback / escalate |
|---|---|---|
| Progress bar, fade or scale tied to scroll position | CSS `animation-timeline` in `@supports` | `useScrollProgress` |
| Element reveals once when it enters | `useInView` + `createSequence`, or CSS `view()` with `animation-range: entry` | — |
| Value fed to a canvas or a JS effect | `useScrollProgress` → ref → apply in rAF | GSAP ScrollTrigger when tracks multiply |
| Pinned section with a scrubbed, multi-track timeline, snapping | CSS `position: sticky` + GSAP ScrollTrigger `scrub` | — |
| Horizontal passage driven by vertical scroll | Sticky + ScrollTrigger (`horizontal-scroll-gallery`) | Native horizontal overflow with scroll-snap (its reduced form) |

## 2. `useScrollProgress(target, onProgress, opts)`

```
useScrollProgress(targetRef, (p) => …, { container?: RefObject<HTMLElement>, mode?: 'through' | 'contain', enabled?: boolean })
```

- `through` (default): 0 when the target's top reaches the bottom of the scrollport, 1 when its bottom reaches
  the top. `contain`: maps the travel of a tall section across a sticky child (0 when its top reaches the top of
  the scrollport, 1 when its bottom reaches the bottom) — the pinned-scene mode.
- The scroller is `container` or the nearest scrolling ancestor, else the window. Listeners are passive; work is
  batched into one `requestAnimationFrame`; the callback fires only when progress changes by more than 0.0005.
- The callback receives a number, not React state: write styles or refs directly, and set state only when a
  discrete thing changes (the active chapter).
- `enabled: false` (reduced motion) detaches everything.

```tsx
'use client';
import { useRef } from 'react';
import { useScrollProgress, useStudioMotion } from './motion';

export function ChapterRail({ chapters }: { chapters: string[] }) {
  const section = useRef<HTMLElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const { reduced } = useStudioMotion();
  useScrollProgress(section, (p) => {
    bar.current?.style.setProperty('transform', `scaleX(${p})`); // compositor-only write, no re-render
  }, { mode: 'contain', enabled: !reduced });
  return (
    <section ref={section} style={{ height: reduced ? 'auto' : `${chapters.length * 100}vh` }}>
      <div style={{ position: reduced ? 'static' : 'sticky', top: 0 }}>
        <span ref={bar} aria-hidden="true" style={{ display: 'block', height: 3, transformOrigin: '0 50%', background: 'var(--mk-signal, currentColor)' }} />
        {chapters.map((c) => <h3 key={c}>{c}</h3>)}
      </div>
    </section>
  );
}
```

Reading layout in the callback is fine (it runs inside one rAF): read every rect first, then write every style
(`scroll-progress-rail` does exactly this in its fallback driver).

## 3. GSAP ScrollTrigger rules

- **Trigger the timeline**, not child tweens: `gsap.timeline({ scrollTrigger: { … } })`. `scrub` and
  `toggleActions` are alternatives (scrub wins); `ease: 'none'` on scrubbed tracks so scroll distance maps
  linearly.
- **Pin with CSS** where possible: a tall track with a `position: sticky` child, the trigger on the track with
  `start: 'top top', end: 'bottom bottom'`. Both scroll recipes do this; GSAP's `pin` adds spacers and reparenting
  that interact badly with transforms and fixed elements.
- **Never animate the pinned element itself**; animate its children.
- **Refresh** after anything that changes layout: fonts loaded (`document.fonts.ready.then(() =>
  ScrollTrigger.refresh())`), images, async content, and container resizes that are not window resizes
  (the recipes observe the scroller with a `ResizeObserver` and call `refresh()`).
- **Custom scrollers**: pass `scroller` (the recipes scroll inside a container); smooth-scroll libraries need
  their own integration — and are usually not worth it (§5).
- **Snap** to labels or an array of progress points with a short duration and `inertia: false`; snapping must
  not fight a user who keeps scrolling.
- `invalidateOnRefresh: true` when start values depend on layout; create triggers in page order or set
  `refreshPriority`.
- Kill with the context: `useGSAP({ scope, dependencies, revertOnUpdate: true })`.
- `markers` only while developing; never committed.
- Avoid `ScrollTrigger.normalizeScroll()` on ordinary pages: it takes over touch scrolling.

## 4. Pinning pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| Sticky child does not stick | An ancestor has `overflow: hidden/auto/clip` or a fixed height | Use `overflow: clip` only where needed, keep the ancestor chain free; or move the scroller |
| `position: fixed` element scrolls with the page | An ancestor has `transform`, `filter` or `will-change: transform` | Keep transforms off ancestors of fixed or sticky layers |
| Jump at pin start or end | Pin spacing mismatch, late font/image load | CSS sticky; `refresh()` after load |
| Content hidden under a pinned layer while tabbing | Pinned layer covers the focused element (WCAG 2.4.11) | `scroll-margin`/`scroll-padding`, keep pinned layers short, test with Tab |
| Section feels endless | Too much scroll per beat | About three viewport heights per pinned passage at most, a visible progress cue, a skip link |
| Jank on phones | Heavy paint per scroll frame, layout reads in handlers | Compositor properties only; rAF batching; fewer layers |

## 5. Mobile and no scroll-jacking

- The mobile address bar resizes the viewport while scrolling: size pinned stages with `dvh`/`svh` and avoid
  re-measuring on every resize (`ScrollTrigger.config({ ignoreMobileResize: true })` when GSAP is used).
- Momentum scrolling delivers fast, coarse updates: scrubbed motion with a short `scrub` smoothing (0.3–0.8 s)
  reads better than exact coupling; never add smoothing that keeps moving long after the finger stops.
- Do not replace native scroll with a smooth-scroll library unless the project already ships one and the user has a
  way to turn it off; never `preventDefault()` wheel or touch to drive your own scroll position.
- Long pinned sequences offer a skip link to the next section and section buttons that scroll there.
- Test at 390 px with touch emulation, then on a real phone.

## 6. Reduced motion

No pinning, no scrubbing, no parallax: sections lay out as ordinary stacked content (`scroll-pin-chapters`), a
horizontal passage becomes native horizontal overflow with scroll-snap (`horizontal-scroll-gallery`), and
scroll-driven cameras become step buttons (`scroll-camera-dolly`). Feedback that only reports position (a progress
rail) may stay; say so in the motion note.

## 7. Checklist

- [ ] The lightest mechanism from §1; CSS timelines detected with `@supports` and a complete static default.
- [ ] Scroll handlers are passive and rAF-batched; no React state per scroll frame.
- [ ] ScrollTriggers sit on timelines, pin via sticky, refresh after layout changes, die with their context.
- [ ] Every pinned passage is short, shows progress, can be skipped and can be left by scrolling.
- [ ] Reduced motion produces a plain, readable document.
