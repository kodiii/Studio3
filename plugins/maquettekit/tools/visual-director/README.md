# Maquettekit Visual Director

Browser-based review for `maquettekit review`. Headless Chromium (Playwright), loopback only, nothing uploaded, no telemetry.
Optional dependencies (`playwright`, `axe-core`, `pixelmatch`, `pngjs`) are resolved through `lib/resolve.mjs`.

## Commands

```
maquettekit review run --url <url> | --serve <dir>
    [--routes /,/pricing] [--out .maquettekit/review] [--pass <n>] [--viewports desktop,tablet,mobile]
    [--states <file.json|json>] [--budgets <file.json|json>] [--video] [--no-3d] [--no-a11y] [--label <text>] [--json]
maquettekit review compare --before <dir> --after <dir> [--out <dir>] [--threshold 0.1] [--json]
maquettekit review compare --baseline <dir> --current <dir> --max-diff-ratio 0.01      # visual regression, exit 1 when exceeded
maquettekit review loop-status --out <dir> [--max-passes 3]                            # JSON iteration state
maquettekit review summary --out <dir> [--json]                                        # writes <out>/SUMMARY.md
maquettekit review inspect --dir <project> [--out <dir>]                               # static, no browser
```

- `run` exit code: `0` no critical issues, `1` critical issues, `>=2` tool/usage error (`3` missing dependency/browser).
- `--routes` default: the path of `--url`; for `--serve`, every `.html` file (depth ≤ 2, max 8).
- `--pass` default: next free `pass-<n>` in `--out`. Viewport presets: `desktop`, `laptop`, `tablet`, `mobile`.
- `--states`: `[{ "name": "...", "route": "/", "steps": [{ "action": "click|hover|focus|press|fill|scroll|wait", "selector": "...", "value": "..." }] }]`.
- `--budgets`: `{ drawCallsPerFrame, trianglesPerFrame, textureBytes, geometryBytes }`. Defaults (200 / 500000 / 128 MB / 64 MB) are only defaults, not universal thresholds.
- `MAQUETTEKIT_DISABLE_AXE=1` disables axe-core (the check is then reported as `skipped`).
- `compare` default `--out` is `<after>/compare`; `summary` reads optional `<out>/changes.json` (`[{pass, file, change, issueIds[]}]`).

## Output (`<out>/pass-<n>/`)

```
screenshots/<route-slug>/<viewport>-<normal|reduced>-<full|fold>.png   (+ <viewport>-fallback-no-webgl.png for 3D routes)
states/<route-slug>/<viewport>-<state>.png        frames/<route-slug>/<viewport>-<0000|0150|0400|0900>ms.png
video/<route-slug>-<viewport>.webm (only with --video)        report.json        report.md
```

`report.json`:

```
{ tool: "maquettekit-visual-director", version, generatedAt, label, target, pass,
  coverage: { routes, viewports, motionModes, states, frames, screenshots, video, scrollThrough, checksRun, checksSkipped, matrix },
  checks:  [{ id, title, category, kind: "measured"|"heuristic", status, ran, reason?, issues, runs: [{route, viewport, status, ran, reason?, details?}] }],
  issues:  [{ id, check, severity: "critical"|"major"|"minor"|"info", route, viewport, message, selector?, evidence, measured: true, fingerprint }],
  motion:  { totals, rafCadence, perRoute },
  threeD:  { budgets, budgetsSource, routes: [...] } | null,
  limitations: [...], summary: { critical, major, minor, info } }
```

`status` is `passed | failed | skipped | not-applicable | limited | unavailable`. `passed` is only reported when the check executed.
`report.md` has Part A (measured) and Part B, "Agent-led visual assessment (subjective — not measured)", a fill-in rubric.

## Measurement sequence (normal motion, per route × viewport)

load → fonts + 2 frames → 300 ms → fold + full-page screenshots → **scroll-through** → DOM checks → axe → motion →
keyboard/focus (primary viewport) → states. The scroll-through scrolls the document, and the page's main inner scroller
(`overflow: auto|scroll`, ≥ 40% of the viewport) if it has one, to the bottom in ~0.8-viewport steps with a 120 ms pause
per step, so IntersectionObserver, scroll-event and ScrollTrigger reveals fire, then returns to the top; at most 40
steps / 8 s per route and viewport, skipped when nothing is taller than its viewport. `coverage.scrollThrough[]` records
`{ route, viewport, ran, reason?, scrollers, steps, scrolledPx, reachedBottom, ms }` and report.md lists the routes that
got it. DOM geometry and axe then wait (≤ 2 s) for finite running animations and transitions to settle, so nothing is
read mid-reveal.

## Check catalogue

