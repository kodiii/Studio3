# Maquettekit Experience Lab

`maquettekit experience` — a transparent, heuristic interaction-quality assessment across 14 dimensions. It combines
signals **measured** in headless Chromium, signals **derived** from those measurements, and **agent** answers to
a rubric of criteria that cannot be measured, and turns them into per-dimension scores with confidence, gates,
prioritised recommendations and the full formula. Loopback only, nothing uploaded, no telemetry. Playwright is
needed only for `assess` (resolved through `lib/resolve.mjs`); `rubric` and `score` have no dependencies.

It is not a usability study and not an accessibility audit. Do not cite a score as conformance.

## Commands

```
maquettekit experience assess  --url <loopback url> | --serve <dir>
                           [--routes /,/x] [--profile essential|expressive|immersive]
                           [--viewports mobile,desktop] [--out .maquettekit/experience] [--answers <answers.json>] [--json]
maquettekit experience rubric  [--profile <p>] [--json]
maquettekit experience score   --signals <signals.json> [--answers <answers.json>] --profile <p> [--out <dir>] [--json]
```

- `assess` measures every route × viewport in normal and `prefers-reduced-motion: reduce` modes and writes
  `signals.json` (raw, profile-independent), `experience.json`, `experience.md`, `measurements.json` (raw probe
  output, a debugging aid) and `screenshots/<route>/<viewport>-{fold,full,reduced-fold}.png` (+ `-no-webgl.png`).
  `--url` must be a loopback host (the lab clicks controls and submits forms). `--routes` defaults to the URL path,
  or to every `.html` file for `--serve` (`404.html` excluded). `--profile` defaults to `motion.profile` of
  `./maquettekit.design.json`, else `expressive`. `--viewports` defaults to `mobile,desktop`; pointer, keyboard,
  popup, latency, form and axe probes run on the primary viewport (desktop if present), touch-target checks on
  touch viewports. `--json` prints a summary (paths, overall, gates, top recommendations).
- `rubric` prints the agent questions, how to answer each from screenshots/code, and the `answers.json` format;
  `--json` adds a fill-in `template`.
- `score` re-scores without a browser — a different profile, new answers, or a hand-written signals file
  (`{ "signals": { "<id>": <raw> | { "value": <raw>, "status": "measured" } } }`). `--signals` may be omitted
  when `--answers` is given (rubric-only, low confidence). Without `--out` nothing is written.
- Exit codes: `0` no gate failed · `1` at least one gate failed · `2` usage error / invalid answers ·
  `3` Playwright or Chromium unavailable (also forced by `MAQUETTEKIT_DISABLE_PLAYWRIGHT=1`, with a message pointing
  at `rubric` + `score`).

`answers.json`: `{ "answers": { "<question id>": <value> | { "value": <value>, "note": "<what you saw>",
"evidence": ["screenshots/root/desktop-fold.png"] } } }`. Scale questions take 1–5; choice questions take their
options (`yes | partial | no`; `accessibility.flashing` takes `no | yes`). `"na"` excludes a question;
`"not-tested"`, `null` or omission leaves it unanswered. Invalid values are rejected (exit 2), never coerced.

## Output (`experience.json`)

```
{ tool, kind: "experience", version, generatedAt, profile, target, coverage, inputs,
  overall: { score, rawScore, grade, uncappedGrade, cap, cappedBy[], capApplied, confidence, confidenceLabel,
             dimensionsScored, dimensionsNotScored[], gates: { passed, failed, notEvaluated[] }, headline },
  gates: [{ id, title, scope, status: pass|fail|not-evaluated|not-applicable, message, failingSignals[], evidence[] }],
  dimensions: { <id>: { score, confidence, weight, normalisedWeight, status: scored|not-assessed|not-applicable,
                        evidenceMix: { measuredWeight, agentWeight, missingWeight }, signals[], findings[] } },
  signals: [{ id, dimension, source, status, raw, normalised, weight, normalisation: {…, text}, contribution,
              summary, evidence: { examples[] }, gate? }],
  recommendations: [{ rank, priority: P0–P3, dimension, signal, source, what, why, how, evidence[],
                      expectedEffect: { overallPoints, dimensionPoints, gate?, liftsCap?, note } }],
  agent: { questions, answered, notApplicable, unanswered[] }, warnings[], limitations[], scoring: { formula, profile, gateCaps, grades } }
```

