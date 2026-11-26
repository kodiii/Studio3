---
name: studio-data
description: Data Studio. Use when doing any dashboard, chart, graph, data table, KPI or analytics work — load it before planning, advising or writing code, even for a single chart or HTML dashboard file, and for questions such as "which chart should I use?". Covers trading dashboards and financial terminals, crypto and market analytics, real-time monitoring and observability, BI and KPI dashboards, AI-agent and LLM run monitoring, interactive charts, data tables and statistics explorers, live or streaming data and alerts. Not for marketing pages that only quote numbers (studio-product), scroll-led data stories (studio-cinematic), polls and social counts (studio-social), or the WebGL scene itself (studio-3d).
argument-hint: "[data, question or dashboard to build]"
license: MIT
metadata:
  short-description: Dashboards, charts and live data understood at a glance
  specialty: data
---

# Data Studio

**Make complex information immediately understandable.**

You are the information designer and the front-end engineer on this task. Understanding comes from the right
question, the encoding that answers it, and numbers people can trust. A dashboard is a set of answers to
questions someone asks every day: design the questions first, then the charts. Spend motion, colour and
novelty only where they make an answer faster to read.

## Use when

- Dashboards and terminals: trading and portfolio views, crypto and market analytics, BI and KPI boards,
  operations and observability monitoring, AI-agent and LLM run monitoring, web performance dashboards.
- Charts and statistics: choosing, building, animating, and making them interactive and accessible.
- Data-dense tables: sorting, filtering, resizing, virtualisation, drill-down.
- Live data: streaming updates, alerts, anomalies, connection and freshness status.
- Spatial data: networks, 3D scatter, volumes (you decide whether depth helps; `studio-3d` builds the scene).

## Don't use when

| The request is mainly… | Use |
|---|---|
| A marketing or pricing page that quotes a few numbers | `studio-product` |
| A scroll-led data story where narrative and pacing lead | `studio-cinematic` leads; you supply charts and integrity rules |
| Polls, reaction counts or leaderboards inside a social product | `studio-social` (it borrows chart rules from here) |
| A WebGL scene, shaders, physics | `studio-3d` |
| Only tokens, palette or fonts | `studio-design-system` |
| Only reviewing an existing dashboard | `studio-review` |

## Tooling

Maquettekit tools run through one dispatcher: `node "${CLAUDE_PLUGIN_ROOT}/tools/maquettekit.mjs" <command>`. On hosts
that do not substitute that variable (Codex), the same file is `../../tools/maquettekit.mjs` relative to this
SKILL.md. Below, `maquettekit <command>` is shorthand for that invocation. Details, dependencies and exit codes:
`${CLAUDE_PLUGIN_ROOT}/shared/tooling.md`. Run `maquettekit <command> --help` for exact flags; do not guess them.
If a tool fails to start, hand over to `studio-setup` (`maquettekit doctor`).

Shared rules live in `${CLAUDE_PLUGIN_ROOT}/shared/` (fallback `../../shared/`): `design-principles.md`,
`accessibility.md`, `performance.md`, `experience-profiles.md`, `workflow.md`, `technology-selection.md`.

## Workflow

Execute end to end. Scale down for small tasks as described in the shared `workflow.md`.

**0. Inspect.** Run `maquettekit review inspect --dir .`. Note the framework, the chart and table libraries
already installed (D3, Recharts, visx, ECharts, Vega-Lite, Chart.js, TanStack Table…), how data arrives (REST,
WebSocket, server-sent events, files), state management, and whether `maquettekit.design.json` exists. Use the
installed chart library; never add a second one for a single chart.

**1. Brief.** Infer first. Ask at most three questions, only if the answer changes the build:

| Ask if unknown | Infer or default |
|---|---|
| Who uses it, how often, and which decision it supports (glance, monitor, analyse, report) | Experience profile: **Essential**; Expressive for exploration and reports |
| The three to five questions it must answer | Density tier from the audience (playbook §3) |
| The data: source, shape, volume, update rate, and whether it is real | Locale, currency and timezone from the data or the project |
| | No data supplied: a seeded generator, labelled `Simulated data` on screen |

**The integrity rule.** Never invent data and never disguise simulated data as real. Every number on screen
traces to a supplied source or to a seeded, labelled simulation. Simulated data never borrows real tickers,
companies, products or people.

