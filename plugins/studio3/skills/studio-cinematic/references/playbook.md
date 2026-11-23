# Cinematic Studio playbook

How to stage a narrative page that people remember and can still control. General taste rules are in the
shared `design-principles.md`; scroll mechanics are in `scroll-choreography.md`; this file covers story,
pacing and composition.

## 1. Narrative structure: five beats

Work backwards from three things a visitor keeps: **one image, one line, one feeling**. Decide them first,
then place them in a five-beat structure. Five beats over 5–8 viewport-heights (vh) of scroll is the default.

| # | Beat | Job | Typical length | Pace | Carries |
|---|---|---|---|---|---|
| 1 | Hook | Establish the world and the promise in one composition | 1 vh, not pinned | Still | The line, set large; visible without script |
| 2 | Tension | The situation that makes the subject matter | 1–1.5 vh | Building | Context, contrast, the problem in concrete terms |
| 3 | Turn | The subject appears or transforms: the bold move | 1.5–3 vh, usually pinned | Peak | The image people remember |
| 4 | Proof | The specifics: how it works, what it is made of, real facts | 1.5–2 vh | Varied, then calm | Detail, sequence, evidence |
| 5 | Resolution | Where the story lands: the action or destination | 0.5–1 vh, static | Release | The feeling, and one clear next step |

**Rules**

- One idea per beat. If a beat needs two sentences to state its message, split it or cut one.
- The climax is beat 3, not beat 1. A hook that spends the whole budget leaves the page flat.
- Beat 5 is calm and static. The action must not move, fade or wait for an animation.
- Every beat has a static form that reads correctly on its own (the reduced-motion and no-JS document).

**Structures that fit the frame**

| Structure | Use when | Beat mapping |
|---|---|---|
| Reveal | One object or idea is the subject | Hook → context → reveal → detail → ask |
| Process | Something is made in steps | Raw material → problem → key step (pinned) → remaining steps → result |
| Before / after | The value is a change | The old way → its cost → the switch → the new way in detail → start |
| Zoom | Scale is the story (city → street → object) | Wide → closer → the detail that matters → its context → return wide |
| Journey | Place to place, route, timeline | Departure → the stretch → the turning point → stops → arrival |
| Manifesto | A brand states beliefs | Statement → what it rejects → the core belief → evidence of practice → invitation |

## 2. The beat sheet

Write this before any code. It is the specification for the static document, the choreography and the
reduced-motion form, so they cannot drift apart.

| # | Message (one sentence) | Anchor: image or line | Scroll length | In | Out | Reduced-motion form | Content source |
|---|---|---|---|---|---|---|---|
| 1 | … | … | 1 vh | none (LCP) | … | identical, static | real / `Draft copy` |
| 2 | … | … | … | … | … | … | … |

Example (fictional: a launch page for a night-train route; figures would come from the user):

