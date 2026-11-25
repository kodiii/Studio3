<div align="center">

# Maquettekit

**Design Intelligence. Motion Engineering. Digital Experiences.**

A design, motion, interaction and 3D engineering plugin for **Claude Code** and **OpenAI Codex**, also installable
as Agent Skills in **OpenCode** and **Google Antigravity** —
five design specialties on one shared engine, with tools that run real browsers and real asset pipelines.

`v4.0.0` · MIT · no telemetry

</div>

---

Maquettekit is not a prompt collection. It gives your coding agent working infrastructure:

- **12 skills** that tell the agent *how* a professional studio works — briefs, art direction, motion, 3D, review.
- **A CLI** (`maquettekit`) that the skills drive: a design-system generator, a Playwright-based visual reviewer with 3D
  diagnostics, an interaction-quality assessor, and a glTF optimisation pipeline.
- **A component & effect library** of tested recipes (WAAPI/CSS, Motion, GSAP, D3, three.js/R3F) and full demos —
  shipped as source inside the plugin, browsable in the gallery.

Ask for a premium SaaS page, a cinematic launch site, a trading dashboard, a social feed or a 3D product
configurator; the matching specialty designs it from a persisted design system, builds it from library recipes,
then measures and refines it in a real browser.

## The five studios

| Studio | Philosophy | Claude Code | Codex |
| - | - | - | - |
| **Product** | Make people want to use it. | `/maquettekit:studio-product` | `$maquettekit:studio-product` |
| **Cinematic** | Make people remember it. | `/maquettekit:studio-cinematic` | `$maquettekit:studio-cinematic` |
| **Data** | Make complex information immediately understandable. | `/maquettekit:studio-data` | `$maquettekit:studio-data` |
| **Social** | Make people participate. | `/maquettekit:studio-social` | `$maquettekit:studio-social` |
| **3D** | Make digital experiences feel tangible. | `/maquettekit:studio-3d` | `$maquettekit:studio-3d` |

Specialties are independent but collaborate: Product calls 3D for configurators, Cinematic calls 3D for scroll-driven
scenes, Data calls 3D for spatial data (only when depth carries information), Social calls Motion for interactions,
and every studio hands verification to Visual Director.

## Shared intelligence

| Module | Skill | Tool | What it does |
| - | - | - | - |
| Motion Lab | `studio-motion` | library `motion/` | Motion tokens, `createSequence`/`flip`/`viewTransition` orchestration, reduced-motion policy, recipe catalogue |
| Visual Director | `studio-review` | `maquettekit review` | Captures desktop/tablet/mobile × normal/reduced motion, states and frames; deterministic checks (overflow, clipping, assets, console, axe-core, keyboard, focus, tap targets, reduced motion); 3D diagnostics incl. a no-WebGL run; improve → retest loop with comparisons |
| Experience Lab | `studio-experience` | `maquettekit experience` | Transparent heuristic scoring across 14 interaction dimensions with Essential / Expressive / Immersive profiles and accessibility gates |
| Design Intelligence | `studio-design-system` | `maquettekit design` | Brief → `maquettekit.design.json` (art direction, type, OKLCH colour with enforced contrast, motion, 3D direction, libraries) → CSS / Tailwind v4 / TS / DTCG tokens |
| Component & Effect Library | `studio-components` | `maquettekit catalog` | Search and adapt tested recipes and demos |
| 3D Asset Pipeline | `studio-asset-optimizer` | `maquettekit assets` | Inspect, validate, optimise (meshopt/Draco, quantisation, WebP/KTX2), variants per device, manifests, thumbnails — sources never modified |
| Setup | `studio-setup` | `maquettekit doctor`, `maquettekit setup` | Diagnostics, optional dependencies, host install checks |

## Install

Requirements: **Node.js ≥ 20.11** and git. Optional for browser tools: a Chromium build via Playwright.

### macOS (Apple Silicon or Intel)

```bash
brew install node            # or use nvm / fnm
git clone https://github.com/kodiii/Studio3 maquettekit && cd maquettekit
./install.sh                 # detects Claude Code / Codex / OpenCode / Antigravity and installs into each
```