`experience.md` gives the headline, gates, the dimension table and the top ten recommendations, then
**Part A — Measured evidence** (measured and derived signals with raw values, normalisation and examples) and
**Part B — Agent judgement** (rubric answers with notes and evidence), the motion observed, the scoring model
and the limitations.

## Scoring model

- Signal: `n = normalise(raw)` ∈ [0, 1] — `share` (as is), `linear {bad, good}` (clamped; works both ways),
  `plateau` (1 inside a range), agent `scale 1–5` or `choice`, or a profile `band` (linear with the profile's
  `{bad, good}`).
- Dimension: `score = 100 × Σ(w·n) / Σ(w)` over signals with evidence. Missing signals are renormalised away.
- Confidence: `Σ w(with evidence) / Σ w(applicable)`. Unanswered questions and unmeasured signals count as
  missing; not-applicable signals (no forms, no inline links, a single route) leave the denominator. Labels:
  high ≥ 0.75, medium ≥ 0.5, low below. A measured-only run lands around 0.65–0.75.
- A dimension with no evidence is `not-assessed` (n/a) and excluded; spatial interaction clarity is
  `not-applicable` unless a canvas requested a WebGL/WebGPU context. Overall `raw = Σ(W·score) / Σ W` over scored
  dimensions; overall confidence averages dimension confidence over applicable dimensions.
- Gates: `score = min(raw, cap)`; one failed gate caps at 69 (grade D at best), two or more at 59 (grade F). The
  profile never lifts a cap. Grades: A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, F below.
- Recommendations: for signals with `n < 0.9` (agent answers `< 0.75`), expected effect =
  `(W_d / ΣW_scored) × (w_s / Σw_available) × (1 − n) × 100` overall points. P0 = behind a failed gate,
  P1 ≥ 2 points, P2 ≥ 0.75, P3 otherwise. A failed gate without a signal recommendation gets its own P0.

## Signals catalogue

Sources: **measured** (a browser probe reads it), **derived** (the tool computes it across probes, routes or
motion modes), **agent** (rubric answer). Weights marked E/X/I differ per profile (Essential/Expressive/Immersive).

#### Discoverability (`discoverability`)

| Signal | Source | Measures / asks | Normalisation | Weight | Gate |
|---|---|---|---|---|---|
| `accessibleNames` | measured | Share of visible interactive elements (links, buttons, inputs, ARIA widgets, tabindex ≥ 0) whose computed accessible name is non-empty (Chromium computedName; approximation when unavailable). | linear: 0.5 → 0, 1 → 1 (clamped) | 3 |  |
| `affordanceSemantics` | measured | Elements with cursor: pointer, an onclick attribute or a click listener that are not links/buttons/inputs, have no interactive role and do not wrap a real control. | linear: 5 → 0, 0 → 1 (clamped) | 2 |  |
| `linkDistinguishable` | measured | Share of links inside running text that differ from the surrounding text without hover: underline, border, background, weight, or ≥ 3:1 colour contrast against the text colour. | share used as is (0–1) | 2 |  |
| `primaryActionVisible` | measured | Share of route × viewport pages with at least one button-like action (button or filled/bordered link) inside the first viewport. | share used as is (0–1) | 1 |  |
| `featuresObvious` | agent | Looking at the above-the-fold screenshots of each route, are the primary actions and key features obvious without hunting? | agent scale 1–5 → (answer − 1) / 4 | 3 |  |

#### Usability (`usability`)

