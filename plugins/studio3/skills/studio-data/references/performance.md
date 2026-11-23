# Data performance — renderers, virtualisation, streams, workers

Load when a view draws more than about a thousand marks, holds more than a few hundred rows, receives
streaming data, or an interaction feels slow. Cross-specialty budgets and measurement honesty are in the
shared `performance.md`; renderer basics are in shared `technology-selection.md` §3.

## 1. Measure the workload first

Write these down from the real data, not the mock:

| Quantity | Why it matters |
|---|---|
| Marks per view (points × series, bars, cells) | Chooses the renderer |
| Rows in the largest table, and columns | Decides virtualisation |
| Update rate (messages per second) and payload size | Decides batching and worker use |
| The interactions that must stay instant (hover, crosshair, brush, sort, filter) | These are what users feel; INP measures them |
| Target devices and how long the view stays open | A wall display open for a week has different failure modes from a report |

## 2. Renderer thresholds: guidance, not law

| Renderer | Comfortable range (rough, device-dependent) | Strengths | Obligations |
|---|---|---|---|
| SVG | Up to low thousands of marks; fewer if every mark animates | Crisp text, per-mark focus and ARIA, CSS styling | DOM cost grows with nodes; avoid per-mark transitions at scale |
| Canvas 2D | Tens of thousands of marks redrawn per frame; more for static drawings | Cheap redraws, dense scatter, heatmaps, streams | No DOM per mark: build hit testing, a table alternative and a summary yourself; handle DPR |
| WebGL | Hundreds of thousands to millions of points | GPU transforms and transitions, spatial data | All canvas obligations plus context loss, fallbacks and asset budgets |

- **Mix by layer.** Marks on canvas or WebGL; axes, labels and annotations in SVG or HTML; tooltips in HTML;
  the accessible table in the DOM. The layers share one set of scales.
- **Profile the real chart on a target device** before changing renderer; drawing complexity (paths versus
  rectangles, text, alpha blending) matters as much as count.

## 3. Reduce before you render

A screen has a few thousand pixel columns. Drawing more points than that per series costs time and shows
nothing new.

| Technique | Use for | Caution |
|---|---|---|
| Server-side aggregation (buckets by time or category) | Anything with a query layer | State the bucket size in the subtitle |
| Min/max per pixel column | Monitoring lines, where spikes must survive | Draw the vertical extent per column; keeps outliers |
| Largest-Triangle-Three-Buckets (LTTB) downsampling | Smooth visual summaries of long series | Can drop isolated spikes: not for alerting views |
| Binning (hexagonal or rectangular) | Dense scatter | Show counts per bin in the legend |
| Level of detail by zoom | Long histories | Fetch finer data as the user zooms; show loading per range |

Recompute the reduction on resize and zoom, not on every frame.

## 4. Canvas specifics

```ts
function sizeCanvas(canvas: HTMLCanvasElement, cssW: number, cssH: number, maxDpr = 2) {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);   // cap: fill cost scales with DPR²
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  const ctx = canvas.getContext('2d', { alpha: false })!;      // opaque background lets the browser skip blending
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}
```

- Separate static layers (grid, axes) from dynamic ones (marks, crosshair) so a pointer move redraws only the
  crosshair layer.
- Batch by style: one `beginPath()` per colour, many `rect`/`lineTo` calls, one `fill()` or `stroke()`.
  Avoid `save()`/`restore()` and style changes per mark.
- Cache repeated shapes as `Path2D`; avoid `shadowBlur` and per-mark text, which are slow.
- Resize through a `ResizeObserver`; redraw once per animation frame at most.

## 5. SVG specifics

- One `<path>` per series, not one element per point; group marks so transforms apply to the group.
- During pan and zoom gestures, transform a group; recompute coordinates (semantic zoom) when the gesture
  ends.
- `vector-effect: non-scaling-stroke` keeps strokes constant under transforms. No filters or drop shadows on
  marks.
- In React, memoise path strings on data and scale changes; keep the crosshair and tooltip in a separate
  component so hover does not re-render the series.

## 6. Tables

| Rows | Approach |
|---|---|
| Up to a few hundred (cheap rows) | Render them all; consider `content-visibility: auto` with `contain-intrinsic-size` for long pages of rows |
| Several hundred and more, or expensive rows | Virtualise: visible rows plus an overscan of 5–10; fixed row heights where possible |
| Very wide (dozens of columns) | Also virtualise columns, or let users choose visible columns |

