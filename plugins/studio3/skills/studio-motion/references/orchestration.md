# Orchestration — sequences, stagger, shared elements, interruption

Choreography is the order in which things change. Lead with what the user caused, follow with what depends on
it, and finish before the user needs the next thing. The Motion Lab orchestrator (`orchestrator.ts`) does this on
the Web Animations API with no dependency.

## 1. `createSequence(opts)`

`createSequence({ reducedMotion?, durationScale? }) → Sequence`

| Method | Behaviour |
|---|---|
| `add(targets, keyframes, { duration, easing, at, stagger, fill })` | One step for an element, a list or a `NodeList` (null is ignored). `duration` default `base` (240) × `durationScale`; `easing` a token, bezier array or any CSS easing (default `standard`); `fill` default `'both'` |
| `at` | Absolute ms (`120`), a label name (`'body'`), relative to the previous step's end (`'+=80'`, `'-=120'`), or `'<'` (start of the previous step). Omitted: after the previous step. Unknown label: after the previous step |
| `stagger` | Per-target delay in ms (parent → child order is DOM order) |
| `label(name, at?)` | Name a position for later steps |
| `call(fn, at?)` | Run code at a position while playing forward; `finish()` runs pending calls |
| `play()` | Start or restart; resolves `true` when finished, `false` when interrupted |
| `reverse()` | Play backwards from the current position (calls do not fire) |
| `pause()`, `seek(progress)` | Pause; scrub to 0–1 of `totalDuration` (pauses) |
| `finish()` | Jump to the end state and keep it |
| `cancel()` | Remove every effect: elements return to their CSS state; a pending `play()` resolves `false` |
| `totalDuration`, `playState` | ms; `'idle' \| 'running' \| 'paused' \| 'finished'` |

Facts that shape how you use it:

- Targets are captured at `add()` time; WAAPI animations are created on the first `play()`/`seek()`/`finish()`.
  Rebuild the sequence when the elements change (an effect keyed on the data).
- `reducedMotion: true` collapses every step to 0.01 ms at time 0: the sequence lands on its end state
  immediately. Write keyframes whose end state is the correct reduced-motion state (usually: visible, in place).
- `fill: 'both'` holds the end values while the sequence lives. On unmount call `cancel()`; the element then shows
  its CSS state, so the CSS state must be the resting, visible one.

## 2. Entrance choreography

```tsx
'use client';
import { useRef } from 'react';
import { createSequence, distance, duration, stagger, useIsomorphicLayoutEffect, useStudioMotion } from './motion';

export function FeatureIntro({ items }: { items: string[] }) {
  const root = useRef<HTMLElement>(null);
  const { reduced, scale } = useStudioMotion();
  useIsomorphicLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const rise = distance.short * scale.distance;
    const seq = createSequence({ reducedMotion: reduced, durationScale: scale.duration })
      .add(el.querySelector('[data-intro-lede]'), [{ opacity: 0 }, { opacity: 1 }], { duration: duration.base, easing: 'linear' })
      .label('list', '-=120')
      .add(el.querySelectorAll('[data-intro-item]'), [{ opacity: 0, transform: `translateY(${rise}px)` }, { opacity: 1, transform: 'none' }],
        { at: 'list', duration: duration.base, easing: 'enter', stagger: stagger.base * scale.stagger })
      .add(el.querySelector('[data-intro-cta]'), [{ opacity: 0 }, { opacity: 1 }], { at: '+=40', duration: duration.fast, easing: 'linear' });
    void seq.play();
    return () => seq.cancel();
  }, [items, reduced, scale.duration, scale.distance, scale.stagger]);
  return (
    <section ref={root}>
      <h2>What it does</h2>{/* the headline is never hidden by script: it may be the LCP element */}
      <p data-intro-lede>Three things, in the order you will use them.</p>
      <ul>{items.map((t) => <li key={t} data-intro-item>{t}</li>)}</ul>
      <a data-intro-cta href="#start">Start</a>
    </section>
  );
}
```

- Run entrance sequences in a layout effect so the first paint already has the start state, and never hide the
  largest above-the-fold element behind script (shared `performance.md` §2).
- One orchestrated entrance above the fold; elsewhere reveal on view (`useInView`) once, never re-triggering.
- Parent before children: container fades, then items stagger; total stagger within the design file's
  `maxTotalMs` (or about 400 ms on Expressive).
- Respect `scale.maxConcurrent`: a staggered list counts as one motion; a list, a counter and a background drift
  are three.

## 3. Exit choreography and interruption

Exits are faster (about 70 % of the entrance), use `exit`, and never delay what comes next. To interrupt an
entrance without a jump, build the exit from **single-keyframe** steps: WAAPI fills the missing start keyframe
from the current underlying value, which includes the still-running entrance.

