# Scroll choreography — pinning, scrubbing, parallax, masks, horizontal passages

Load for any scroll-linked motion. The rule above all: **scroll position belongs to the reader.** You may
attach motion to it; you may never take it over.

## 1. Choose the mechanism

Climb only when the rung below cannot do it (shared `technology-selection.md` §1).

| Need | Mechanism | Notes |
|---|---|---|
| Reveal once as a section enters | IntersectionObserver + CSS transition or `createSequence` | Once per element; never re-trigger on every pass in Expressive |
| Decorative progress-linked motion (parallax, progress bar, colour shift) | CSS scroll-driven animations behind `@supports`; fallback: one rAF-batched listener writing a custom property (`useScrollProgress`) | Compositor-friendly; static final state is the default |
| Pinned scene with several steps | `position: sticky` frame + one scrubbed timeline (GSAP ScrollTrigger, or `createSequence().seek(p)` fed by `useScrollProgress`) | The library's `scroll-pin-chapters` pattern |
| Horizontal passage | Sticky frame + scrubbed `translateX` on the track | `horizontal-scroll-gallery`; reduced form is native horizontal overflow with scroll-snap |
| Resting states between steps | ScrollTrigger `snap` on a short pinned sequence, or CSS `scroll-snap-type: y proximity` | Never `mandatory` on a whole page |
| A 3D camera on scroll | Page-owned progress drives the scene | `cinematic-3d.md` §3 |

## 2. Pinning

**Prefer CSS sticky.** A tall section (pin length + one viewport) with a `position: sticky; top: 0` frame
inside is compositor-driven, needs no pin-spacer, and works in nested scrollers. Use ScrollTrigger's `pin`
only when the element cannot sit in a tall wrapper, or when you need its `pinSpacing` management.

```css
.chapter       { height: 400vh; height: 400svh; }   /* 3 viewport-heights of pin + the frame itself */
.chapter-frame { position: sticky; top: 0; height: 100vh; height: 100svh; overflow: clip; }
```

Repeat each value without `var()` when you rely on the earlier line as a fallback: a declaration containing
`var()` is not rejected when parsed, so an unsupported unit inside it resolves to `unset`, not to the line above.

| Sticky pitfall | Fix |
|---|---|
| An ancestor has `overflow: hidden/auto/scroll`: the frame sticks to that box, or never sticks | Use `overflow: clip` (it does not create a scroll container) |
| The frame is a grid or flex child and stretches to full height | `align-self: start` on the frame |
| No threshold | `top: 0` (or the header height) is required |
| Section not taller than the frame | Nothing to stick through; check the height calculation |

**GSAP `pin` rules:** animate the pinned element's children, never the pinned element itself (ScrollTrigger
measures and positions it); do not nest pins; set `pinnedContainer` on triggers that live inside a pinned
element so their positions include the pin's duration; `anticipatePin: 1` reduces the flash of a fixed pin on
fast scrolls; `pinSpacing: false` only when the next section should slide over the pinned one.

## 3. Scrubbing

- `scrub: true` maps progress directly to scroll; `scrub: 0.5` adds half a second of catch-up smoothing. Keep
  smoothing at or below about 1 s: more feels disconnected from the hand.
- **`scrub` and `toggleActions` are mutually exclusive.** With `scrub` set, `toggleActions` is ignored. Decide
  per trigger: position-linked or played.
- **Put the ScrollTrigger on the timeline** (or a top-level tween), never on tweens nested inside a timeline:
  a child's trigger and the parent's playhead fight for the same time.
- Use `defaults: { ease: 'none' }` on scrubbed timelines so progress maps linearly to position; put character
  into individual segments with token eases (`gsapEase` in the motion module).
- Build in abstract units (one unit per chapter) and map them to scroll length with `end`. Pad with empty
  segments (`tl.to({}, { duration: 0.3 })`) to create rest zones where text holds still.
- Values that depend on layout are functions plus `invalidateOnRefresh: true`, so they are recomputed on
  refresh: `x: () => -(track.scrollWidth - frame.clientWidth)`.
- `start`/`end` accept `"top top"`, `"bottom bottom"`, `"+=300%"`; wrap in `clamp()` (GSAP 3.12+) for
  elements near the top or bottom of the page so the range stays inside the scrollable area.
- In `onUpdate(self)`, never set React state per frame. Store `self.progress` in a ref, and set state only when
  a discrete value (the chapter index) changes, as `scroll-pin-chapters` does.

## 4. Triggered (played) animations

- `toggleActions: "play none none reverse"` (onEnter, onLeave, onEnterBack, onLeaveBack); default is
  `"play none none none"`. `once: true` for reveals that must not replay.
- `ScrollTrigger.batch(targets, { onEnter: (els) => gsap.to(els, { …, stagger }) })` for groups of reveals.
- `fastScrollEnd: true` finishes an animation when the reader flings past it; `preventOverlaps: true` ends the
  previous trigger's animation before the next starts.
- The hidden start state is applied by the same script that reveals it, so failed or slow script leaves the
  content visible (shared `performance.md` §2). Beat 1 is never hidden.

