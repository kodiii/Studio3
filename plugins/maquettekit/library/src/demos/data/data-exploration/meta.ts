import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'data-exploration',
  name: 'Four Valleys lot explorer',
  specialty: 'data',
  summary: 'Interactive exploration of 327 sample coffee lots from four fictional regions: facet filters with counts, a linked scatter, histogram and ranked dot plot, two-dimensional brushing, drill-down from region to farm with a breadcrumb, an A/B comparison mode and a shareable URL.',
  highlights: [
    'One selection drives every view: facets and the drill path define what is in view; altitude and score brushes select within it; the scatter, histogram, dot plot, summary sentence and table all read the same set.',
    'Brushing works three ways — drag a rectangle on the scatter, drag across the histogram, or move the keyboard-operable range handles (the brush-linked-range technique, rebuilt generically for any domain).',
    'Drill-down from regions to cooperatives to farms to lots with a breadcrumb; within a level, rows keep identity and glide to their new rank with interpolated values (the bar-race-transition technique), drawn as dots and percentile whiskers because cup scores cluster far from zero.',
    'Comparison mode (by process, variety or region) re-encodes marks as filled A / hollow B, plots each group’s share per bin so different group sizes compare fairly, turns the dot plot into dumbbells and adds a reconciled A − B table.',
    'Every filter, brush, comparison, sort and pinned lot lives in the URL hash (replaceState, no history spam), so a view can be shared or restored after reload.',
    'The summary is computed from the selection and words the altitude–score relation as an association in sample data, never as a cause.',
  ],
  technology: ['d3', 'svg', 'css'],
  uses: [],
  adapts: ['brush-linked-range', 'bar-race-transition'],
  has3d: false,
  accessibility: [
    'Keyboard access to points: the focused scatter is a slider over the selected lots in altitude order (arrows, Page Up/Down, Home/End), Enter pins a lot, Escape hides the readout; the lots table is the full alternative.',
    'Each brush is three role="slider" controls with value text in metres or points; Escape on a handle clears that brush.',
    'Facets are native checkboxes with counts; comparison uses native selects; the breadcrumb is a nav landmark with aria-current.',
    'Process is shape as well as colour (circle, square, triangle); comparison groups are filled versus hollow; the histogram and dot plot have a bin table and per-row text names.',
    'A polite status message reports the selection count after changes settle (debounced), never during a drag.',
  ],
  reducedMotion: 'Dot-plot rows jump to their new rank and value instead of gliding; brushing, drilling and comparison are unchanged because they follow the hand directly.',
  performance: [
    '327 lots render as SVG marks; a brush move filters and re-renders in well under a frame.',
    'Selections are memoised from the facets, path and brush ranges; the row tween is one rAF loop over at most a dozen rows.',
    'The URL is written 150 ms after the last change with replaceState.',
  ],
  dataNote: 'Sample data (seed 1730): lots, farms, cooperatives and regions are invented; scores come from a generator with an altitude trend, process and variety effects, a farm effect and noise. Correlations describe the generator, not coffee.',
};
