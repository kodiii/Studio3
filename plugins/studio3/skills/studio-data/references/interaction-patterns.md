# Interaction patterns — linked views, brushing, crosshairs, tables, heatmaps, accessibility

Load when a chart or table does more than sit there. Every pointer interaction below has a keyboard path;
that is not an extra, it is the pattern.

## 1. Linked views and brushing

- **One selection store in the page**; charts subscribe and render from it. Never let one chart reach into
  another. In React, a small external store read with `useSyncExternalStore` (with a selector per chart)
  keeps unrelated charts from re-rendering.
- **Highlight or filter, and say which.** Highlight keeps context (others dim); filter removes data (and
  every affected panel's subtitle says "Filtered"). A visible "Clear selection" is always one click away.
- **Brushing** selects a range on an overview to drive a detail view (focus + context). Handles and the
  window itself are keyboard sliders; presets cover common ranges (`brush-linked-range` builds this).
- **Selection state goes in the URL** when it changes what the page means, so it can be shared and restored.
- Heavy cross-filtering is debounced (about 100–200 ms) or precomputed; the brush itself never lags.

## 2. Crosshair and tooltips

**Finding the nearest datum**

| Chart | Lookup |
|---|---|
| Line or area over sorted x | `bisector((d) => d.t).center(data, x)` from D3 |
| Scatter | `Delaunay.from(points, (d) => xs(d), (d) => ys(d)).find(px, py)` from D3, built once per data change |
| Bars | The band under the pointer (`scaleBand`), with a generous hit area |
| Dense canvas marks | A spatial index (`quadtree` from D3) or a colour-picking buffer |

**Tooltip content and placement**

- At a given x, show every series' value, sorted by value, with units and the period; tabular figures.
- Place it beside the point, never covering it; flip at container edges; on touch, offset above the finger.
- Follow 1.4.13: dismissible with `Esc` without moving the pointer, hoverable (the pointer can move onto it),
  and persistent until dismissed or the pointer or focus leaves.
- Tooltips appear immediately (or within the `instant` token); never delay information behind a fade.
- Pointer moves write to a ref and draw in one rAF callback; React state changes only on discrete events.

**Keyboard model.** The plot is one tab stop: a `role="slider"` whose value is the point index and whose
`aria-valuetext` reads the point, as `line-chart-morph` does. Screen readers announce value-text changes
without a separate live region.

```tsx
function PlotKeyboard({ count, describe, children }: {
  count: number; describe: (i: number) => string; children: (i: number, show: boolean) => React.ReactNode;
}) {
  const [i, setI] = useState(count - 1);
  const [show, setShow] = useState(false);
  const move = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { setShow(false); return; }
    const big = 10;
    const next = ({ ArrowRight: i + 1, ArrowLeft: i - 1, PageUp: i + big, PageDown: i - big,
                    Home: 0, End: count - 1 } as Record<string, number>)[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setI(Math.max(0, Math.min(count - 1, next)));
    setShow(true);
  };
  return (
    <div role="slider" tabIndex={0} aria-label="Requests per minute, last hour"
         aria-valuemin={0} aria-valuemax={count - 1} aria-valuenow={i} aria-valuetext={describe(i)}
         onKeyDown={move} onFocus={() => setShow(true)} onBlur={() => setShow(false)}>
      {children(i, show) /* SVG or canvas is aria-hidden; crosshair and tooltip drawn at index i */}
    </div>
  );
}
```

**Touch.** Tap pins the crosshair at a point; drag scrubs; a tap elsewhere or a close button unpins. Give the
plot `touch-action: pan-y` so vertical page scrolling still works while a horizontal drag scrubs.

## 3. Timeline controls

| Control | Pattern | Rules |
|---|---|---|
| Range presets (1D, 1W, 1M, 3M, YTD, 1Y, All) | Radio group or segmented buttons with `aria-pressed` | The active preset is visible as text weight or fill, not colour alone |
| Custom range | Two native date (or datetime-local) inputs, plus the brush | Validate start before end; state the timezone |
| Zoom | "+", "−" and "Reset zoom" buttons; brush to zoom | Wheel zoom only after the chart is activated, never on plain page scroll |
| Pan | Drag, with arrow keys and step buttons as the alternative (2.5.7) | Show where the window sits in the whole range |
| Pinch zoom | Buttons as the alternative (2.5.1) | Do not block the browser's own page zoom |
| Live edge | "Jump to now" when the user has panned away from live | Live updates pause the auto-follow while the user inspects history |

## 4. Choosing semantics

| You are building | Use | Not |
|---|---|---|
| A static data table | `<table>` with `<caption>`, `<th scope>` | `role="grid"` |
| A table with sorting and row actions | `<table>`; sort buttons in headers; actions as buttons in cells | Clickable `div` rows |
| Cell-by-cell navigation and editing (spreadsheet-like) | `role="grid"` with roving `tabindex`, following the ARIA Authoring Practices grid pattern | A grid role without the arrow-key model |
| Expandable hierarchical rows | `role="treegrid"`, or a table with disclosure buttons | Nested tables |
| A chart summary | `role="img"` + `aria-label` on a static chart; a group with labelled controls for an interactive one | An SVG with no name |

## 5. Interactive tables

**Sorting**

- A `<button>` inside each sortable `<th>`; `aria-sort="ascending|descending"` on the sorted header only.
- A visible indicator plus text for assistive tech; a polite status message: "Sorted by price, descending".
- Stable sort; a documented secondary order; sorting never discards the selection or the focused row.

**Resizing**

- A focusable handle with `role="separator"`, `aria-orientation="vertical"`, `aria-valuenow` (width), a name
  ("Resize Price column"), and arrow keys to resize (the ARIA window-splitter pattern). Double-click or
  `Enter` fits the content. Minimum widths keep headers legible.

**Virtualisation** (thresholds in `performance.md` §6)

- Render visible rows plus an overscan; keep the header outside the virtual list.
- Expose the true size: `aria-rowcount` on the table and `aria-rowindex` on each rendered row (1-based,
  header row included).
- Restore focus to the same logical row after the window shifts; find-in-page cannot see unrendered rows, so
  provide search.

**Row focus and selection**

- Rows are not tab stops one by one: either links or buttons inside them, or a grid with roving `tabindex`.
- `Enter` opens the detail; `Space` toggles selection where selection exists.
- Selection column with a select-all checkbox whose `indeterminate` state shows partial selection; the
  selection count announced politely; bulk actions appear in a toolbar, not in a hover-only overlay.
- Hover, focus and selected look different from each other.

**Scrolling**

- Wide tables scroll inside a container with `tabindex="0"`, `role="region"` and an `aria-label`, so keyboard
  users can scroll it and the page never scrolls sideways (1.4.10). Sticky header (`top: 0`) and sticky first
  column (`left: 0`, higher `z-index` for the corner cell) live inside that container.

## 6. Heatmaps

- Sequential scale for magnitude, diverging only with a meaningful midpoint; a legend with units and the
  value range.
- Cells show their value as text when they are large enough; otherwise on hover and focus.
- Keyboard: a grid of cells navigable with arrow keys, each announcing row, column and value ("Tuesday,
  14:00: 132 requests").
- Missing cells are hatched and explained, not left blank or grey, which reads as zero.
- Hovering or focusing a cell highlights its row and column headers.
- The equivalent table is the matrix itself as a `<table>`: easy, so ship it.

## 7. Chart accessibility

**Text alternatives by complexity**

| Chart | Provide |
|---|---|
| Simple, static (one series, few points) | `role="img"` with an `aria-label` summary of one or two sentences: what, range, trend, extremes |
| Complex, static | The summary, plus an equivalent table (visually hidden, or behind a "View as table" toggle), linked with `aria-describedby` |
| Interactive | A labelled group: the controls, the keyboard plot (§2), the summary and the table |

- Summaries are generated from the data at render time, so they never drift from the chart.
- SVG naming: `role="img"` on the `<svg>` with a `<title>` first child (and `<desc>`), referenced by
  `aria-labelledby`; or hide the SVG (`aria-hidden="true"`) and name the surrounding element.
- Decorative gridlines, sparklines and texture are `aria-hidden`.
- Legend items that toggle series are buttons with `aria-pressed` and text.
- **One tab stop per chart** with arrow keys inside; hundreds of focusable points are a trap.
- **Focus order:** title → summary → controls (range, series toggles) → plot → "View as table" → table.
- **Reflow and zoom:** render at the container's real pixel size (measure with `ResizeObserver`) instead of
  scaling one fixed `viewBox`, which shrinks labels to illegible sizes on narrow screens; reduce tick counts and
  move to direct labels as the container narrows.
- **Forced colours:** check `@media (forced-colors: active)`; series that differ only by colour may collapse,
  so markers, dash patterns and direct labels must carry the distinction.
- Contrast: marks needed to read the chart ≥ 3:1 against the background; text ≥ 4.5:1 (shared
  `accessibility.md`).

## 8. Checklist

- [ ] One selection store; highlight versus filter stated; clear selection always available.
- [ ] Crosshair by pointer, touch and keyboard; tooltips meet 1.4.13 and never cover their point.
- [ ] Every drag, pinch and wheel interaction has buttons or keys as an alternative.
- [ ] Table semantics chosen deliberately; sorting announced; resizing by keyboard; virtual tables expose
      their size.
- [ ] Wide content scrolls inside a labelled, focusable region; the page never scrolls sideways.
- [ ] Heatmap cells reachable by keyboard; missing data hatched and explained.
- [ ] Every chart has a generated summary and an equivalent table; one tab stop per chart.
- [ ] Checked at 320 px, at 200 % zoom and in forced-colors mode.
