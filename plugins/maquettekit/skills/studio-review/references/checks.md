# Reading the checks

`report.json → checks[]` lists every check with `status` and `ran`; `issues[]` carries the findings with `evidence`
(measured values) and a stable `fingerprint` (check + route + viewport + selector) used to match issues across passes.
The full catalogue lives in `tools/visual-director/README.md`; this page is about judgement and fixes.

## Severity → action

| Severity | Meaning | Action |
| - | - | - |
| critical | Broken for some users: uncaught exception, failed script/model, axe critical, keyboard trap, page overflow on mobile, no fallback when WebGL is missing | Fix in this pass |
| major | Clear defect: contrast below AA, unlabeled control, focus not visible, tap target < 24 px, animation ignoring reduced motion, clipped text | Fix in this pass unless it needs a design decision — then ask |
| minor | Quality issue with a workaround | Batch; fix if cheap |
| info | Observation (continuous render loop, ellipsis, layout-property animation hint) | Mention; act only with reason |

## Check by check

| Check | Typical root cause | Fix pattern |
| - | - | - |
| `horizontal-overflow` | fixed widths, `100vw` inside a scrolled page, long unbroken strings, negative margins, transforms leaving the box | `max-width: 100%`, `min-width: 0` on flex/grid children, `overflow-wrap: anywhere` for URLs/ids, `100%` instead of `100vw`; clip decorative overflow with `overflow-x: clip` on the decorative wrapper only |
| `clipped-content` | fixed heights on text containers, `overflow: hidden` used for rounding | let height grow (`min-height`), move clipping to a decorative child, use `line-clamp` deliberately with full text available |
| `broken-layout` (heuristic) | zero-size media from lazy loading without dimensions, overlapping absolutely positioned controls, text < 11 px | give media intrinsic size (`width`/`height` or `aspect-ratio`), reflow overlapping controls, raise minimum font size; dismiss with a note only if a screenshot proves it intentional |
| `failed-assets` | wrong path/case, missing build artefact, CORS, 404 model/texture | fix the reference; for models also check the decoder setup (meshopt/Draco/KTX2) |
| `console-errors` | runtime bugs, hydration mismatches, missing keys, failed effects | fix the cause; never silence the console |
| `accessibility-axe` | missing names/alt, contrast, invalid ARIA, landmark issues | fix markup and tokens; contrast is usually a token problem — fix the token, not one element |
| `keyboard-navigation` | `div` buttons, `tabindex` > 0, focus traps in menus/canvases, hidden-but-focusable content | native elements, remove positive tabindex, `inert` on hidden panels, Esc closes |
| `focus-visible` | `outline: none` without replacement | a visible `:focus-visible` style (WCAG 2.4.7); aim for ≥ 3:1 against adjacent colours (1.4.11 non-text contrast; 2.4.13 Focus Appearance is AAA) |
| `dialog-focus` | dialogs not moving focus in or not restoring it | native `<dialog>` + `showModal()`, or focus management + `inert` on the background |
| `responsive` | small icon buttons, missing viewport meta | 24×24 px minimum (WCAG 2.5.8) — 44 px for primary touch targets; spacing exception only when targets are spaced |
| `reduced-motion` | CSS animations without a `prefers-reduced-motion` branch, JS animation ignoring the preference, autoplaying video/canvas | apply the three-tier policy (`${CLAUDE_PLUGIN_ROOT}/shared/accessibility.md`); canvas/video changes may be legitimate — check the screenshots |
| `motion-summary` | — | use it to find infinite loops, long durations and animated layout properties (`width/height/top/left/margin`) — move those to transforms |

## False positives

- Overlap/offscreen heuristics fire on intentionally layered compositions (hero art, marquee clones). Confirm with
  the screenshot; when it is intentional and decorative, ensure it is `aria-hidden` and say so in the report.
- Reduced-motion pixel change on a page with a playing video or a canvas that only renders a static frame late.
- axe colour-contrast on text over images or gradients is computed against an estimated background — check the
  screenshot and measure the darkest/lightest region behind the text if in doubt.

When you dismiss a finding, record why in `changes.json` with `"change": "no change — <reason>"` so the next pass's
remaining issues are explained.
