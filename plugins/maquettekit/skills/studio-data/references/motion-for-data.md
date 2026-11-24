# Motion for data — constancy, emphasis, playback

Load for any transition between data states, any live update, any playback. Motion in data interfaces is a
reading aid. If a transition does not help the reader track, compare or notice, cut it.

## 1. The three jobs

| Job | Example | Not this |
|---|---|---|
| **Constancy**: the same datum stays identifiable across a change | Bars re-sort and the reader follows "Lisbon" to its new rank | Every bar fading out and new ones fading in |
| **Emphasis**: draw attention to what changed | A cell tints briefly when its value updates | A pulsing dashboard that never stops |
| **Playback**: show change through time, on request | A ranked chart steps through months with play, pause and step controls | A chart that animates itself on page load |

Never animate a dashboard's initial load. The first paint shows the data; readers who open a dashboard fifty
times a day must not wait for an entrance fifty times.

## 2. Object constancy and keyed transitions

- **Key by identity, never by index.** React `key={d.id}`; D3 `selection.data(rows, (d) => d.id).join(...)`.
  Index keys make the third bar morph into whatever is third next, which tells a false story.
- **Enter, update, exit are three different motions.** Enter from the baseline or from the parent's position;
  update interpolates; exit fades and shrinks toward the baseline. Enter and exit are shorter than update.
- **Interpolate data, not geometry.** Tween the values and the scale domain, then redraw marks from them, so
  every frame is a truthful chart. Bars and their axis move together, so length is honest on every frame
  (`bar-race-transition` does this).
- **Lines with different point counts:** resample both series to a shared resolution once, then interpolate
  arrays (`line-chart-morph` does this). Tweening path strings between different point counts tears the line.
- **Axes:** interpolate the domain; ticks are keyed by value and cross-fade in and out; gridlines follow.
- **Drill-down:** the clicked mark grows into the container of its children (or the children emerge from
  it); going back reverses the motion exactly.
- **Retarget from the current state.** When a new update arrives mid-transition, start from the values on
  screen now, not from the old target; nothing jumps.

```ts
import { easeCubicOut } from 'd3';

/** Retargetable tween of numeric arrays; `draw` writes attributes or paints a canvas. */
export function createValueTween(draw: (values: Float64Array) => void) {
  let raf = 0;
  let current = new Float64Array(0);
  return {
    to(target: Float64Array, ms: number, reduced: boolean) {
      cancelAnimationFrame(raf);
      // Cut when motion is off, instant, or identities changed (different lengths).
      if (reduced || ms <= 0 || current.length !== target.length) { current = target.slice(); draw(current); return; }
      const from = current.slice();
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / ms);
        const k = easeCubicOut(t);
        for (let i = 0; i < target.length; i++) current[i] = from[i] + (target[i] - from[i]) * k;
        draw(current);
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    },
    cancel: () => cancelAnimationFrame(raf),   // call on unmount
  };
}
```

Use refs and direct attribute writes (or a canvas) inside `draw`; never set React state per frame.

## 3. Staggering by meaning

A stagger implies an order. Use it only when the order carries meaning, and in that order.

| Stagger by | When | Example |
|---|---|---|
| Time | The series is temporal | Columns grow left to right, oldest first |
| Rank or magnitude | The reader should read top-down | Largest bar settles first |
| Hierarchy | Parent before children | A segment splits, then its children appear |
| None | Live updates, filters, anything frequent | All marks move together |

- Keep the whole stagger short: about 300 ms in total for up to 20 items (`stagger.tight` 24 ms or less per
  item); beyond about 30 items, stagger groups rather than marks, or not at all.
- Never stagger in DOM order when it differs from data order.

## 4. Durations by change and data size

Use the motion tokens, scaled by the profile (Essential × 0.7 by default for data).

| Change | Duration token | Notes |
|---|---|---|
| Crosshair, hover highlight, brushing | None: follows input directly | Smoothing of a few frames at most |
| Tooltip appear / disappear | `instant` 90 ms or none | Never delay information behind a fade |
| Small value update | `fast` 160 ms – `base` 240 ms | Numbers via `number-ticker`, at most `base` |
| Filter: enter and exit of marks | `base` 240 ms – `moderate` 360 ms | Exit shorter than enter |
| Re-sort, re-rank, axis rescale | `moderate` 360 ms – `slow` 560 ms | Marks and axis together |
| Drill-down, zoom between levels | `moderate` 360 ms – `slow` 560 ms | Reversible with Back |
| Change of encoding (grouped ↔ stacked bars) | `slow` 560 ms | Only when the mapping is continuous; otherwise cut |
| Playback step | User-controlled; about 600–1200 ms per period | `bar-race-transition` defaults to 900 ms |

Size limits (guidance, measure on target devices): beyond roughly a thousand SVG marks, stop tweening marks
individually: cut, or animate on canvas; beyond a couple of hundred marks, drop the stagger.

## 5. When to cut instead of tween

