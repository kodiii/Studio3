# Maquettekit skill evals

A suite for [`claude plugin eval`](https://code.claude.com/docs) that measures whether the skills route requests to the
right studio and whether they change what the agent builds. Each case is a folder: `prompt.md` (frontmatter + the
user's request) and `graders/*.md`.

| Tag | Cases | What is checked | Tools the agent gets |
| - | - | - | - |
| `trigger` | 15 | The right skill loads for 12 typical requests (one per skill), two boundary cases between neighbouring studios, and one backend bug where no studio should load | read-only |
| `judgement` | 3 | Advice changes where the skills have a position: 3D not earned on a SaaS pricing page, refusing fake urgency and invented testimonials, no pie charts for a time series (LLM-graded) | read-only |
| `build` | 4 | Single-file builds (sign-up form, card entrance, pricing section, KPI dashboard) checked for rules the skills teach: labels, `autocomplete`, `aria-describedby`/`aria-invalid`, `:focus-visible`, `prefers-reduced-motion`, no `transition: all`, no layout animation, no invented user counts or ratings, `tabular-nums`, an accessible chart name — plus an LLM grader for behaviour regex cannot see | read, write, edit |
| `tools` | 2 | The plugin's own tooling: a catalogue lookup a bare model cannot answer, and a design system generated and validated with the Design Intelligence Engine | read, write, shell |

## Running

From the repository root (needs an authenticated `claude` CLI; each run is a full agent session billed to you):

```bash
npm run eval:triggers                       # routing only, cheap (about $0.10 a run)
npm run eval -- --runs 1                    # everything once, with and without the plugin (ablation)
npm run eval -- --tag build --runs 3        # one group, more runs for a steadier score
npm run eval -- --model haiku --runs 1      # a smaller model as a stand-in for small open models
npm run eval -- --case build-pricing-section --keep-temp   # debug one case; keeps its workspace
```

- **Ablation** (the default for `npm run eval`) runs every case twice: with Maquettekit and without any plugin. The
  report shows both scores and the difference, which is the number that tells you whether a skill change helped.
  Routing graders (`tool_used: Skill`) only make sense with the plugin, so the runner reports them as indicators in
  the "without" arm; run `npm run eval:triggers` (no ablation) to score routing.
- **Shell access**: cases tagged `tools` need `--allow-tools Bash` (already in `npm run eval`). The runner then refuses to
  start unless its sandbox works; on Linux that needs `bubblewrap` and `socat` (`apt install bubblewrap socat`).
- Results go to `evals/results/<timestamp>/` (`report.html`, `aggregate-result.json`) and are git-ignored. Add
  `--threshold 0.8` to make a run fail when any case scores below 0.8, e.g. in CI.
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

## Baseline — 2026-11-24 (Claude Code 2.1, default model and Haiku, Linux container)

Small samples (2–3 runs per case), so treat single-case differences of one run as noise.

| What | Result |
| - | - |
| Routing, default model, 3 runs × 15 cases | **45 / 45** — was 39 / 45 before this suite existed: `trigger-data` 0/3 and the motion boundary case 0/3 answered planning/advice questions without loading any skill; fixed by making the data, motion and product descriptions say to load them before planning or advising and for single-file work |
| Skill loads on build and judgement cases, default model | **12 / 14 runs** — was **0 / 14**: on concrete "create `x.html`" requests no skill loaded at all, so the plugin could not help; same description fix |
| Quality with vs without plugin, default model (9 cases × 2 runs) | tools cases **1.00 vs 0.00** (real recipe parameters; a design system from the engine); build and judgement cases **equal** — on small single-file tasks a frontier model already applies these rules |
| Same, Haiku | tools **1.00 vs 0.00** and **1.00 vs 0.13**; KPI dashboard 1.00 vs 0.88; chart advice 0.50 vs 0.00 (the run that loaded the skill passed); other cases equal; skills loaded in only 5 / 14 build and judgement runs |

Open findings to work on next:

- Smaller models still skip the skills on build tasks (5 / 14 loads on Haiku); `build-card-entrance` and
  `judge-no-dark-patterns` loaded no skill on either model in most runs.
- Failing in both arms, so not fixed by loading the skill: KPI change conveyed by colour alone / no table alternative
  (`build-kpi-dashboard`, default model), honest pricing presentation (`build-pricing-section`), stagger timing and
  no-JS visibility (`build-card-entrance`). Either the skill text should make these rules harder to miss, or the
  grader is stricter than the skill — check the transcripts (`--keep-temp`) before changing either.
- Build cases here are single files. Multi-file tasks in a real project (where the review tools run) are where the
  skills should matter most and are not covered yet.
