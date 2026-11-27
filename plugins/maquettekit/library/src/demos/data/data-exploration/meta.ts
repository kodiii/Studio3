import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'data-exploration',
  name: 'Four Valleys lot explorer',
  specialty: 'data',
  summary: 'Interactive exploration of 327 sample coffee lots from four fictional regions: facet filters with counts, a linked scatter, histogram and ranked dot plot, two-dimensional brushing, drill-down from region to farm with a breadcrumb, an A/B comparison mode and a shareable URL.',
  highlights: [
    'One selection drives every view: facets and the drill path define what is in view; altitude and score brushes select within it; the scatter, histogram, dot plot, summary sentence and table all read the same set.',
    'Signature move — a brush you can throw: held, the window follows the hand 1:1 and rubber-bands past the ends of the axis; released, it keeps the hand’s velocity, glides with friction (the selection follows it), bounces off an end and lands on the snapped value on the spring.release token. Keyboard steps and changes made elsewhere spring the drawing on spring.press / spring.settle. The selection is always the snapped value; only the drawing springs.',
    'Brushing works three ways — draw a rectangle on the scatter (live: the selection follows the hand, then the rectangle springs onto the snapped ranges), drag across the histogram, or move the keyboard-operable range handles (the brush-linked-range technique, rebuilt generically for any domain).',
    'A halo with dashed axis guides and exact readouts glides from mark to mark on spring.press as the pointer or the keyboard cursor moves; the pinned lot is lifted off the paper (one light, top left: its shadow falls down and right) and named by a tag.',
    'Drill-down uses the flip-grid-reorder technique adapted to a ranked list: the children emerge from the row you chose — from its slot and from its mean, so the aggregate visibly splits into its parts — staggered by rank, while the old rows leave as aria-hidden ghosts; drilling up folds them back. Within a level, rows glide to their new rank with interpolated values (the bar-race-transition technique).',
    'One entrance, once: marks sweep in by altitude band and bars rise from the zero line by bin, all finished by 280 ms; filters never replay it.',
    'Every control has hover, pressed and focus states lit from the same direction: hover lifts toward the light, press sinks at once, release springs back on a token spring rendered as CSS linear() (the press-depth-button technique).',
    'Comparison mode (by process, variety or region) re-encodes marks as filled A / hollow B, plots each group’s share per bin so different group sizes compare fairly, turns the dot plot into dumbbells and adds a reconciled A − B table.',
    'Every filter, brush, comparison, sort and pinned lot lives in the URL hash (replaceState, no history spam). The summary is computed from the selection and words the altitude–score relation as an association in sample data, never as a cause.',
  ],
  technology: ['d3', 'svg', 'css'],
  uses: [],
  adapts: ['brush-linked-range', 'bar-race-transition', 'flip-grid-reorder', 'press-depth-button'],
  has3d: false,
  accessibility: [
    'Keyboard access to points: the focused scatter is a slider over the selected lots in altitude order (arrows, Page Up/Down, Home/End), starting from the hovered or pinned lot; Enter pins a lot, Escape hides the readout; a mouse click no longer moves that keyboard cursor. The lots table is the full alternative.',
    'Each brush is three role="slider" controls with value text in metres or points; Escape on a handle clears that brush. Readouts and tooltips appear at once — only their position glides.',
    'Facets are native checkboxes with counts; comparison uses native selects; the breadcrumb is a nav landmark with aria-current, and after a breadcrumb jump focus moves to the new current level.',
    'Drilling from a row moves focus to the first row of the new level; ghost rows are aria-hidden. “Show 25 more” moves focus to the first newly shown row; a pinned lot beyond the shown rows gets a “Show it” control.',
    'Process is shape as well as colour (circle, square, triangle); comparison groups are filled versus hollow; the histogram and dot plot have a bin table and per-row text names.',
    'Tables grow in the page and only scroll sideways inside their labelled region, so the wheel and touch scroll always reach the page. A polite status message reports the selection count after changes settle (debounced), never during a drag.',
  ],
  reducedMotion: 'No entrance, no glide, no rubber band, no springs: brush windows, the scatter rectangle and the halo are drawn exactly at their values; dot-plot rows cut to their rank and value, and a level change cross-fades the new rows in 160 ms. Hover, press and pin states apply instantly. Brushing, drilling and comparison work the same.',
  performance: [
    '327 lots render as SVG marks in one keyed list (a lot keeps its node as it enters or leaves the selection); a brush move filters and re-renders in well under a frame.',
    'Springs, glides and the halo run in short rAF loops that write positions straight to the DOM and stop as soon as everything is at rest; all loops are cancelled on unmount. Hover and press states are CSS transitions on token springs (springToLinear), no JavaScript per frame.',
    'The drill choreography is one rAF loop over at most a dozen rows plus their ghosts; the entrance is 361 CSS animations that end by 280 ms and are never re-applied.',
    'The URL is written 150 ms after the last change with replaceState; the lots table renders 25 rows at a time.',
  ],
  dataNote: 'Sample data (seed 1730): lots, farms, cooperatives and regions are invented; scores come from a generator with an altitude trend, process and variety effects, a farm effect and noise. Correlations describe the generator, not coffee.',
};