| Situation | Cut because |
|---|---|
| The metric, unit or chart type changes (revenue → users; bars → map) | There is no meaningful in-between state; a morph implies a relationship that does not exist |
| Identities do not persist (a different query, a different entity set) | Constancy would track things that are not the same things |
| The user is scrubbing, brushing or dragging | Input must feel direct; easing after the hand feels like lag |
| Updates arrive faster than the transition | The chart would never be at rest; show the latest state |
| The tween would pass through misleading states | A bar briefly exceeding its axis, a pie slice inverting |
| Very large mark counts | Frame drops make the motion itself misleading |
| Reduced motion | Tier 2: cut or cross-fade ≤ 200 ms |

## 6. Live updates without distraction

- **Emphasise briefly, then rest.** A changed cell tints toward `success-subtle` or `danger-subtle` and
  fades back over about 400–800 ms, with a ▲/▼ glyph that stays until the next change. Colour is never the
  only cue.
- **Throttle per cell.** At most one highlight per cell per second, however fast the feed. Small tints are
  unlikely to meet the flash definition (2.3.1) alone, but many cells pulsing together can: cap simultaneous
  highlights and never pulse large areas.
- **Do not move what the reader is reading.** Rows do not re-sort on every tick. Offer "Sort live" as an
  opt-in, or re-sort on an interval with a "Sorting paused while you hover" note.
- **Freeze under the pointer and focus.** While the pointer or focus is inside a live table or chart, pause
  visual updates there (keep buffering data) and show "Paused while you inspect"; resume on leave. Targets
  must not move under a click.
- **New rows** appear without shifting the reading position: a "12 new rows" button, or insertion above
  with scroll anchoring kept.
- **Sparklines** advance by redrawing at the new window; at high frequency, redraw at most a few times per
  second rather than animating the shift.
- **Screen readers** hear thresholds and summaries, never every tick (shared `accessibility.md`).

```css
@media (prefers-reduced-motion: no-preference) {
  .cell[data-tick='up']   { animation: tick-up 600ms var(--mk-ease-standard, ease-out) 1; }
  .cell[data-tick='down'] { animation: tick-down 600ms var(--mk-ease-standard, ease-out) 1; }
}
@keyframes tick-up   { from { background-color: var(--mk-color-success-subtle, #e3f4e8); } to { background-color: transparent; } }
@keyframes tick-down { from { background-color: var(--mk-color-danger-subtle, #fbe5e1); } to { background-color: transparent; } }
/* Re-trigger by toggling data-tick off and on in the next frame, at most once per second per cell. */
```

## 7. Playback controls

| Control | Requirement |
|---|---|
| Play / Pause | A real button with a stable name and `aria-pressed`, or a label that changes between "Play" and "Pause"; never autoplay by default |
| Step back / forward | Buttons; arrow keys when the scrubber is focused |
| Scrubber | `<input type="range">` with `aria-valuetext` naming the period ("March 2026") |
| Speed | 0.5×, 1×, 2× as a radio group |
| Current period | Large text label, tabular figures, outside the animated area |
| Announcement | A polite status message after manual steps and when playback ends, not on every autoplay tick |
| Loop | Off by default; continuous loops longer than five seconds need the pause control anyway (2.2.2) |

## 8. Reduced motion

| Tier | Data examples | Under reduced motion |
|---|---|---|
| 1. Remove | Decorative entrances, ambient pulses, "live" shimmer | Gone |
| 2. Replace | Re-sort, filter, rescale, drill-down, value updates | Cut, or a ≤ 200 ms opacity cross-fade |
| 3. Behind control | Playback of time, animated explanations | Runs only after the user presses Play; steps are instant |

Update highlights become a static marker (glyph or outline) without the fading tint.

## 9. Implementation notes

- One rAF loop per chart at most; cancelled on unmount and when the chart is off-screen.
- D3 transitions (`d3-transition`) only in framework-free code or inside a ref-owned subtree React never
  renders into (shared `technology-selection.md` §3); never both on the same nodes.
- CSS can transition `transform`, `opacity` and `fill` on SVG elements; do not rely on CSS transitions of the
  path `d` property, which is not supported in every engine. Interpolate paths in script.
- Transitions read the `reduced` flag from `useStudioMotion()` (or `matchMedia` outside React) at the moment
  they start, so turning reduced motion on takes effect immediately.

## 10. Checklist

- [ ] No entrance animation on load; first paint shows the data.
- [ ] Marks keyed by stable ids; enter, update and exit designed separately; transitions retarget smoothly.
- [ ] Values and domains interpolated together; every frame is a truthful chart.
- [ ] Staggers follow data order and stay short; none on live updates.
- [ ] Durations from tokens per §4; cuts where §5 applies.
- [ ] Live highlights throttled, paired with glyphs, paused under pointer and focus; no re-sorting under the reader.
- [ ] Playback off by default, fully controllable by keyboard, announced sparingly.
- [ ] Reduced motion per §8.