```ts
import { createSequence, duration, type Sequence } from './motion';

/** Close a panel from wherever its entrance currently is, then hide it. */
export function closePanel(panel: HTMLElement, backdrop: HTMLElement, reduced: boolean, enter: Sequence | null): Promise<void> {
  const exit = createSequence({ reducedMotion: reduced })
    .add(panel, [{ opacity: 0, transform: 'translateY(-6px) scale(0.985)' }], { duration: duration.fast, easing: 'exit' })
    .add(backdrop, [{ opacity: 0 }], { duration: duration.base, easing: 'linear', at: 0 });
  return exit.play().then((finished) => {
    if (!finished) return;  // interrupted by a new open: leave the DOM alone
    enter?.cancel();        // drop the entrance's held end state
    exit.cancel();
    panel.hidden = true;
  });
}
```

The `command-menu-reveal` recipe uses this pattern for its dialog. Rules: every animation can be reversed or
retargeted mid-way; a new trigger replaces the old animation instead of queuing behind it; controls stay operable
during transitions.

## 4. Stagger helpers

`staggerDelay(i, count, each, from = 'start' | 'center' | 'end')` gives per-item delays for hand-built WAAPI or
CSS (`style={{ transitionDelay: `${staggerDelay(i, n, stagger.tight, 'center')}ms` }}`). Centre-out reads as
"emerging"; end-first suits lists leaving upward. Multiply `each` by `scale.stagger` (0 under reduced motion).

## 5. Shared elements and layout changes: `flip()`

`flip(elements, mutate, { duration = moderate, easing = 'emphasized', stagger, reducedMotion }) → Animation[]`
measures each element (First), runs `mutate()` synchronously, measures again (Last) and animates the difference
with `translate` + `scale` from `transform-origin: 0 0`. Elements with no size or no change are skipped. Under
reduced motion it only runs `mutate()`.

In React the mutation must reach the DOM inside `mutate`, so wrap the state update in `flushSync`:

```tsx
'use client';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { duration as D, flip, useStudioMotion } from './motion';

export function SortableList({ initial }: { initial: string[] }) {
  const [items, setItems] = useState(initial);
  const list = useRef<HTMLUListElement>(null);
  const running = useRef<Animation[]>([]);
  const { reduced, scale } = useStudioMotion();
  const reorder = (next: string[]) => {
    const els = Array.from(list.current?.querySelectorAll<HTMLElement>('[data-item]') ?? []);
    running.current = flip(els, () => {
      for (const a of running.current) a.cancel(); // measure Last without in-flight transforms
      flushSync(() => setItems(next));
    }, { reducedMotion: reduced, duration: D.moderate * scale.duration });
  };
  return (
    <>
      <button type="button" onClick={() => reorder([...items].sort())}>Sort A–Z</button>
      <ul ref={list}>{items.map((t) => <li key={t} data-item>{t}</li>)}</ul>
    </>
  );
}
```

- Cancel in-flight FLIP animations inside `mutate` (as above, and as `flip-grid-reorder` does), so a rapid second
  reorder starts from where items visually are.
- `scale()` distorts text and borders when sizes change; for size changes prefer Motion `layout` (which corrects
  children) or animate a wrapper while the content cross-fades.
- Elements entering or leaving are not FLIP targets: fade them separately.

## 6. Route and state transitions: `viewTransition()`

`viewTransition(update, { reducedMotion }) → Promise<void>` calls `document.startViewTransition(update)` where it
exists and motion is allowed, otherwise runs `update` immediately. Name shared elements in CSS and style the
pseudo-elements with tokens:

```css
.card-thumb { view-transition-name: var(--vt-name, none); }
::view-transition-group(*) { animation-duration: var(--s3-duration-moderate, 360ms); animation-timing-function: var(--s3-ease-emphasized, ease); }
@media (prefers-reduced-motion: reduce) { ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none; } }
```

In React, make the update synchronous (`viewTransition(() => flushSync(() => setView(next)), { reducedMotion })`)
so the browser captures the new state; each `view-transition-name` must be unique on the page at capture time.
Framework routers that start their own transitions need their own integration; do not wrap them twice.

## 7. Responsive intensity

- Distances scale with the profile and with the container: a 24 px rise on a phone card can be 12 px
  (`useElementSize` → pick `distance.short` below a width you choose).
- Fewer staggered items on narrow layouts (stagger the first row, reveal the rest together).
- Large surfaces move less far, not faster.
- The profile decides what exists at all (`experience-profiles.md` §3): no scroll reveals on Essential, one pinned
  section at most on Expressive.

## 8. One cleanup call

`createCleanup()` → `{ add(fn), run() }` runs disposers in reverse order and keeps going when one throws. Use it
when an effect creates several things (a sequence, an observer, two listeners) and return `cleanup.run`.

## 9. Checklist

- [ ] Each sequence has one trigger, one owner and a `cancel()` on unmount.
- [ ] Keyframes end in the correct reduced-motion state; reduced mode verified to land there instantly.
- [ ] Exits are shorter than entrances and interruptible without a jump.
- [ ] FLIP mutations are synchronous; in-flight animations are cancelled before measuring Last.
- [ ] Concurrency within the profile's `maxConcurrent`; stagger totals within the design limit.
