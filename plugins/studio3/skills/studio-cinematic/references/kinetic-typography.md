# Kinetic typography — splitting, variable fonts, masks and timing

Load for animated or oversized type. Large-type composition is in `playbook.md` §5; scroll mechanics are in
`scroll-choreography.md`.

## 1. What type motion may do

| Job | Example | Rule |
|---|---|---|
| Reveal | A headline rises from a line mask | Plays once, ends in a still, fully legible state |
| Emphasis | One word gains weight or colour | One word per view; the rest stays still |
| Transformation | Glyphs resolve into the final string (`scramble-decode`) | The accessible text is always the final string |
| Rhythm | A marquee or ticker band (`kinetic-marquee`) | Visible pause control (2.2.2); duplicates hidden from assistive tech |
| Response | Weight follows pointer, focus or scroll (`variable-weight-wave`) | Keyboard equivalent; never drops below a legible weight |

Motion happens before or after reading, never during. The marquee is the only exception, which is why it
must be pausable.

## 2. Split strategies

| Unit | Use for | Length limit | Re-split on resize? | Notes |
|---|---|---|---|---|
| Lines | Display subheads, two- to five-line statements, mask reveals | ≤ 5 lines | Yes: breaks change with width and font load | Fewest nodes for longer text |
| Words | Headlines | ≤ about 12 words | No: words wrap naturally | The default |
| Characters | Short display lines, decode effects, per-letter weight | ≤ about 25 characters | No | Breaks kerning and ligatures. Never for scripts that join or shape (Arabic, Devanagari, Thai and others): split those by words or lines |
| Nothing | Body copy, UI labels, anything read at reading speed | — | — | Do not split |

Segment with `Intl.Segmenter`, never `text.split('')`, which breaks emoji, surrogate pairs and combining
marks. Word segmentation is required for languages written without spaces.

```ts
export const graphemes = (text: string, locale?: string): string[] =>
  [...new Intl.Segmenter(locale, { granularity: 'grapheme' }).segment(text)].map((s) => s.segment);

export const wordSegments = (text: string, locale?: string) =>
  [...new Intl.Segmenter(locale, { granularity: 'word' }).segment(text)]; // s.isWordLike marks words; keep separators as text
```

### Exactly one accessible copy

**Pattern A: headings.** The heading carries the sentence in `aria-label`; the split spans are hidden.

```html
<h2 aria-label="Six stops, one night">
  <span aria-hidden="true"><span class="mask"><span data-w>Six</span></span> <span class="mask"><span data-w>stops,</span></span> …</span>
</h2>
```

**Pattern B: everything else.** `aria-label` is not supported on paragraphs and generic elements (ARIA 1.2
prohibits naming those roles, and screen readers ignore it inconsistently). Render a visually hidden copy and
hide the visual one.

```html
<p class="kinetic">
  <span class="sr-only">The kiln stays shut for a day and a half.</span>
  <span class="kinetic-visual" aria-hidden="true"><!-- split spans --></span>
</p>
```

Rules for both: keep spaces as real text between spans so copy and paste yields normal text; never fix span
widths in px (text zoom and user text-spacing overrides, 1.4.4 and 1.4.12, must not break the layout); the
only fixed widths allowed are `1ch` cells for decode effects in a monospaced or tabular face.

### GSAP SplitText

SplitText ships in the public `gsap` package (same licence as the rest of GSAP; see shared
`technology-selection.md` rule 7). Import it from `gsap/SplitText` and register it once with
`gsap.registerPlugin(SplitText)`.

- `mask: 'lines'` (or `'words'`, `'chars'`) wraps each piece in a clipping wrapper for reveals.
- `autoSplit: true` re-splits after fonts load and when the width changes. Return the animation from
  `onSplit` so a re-split can revert and rebuild it.
- `aria: 'auto'` (the default) adds `aria-label` to the split element and `aria-hidden` to the pieces: right
  for headings (pattern A). For a paragraph, split an `aria-hidden` visual duplicate with `aria: 'hidden'` and
  keep the visually hidden copy (pattern B).