### Linux

```bash
# Node 22 via your package manager, nvm or nodesource
git clone https://github.com/kodiii/Studio3 maquettekit && cd maquettekit
./install.sh
```

The installer copies the plugin payload to `~/.maquettekit/marketplace` (archiving any previous version to
`~/.maquettekit/backups/`), registers it as a local marketplace and installs `maquettekit@maquettekit-marketplace` with each host
CLI it finds. OpenCode and Antigravity have no plugin CLI, so they get the 12 skills linked into their skills directory
instead (see below). Options: `--host claude|codex|opencode|antigravity|all` (or a comma list such as
`--host opencode,antigravity`), `--mode plugin|skills`, `--routing-rules`, `--dry-run`, `--force`, `--verify`.
Uninstall with `./uninstall.sh` (`--purge` also removes backups and tool dependencies). Status: `node scripts/install.mjs status`.

### With your agent (Claude Code, Codex, OpenCode or Antigravity)

Paste this into a Claude Code, Codex, OpenCode or Antigravity session and the agent installs Maquettekit itself:

```text
Install the Maquettekit plugin: clone https://github.com/kodiii/Studio3 into ~/maquettekit-src,
read install.sh and scripts/install.mjs before running anything, then run
./install.sh --verify and show me the output (add --host opencode or --host antigravity if
you are one of those). Afterwards tell me how to load the skills in this session.
```

`install.sh` detects which host CLIs are present, registers the plugin with each and runs `maquettekit doctor`.
Plugins load when a session starts: restart the session (or run `/reload-plugins` in Claude Code). The skills then appear
as `/maquettekit:studio-product` (Claude Code) and `$maquettekit:studio-product` (Codex). In OpenCode and Antigravity start a
new session; the skills are plain `studio-product`, `studio-3d`, … (Antigravity: `/studio-product`). If the repository
is private, the machine needs GitHub credentials that can read it.

### OpenCode and Google Antigravity

Both load [Agent Skills](https://agentskills.io) folders (`SKILL.md` + references) rather than plugins:

| | OpenCode | Antigravity (IDE and `agy` CLI) |
| - | - | - |
| Install | `./install.sh --host opencode` | `./install.sh --host antigravity` |
| Global skills dir | `~/.config/opencode/skills/` (`$XDG_CONFIG_HOME`) | `~/.gemini/config/skills/` |
| Detected by | `opencode` on PATH or `~/.config/opencode/` | `agy`/`antigravity` on PATH or `~/.gemini/antigravity*/` |
| Invoke | ask for the task, or "use the studio-product skill" | `/studio-product`, or describe the task |

The installer links rendered copies of the skills in which `${CLAUDE_PLUGIN_ROOT}` is replaced by the absolute path of
the installed payload, so every tool command and reference resolves without plugin-root substitution. OpenCode also
reads `~/.claude/skills` and `~/.agents/skills`; when Claude Code or Codex were installed in skills mode the installer
does not add a second copy for OpenCode. Per project, either host also reads `<project>/.agents/skills/`: copy
`~/.maquettekit/marketplace/rendered-skills/*` there if you want the skills checked into one repository.

**Smaller and open models often skip skills** they should load (measured in
[`plugins/maquettekit/evals/README.md`](plugins/maquettekit/evals/README.md)). With `--routing-rules` the installer adds
a short, marked "which skill for which UI work" block to each host's global rules file (`~/.config/opencode/AGENTS.md`,
`~/.gemini/GEMINI.md`, `~/.codex/AGENTS.md`, or `~/.claude/CLAUDE.md` in skills mode); uninstall removes exactly that
block. In Claude Code the plugin does the same with a prompt hook that names the skill when a request is UI work (off
with `MAQUETTEKIT_ROUTING_HINTS=0`).

### MCP server

The tools are also an MCP server (`maquettekit mcp`, stdio): agents call `catalog_search`, `catalog_install`,
`design_generate`, `design_lint`, `check`, `assets_inspect` and the rest with typed JSON arguments instead of composing
shell commands, which smaller models get right more often. The Claude Code plugin registers it automatically (its
`.mcp.json`). For other hosts, point them at the installed copy (the installer prints the exact path):