## 5. ScrollTrigger rules

| # | Rule | Why |
|---|---|---|
| 1 | Register once, client-side: `gsap.registerPlugin(ScrollTrigger)` behind `typeof window !== 'undefined'`; no gsap calls during SSR | Server rendering has no layout or `window` |
| 2 | One trigger per timeline; none on child tweens | See §3 |
| 3 | `scrub` xor `toggleActions` | See §3 |
| 4 | Animate children of pins | See §2 |
| 5 | Create triggers in page order, or set `refreshPriority` (then `ScrollTrigger.sort()`) | Each start/end depends on the pin spacing of triggers above it |
| 6 | Refresh after layout changes: `document.fonts.ready.then(() => ScrollTrigger.refresh())`; after late images (better: reserve their dimensions); after injected content. Window resizes refresh automatically; a container resized without a window resize needs a `ResizeObserver` calling `refresh()` | Web fonts and images move every trigger below them |
| 7 | Clean up. React: `useGSAP(fn, { scope, dependencies, revertOnUpdate })` from `@gsap/react`; wrap handlers created later in `contextSafe`. Elsewhere: `const ctx = gsap.context(fn, root)` and `ctx.revert()` on teardown | Revert kills tweens and triggers, removes pin-spacers and restores inline styles |
| 8 | Reduced motion: `gsap.matchMedia()` conditions, or in React with the Maquettekit motion module, `useStudioMotion().reduced` in the `useGSAP` dependencies with `revertOnUpdate: true` and an early return | Choreography is created only for readers who want it; toggling reverts it |
| 9 | Nested scroll containers: pass `scroller: el` to every trigger inside (or `ScrollTrigger.defaults({ scroller: el })`) | Triggers otherwise measure the window |
| 10 | Existing smooth-scroll library (for example Lenis): `lenis.on('scroll', ScrollTrigger.update)`, drive it from `gsap.ticker` (one loop), `gsap.ticker.lagSmoothing(0)`. Scrollers that transform their content need `ScrollTrigger.scrollerProxy` | Two rAF loops drift; never add a smooth scroller the project does not have |
| 11 | `markers: true` in development only | Debug overlays ship more often than you think |
| 12 | Snap only short pinned sequences: `snap: { snapTo: 1 / (n - 1), duration: { min: 0.15, max: 0.45 }, delay: 0.1, inertia: false }`; never long reading passages | Snapping moves the reader's scroll position; it must feel like settling, not seizing |

React pattern (Maquettekit motion module installed; adjust import paths to the project):

```tsx
'use client';
import { useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { gsapEase, useStudioMotion } from './motion';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger, useGSAP);

export function PinnedBeat({ children }: { children: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  const { reduced } = useStudioMotion();

  useGSAP(() => {
    if (reduced) return;                                   // the static document stays as rendered
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom bottom', scrub: 0.5 },
    });
    tl.to({}, { duration: 0.3 })                           // rest: beat 1 copy holds still
      .from('[data-layer]', { yPercent: 12, stagger: 0.08, ease: gsapEase.enter })
      .to({}, { duration: 0.3 });                          // rest before the hand-over
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }, { scope: root, dependencies: [reduced], revertOnUpdate: true });

  return <section ref={root} className="chapter"><div className="chapter-frame">{children}</div></section>;
}
```

Framework-free pattern:

```js
const mm = gsap.matchMedia();
mm.add({ motion: '(prefers-reduced-motion: no-preference)', wide: '(min-width: 48rem)' }, (ctx) => {
  const { motion, wide } = ctx.conditions;
  if (!motion) return;                                     // reduced: nothing is created
  gsap.timeline({ scrollTrigger: { trigger: '.story', start: 'top top', end: '+=300%', scrub: true } })
    .to('.story [data-layer]', { yPercent: wide ? -30 : -15, ease: 'none' });
});
// On teardown (route change): mm.revert(). After an in-app motion toggle: gsap.matchMediaRefresh().
```

Do not nest `gsap.context()` inside a `matchMedia` callback: the callback already runs in a context.

## 6. Parallax

CSS scroll-driven version (declare `animation-timeline` **after** the `animation` shorthand, which resets it):

```css
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    .layer {
      animation: drift linear both;
      animation-timeline: view();
      animation-range: cover 0% cover 100%;
    }
  }
}
@keyframes drift {
  from { transform: translateY(calc(var(--depth, 1) * -6%)); }
  to   { transform: translateY(calc(var(--depth, 1) *  6%)); }
}
```

Fallback: `useScrollProgress` writes one custom property; each layer's transform is computed in CSS from it
(`parallax-depth-layers`). Rules: transform only, never parallax reading text, oversize layers inside an
`overflow: clip` frame, travel capped by the profile, removed under reduced motion.

## 7. Masks and reveals

