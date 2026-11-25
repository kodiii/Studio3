---
name: studio-review
description: Visual Director — real browser-based QA and iterative refinement for any web UI. Captures desktop/tablet/mobile screenshots in normal and reduced motion, interactive states and animation frames with Playwright, runs deterministic checks (overflow, clipping, failed assets, console errors, axe-core, keyboard and focus, tap targets, reduced motion, 3D canvas diagnostics and no-WebGL fallback), then drives up to three improve-and-retest passes with before/after comparison. Use when asked to review, QA, audit, polish, "check it in the browser", screenshot, find visual or accessibility bugs, or verify a build from any Maquettekit specialty. Not for scoring interaction quality (studio-experience) or designing from scratch.
argument-hint: "[url or static dir] [routes]"
license: MIT
metadata:
  short-description: Browser QA with measured checks, 3D diagnostics and improve loops
  module: visual-director
---

# Visual Director

Measure first, judge second, fix third, measure again. Visual Director runs a real browser; nothing in its report
is a guess unless it is labelled as heuristic or as your own subjective assessment.

## Use when

- A page, component, demo or 3D scene was built or changed and must be verified before you call it done.
- The user asks for a review, QA pass, polish pass, accessibility check, or before/after evidence.
- Another studio skill reaches its verification step (they all delegate here).

Don't use when the question is "how good is this interaction design overall" → `studio-experience` (it scores; this
skill finds defects). Don't use it to restyle a page with no defects — that is design work for a specialty skill.

## Tooling

Maquettekit tools run through one dispatcher: `node "${CLAUDE_PLUGIN_ROOT}/tools/maquettekit.mjs" <command>`. On hosts that
do not substitute that variable (Codex), the same file is `../../tools/maquettekit.mjs` relative to this SKILL.md. Below,
`maquettekit <command>` is shorthand for that invocation. Details, dependencies and exit codes:
`${CLAUDE_PLUGIN_ROOT}/shared/tooling.md`. Run `maquettekit review --help` for exact flags. `review run` needs Playwright
and Chromium: if it exits with code 3, hand over to `studio-setup`.

## Workflow

1. **Inspect (no browser).** `maquettekit review inspect --dir .` → framework, styling, motion and 3D libraries, routes,
   `maquettekit.design.json`, likely specialty. Pick the routes that matter (home, the changed pages, any 3D route) and
   the experience profile from the design file.
2. **Get a target.** Prefer the project's production build or preview server; use the dev server only if that is all
   there is. Read the project's `package.json` scripts before running one; never run unknown install or postinstall
   scripts. For static output use `--serve <dir>`. Dev servers that block cross-origin dev requests need `localhost`,
   not `127.0.0.1`.
3. **Capture + check (pass 1).**
   `maquettekit review run --url http://localhost:<port> --routes /,/pricing --out .maquettekit/review`
   Add `--states states.json` for flows the auto-discovery cannot reach (forms, multi-step dialogs, tabs), and
   `--budgets` with the project's own 3D budgets when `maquettekit.design.json` defines them. `--video` is optional.
4. **Read the report**: `.maquettekit/review/pass-1/report.md`, then the JSON for evidence. Open the screenshots
   that the issues point to — and the normal vs reduced pairs — before forming any opinion.
   Interpretation guide: `references/checks.md`; 3D: `references/three-d.md`.
5. **Assess visually (subjective, labelled).** Fill Part B of `report.md` (composition, typography, hierarchy,
   spacing, originality, motion purpose — 1–5 with evidence screenshots) using the rubric in
   `${CLAUDE_PLUGIN_ROOT}/shared/design-principles.md`. How to look: `references/visual-assessment.md`.
   In Claude Code, also hand the pass folder to the `maquettekit:design-critic` agent (read-only) with one sentence
   on the product: it scores the screenshots without the code or your reasoning, so its critique is not anchored on
   what you meant to build. Put its scores next to yours, labelled, and act on its top three changes.
6. **Improve.** `maquettekit review loop-status --out .maquettekit/review` gives the prioritised fix list (critical first,
   then major). Apply localised fixes only — no unrelated refactors, no redesigns hiding inside a fix. Record each
   change in `.maquettekit/review/changes.json` (`[{ "pass": 1, "file": "...", "change": "...", "issueIds": ["..."] }]`).
   Procedure and stop rules: `references/loop.md`.
7. **Retest.** `maquettekit review run … --pass 2`, then
   `maquettekit review compare --before .maquettekit/review/pass-1 --after .maquettekit/review/pass-2`. Repeat up to three
   passes in total (more only if the user asks). Stop when `loop-status` reports `criticalResolved` or the budget is
   exhausted.
8. **Report.** `maquettekit review summary --out .maquettekit/review` writes `SUMMARY.md` (before/after screenshots, changes,
   remaining issues, limitations). Relay to the user: what was measured, what you changed, what remains, which checks
   did not run and why, and your subjective assessment clearly labelled as such.

## Non-negotiables

- A check is reported as passed only if its status is `passed` in `report.json`. `skipped`, `limited`,
  `unavailable` and `not-applicable` are relayed verbatim with their reasons.
- Measured findings and subjective judgement live in separate sections of everything you write.
- Fixes are local to the reported problem; every fix is recorded in `changes.json` and re-measured.
- No more than three improve passes by default; never loop on cosmetic issues while a critical one is open.
- Frame-time numbers from headless software rendering are never presented as user-device performance.
- Nothing is uploaded; reports stay in the project's `.maquettekit/` directory.

## Reference files

Long references open with a quick card: read it first, and the rest only when the task needs the detail.

| File | Load when |
| - | - |
| `references/checks.md` | Reading `report.json`/`report.md`; deciding severity and the right fix for each check |
| `references/three-d.md` | Any route with a canvas: 3D diagnostics, budgets, fallback, WebGPU status |
| `references/loop.md` | Running the improve → retest loop, `changes.json`, comparisons, stop rules, visual regression in CI |
| `references/visual-assessment.md` | Writing Part B (subjective assessment) from screenshots |
| `${CLAUDE_PLUGIN_ROOT}/tools/visual-director/README.md` | Full option reference, output layout, report schema, check catalogue |
| `${CLAUDE_PLUGIN_ROOT}/shared/accessibility.md` | Translating a11y findings into fixes; what automation cannot cover |

## Expected deliverables

`.maquettekit/review/pass-<n>/` (screenshots, states, frames, `report.json`, `report.md`), `compare/` per retest,
`changes.json`, `SUMMARY.md`, and a short message: coverage (routes × viewports × motion modes), issues fixed,
issues remaining by severity, unavailable checks, subjective assessment.

## Validation

- The last pass ran (`report.json` exists for it) and `loop-status` shows no open critical issues — or the remaining
  ones are reported to the user with the reason they were not fixed.
- Every change in `changes.json` maps to an issue id and was re-measured in a later pass.
- `compare` shows no new critical/major issues introduced by the fixes.
