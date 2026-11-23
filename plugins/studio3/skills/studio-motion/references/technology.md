# Technology — the ladder in practice, Motion and GSAP essentials

The decision ladder and the "need → rung" table live in `${CLAUDE_PLUGIN_ROOT}/shared/technology-selection.md`
§1 (fallback `../../../shared/technology-selection.md` from this file). This file holds the details you need once
a rung is chosen. Versions verified in the Studio³ repository: `motion` 14.14, `gsap` 3.15, `@gsap/react` 2.1.
Check the installed version (`package.json` of the package) before relying on anything newer.

## 1. Concrete criteria per rung

| Question | If yes |
|---|---|
| Is the state already a class, attribute, `:hover`, `:focus-visible`, `[aria-expanded]`, `:checked`? | CSS transition on that selector |
| Does an element appear in the DOM and should animate in? | CSS `@starting-style` (plus `transition-behavior: allow-discrete` for `display`/`overlay`), or WAAPI |
| Do several elements need order, overlap, labels, stagger, reverse or scrubbing? | `createSequence` |
| Does an element move or resize because layout changed? | `flip()`; Motion `layout` in React when many components or exits are involved |
| Must an element animate out before React removes it? | Motion `AnimatePresence` (React), or keep it mounted until a WAAPI exit finishes |
| Does motion follow a gesture and keep its velocity? | Motion (`drag`, springs) |
| Is it a scrubbed, multi-track, pinned scroll scene? | GSAP ScrollTrigger |
| Is it an object in 3D space? | `studio-3d` |

## 2. CSS scroll-driven animations

```css
.reading-progress { transform-origin: 0 50%; transform: scaleX(1); }           /* static default: complete */
@supports (animation-timeline: scroll()) {
  .reading-progress { animation: grow linear both; animation-timeline: scroll(root block); }
}
@keyframes grow { from { transform: scaleX(0); } }
@media (prefers-reduced-motion: reduce) { .reading-progress { animation: none; } }  /* feedback may stay; decide per tier */
```

- Timelines: `scroll(<scroller> <axis>)` follows a scroll container; `view()` follows an element through its
  scrollport, with `animation-range` (`entry`, `exit`, `contain`, `cover` and percentages) to pick the window.
  Named timelines (`view-timeline-name`, `scroll-timeline-name`) plus `timeline-scope` let another element use them.
- Support varies by engine and version: feature-detect, never sniff. CSS: `@supports (animation-timeline: …)`.
  JS: `CSS.supports('animation-timeline: scroll()')` (the `scroll-progress-rail` recipe also checks
  `timeline-scope`, then falls back to `useScrollProgress`).
- The default (unsupported) state must be complete and readable; the animation is an enhancement.
- Compositor properties only; these can run off the main thread where the engine supports it.

## 3. Motion 14 essentials (`motion/react`)

| Need | API |
|---|---|
| Animate on state | `<motion.div animate={{ … }} transition={{ type: 'spring', ...spring.settle }} />`, or `{ duration: sec(duration.base), ease: easing.standard }` (bezier arrays work as `ease`) |
| Exit before unmount | `<AnimatePresence mode="sync" \| "wait" \| "popLayout">` around keyed children with `exit={{ … }}` |
| Layout and shared elements | `layout`, `layoutId` (unique per instance: prefix with `useId()` as `morphing-nav-pill` does), `LayoutGroup`; `layoutScroll` on scrolling ancestors |
| Gestures | `whileHover`, `whileTap`, `whileFocus`, `drag` with `dragConstraints`/`dragElastic`/`dragMomentum` |
| Imperative sequences | `useAnimate()` → `[scope, animate]`; scoped selectors, stopped on unmount |
| Values without re-render | `useMotionValue`, `useSpring`, `useTransform`, `useScroll`, `useMotionValueEvent` |
| Reduced motion | `<MotionConfig reducedMotion="user">` follows the OS; to honour the in-app toggle pass `reducedMotion={reduced ? 'always' : 'user'}`. With reduced motion Motion drops transform and layout animation and keeps opacity and colour |
| Outside React | `animate()`, `scroll()`, `inView()`, `stagger()` from `motion` |

