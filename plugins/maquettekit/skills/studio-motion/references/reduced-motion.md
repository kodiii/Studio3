# Reduced motion — the three-tier policy in practice

`prefers-reduced-motion: reduce` is a request to stop motion that is not needed, not a request for a broken or
silent interface. Maquettekit applies three tiers (shared `accessibility.md` §2, `docs/LIBRARY-CONTRACT.md` rule 4).
Feedback that is not motion — colour, opacity, text, focus rings — always stays.

| Tier | Covers | Under reduced motion |
|---|---|---|
| 1. Remove | Decoration: parallax, ambient loops, background shaders, hover flourishes, scroll-linked scaling, confetti, text splitting effects | Gone; the resting state is shown |
| 2. Replace | Motion that explains a state change: panel open, route change, item added, reorder, shared element | Opacity change of 200 ms or less, or instant. No translation, scale or rotation |
| 3. Keep behind a control | Motion that is the content: video, a 3D turntable, an animated chart replay, a physics playground | Never starts by itself; a visible control starts it; it can be paused |

The design generator's `motion.reducedMotion.tiers` uses the words remove/replace/keep, but its "keep" describes
essential feedback (press state, focus ring, progress, short fades) that stays. Both statements hold: feedback is
kept in every tier, and content motion goes behind a control.

## 1. Examples by category

| Category | Normal | Reduced |
|---|---|---|
| Button press | Scale 0.97 with `press` spring | Colour/shadow change only (tier 2) |
| Hover lift, tilt, magnetic pull | Transform on hover | Removed; hover shown by colour or border (tier 1) |
| Menu, popover, dialog open | Scale/translate + fade, `moderate` | 160 ms opacity fade (tier 2) |
| List entrance stagger | Staggered rise | All items appear together, at most a short fade (tier 2) |
| Reorder, filter (FLIP) | Items glide | Items jump; new items fade in (tier 2) |
| Route / view transition | Shared-element morph | Cross-fade ≤ 200 ms or instant (tier 2) |
| Scroll reveal | Rise on entering view | Visible from the start (tier 1) |
| Pinned, scrubbed chapters | Pin + scrub | Ordinary stacked sections in normal flow (tier 1) |
| Scroll progress rail | Tracks position | May stay: it is feedback the user drives, not autonomous motion (decide and state it) |
| Marquee, ticker, animated gradient | Loops | Static; or a play control if the motion is the content |
| Number ticker | Digits roll | Digits swap (tier 2) |
| Chart transition | Values tween | New state drawn instantly (tier 2); "replay" animations behind a control (tier 3) |
| Video, animated illustration | Autoplays muted | Poster; play control (tier 3) |
| 3D camera move, explode | Damped travel | Cut (tier 2); autorotate off (tier 1) |

## 2. One source of truth

- **OS setting**: `usePrefersReducedMotion()` (live, SSR-safe via `useSyncExternalStore`).
- **In-app toggle**: `<StudioMotionProvider reduced={userWantsLess || null}>`. It can only **add** reduction:
  `useStudioMotion().reduced` is `os || override === true`.
- **Every component** reads `useStudioMotion().reduced` (or `useReducedMotion()` from Motion Lab), and CSS gates
  motion with the media query. Do not read `matchMedia` ad hoc in components: the in-app toggle would be ignored.

```tsx
'use client';
import { useState, type ReactNode } from 'react';
import { StudioMotionProvider, usePrefersReducedMotion } from './motion';

export function MotionPreference({ children }: { children: ReactNode }) {
  const os = usePrefersReducedMotion();
  const [less, setLess] = useState(false);
  return (
    <StudioMotionProvider profile="expressive" reduced={less || null}>
      <label>
        <input type="checkbox" checked={os || less} disabled={os} onChange={(e) => setLess(e.target.checked)} />
        Reduce motion{os ? ' (set by your system)' : ''}
      </label>
      {children}
    </StudioMotionProvider>
  );
}
```