```tsx
useGSAP(() => {
  if (reduced) return;
  const split = SplitText.create(titleRef.current, {
    type: 'lines', mask: 'lines', autoSplit: true,
    onSplit: (self) => gsap.from(self.lines, {
      yPercent: 110, duration: sec(duration.slow), stagger: sec(stagger.loose), ease: gsapEase.emphasized,
    }),
  });
  return () => split.revert();
}, { scope: root, dependencies: [reduced], revertOnUpdate: true });
```

### Without GSAP

Split in render and sequence with the Web Animations API, as `split-line-reveal` does. Start the entrance as
the beat approaches the viewport (`useInView` with a positive margin), so the hidden state is applied
off-screen and never flashes.

```tsx
const ref = useRef<HTMLHeadingElement>(null);
const near = useInView(ref, { margin: '0px 0px 20% 0px' });
const { reduced, scale } = useStudioMotion();

useEffect(() => {
  const words = ref.current?.querySelectorAll<HTMLElement>('[data-w]');
  if (!near || reduced || !words?.length) return;
  const seq = createSequence({ durationScale: scale.duration }).add(
    words,
    [{ transform: 'translateY(110%)' }, { transform: 'none' }],
    { duration: duration.slow, easing: 'emphasized', stagger: stagger.base * scale.stagger },
  );
  seq.play();
  return () => seq.cancel();
}, [near, reduced, scale]);
```

```css
.mask { display: inline-block; overflow: clip; vertical-align: top;
        padding-block-end: 0.12em; margin-block-end: -0.12em; }   /* room for descenders */
[data-w] { display: inline-block; }
```

## 3. Variable fonts

| Axis | CSS | Animate with | Layout cost |
|---|---|---|---|
| `wght` | `font-weight` | Transition or WAAPI on `font-weight` | Glyph widths change: reflow |
| `wdth` | `font-stretch` | Same | Reflow |
| `slnt` / `ital` | `font-style: oblique 10deg` / `italic` | Transition | Small reflow |
| `opsz` | `font-optical-sizing: auto` | Rarely animated | — |
| Custom (`GRAD` and others) | `font-variation-settings`, one registered custom property per axis | `@property` + transition | Grade axes are usually designed to change weight without changing width: check the font |

- Declare ranges in `@font-face` (`font-weight: 100 900; font-stretch: 75% 125%;`) or the browser clamps or
  synthesises.
- Prefer the high-level properties. `font-variation-settings` is one property: setting it replaces every axis,
  so drive each custom axis through its own custom property.
- Lock lines before animating weight or width: measure the breaks at rest and render each line
  `white-space: nowrap`, so changes cannot re-break the block (`variable-weight-wave` does this).
- Keep weight animation to short display lines; each frame costs layout and paint.
- `font-synthesis: none` on display faces so a missing axis never produces faux bold or italic.
- Choose a rest weight that stays legible over its background. Hairline weights fail in practice even when the
  contrast ratio passes.

```css
@property --grad { syntax: '<number>'; inherits: true; initial-value: 0; }
.title { font-variation-settings: 'GRAD' var(--grad); }
@media (prefers-reduced-motion: no-preference) {
  .title { transition: --grad var(--s3-duration-base, 240ms) var(--s3-ease-standard, ease); }
}
a:hover .title, a:focus-visible .title { --grad: 150; }   /* stay inside the font's GRAD range */
```

## 4. Masks and type effects

| Effect | Technique | Cost | Accessibility and contrast |
|---|---|---|---|
| Rise from a line mask | Wrapper `overflow: clip`; piece `translateY(110%) → 0` | Compositor | Pad the wrapper for descenders (§2 CSS) |
| Wipe | `clip-path: inset(0 100% 0 0) → inset(0)` | Usually cheap | Follow reading direction; mirror for RTL |
| Gradient sweep across type | `background-clip: text` with animated `background-position` | Paint per frame | Set a solid `color` fallback; contrast at the darkest and lightest point |
| Image or video inside type | `background-clip: text`, or SVG text with a pattern fill | Heavy for video | Contrast varies per frame; solid ink under reduced motion |
| Outline type | `-webkit-text-stroke` | Paint | Thin strokes have little contrast mass: display sizes only, never the reading state |
| Blend knockout | `mix-blend-mode: difference` | Composite | Contrast is unpredictable; check every rest state |
| Decode | Fixed `1ch` cells, glyph churn | Text updates only | Small areas only; final string announced once |
| Text on a path | SVG `<textPath>` | Low | Keep it real text; give the SVG a `<title>` |

