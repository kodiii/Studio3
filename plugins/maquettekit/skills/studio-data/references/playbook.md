# Data Studio playbook

> **Quick card** — the must-dos from this file; read on for the reasons and the detail.
>
> - Write the question inventory before any chart; delete any panel that answers no question.
> - Give every KPI a comparison (previous period, target or expected band) and its period.
> - Never go below 12 px text or 24 px interactive rows; remove chrome rather than shrink text.
> - Right-align numbers in `tabular-nums`, one precision per column, via cached `Intl.NumberFormat`; show "—", never zero, for no data.
> - Never use colour alone; reserve status colours; use at most 8 categorical hues, in order; make up/down colours configurable.
> - Never let alerts steal focus, play sound by default or flash; announce critical ones once with `role="alert"`.
> - Never show old data as current: mark it stale after 2–3 missed intervals, using server timestamps.
> - Never invent data; label simulated data on screen.

How to design a data-dense interface that answers its questions at a glance and survives eight hours of
use. General taste rules are in the shared `design-principles.md`; chart choice is in `chart-selection.md`;
this file covers structure, density, numbers, colour and the operational surfaces around the charts.

## 1. Start from questions

Write the question inventory before choosing a single chart. A panel without a question is deleted.

| Question (in the user's words) | Who | How often | Decision it drives | Answer form | Data and freshness |
|---|---|---|---|---|---|
| Is anything broken right now? | On-call engineer | Constantly | Page someone, or not | Status strip + alert list | Live, ≤ 15 s |
| Are error rates normal for this hour? | On-call | Hourly | Investigate | Line with expected band | 1-min buckets, 24 h |
| Which service got slower this week? | Team lead | Weekly | Prioritise work | Sorted bar of p95 change | Daily, 14 d |
| What exactly failed in this run? | Engineer | On demand | Fix | Trace table + detail panel | Per event |

Answer forms, from fastest to read to slowest: **status** (one word or colour plus text), **KPI** (one number
with comparison), **chart** (a pattern), **table** (exact values), **detail view** (one record).

## 2. Hierarchy and layout

Design three reading depths on one screen:

| Depth | Time to answer | Contains | Placement |
|---|---|---|---|
| Glance | ≤ 5 s | Status, active alerts, the two to four KPIs that matter | Top band, left first (in left-to-right scripts) |
| Scan | ≤ 30 s | Trends and comparisons that explain the KPIs | Primary chart row |
| Study | Minutes | Breakdowns, tables, drill-down | Below, or one interaction away |

- A KPI is never a bare number: show the comparison (previous period, target, expected band) and the period.
- Order panels by urgency, then frequency of use; not by the organisation chart or the data model.
- Align plot areas: stacked time-series panels share one x-domain and one left margin so their time axes
  line up vertically; a reader compares them by moving the eye straight down.
- Small multiples with shared scales beat one crowded chart; label when scales are independent.
- Dashboard types differ: operational (live, Essential, glanceable), analytical (exploration, Expressive,
  linked views), executive (few KPIs, period comparisons, written takeaways).

## 3. Density tiers

| Tier | Row height | Body / numbers | Use | Notes |
|---|---|---|---|---|
| Comfortable | 44–48 px | 15–16 px | Executive and occasional users, touch | Default on touch devices |
| Compact | 32–36 px | 13–14 px | Analysts, daily use | Default for desktop analytics |
| Dense | 24–28 px | 12–13 px | Terminals, monitoring walls, expert operators | Never below 12 px text or 24 px interactive rows |

- Interactive rows and controls stay at least 24 px high, or keep the spacing exception (shared
  `accessibility.md`, 2.5.8). Dense does not mean tiny targets.
- Offer a density toggle when the audience is mixed; persist the choice per user.
- Density comes from removing chrome (cards, shadows, padding), not from shrinking text.

## 4. Grids and panels

- 12 columns at desktop for dashboards; 4 or 8 for dense tools; 8–16 px gutters; a 4 px baseline.
- Panels separated by hairline rules or a one-step surface change, not card-on-card stacks with shadows.
- Panels size by container queries (`@container`) so they reflow when docked, split or printed.
- Each panel has a title (what), a subtitle (units, period, filters in effect) and an "as of" time when its
  data is a snapshot. A filtered panel says so in its subtitle: "EU only · last 7 days".

## 5. Number typography

| Rule | How |
|---|---|
| Tabular, lining figures wherever numbers align or change | `font-variant-numeric: tabular-nums lining-nums;` |
| Distinguish zero from O in identifiers | Add `slashed-zero` for ids, hashes and codes |
| Right-align numeric columns; align their headers the same way | Text columns left-aligned |
| One precision per column | Fixed fraction digits align decimals without special CSS |
| Units once: in the header or panel subtitle | "Latency (ms)", "USD, thousands" |
| Keep a number and its unit together | No-break space, or the formatter's own output |
| Deltas carry a sign | `signDisplay: 'exceptZero'` |
| Percent and percentage points are different | "+2.1 %" relative change; "+2.1 pp" change of a rate |
| Compact notation for tiles only | Full value in the tooltip, the table and the accessible name |
| Locale-aware formatting from one cached module | `Intl.NumberFormat` and `Intl.DateTimeFormat`, constructed once |

```ts
// format.ts — construct formatters once; they are expensive to create per cell.
const nf = (opts: Intl.NumberFormatOptions) => new Intl.NumberFormat(LOCALE, opts);

export const fmt = {
  price:   nf({ style: 'currency', currency: CURRENCY, minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  pnl:     nf({ style: 'currency', currency: CURRENCY, currencySign: 'accounting' }),   // (£12.50) in en-GB
  change:  nf({ style: 'percent', signDisplay: 'exceptZero', minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  compact: nf({ notation: 'compact', maximumFractionDigits: 1 }),
  ms:      nf({ style: 'unit', unit: 'millisecond', unitDisplay: 'short', maximumFractionDigits: 0 }),
  id:      nf({ useGrouping: false }),
};
```

- Formatters emit locale-specific characters (fr-FR groups digits with U+202F; sv-SE uses U+2212 for minus,
  en-GB a hyphen-minus). Never split or rebuild formatted strings; never hand-insert separators.
- Timestamps: terminals and logs use an unambiguous form with the zone (`2026-11-23 14:05:09 UTC`); human
  views may say "12 s ago" with the absolute time in `<time datetime="…">` and on hover and focus.
- An empty cell is not zero. Show "—" for no data and explain it in the legend or the column header help.

## 6. Colour for data

| Kind | Use | Construction | Rules |
|---|---|---|---|
| Categorical | Distinct series or groups | The design system's `--mk-color-data-1…8`, in order | ≤ 8 hues; beyond that group into "Other", highlight one and grey the rest, or use small multiples |
| Sequential | Magnitude of one quantity | One hue, even lightness steps in OKLCH | More value = more contrast with the background (darker on light themes, lighter on dark) |
| Diverging | Above/below a meaningful midpoint (zero, target, mean) | Two hues, neutral centre, symmetric lightness | Only with a real midpoint; blue–orange is safer than red–green for colour-vision deficiency |
| Status | Health and severity | `success`, `warn`, `danger`, `info` tokens | Reserved: never reuse a status colour as a series colour |
| Highlight | The selected or focused series | One accent; others recede to muted ink | Selection also shown by weight, outline or marker |

- **Never colour alone** (1.4.1): direct labels, marker shapes, dash patterns, position or text carry the
  same meaning. Check in forced-colors mode too, where series colours may collapse into one system colour.
- **Up and down are cultural.** Many East Asian markets (mainland China, Taiwan, Japan, South Korea) show
  rising prices in red. Make the mapping a setting; always pair it with ▲/▼ and a sign.
- **Non-text contrast** (1.4.11): lines, bars and markers needed to read the chart reach 3:1 against the
  background; separate adjacent fills with 1–2 px gaps in the surface colour rather than relying on hue.
- **Dark terminals.** A tinted near-black surface, not `#000`; lower chroma on large fills; avoid saturated
  red text on black (it vibrates); gridlines quiet; text ≥ 4.5:1. Dark suits long sessions in dim rooms and
  monitoring walls; daylight analytics often reads better light.
- Simulate colour-vision deficiency before shipping (Chromium DevTools: Rendering → Emulate vision
  deficiencies).

## 7. Tables

Use a table when users look up exact values, compare many attributes, or sort by their own criteria.
Interaction detail (sort, resize, virtualise, focus) is in `interaction-patterns.md` §5.

- Numeric columns right-aligned with tabular figures; text left; one precision per column; totals in `<tfoot>`.
- Separate rows with hairline rules or subtle zebra striping, not both. Hover, focus and selected are three
  different treatments.
- Header sticky inside the table's scroll container; the identifying first column frozen on wide tables.
- Truncate long text with an ellipsis, and expose the full value on focus, on hover and in the detail view.
- Inline sparklines are decorative (`aria-hidden`); the value they summarise is in the cell as text.

## 8. Filters and controls

- Global controls (time range, environment, segment) sit once at the top; panel-level controls inside the
  panel they affect.
- Active filters appear as removable chips with a "Clear all"; option lists show counts where cheap.
- State lives in the URL, so a view can be shared, bookmarked and restored after reload.
- Apply immediately when the query is fast (under about 300 ms); otherwise an explicit "Apply" with a pending
  state on the affected panels, never a frozen page.
- Impossible combinations are explained in text, not silently disabled.

## 9. Drill-down

Overview first, then zoom and filter, then details on demand.

| Pattern | Use when | Rules |
|---|---|---|
| Click to filter (cross-filter) | Exploring relationships | Selection visible in every affected view; one click clears it |
| Side panel detail | Inspecting one record without losing context | Focus moves into the panel; `Esc` closes and returns focus |
| Full detail page | The record needs its own space or a shareable URL | Breadcrumb back to the filtered overview, with state restored |
| Zoom in time | Investigating a spike | Brush or presets; a visible "Reset zoom" |

Transitions between levels keep object constancy (`motion-for-data.md` §2). Back always restores the
previous level with its filters.

## 10. Alerts and anomalies

| Severity | Text | Icon shape | Colour token | Placement and announcement |
|---|---|---|---|---|
| Critical | "Critical" + what is affected | Octagon or filled triangle | `danger` | Top of the status band; `role="alert"` once, when it first fires |
| Major | "Major" | Triangle | `warn` | Status band and alert list; polite status message |
| Minor | "Minor" | Circle | `info` or muted | Alert list only |
| Resolved | "Resolved" + duration | Check | `success` | Alert list; no announcement |

- On charts: shade the expected range (for example the p5–p95 band), mark anomalous points with a shape and
  an annotation that states the rule ("more than 3σ above the 7-day mean"), and label threshold lines with
  their value.
- Lifecycle: firing → acknowledged (by whom, when) → resolved; each with a timestamp. Group duplicates;
  snoozes expire visibly.
- Fight alert fatigue: dedupe, group by cause, rate-limit noisy rules, and show counts instead of repeats.
- Never steal focus, never play sound by default, never flash: one pulse at most, then a steady indicator.

## 11. Live status and freshness

| State | Show | Rule |
|---|---|---|
| Live | "Live" + last update time | Updates arrive within the expected interval |
| Delayed | "Delayed 15 min" (the source's stated delay) | Required wherever the source is delayed, as with much market data |
| Stale | "Last update 2 min ago"; values de-emphasised | Triggered after 2–3 missed intervals; never silently show old data as current |
| Reconnecting | "Reconnecting…" with the time of the last good data | Exponential backoff with jitter; on reconnect, load a fresh snapshot |
| Paused | "Paused" + "Resume" | The user paused, or the view is frozen while they inspect it |
| Offline | "Offline" + last known data and its time | Disable only actions that cannot work |

A pulsing "live" dot that keeps pulsing when no data arrives is a lie. Drive the indicator from the data
itself, and use the server's timestamps rather than the client clock.

## 12. Domain notes

- **Trading and finance.** Session state (pre-market, open, closed) visible; order book and price ladders
  with tabular figures and fixed columns; tick highlights throttled (`motion-for-data.md` §6); P&L colour
  mapping configurable; delayed data labelled. Simulated markets use invented instruments, never real
  tickers, and the interface never phrases output as advice.
- **AI-agent and LLM monitoring.** Run status (queued, running, succeeded, failed, cancelled) as text plus
  icon; traces as a span waterfall on a shared time axis; tokens in and out and cost with their units;
  latency as percentiles (p50, p95, p99), never only an average; evaluation scores with sample size; model and
  version on every run; prompts and outputs truncated with expansion; secrets and personal data redacted and
  the redaction marked. Streaming output keeps a stable layout.
- **Performance dashboards.** Field metrics at the 75th percentile against their thresholds (shared
  `performance.md` §2); distributions rather than means; lab and field labelled separately.

## 13. Checklist

- [ ] Question inventory written; every panel answers one question; nothing without a question remains.
- [ ] Glance, scan and study depths placed by urgency; KPIs carry comparisons and periods.
- [ ] Density tier chosen for the audience; text ≥ 12 px and interactive rows ≥ 24 px.
- [ ] Numbers tabular, aligned, one precision per column, units once, formatters cached and locale-aware.
- [ ] Palette roles respected: categorical in order, status reserved, never colour alone, up/down configurable.
- [ ] Filters visible, removable, in the URL; filtered panels say so.
- [ ] Alerts by severity with text and shape; no focus theft, sound or flashing.
- [ ] Live status and "as of" times on every live or snapshot panel.
- [ ] No invented data; simulated data labelled on screen.
