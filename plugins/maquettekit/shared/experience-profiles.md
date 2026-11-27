# Experience profiles — Essential, Expressive, Immersive

> **Quick card** — the must-dos from this file; read on for the reasons and the detail.
>
> - Use the profile the user names; otherwise pick the one the surface deserves, and build it to that profile's craft floor.
> - Record the profile per surface and report it next to every score.
> - Apply the profile's multipliers to motion token values; never hard-code new numbers.
> - Cap simultaneous animations at 1 (Essential), 3 (Expressive) or 6 (Immersive).
> - Under reduced motion, behave at or below Essential: zero distance and stagger, one animation at a time.
> - Make anything moving by itself for over five seconds pausable, intros skippable and sound opt-in; never hijack scroll without an escape.
> - Never block input with animation: controls work as soon as visible, and animations stay interruptible and reversible.
> - Keep all information and actions available when JavaScript animation fails, WebGL is unavailable or reduced motion is on.

A profile is one decision that sets how much motion, depth and spectacle an experience carries. Choose it in
the brief, record it in `maquettekit.design.json`, pass it to the Experience Lab (`--profile`), and give it to the
runtime (`StudioMotionProvider profile="…"` in projects using the Maquettekit motion module).

A profile **shapes recommendations**. It never overrides accessibility, user preferences or user control: see
the invariant gates in §5.

## 1. Definitions

| Profile | One line | Feels like | The user is |
|---|---|---|---|
| **Essential** | Minimal animation, maximum clarity and responsiveness | A sharp tool. State changes are instant or nearly so; nothing moves that the user did not cause | Working: repeating tasks, under time pressure, on any device |
| **Expressive** | Rich feedback and polished transitions | A crafted product. Motion explains change and rewards action, then gets out of the way | Using and evaluating: products, onboarding, marketing, social |
| **Immersive** | Cinematic motion, spatial and 3D experiences | A staged piece. Motion and depth are part of the content | Watching and exploring: launches, stories, showrooms, campaigns |

Profiles apply per surface, not per company. A product can have an Immersive launch page, an Expressive
onboarding and an Essential admin console. Record the profile for each surface you touch.

## 2. Choosing

Pick the profile the surface deserves, then deliver it in full. Surfaces people work in lean down; surfaces
people look at, evaluate or remember lean up. Choosing too low is as much an error as choosing too high: an
Expressive brief delivered as Essential is an unfinished build. Each profile has a craft floor in
`motion-craft.md` §1 as well as the limits below.

| Signal in the brief or project | Choose |
|---|---|
| Repeated daily use, data entry, monitoring, internal tools, checkout, settings | Essential |
| Regulated or high-stakes context (health, finance operations, government) | Essential |
| Low-end devices or poor networks dominate the audience | Essential |
| Consumer product UI, onboarding, marketing pages that must convert, feeds | Expressive |
| "Polished", "delightful", "premium feel" without "cinematic"/"3D" | Expressive |
| Launch, campaign, portfolio, brand story, product showroom, explicit 3D request | Immersive |
| User says "wow", "award-style", "scrollytelling", "immersive" | Immersive (still with every gate in §5) |
| No signal at all | Expressive for product/social, Essential for data, Immersive for cinematic (see §4) |

If the user names a profile, use it. If the user's wishes conflict with the audience (an Immersive request
for an operations dashboard), build what was asked for the brand layer and keep the working surface Essential;
say so in the report.

## 3. Parameters

