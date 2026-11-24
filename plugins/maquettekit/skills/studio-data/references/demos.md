# Data Studio demos

Four reference compositions are planned for the library at
`${CLAUDE_PLUGIN_ROOT}/library/src/demos/data/<id>/` (fallback `../../library/src/demos/data/<id>/` from this
skill's folder). Each will have a `meta.ts` (summary, highlights, the recipes it uses, accessibility,
reduced-motion and performance notes, and a required `dataNote` describing how its data is simulated) and an
`index.tsx`.

**Status: planned.** When this file was written no data demo existed in the catalogue. Confirm before citing
a demo or opening its files:

```
maquettekit catalog list --kind demos
maquettekit catalog show financial-dashboard
maquettekit catalog show financial-dashboard --source
```

If a demo is missing, treat its section as a specification and build from the recipes directly. The recipe
lists are the planned compositions; a demo's `meta.uses` is what it really imports. Some recipes named here
are planned as well: confirm each with `maquettekit catalog search <id>` or `maquettekit catalog show <id>`.

Every number in a demo is simulated from a seeded generator, labelled `Simulated data` on screen, and
attached only to invented instruments, services and organisations. Study demos for structure, states and
integrity; do not paste them into a user's project wholesale.

## 1. Overview

| Demo id | Proves | Profile | 3D | Load it when the task is |
|---|---|---|---|---|
| `financial-dashboard` | A dense market and portfolio terminal with honest encodings and live status | Essential | No | Trading, portfolio, crypto or finance views |
| `live-monitoring` | Streaming operations or AI-agent monitoring that stays calm under load | Essential | No | Observability, SRE, agent and LLM run monitoring |
| `data-exploration` | Linked views, brushing and drill-down with tables as first-class views | Expressive | No | BI, analytics, statistics explorers, reports |
| `spatial-data-viz` | A 3D view that earns its place, with 2D projections and a synchronised table | Expressive | Yes | Networks, 3D scatter, point clouds |

## 2. `financial-dashboard`

**Intent.** Show that a terminal can be dense and still trustworthy: tabular figures everywhere, one
precision per column, session and delay states, configurable up/down colours with glyphs, and simulated
data that is unmistakably labelled.

**Planned recipes**

| Recipe | Role in the demo |
|---|---|
| `number-ticker` | KPI tiles (value, delta in words, period) |
| `line-chart-morph` | Price history with range presets and a keyboard crosshair |
| `brush-linked-range` | Overview brush driving the detail chart |
| `bar-race-transition` | Sector ranking over time, behind playback controls |
| `morphing-nav-pill` | Range and view switchers |
| `command-menu-reveal` | Keyboard instrument search |

**Read for:** the formatter module; the density tier; candlestick and volume panes without dual axes; tick
highlights throttled per cell; the "Delayed" and "Stale" states; the up/down colour setting.

## 3. `live-monitoring`

**Intent.** A monitoring view for fictional services or agent runs that receives a simulated stream without
flashing, re-sorting under the reader or flooding the screen reader.

**Planned recipes**

| Recipe | Role in the demo |
|---|---|
| `line-chart-morph` | Error-rate and latency charts with expected bands |
| `number-ticker` | Throughput and cost tiles |
| `skeleton-shimmer-handoff` | Panel loading without layout shift |
| `progress-orbit-loader` | Determinate progress for long-running jobs |
| `morphing-nav-pill` | Environment and time-range switchers |

**Read for:** ring buffers and per-frame coalescing; live, delayed, stale, reconnecting and paused states;
pause-while-inspecting; alert lifecycle with acknowledgement; span waterfall and percentile latency for agent
runs; the soak-test notes in `meta.performance`.

## 4. `data-exploration`

**Intent.** Demonstrate overview → zoom and filter → details on demand with coordinated views: a brush and
selections in one chart update the others; a table is always one control away; every chart has a generated
summary.

**Planned recipes**

| Recipe | Role in the demo |
|---|---|
| `brush-linked-range` | Time window driving the other views |
| `line-chart-morph` | Metric over time with range switching |
| `bar-race-transition` | Category comparison and ranking playback |
| `flip-grid-reorder` | Small multiples re-sorting with object constancy |
| `expanding-card-detail` | Drill-down from a panel into its detail view |
| `number-ticker` | Selection totals |

**Read for:** the selection store and highlight-versus-filter labelling; URL state; sortable, resizable,
virtualised table semantics; the "View as table" toggle; focus order across the page.

## 5. `spatial-data-viz`

**Intent.** Apply `spatial-data.md` end to end: the scene is justified by a stated spatial question, the
orthographic and axis-aligned presets give exact projections, brushing happens in linked 2D views, and the
table is synchronised both ways.

**Planned recipes**

| Recipe | Role in the demo |
|---|---|
| `orbit-inspect-controls` | Accessible orbit with button and key equivalents |
| `camera-preset-rig` | Axis-aligned and named viewpoints |
| `brush-linked-range` | Range filter shared by the scene and the 2D views |

Collaborates with `studio-3d` (scene) and `studio-motion` (camera timing). The 2D projections use D3; the
scene renders inside `StudioCanvas` with a real fallback.

**Read for:** the handoff table in `spatial-data.md` §7 filled in; deterministic layouts; the complete
experience with WebGL disabled; quality-scaled point counts.

## 6. Using a demo as a starting point

1. Read `meta.ts` first: highlights, `uses`, `dataNote`, accessibility and reduced-motion notes tell you what
   to keep.
2. Write the user's own question inventory (`playbook.md` §1); never inherit the demo's panels because they
   exist.
3. Rebuild the relevant ideas in the project's stack with its tokens (`maquettekit.design.json`), delegating
   recipe adaptation to `studio-components`.
4. Replace the generator with the user's data source behind the same interface. Until it is replaced, the
   `Simulated data` labels stay.
5. Do not inherit the demo's visual direction: it belongs to a fictional organisation.
6. Demos are written for the library's container-query preview stage; re-check density and breakpoints in
   the real layout.
7. If the project is not React, treat the demo as a specification: questions, encodings, states, timings and
   accessibility carry over; the code does not.