- Use the windowing library the project already has (for example TanStack Virtual) before writing one.
- Keep keys stable and rows memoised; a tick that changes one cell re-renders one cell (per-cell
  subscriptions to the store), not the table.
- Accessibility rules for virtual tables (`aria-rowcount`, `aria-rowindex`, focus restoration, search instead
  of find-in-page) are in `interaction-patterns.md` §5.

## 7. Streaming updates

Data can arrive at any rate; the screen updates at most once per frame, and text at a readable rate.

```ts
/** Fixed-capacity ring buffer: no allocation per message, bounded memory for long sessions. */
class Ring {
  readonly t: Float64Array; readonly v: Float64Array; size = 0; head = 0;
  constructor(readonly capacity: number) { this.t = new Float64Array(capacity); this.v = new Float64Array(capacity); }
  push(t: number, v: number) {
    this.t[this.head] = t; this.v[this.head] = v;
    this.head = (this.head + 1) % this.capacity;
    this.size = Math.min(this.size + 1, this.capacity);
  }
}

const ring = new Ring(10_000);
let scheduled = false;
socket.addEventListener('message', (e) => {
  const m = JSON.parse(e.data) as { t: number; v: number };   // parse in a worker when payloads are large
  ring.push(m.t, m.v);
  if (!scheduled) { scheduled = true; requestAnimationFrame(() => { scheduled = false; draw(ring); }); }
});
```

- **Coalesce:** many messages, one render per frame; never `setState` per message.
- **Readable text:** numbers in tiles and tables update a few times per second at most (about 4–10 Hz), even
  when data arrives faster; the latest value always wins.
- **Hidden tabs:** rAF stops when the tab is hidden. On return, fetch a fresh snapshot instead of replaying
  thousands of buffered frames; mark the gap if one exists.
- **Gaps and order:** use sequence numbers or server timestamps to detect missed messages, and show the gap
  rather than interpolating across it.
- **Reconnect** with exponential backoff and jitter; show the live-status state from the playbook (§11).

## 8. Worker offloading

| Move to a worker | How |
|---|---|
| Parsing large JSON, CSV or columnar payloads | Post the raw text or buffer; return typed arrays |
| Aggregation, downsampling, statistics | Run on typed arrays; return only what the view draws |
| Heavy canvas rendering | `canvas.transferControlToOffscreen()` and draw in the worker (feature-detect; keep a main-thread path) |

- Transfer buffers instead of copying them: `worker.postMessage(msg, [msg.buffer])`.
- Batch messages to and from the worker; one message per frame or per batch, not per data point.
- Hit testing stays responsive on the main thread with a spatial index (`quadtree` from D3) built from the
  worker's output.

## 9. Long sessions and memory

Monitoring views stay open for days. Leaks that are invisible in a demo become crashes on a wall display.

- Bounded buffers everywhere (ring buffers, capped logs and alert histories).
- Every interval, timeout, observer, socket listener and animation frame is released on unmount.
- Soak test: leave the view running with live or simulated data for at least several minutes (ideally
  longer), then compare heap snapshots in the browser's memory tools and check that listener and timer counts
  are flat. Report the duration and result, or that it was not run.

## 10. Measuring

- Use the browser's performance panel on the interactions that matter: crosshair move, brush drag, sort,
  filter, an update burst. Look for long tasks and layout work inside handlers.
- INP needs real interaction: script the interactions or say INP was not measured.
- State conditions with every number: device or emulation, throttling, data volume, build mode, run count
  (shared `performance.md` §7). Headless numbers are regressions checks, not user experience.

## 11. Checklist

- [ ] Mark counts, row counts and update rates measured from real or labelled simulated data.
- [ ] Renderer chosen by measured count; layers mixed; one set of scales.
- [ ] Data reduced to pixel resolution; spike-preserving reduction on monitoring views.
- [ ] Canvas DPR capped; static and dynamic layers separated; batched drawing.
- [ ] Tables virtualised above the threshold with accessible row counts; per-cell updates.
- [ ] Streams coalesced to one render per frame; text throttled; hidden-tab resync by snapshot.
- [ ] Heavy parsing and aggregation in a worker with transferred buffers.
- [ ] Soak test run (or reported as not run); no unbounded buffers or leaked timers.