| Signal | Source | Measures / asks | Normalisation | Weight | Gate |
|---|---|---|---|---|---|
| `formLabels` | measured | Share of visible inputs, selects and textareas labelled by <label>, aria-labelledby, aria-label or title. A placeholder alone does not count. | share used as is (0–1) | 3 |  |
| `bodyTextSize` | measured | Character-weighted median computed font size of visible text blocks (≥ 20 characters of own text); the smallest page value is used. | linear: 12 px → 0, 16 px → 1 (clamped) | 2 |  |
| `lineLength` | measured | Median characters per line of visible paragraphs with ≥ 120 characters and ≥ 2 lines (text length ÷ rendered line count) on the primary viewport; line-clamped or truncated paragraphs are skipped. | plateau: 1 between 45 and 80, falling to 0 at 25 and 120 | 1 |  |
| `noHorizontalScroll` | measured | Share of route × viewport pages whose document is not wider than the viewport. | share used as is (0–1) | 2 |  |
| `taskFlow` | agent | Can the primary task be completed in a short, obvious sequence of steps without dead ends? | agent scale 1–5 → (answer − 1) / 4 | 3 |  |
| `copyClarity` | agent | Are labels, button texts and messages specific (verbs, plain language, no jargon)? | agent scale 1–5 → (answer − 1) / 4 | 2 |  |

#### Visual feedback (`visualFeedback`)

| Signal | Source | Measures / asks | Normalisation | Weight | Gate |
|---|---|---|---|---|---|
| `hoverStates` | measured | Up to 8 controls per page are hovered with the mouse; share whose computed style (colour, background, border, shadow, decoration, outline, transform, opacity, filter, ::before/::after) changes. | profile band `hoverCoverage` | 3 |  |
| `activeStates` | measured | While the mouse button is held on each sampled control, share whose computed style changes again beyond the hover state. | linear: 0 → 0, 0.6 → 1 (clamped) | 1 |  |
| `animatedFeedback` | measured | Share of the observed hover changes whose changed property is covered by a CSS transition with duration > 0. | profile band `animatedFeedback` | E0/E1/I2 |  |
| `stateFeedback` | agent | Does every action give visible feedback within ~100 ms (pressed, loading, success or failure), including on touch? | agent scale 1–5 → (answer − 1) / 4 | 3 |  |

#### Navigation consistency (`navigationConsistency`)

| Signal | Source | Measures / asks | Normalisation | Weight | Gate |
|---|---|---|---|---|---|
| `navLandmark` | measured | Share of routes with a <nav> / role="navigation" landmark containing at least two links. | share used as is (0–1) | 2 |  |
| `navConsistency` | derived | Mean pairwise similarity of the destinations in navigation landmarks (outside <main>) between routes: Jaccard overlap × agreement of relative order. Needs ≥ 2 routes. | share used as is (0–1) | 3 |  |
| `currentPage` | measured | On routes where a navigation link points to the current page, share where that link carries aria-current. | share used as is (0–1) | 1 |  |
| `pageTitles` | derived | Share of routes whose <title> is non-empty and not shared with another assessed route. | share used as is (0–1) | 1 |  |
| `wayfinding` | agent | Can people always tell where they are and how to get back (active state, breadcrumbs, back links, page headings)? | agent scale 1–5 → (answer − 1) / 4 | 2 |  |

#### Touch interaction (`touchInteraction`)

| Signal | Source | Measures / asks | Normalisation | Weight | Gate |
|---|---|---|---|---|---|
| `targetSize24` | measured | On touch viewports, share of visible interactive targets that are ≥ 24×24 CSS px or whose centred 24px box does not touch another target. Inline text links and default checkboxes/radios are exempt (WCAG 2.5.8 exceptions). | linear: 0.8 → 0, 1 → 1 (clamped) | 3 | targetSize |
| `targetSize44` | measured | On touch viewports, share of non-inline interactive targets that are at least 44×44 CSS px (Maquettekit touch default; WCAG 2.5.5 AAA). | share used as is (0–1) | 2 |  |
| `targetSpacing` | measured | On touch viewports, share of targets whose nearest neighbouring target is at least 8 CSS px away (edge to edge). | share used as is (0–1) | 1 |  |
| `zoomAllowed` | measured | Share of routes whose viewport meta neither sets user-scalable=no/0 nor maximum-scale below 2. | share used as is (0–1) | 1 | zoom |
| `gestureAlternatives` | agent | Do drag, swipe and pinch interactions have single-pointer (tap/button) alternatives (WCAG 2.5.1, 2.5.7)? | agent choice: yes → 1, partial → 0.5, no → 0 | 2 |  |

