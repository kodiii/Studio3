# Data Studio demos

Four reference compositions live in the library at
`${CLAUDE_PLUGIN_ROOT}/library/src/demos/data/<id>/` (fallback `../../library/src/demos/data/<id>/` from this
skill's folder). Each has a `meta.ts` (summary, highlights, recipes, accessibility, reduced-motion and performance
notes, and a `dataNote` on how its data is simulated) and an `index.tsx`, and meets the craft floor for its profile
(`${CLAUDE_PLUGIN_ROOT}/shared/motion-craft.md` §1) as described below.

Every number comes from a seeded generator, is labelled as simulated or sample data on screen and describes nothing
real. Study demos for structure, states and integrity; do not paste them wholesale.

**The catalogue is the source of truth.** None of these demos imports a recipe (`uses` is empty); `adapts` lists the
recipes whose technique each rebuilds against its own data. Confirm before citing:

```
maquettekit catalog list --kind demos
maquettekit catalog show financial-dashboard
maquettekit catalog show financial-dashboard --source
```

## 1. Overview

| Demo id | Proves | Profile | 3D | Load it when the task is |
|---|---|---|---|---|
| `financial-dashboard` | A dense fund view where one window drives every panel | Essential | No | Trading, portfolio, fund or finance views |
| `live-monitoring` | A one-second stream that stays calm and can be paused | Essential | No | Observability, SRE, agent and LLM run monitoring |
| `data-exploration` | Linked views, two-dimensional brushing and drill-down, with a table one control away | Expressive | No | BI, analytics, statistics explorers, reports |
| `spatial-data-viz` | A 3D view that earns its place, with an equivalent 2D grid and a table | Expressive | Yes | Gridded or geospatial readings (networks: `studio-3d`'s `spatial-data`) |

## 2. `financial-dashboard` — Fernhollow fund terminal

End-of-day analytics for a fictional fund: alerts first, KPI figures, a growth-of-£100 chart over a brushable
three-year history, allocation drift against target bands, attribution that reconciles exactly to the fund's return,
and positions. Alerts come from stated rules (drift beyond ±2 pp, a move beyond 3× the 60-day standard deviation, a
drawdown watch).

- **Signature move:** one window drives everything. Range presets morph the chart (values and y-domain together);
  dragging the brush re-derives KPIs, allocation and attribution directly, with no tween under the hand.
- **Physical and lit:** Essential timing, token durations × 0.7 (range morph 252 ms, digit roll 168 ms); controls
  press instantly and release in one tick; the chart readout is the only raised surface.
- **Alive:** KPI digits roll only on discrete changes, on whole-cell reels; deltas carry ▲/▼ and a sign.
- **Touchable:** drag the brush window or either edge. Twins: all three are `role="slider"` controls with date
  values; the chart is a focusable slider (←/→ a trading day, Page Up/Down a week) whose value text reads every
  series.
- **Reduced motion:** ranges cut, digits swap, bars jump; crosshair, brush and table behave the same.
- **Recipes:** adapts `line-chart-morph` (range morph), `brush-linked-range` (brush) and `number-ticker` (KPIs).

**Copy:** `data.ts` behind one function (`simulateFund()` is all a real feed replaces); every range resampled once to
640 points, so a morph frame is one array lerp per series; the positions table (`aria-sort`, a frozen first column,
sideways scroll that never holds the wheel). Pair with `playbook.md` §5 and §10.

## 3. `live-monitoring` — Switchyard agent fleet

Simulated monitoring of a fictional freight company's AI-agent fleet: a one-second seeded stream, status cells with
sparklines, anomaly rules whose events state the rule and the numbers, an event log that holds still while read, and
a pause that freezes the view while data keeps arriving.

- **Signature move:** calm by design. The only self-moving element is one token-timed ring on the status lamp per
  received tick; KPI numbers jump on purpose; nothing re-sorts or flashes.
- **Physical:** Pause, window segments, agent cells and buttons have hover, instant pressed and focus states with
  one-tick releases (Essential tokens × 0.7).
- **Alive:** switching the 1/5/15-minute window morphs values and domain together; live ticks redraw directly.
- **Touchable:** selecting an agent swaps the fleet chart for its p95 with an expected band and anomalous spans.
  Agent cells are buttons with their readout as text; "View as table" lists every agent; the log freezes under
  pointer or focus and offers "Show N new".
- **Reduced motion:** the lamp stops ringing and window changes cut; values still update every second unless paused.
- **Recipes:** adapts `line-chart-morph` (window morph).

**Copy:** `sim.ts`, a stateless stream (each sample a pure function of seed, agent and second, so history, catch-up
and live ticks agree; `sampleAt()` is all a real client replaces); the designed states (connecting, live, paused with
"N s behind", stale, an agent with no samples rather than zeros); one polite region announcing new anomalies at most
once every 15 seconds. Pair with `motion-for-data.md` §6 and `playbook.md` §11.

## 4. `data-exploration` — Four Valleys lot explorer

Exploration of 327 sample coffee lots from four fictional regions: facets with counts, a linked scatter, histogram
and ranked dot plot, drill-down from region to farm, A/B comparison and a shareable URL. One selection drives every
view; the summary calls the altitude–score relation an association in sample data, never a cause.

- **Signature move:** a brush you can throw. Held, it follows the hand 1:1 and rubber-bands past the axis ends;
  released, it keeps the hand's velocity, glides with friction and lands on the snapped value on `spring.release`.
  Only the drawing springs: the selection is always the snapped value.
- **Physical and lit:** drilling down, the children emerge from the chosen row, staggered by rank; within a level,
  rows glide to their new rank. One light, top left: the pinned lot lifts off the paper; controls lift toward the
  light and sink at once on press.
- **Alive:** a halo with axis guides and exact readouts glides from mark to mark on `spring.press` as the pointer or
  keyboard cursor moves.
- **Touchable:** brush with a rectangle on the scatter, a drag across the histogram or the range handles. Twins: each
  brush is three `role="slider"` controls; the focused scatter steps through the selected lots (Enter pins); the lots
  table is the full alternative.
- **Reduced motion:** no entrance, glide or springs; brushes and halo sit exactly at their values.
- **Recipes:** adapts `brush-linked-range` (brushes), `bar-race-transition` (rank glides), `flip-grid-reorder`
  (drill-down) and `press-depth-button`.

**Copy:** `RangeBrush.tsx` with `physics.ts` (springs, rubber band and release velocity); the selection model (facets
and drill path set what is in view, brushes select within it). Pair with `interaction-patterns.md` §1 and
`motion-for-data.md` §2.

## 5. `spatial-data-viz` — Saddleback snow survey

A fictional plateau's 384 snow-depth sensors as instanced 3D bars where height is the reading, with an equivalent 2D
heatmap, a table, a 30-day playback on request, and copy on when the flat view is more accurate and what 3D is for.
Built on `StudioCanvas`, `OrbitInspect` and `CameraRig`, with `studio-3d`.

- **Signature move:** depth carries the data: 384 bars in one instanced draw call, heights and colours interpolated
  together between days (values, not pixels).
- **Lit:** one light high in the north-west, where the page's control shadows come from. Top faces show the exact
  colour of the reading, side faces carry the form, and a soft shadow falls on the ground only, never on a bar.
- **Physical and alive:** the orbit keeps inertia; playback steps through the days on request, each change tweened
  as values; controls lift, sink at once on press and spring back.
- **Touchable:** orbit by pointer, or arrows, `+`/`−` and `0` on the focused scene. Twin: the 2D map, a
  `role="grid"` (arrows, Home/End, Enter pins) sharing the pinned sensor with the scene.
- **Reduced motion:** heights, colours and presets cut; playback still steps one day per 0.9 s once Play is pressed.
- **Recipes:** adapts `press-depth-button`; the scene is three-kit components, not recipes.

**Copy:** `BarField.tsx` (lighting injected into an unlit material, so the data colour never shifts; a 102 × 70
shadow canvas redrawn only when heights change); offline sensors as hatched "no reading" cells, never zeros; the 2D
map as the accurate view, not a lesser fallback. Pair with `spatial-data.md` §2 and §7.

## 6. Using a demo as a starting point

1. Read `meta.ts` first: highlights, `adapts`, `dataNote`, accessibility and reduced-motion notes say what to keep.
2. Write the user's own question inventory (`playbook.md` §1); never inherit a demo's panels because they exist.
3. Rebuild the relevant ideas with the project's tokens (`maquettekit.design.json`), delegating recipe adaptation to
   `studio-components`. Lift `adapts` techniques from the demo's files: the recipes render their own seeded or preset
   data.
4. Swap the generator for the user's source behind the same interface (`simulateFund()`, `sampleAt()`); until then
   the simulated-data labels stay.
5. Keep each slider, grid or table twin and each reduced-motion form, and keep tweens off values under the hand.
6. Do not inherit the demo's visual direction, and re-check density and breakpoints in the real layout: demos are
   written for the library's container-query preview stage.
7. If the project is not React, treat the demo as a specification: questions, encodings, states, timings and
   accessibility carry over; the code does not.
