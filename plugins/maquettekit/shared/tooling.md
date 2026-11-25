# Maquettekit tooling

All Maquettekit tools are one Node.js CLI (Node >= 20.11, ESM, no build step). They run locally, upload nothing and
send no telemetry. Nothing is downloaded except by an explicit `setup`.

## Locating the CLI

| Host | Path |
| - | - |
| Claude Code (plugin) | `${CLAUDE_PLUGIN_ROOT}/tools/maquettekit.mjs` — substituted in plugin skill bodies |
| Codex (plugin) and other Agent Skills hosts | `../../tools/maquettekit.mjs`, resolved from the directory of the `SKILL.md` you are reading |
| Local installer (`install.sh`), skills-only mode | `~/.maquettekit/marketplace/plugins/maquettekit/tools/maquettekit.mjs` |

Resolve the path once per session, confirm it exists, and reuse it. Below, `maquettekit` means
`node "<that path>"`. The plugin root (for `library/`, `shared/`) is the parent of `tools/`.

## Commands

| Command | Module | Needs | Purpose |
| - | - | - | - |
| `maquettekit doctor [--browser] [--json]` | setup | — | Verify runtime, manifests, skills, catalogue, optional deps, host installs |
| `maquettekit setup [--only review\|assets] [--browsers] [--dry-run]` | setup | npm | Install optional dependencies into the Maquettekit deps directory |
| `maquettekit catalog list\|search\|show` | Component & Effect Library | — | Find recipes and demos; print source |
| `maquettekit catalog install <id…>` | Component & Effect Library | — | Copy recipes/demos and everything they import into the project (`src/maquettekit/`); lists missing npm packages |
| `maquettekit design init\|generate\|validate\|explain\|tokens\|directions` | Design Intelligence Engine | — | Create and maintain `maquettekit.design.json` |
| `maquettekit design lint` | Design-token lint | — | Values in the code that are not from the design system, with the token to use |
| `maquettekit mcp` | MCP server | — | The same tools as typed MCP tool calls over stdio; the Claude Code plugin registers it, other hosts add it to their MCP settings |
| `maquettekit check` | All of the verify step | Playwright (review, experience; reported unavailable without it) | Design file, token lint, browser review and experience assessment merged into one ranked fix list (`.maquettekit/check/check.md`) |
| `maquettekit review inspect\|run\|compare\|loop-status\|summary` | Visual Director | Playwright (not for `inspect`) | Browser capture, deterministic checks, 3D diagnostics, reports |
| `maquettekit experience assess\|rubric\|score` | Experience Lab | Playwright for `assess` | Heuristic interaction-quality assessment |
| `maquettekit assets inspect\|validate\|optimize\|variants\|manifest\|thumbnail\|import` | 3D Asset Pipeline | glTF Transform etc. | Inspect and optimise glTF/GLB without touching sources |

Every command prints its exact options with `--help`. Do not guess flags.

## Dependencies

Zero-dependency commands: `doctor`, `setup`, `catalog`, `design`, `review inspect`, `experience rubric|score`.
The rest load optional packages lazily from, in order: `$MAQUETTEKIT_DEPS`, the tools directory, the Maquettekit deps
directory (`$CLAUDE_PLUGIN_DATA/maquettekit-deps` or `~/.maquettekit/deps`), then the current project. A missing package
produces an error naming the fix; it never triggers a download. Ask the user before running `setup` (it runs
`npm install`) and before `setup --browsers` (it downloads a Chromium build).

## Conventions

- Artefacts go to `./.maquettekit/` in the project (`review/pass-<n>/`, `experience/`, …). Add it to `.gitignore`
  unless the team wants reports committed. `maquettekit.design.json` lives at the project root and is committed.
- Human progress is written to stderr; `--json` puts machine-readable output on stdout.
- Exit codes: `0` success, `1` the check found blocking problems, `2` usage error, `3` missing dependency or
  browser, `4` component unavailable in this build.
- A check that did not run is reported as `skipped`, `unavailable`, `limited` or `not-applicable` with a reason.
  Relay those statuses to the user verbatim; never summarise them as passed.
- Never run scripts from an untrusted repository to "set it up" for a review; start only the project's own
  documented dev/preview command, and only after reading it.