```toml
# Codex — ~/.codex/config.toml
[mcp_servers.maquettekit]
command = "node"
args = ["/home/you/.maquettekit/marketplace/plugins/maquettekit/tools/maquettekit.mjs", "mcp"]
```

```json
// OpenCode — ~/.config/opencode/opencode.json
{ "mcp": { "maquettekit": { "type": "local", "command": ["node", "/home/you/.maquettekit/marketplace/plugins/maquettekit/tools/maquettekit.mjs", "mcp"], "enabled": true } } }
```

Antigravity: add the same `command` and `args` as a server named `maquettekit` in its MCP server settings (raw config,
`mcpServers` object). The server writes files only when a tool is asked to (`catalog_install` defaults to a dry run,
`design_generate` only with `out_file`), runs browsers only for `check`, and sends nothing over the network.

### Manually, with the host CLIs

```bash
# Claude Code
claude plugin marketplace add kodiii/Studio3           # or a local path
claude plugin install maquettekit@maquettekit-marketplace

# Codex
codex plugin marketplace add https://github.com/kodiii/Studio3   # or a local path
codex plugin add maquettekit@maquettekit-marketplace
```

Each host reads its own manifest (`plugins/maquettekit/.claude-plugin/plugin.json`, `plugins/maquettekit/.codex-plugin/plugin.json`)
and marketplace (`.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`).

### Optional tool dependencies

The design, catalogue and doctor commands need nothing. Browser and asset tools load optional packages lazily; install
them once (explicit, local, no telemetry):

```bash
node ~/.maquettekit/marketplace/plugins/maquettekit/tools/maquettekit.mjs setup              # everything
node ~/.maquettekit/marketplace/plugins/maquettekit/tools/maquettekit.mjs setup --browsers   # also download Chromium
node ~/.maquettekit/marketplace/plugins/maquettekit/tools/maquettekit.mjs doctor --browser   # verify
```

## Use

In Claude Code type `/maquettekit:` to see the skills; in Codex mention `$maquettekit:<skill>`. Skills also trigger from plain
requests ("design a pricing page", "make this hero cinematic", "review this site on mobile", "optimise this GLB").

```text
/maquettekit:studio-design-system  fintech app for retail investors, calm and precise, expressive motion
/maquettekit:studio-product        premium SaaS landing page for our scheduling API
/maquettekit:studio-3d             interactive configurator for assets/models/chair.glb with an accessible fallback
/maquettekit:studio-review         http://localhost:3000 — routes / and /pricing
```

The CLI is usable on its own:

```bash
maquettekit design generate --category saas --audience "ops leads" --motion expressive --out maquettekit.design.json --css tokens.css
maquettekit review run --url http://localhost:3000 --routes /,/pricing
maquettekit experience assess --url http://localhost:3000 --profile expressive
maquettekit assets variants model.glb --out public/models --thumbnail
maquettekit catalog search "scroll pinned"
```

(`maquettekit` = `node <plugin>/tools/maquettekit.mjs`; `--help` on any command lists every option.)

## Gallery

```bash
npm install
npm run dev          # http://localhost:3333
```

The gallery is a Next.js app that runs the library's real source: a searchable, filterable recipe catalogue with live
previews of all 47 recipes, parameters, device-width preview, reduced-motion and theme toggles, and a code viewer with
copy; a page per studio with its demos (22 in total); and a dedicated 3D gallery (model viewer with camera presets, materials, lighting, animation
playback, quality levels with the real variant sizes, renderer statistics and fallback preview).

### Deploy the gallery (Vercel)

