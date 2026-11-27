import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'financial-dashboard',
  name: 'Fernhollow fund terminal',
  specialty: 'data',
  summary: 'End-of-day analytics for a fictional multi-asset fund: alerts first, rolling KPI figures, a growth-of-£100 chart that morphs between ranges and follows a brushable three-year history, allocation drift against target bands, return attribution that reconciles, and a sortable positions table.',
  highlights: [
    'One window drives everything: range presets morph the chart (values and y-domain interpolated at a shared resolution, as in line-chart-morph); dragging the three-year brush (the brush-linked-range pattern) re-derives the KPIs, allocation and attribution directly, without tweening under the hand.',
    'KPI figures roll digit by digit (the number-ticker technique) only on discrete changes, on exact geometry: every digit cell is the same height with no gaps and reels move in whole cells, so no frame shows a half digit at rest; the ticker’s classes are prefixed so they cannot collide with the brush strip. Each tile pairs its value with a comparison and a period; deltas carry ▲/▼ and a sign, with the gain/loss colours switchable for markets that show rises in red.',
    'Essential profile throughout: token durations × 0.7 with standard easing (range morph 252 ms, digit roll 168 ms, bars 168 ms); held arrow keys and drags cut instead of rolling; buttons, segments, rows, sort headers and brush handles have instant pressed states and one-tick releases; the chart readout is the only raised surface.',
    'Alerts are derived from rules run on the data (drift beyond a ±2 pp band, a move beyond 3× the 60-day standard deviation, a drawdown watch with open/clear thresholds) and sit at the top, by urgency, with severity as word, shape and colour.',
    'Return attribution lists each sleeve’s contribution plus fees and compounding, so the rows reconcile exactly to the fund’s return.',
    'Selecting a position plots it, rebased, against the fund; selecting a sleeve filters the table — linked views without a separate mode.',
  ],
  technology: ['d3', 'svg', 'waapi', 'css'],
  uses: [],
  adapts: ['line-chart-morph', 'brush-linked-range', 'number-ticker'],
  has3d: false,
  accessibility: [
    'The chart is a focusable slider: ←/→ step a trading day, Page Up/Down a week, Home/End jump, Esc hides the readout; aria-valuetext reads the date and every series.',
    'The brush window and both of its edges are role="slider" controls with date values; presets are a native radio group.',
    'A computed text summary sits under the chart and is announced politely after each committed range change (not while dragging); “View as table” shows the same values.',
    'Positions: sortable headers expose aria-sort; one row button is in the tab order and ↑/↓/Home/End move between rows; the wide table scrolls sideways inside its own labelled region with a frozen first column, and never holds the wheel — page scrolling continues over every table.',
    'Acknowledging an alert moves focus to its “Acknowledged” confirmation instead of dropping it on the page.',
    'Nothing relies on colour alone: series differ by weight and dash, severities by word and shape, deltas by sign and arrow, out-of-band sleeves by an icon and text.',
  ],
  reducedMotion: 'Range changes cut to the new chart instead of morphing, KPI digits swap without rolling, allocation and attribution bars jump, and pressed states apply without a release transition; crosshair, brush and table behave the same.',
  performance: [
    'Every range is resampled once to 640 points, so a morph frame is one array lerp per series and three path strings; the rAF loop runs only during a morph.',
    'Brush drags recompute the window statistics (≤ 785 days) synchronously — well under a frame — and never start a tween or a bar transition.',
    'Digit reels animate with transform-only WAAPI and collapse back to one cell when they finish; press states are CSS transitions only.',
  ],
  dataNote: 'Simulated: a seeded five-sleeve factor model (seed 366) with fees, quarterly rebalancing and a 60/40 composite built from the same sleeves; twelve invented instruments follow their sleeve plus noise. Weekdays only, UTC. Not a real fund, not real prices, not advice.',
};