#### Keyboard support (`keyboardSupport`)

| Signal | Source | Measures / asks | Normalisation | Weight | Gate |
|---|---|---|---|---|---|
| `reachable` | measured | Tab walk (≤ 40 stops) on the primary viewport: 1 − (interactive elements that cannot take focus + focusable elements never reached) ÷ all of them. Elements flagged only by cursor: pointer are reported under discoverability instead. | linear: 0.7 → 0, 1 → 1 (clamped) | 3 | keyboard |
| `noTrap` | measured | During the Tab walk, focus never got stuck on one element or cycled inside a subset of the page. | share used as is (0–1) | 2 | keyboard |
| `focusVisible` | measured | Share of tab stops whose computed style (outline, box-shadow, border, background, colour, decoration) changes on focus, confirmed by a focused-vs-blurred screenshot diff when styles are unchanged. | linear: 0.5 → 0, 1 → 1 (clamped) | 3 | focusVisible |
| `tabOrder` | derived | Share of consecutive tab stops that move forward in reading order (down the page, or right within the same row), from the stops' document positions. | linear: 0.6 → 0, 1 → 1 (clamped) | 2 |  |
| `skipLink` | measured | Share of routes whose first tab stop is a same-page link to an existing target (e.g. #main). | share used as is (0–1) | 1 |  |
| `popupKeyboard` | measured | Up to 3 auto-discovered triggers ([aria-haspopup], [aria-expanded], popover/dialog buttons) per page are activated with Enter. Checks: opens with Enter; for menus/dialogs focus moves inside, Escape closes and focus returns to the trigger. | share used as is (0–1) | 2 |  |
| `widgetKeys` | agent | Do composite widgets (menus, tabs, sliders, carousels, listboxes, 3D views) follow the expected arrow-key model? | agent choice: yes → 1, partial → 0.5, no → 0 | 1 |  |

#### Motion usefulness (`motionUsefulness`)

| Signal | Source | Measures / asks | Normalisation | Weight | Gate |
|---|---|---|---|---|---|
| `reducedMotion` | derived | Each page is loaded twice (prefers-reduced-motion: no-preference / reduce). Violations under reduce: spatial (transform/position/size) animations > 100 ms or infinite loops still running or played, plus continuous pixel change across two 400 ms windows (whole view or 3D canvas). | linear: 3 → 0, 0 → 1 (clamped) | 4 | reducedMotion |
| `pauseControl` | derived | 1 when no large auto-playing motion was observed (infinite or > 5 s animations on elements ≥ 4000 px², or a view/canvas still changing several seconds after load), or when a visible pause/stop/reduce-motion control exists; else 0. | share used as is (0–1) | 2 | userControl |
| `infiniteLoops` | measured | Distinct infinite CSS/WAAPI animations running on visible elements in normal motion. | profile band `infiniteLoops` | E3/E2/I1 |  |
| `longestAnimation` | measured | Longest duration of a finite CSS animation/transition or Web Animation observed at load and after settling (normal motion). | profile band `longestAnimationMs` | 2 |  |
| `concurrency` | measured | Distinct animations (by name; a staggered list counts once) running on visible elements at the same moment right after load. | profile band `concurrentAnimations` | 2 |  |
| `purpose` | agent | Does each animation explain a change, guide attention or give feedback, rather than decorate? | agent scale 1–5 → (answer − 1) / 4 | 3 |  |
| `skippable` | agent | Can intros and scripted sequences be skipped, and is native scrolling never hijacked? | agent choice: yes → 1, partial → 0.5, no → 0 | E0.5/E1/I2 |  |

#### Cognitive load (`cognitiveLoad`)

| Signal | Source | Measures / asks | Normalisation | Weight | Gate |
|---|---|---|---|---|---|
| `fontSizes` | measured | Distinct computed font sizes (rounded to 1px) among visible text. | linear: 14 → 0, 6 → 1 (clamped) | 2 |  |
| `textColors` | measured | Distinct computed text colours (quantised to 32 levels per channel) among visible text. | linear: 14 → 0, 5 → 1 (clamped) | 1 |  |
| `competingActions` | measured | Prominent actions inside the first viewport: filled buttons or button-like links (≥ 2000 px²) whose fill stands out from the background behind them. Ghost, chip and text buttons are not counted. | linear: 8 → 0, 3 → 1 (clamped) | 2 |  |
| `wordsAboveFold` | measured | Words of visible text rendered inside the first viewport. | linear: 450 words → 0, 150 words → 1 (clamped) | 1 |  |
| `headingStructure` | measured | Per route: 0.5 for exactly one <h1>, 0.5 for no skipped heading levels; mean over routes. | share used as is (0–1) | 2 |  |
| `hierarchy` | agent | Is there one clear focal point per view, with secondary content visibly subordinate? | agent scale 1–5 → (answer − 1) / 4 | 3 |  |
| `progressiveDisclosure` | agent | Is complexity revealed progressively (sensible defaults, no wall of options)? | agent scale 1–5 → (answer − 1) / 4 | 2 |  |

#### Loading experience (`loadingExperience`)

| Signal | Source | Measures / asks | Normalisation | Weight | Gate |
|---|---|---|---|---|---|
| `fcp` | measured | PerformanceObserver "paint" first-contentful-paint, headless Chromium on loopback, no throttling (lab, not field). | linear: 3000 ms → 0, 1800 ms → 1 (clamped) | 2 |  |
| `lcp` | measured | PerformanceObserver "largest-contentful-paint" (last candidate before input), headless Chromium on loopback (lab, not field). | linear: 4000 ms → 0, 2500 ms → 1 (clamped) | 3 |  |
| `loadingFeedback` | derived | Visible text sampled every 100 ms from navigation start. Pages whose text grows by ≥ 80 characters and ≥ 15 % more than 300 ms after first paint have deferred content; share of those that showed aria-busy, a progressbar or a skeleton/spinner before it arrived. | share used as is (0–1) | 3 |  |
| `mediaReserved` | measured | Share of <img>, <video> and <iframe> elements whose computed aspect-ratio is set (width/height attributes or CSS aspect-ratio). | share used as is (0–1) | 1 |  |
| `perceivedWait` | agent | During waits over ~1 s (navigation, submission, data loading), is there a progress indicator or a skeleton that matches the final layout? | agent choice: yes → 1, partial → 0.5, no → 0 | 2 |  |

#### Perceived performance (`perceivedPerformance`)

| Signal | Source | Measures / asks | Normalisation | Weight | Gate |
|---|---|---|---|---|---|
| `inputLatency` | measured | A safe sample control (disclosure toggle or type="button" outside forms) is clicked twice; Event Timing duration for the interaction, or pointer timestamp → first frame after handlers (rAF + task) when below the 16 ms Event Timing threshold. Headless, unthrottled (lab). | profile band `inputLatencyMs` | 3 |  |
| `blockingTime` | derived | Sum over long tasks (PerformanceObserver "longtask") after First Contentful Paint and within ~3 s of load of (duration − 50 ms). | linear: 600 ms → 0, 200 ms → 1 (clamped) | 3 |  |
| `layoutShift` | measured | Largest session window of layout-shift entries without recent input, during load and ~1.5 s after. | linear: 0.25 → 0, 0.1 → 1 (clamped) | 2 |  |
| `layoutAnimations` | measured | Distinct layout-triggering properties (width, height, top, left, margin, padding, …) animated or declared in transitions across pages. | linear: 3 → 0, 0 → 1 (clamped) | 1 |  |
| `domSize` | measured | Number of elements in the document. | linear: 3000 elements → 0, 800 elements → 1 (clamped) | 1 |  |
| `responsiveness` | agent | Do frequent actions respond instantly (optimistic updates), with slow work deferred behind feedback? | agent scale 1–5 → (answer − 1) / 4 | 2 |  |

#### Interaction predictability (`interactionPredictability`)

| Signal | Source | Measures / asks | Normalisation | Weight | Gate |
|---|---|---|---|---|---|
| `expandedState` | measured | For auto-discovered triggers with aria-expanded / aria-controls: after activation, aria-expanded is "true" and the controlled region is visible (and vice versa). | share used as is (0–1) | 2 |  |
| `linkSemantics` | measured | Visible links with href="#" or javascript:, and <a> elements without href that have click handlers. | linear: 5 → 0, 0 → 1 (clamped) | 2 |  |
| `newWindowWarning` | measured | Share of target="_blank" links whose name, title or description mentions a new tab/window or external destination. | share used as is (0–1) | 1 |  |
| `buttonStyles` | measured | Distinct combinations of radius, height, weight, size, fill and border among visible button-like controls. | linear: 9 → 0, 4 → 1 (clamped) | 1 |  |
| `focusNoContextChange` | measured | Share of routes where tabbing through the page did not change the URL or open a window. | share used as is (0–1) | 1 |  |
| `consistentPatterns` | agent | Do the same components and gestures behave the same way everywhere (same component, same result)? | agent scale 1–5 → (answer − 1) / 4 | 3 |  |
| `reversible` | agent | Are actions reversible (undo, cancel, back) and are destructive actions confirmed? | agent scale 1–5 → (answer − 1) / 4 | 2 |  |

#### Error handling (`errorHandling`)

| Signal | Source | Measures / asks | Normalisation | Weight | Gate |
|---|---|---|---|---|---|
| `formValidation` | measured | Each form with a text-like field (not search; ≤ 2 per page) is submitted empty with non-GET requests blocked and navigation prevented. Per form, mean of: submission blocked or handled; invalid fields marked aria-invalid (0.5 for native-only); messages tied with aria-describedby/aria-errormessage (0.5 if only in a live region); focus moved to the first error; required fields marked. | share used as is (0–1) | 4 |  |
| `liveRegions` | measured | On routes with a form or deferred content, share that have a live region (role=alert/status/log, aria-live, <output>) in the DOM at load. | share used as is (0–1) | 1 |  |
| `notFound` | measured | A non-existent route is requested: 0.4 for HTTP 404/410 (not a soft 200), 0.3 for text that explains the page was not found, 0.3 for a link home or a navigation landmark. In --serve mode a 404.html at the root is honoured like static hosts do. | share used as is (0–1) | 2 |  |
| `recovery` | agent | Do error and empty states say what happened and how to fix it, and teach the next step? | agent scale 1–5 → (answer − 1) / 4 | 3 |  |
| `dataSafety` | agent | Is entered data preserved after errors and navigation, with destructive submissions confirmed? | agent scale 1–5 → (answer − 1) / 4 | 2 |  |

#### Accessibility (`accessibility`)

| Signal | Source | Measures / asks | Normalisation | Weight | Gate |
|---|---|---|---|---|---|
| `axeViolations` | measured | axe-core (WCAG 2.x A/AA tags) on the primary viewport of every route; distinct violated rules across routes weighted critical 3, serious 2, moderate 1, minor 0.5. color-contrast and target-size are scored separately. | linear: 10 → 0, 0 → 1 (clamped) | 4 |  |
| `textContrast` | measured | axe-core color-contrast on the primary viewport: passing ÷ (passing + failing) text elements; elements axe cannot decide (images, gradients) are excluded and counted. | linear: 0.8 share → 0, 1 share → 1 (clamped) | 3 | contrast |
| `screenReader` | agent | Has the primary task been completed with a screen reader (or the accessibility tree)? Answer "not-tested" if it has not. | agent choice: yes → 1, partial → 0.5, no → 0 | 2 |  |
| `flashing` | agent | Does anything flash more than three times per second (strobing shaders, rapid cuts, hard white flashes)? | agent choice: no → 1, yes → 0 | 2 | flashing |

#### Spatial interaction clarity (`spatialInteractionClarity`) — only when a WebGL/WebGPU canvas is present

| Signal | Source | Measures / asks | Normalisation | Weight | Gate |
|---|---|---|---|---|---|
| `instructions` | measured | For each visible canvas that requested a WebGL/WebGPU context: visible text near the canvas (its container, neighbouring elements, aria-describedby) that explains how to interact (drag, rotate, zoom, scroll, keys, buttons…). | share used as is (0–1) | 3 |  |
| `keyboardAlternatives` | measured | Focusable DOM controls (buttons, inputs, links) in the canvas's container or neighbourhood, or controls with aria-controls pointing at it: ≥ 2 → 1, one → 0.5, none → 0. | share used as is (0–1) | 3 |  |
| `fallback` | measured | Each 3D route is reloaded in a second Chromium with WebGL disabled and getContext forced to null: 1 if fallback content is shown ([data-maquettekit-fallback], or image/text in the canvas container) and nothing throws, 0.5 if content shows but errors are thrown, 0 otherwise. | share used as is (0–1) | 3 |  |
| `accessibleName` | measured | Share of 3D canvases with an accessible name (aria-label/labelledby/title, or a named role="img"/group container) or descriptive fallback text inside <canvas>. | share used as is (0–1) | 1 |  |
| `orientation` | agent | Can people recover orientation in the 3D view (reset view, camera limits, clear affordances)? | agent scale 1–5 → (answer − 1) / 4 | 2 |  |
| `informationOutside` | agent | Is all essential information (specs, prices, labels, calls to action) also available as DOM content outside the canvas? | agent choice: yes → 1, partial → 0.5, no → 0 | 2 |  |

### Profile weights and bands

| Dimension | Essential | Expressive | Immersive |
|---|---|---|---|
| Discoverability | 7 | 7 | 6 |
| Usability | 10 | 8 | 6 |
| Visual feedback | 6 | 8 | 9 |
| Navigation consistency | 7 | 7 | 5 |
| Touch interaction | 7 | 7 | 6 |
| Keyboard support | 9 | 8 | 7 |
| Motion usefulness | 5 | 8 | 11 |
| Cognitive load | 9 | 7 | 5 |
| Loading experience | 6 | 6 | 8 |
| Perceived performance | 8 | 7 | 7 |
| Interaction predictability | 8 | 7 | 6 |
| Error handling | 7 | 6 | 4 |
| Accessibility | 9 | 9 | 9 |
| Spatial interaction clarity | 2 | 5 | 11 |

| Band (bad → 0, good → 1) | Essential | Expressive | Immersive |
|---|---|---|---|
| `hoverCoverage` | 0.2 → 0.6 | 0.4 → 0.85 | 0.5 → 0.95 |
| `animatedFeedback` | 0.2 → 0.8 | 0.2 → 0.8 | 0.4 → 0.9 |
| `infiniteLoops` | 2 → 0 | 4 → 1 | 8 → 3 |
| `longestAnimationMs` | 600 → 250 | 1200 → 560 | 2000 → 900 |
| `concurrentAnimations` | 4 → 1 | 8 → 3 | 14 → 6 |
| `inputLatencyMs` | 300 → 100 | 500 → 200 | 500 → 200 |

### Gates

| Gate | Scope | Fails when | Standard |
|---|---|---|---|
| `reducedMotion` | all profiles | any reduced-motion violation (raw > 0) | Maquettekit invariant gate 1 (three-tier policy); WCAG 2.3.3 adopted as mandatory |
| `userControl` | all profiles | large auto-playing motion (> 5 s) on a page without a pause/stop/reduce-motion control | Maquettekit invariant gate 2; WCAG 2.2.2 Pause, Stop, Hide (A) |
| `keyboard` | all profiles | a keyboard trap, or any interactive element unreachable by Tab | WCAG 2.1.1 Keyboard (A), 2.1.2 No Keyboard Trap (A) |
| `focusVisible` | all profiles | any reached tab stop without a visible focus change | WCAG 2.4.7 Focus Visible (AA) |
| `contrast` | all profiles | any text element failing axe-core color-contrast | WCAG 1.4.3 Contrast (Minimum) (AA), measured by axe-core |
| `targetSize` | all profiles | any non-exempt touch target < 24×24 CSS px and crowded | WCAG 2.5.8 Target Size (Minimum) (AA) |
| `zoom` | all profiles | any route disables zoom | WCAG 1.4.4 Resize Text (AA) |
| `flashing` | all profiles | the agent answers "yes" (not evaluated while unanswered) | WCAG 2.3.1 Three Flashes (A) — agent-checked |
| `spatialClarity` | immersive only | a 3D canvas lacks instructions, has < 1 DOM control or no fallback | Maquettekit Immersive requirement; accessibility.md §3 |
| `motionControls` | immersive only | anything plays by itself (any infinite loop or continuous view/canvas change) and no motion control exists | Maquettekit Immersive requirement; experience-profiles.md §3 (ambient motion "pausable") |

Profiles change dimension weights, motion target bands and (Immersive) add requirements. Essential penalises
ambient loops and transitions beyond ~250 ms and expects input-to-paint ≤ 100 ms; transitioned feedback has weight
0. Immersive expects transitioned feedback on nearly every control and requires spatial clarity and a motion
control. Gates are evaluated identically in every profile.

## How the probes work

- **Load** (normal mode, every page): PerformanceObservers for paint, LCP, layout shift (largest session window),
  long tasks and Event Timing are installed before page scripts; visible text and loading indicators
  (`aria-busy`, progressbars, skeleton/spinner classes) are sampled every 100 ms. Perf is read 1.6 s after load,
  before any probe runs, so probes do not pollute the numbers.
- **DOM pass**: interactive elements with Chromium's `computedName` (flag `ComputedAccessibilityInfo`; an
  approximation otherwise), clickable-looking elements without semantics, inline links, labels, type sizes and
  colours, line length, overflow, viewport meta, navigation destinations, titles, headings, actions above the fold,
  words above the fold, media dimensions, live regions, link misuse, new-tab links, motion controls, DOM size,
  touch targets (sizes, 24 px spacing exception, gaps; inline links and default checkboxes/radios exempt).