## 5. Timing

Use the motion tokens (`duration`, `stagger`, `easing` in the motion module; `--s3-*` in CSS) scaled by the
profile; do not hard-code new numbers.

| Unit | Per-unit duration | Stagger | Typical total (Expressive) |
|---|---|---|---|
| Characters (≤ 25) | `moderate` 360 ms | `tight` 24 ms | ≈ 0.9 s |
| Words (≤ 12) | `slow` 560 ms | `base` 48 ms | ≈ 1.1 s |
| Lines (≤ 5) | `slow`–`cinematic` 560–900 ms | `loose` 90 ms | ≈ 1.3 s |
| Title card | `cinematic` 900 ms | `dramatic` 140 ms between lines | ≤ 1.5 s, then a hold |
| Exit, any unit | 60–70 % of the entrance | Half the entrance stagger, or none | — |
| Decode | 1–1.6 s for a short line; churn every 40–60 ms | Left-to-right sweep | ≤ 1.6 s |
| Weight following input | Direct, or `fast` 160 ms smoothing | — | — |
| Marquee | Roughly 40–120 px/s | — | Continuous: pause control |

- Total = duration + (n − 1) × stagger. Keep (n − 1) × stagger no longer than one unit's duration, so the
  pieces overlap and read as one gesture. If it does not fit, split coarser (characters → words) instead of
  shrinking the stagger below about 12 ms, where it becomes imperceptible.
- Profiles: Immersive scales durations × 1.25 and staggers × 1.2; Expressive allows one orchestrated headline
  entrance above the fold; Essential has no split entrances.
- Easing: entrances `enter` or `emphasized` (decelerate); exits `exit` (accelerate); on-screen moves
  `standard` or `inOut`; loops `linear`; `overshoot` only for playful brands and never on reading text.
- Holds: after an entrance, leave the line still for about (words ÷ 4) + 1 seconds, or a scroll rest zone of
  about 0.5 vh per short line.

## 6. Scroll-linked type

- Scale and move type with `transform`, never `font-size` or `letter-spacing` per frame (both force layout).
  If tracking must change, animate the pieces' transforms or trigger a short transition instead of scrubbing.
- The fully legible state sits in the beat's rest zone. Two readable texts never overlap mid-transition.
- Outline-to-fill or blur-to-sharp sequences: the intermediate states are not reading states; keep them short.

## 7. First paint and fonts

- Beat 1's text is visible at first paint. Never start it from `opacity: 0` or a fully closed mask. If it must
  move, start from a visible state (a one-word weight change, a rule drawing beneath it) or animate the
  elements around it.
- Split after `document.fonts.ready`, or use SplitText `autoSplit`; metrics change when the web font arrives.
  Metric-compatible fallbacks (`size-adjust`, `ascent-override`) limit the reflow (shared `performance.md` §4).

## 8. Reduced motion and safety

| Effect | Reduced-motion form |
|---|---|
| Split entrances | Final state immediately (tier 1); a state change may cross-fade ≤ 200 ms (tier 2) |
| Decode | Final string immediately |
| Weight wave, pointer response | Static, single mid weight |
| Marquee | Static rails, no loop |
| Scrubbed type | Normal flow, no scrub |

- Glyph churn stays in small areas. No full-frame strobing, rapid inversion or hard white flashes (2.3.1).
- Anything moving by itself for more than five seconds has a pause control (2.2.2).
- Directional sweeps follow the document direction: use logical properties and mirror under `:dir(rtl)`.

## 9. Checklist

- [ ] Split unit chosen by length and script; `Intl.Segmenter` used for characters and spaceless languages.
- [ ] Exactly one accessible copy: pattern A on headings, pattern B elsewhere; decode exposes the final string.
- [ ] Beat 1 text visible at first paint; later entrances start as they approach the viewport.
- [ ] Lines re-split after fonts load and on resize; SplitText instances reverted on unmount.
- [ ] Variable-font animation limited to short display lines with locked lines; axis ranges declared.
- [ ] Timings come from tokens and the profile scale; every entrance ends in a hold.
- [ ] Contrast checked at every rest state, including outline, gradient and blend effects.
- [ ] Reduced motion matches §8; pause control on every continuous loop.
