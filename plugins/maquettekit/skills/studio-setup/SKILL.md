---
name: studio-setup
description: Install, verify, upgrade or troubleshoot Maquettekit itself — run the doctor, install optional tool dependencies (Playwright, glTF tooling), check the Claude Code, Codex, OpenCode or Antigravity install, explain invocation syntax, or diagnose "command not found / missing dependency / browser will not launch / WebGL unavailable" errors from any Maquettekit tool. Use when the user asks to set up Maquettekit, when another studio skill reports a missing dependency, or before the first review or asset run in a new environment. Not for designing or building anything — use the specialty skills for that.
argument-hint: "[doctor | deps | upgrade | uninstall]"
license: MIT
metadata:
  short-description: Install, verify and troubleshoot the Maquettekit toolchain
  module: setup
---

# Maquettekit Setup

Get the toolchain into a verified state and report exactly what works, what is missing and what was skipped.

## Use when

- First use of Maquettekit in an environment, or after an upgrade.
- A Maquettekit command exits with code `3` (missing dependency/browser) or `4` (component unavailable).
- The user asks how to install, upgrade, uninstall or invoke Maquettekit on Claude Code, Codex, OpenCode or Antigravity.

Do not use it to "fix" a project's own build — that belongs to the specialty skill doing the work.

## Tooling

The CLI is `node "${CLAUDE_PLUGIN_ROOT}/tools/maquettekit.mjs"`. Where that variable is not substituted (Codex and
other hosts) the same file is `../../tools/maquettekit.mjs` relative to this `SKILL.md`; the local installer also keeps
it at `~/.maquettekit/marketplace/plugins/maquettekit/tools/maquettekit.mjs`. Below, `maquettekit` means that command. Details:
`${CLAUDE_PLUGIN_ROOT}/shared/tooling.md` (fallback `../../shared/tooling.md`).

## Workflow

1. **Diagnose.** Run `maquettekit doctor --json`. Read every check: `fail` blocks, `warn` limits a module, `info` is
   context. Do not run the browser probe yet if Playwright is reported missing.
2. **Decide what is needed.** Map the user's goal to dependency groups:

   | Goal | Needs | Install |
   | - | - | - |
   | Design system, catalogue search, recipes | nothing | — |
   | Visual Director, Experience Lab | `playwright`, `axe-core`, `pixelmatch`, `pngjs` + a Chromium build | `maquettekit setup --only review` |
   | 3D Asset Pipeline | `@gltf-transform/*`, `meshoptimizer`, `sharp`, `gltf-validator`, `draco3dgltf` (+ Playwright for thumbnails) | `maquettekit setup --only assets` |
   | Everything | all of the above | `maquettekit setup` |

3. **Ask before installing.** `setup` runs `npm install` in the Maquettekit deps directory; `--browsers` downloads
   Chromium. Show `maquettekit setup --dry-run …` output and get consent. If the project already has Playwright
   installed, prefer it: the tools resolve dependencies from the current project too.
4. **Install**, then run `maquettekit doctor --browser`. Confirm Chromium launches and note the graphics line:
   WebGL through a software renderer is enough for 3D diagnostics but its timings are not device timings;
   WebGPU is commonly unavailable in headless Chromium and is reported as such, not as a failure.
5. **Check the host install** when asked (see `references/hosts.md`): Claude Code `claude plugin list` /
   `claude plugin details maquettekit`; Codex `codex plugin list`; OpenCode / Antigravity `node scripts/install.mjs status`
   (skills in `~/.config/opencode/skills` / `~/.gemini/config/skills`). Report the invocation syntax for the host.
6. **Report**: version, what is ready, what is unavailable and the consequence (which checks will be skipped),
   the exact commands run. Never state that a module works unless its doctor checks are `ok`.

## Non-negotiables

- No implicit downloads, no telemetry, no uploading of project files.
- Never `sudo`, never edit shell profiles, never install global packages for the user.
- Do not delete `~/.maquettekit/backups` or the deps directory unless the user asks for a purge.
- Optional system tools (`ktx` from KTX-Software, `blender`) are detected, never installed by Maquettekit; say
  what their absence disables.

## Reference files

Long references open with a quick card: read it first, and the rest only when the task needs the detail.

| File | Load when |
| - | - |
| `references/hosts.md` | Installing, upgrading, uninstalling or invoking on Claude Code / Codex / OpenCode / Antigravity; layout of each host's plugin format |
| `references/troubleshooting.md` | Any doctor `fail`/`warn`, exit code 3/4, browser or WebGL problems, macOS/Linux specifics |
| `${CLAUDE_PLUGIN_ROOT}/shared/tooling.md` | Command map, dependency resolution order, exit codes |

## Expected deliverables

A short status report: Maquettekit version, host(s) and mode, table of modules (ready / limited / unavailable +
reason), commands executed, and next step.

## Validation

- `maquettekit doctor` exits `0` (no `fail`).
- For review/experience work: `maquettekit doctor --browser` shows `chromium ok`.
- For asset work: the `@gltf-transform/*`, `meshoptimizer`, `sharp` and `gltf-validator` checks are `ok`.