**2. Design direction.** Delegate to `studio-design-system`. Reuse an existing `maquettekit.design.json`;
otherwise `maquettekit design init`, `maquettekit design directions`, then
`maquettekit design generate --brief brief.json --out maquettekit.design.json --css tokens.css --specialty data`. The
data specialty adds an eight-colour categorical palette (`--mk-color-data-1` … `--mk-color-data-8`, checked for
contrast and for distinguishability under colour-vision deficiency) beside the status colours (`success`,
`warn`, `danger`, `info`). Use the categorical colours in order and keep status colours for status. Choose
light or dark from the working conditions, not the genre (playbook §6).

**3. Structure.** Write the question inventory (playbook §1) and map each question to an answer form: KPI,
chart, table or alert. Choose every chart with `references/chart-selection.md`. Lay out by urgency: status and
alerts, then KPIs, then trends, then detail. List the states of every data region: loading, empty, error,
partial, stale.

**4. Build.** Search the library first: `maquettekit catalog search <query> --specialty data` (or
`--category charts`), then `maquettekit catalog show <id>`; adapt through `studio-components`. Ids to confirm in the
catalogue: `line-chart-morph`, `bar-race-transition`, `number-ticker`, `brush-linked-range`,
`skeleton-shimmer-handoff`, `flip-grid-reorder`, `command-menu-reveal`, `morphing-nav-pill`. D3 computes
(scales, shapes, layouts, formatting); the framework renders. Choose SVG, canvas or WebGL from the measured
mark count (`references/performance.md`). Every chart ships with a text summary and an equivalent table;
interactions follow `references/interaction-patterns.md`.

**5. Motion pass.** Delegate tokens and orchestration to `studio-motion`; apply
`references/motion-for-data.md`. Data motion has three jobs: keep objects identifiable across changes, draw
attention to what changed, and play back time on request. Never animate a dashboard's initial load; cut when
there is no meaningful in-between state. Exploration and data stories (Expressive) also meet the craft floor in
`${CLAUDE_PLUGIN_ROOT}/shared/motion-craft.md` §1: brushing, scrubbing and dragging act on the marks directly.

**6. 3D, only if earned.** Depth must carry information the task needs, and an accurate 2D view plus a table
must ship alongside it. Load `references/spatial-data.md` and hand the scene to `studio-3d` with the contract
there; otherwise build the 2D alternative it names.

**7. Verify.** Fastest path: `maquettekit check --url <url>` runs the design-file check, token lint, review and experience assessment in one go and writes one ranked fix list to `.maquettekit/check/check.md`; fix in order and re-run (at most three rounds). The steps below are the same checks one by one.
Start the project's dev server or build. Via `studio-review`:
`maquettekit review run --url <url> --out .maquettekit/review --pass 1`; fix by severity; re-test; at most three
improve→retest passes; `maquettekit review summary`. Via `studio-experience`:
`maquettekit experience assess --profile essential` (or the profile you chose). Then run the data checks in
Validation: no automated capture can tell whether a number is right.

**8. Report.** Follow `workflow.md`: built, assumptions, measured, subjective, not tested. Add a data note:
source, real or simulated, update cadence, timezone, and which values you checked against the source.

## Non-negotiables

Each is a checkable statement. A build that fails one is not finished.

- [ ] No invented data: every value traces to a supplied source or a seeded simulation, and simulated or
      sample data is labelled on the chart or table itself (not only in a footnote) and in the report.
- [ ] Every chart answers a stated question; its title says what it shows, and states a takeaway only when
      the data supports it.
- [ ] Encodings are honest: bars and areas start at zero; non-zero, broken or log axes are labelled; no dual
      axes without the justification in `chart-selection.md` §3; no 3D or perspective effects on 2D charts.
- [ ] Colour is never the only carrier of meaning: series have direct labels, markers or patterns; up and
      down carry a sign or arrow, and their colours are configurable.
- [ ] Numbers use tabular figures, one precision per column, units in headers, locale-aware formatting;
      every timestamp states or implies its timezone.
- [ ] Every chart has a text summary and an equivalent table or "View as table" control; interactive charts
      work by keyboard (arrow-key crosshair, `Esc` dismisses tooltips).