```tsx
'use client';
import { useId } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { duration, easing, sec, spring, useStudioMotion } from './motion';

export function Toasts({ items, onDismiss }: { items: { id: string; text: string }[]; onDismiss: (id: string) => void }) {
  const { reduced } = useStudioMotion();
  const uid = useId();
  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>
      <ul aria-live="polite">
        <AnimatePresence initial={false} mode="popLayout">
          {items.map((t) => (
            <motion.li key={t.id} layout layoutId={`${uid}-${t.id}`}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: sec(duration.fast), ease: easing.exit } }}
              transition={{ type: 'spring', ...spring.settle }}>
              {t.text} <button type="button" onClick={() => onDismiss(t.id)}>Dismiss</button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </MotionConfig>
  );
}
```

The installed package also ships `motion/three` (`threeEffect`, binding motion values to three.js objects). The
Studio³ kit does not use it; it does not request R3F frames by itself (`3d-sync.md` §4).

## 4. GSAP essentials

- **Register once, client only**: `if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger, useGSAP)`.
  No `gsap.*` or `ScrollTrigger.*` calls during server rendering.
- **`useGSAP(callback, { scope, dependencies, revertOnUpdate })`** from `@gsap/react`: runs in a layout effect,
  records everything created in the callback in a `gsap.context`, scopes selector strings to `scope`, and reverts
  on unmount. Without `revertOnUpdate`, a dependency change runs the callback again and **adds** to the same
  context (reverted only at unmount); with `revertOnUpdate: true` it reverts before each re-run — what the
  ScrollTrigger recipes use. The callback may return a cleanup function.
- **`contextSafe`**: animations created later (click handlers) are outside the context unless wrapped:
  `const { contextSafe } = useGSAP({ scope }); const onClick = contextSafe(() => gsap.to(…))`.
- **Without the hook**: `const ctx = gsap.context(() => { … }, scopeEl); return () => ctx.revert();`.
- **`gsap.matchMedia()`**: `mm.add({ reduce: '(prefers-reduced-motion: reduce)', wide: '(min-width: 800px)' },
  (c) => { … })` runs setups per condition and reverts them when queries stop matching; `mm.revert()` on unmount.
  For an in-app reduced-motion toggle, put `reduced` in `useGSAP` dependencies (the recipes do) or call
  `gsap.matchMediaRefresh()`.
- **Pointer followers**: `gsap.quickTo(el, 'x', { duration: sec(duration.fast), ease: gsapEase.standard })`.
- **Plugins**: the installed 3.15 package ships ScrollTrigger, Flip, Observer, SplitText, MorphSVGPlugin,
  DrawSVGPlugin, CustomEase and ScrollSmoother; import from `gsap/<Name>`. Add a plugin only for a feature you use.

```tsx
'use client';
import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { distance, duration, gsapEase, sec, useStudioMotion } from './motion';

if (typeof window !== 'undefined') gsap.registerPlugin(useGSAP);

export function ShakeOnError({ invalid }: { invalid: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const { reduced } = useStudioMotion();
  const { contextSafe } = useGSAP({ scope: root });
  const shake = contextSafe(() => {
    if (reduced) return; // tier 2: the error text and colour change carry the meaning
    gsap.fromTo('[data-field]', { x: 0 }, { x: distance.nudge, duration: sec(duration.instant) / 2, ease: gsapEase.inOut, yoyo: true, repeat: 3, clearProps: 'x' });
  });
  return (
    <div ref={root}>
      <input data-field aria-invalid={invalid} onBlur={() => { if (invalid) shake(); }} />
    </div>
  );
}
```

ScrollTrigger rules are in `scroll.md` §3.

## 5. Never two owners

One element, one library. If GSAP pins and scrubs a section, Motion must not animate the same node's transform,
and no CSS transition may target the properties GSAP writes (GSAP writes inline styles every tick; a transition
on `transform` makes it lag and fight). Split into wrapper (one owner) and content (the other) when both are needed.

## 6. Licence note

`motion` is MIT. `gsap` and `@gsap/react` are distributed under GreenSock's standard "no charge" licence (their
`package.json` says so): free to use, not an open-source licence. Mention it when the project has licence
constraints, keep a CSS/WAAPI/Motion alternative in mind, and never add GSAP for an effect a lower rung handles.
