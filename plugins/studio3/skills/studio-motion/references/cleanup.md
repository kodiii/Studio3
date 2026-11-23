# Cleanup — nothing survives unmount

Leaked animations are bugs users feel: a ScrollTrigger from the previous route pins the wrong section, a rAF loop
drains the battery, a listener fires on a detached node. Every recipe in the library releases everything it
creates (`docs/LIBRARY-CONTRACT.md` rule 5). Projects must do the same.

## 1. Per-technology checklist

| Created | Release with | Notes |
|---|---|---|
| CSS transition/animation | Nothing (removing the element ends it) | Remove `transitionend`/`animationend` listeners you added |
| WAAPI `el.animate()` | `animation.cancel()` | `fill: 'forwards'/'both'` holds styles until cancelled; `finished` rejects on cancel: catch it |
| `createSequence` | `seq.cancel()` | `play()` then resolves `false`; check it before touching the DOM |
| `flip()` | `cancel()` each returned animation | Keep them in a set (as `flip-grid-reorder` does) |
| `viewTransition()` | — | Do not start a new state change from a stale transition's promise |
| Motion components | Automatic | `AnimatePresence` keeps exiting nodes until their exit finishes |
| Motion `animate()` / `useAnimate` | `controls.stop()`; `useAnimate` stops scoped animations on unmount | Subscriptions from `motionValue.on()` return an unsubscribe |
| GSAP in React | `useGSAP({ scope })` reverts its context on unmount | Handlers that animate later: wrap in `contextSafe`, remove their listeners in the cleanup |
| GSAP elsewhere | `gsap.context(fn, scope)` + `ctx.revert()`; `mm.revert()` for `gsap.matchMedia()` | `revert()` kills tweens and ScrollTriggers and removes inline styles |
| ScrollTrigger | Reverted with its context; or `trigger.kill()` | Also disconnect ResizeObservers that call `refresh()` |
| `gsap.ticker.add(fn)` | `gsap.ticker.remove(fn)` | Not part of a context |
| `IntersectionObserver`, `ResizeObserver`, `MutationObserver` | `disconnect()` | |
| `addEventListener` | `removeEventListener` with the same `capture` flag, or an `AbortController` signal | Passive flags do not need to match; capture does |
| `matchMedia(…).addEventListener('change', …)` | `removeEventListener` | |
| `setTimeout`/`setInterval` | `clearTimeout`/`clearInterval` | |
| `requestAnimationFrame` | `cancelAnimationFrame`; prefer `useRafLoop` | `useRafLoop` also pauses off-screen and in hidden tabs |
| D3 transitions | `selection.interrupt()` | |
| three.js resources | `studio-3d` `references/lifecycle.md` | GPU memory is not garbage-collected |

`createCleanup()` collects disposers and runs them in reverse order, continuing past one that throws.

```tsx
'use client';
import { useEffect, useRef } from 'react';
import { createCleanup, createSequence, useStudioMotion } from './motion';

export function RevealOnView({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { reduced } = useStudioMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cleanup = createCleanup();
    const seq = createSequence({ reducedMotion: reduced }).add(el, [{ opacity: 0 }, { opacity: 1 }], { easing: 'linear' });
    cleanup.add(() => seq.cancel());
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { void seq.play(); io.disconnect(); } }, { threshold: 0.2 });
    io.observe(el);
    cleanup.add(() => io.disconnect());
    const controller = new AbortController();
    window.addEventListener('beforeprint', () => seq.finish(), { signal: controller.signal });
    cleanup.add(() => controller.abort());
    return cleanup.run;
  }, [reduced]);
  return <div ref={ref}>{children}</div>;
}
```

## 2. StrictMode

In development React mounts, cleans up and re-runs every effect of a new component. Correct cleanup passes; a
missing one doubles listeners, triggers and loops.

- Create in the effect, release in its cleanup. Do not create animations during render.
- `useGSAP` handles StrictMode; a manual `gsap.context` must be reverted in the cleanup you return.
- `createSequence` in `useIsomorphicLayoutEffect` with `return () => seq.cancel()` is the recipe pattern.
- Guard promise continuations: after `await seq.play()`, the component may be gone; check the resolved value or an
  "alive" flag before setting state.
- The repository's e2e suite serves a production build, where effects run once: StrictMode problems only show in
  `npm run dev` and in the unit test below.

## 3. How the repository exercises cleanup

| Check | What it does |
|---|---|
| Gallery **Replay** (`/effects/<id>`) | Changes a `key`, so the recipe fully unmounts and remounts; leaks show as duplicated motion or console errors |
| `tests/e2e/effects.spec.ts` | Per recipe: mount, Replay three times, no `[data-effect-error]`, no console errors or failed requests, axe; separately reduced motion and a 390 px container |
| `tests/unit/library/render-cleanup.test.tsx` | Mounts every non-WebGL recipe in StrictMode in jsdom, re-mounts and unmounts it, and fails if any listener, rAF loop, timer or observer created by library code is still alive (attributed by creation stack); GSAP recipes must leave no live tweens or ScrollTriggers |
| Visual Director `3d-cleanup` | For canvases: navigates away and back and checks re-initialisation |

Run them in a Studio³ checkout with `npm run test:unit` and `npm run test:e2e -- --grep "<id>"`.

Testing GSAP in Vitest or Jest: `@gsap/react`'s `main` entry is a CommonJS build that `require()`s its own copy of
`gsap`, while application code imports the ESM `gsap`. Under Node resolution `useGSAP`'s context then never sees
the component's tweens and ScrollTriggers, and unmount appears to leak them. Bundlers (Next.js, Vite) use the
package's ESM `module` entry, so production is unaffected. In tests alias `@gsap/react` to
`node_modules/@gsap/react/src/index.js` (the repository's `vitest.config.ts` does this).

## 4. Manual remount test

1. Open the page with DevTools; note `document.getAnimations().length` and, for GSAP,
   `ScrollTrigger.getAll().length`.
2. Navigate away and back (or Replay) three times.
3. The counts return to their earlier values; scrolling shows one set of triggers; the console is clean.
4. In the Performance panel, an idle page shows no recurring animation frames from your code.

## 5. Checklist

- [ ] Every row of §1 that the code uses has its release in a cleanup.
- [ ] Event-time animations (clicks, keys) are inside `contextSafe` or tracked and cancelled.
- [ ] Promise continuations check that the animation finished and the component is alive.
- [ ] Remount three times: no duplicated motion, triggers or listeners; no console errors.
- [ ] StrictMode in development behaves like production.
