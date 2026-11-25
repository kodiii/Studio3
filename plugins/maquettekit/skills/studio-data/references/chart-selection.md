# Chart selection — from question to honest chart

> **Quick card** — the must-dos from this file; read on for the reasons and the detail.
>
> - Start bars, columns and areas at zero (`domain([0, max])`); label any non-zero line baseline.
> - Avoid dual axes: use two aligned charts or index both series to 100.
> - Show missing data as gaps (`line().defined()`), never interpolated; dash and label partial periods.
> - Show uncertainty with bands or error bars and the stated interval; dash and label forecasts.
> - Never add 3D, perspective or decorative gradients to 2D charts; never use rainbow scales.
> - Label simulated data as `Simulated data` wherever it appears, exports included; never attach it to real tickers or people.
> - When asked for a misleading form, explain in one sentence and build the honest one unless the user confirms.
> - Compute the text summary from the data at render time; offer an equivalent table.

Load whenever you choose, review or change a chart. Pick by the question being asked, then apply the
integrity rules; a beautiful chart that misleads is a defect.

## 1. Question → chart

| Question | Data | Use | Avoid | Note |
|---|---|---|---|---|
| How did a measure change over time? | Continuous time series | Line; area only when the total matters and it starts at zero | Pie per period, 3D ribbons | Mark the current partial period |
| How do discrete periods compare? | ≤ about 24 periods | Columns from zero | Lines that imply values between periods when there are none | Label period boundaries |
| Which category is largest? | One value per category | Horizontal bars sorted by value | Unsorted bars, rotated labels, pies | Sort unless the order is inherent (age bands, weekdays) |
| How did categories change between two moments? | Two values per category | Slope chart or dumbbell (two dots joined) | Grouped bars across many groups | Direct labels at both ends |
| How has rank changed? | Rank per period | Bump chart; bar race for playback (`bar-race-transition`) | Spaghetti lines of raw values | Show values as well as ranks |
| What share is each part? | Parts of a whole, 2–5 parts | 100 % stacked bar; a single stacked bar; pie or donut only for 2–5 parts | Pies with many slices, exploded or 3D pies | Parts must sum to a meaningful whole |
| How does composition change over time? | Parts over time | Stacked columns or area for ≤ 4–5 parts; small multiples for more | Many stacked layers (middle layers cannot be compared) | Only the bottom layer has a flat baseline |
| How is a variable distributed? | One numeric variable | Histogram (state the bin width); strip or beeswarm for small n; ECDF for exact percentiles | A bar of the mean with an error bar | Distribution shape changes with bins: choose them deliberately |
| How do distributions differ by group? | Numeric by category | Box plots, or violins with points; ridgelines for few groups | Overlapping histograms | Show n per group |
| Are two variables related? | Two numeric variables | Scatter; trend line with an uncertainty band | Dual-axis lines | Correlation is not causation: never title it as one |
| And a third variable? | Three numeric variables | Scatter with size or colour; small multiples; scatterplot matrix | 3D scatter by default (`spatial-data.md`) | Size encodes area, not radius |
| How far from zero or target? | Signed values | Diverging bars; bullet chart for target vs actual | Speedometer gauges | Midpoint must be meaningful |
| Is this KPI on track? | One value + comparison | KPI tile: value, delta, period, sparkline (`number-ticker` for changes) | A bare number | The comparison is part of the answer |
| How did price move? | Open, high, low, close per interval | Candlesticks or OHLC bars; volume in a separate pane below | Price and volume on dual axes | Gaps for closed sessions, not interpolation |
| Where does it happen? | Geographic | Choropleth of rates; proportional symbols for counts; tile grid maps for equal-weight regions | Choropleth of raw counts | Large regions dominate visually |
| How does flow move between stages? | Flows | Sankey for few nodes; funnel as horizontal bars | 3D funnels | Show stage counts as text |
| How is a hierarchy composed? | Tree with sizes | Treemap (size), icicle (depth), indented tree table (exact) | Deep sunbursts | Label the largest items directly |
| How are things connected? | Network | Node-link for small sparse graphs; adjacency matrix for dense ones | Unfiltered hairballs | `spatial-data.md` §3 |
| When did things happen and for how long? | Intervals | Timeline or Gantt; span waterfall for traces | — | Shared time axis across rows |
| How does a value vary across two categories? | Matrix (hour × day) | Heatmap with a sequential scale and legend | Rainbow scales | Values available on focus and in the table |
| How certain is it? | Estimate + interval | Line with a confidence band; fan chart; error bars; quantile dot plots for lay readers | Forecasts drawn as solid lines | State the interval ("95 % interval") and n |
| What is the exact value? | Lookup | Table | A chart | Charts show patterns; tables give values |
| How do many series behave? | More than about five series | Small multiples, or one highlighted series with the rest in grey | Spaghetti | Shared scales unless labelled otherwise |

## 2. Rules of thumb

