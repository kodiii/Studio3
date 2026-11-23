# Studio³ tooling

All Studio³ tools are one Node.js CLI (Node >= 20.11, ESM, no build step). They run locally, upload nothing and
send no telemetry. Nothing is downloaded except by an explicit `setup`.

## Locating the CLI

| Host | Path |
| - | - |
| Claude Code (plugin) | `${CLAUDE_PLUGIN_ROOT}/tools/studio3.mjs` — substituted in plugin skill bodies |
| Codex (plugin) and other Agent Skills hosts | `../../tools/studio3.mjs`, resolved from the directory of the `SKILL.md` you are reading |
| Local installer (`install.sh`), skills-only mode | `~/.studio3/marketplace/plugins/studio3/tools/studio3.mjs` |

Resolve the path once per session, confirm it exists, and reuse it. Below, `studio3` means
`node "<that path>"`. The plugin root (for `library/`, `shared/`) is the parent of `tools/`.

## Commands

| Command | Module | Needs | Purpose |
| - | - | - | - |
| `studio3 doctor [--browser] [--json]` | setup | — | Verify runtime, manifests, skills, catalogue, optional deps, host installs |
| `studio3 setup [--only review\|assets] [--browsers] [--dry-run]` | setup | npm | Install optional dependencies into the Studio³ deps directory |
| `studio3 catalog list\|search\|show` | Component & Effect Library | — | Find recipes and demos; print source |
| `studio3 design init\|generate\|validate\|explain\|tokens\|directions` | Design Intelligence Engine | — | Create and maintain `studio3.design.json` |
| `studio3 review inspect\|run\|compare\|loop-status\|summary` | Visual Director | Playwright (not for `inspect`) | Browser capture, deterministic checks, 3D diagnostics, reports |
| `studio3 experience assess\|rubric\|score` | Experience Lab | Playwright for `assess` | Heuristic interaction-quality assessment |
| `studio3 assets inspect\|validate\|optimize\|variants\|manifest\|thumbnail\|import` | 3D Asset Pipeline | glTF Transform etc. | Inspect and optimise glTF/GLB without touching sources |

Every command prints its exact options with `--help`. Do not guess flags.

## Dependencies

Zero-dependency commands: `doctor`, `setup`, `catalog`, `design`, `review inspect`, `experience rubric|score`.
The rest load optional packages lazily from, in order: `$STUDIO3_DEPS`, the tools directory, the Studio³ deps
directory (`$CLAUDE_PLUGIN_DATA/studio3-deps` or `~/.studio3/deps`), then the current project. A missing package
produces an error naming the fix; it never triggers a download. Ask the user before running `setup` (it runs
`npm install`) and before `setup --browsers` (it downloads a Chromium build).

## Conventions

- Artefacts go to `./.studio3/` in the project (`review/pass-<n>/`, `experience/`, …). Add it to `.gitignore`
  unless the team wants reports committed. `studio3.design.json` lives at the project root and is committed.
- Human progress is written to stderr; `--json` puts machine-readable output on stdout.
- Exit codes: `0` success, `1` the check found blocking problems, `2` usage error, `3` missing dependency or
  browser, `4` component unavailable in this build.
- A check that did not run is reported as `skipped`, `unavailable`, `limited` or `not-applicable` with a reason.
  Relay those statuses to the user verbatim; never summarise them as passed.
- Never run scripts from an untrusted repository to "set it up" for a review; start only the project's own
  documented dev/preview command, and only after reading it.