- **Motion**: `document.getAnimations()` at load and after settling, plus viewport (and 3D-canvas) screenshots
  400 ms apart, in both motion modes; a persistence check ≥ 5 s after load on the primary viewport.
- **Primary viewport**: axe-core (WCAG A/AA tags; colour contrast counted separately); a Tab walk of ≤ 40 stops
  (Visual Director's keyboard page functions) with focused-vs-blurred screenshot confirmation; hover and press on
  ≤ 8 controls (the mouse is released elsewhere so nothing is clicked); ≤ 3 popup triggers opened with Enter (click
  only to tell "not a trigger" from "not keyboard operable"); ≤ 2 safe controls clicked twice for input latency;
  ≤ 2 forms submitted empty with non-GET requests blocked and navigation prevented.
- **Site**: an unknown route (`/maquettekit-experience-lab-404-probe`; in `--serve` mode a root `404.html` is served
  for it, like static hosts do) and, for 3D routes, a second Chromium without WebGL (`getContext` forced to null).

## Limitations

- Timings are lab measurements in headless Chromium with software rendering on loopback, without CPU or network
  throttling — not field data, not representative of user devices. Interaction latency is sampled on at most two
  controls per page.
- Heuristics can misfire: "competing actions" counts filled controls; instructions near a canvas are matched by
  keywords; fake controls are found by cursor/handlers; skeleton detection relies on class names and `aria-busy`.
- Only the initial load, an empty form submission, a 404 and auto-discovered popups are exercised. Scroll-driven
  motion, success paths, server validation, hover-only content, gestures and widget arrow-key models are not; the
  rubric covers them, and its answers are judgement, reported separately.
- Flashing (WCAG 2.3.1) is not measured: its gate stays `not-evaluated` until the agent answers.
- Probes run on the primary viewport only (except touch targets, overflow, text size, motion and load metrics).
