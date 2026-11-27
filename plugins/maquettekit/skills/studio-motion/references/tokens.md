# Motion tokens

One vocabulary for CSS, WAAPI, Motion and GSAP, from `library/src/motion/tokens.ts`. Durations are milliseconds;
convert with `sec()` for libraries that take seconds. Imports below assume the engine was copied to `./motion`.

## 1. Durations

| Token | ms | Use for | Never for |
|---|---|---|---|
| `instant` | 90 | Press feedback, toggles, checkbox ticks | Anything that travels |
| `fast` | 160 | Hover, small state changes, tooltips, reduced-motion fades | Panels |
| `base` | 240 | Most UI transitions: menus, chips, list items | Page-level moves |
| `moderate` | 360 | Panels, cards, popovers, shared elements, `flip()` default | Feedback |
| `slow` | 560 | Page-level moves, large surfaces, route transitions | Repeated UI |
| `cinematic` | 900 | Hero reveals, scene intros | Anything repeated |
| `epic` | 1400 | Scripted, skippable sequences only | Interactive UI |

Larger surfaces and longer distances take longer; exits take about 70 % of their entrance.

## 2. Easings

| Token | Cubic-bezier | Use |
|---|---|---|
| `standard` | `0.2, 0, 0, 1` | Moves between two on-screen positions (default of `createSequence`) |
| `enter` | `0.05, 0.7, 0.1, 1` | Arriving: decelerates into place |
| `exit` | `0.3, 0, 0.8, 0.15` | Leaving: accelerates away |
| `emphasized` | `0.16, 1, 0.3, 1` | Hero moments, shared elements, `flip()` default |
| `inOut` | `0.65, 0, 0.35, 1` | Symmetric moves, scroll snapping, loops |
| `linear` | `0, 0, 1, 1` | Opacity cross-fades, scrubbed timelines, progress |
| `anticipate` | `0.36, 0, 0.66, -0.56` | Wind-up before an exit; playful only |
| `overshoot` | `0.34, 1.56, 0.64, 1` | Celebratory arrivals; never navigation |

`cssEase(token | bezier)` returns `cubic-bezier(…)`. `gsapEase` maps each token to a built-in GSAP ease
(`standard` → `power2.out`, `enter` → `power3.out`, `exit` → `power2.in`, `emphasized` → `expo.out`, `inOut` →
`power2.inOut`, `anticipate` → `back.in(1.7)`, `overshoot` → `back.out(1.7)`, `linear` → `none`): close, not
identical. Use GSAP's CustomEase with the exact bezier when the match matters.

## 3. Springs

Motion-compatible `{ stiffness, damping, mass }`, named by role:

| Token | Values | Use |
|---|---|---|
| `press` | 520 / 34 / 0.8 | Buttons, toggles, chips: fast, no visible bounce |
| `settle` | 260 / 28 / 1 | Cards, popovers, sheets settling |
| `release` | 180 / 20 / 1 | Objects released after a drag: carries velocity |
| `pop` | 420 / 14 / 0.9 | Reactions and likes; sparingly |
| `glide` | 120 / 22 / 1.2 | Large surfaces, shared-element transitions |

`springToLinear(spring.settle, points = 32)` samples a spring into a CSS `linear()` easing and returns
`{ easing, duration }` (the settle time in ms, clamped to 0.1–4 s), so CSS transitions and WAAPI get a spring
without a JavaScript loop. `linear()` is a modern CSS feature: where older engines matter, check
`CSS.supports('transition-timing-function', 'linear(0, 1)')` and fall back to `cssEase('emphasized')`.

For a value the hand drives frame by frame (a drag, a pointer follow, a throw), step the spring yourself with
`stepSpring(state, target, spring.release, dt)`: `state` is `{ x, v }` (`springState(x)`), it keeps its velocity
between calls, sub-steps at ≤ 1/240 s and returns true once it is parked on the target (`{ restDelta, restSpeed }`
override the thresholds; `springAtRest` checks without stepping). `useSettleLoop(ref, (dt) => stepSpring(...))`
runs it on `useRafLoop` and returns `wake()`: call it when the target moves, and the loop stops itself at rest.
Do not write another integrator in a recipe.

## 4. Stagger and distance

| `stagger` | ms | `distance` | px |
|---|---|---|---|
| `tight` | 24 | `nudge` | 4 |
| `base` | 48 | `short` | 12 |
| `loose` | 90 | `base` | 24 |
| `dramatic` | 140 | `long` | 56 |
| | | `travel` | 120 |

Stagger only the first appearance of a short list and keep the total short: with `stagger.base`, eight items take
336 ms of stagger before the last one starts. The design file caps it (`motion.stagger.maxTotalMs`, `maxItems`).

## 5. Profiles scale tokens