| Reveal | Technique | Cost | Note |
|---|---|---|---|
| Line rises from a mask | Wrapper `overflow: clip`, child `translateY(110%) → 0` | Compositor | Pad the wrapper for descenders (`kinetic-typography.md` §4) |
| Wipe | `clip-path: inset(0 100% 0 0) → inset(0)` | Often cheap; verify | Follow the reading direction; mirror for RTL |
| Iris / shape | `clip-path: circle()` or `polygon()` with equal point counts | Often cheap | Keep the focal point inside the opening |
| Soft edge | `mask-image` gradient, animate `mask-position` | Paint each frame | Small areas only |
| Shaped SVG | `<clipPath>` / `<mask>` in SVG | Paint | Line art: `svg-path-draw` |

Text revealed by a mask must reach full contrast in its rest zone; mid-reveal states are not reading states.

## 8. Horizontal passages

- Structure: tall section (height ≈ track overflow + one viewport) → sticky frame (`overflow: clip`) → track
  moved by a scrubbed `x` with `ease: 'none'`.
- Triggers for elements inside the moving track use `containerAnimation: thatTween`. That requires the
  container tween to be linear, and pinning and snapping are not available on such triggers.
- Keyboard: the browser cannot focus-scroll a transformed track. When a card receives focus, scroll the page
  to the position that reveals it (`horizontal-scroll-gallery` does this); never let focus land off-screen.
- Touch: vertical swipes driving horizontal motion surprise some readers. On narrow screens consider the
  reduced form for everyone: a native horizontal list with `scroll-snap-type: x mandatory` and visible
  previous/next buttons.
- Show position ("03 / 06") as text; keep the track length near 1:1 with scroll distance.

## 9. CSS scroll-driven animations

- Timelines: `scroll()` (a scroller's progress; nearest scroller by default, `scroll(root)` for the page),
  `view()` (an element crossing the scrollport), named `scroll-timeline` / `view-timeline` shared with other
  elements through `timeline-scope` on a common ancestor.
- Ranges: `animation-range: entry 0% cover 50%` with the `entry`, `exit`, `cover` and `contain` ranges.
- Detection: `@supports (animation-timeline: view())`; in script `CSS.supports('animation-timeline', 'view()')`.
  Support differs by engine and changes over time: check the project's targets and treat it as enhancement.
- The default style is the final, readable state; the animation only exists inside `@supports` and
  `prefers-reduced-motion: no-preference`.
- CSS cannot set ARIA state: drive `aria-current` from an IntersectionObserver (`scroll-progress-rail` does).

## 10. Interruption, resize and mobile

- **Interruption.** Scrubbed motion reverses for free. Played motion must survive rapid reversal
  (`toggleActions` with reverse, `overwrite: 'auto'`, `fastScrollEnd`). Never lock scroll while something
  animates; any input skips an intro.
- **Resize.** Function-based values need `invalidateOnRefresh`; container-only resizes need a
  `ResizeObserver`. Resize mid-sequence and rotate the device: nothing may jump or leave a gap.
- **Mobile address bar.** On mobile, `100vh` is the large viewport (bars hidden), so a `100vh` frame is taller
  than the screen at load. Size pinned frames in `svh`; keep `dvh` off pinned frames (it changes while
  scrolling and forces relayout). On touch devices ScrollTrigger ignores height-only resizes smaller than about
  a quarter of the viewport by default (the `ignoreMobileResize` config), so address-bar movement does not
  refresh triggers; leave that on. `ScrollTrigger.normalizeScroll(true)` can stop address-bar movement and some
  iOS jitter, but it takes over touch scrolling on the main thread: use it only for a measured problem.
- **Nested scrollers.** `overscroll-behavior: contain` stops scroll chaining into the page.
- **Reload mid-page and hash links.** The browser restores scroll before your code runs. After setup, the
  scene must match the restored position; scroll to a hash only after the initial refresh.

## 11. When not to scroll-jack

| Do not | Because | Instead |
|---|---|---|
| Intercept wheel or touch (`preventDefault`) to replace native scrolling with eased or virtual scroll | Breaks find-in-page, anchors, keyboard scrolling, OS speed settings and assistive tech; vestibular discomfort | Native scroll with scrubbed timelines |
| Turn each wheel tick into "one slide" | Trackpads send dozens of events; readers lose control | Short pinned sequences with gentle snap |
| Lock scroll during an intro | Violates user control (2.2.2) | Scroll is available immediately; the intro is skippable |
| Hide the scrollbar | Removes position feedback | Keep it; add a progress rail |
| Pin longer than about 3 vh without new content | Feels stuck; readers assume the page broke | Split the beat, or add a skip link |
| Reverse or rescale scroll direction or speed | Disorienting | Map motion to position, never position to motion |
| Add a smooth-scroll library to a project without one | A second scroll system for marginal gain | Only when asked, Immersive profile, not instantiated under reduced motion |

## 12. Tests before you call it done

Slow scroll; fast fling down and up through every pinned section; keyboard (Space, Page Down, arrows, Tab
through every chapter control); resize and rotate mid-sequence; reload mid-page; open a deep link; reduced
motion on; navigate away and back, then confirm `ScrollTrigger.getAll().length` returns to its baseline and the
console is clean. Headless captures cannot judge pacing or smoothness: say so in the report.
