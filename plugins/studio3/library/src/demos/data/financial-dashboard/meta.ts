import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'financial-dashboard',
  name: 'Fernhollow fund terminal',
  specialty: 'data',
  summary: 'End-of-day analytics for a fictional multi-asset fund: alerts first, rolling KPI figures, a growth-of-£100 chart that morphs between ranges and follows a brushable three-year history, allocation drift against target bands, return attribution that reconciles, and a sortable positions table.',
  highlights: [
    'One window drives everything: range presets morph the chart (values and y-domain interpolated at a shared resolution, as in line-chart-morph); dragging the three-year brush (the brush-linked-range pattern) re-derives the KPIs, allocation and attribution directly, without tweening under the hand.',
    'KPI figures roll digit by digit (the number-ticker technique) only on discrete changes; each tile pairs its value with a comparison and a period, and deltas carry ▲/▼ and a sign, with the gain/loss colours switchable for markets that show rises in red.',
    'Alerts are derived from rules run on the data (drift beyond a ±2 pp band, a move beyond 3× the 60-day standard deviation, a drawdown watch with open/clear thresholds) and sit at the top, by urgency, with severity as word, shape and colour.',
    'Return attribution lists each sleeve’s contribution plus fees and compounding, so the rows reconcile exactly to the fund’s return.',
    'Selecting a position plots it, rebased, against the fund; selecting a sleeve filters the table — linked views without a separate mode.',
    'The chart, overview and KPI patterns are local, data-driven adaptations of the line-chart-morph, brush-linked-range and number-ticker recipes, whose components ship their own sample datasets.',
  ],
  technology: ['d3', 'svg', 'waapi', 'css'],
  uses: ['line-chart-morph', 'brush-linked-range', 'number-ticker'],
  has3d: false,
  accessibility: [
    'The chart is a focusable slider: ←/→ step a trading day, Page Up/Down a week, Home/End jump, Esc hides the readout; aria-valuetext reads the date and every series.',
    'The brush window and both of its edges are role="slider" controls with date values; presets are a native radio group.',
    'A computed text summary sits under the chart and is announced politely after each committed range change (not while dragging); “View as table” shows the same values.',
    'Positions: sortable headers expose aria-sort; one row button is in the tab order and ↑/↓/Home/End move between rows; the wide table scrolls inside its own labelled region with a frozen first column.',
    'Nothing relies on colour alone: series differ by weight and dash, severities by word and shape, deltas by sign and arrow, out-of-band sleeves by an icon and text.',
  ],
  reducedMotion: 'Range changes cut to the new chart instead of morphing, KPI digits swap without rolling and allocation bars jump; crosshair, brush and table behave the same.',
  performance: [
    'Every range is resampled once to 640 points, so a morph frame is one array lerp per series and three path strings; the rAF loop runs only during a morph.',
    'Brush drags recompute the window statistics (≤ 785 days) synchronously — well under a frame — and never start a tween.',
    'Digit columns animate with transform-only WAAPI and collapse back to one cell when they finish.',
  ],
  dataNote: 'Simulated: a seeded five-sleeve factor model (seed 366) with fees, quarterly rebalancing and a 60/40 composite built from the same sleeves; twelve invented instruments follow their sleeve plus noise. Weekdays only, UTC. Not a real fund, not real prices, not advice.',
};