Persist the in-app choice (local storage or account setting) if the product offers it; the CSS media query does
not see it, so CSS-only motion also needs a class or attribute (for example `data-reduced` on the root).

## 3. CSS patterns

```css
/* Opt-in: motion exists only when the user has no preference. */
@media (prefers-reduced-motion: no-preference) {
  .card { transition: transform var(--mk-duration-base, 240ms) var(--mk-ease-standard, ease); }
  .card:hover { transform: translateY(calc(-1 * var(--mk-distance-nudge, 4px))); }
}
/* Neutralise: keep the state change, drop the travel. */
@media (prefers-reduced-motion: reduce) {
  .sheet { transition: opacity var(--mk-duration-fast, 160ms) linear; transform: none !important; }
}
/* The in-app toggle, mirrored as an attribute on the root. */
:root[data-reduced] .sheet { transition: opacity 160ms linear; transform: none !important; }
```

The design tokens CSS (`maquettekit design generate --css`) already caps durations at `maxReplacementMs` under the
media query, sets `--mk-stagger: 0ms` and `--mk-motion-scale: 0`, and adds a global rule that shortens animations
and limits transitions to opacity and colours. Do not fight it with `!important` motion of your own.

## 4. JavaScript patterns

| Technology | Reduced-motion switch |
|---|---|
| `createSequence` | `createSequence({ reducedMotion: reduced })`: lands on the end state at once |
| `flip`, `viewTransition` | `{ reducedMotion: reduced }`: mutation only / immediate update |
| WAAPI by hand | Branch: `reduced ? el.animate([{ opacity: 0 }, { opacity: 1 }], 160) : el.animate(full, timing)` |
| Motion | `MotionConfig reducedMotion={reduced ? 'always' : 'user'}`; or `transition={reduced ? { duration: 0 } : …}` |
| GSAP | Return early in `useGSAP` when `reduced` and list `reduced` in `dependencies` with `revertOnUpdate: true`; or `gsap.matchMedia()` with a `(prefers-reduced-motion: reduce)` condition plus `gsap.matchMediaRefresh()` on toggle |
| rAF loops | `useRafLoop(ref, tick, !reduced)` |
| Scroll-linked | Do not attach the listener (`useScrollProgress(…, { enabled: !reduced })`); lay content out statically |
| Canvas / WebGL | Render one still frame; demand rendering; content motion behind Play (`studio-3d`) |

## 5. Pause, stop, hide

Independent of the preference: anything that starts by itself, lasts more than five seconds and sits beside other
content needs a visible pause or stop control (WCAG 2.2.2). Under reduced motion it should not start at all.
Nothing may flash more than three times in a second (WCAG 2.3.1).

## 6. Testing

1. **Visual Director**: `maquettekit review run` captures each viewport normally and with `prefers-reduced-motion:
   reduce` (`<viewport>-reduced-*.png`). The `reduced-motion` check reports animations still running and pixel
   change over 500 ms in the reduced capture (canvas and video may legitimately change; say which).
2. **Repository gates** for recipes and demos: `tests/e2e/effects.spec.ts` and `tests/e2e/demos.spec.ts` fail when
   an infinite CSS/WAAPI animation (longer than 50 ms per iteration) is running under emulated reduced motion.
3. **In-app toggle**: the gallery's "Reduced motion" button sets the provider override; check that it changes the
   same things as the OS setting.
4. **By eye**: each tier-2 replacement still shows what changed; each tier-3 item waits for its control.

## 7. Checklist

- [ ] Every animation has a tier and a written reduced form in the motion note.
- [ ] Components read `useStudioMotion().reduced`; CSS gates with the media query (and the root attribute for the
      in-app toggle).
- [ ] No translation, scale, rotation, parallax, scrub or pin under reduced motion; feedback still visible.
- [ ] Content motion waits for a control and can be paused; autonomous motion over 5 s has a pause control.
- [ ] Checked with OS emulation and with the in-app toggle.