| # | Message | Anchor | Length | In | Out | Reduced |
|---|---|---|---|---|---|---|
| 1 | Fall asleep in one city, wake in another | The line set across a window at dusk | 1 vh | none | sky darkens (colour shift) | static, dark sky |
| 2 | Door to door, the night train competes with flying | Two journey timelines side by side (user's real times) | 1.25 vh | timelines draw left to right | cross-fade | both timelines drawn |
| 3 | The cabin is the destination | The cabin opening in layers: bunk, window, landscape | 2.5 vh pinned | layers separate in depth | landscape slides away | three stills in sequence |
| 4 | Six stops, one night | Horizontal passage of stops with times | 2 vh | horizontal travel | settles on the last stop | native horizontal list |
| 5 | Book the first departures | Date and one button | 0.75 vh | none | none | identical |

Keep the sheet as data and render chapters from it, so the static, animated and reduced paths share one source:

```ts
interface Beat {
  id: string;                    // also the section id, so chapters are deep-linkable
  message: string;               // the one sentence; becomes the heading or its summary
  anchor: { kind: 'line' | 'image' | 'object'; content: string };
  lengthVh: number;              // scroll length in viewport-heights
  pinned: boolean;
  enter: string;                 // transition name, e.g. 'rise', 'wipe', 'none'
  exit: string;
  reduced: string;               // what the reduced-motion reader sees instead
  source: 'real' | 'draft';      // draft copy is visibly marked until replaced
}
```

## 3. Pacing

**Rest zones.** Every beat contains a stretch of scroll where nothing moves and its text is fully legible.
In a pinned unit, put transitions in the middle of the hand-over and let the first and last parts rest; snap
points (if any) land on rests. A reader cannot read moving text.

| Element | Scroll budget (guidance) |
|---|---|
| Headline entrance (triggered, time-based) | Plays in ≤ 1.2 s once the beat is in view; no scroll length needed |
| Chapter hand-over inside a pin | 0.5–1 vh, with ≥ 0.3 vh rest either side |
| Pinned sequence without new content | ≤ about 3 vh (the SKILL non-negotiable) |
| Horizontal passage | Scroll distance roughly equal to the track's overflow (1:1 feels natural) |
| Text reading hold | About 0.5 vh per short line; longer for paragraphs |

**Reading speed.** Adults read roughly four words a second on screen. A 20-word caption needs five seconds;
at a relaxed scroll rate that is more than one viewport-height. Shorten copy before stretching scroll.

**Tempo map.** Sketch the intensity of each beat on a 1–5 scale before building. A healthy page rises to beat
3, dips in beat 4 and resolves low in beat 5. A flat line at 5 is exhausting; a flat line at 2 is a document.

**Scrubbed or triggered: decide per beat.**

| Choose | When | Example |
|---|---|---|
| Scrubbed (position-linked) | The motion is spatial or a transformation the reader should control | Layers separating, a camera moving, a horizontal passage |
| Triggered (time-based, plays once in view) | The motion has a natural tempo and a fixed end state | A headline rising, a line drawing, a counter arriving |

Never both on one element. Flings cover several viewport-heights a second on trackpads and phones, so
scrubbed motion must make sense at any speed and triggered motion must tolerate being skipped (see
`fastScrollEnd` in `scroll-choreography.md`).

## 4. Visual direction for narrative pages

Derive the direction from the subject (shared `design-principles.md` §1), then add the narrative devices:

- **Colour script.** Assign each beat a colour mood, as film and animation do: e.g. dusk → night → warm
  interior → night → dawn. Transitions between beats can interpolate background colour; check text contrast
  at the midpoint, not just at both ends, and switch text colour at a point where both pairings pass.
- **One recurring motif** that transforms across beats: a line, a shape, a crop, a numeral. Continuity of the
  motif is what makes a sequence feel authored.
- **Shot sizes.** Wide (context, full-bleed) and close-up (detail, cropped hard) should alternate. Scale and
  crop are the web's camera.

| Film device | Web equivalent | Technique | Library recipes to confirm |
|---|---|---|---|
| Establishing shot | Full-bleed composition at rest | Static, server-rendered, LCP-safe | — |
| Push-in | Hero layer scales 1 → ~1.1 with scroll | Scrubbed transform | `parallax-depth-layers` |
| Match cut | A shape carries from one composition into the next | Shared element (FLIP, View Transitions) | `expanding-card-detail` (shared-element pattern) |
| Wipe | One beat reveals the next | `clip-path: inset()` scrubbed or triggered | `scroll-pin-chapters` (wipe), `fullscreen-menu-curtain` |
| Title card | One statement fills the frame | Large type, rest zone | `split-line-reveal`, `variable-weight-wave` |
| Montage | A run of images or facts | Horizontal passage or stepped chapters | `horizontal-scroll-gallery` |
| Line drawing | A diagram builds itself | SVG stroke offset | `svg-path-draw` |
| Rack focus | Attention shifts between layers | Cross-fade a pre-blurred copy; animated `filter: blur()` is costly on large areas | — |

No real imagery? Build with type, colour, SVG line art and CSS shapes. Never fill gaps with stock-like
abstraction or invented facts.

## 5. Large-type composition

- **Size.** Display type up to about 18 vw for editorial pieces, always with a rem term so zoom works:
  `font-size: clamp(3rem, 1rem + 11vw, 14rem);`. Pure `vw` sizes do not grow with page zoom (WCAG 1.4.4).
- **Composed line breaks.** Size display lines in container units (`cqi`) so the breaks you composed hold
  as the container scales. Let `text-wrap: balance` handle headings whose breaks you did not compose.
- **Leading and tracking.** Line-height 0.85–1.0 for display; tracking −0.02 to −0.05 em. Use the font's
  optical-size axis where it exists (`font-optical-sizing: auto`).
- **Descenders under masks.** Line masks clip descenders when leading is tight. Give the mask wrapper
  `padding-block-end: 0.12em; margin-block-end: -0.12em`.
- **Bleed safely.** Type that runs off the edge needs `overflow-x: clip` on its section, not `overflow:
  hidden`: `hidden` creates a scroll container and silently breaks any `position: sticky` inside it.
- **Casing.** Type normal case and apply `text-transform: uppercase`; some screen readers spell out words
  typed in capitals.
- **Type over image.** Contrast is measured at the worst point of the image and of every animation frame.
  Place type over calm regions or add a scrim. `mix-blend-mode` makes contrast unpredictable: test each beat.
- **Numerals as structure.** Oversized chapter numbers or dates make strong anchors; use tabular figures if
  they change in place.

## 6. Full-screen transitions

| Type | Use | Duration (tokens) | Reduced motion |
|---|---|---|---|
| Curtain / wipe | Brand moments, menu, chapter breaks | `slow`–`cinematic` (560–900 ms) | ≤ 200 ms fade |
| Cover (panel slides over) | Route change between sections of one story | `slow` | ≤ 200 ms fade |
| Zoom-through | An element grows to become the next view | `cinematic` | Cut |
| Shared element | A thumbnail becomes the hero of the next page | `moderate`–`slow` | Cut or fade |

Rules: the navigation commits immediately and the transition plays over it (input is never blocked); focus
moves to the new view's heading; the URL changes and Back reverses; nothing flashes large areas of white
between dark pages (set the background on `html`); `epic` (1400 ms) only for scripted, skippable intros.

View Transitions give a curtain with very little code. Feature-detect and check support for the project's
targets (cross-document transitions have narrower support than same-document ones); the library's
`viewTransition()` helper falls back to an instant update.

```css
@media (prefers-reduced-motion: no-preference) {
  ::view-transition-old(root) { animation: none; }            /* the old page holds still underneath */
  ::view-transition-new(root) {
    animation: curtain-in var(--s3-duration-cinematic, 900ms) var(--s3-ease-emphasized, ease-out) both;
  }
}
@keyframes curtain-in { from { clip-path: inset(100% 0 0 0); } to { clip-path: inset(0); } }
```

## 7. Dynamic navigation

| Device | Rules |
|---|---|
| Chapter index / progress rail | Real `nav` with buttons or links named after chapters; `aria-current="location"` on the current one; jumping works (`scroll-progress-rail`) |
| Skip links | "Skip intro" and "Skip to the end of the story" before any long pinned passage |
| Hide-on-scroll header | Hides on downward scroll, returns on any upward scroll and whenever focus is inside it; never covers focus (2.4.11); under reduced motion it appears without sliding |
| Full-screen menu | Focus trapped, background inert, `Esc` closes, focus returns (`fullscreen-menu-curtain`) |
| Deep links | Each beat has an `id`; on load with a hash, refresh scroll measurements first, then scroll; `scroll-margin-top` clears any sticky header |
| Custom cursor | Immersive profile, fine pointers only; the native cursor stays functional |

## 8. Layered depth

| Cue | Technique | Cost | Notes |
|---|---|---|---|
| Parallax | Layers move at depth-scaled rates with scroll | Transform only | `parallax-depth-layers` (one custom property drives all layers) |
| Scale | Near layers scale slightly as they pass | Transform | Pair with parallax for a dolly feel |
| Overlap | Foreground crosses text-free areas of the background | None | The cheapest depth cue there is |
| Aerial perspective | Far layers lower in contrast, tinted toward the background | None | Keeps far layers from competing with copy |
| CSS 3D | Planes at different `translateZ` under one perspective | Composited layers | `layered-depth-stack`; fine pointers only for pointer tilt |

Rules: three to five planes; layer travel proportional to depth and capped (Expressive: one layer, ≤ 10 %
relative travel; Immersive: several, still modest); oversize layers inside an `overflow: clip` frame so edges
never show; never parallax text the visitor is reading; every moving layer is `aria-hidden`; reduced motion
removes parallax entirely (tier 1).

## 9. Checklist

- [ ] The image, the line and the feeling are named before building.
- [ ] Beat sheet complete: message, anchor, length, in/out, reduced form and content source for every beat.
- [ ] The static document reads correctly in beat order; it is the accessibility tree.
- [ ] Every beat has a rest zone; no pinned stretch over about 3 vh without new content.
- [ ] Beat 1 text visible without script; beat 5 action static and immediately usable.
- [ ] Colour transitions checked for contrast at their midpoints.
- [ ] Chapters deep-linkable; skip links before long passages; focus never hidden by pinned layers.
- [ ] No invented facts, figures or quotes; draft copy marked.