- One message per chart. If the title needs "and", consider two charts.
- The title names what is shown ("Error rate, last 24 h"). A takeaway title ("Errors doubled after the
  release") is allowed only when the data shows it, and is updated or removed when the data changes.
- Direct labels beat legends; legends, when needed, follow the order of the marks.
- Time runs along the x-axis in reading direction, at uniform spacing; do not silently skip periods.
- Annotate events that explain shapes (a deploy, a holiday, an outage) on the chart itself.

## 3. Integrity rules

| Rule | Why | How |
|---|---|---|
| Bars, columns and areas start at zero | Length and area encode value; a cut baseline multiplies differences | `scaleLinear().domain([0, max]).nice()`; never `min` for bar charts |
| Lines may use a non-zero baseline, labelled | Position encodes value; zooming in is legitimate | Label the axis minimum; avoid domains that dramatise noise |
| Broken axes only on lines, and visibly | Readers assume continuous scales | A break mark and text ("axis starts at 40") |
| Aspect ratio chosen, not accepted | Steepness depends on the box; flattening or stretching changes the story | Aim for average segment slopes near 45° as a starting point; keep the same ratio in comparisons |
| Dual axes avoided | Two arbitrary scales create crossings and correlations that mean nothing | Two aligned charts; or index both series to 100 at a base date (`v / v[base] × 100`); finance convention: a separate volume pane |
| If dual axes are unavoidable | Some audiences expect them | Colour-match each axis to its series, start both at zero or state why not, and say in the subtitle that scales are independent |
| Log scales labelled and used for multiplicative change | Growth rates and orders of magnitude read correctly on log | `scaleLog()` with ticks at 1–2–5 or powers of ten; "Log scale" in the axis title; no zero or negatives (use `scaleSymlog()`, labelled, if data crosses zero) |
| Uncertainty shown | Point estimates imply false precision | Bands or error bars with the interval stated; forecasts dashed and labelled |
| Missing data shown as gaps | Interpolating across a gap invents values | `line().defined((d) => d.value != null)`; explain the gap |
| Partial periods marked | The current month looks like a collapse | Dashed final segment or hatching, labelled "partial" |
| Normalised where size distorts | Raw counts track population, not rate | Per capita, per 1,000 requests, per active user; say which |
| Smoothing labelled | Averages hide spikes | "7-day average" in the legend; raw data on demand |
| Cumulative versus per period labelled | They look alike and mean different things | Axis title and subtitle |
| Inflation, currency and units stated | Comparisons across time or regions need them | Subtitle: "2026 £, inflation-adjusted" |
| No 3D effects, perspective, or decorative gradients on 2D charts | Perspective distorts length and area; gradients imply values | Flat marks; depth only when it is data (`spatial-data.md`) |
| Colour scale matches the data | Rainbow scales are not perceptually ordered and fail for colour-vision deficiency | Sequential for magnitude, diverging only with a meaningful midpoint, a legend with units |
| Sorted honestly | Sorting by the metric being argued for can hide the rest | Sort by value or by a stated, natural order |

When the user asks for a misleading form (a truncated bar axis, a rescaled dual axis), explain the problem in
one sentence, offer the honest equivalent, and build the honest form unless they confirm otherwise; label any
non-standard choice on the chart.

## 4. Labelling simulated, sample and partial data

The integrity rule from the SKILL applies to every pixel: simulated data is visibly simulated.

| Where | What to show |
|---|---|
| Chart or panel | A text badge in the subtitle: `Simulated data` (or `Sample data: 500 of 1.2M rows`) |
| Tooltip and table caption | The same label, so a cropped screenshot still carries it |
| Exports | CSV header comment or filename suffix (`-simulated`); a label drawn into exported images |
| Dashboard header | One banner when every panel is simulated, plus the per-panel badges |
| Report and demo metadata | The data note: generator name, seed, what it imitates; `meta.dataNote` for library demos |

Rules: generators are seeded and named for what they are (`simulateLatency(seed)`); simulated values never
attach to real tickers, companies, products or people; "realistic" noise is fine when labelled, never when it
could pass for measurements; replacing the generator with the real source must be a one-line change, so keep
it behind the same interface as the real client.

```tsx
<figure aria-labelledby="err-title" aria-describedby="err-summary">
  <figcaption>
    <h3 id="err-title">Error rate, last 24 hours</h3>
    <p className="subtitle">
      Errors per 1,000 requests · 1-minute buckets · UTC <span className="badge">Simulated data</span>
    </p>
  </figcaption>
  <p id="err-summary">Mostly 2–4 per 1,000; one peak of 19 at 03:40 UTC lasting 6 minutes.</p>
  {/* chart (aria-hidden or role="img" with the summary), then the table toggle */}
  <p className="source">Source: simulated (generator simulateErrors, seed 42), not production measurements.</p>
</figure>
```

The summary is computed from the data at render time, never written by hand, so it cannot drift from the
chart.

## 5. Scale and axis defaults

| Decision | Default | Why |
|---|---|---|
| Linear domain | `[0, max]` for bars and areas; `extent` with about 5 % padding for lines, then `.nice()` | Honest baselines; round tick values |
| Tick count | About 5–7 on the value axis; fewer as the container narrows | Enough to read values without a grid of noise |
| Time axis | `scaleUtc` when data is in UTC, `scaleTime` for local time, and say which in the subtitle | Daylight-saving shifts and offsets change bucket edges |
| Time tick labels | The coarsest unit that distinguishes ticks ("Mar", then "Mar 4", then "14:00") | Repeated context wastes width |
| Categorical axis | `scaleBand` with padding 0.1–0.3; labels horizontal, truncated with the full name in the tooltip and table | Rotated labels are slow to read |
| Gridlines | Value axis only, quiet colour, behind marks | Gridlines are a reading aid, not data |
| Shared scales | Identical domains across small multiples unless a label says otherwise | Comparisons across panels stay valid |
| Colour scale domain | Fixed across views and over time where values are compared | A legend that rescales per view breaks comparison |

## 6. Chart anatomy checklist

- [ ] Title (what), subtitle (units, period, filters, timezone), source line with retrieval date.
- [ ] Axis titles with units; ticks formatted with the shared formatters; sensible tick count (about 5–7).
- [ ] Direct labels or a legend in mark order; highlight colour for the focus series only.
- [ ] Annotations for events and thresholds, with values.
- [ ] Text summary computed from data; an equivalent table or "View as table".
- [ ] Integrity rules in §3 hold; any exception is labelled on the chart.
- [ ] Simulated, sample or partial data labelled wherever it appears, including exports.
