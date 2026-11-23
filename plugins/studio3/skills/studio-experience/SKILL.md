---
name: studio-experience
description: Experience Lab — transparent, heuristic assessment of interaction quality in a real browser. Scores 14 dimensions (discoverability, usability, visual feedback, navigation consistency, touch, keyboard, motion usefulness, cognitive load, loading, perceived performance, predictability, error handling, accessibility, spatial clarity for 3D) from measured signals plus your evidence-backed rubric answers, under an Essential, Expressive or Immersive profile, with accessibility and user-control gates no profile can override, and returns prioritised recommendations. Use when asked how good an interface feels, for a UX or interaction audit, to compare iterations, or to check motion is purposeful. Not for finding rendering defects (studio-review).
argument-hint: "[url or static dir] [essential|expressive|immersive]"
license: MIT
metadata:
  short-description: Score interaction quality with measured signals and accessibility gates
  module: experience-lab
---

# Experience Lab

How does it feel to use — and why? Experience Lab answers with numbers you can trace back to evidence, not adjectives.
Every score shows its formula, its weights and how much of it is backed by measurement versus your judgement.

## Use when

- The user asks whether an interface is easy, clear, responsive, delightful, or "too much".
- After `studio-review` has removed the defects and you need to judge the experience itself.
- Comparing two iterations, or checking that a motion-rich design still serves the task.

Don't use it as a defect scanner (`studio-review` does that, with exact evidence), or as a substitute for research with
real users — say so when the stakes call for it.

## Tooling

Studio³ tools run through one dispatcher: `node "${CLAUDE_PLUGIN_ROOT}/tools/studio3.mjs" <command>`. On hosts that
do not substitute that variable (Codex), the same file is `../../tools/studio3.mjs` relative to this SKILL.md. Below,
`studio3 <command>` is shorthand for that invocation. Details: `${CLAUDE_PLUGIN_ROOT}/shared/tooling.md`. `assess`
needs Playwright (exit code 3 → `studio-setup`); `rubric` and `score` need nothing. Run `studio3 experience --help`.

## Workflow

1. **Pick the profile.** Read `motion.profile` from `studio3.design.json` (Essential, Expressive or Immersive);
   otherwise infer it from the product (tools and dashboards → Essential, marketing and product → Expressive,
   cinematic or 3D showpieces → Immersive) and say which you chose. Definitions:
   `${CLAUDE_PLUGIN_ROOT}/shared/experience-profiles.md`.
2. **Measure.** `studio3 experience assess --url http://localhost:<port> --routes /,/pricing --profile expressive`
   (or `--serve <dir>`; `--url` must be a loopback address). Include at least two routes so navigation consistency
   can be measured, and a route with a form if the product has one. Viewports default to `mobile,desktop`; without
   `--profile` the profile comes from `studio3.design.json`, else Expressive. Besides `experience.{json,md}` it writes
   `.studio3/experience/signals.json` — the input for re-scoring.
3. **Answer the rubric.** `studio3 experience rubric --profile expressive` prints the questions automation cannot
   answer. Look at the screenshots and the code, then write `answers.json` — every answer cites evidence (a
   screenshot, a selector, a file and line). Unanswered questions lower confidence; they are never assumed.
   Guidance: `references/rubric.md`.
4. **Score with answers.** Re-run `assess … --answers answers.json`, or re-score without a browser:
   `studio3 experience score --signals .studio3/experience/signals.json --answers answers.json --profile expressive --out .studio3/experience`
   (`score` writes files only with `--out`). Both `assess` and `score` exit 1 when any gate fails.
5. **Read the result** (`.studio3/experience/experience.md`): overall score and band, gates, per-dimension scores
   with confidence, and the recommendations. A failed gate caps the overall grade whatever the profile.
   How to interpret: `references/scoring.md`.
6. **Act.** Fix P0/P1 recommendations (gates first), using the specialty skill for design changes and
   `studio-review` to verify nothing regressed. Re-assess and report the before/after per dimension.
7. **Report** honestly: measured evidence and your judgement in separate sections, confidence per dimension,
   dimensions that were not applicable or not measurable, and that timings are lab measurements in headless
   Chromium (software rendering), not field data.

## Non-negotiables

- The profile changes expectations, never the gates: reduced-motion honoured, keyboard operability, pause controls,
  contrast and target size are pass/fail regardless of profile.
- Never fill rubric answers without evidence; never round a low-confidence score into a confident claim.
- Never present the score as user research or as a benchmark against other products.
- Recommendations name the dimension, the evidence, the change and the expected effect.

## Reference files

| File | Load when |
| - | - |
| `references/scoring.md` | Interpreting dimensions, signals, weights, confidence, gates and bands |
| `references/rubric.md` | Writing `answers.json`: evidence standards per question type |
| `references/improving.md` | Turning recommendations into changes per dimension, then re-assessing |
| `${CLAUDE_PLUGIN_ROOT}/tools/experience-lab/README.md` | Full signal catalogue, formula, options and limitations |
| `${CLAUDE_PLUGIN_ROOT}/shared/experience-profiles.md` | Choosing Essential, Expressive or Immersive |

## Expected deliverables

`experience.json` and `experience.md` (with answers), a short summary (profile, overall score and band, gates,
the three weakest dimensions with evidence, the top recommendations), and — after changes — a before/after table.

## Validation

- `assess` ran on at least two routes and the report lists which signals were measured, answered or unavailable.
- No gate is failing, or each failing gate is reported with its evidence and the reason it was not fixed.
- Every rubric answer in `answers.json` carries evidence.