| Check id | What is measured | Notes |
|---|---|---|
| `horizontal-overflow` | `scrollWidth` vs `clientWidth`, offending elements | measured |
| `clipped-content` | text rects leaving an `overflow: hidden/clip` box | measured; ellipsis and line-clamp = info; text in `aria-hidden`/`inert` subtrees and screen-reader-only boxes is ignored |
| `broken-layout` | zero-size media, overlapping controls, offscreen text, text < 11px, empty body | heuristic on measured geometry |
| `failed-assets` | `<img>` with `naturalWidth` 0, failed requests, HTTP ≥ 400, categorised image/font/script/model/texture/other | measured |
| `console-errors` | `console.error` and uncaught exceptions | measured |
| `accessibility-axe` | axe-core, tags wcag2a/aa, 21a/aa, 22aa (`target-size` handled by `responsive`) | skipped if axe is missing/disabled |
| `keyboard-navigation` | Tab sequence (≤ 40 stops), traps, non-focusable or unreached controls | primary viewport only; a radio group is one stop, expected on its checked radio; `cursor: pointer` candidates are heuristic |
| `focus-visible` | computed outline/box-shadow/border/background change, screenshot-diff fallback | primary viewport only |
| `dialog-focus` | focus moves in, Escape closes, focus returns (auto-discovered dialog/menu/listbox triggers) | not-applicable if none opens |
| `interaction-reachability` | elements with pointer/click handlers — native listeners, inline handlers, React props (`__reactProps$…`), Solid `$$event` — or their own `:hover` rules, scrolled to mid-viewport and hit-tested at up to five points; reported when no point reaches them and the top element is neither inside nor an ancestor of them | measured; `major` for covered handlers, `minor` for unreachable hover styles (desktop only); elements in `inert`/`aria-hidden` subtrees or with `pointer-events: none` are skipped; cross-origin stylesheets are not read |
| `responsive` | tap targets < 24×24 with spacing/inline exceptions (touch viewports), elements wider than viewport, viewport meta | measured; decorative (`aria-hidden`/`inert`) and screen-reader-only elements are not "wider than the viewport" |
| `reduced-motion` | running animations and 500 ms pixel change under `prefers-reduced-motion: reduce` | canvas/video may legitimately change |
| `motion-summary` | CSS/WAAPI animation counts, durations, infinite, properties, layout-property hints, rAF cadence | timing is headless software rendering |
| `state-capture` / `video-capture` | explicit states; Playwright video | video is `unavailable` without ffmpeg |
| `3d-canvas-init`, `3d-context-lost`, `3d-assets` | context requests/results, loss events, failed models/textures, loader errors | measured |
| `3d-budgets` | draw calls and triangle estimate per frame, texture bytes (**estimate**), geometry bytes vs configured budgets | main-thread WebGL only |
| `3d-frame-time` | rAF interval median/p95/max, count > 50 ms | always `limited`: not representative of devices |
| `3d-render-loop` | draws continuing during a 2 s idle window | hidden-tab behaviour not tested |
| `3d-resize` | canvas CSS size vs drawing buffer before/after a viewport resize, redraw | measured |
| `3d-interaction` | new errors after pointer move/drag/wheel (and tap/touch drag on the first touch viewport) | measured |
| `3d-cleanup` | re-initialisation after navigating away and back; `__MAQUETTEKIT_3D__.disposed` at pagehide | `limited` unless the hook is exposed |
| `3d-fallback` | second Chromium with GPU disabled and `getContext` forced to null: fallback content + no uncaught errors | content detection is heuristic unless `[data-maquettekit-fallback]` is used |
| `3d-webgpu` | `navigator.gpu` + `requestAdapter()` | `unavailable` (not a failure) when there is no adapter |

Optional cooperative hook: `window.__MAQUETTEKIT_3D__ = { renderer: {calls, triangles, geometries, textures, programs}, frameloop, quality, disposed }` (all fields optional).

## Limitations

- Scroll-through: scroll-linked (scrubbed) states are measured at the position reached — the top of the page after the
  pass — not at every scroll position; reveals that reverse when they leave the viewport are measured in their hidden
  state (axe skips hidden content); horizontal scrollers, virtualised/infinite lists beyond the step and time bounds,
  and scroll-jacking libraries that ignore programmatic scrolling are not traversed. `--states` with `scroll` steps
  captures such positions as screenshots for visual review; states are not re-run through the DOM and axe checks.
- Timing is measured in headless Chromium with SwiftShader and is not representative of user devices.
- WebGPU is unavailable in headless builds without an adapter; WebGPU draw calls and rendering in Web Workers are not counted.
- GPU context release on navigation is not observable; `document.hidden` behaviour is not simulated.
- Keyboard, focus-indicator and full 3D diagnostics run on the first non-touch viewport only.
- Auto-discovered states click only `[aria-haspopup]`, `[aria-expanded="false"]`, popover triggers and dialog-like buttons; other states need `--states`.
- CSS transitions are visible only while running. Subjective design quality is not measured.