Import the GitHub repository in Vercel with **Root Directory** `apps/gallery` (framework: Next.js; "Include files outside
the root directory" left on — the build regenerates the catalogue from `plugins/maquettekit/library`). Install and build
commands are the defaults: Vercel installs the npm workspaces from the repository root and runs `npm run build`, whose
`prebuild` step rebuilds the catalogue. The gallery is fully static (81 prerendered pages) and makes no external
requests at runtime.

## Repository layout

```
.claude-plugin/marketplace.json      Claude Code marketplace
.agents/plugins/marketplace.json     Codex marketplace
plugins/maquettekit/                     the plugin (self-contained payload)
  .claude-plugin/plugin.json         Claude Code manifest
  .codex-plugin/plugin.json          Codex manifest
  skills/<12 skills>/                SKILL.md + references/
  hooks/                             Claude Code prompt hook that names the skill to load for UI work
  evals/                             skill eval suite for `claude plugin eval` (routing, judgement, builds, projects, tools)
  shared/                            cross-skill docs: workflow, tooling, design principles, accessibility, performance,
                                     experience profiles, technology selection; JSON schemas
  tools/                             the maquettekit CLI: design-intelligence, visual-director, experience-lab,
                                     asset-pipeline, catalog, doctor, setup, lib
  library/                           Component & Effect Library: src/motion, src/three, src/effects, src/demos,
                                     catalog.json, CATALOG.md
apps/gallery/                        Next.js gallery
assets/models/                       original procedural sample models (sources)
scripts/                             catalogue build, plugin validation, installer, release packaging, dev helpers
tests/                               unit (vitest), plugin (node:test), e2e (Playwright), fixtures
docs/                                ARCHITECTURE.md, LIBRARY-CONTRACT.md, SOURCE-RESEARCH.md
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how the pieces fit and how to add a specialty.

## Test

```bash
npm run validate      # plugin packaging (both hosts); runs `claude plugin validate` when the CLI is installed
npm run typecheck
npm test              # unit (tools + library) and plugin tests (manifests, skills, installer, release archive)
npm run build && npm run test:e2e   # every recipe and demo in Chromium: errors, axe, reduced motion, 390px, 3D, fallbacks
npm run eval:triggers # skill routing (claude plugin eval; runs real agent sessions, billed to you)
npm run eval -- --runs 1   # quality with vs without the plugin — see plugins/maquettekit/evals/README.md
```

Graphics-dependent tests run on software WebGL (SwiftShader) in headless Chromium; WebGPU is not available there and
is reported as unavailable rather than tested. Tests that cannot run in an environment skip with an explicit reason.

### Test report — main after v4.0.0 (2026-11-25, Linux x64, Node 22.23, Chromium 157 headless)

| Suite | Command | Result |
| - | - | - |
| Catalogue (strict) | `node scripts/build-catalog.mjs --check` | up to date — 47 recipes, 22 demos |
| Packaging, both hosts | `npm run validate` | passed, 0 warnings — including `claude plugin validate` (Claude Code 2.1.330) for the plugin and the marketplace; Codex checked structurally (Codex ships no manifest validator) |
| Types | `npm run typecheck` | library, tools and gallery clean |
| Unit (Vitest) | `npm run test:unit` | **506 passed** in 11 files — tools (Design Intelligence, Visual Director, Experience Lab, asset pipeline, catalogue) and library (catalogue contract for every recipe and demo, motion engine, three-kit, StrictMode render + leak check for every non-WebGL recipe) |
| Plugin (node:test) | `npm run test:plugin` | **28 passed, 1 skipped** — the skip is a live Codex install (no Codex CLI available); Codex command syntax is covered by a recording fake CLI. Includes a real Claude Code `plugin install`/`uninstall`, OpenCode/Antigravity skill installs and `--routing-rules` in an isolated HOME, the routing hook, eval-suite structure, and installing from the built release archive |
| Skill evals (`claude plugin eval`) | `npm run eval` | routing 45/45 (default model) and 30/30 (Haiku); a skill loads in 20/20 and 18/20 quality runs; every quality case scores 1.00 with the plugin on both models — see [`plugins/maquettekit/evals/README.md`](plugins/maquettekit/evals/README.md) for the with/without differences |
| Production build | `npm run build` | 81 static pages |
| Browser (Playwright) | `npm run test:e2e` | **313 passed, 0 flaky** — every recipe (mount, 3× remount cleanup, axe in light and dark, reduced motion, 390 px), every demo (axe light/dark, keyboard focus, reduced motion + 390 px, no-WebGL fallback for 3D), gallery behaviour, 3D initialisation/loading/missing-asset/controls/GPU disposal, shader animation, visual regression |

Dogfooding the tools on the production gallery (5 routes × desktop/tablet/mobile × normal/reduced motion):

- **Visual Director**, three passes of its own improve → retest loop:
  pass 1 reported 0 critical / 129 major; triage found one real latent defect (two chart recipes put the
  screen-reader-only class on a `<table>`, which ignores the 1 px box and left an invisible 412 × 792 px element), fixed
  in the recipes; the rest were checker false positives (text in inert, aria-hidden catalogue thumbnails; the hidden copy
  of an odometer; content measured mid-animation; a radio group's single tab stop), fixed in the checker with
  regression fixtures. A scroll-through pass now reveals scroll-triggered content before measuring it, and a planted
  low-contrast reveal in the fixtures proves it is caught. **Pass 3: 0 critical, 0 major**, 133 minor (small chart/SVG
  labels, overlap hints on brush handles and the 3D toolbar), 30 info. All 3D checks that can run here passed;
  `3d-frame-time` and `3d-cleanup` are reported *limited* and `3d-webgpu` *unavailable* (no adapter in headless
  Chromium) — never as passed.
- **Experience Lab** (`assess`, Expressive profile, 3 routes, before the final hover-state changes): **84.9 / 100 (B)**,
  confidence 0.68; all automated gates pass (reduced motion, user control, keyboard, focus visible, contrast, target
  size, zoom; flashing needs an agent answer). Recommendations it raised that were acted on: a real 404 page, hover
  states on header and catalogue controls, a 24 px+ brand link.

Not run here: Firefox and WebKit (the suite targets Chromium), real-GPU performance, a live Codex, OpenCode or
Antigravity session, and the
macOS CI job (defined in `.github/workflows/ci.yml`).

## Security and privacy

- No telemetry. Tools bind to `127.0.0.1`, write only to your project's `.maquettekit/` and the paths you pass.
- Nothing is downloaded implicitly: optional packages and browsers are installed only by `maquettekit setup`.
- Nothing is uploaded: no project file, screenshot or model leaves the machine.
- Host CLIs and external programs are invoked with argument arrays, never through a shell string.
- Source 3D assets are opened read-only; outputs go elsewhere and overwrites are refused unless forced (with a backup).
- Skills instruct agents not to run untrusted repository scripts and not to send assets to external services without
  permission.

## Limitations

- Codex support was implemented from the Codex CLI source because the official OpenAI plugin documentation was not
  reachable while building; the Codex install path is tested against a recording fake CLI, not a live Codex.
- OpenCode and Antigravity skill directories come from the `vercel-labs/skills` agent table (November 2026), because
  opencode.ai and antigravity.google were unreachable from the build environment. The installer is tested in an isolated
  HOME (files land where each host looks); loading them in a live OpenCode or Antigravity session was not tested.
- Frame-time figures from headless software rendering describe the CI machine, not user devices.
- KTX2 encoding and Blender import depend on external CLIs and were not exercised in the build environment.
- Experience Lab scores are transparent heuristics, not user research.
- Recipes are reference implementations: each renders sample content and exposes `params` for tuning. Eight are
  imported directly by demos (split-line-reveal, scramble-decode, variable-weight-wave, kinetic-marquee,
  reaction-burst, poll-result-bars, drag-reorder-list, story-progress-segments); the others are reused by copying the
  folder and lifting their content into props, as the `studio-components` skill describes. Content-agnostic named
  exports for more recipes are planned (see `docs/LIBRARY-CONTRACT.md`).

## Licence

MIT — see [`LICENSE`](LICENSE). Third-party notices, including GSAP's Standard "No Charge" licence, are in
[`NOTICE.md`](NOTICE.md). Prior art that informed the design is documented in
[`docs/SOURCE-RESEARCH.md`](docs/SOURCE-RESEARCH.md).
