# Experience profiles — Essential, Expressive, Immersive

A profile is one decision that sets how much motion, depth and spectacle an experience carries. Choose it in
the brief, record it in `studio3.design.json`, pass it to the Experience Lab (`--profile`), and give it to the
runtime (`StudioMotionProvider profile="…"` in projects using the Studio³ motion module).

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

Pick the lowest profile that achieves the brief. Move up only for a stated reason.

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

Multipliers match the Studio³ motion tokens (`profileScale` in the library's motion module). Apply them to the
token values, do not hard-code new numbers.

| Parameter | Essential | Expressive | Immersive |
|---|---|---|---|
| Duration scale | × 0.7 | × 1 | × 1.25 |
| Distance scale | × 0.5 | × 1 | × 1.4 |
| Stagger scale | × 0.5 | × 1 | × 1.2 |
| Max simultaneous animations | 1 | 3 | 6 |
| Typical UI transition (token `base`, 240 ms) | about 170 ms | 240 ms | 300 ms |
| Longest single UI transition | `moderate` (360 ms, scaled) | `slow` (560 ms) | `cinematic` (900 ms); `epic` (1400 ms) only in scripted, skippable sequences |
| Easing | `standard`, `exit`; no overshoot | adds `enter`, `emphasized`; springs `press`, `settle` | all tokens; springs incl. `glide`, `release`; `pop` only for celebratory feedback |
| Entrance animation on load | None, or one opacity fade | One orchestrated sequence above the fold | Scripted intro allowed if skippable and under about 3 s to usable content |
| Scroll-triggered reveals | None | Sparse; once per element, never re-triggering | Yes, including scrubbed sequences |
| Pinning / scrubbed scroll | No | At most one short pinned section | Yes, with escape (see studio-cinematic) |
| Parallax | No | Subtle: one layer, ≤ 10 % relative travel | Multi-layer |
| Hover effects | Colour/outline only | Plus small transform, reveal of secondary actions | Plus pointer-tracked effects (tilt, magnetic, spotlight) |
| Page/route transitions | Instant or a ≤ 200 ms cross-fade | Shared-element or directional transition | Full-screen staged transitions |
| Layout animation (reorder, expand) | Instant or ≤ 200 ms | FLIP/layout animation | Same, may add secondary motion |
| CSS 3D transforms | No | Small accents (card flip, depth stack) | Yes |
| Real-time 3D / WebGL | Only when 3D *is* the function (a viewer the user came for) | When justified by the specialty's criteria; one canvas | Encouraged where it serves the story; still one canvas per view |
| Ambient/background animation | No | Rare, subtle, pausable | Yes, pausable |
| Sound | No | No by default; opt-in feedback sounds only on request | Opt-in only, off by default, with a visible toggle |
| Autoplay video/animation | No | Muted, short, pausable; poster under reduced motion | Muted, pausable; poster under reduced motion |
| Custom cursor | No | No | Optional on fine pointers only; native cursor stays functional |
| Feedback latency target | Next frame | Next frame; the animation may continue after | Next frame; the animation may continue after |

**Reading the table.** "Max simultaneous animations" counts independently perceived motions, not DOM nodes: a
staggered list is one; a list, a counter and a background drift are three. Feedback latency is the same in
every profile: richness is added after the response, never in front of it.

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

In React projects using the Studio³ motion module:

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
projects, express the same thing with CSS custom properties: set `--s3-duration-*` and `--s3-distance-*` once
per profile on `:root` and let components read them.

## 7. Assessing against a profile

Run the Experience Lab with the profile you chose: `studio3 experience assess --profile <profile>` (see
`studio3 experience --help` for the remaining flags). The profile changes what the assessment expects: an
Essential surface is penalised for decorative motion; an Immersive one is expected to stage its content but is
penalised just as hard for missing controls, missing fallbacks or blocked input. Report the profile next to
every score: a score without its profile is meaningless.