`profileScale` and `useStudioMotion().scale`:

| Profile | duration | distance | stagger | maxConcurrent |
|---|---|---|---|---|
| `essential` | × 0.7 | × 0.5 | × 0.5 | 1 |
| `expressive` | × 1 | × 1 | × 1 | 3 |
| `immersive` | × 1.25 | × 1.4 | × 1.2 | 6 |

Under reduced motion `scale.distance` and `scale.stagger` become 0 and `maxConcurrent` 1; `scale.duration` keeps
the profile value, so reduced-motion fades use their own short duration (`fast`, or 160 ms in the recipes).
`StudioMotionProvider profile="…"` sets the profile (default `expressive`).

```tsx
'use client';
import { motion } from 'motion/react';
import gsap from 'gsap';
import { cssEase, distance, duration, gsapEase, sec, spring, springToLinear, useStudioMotion } from './motion';

export function TokenExamples({ open }: { open: boolean }) {
  const { reduced, scale } = useStudioMotion();
  const rise = distance.base * scale.distance; // 0 under reduced motion
  const css = springToLinear(spring.settle);
  return (
    <>
      {/* CSS transition from tokens */}
      <div style={{ transition: `transform ${duration.moderate * scale.duration}ms ${cssEase('emphasized')}`, transform: open ? 'none' : `translateY(${rise}px)` }} />
      {/* Spring feel in CSS, no JS loop */}
      <div style={{ transition: `transform ${css.duration}ms ${css.easing}`, transform: open ? 'scale(1)' : 'scale(0.96)' }} />
      {/* Motion: spring tokens spread into the transition; reduced motion → instant */}
      <motion.div animate={{ y: open ? 0 : rise }} transition={reduced ? { duration: 0 } : { type: 'spring', ...spring.settle }} />
      {/* GSAP: seconds and the mapped ease */}
      <button type="button" onClick={(e) => gsap.to(e.currentTarget, { y: -distance.nudge, duration: sec(duration.fast), ease: gsapEase.standard, yoyo: true, repeat: 1 })}>Nudge</button>
    </>
  );
}
```

## 6. CSS custom properties

`motionTokensCss()` returns one `:root { … }` block to inject once (or paste into a stylesheet):
`--mk-duration-{instant…epic}`, `--mk-ease-{linear…overshoot}`, `--mk-stagger-{tight…dramatic}`,
`--mk-distance-{nudge…travel}`. Recipes read them with fallbacks (`var(--mk-duration-base, 240ms)`), so they
work without the block.

```css
.panel { transition: transform var(--mk-duration-moderate, 360ms) var(--mk-ease-emphasized, cubic-bezier(0.16, 1, 0.3, 1)); }
@media (prefers-reduced-motion: reduce) { .panel { transition: opacity var(--mk-duration-fast, 160ms) linear; transform: none; } }
```

## 7. `maquettekit.design.json` versus the library tokens

The design generator writes its own motion scale. It overlaps the library's names but not all values:

| Design file (`motion.*`) | Generated CSS | Nearest library token | Note |
|---|---|---|---|
| `durations.instant/fast/base` | `--mk-duration-instant/fast/base` | `instant`/`fast`/`base` | Values scaled by direction and profile |
| `durations.slow` (≈ 380 ms before scaling) | `--mk-duration-slow` | `moderate` (360) | **Name clash**: the library's `slow` is 560 |
| `durations.slower` (≈ 600) | `--mk-duration-slower` | `slow` (560) | |
| `durations.scene` (≈ 1000) | `--mk-duration-scene` | `cinematic` (900) | |
| `easings.standard`, `linear` | `--mk-ease-standard`, `--mk-ease-linear` | same curves | |
| `easings.enter`/`exit`/`emphasized` | `--mk-ease-enter/exit/emphasized` | same names | **Different curves** from the library |
| `easings.signature` | `--mk-ease-signature` | none | The direction's characteristic curve |
| `springs.snappy/smooth/gentle/bouncy` | (JS/TS token exports) | `press`/`settle`/`glide`/`pop` | `release` has no design equivalent |
| `stagger.eachMs`, `maxTotalMs`, `maxItems` | `--mk-stagger` | `stagger.*` | One value versus a scale |
| `reducedMotion.maxReplacementMs` (200) | reduce block: durations capped, `--mk-stagger: 0ms`, `--mk-motion-scale: 0` | — | Also a global reduced-motion rule in its base layer |

Rules: when `maquettekit.design.json` exists, its values are the brand's. Load the design tokens CSS **after**
`motionTokensCss()` (or not load the latter), decide what `--mk-duration-slow` means in the project, and record the
mapping in the motion note. In JS, pass the design values explicitly (`createSequence().add(…, { duration:
design.durations.base })`) rather than mixing the two scales.
