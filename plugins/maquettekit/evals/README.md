# Maquettekit skill evals

A suite for [`claude plugin eval`](https://code.claude.com/docs) that measures whether the skills route requests to the
right studio and whether they change what the agent builds. Each case is a folder: `prompt.md` (frontmatter + the
user's request) and `graders/*.md`; project cases add `case.yaml`, `scaffold.sh` and a `fixture/` project that the
scaffold copies into the agent's empty workspace.

| Tag | Cases | What is checked | Tools the agent gets |
| - | - | - | - |
| `trigger` | 17 | The right skill loads for 14 typical requests (one per skill), two boundary cases between neighbouring studios, and one backend bug where no studio should load | read-only |
| `judgement` | 4 | Advice changes where the skills have a position: 3D not earned on a SaaS pricing page, 3D earned for a handmade lamp whose glaze under changing light is the question, refusing fake urgency and invented testimonials, no pie charts for a time series (LLM-graded) | read-only |
| `build` | 5 | Single-file builds (sign-up form, card entrance, pricing section, KPI dashboard, a launch-page product hero) checked for rules the skills teach: labels, `autocomplete`, `aria-describedby`/`aria-invalid`, `:focus-visible`, `prefers-reduced-motion`, no `transition: all`, no layout animation, no invented user counts or ratings, `tabular-nums`, labelled sample data, a table alternative — plus single-criterion LLM graders, each reading the written file, for behaviour a pattern cannot see, including the motion craft floor (continuous response to pointer or scroll, physical motion, light that responds, direct manipulation with a keyboard twin) | read, write, edit |
| `project` | 3 | Multi-file work in an existing project: add pricing to a marketing site without new colours, fonts or inline styles (its `tokens.css` must still hold exactly its 8 colours); fix a product page with six planted defects across HTML and CSS — no label, no alt text, `outline: none`, 2.1:1 text, a 720 px banner, and a Save button covered by a stretched card link; add a staggered entrance to a React component using the project's motion tokens, without new dependencies and with observer cleanup | read, write, edit |
| `tools` | 2 | The plugin's own tooling: a catalogue lookup a bare model cannot answer, and a design system generated and validated with the Design Intelligence Engine | read, write, shell |

## Running

From the repository root (needs an authenticated `claude` CLI; each run is a full agent session billed to you):

```bash
npm run eval:triggers                       # routing only, cheap (about $0.10 a run)
npm run eval -- --runs 1                    # everything once, with and without the plugin (ablation; --scaffold included)
npm run eval -- --tag build --runs 3        # one group, more runs for a steadier score
npm run eval -- --model haiku --runs 1      # a smaller model as a stand-in for small open models
npm run eval -- --case build-pricing-section --keep-temp   # debug one case; keeps its workspace
```

- **Ablation** (the default for `npm run eval`) runs every case twice: with Maquettekit and without any plugin. The
  report shows both scores and the difference, which is the number that tells you whether a skill change helped.
  Routing graders (`tool_used: Skill`) only make sense with the plugin, so the runner reports them as indicators in
  the "without" arm; run `npm run eval:triggers` (no ablation) to score routing.
- **Project fixtures** are copied in by each case's `scaffold.sh`, which only runs with `--scaffold` (already in
  `npm run eval`; the runner asks for it because a scaffold is a shell script run as you — these are the suite's own).
- **The routing hook counts.** Claude Code loads the plugin's `UserPromptSubmit` hook in eval runs, so the "with" arm
  includes its hints. Set `MAQUETTEKIT_ROUTING_HINTS=0` in the environment to measure the skill descriptions alone.
- **Shell access**: cases tagged `tools` need `--allow-tools Bash` (already in `npm run eval`). The runner then refuses to
  start unless its sandbox works; on Linux that needs `bubblewrap` and `socat` (`apt install bubblewrap socat`).
- Results go to `evals/results/<timestamp>/` (`report.html`, `aggregate-result.json`) and are git-ignored. Add
  `--threshold 0.8` to make a run fail when any case scores below 0.8, e.g. in CI.
- LLM graders check one criterion each and read the file the agent wrote (`focus: {source: file, path: …}`), not the
  whole transcript: three-vote judges on long transcripts with several criteria produced most of the early noise.
- Graders are deliberately outcome-based. A case should pass whether the agent used the CLI, read the catalogue or
  remembered the answer, as long as the result is right; process checks are used only where the process is the point
  (generating and validating the design file).

## Adding a case

1. Copy a case folder of the same tag and edit `prompt.md`. Write the prompt the way a user would, not the way the
   skill describes itself — routing cases are only useful if they do not quote the skill's own wording.
2. Prefer deterministic graders (`regex` on a file, `file_exists`, `tool_used`) and keep `llm` graders for behaviour a
   pattern cannot see. An LLM grader must state concrete pass and fail conditions.
3. Run `npm run test:plugin`: `tests/plugin/evals.test.mjs` checks every case loads, every pattern compiles and every
   skill has a routing case.
4. Run the new case a few times (`--case <name> --runs 3`) with and without the plugin before trusting it.

## Baseline — 2026-11-25 (Claude Code 2.1, default model and Haiku, Linux container, routing hook on)

29 cases; 2 runs per quality case and 3 (default model) or 2 (Haiku) per routing case, so a one-run difference on a
single case is noise. Each "with" arm includes the plugin's routing hook; each "without" arm has no plugin at all.

| What | Default model | Haiku |
| - | - | - |
| Routing (17 cases, with `studio-launch` and `studio-match`; re-run after adding them) | **51 / 51** | **34 / 34** |
| A skill loads on judgement, build and project cases | **20 / 20** runs | **18 / 20** runs |
| Score with the plugin (12 quality cases) | **1.00 on every case** | **1.00 on every case** |
| Score without the plugin, where it differs | card entrance 0.83 (cards stay hidden without JavaScript ×2), pricing 0.94 (two competing CTAs ×1), recipe parameters 0.00, design engine 0.00 | chart advice 0.50 (endorsed pie charts ×1), recipe parameters 0.00, design engine 0.13 |
| Mean difference with − without | +0.19 | +0.21 |

How it got here:

| Step | Measured effect |
| - | - |
| First suite (2026-11-24) | Routing 39 / 45; **no skill loaded** on any "create `x.html`" or planning request (0 / 14 runs), so with and without scored the same — the plugin was not being used |
| Descriptions say "load before planning or advising, even for a single file" | Routing 45 / 45; loads 12 / 14 (default model), only 5 / 14 on Haiku |
| LLM graders split into single criteria that read the written file | The failures seen in both arms (dashboard colour-only, pricing honesty, entrance timing) disappeared: they were multi-part judges disagreeing over long transcripts, not missing skill rules |
| Claude Code routing hook | Loads 20 / 20 (default) and 18 / 20 (Haiku); routing unchanged at 45 / 45 and Haiku 30 / 30, including the boundary and negative cases |

What the numbers say: on these tasks a frontier model already writes most of what the graders check, so the plugin's
measurable value is in its tools and library (the two tool cases go from 0 to 1 on both models) and in the rules a
model skips on its own (no-JavaScript visibility, one CTA per plan, chart choice on Haiku). Project cases pass in both
arms on both models: at this size, multi-file edits are within reach of a model without the skills.

Not covered here:

- The browser tools (Visual Director, Experience Lab) inside eval runs. Running the evaluator as root makes the
  agent's shell read-only in its sandbox, so a dev server or Chromium cannot start there (a non-root machine should
  not have this limit; not verified here). The new `interaction-reachability` check was verified outside the evals
  instead: on the gallery build from before the WebGL fix it reports the covered card previews (15, its per-page
  cap) and nothing else; on the fixed gallery it reports nothing.
- Open models running in OpenCode or Antigravity: Haiku through Claude Code is the stand-in.
- `--routing-rules` on Codex, OpenCode and Antigravity is tested for the files it writes, not in a live session.

## Motion craft and 3D — 2026-11-27 (Claude Code 2.1, default model, routing hook on)

Measured for the motion-craft work. "Before" is the plugin as it was when that work started (commit 42f0ef8, run
from a separate checkout on the same cases), "after" is this tree, and "without" is no plugin. Two or three runs per
case, so a one-run difference is noise.

| Case | Before | After | Without the plugin |
| - | - | - | - |
| `build-product-hero` (2 runs; 4 after) | 0.79 — physical motion 1 / 2, direct manipulation 0 / 2; the same score as without the plugin | **1.00** — every grader in all 4 runs | 0.79 — physical motion 0 / 2, direct manipulation 1 / 2 |
| `judge-3d-earned` (3 runs) | 0.83 — one run kept photos first, doubting that a model could show the glaze faithfully | **1.00** | 0.00 — every answer recommended 3D but left out an obligation, for example calling the 2.4 MB model small enough to ship as is |
| `judge-3d-not-earned` (3 runs) | 1.00 | **1.00** — still no 3D on a SaaS pricing page | — |
| `build-card-entrance`, `build-pricing-section`, `build-signup-form`, `project-landing-pricing`, `project-react-motion` (2 runs each) | 1.00 on each (baseline above) | **1.00** on each: the craft floor did not leak into forms, pricing or project edits | not re-run (baseline above) |

How it got there:

| Step | Measured effect |
| - | - |
| Profile table, 3D criteria and the motion brief aligned with the craft floor | Product hero 0.79 → 0.86: physical motion 2 / 2, direct manipulation still 0 / 2 |
| The craft floor listed among the non-negotiables of `studio-product`, `studio-cinematic`, `studio-social` and `studio-motion` | Product hero 1.00 in 4 / 4 runs, direct manipulation included |
| `judge-3d-earned` first described a photogrammetry scan | 0.00 before and 1 / 5 after. The failing answers said the scan's baked lighting cannot show the glaze in other light, which is right, so the case was unfair. It now describes a PBR model with a material per glaze and a lamp-on state, and `product-3d.md` says material response needs PBR materials and lighting presets |

What the numbers say: before this work the plugin did not change how a motion-heavy build turned out (0.79 with and
without it). Rules that describe the bar were not enough on their own; listing it as a non-negotiable was. On the 3D
judgement a bare model also recommends 3D for the lamp: what the plugin adds is the obligations (a fallback, a lighter
model, lazy loading, controls that neither trap scroll nor need a drag). The hero files are 20–25 k characters, which
the runner flags as long for LLM judges; with the plugin every vote was unanimous, without it two votes split.