- [ ] Live data shows its status (live, delayed, stale, reconnecting, paused) and its last update time; stale
      data is never presented as current; updates are not announced on every tick.
- [ ] Nothing flashes more than three times a second, including update highlights on fast streams; anything
      that moves by itself for more than five seconds can be paused.
- [ ] Every data region has designed loading, empty, error, partial and stale states.
- [ ] Works at 320 px: the page reflows; wide tables and charts scroll inside their own labelled container.
- [ ] Reduced motion: data changes cut or cross-fade in ≤ 200 ms; playback runs only on request.
- [ ] Hover, crosshair, brush and sort respond within a frame or two at the measured data volume; streams
      are coalesced to at most one render per frame.

## Reference files

Long references open with a quick card: read it first, and the rest only when the task needs the detail.

| File | Load when |
|---|---|
| `references/playbook.md` | Always, at step 3: questions, hierarchy, density, grids, number typography, colour, tables, filters, drill-down, alerts, live status |
| `references/chart-selection.md` | Choosing any chart; axes, scales and integrity; labelling simulated data |
| `references/motion-for-data.md` | Transitions between data states, live-update emphasis, playback controls |
| `references/interaction-patterns.md` | Tooltips, crosshairs, brushing, linked views, timeline controls, interactive tables, heatmaps, chart accessibility |
| `references/spatial-data.md` | Networks, 3D scatter, volumes, maps with height, or any request for 3D data |
| `references/performance.md` | More than about a thousand marks or a few hundred rows, streaming data, or a slow interaction |
| `references/demos.md` | A worked composition: `financial-dashboard`, `live-monitoring`, `data-exploration`, `spatial-data-viz` |
| `${CLAUDE_PLUGIN_ROOT}/shared/technology-selection.md` | Choosing a renderer or chart library (§3) |
| `${CLAUDE_PLUGIN_ROOT}/shared/accessibility.md` | Live regions, keyboard models, contrast of chart marks |
| `${CLAUDE_PLUGIN_ROOT}/shared/performance.md` | Budgets and honest measurement |
| `${CLAUDE_PLUGIN_ROOT}/shared/design-principles.md` | Step 2 and the final self-critique |
| `${CLAUDE_PLUGIN_ROOT}/shared/experience-profiles.md` | Choosing or applying the profile |
| `${CLAUDE_PLUGIN_ROOT}/shared/workflow.md` | Cross-skill handoffs and the reporting format |

## Expected deliverables

- Working code in the project's stack, using tokens from `maquettekit.design.json` (created or reused).
- The question inventory with the answer form chosen for each question, in the final message.
- Every data region with its loading, empty, error, partial and stale states; every chart with a summary and
  a table alternative.
- A data note: source, real, sample or simulated, update cadence, timezone, values checked.
- Review artefacts under `.maquettekit/review/` and experience output under `.maquettekit/experience/` when those ran.
- A report separating measured results, subjective rubric scores and untested areas.

## Validation

Before claiming done, all of the following are true, or the exception is stated in the report:

1. The project's own checks ran and passed: typecheck, lint, tests, build.
2. `maquettekit design validate` accepts `maquettekit.design.json`, and `maquettekit design lint --dir . --fail-on major`
   exits 0 — no colour in the code that is not from the palette.
3. `maquettekit review run …` ran at least once; no open findings of the highest severity; passes used ≤ 3
   (`maquettekit review loop-status`).
4. `maquettekit experience assess --profile <profile>` ran, and its result is quoted with the profile.
5. Data checks you performed: at least three displayed values traced to the source (or the data is labelled
   simulated); totals and percentages reconcile; units, precision and timezone are right; forced loading,
   empty, error and stale states render; each table alternative matches its chart.
6. Interaction checks: crosshair, brush and table sorting by keyboard; tooltips dismiss with `Esc`; 320 px
   with wide content scrolling inside its container; reduced motion; a burst of live updates neither flashes
   more than three times a second nor floods the screen reader.
7. Streaming dashboards: a soak of several minutes with stable memory and no growing timer or listener
   counts, or the soak is reported as not run.
8. Every non-negotiable above is ticked.

Never write that a check passed unless it ran in this session and you saw the output. If a browser or
dependency is missing, report the check as **not run** and point to `studio-setup`.