Multipliers match the Maquettekit motion tokens (`profileScale` in the library's motion module). Apply them to the
token values, do not hard-code new numbers.

| Parameter | Essential | Expressive | Immersive |
|---|---|---|---|
| Duration scale | × 0.7 | × 1 | × 1.25 |
| Distance scale | × 0.5 | × 1 | × 1.4 |
| Stagger scale | × 0.5 | × 1 | × 1.2 |
| Max simultaneous animations | 1 | 3 | 6 |
| Typical UI transition (token `base`, 240 ms) | about 170 ms | 240 ms | 300 ms |
| Longest single UI transition | `moderate` (360 ms, scaled) | `slow` (560 ms) | `cinematic` (900 ms); `epic` (1400 ms) only in scripted, skippable sequences |
| Easing | `standard`, `exit`; no overshoot | adds `enter`, `emphasized`, `anticipate`; springs `press`, `settle`, `release` (gestures keep their velocity) | all tokens; springs incl. `glide`; `pop` and `overshoot` for celebratory feedback |
| Entrance animation on load | None, or one opacity fade | One orchestrated sequence above the fold | Scripted intro allowed if skippable and under about 3 s to usable content |
| Scroll-triggered reveals | None | Yes, once per element, never re-triggering; groups staggered; scroll-linked progress and velocity response allowed | Yes, including scrubbed sequences |
| Pinning / scrubbed scroll | No | Short pinned or scrubbed sections, each left by normal scrolling | Yes, with escape (see studio-cinematic) |
| Parallax | No | Up to three layers, ≤ 20 % relative travel | Multi-layer, depth-mapped |
| Hover and pointer response | Colour/outline; an immediate pressed state | Pointer-tracked effects (tilt, magnetic, spotlight, light that follows the pointer) and reveal of secondary actions, all lit from one direction | Plus contextual cursor states and scene-wide response to the pointer |
| Page/route transitions | Instant or a ≤ 200 ms cross-fade | Shared-element or directional transition | Full-screen staged transitions |
| Layout animation (reorder, expand) | Instant or ≤ 200 ms | FLIP/layout animation | Same, may add secondary motion |
| CSS 3D transforms | No | Yes, for cards and objects with depth (flip, tilt, depth stack) | Yes |
| Real-time 3D / WebGL | Only when 3D *is* the function (a viewer the user came for) | When it shows the subject better than images can: real light and material, handling it, a spatial story (`technology-selection.md` §2.1); one canvas, static fallback | Encouraged: the subject in real light, handled directly; one canvas per view, static fallback |
| Ambient/background animation | No | Subtle and pausable, driven by something (pointer, scroll, data, time) rather than a blind loop | Yes, pausable |
| Sound | No | No by default; opt-in feedback sounds only on request | Opt-in only, off by default, with a visible toggle |
| Autoplay video/animation | No | Muted, short, pausable; poster under reduced motion | Muted, pausable; poster under reduced motion |
| Custom cursor | No | Optional on fine pointers as an augmentation; the native cursor stays visible | Optional on fine pointers, with contextual states (label, magnet, text); the native cursor stays functional |
| Direct manipulation | Drag or reorder where the task benefits; always with a button or keyboard twin | At least one hands-on interaction with a physical response (drag, scrub, swipe, throw) | The main subject can be handled: turned, thrown, scrubbed, configured |
| Feedback latency target | Next frame | Next frame; the animation may continue after | Next frame; the animation may continue after |

**Reading the table.** "Max simultaneous animations" counts independently perceived motions, not DOM nodes: a
staggered list is one; a list, a counter and a background drift are three. Feedback latency is the same in
every profile: richness is added after the response, never in front of it. Motion that follows the user's own
pointer, drag or scroll is response, not ambient motion, and does not count toward the simultaneous budget. Each
profile also has a craft floor, a minimum as binding as these limits (`motion-craft.md` §1).

## 4. Per-specialty defaults

Used when the brief gives no signal. State the default you picked and why.

| Specialty | Default | Typical range | Notes |
|---|---|---|---|
| Product (`studio-product`) | Expressive | Essential (settings, checkout, admin) → Immersive (launch page, configurator hero) | Flows the user repeats drop to Essential even inside an Expressive product |
| Cinematic (`studio-cinematic`) | Immersive | Expressive (editorial, long reads) → Immersive | Never Essential by default, but must degrade to an Essential-quality reading experience |
| Data (`studio-data`) | Essential | Essential (monitoring, trading) → Expressive (exploration, reports, data stories) | Immersive only for an explicitly presentational piece; operators need stillness |
| Social (`studio-social`) | Expressive | Essential (moderation, messaging utility) → Immersive (campaigns, 3D posts) | Feedback is rich; ambient motion stays low because the content already moves |
| 3D (`studio-3d`) | Immersive | Expressive (embedded viewer) → Immersive | A viewer inside a product page inherits the page's profile for everything outside the canvas |

## 5. Invariant gates — no profile overrides these

Every profile, including Immersive, must pass all of these. They are checked in the review loop.

1. **Reduced motion is honoured** with the three-tier policy in `accessibility.md`. Under reduced motion every
   profile behaves at or below Essential: scales for distance and stagger go to zero and one animation runs at
   a time. A profile or in-app setting can add reduction, never remove it.
2. **User control.** Anything that moves by itself for more than five seconds can be paused, stopped or hidden.
   Intro sequences can be skipped. Sound is opt-in. Scroll position belongs to the user: no hijacking of
   scroll speed or direction without an escape.
3. **Input is never blocked by animation.** Controls are interactive as soon as they are visible; animations
   are interruptible and reversible.
4. **Content is reachable without the spectacle.** With JavaScript animation failed, WebGL unavailable or
   reduced motion on, all information and every action remain available in a sensible order.
5. **Accessibility criteria in `accessibility.md`** hold: keyboard, focus, contrast, target size, alternatives
   for drag and gestures, no flashing above three per second.
6. **Performance budget of the project** holds (`performance.md`). Immersive raises ambition, not the budget
   for the user's device; scale quality down on weak hardware.
7. **Honesty.** No profile licenses fake data, fake urgency or manipulative patterns.

## 6. Applying a profile in code

In React projects using the Maquettekit motion module:

```tsx
import { StudioMotionProvider, useStudioMotion } from './motion';
import { duration, distance, sec } from './motion/tokens';

// App root: one provider; `reduced` may be wired to an in-app "Reduce motion" toggle.
<StudioMotionProvider profile="expressive">{children}</StudioMotionProvider>

// In a component: scale tokens, never hard-code.
function useEnter() {
  const { reduced, scale } = useStudioMotion();
  return {
    y: reduced ? 0 : distance.base * scale.distance,
    seconds: sec((reduced ? 160 : duration.base) * (reduced ? 1 : scale.duration)),
  };
}
```

Adjust import paths to where the motion module was copied in the project (see `studio-components`). In non-React
projects, express the same thing with CSS custom properties: set `--mk-duration-*` and `--mk-distance-*` once
per profile on `:root` and let components read them.

## 7. Assessing against a profile

Run the Experience Lab with the profile you chose: `maquettekit experience assess --profile <profile>` (see
`maquettekit experience --help` for the remaining flags). The profile changes what the assessment expects: an
Essential surface is penalised for decorative motion; an Expressive or Immersive one is penalised for inert,
uniform or untouchable motion (the `motionUsefulness.craft` rubric question); an Immersive one is expected to
stage its content but is penalised just as hard for missing controls, missing fallbacks or blocked input. Report the profile next to
every score: a score without its profile is meaningless.
