# Source research — Studio³ v4.0

This document records what was actually inspected before Studio³ v4.0 was built: which projects and specifications,
at which revision, under which licence, what they really contain, and what Studio³ does with them. Research was done
on 2026-11-23.

## Method and access

| Source type | How it was verified | Notes |
| - | - | - |
| GitHub repositories (skills prior art, react-three-rapier, openai/codex) | Shallow `git clone` at the commit listed, files read; nothing executed | Treated as untrusted data. The GitHub web UI and API were not reachable from the build environment; git transport was. |
| Claude Code documentation | Fetched as Markdown from `code.claude.com/docs/en/*.md` (plugins/create, plugins/manifest-reference, plugin-marketplaces, skills, plugins-reference, discover-plugins) | Manifests validated with the Claude Code CLI 2.1.330 (`claude plugin validate`) and a real install/uninstall in an isolated HOME (see `tests/plugin/install.test.mjs`). |
| OpenAI / Codex plugin documentation | `developers.openai.com` was **blocked** by the environment's network policy | The Codex CLI source (`openai/codex` @ `a1604a8c`, 2026-11-23) was used as ground truth instead: plugin loader, manifest parser, marketplace parser, CLI and their tests. Findings below cite files. |
| Library websites (threejs.org, r3f/drei docs, motion.dev, gsap.com, d3js.org, gltf-transform.dev, playwright.dev, MDN, W3C, khronos.org, spline.design, blender.org, lottiefiles.com) | **Unreachable** from the build environment | Verified instead against the published npm packages (version, licence field, shipped sources and typings) and by running them: every library listed as "used" below is exercised by Studio³ code and tests. Where a fact could only come from the website, this document says so. |

No source code or prose was copied from the prior-art projects. Ideas are re-expressed in Studio³'s own words and
implementations; where a project's approach influenced a design decision, it is named here.


# A. Design and frontend skills


Inspected 2026-11-23 from local clones (read only; nothing executed). All five clones are shallow (depth 1), so commit cadence and contributor counts could not be measured from history; "activity" below rests on the HEAD commit date, changelogs and version strings only. Functionality is described from files present in the tree, not from running the tools.

## Impeccable

- **Project / URL:** Impeccable (Paul Bakaus) — https://github.com/pbakaus/impeccable
- **Commit inspected:** `b49177d32788f2dc585c42831d845dacf1ebed2c`, 2026-11-18
- **License:** Apache-2.0 (`LICENSE`, `package.json`). `NOTICE.md` lists exceptions: `skill/reference/ios.md` and `android.md` derive from an MIT project; the browser extension ships OFL-1.1 fonts and DuckDuckGo autoconsent, so `extension/walks/consent-rules.js` is MPL-2.0 ("the rest of this repository is Apache-2.0").
- **Verified functionality:** One skill (`skill/SKILL.src.md`, templated per host) with a 24-row command table (`critique`, `audit`, `polish`, `bolder`, `quieter`, `distill`, `typeset`, `layout`, `animate`, `overdrive`, `harden`, `adapt`, `optimize`, `shape`, `init`, `document`, `extract`, `live`, `generate`, ...), each routed to its own file in `skill/reference/` (45 files, ~466 KB). Five sub-agent definitions (`impeccable-finish-reviewer`, `-motion-reviewer`, `-documenter`, ...). A Rust engine (20 crates under `crates/`: `detect`, `live`, `browser`, `mcp`, `hook`, `wasm`...) reached through a shell launcher that runs a sibling binary or downloads one, verified against `engine-checksums.txt`. Hooks on SessionStart, PostToolUse(Edit|Write) and Stop. Chrome extension, VS Code extension, npm CLI (`npx impeccable install|detect`), SARIF/GitHub-annotation output. README claims 62 deterministic detector rules; the count was not verified.
- **Techniques worth learning:**
  - Surface "modes" (Persuade / Operate / Read / Experience) chosen per surface, not per product, and used to scale ambition.
  - Two persisted context files: `PRODUCT.md` (who/what/constraints) and `DESIGN.md` (captured visual system), loaded by one `context` call.
  - Critique scoring: Nielsen's 10 heuristics at 0-4, with `n/a` allowed by mode and the denominator renormalised (/40 vs /32), plus cognitive-load checklist, personas, P0-P3 severity and a stored score trend per target.
  - "The brief wins" rule over anti-pattern warnings; "refinement preserves, redesign replaces".
  - Per-file byte budgets for everything the skill loads (`scripts/token-budget.json`), enforced in the build.
  - A craft-floor file read immediately before any UI edit, never during planning.
  - Deterministic detector with inline ignores, stale-waiver reporting and exit codes distinguishing "findings" from "could not scan".
- **Applicable Studio³ modules:** Experience Lab (scoring model), Visual Director (hook + rendered-page checks), Product Studio, Motion Lab (`animate`/`overdrive`), Design Intelligence Engine (`document`/`extract`).
- **Technical compatibility:** Real Claude Code plugin + marketplace (`.claude-plugin/`, `plugin/`), Codex hooks (`.codex/hooks.json`), plus ~20 other host folders generated from one source.
- **Maintenance considerations:** Large (4,943 files, 104 MB tree), version 4.10.0 / engine 0.1.27. Depends on a downloaded native binary. README states live mode can launch `codex`/`claude` with approvals and sandboxing off, and that a design-direction catalog is fetched from impeccable.style with opt-out telemetry. A `cli-pro-release-keys.json` exists; any paid tier was not investigated.
- **Decision:** **Reference / independently implement.** Apache-2.0 would permit reuse with NOTICE, but the value is in ideas, and the binary, network and sandbox-bypass behaviours are unsuitable to embed.

## UI UX Pro Max

- **Project / URL:** UI UX Pro Max (Next Level Builder) — https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- **Commit inspected:** `281e4537afb11333ac9947783779aaf314ebfbf2`, 2026-11-23
- **License:** MIT (`LICENSE`, "Copyright (c) 2024 Next Level Builder"). Mixed inside: `.claude/skills/ui-styling/LICENSE.txt` is Apache-2.0 and that skill bundles 81 font/OFL files in `canvas-fonts/`; several sibling skills carry `author: claudekit` and two (`brand`, `slides`) have no license field. Data files include Google Fonts metadata and a Phosphor icons upstream snapshot.
- **Verified functionality:** A data-driven skill. `src/ui-ux-pro-max/data/` holds CSVs (row counts approximate, from line counts): `styles` (~89), `colors` (~194), `products` (~194), `ui-reasoning` (~194), `typography` (~74), `ux-guidelines` (~141), `charts` (~25), `landing`, `icons`, `motion` (~17 GSAP presets), `react-performance`, `google-fonts` (~1,934), plus 22 per-stack CSVs (React, Next.js, SwiftUI, Flutter, Three.js, WPF...). Python scripts: `core.py` (BM25 + regex search, domain auto-detection, "did you mean" suggestions), `search.py` (CLI), `design_system.py` (generator), `preview.py`, `validate_data.py`. Seven skills under `.claude/skills/` (`ui-ux-pro-max`, `design`, `design-system`, `ui-styling`, `brand`, `slides`, `banner-design`). An npm installer (`cli/`, `init|update|uninstall|versions`) rendering templates for 25 platform configs. The `design` skill's logo/icon/CIP scripts reference external image-model API keys.
- **Techniques worth learning:**
  - Product-type → reasoning row (pattern, style priority, colour mood, effects, JSON decision rules, anti-patterns, severity) → merged design system.
  - "Master + overrides" persistence: `design-system/MASTER.md` with per-page override files, optional `tokens.json` (DTCG) / `tokens.css`, skip-if-exists unless forced.
  - Three numeric dials on generation: `--variance`, `--motion`, `--density` (1-10).
  - Style rows carry "Do Not Use For", performance, accessibility, and an `rtl_level` column filterable at search time.
  - `data-provenance.json`: per-record sources, verification date and review SLA, with notes where sources disagree.
  - CI data validation and relevance evaluation scripts (`validate-csv.py`, `evaluate-relevance.py`).
- **Applicable Studio³ modules:** Design Intelligence Engine (closest analogue to `studio3.design.json`), Data Studio (chart table), Social Studio (banner sizes), Component & Effect Library.
- **Technical compatibility:** Claude Code plugin + marketplace; plain SKILL.md; Codex and others via installer templates. Requires Python 3.
- **Maintenance considerations:** v2.15.0, HEAD dated the inspection day; 745 files, 25 MB. Data is duplicated across `src/`, `cli/assets/` and `.claude/skills/` (a sync workflow guards it). Marketing counts differ from active rows ("80 searchable styles (51 active)"). Data quality of the CSVs was not audited.
- **Decision:** **Independently implement** the search-and-generate architecture; **reference** as prior art. MIT permits reuse, but mixed sub-licenses and third-party-derived data make copying data unwise.

## Anthropic frontend-design skill

- **Project / URL:** `frontend-design` in anthropics/skills — https://github.com/anthropics/skills/tree/main/skills/frontend-design
- **Commit inspected:** `e4bb5d960d87126ff3b3a8af1a104b7db67560ba`, 2026-11-16 (repo HEAD; the commit itself touched other skills)
- **License:** Apache-2.0 for this skill: `skills/frontend-design/LICENSE.txt` is the Apache 2.0 text and frontmatter says "license: Complete terms in LICENSE.txt". The repo has **no root LICENSE file**; README says "Many skills in this repo are open source (Apache 2.0)". `THIRD_PARTY_NOTICES.md` does not mention this skill.
- **Verified functionality:** Two files only: `SKILL.md` (~9.4 KB of prose) and `LICENSE.txt`. No scripts, data or references. Listed in `.claude-plugin/marketplace.json`.
- **Techniques worth learning:**
  - Role framing: a studio lead whose client already rejected templated proposals.
  - Ground choices in the subject's industry, materials and vernacular; propose subject/audience/job when the brief is silent.
  - A named list of current generated-design clusters (cream + serif + terracotta; near-black + acid accent; broadsheet hairlines; identical rounded-card kit; eyebrow/middle-dot/arrow chrome), framed as "defaults rather than choices", with the brief always overriding.
  - Two-pass process: compact token plan (4-6 named hex values, type roles, layout concept with ASCII wireframes, principles) → review against the brief for generic parts → build.
  - "Spend your boldness in one place"; one orchestrated motion moment instead of scattered reveals; structural devices (numbering, eyebrows) only when they encode real information.
  - Typographic specifics: line length under 80 characters, more line-height for serif body.
  - A UX-writing section: name things as users understand them, consistent action names through a flow, errors that direct.
  - Screenshot self-critique when the environment supports it.
- **Applicable Studio³ modules:** Product Studio, Cinematic Studio (hero/motion restraint), Design Intelligence Engine (plan-then-review step), Experience Lab (generic-default check).
- **Technical compatibility:** Plain SKILL.md; installable through the repo's Claude Code marketplace manifest. Host-neutral prose, so usable anywhere a SKILL.md is read.
- **Maintenance considerations:** Tiny and stable in shape; text content changes over time, so pin a commit when citing. No executable surface.
- **Decision:** **Reference.** Apache-2.0 would allow integration with attribution, but it is short prose we should not copy; adopt the plan-review-build loop in our own words.

## Taste Skill

- **Project / URL:** taste-skill ("tasteskill", Leonxlnx) — https://github.com/Leonxlnx/taste-skill
- **Commit inspected:** `6c0b5c78f5d31776e2210305abaa210cdc0030bf`, 2026-11-22
- **License:** MIT (`LICENSE`, "Copyright (c) 2026 Leonxlnx"). Bundled media is separately licensed: `assets/photos/photos.json` records 274 "Unsplash License", 53 CC0 and roughly 85 CC BY / CC BY-SA entries; icon sets are pinned third-party sources with their own terms and trademark flags (`references/icons.md`).
- **Verified functionality:** One skill (`skills/taste-skill/SKILL.md`, frontmatter name `design-taste-frontend`, ~31 KB) with 22 reference files (layout, sections, copy voice/registers/tells, motion, moments, effects, photos, perf, gate) and a large asset kit: `starter.html`, `system.css/js`, hero layouts, UI fragments, components, diagrams, CSS backgrounds, shader effects, scenes, WebGL objects, bundled WebP photos. Node scripts: `start.mjs` (deals palettes/type from `library/palettes.json`, `type.json`), `consistency.mjs` (~1 MB browser checker driving headless Chrome over the DevTools port), `gate.mjs`, `copy-lint.mjs`, `perf.mjs`, `shoot.mjs`, `photos.mjs`, `icons.mjs`. A Stop hook declared in SKILL.md frontmatter runs the gate. `install.sh` symlinks instead of copying.
- **Techniques worth learning:**
  - Business-kind routing (`software`, `gaming`, `tech`, `product`, `service`, `place`) decides what is allowed; shader/WebGL effects only on tech kinds, capped at 4 live WebGL contexts, each with static phone and reduced-motion states.
  - A finish gate that ends on one status line (`PASS/FAIL/OPEN/SETUP/ERROR/OFF`), limits rounds to three, caps blocks so the agent is never trapped, and records waivers with reasons (max five).
  - Rendered checks at 1440/1024/768/390 plus a 320 walk: text collisions, tap-target size, empty-area percentage, contrast, section rhythm, forced shader-failure fallback, scripts-off load.
  - Copy lint with per-device budgets for model-writing tells, running without a browser.
  - "Dealing" palettes by trade while avoiding recently used ones, to stop sameness across builds.
  - Kit self-test: its own demo pages must pass its checker (`tests/kit-clean.mjs`).
- **Applicable Studio³ modules:** Visual Director (closest analogue), Motion Lab and 3D Studio (effect gating, fallbacks), Cinematic Studio, Component & Effect Library, Experience Lab.
- **Technical compatibility:** Claude Code plugin, Codex plugin (`.codex-plugin/plugin.json`), `.agents` marketplace, plain SKILL.md. Needs Node 22+ and a Chromium browser.
- **Maintenance considerations:** v2.5.1; 2.5.0 was a full rewrite two days earlier, so churn is high. 41 MB tree, ~36 MB inside the skill. Strongly opinionated toward one site style; live network fetches (Commons, jsDelivr) in photo/icon scripts. README carries sponsor and product promotion.
- **Decision:** **Independently implement** the gate and rendered-check concepts with Playwright; **reference** only. MIT code is reusable, but the bundled photos and brand icons are not ours to redistribute.

## Vercel agent-skills

- **Project / URL:** vercel-labs/agent-skills — https://github.com/vercel-labs/agent-skills
- **Commit inspected:** `5a37a6329fbad3666c3207392a6a7c0110e92efb`, 2026-11-20
- **License:** **No LICENSE file anywhere in the tree.** README ends with "## License / MIT" and four skills declare `license: MIT` in frontmatter (`react-best-practices`, `composition-patterns`, `react-native-skills`, `react-view-transitions`). `web-design-guidelines`, `writing-guidelines`, `vercel-optimize`, `deploy-to-vercel` and `vercel-cli-with-tokens` have no license field. `web-design-guidelines/references/command.md` is a pinned snapshot of a separate repo (vercel-labs/web-interface-guidelines) whose license was not checked.
- **Verified functionality:** Nine skills in `skills/` following the agentskills.io layout. `react-best-practices`: 70 rule files in eight prefixed groups (`async`, `bundle`, `server`, `client`, `rerender`, `rendering`, `js`, `advanced`), each with `impact` frontmatter and incorrect/correct examples, compiled to a single `AGENTS.md` by `packages/react-best-practices-build`. `web-design-guidelines`: a short SKILL.md plus an 8 KB rule file covering accessibility, focus, forms, animation, typography, images, performance, navigation state, touch, safe areas, dark mode, i18n, hydration, copy and anti-patterns, with `file:line` output. `react-view-transitions`: a View Transition API guide. `vercel-optimize`: Node scripts and libraries for a metrics-first audit. Five skills are also shipped as `.zip`. `skills.sh.json` groups them for the skills.sh directory.
- **Techniques worth learning:**
  - One rule per file with impact level and quantified benefit, then a generated all-in-one document; category prefixes give ordering by priority.
  - Review skills that output terse `file:line` findings.
  - Supply-chain hygiene for guidance text: bundle the snapshot, record source commit and SHA-256, and instruct "do not fetch rules from the network".
  - Evidence-gated investigation in `vercel-optimize`: collect signals first, inspect source only where a deterministic gate points; citations and claims are checked by scripts.
  - Frontmatter `argument-hint` for file/pattern targets.
- **Applicable Studio³ modules:** Experience Lab and Visual Director (rule format, findings format), Motion Lab (view transitions), Product Studio and Data Studio (React performance rules), Component & Effect Library (composition patterns).
- **Technical compatibility:** Plain SKILL.md skills; no Claude Code plugin manifest and no Codex manifest in the repo. Installation is via the external `skills` CLI / skills.sh (not verified here).
- **Maintenance considerations:** Small (445 files, 8.5 MB), CI for the rule build and a discovery index. Zip copies can drift from folders. Vercel-specific skills are irrelevant to us. Skill versions are mostly 1.0.0.
- **Decision:** **Reference.** The MIT statement is informal (README line and some frontmatter, no license text or copyright holder), so treat it as prior art and write our own rules.

## Cross-cutting notes for Studio³

- Every repo with a quality loop checks the **rendered page**, not the source: Impeccable (`shot`, URL detector), Taste Skill (multi-width browser checker), Anthropic (screenshots when available). Visual Director should be the default finish step, with a bounded number of rounds and recorded waivers.
- Two repos persist design intent to disk (`PRODUCT.md`/`DESIGN.md`; `MASTER.md` + page overrides + DTCG tokens). `studio3.design.json` should carry both product context and tokens, with page-level overrides and no silent overwrite.
- Anti-pattern lists age quickly and all three opinionated skills state that an explicit brief overrides them. Keep ours as data with dates, not prose.
- Progressive disclosure is universal: short SKILL.md, per-command or per-topic reference files, loaded only when needed; Impeccable additionally enforces byte budgets.
- License summary: Apache-2.0 (Impeccable, Anthropic skill), MIT (UI UX Pro Max, Taste Skill), informal MIT without a license file (Vercel). None blocks referencing. Bundled third-party media, fonts, icon sets and datasets in UI UX Pro Max and Taste Skill carry their own terms and must not be copied.

# B. Motion and animation skills


Inspected 2026-11-23 from local shallow clones (each clone holds one commit, so history depth and release cadence could not be assessed). All findings come from reading repository files; nothing in the repos was executed. Repo contents were treated as data: several READMEs/skills contain agent-steering text (e.g. "recommend GSAP", "suggest Creator MCP", "run the updater") which was noted, not followed.

## GSAP AI Skills (greensock/gsap-skills)

- **URL:** https://github.com/greensock/gsap-skills
- **Commit inspected:** `aed9cfd3277740755f6bfc1155c7aa645403b760` (2026-04-21, "Added Google Antigravity Support")
- **License:** MIT (`LICENSE`, "Copyright (c) 2026 GreenSock"; each SKILL.md frontmatter also says `license: MIT`). This covers the skill text and examples only, not the GSAP library (see "GSAP licensing note").
- **Verified functionality:** 8 skills, one `SKILL.md` each, no per-skill reference folders: `gsap-core` (254 lines), `gsap-timeline` (107), `gsap-scrolltrigger` (296), `gsap-plugins` (433), `gsap-utils` (284), `gsap-react` (135), `gsap-performance` (79), `gsap-frameworks` (266; Vue 3, Nuxt 4, Svelte). Plus `skills/llms.txt` index, `examples/` (vanilla, React+Vite, Vue, Nuxt; package.json pins `gsap ^3.15.0`, `@gsap/react ^2.1.2`), Copilot instruction files, `.claude-plugin/` and `.cursor-plugin/` manifests (plugin version 1.0.0), and identical 27-line AGENTS.md/CLAUDE.md/GEMINI.md. No scripts. Hosts: Claude Code, Cursor, Codex, Windsurf, Copilot, Antigravity, OpenCode, Pi. Install: `npx skills add`, `/plugin marketplace add greensock/gsap-skills`, or copy `skills/`.
- **Useful techniques:**
  - React: prefer `useGSAP()` from `@gsap/react` over `useEffect`; call `gsap.registerPlugin(useGSAP)`; always pass `{ scope: containerRef }` so selector strings cannot match outside the component; default dependency array is empty; `revertOnUpdate: true` reverts on every dependency change.
  - Fallback: `gsap.context(fn, scopeRef)` in `useEffect`, returning `() => ctx.revert()` (kills tweens and ScrollTriggers, removes inline styles).
  - Animations created later (event handlers) are not in the context: wrap handlers in `contextSafe()` and remove listeners in the cleanup return.
  - No `gsap.*`/`ScrollTrigger.*` calls during SSR.
  - Reduced motion: `gsap.matchMedia()` (3.11+) with a conditions object (`isDesktop`, `reduceMotion`); setups auto-revert when a query stops matching; do not nest `gsap.context()` inside it, use `mm.revert()`; `gsap.matchMediaRefresh()` to re-run after an in-app motion toggle.
  - ScrollTrigger: put the trigger on the timeline or a top-level tween, never on a child tween; `scrub` and `toggleActions` are mutually exclusive (scrub wins); do not animate the pinned element, animate children; `ease: "none"` is mandatory for `containerAnimation` horizontal scroll, and pin/snap are unavailable on such triggers; create triggers in page order or set `refreshPriority`; call `ScrollTrigger.refresh()` after fonts/images/dynamic content (resize is auto-handled, debounced 200ms); `scrollerProxy` plus `ScrollTrigger.update` for third-party scrollers; `ScrollTrigger.batch()` for reveal groups; `clamp()` on start/end (3.12+).
  - Performance: transform aliases and `autoAlpha`; `gsap.quickTo()` for pointer followers; `will-change` only on elements that really animate; no blanket `force3D`.
- **Applicable Studio³ modules:** Motion Lab (GSAP+ScrollTrigger recipes, orchestration/cleanup, scroll sync, reduced motion).
- **Technical compatibility:** Agent Skills format; Claude Code and Codex are named targets. Could be installed next to Studio³ without conflict.
- **Maintenance considerations:** Vendor-official. Minor errors in the text (a snippet uses `Max.max`, some repeated "Do Not" bullets), so verify snippets rather than trust them.
- **Decision:** **Reference** (and recommend as an optional companion install). MIT permits reuse, but Studio³ writes its own rules; this is the authoritative source to validate our GSAP guidance against.

## Web Animation Skills (iart-ai/web-animation-skills)

- **URL:** https://github.com/iart-ai/web-animation-skills
- **Commit inspected:** `ed3a045192679b24d32090ee7a983871311ababd` (2026-11-11)
- **License:** MIT ("Copyright (c) 2026 iart.ai"); plugin.json also declares MIT. No unusual restrictions.
- **Verified functionality:** 9 skills, each with `SKILL.md` (167-231 lines), a README and `references/`: `gsap-web` (ScrollTrigger cookbook, Lenis/Locomotive sync, two examples), `60fps-animation`, `page-transition-animation` (Next.js App Router), `accessible-animation`, `micro-interaction` (Framer Motion / `motion/react` + CSS recipes), `glassmorphism`, `svg-animation`, `lottie-animation`, `ascii-animation` (includes `img-to-ascii.mjs`). Repo-level `scripts/`: `seek-shot.sh`, `contact-sheet.sh`, `probe-mp4.sh` (need Playwright Chromium / ffmpeg; not run). Plugin version 0.1.0. Install: `npx skills add` or Claude Code marketplace. READMEs carry heavy promotion for the commercial iart.ai service with UTM links.
- **Useful techniques:**
  - Tiered reduced motion instead of a kill switch: Tier 1 remove (parallax, large translate/zoom, spin, smooth-scroll hijack, pinned scroll scenes), Tier 2 replace with a fade of 200ms or less, Tier 3 keep (opacity, colour, focus ring, spinners).
  - CSS safety net uses `0.01ms` rather than `0s` so `transitionend`/`animationend` still fire, plus `animation-iteration-count: 1`; opt-in pattern with `(prefers-reduced-motion: no-preference)`.
  - JS gate with `matchMedia` and a `change` listener; SSR-safe `useReducedMotion` hook that defaults to motion and syncs in an effect; `gsap.matchMedia()` with `motionOK`/`motionReduce` branches; do not instantiate Lenis when reduced.
  - Lenis + ScrollTrigger: `lenis.on("scroll", ScrollTrigger.update)`, drive Lenis from `gsap.ticker` (seconds to ms), `lagSmoothing(0)`, no second rAF loop, no `scrollerProxy` under Lenis; remove the ticker callback and `lenis.destroy()` on unmount.
  - SplitText: split after `document.fonts.ready`, `revert()` on unmount, `autoSplit` (3.13+).
  - Performance: shadow via pseudo-element opacity, `height:auto` via grid `0fr→1fr` or `interpolate-size`, batch reads then writes, just-in-time `will-change` removed when idle.
  - Motion: spring 400/30 press default, `layout`/`layoutId`, `AnimatePresence mode="popLayout"`, `@starting-style` and `transition-behavior: allow-discrete`.
  - Page transitions: keyed `AnimatePresence` + frozen router context in `template.tsx`, or View Transitions API with `view-transition-name`.
  - Lottie: `.json` vs `.lottie`, segments/frames, scroll-driven `setFrame`, dotLottie themes.
  - Verification: single master timeline plus `?t=N` seek harness and `?reduce=1` flag, screenshot start/mid/end in both motion states.
- **Applicable Studio³ modules:** Motion Lab (reduced motion, scroll sync, shared-element transitions, cleanup, SVG recipes); any visual-QA/verification module (seek harness idea).
- **Technical compatibility:** Agent Skills format, Claude Code plugin manifest; "Codex and 40+ agents" claimed via the skills CLI. Uses the `framer-motion` import name in places alongside `motion/react`.
- **Maintenance considerations:** Version 0.1.0, vendor-marketing driven. The text says GSAP plugins are free "as of GSAP 3.12+"/"3.12"; the GreenSock repo gives no version number, so treat that figure as unverified. One accessible-animation sample drives Lenis from its own rAF loop, which contradicts the gsap-web guidance.
- **Decision:** **Reference / independently implement.** MIT allows adoption, but the tiering model and seek harness are ideas we re-express in our own words and code.

## Motion Graphics Skills hub (iart-ai/motion-skills)

- **URL:** https://github.com/iart-ai/motion-skills
- **Commit inspected:** `e8ba1f4eb2bcca3d1639d7545b9cd2bcfe4a3c6f` (2026-11-17, "docs: Claude app and ChatGPT connectors for the iArt MCP server (#9)")
- **License:** MIT ("Copyright (c) 2026 iart.ai").
- **Verified functionality:** **Contents differ from the name: this repo contains no skills.** 10 tracked files: README, LICENSE, two GIFs, `showcase.html`, `tools/showcase-to-gif.mjs`, and `tools/verify/` (the same three shell scripts and README as in web-animation-skills). The README is an index of "56 skills" across 19 separate pack repos (video, data animation, WebGL, Manim, kinetic typography, etc.) and an advert for the paid iart.ai agent and its remote MCP server (`app.iart.ai/api/mcp`, API key or OAuth, paid plans). The 56/19 counts and the README's cost/quality claims were not verified; only web-animation-skills among the packs was inspected.
- **Useful techniques:** Only the "deliver-and-verify loop" concept: freeze a frame, tile a start/mid/end contact sheet, assert the encoded MP4's resolution/codec/fps/duration. No motion-engineering guidance of its own.
- **Applicable Studio³ modules:** Marginal; verification/QA tooling only. Pointer to `webgl-animation-skills` and `data-animation-skills`, which may matter for Three.js/D3 work but were not cloned.
- **Technical compatibility:** Nothing installable as a skill from this repo. Scripts need Playwright Chromium and ffmpeg/ffprobe.
- **Maintenance considerations:** Active marketing hub; content is likely to track the commercial product.
- **Decision:** **Reference only** (as an index). Nothing to integrate. Do not wire the hosted MCP into Studio³.

## Motion UI (Rkj0123/motion-ui-skill)

- **URL:** https://github.com/Rkj0123/motion-ui-skill (site: blacknest.dev/motion; npm `motion-ui-skill`)
- **Commit inspected:** `e63d09b4ac908f747f357759c5a306b347f4d47e` (2026-11-21, "Slim the README and align Motion to 13.1.0 (#12)")
- **License:** MIT ("Copyright (c) 2026 Saurabh Chauhan" and "Motion UI Contributors").
- **Verified functionality:** **Much more than a skill: a 2,306-file React/Next.js component library.** One root `SKILL.md` (849 lines, version 2.2.0, mostly a catalogue table) and `catalog.json` with 617 component entries in four categories (motion, agents, blocks, craft). `components/` holds `.tsx` source built on Motion (`motion@^13.1.0`, `motion/react`) and Tailwind; `references/` has a guide per component plus 24 general guides (`motion-engineering`, `spring-motion-system`, `motion-performance`, `motion-polish-rules`, `interaction-transitions`, accessibility, colour, typography, etc.); `lib/` has shared tokens (`ease.ts`, `spring-tokens.ts`, `transition-tokens.ts`, `styles.ts` with six style presets) and 12 hooks. Also a Node CLI (`bin/`), Python scripts, `data/*.csv`, `evals/`, `agents/openai.yaml` for Codex, docs site and promo assets. Only 3 component files reference GSAP and 1 references three.js; 321 files use `useReducedMotion`. Hosts: Claude Code, Cursor, Windsurf, Codex, Antigravity, OpenCode, Copilot. Install: `npx motion-ui-skill`, `npx skills add`, or clone.
- **Useful techniques:**
  - Named spring tokens by role with stiffness/damping/mass (press 500/30/0.6, swap 460/30/0.55, panel 420/40/0.5, layout 360/32/0.6, gentle 180/24/1.0, mouse-follow 200/15/0.3, critically damped slider 700/50/0.5), plus cubic-bezier tokens mirrored as CSS variables.
  - Distance scale tied to role (4/6/8/12/30px+) rather than arbitrary offsets.
  - Layout animation rules: `layout`/`layoutId` instead of animating width/height, `layout="position"` or child `layout` to stop child distortion.
  - `AnimatePresence` mode selection (`sync`/`wait`/`popLayout`); `useAnimate` async sequencing; drag dismissal by velocity or offset thresholds.
  - Hooks that gate hover transforms to hover-capable pointers and fall back for reduced motion; skeleton-to-content swap with identical footprint to avoid layout shift.
- **Applicable Studio³ modules:** Motion Lab (Motion recipes, spring tokens, shared-element/layout orchestration, interruption); UI component and design-system modules.
- **Technical compatibility:** React + Tailwind + `@/` alias assumed; not framework-neutral. Loading an 849-line SKILL.md plus a 14,775-line catalogue is heavy on context.
- **Maintenance considerations and red flags:**
  - SKILL.md step 0 tells the agent to run `node bin/updater.mjs --silent` on every activation; the updater fetches the upstream version and can `git pull --ff-only` or download and unpack a tarball from GitHub. That is unattended remote code/content replacement.
  - Provenance: `data/colors.csv` and `data/typography.csv` are line-for-line identical to nextlevelbuilder/ui-ux-pro-max-skill (193/193 and 75/75 lines; `ux-guidelines.csv` 119/120). One guide says it was "synthesized from" that MIT project, but its copyright notice is not in `LICENSE`. Style presets are described as "inspired by" other projects. Origin of the 617 components could not be verified.
  - `icons/brands/` ships third-party logos (Apple, Google, Anthropic, etc.), a trademark matter separate from MIT.
  - Guides contain some inconsistencies (e.g. `filter: blur` listed as compositor-only).
- **Decision:** **Independently implement; reference the token taxonomy only.** Do not integrate or vendor: bulk, auto-update behaviour and unclear provenance outweigh the permissive license.

## Motion Design Skill (LottieFiles/motion-design-skill)

- **URL:** https://github.com/LottieFiles/motion-design-skill
- **Commit inspected:** `d77a9fc8cb371cab1ba5420df5bfd232cd14c9bb` (2026-11-19, merge of PR #7 "mcp-install-fixes")
- **License:** MIT ("Copyright (c) 2025 LottieFiles"); frontmatter `license: MIT`, version 1.0.0.
- **Verified functionality:** **Not a Lottie integration skill despite the publisher.** One skill, `motion-design` (332-line SKILL.md), with 17 Markdown references: `director/` (philosophy, decision framework, Disney principles for UI, personality archetypes, emotion mapping, choreography, narrative, context adaptation), `patterns/` (entrance-exit, state feedback, ambient, multi-element) and `reference/` (timing/easing tables, property selection, quality checklist, troubleshooting, export-and-render). No code, scripts or examples; described as "implementation-agnostic". Lottie/dotLottie appear only in `export-and-render.md`, which hands rendered-file requests (MP4, GIF, WebM, dotLottie, Lottie JSON) to the hosted "Creator MCP" at `creator.mcp.lottiefiles.com`; the skill tells the agent to suggest it once when a file export is requested. No runtime/player handling guidance. Install: `npx skills add`.
- **Useful techniques:**
  - Pre-animation checklist: emotional target, personality, primary property, duration, easing family, hero element, secondary/ambient layers.
  - Four personality archetypes with duration range, easing and overshoot; a "brand motion identity" of one signature easing, three durations and one entrance pattern.
  - Duration table by element type (tooltip 80-120ms up to page transition 400-600ms); distance scaling (200px = 1.3x, 400px = 1.6x); entrances 30-50% longer than exits; hover under 100ms, press under 150ms.
  - Easing direction rule (decelerate in, accelerate out, ease-in-out on-screen, sine for loops) and a table of Material 3 / Apple curves.
  - Stagger budgets (20-40ms micro, 50-100ms standard, total under 500ms); "1/3 rules" for travel distance and simultaneous movers; weight classes (heavy/medium/light) mapping to duration and overshoot.
  - Context scaling: platform duration multipliers, reduced-motion substitution table, vestibular trigger list, performance tiers by property, dark-mode intensity reduction.
- **Applicable Studio³ modules:** Motion Lab (easing/duration/stagger token system, choreography defaults); design-direction modules (motion personality tied to brand).
- **Technical compatibility:** Pure Markdown, loads anywhere; no conflict with Studio³.
- **Maintenance considerations:** Numbers are heuristics without cited sources. Some rules ("always three motion layers", "never opacity-only") conflict with restrained product UI and with reduced-motion practice, and its performance table groups `filter`/`box-shadow` loosely. The MCP upsell is a commercial hook.
- **Decision:** **Reference.** Derive our own token tables; do not reproduce their tables or wording, and do not depend on Creator MCP.

## motion-ref-skill (joepUI/motion-ref-skill)

- **URL:** https://github.com/joepUI/motion-ref-skill (demo: joepui.github.io/motion-ref-skill)
- **Commit inspected:** `55cb00f9b80da3ed904d21c6f4a61a25d54da597` (2026-06-26, "Add data visualization motion references")
- **License:** MIT ("Copyright (c) 2026 joepUI").
- **Verified functionality:** One skill, `motion-ref` (63-line SKILL.md, **written in Chinese**; English and Chinese READMEs). 13 category files in `ref/` holding 119 effect entries (counted: 14 loading, 9 button feedback, 10 text/data, 10 overlay, 7 navigation, 10 form, 5 scroll, 10 icon, 8 carousel/list, 8 state, 8 ambient, 12 data-viz, 8 enter/exit; the README table says 7 for state, so its rows sum to 118). Each entry is a few bullets: visual description, CSS/JS implementation hint, key parameter. `references/scene-routing.md` maps product problems ("clicked and nothing happens") to effect numbers; `references/output-format.md` defines two output modes: code (CSS first, tunable-parameter table, mandatory `prefers-reduced-motion` block) and English "motion prompt" for AI video tools. `demo/index.html` and `docs/index.html` are byte-identical 1,664-line live previews. No library coverage: plain CSS, SVG, IntersectionObserver, rAF, View Transitions; no GSAP, Motion, D3 or Three.js. Hosts: Claude Code, Codex, OpenClaw. Install: `npx skills add` or clone into `~/.claude/skills/`.
- **Useful techniques:**
  - How references are specified: a numbered catalogue (category.item), a problem-to-effect routing table, and progressive disclosure rules ("read only the category file you need; never load all refs; take parameters from the ref file, not memory").
  - Fixed output contract: problem solved in product language, copy-paste code, parameter table with "what changes if you alter it", reduced-motion fallback; at most 3 effects per recommendation.
  - Timing guardrail: ordinary interactions 200-500ms.
  - Data-viz motion ideas (stroke-dashoffset donuts/gauges, clip-path sparkline reveal with line and area in sync) relevant to SVG/D3 recipes.
- **Applicable Studio³ modules:** Motion Lab (recipe catalogue structure, recipe selection/routing, per-recipe parameter tables); data-visualisation motion.
- **Technical compatibility:** Format-compatible; language is a barrier for English-first use.
- **Maintenance considerations:** Last commit five months before inspection. Entries are terse hints, not production code, and several animate layout properties (`height`, `left`/`width`, `padding`, `font-size`), which conflicts with compositor-only guidance. Reduced motion is required by the output format but absent from 12 of 13 ref files.
- **Decision:** **Independently implement; reference the catalogue/routing structure.** Our 40+ recipes need full implementations, cleanup and reduced-motion variants that this repo does not provide.

## GSAP licensing note

What the gsap-skills repo itself states (README, `skills/llms.txt`, `gsap-plugins/SKILL.md`): "GSAP is 100% free — including every plugin"; following Webflow's acquisition, formerly Club GSAP plugins (SplitText, MorphSVG, etc.) are "free for everyone, including commercial use"; Club GSAP "is no longer a paid tier"; no plugin needs "a membership, license key, or auth token"; everything installs from the public `gsap` npm package; do not generate `.npmrc` auth tokens or point at the private `npm.greensock.com` registry. It links to gsap.com/blog/webflow-GSAP.

What it does not state: the repo never names or reproduces the GSAP library license, gives no date or version for the change, and does not mention "standard no-charge license". Its MIT license applies to the skills repo, not to GSAP. "Free" here means no charge; nothing in the repo says GSAP is MIT or otherwise open source. The actual licence terms (including any restrictions on use in particular kinds of products) could not be verified from these clones and should be read at gsap.com before Studio³ ships anything that bundles or redistributes GSAP. Emitting recipes that import `gsap` from npm in a user's project does not redistribute it, but the user's project is then subject to GSAP's terms, so Motion Lab should say so and keep CSS/WAAPI/Motion alternatives for each GSAP recipe.

# C. Core animation technologies

| Project | URL | Version verified | Licence | Studio³ use | Decision |
| - | - | - | - | - | - |
| Motion (`motion`, `motion/react`) | https://motion.dev/ | 14.14.0 | MIT | React state, gesture and layout animation recipes (`morphing-nav-pill`, `expanding-card-detail`, `swipe-card-stack`, `drag-reorder-list`, `pull-to-reveal-sheet` …) | Integrate as an optional dependency per recipe |
| GSAP (`gsap`, `@gsap/react`) | https://gsap.com/docs/v3/ | 3.15.1 / 2.1.2 | GreenSock **Standard "no charge" licence** (package field: `Standard 'no charge' license: https://gsap.com/standard-license`) — free, including formerly paid plugins, but not an OSI licence | ScrollTrigger choreography recipes (`scroll-pin-chapters`, `horizontal-scroll-gallery`), cinematic demos | Integrate per recipe; licence surfaced in docs and NOTICE; projects must accept GreenSock's terms |
| Lottie | https://lottiefiles.com/ | `lottie-web` 5.13.0, `@lottiefiles/dotlottie-web` 0.83.2 (npm metadata only) | MIT | Not bundled: Studio³ recipes are code-native. Skills tell agents to use the dotLottie player when designers hand over Lottie files | Reference |
| D3 | https://d3js.org/ | 7.9.2 | ISC | Scales, shapes, interpolators and brush maths for chart recipes and data demos; React owns the DOM | Integrate per recipe |
| Web Animations API, View Transitions, CSS scroll-driven animations | MDN | browser APIs | — | `createSequence`, `flip`, `viewTransition` in `library/src/motion/orchestrator.ts`; `scroll-progress-rail` (with feature detection and JS fallback) | Implement natively |

Technology ladder adopted for every recipe and skill: CSS → Web Animations API → Motion → GSAP → three.js/R3F
(`plugins/studio3/shared/technology-selection.md`).

# D. 3D, spatial and graphics technologies

| Project | URL | Version verified | Licence | Verified functionality (by running it in Studio³) | Decision |
| - | - | - | - | - | - |
| three.js | https://threejs.org/ | 0.187.0 | MIT | WebGLRenderer, BufferGeometry/InstancedMesh/Points, ShaderMaterial (GLSL), AnimationMixer, `GLTFLoader` + `MeshoptDecoder` (`three/examples/jsm`, also exported as `three/addons/*`), PMREM/RoomEnvironment. The package also ships `three/webgpu` and `three/tsl` builds | Integrate (kit + recipes) |
| Three.js examples (`three/examples/jsm`) | https://threejs.org/examples/ | 0.187.0 | MIT | Loaders and decoders above; `libs/draco` and `libs/basis` transcoders present for projects that need them | Integrate (imports only) |
| React Three Fiber | https://r3f.docs.pmnd.rs/ | 9.8.2 (peer: React ≥19 <19.4, three ≥0.156) | MIT | `<Canvas>` with `frameloop` demand/always/never, `invalidate`, `useFrame`, `addAfterEffect`, renderer `info` — wrapped by `StudioCanvas` | Integrate for React projects only |
| Drei | https://drei.docs.pmnd.rs/ | 10.7.9 | MIT | Helpers used selectively (e.g. `Html`, controls). Note: `Environment` presets download HDRIs from a CDN — Studio³ generates environments locally instead | Integrate selectively |
| React Three Rapier | https://github.com/pmndrs/react-three-rapier | 2.2.0 (npm); upstream @ `ae5c3fe` (2025-11-03) | MIT (upstream `LICENSE`, © 2022 Poimandres; the published npm package omits the licence field and file). Core engine `@dimforge/rapier3d-compat` 0.19.2: Apache-2.0 | Physics playground demo: fixed timestep, sleeping, kinematic dragging, lazy-loaded WASM | Integrate only where physics is justified |
| Spline | https://spline.design/ | `@splinetool/runtime` 2.0.213, `@splinetool/react-spline` 4.2.0 (npm metadata only) | **No licence declared** in npm metadata; proprietary hosted service | Not used. Skills treat Spline as an option only when a team already designs in Spline, and require checking its terms and never uploading project assets without permission | Reference |
| Blender | https://www.blender.org/ | not installed in the build environment | GPL (application) | `studio3 assets import` invokes Blender's CLI as a separate program with an argv array; the converter script and the unavailable path are unit-tested; real conversion is **untested** here | Reference (external tool) |
| glTF 2.0 and ecosystem | https://www.khronos.org/gltf/ | — | Khronos specification | GLB is the delivery format; extensions used: `EXT_meshopt_compression`, `KHR_mesh_quantization`, `EXT_texture_webp` (plus `KHR_draco_mesh_compression`, `KHR_texture_basisu` as options) | Adopt |
| Khronos glTF-Validator (`gltf-validator`) | https://github.com/KhronosGroup/glTF-Validator | 2.0.0-dev.3.10 | Apache-2.0 | `studio3 assets validate` | Integrate (optional dependency) |
| glTF Transform | https://gltf-transform.dev/ | 4.5.1 (`core`, `extensions`, `functions`) | MIT | dedup, prune, weld, simplify, reorder, quantize, textureCompress, meshopt/Draco writers in the asset pipeline. Version 4.5.1 has no KTX2 transform; KTX2 shells out to the `ktx` CLI when present | Integrate (optional dependency) |
| meshoptimizer | https://github.com/zeux/meshoptimizer | 1.3.0 | MIT | Reorder, simplify, `EXT_meshopt_compression` encode; decoder shipped by three.js | Integrate |
| Draco (`draco3dgltf`) | https://github.com/google/draco | 1.5.9 | Apache-2.0 | Optional `--compress draco` | Integrate (optional) |
| KTX-Software / Basis Universal | https://github.com/KhronosGroup/KTX-Software | not installed | Apache-2.0 | `--texture-format ktx2` when the `ktx` CLI is on PATH; otherwise WebP with a recorded skip. **Untested** in the build environment | Reference (external tool) |
| WebGPU | https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API | — | W3C specification | Headless Chromium 157 in the build environment exposes no WebGPU adapter. Studio³ detects WebGPU (`detectWebGPU()`: API present **and** adapter acquired), never assumes it, and keeps WebGL as the rendering path. Visual Director reports WebGPU as `unavailable`, not as a failure | Detect only; WebGL first |
| sharp (libvips) | https://sharp.pixelplumbing.com/ | 0.35.5 | Apache-2.0 (libvips LGPL-3.0, dynamically linked) | Texture resize/re-encode | Integrate (optional dependency) |

# E. Agent plugin specifications

## Claude Code (verified against the official docs and the CLI)

| Fact | Source | Studio³ implementation |
| - | - | - |
| Manifest at `.claude-plugin/plugin.json`; only `name` required; unknown top-level keys stripped with a warning; components default to `skills/`, `commands/`, `agents/`, `hooks/hooks.json`, `.mcp.json`, `bin/` | plugins/manifest-reference | `plugins/studio3/.claude-plugin/plugin.json` (no Codex-only keys) |
| Names starting `claude-`/`anthropic-` are reserved; kebab-case | manifest-reference §name | `studio3` |
| Marketplace at `.claude-plugin/marketplace.json` with `name`, `owner`, `plugins[]`; relative `source` from the marketplace root, no `..` | plugin-marketplaces | root `.claude-plugin/marketplace.json` → `./plugins/studio3` |
| Install id `<plugin>@<marketplace>`; `claude plugin marketplace add`, `claude plugin install`, `claude plugin uninstall`, `claude plugin validate` | plugin-marketplaces, CLI `--help` | `scripts/install.mjs` uses exactly these; `tests/plugin/install.test.mjs` runs them for real |
| Skills: `SKILL.md` frontmatter (`name`, `description`, `when_to_use`, `argument-hint`, `allowed-tools`, `license`, `compatibility`, `metadata` …); description + when_to_use truncated at 1,536 characters in listings; plugin skills invoked as `/<plugin>:<skill>` | skills | 12 skills with `name`, `description`, `argument-hint`, `license`, `metadata` |
| `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` substituted in plugin skill bodies; `PLUGIN_DATA` survives updates | skills §substitutions, manifest-reference §environment variables | skills reference tools as `${CLAUDE_PLUGIN_ROOT}/tools/studio3.mjs`; optional dependencies install into `$CLAUDE_PLUGIN_DATA/studio3-deps` |

Validation result: `claude plugin validate plugins/studio3` and `claude plugin validate .` — "Validation passed"
(see the test report in the README for the run that produced the release).

## OpenAI Codex (verified from source; official docs unreachable)

Source: `openai/codex` @ `a1604a8c0554c09c1be45e5a121bb1889b4d9a50` (2026-11-23). Paths are relative to that tree.

| Fact | Evidence | Studio³ implementation |
| - | - | - |
| Manifest lookup: `.codex-plugin/plugin.json`, then `.claude-plugin/plugin.json`, then `.cursor-plugin/plugin.json` | `codex-rs/utils/plugins/src/plugin_namespace.rs` (`find_plugin_manifest_path`), `codex-rs/exec-server-protocol/src/protocol.rs` | separate `plugins/studio3/.codex-plugin/plugin.json`, so each host reads its own manifest |
| Recognised fields: `name`, `version`, `description`, `keywords`, `skills`, `mcpServers`, `apps`, `hooks`, `interface`, `commands`; unknown keys ignored; component paths must start with `./`, no `..` | `codex-rs/core-plugins/src/manifest.rs` (`RawPluginManifest`, path checks) | only recognised fields used; `skills: "./skills"` |
| `interface` block: `displayName`, `shortDescription`, `longDescription`, `developerName`, `category`, `capabilities`, URLs, `defaultPrompt` (≤ 3, ≤ 512 chars), `brandColor`, icons, screenshots | `manifest.rs` (`RawPluginManifestInterface`) | provided; `npm run validate` enforces the limits |
| Plugin name `[A-Za-z0-9._-]`, marketplace name `[A-Za-z0-9_-]`; `$` mentions accept `[A-Za-z0-9_:-]` | `codex-rs/core-plugin-common/src/plugin_id.rs`, `codex-rs/skills/src/mentions.rs` | `studio3`, `studio3-marketplace` |
| Marketplace lookup: `.agents/plugins/marketplace.json` (also `.claude-plugin/marketplace.json`); entries `{ name, source, policy: { installation, authentication }, category }`; local source `./path` or `{ "source": "local", "path": "./…" }` | `codex-rs/core-plugins/src/marketplace.rs` and its tests | `.agents/plugins/marketplace.json` → `./plugins/studio3` |
| CLI: `codex plugin marketplace add|list|upgrade|remove`, `codex plugin add <plugin>@<marketplace>`, `codex plugin list|remove` (there is no `codex plugin install`); TUI `/plugins`, `/skills` | `codex-rs/cli/src/plugin_cmd.rs` | installer uses `plugin add` / `plugin remove`; covered by a fake-CLI test |
| Cache `~/.codex/plugins/cache/<marketplace>/<plugin>/<version>/`, refreshed when the version string changes; config `[plugins."<plugin>@<marketplace>"] enabled = true` | `codex-rs/core-plugins/src/store.rs`, `codex-rs/core-plugin-common/src/installed.rs` | version kept in lock-step across manifests |
| Skills: frontmatter `name` (≤ 64 chars) and `description` (required), `metadata.short-description`; roots include `.agents/skills`, `~/.agents/skills`; plugin skills namespaced `<plugin>:<skill>`, invoked `$studio3:<skill>`; relative paths resolve from the SKILL.md directory; **no plugin-root variable is substituted in skill bodies** | `codex-rs/skills/src/parser.rs` (frontmatter), `codex-rs/skills/src/mentions.rs` (`$` mentions), `codex-rs/ext/skills/src/host_roots.rs` (skill roots) | every skill gives the `../../tools/studio3.mjs` fallback path; skills-only install links into `~/.agents/skills` |

Not verified (no Codex CLI available in the build environment): a live `codex plugin add` run. The installer's Codex
path is exercised against a recording fake CLI.

# F. Browser testing and accessibility

| Project | URL | Version | Licence | Use | Decision |
| - | - | - | - | - | - |
| Playwright | https://playwright.dev/ | 1.63.0 (Chromium 157 headless; SwiftShader WebGL2) | Apache-2.0 | Visual Director, Experience Lab, asset thumbnails, gallery e2e tests | Integrate (optional dependency for tools; dev dependency for tests) |
| axe-core | https://github.com/dequelabs/axe-core | 4.14.1 | MPL-2.0 (used unmodified, loaded at runtime, not redistributed in the plugin) | WCAG 2.x A/AA rule checks in Visual Director and e2e tests | Integrate (optional dependency) |
| pixelmatch / pngjs | — | 8.0.0 / 7.0.0 | ISC / MIT | Screenshot comparison | Integrate (optional dependency) |
| WCAG 2.2 | https://www.w3.org/WAI/standards-guidelines/wcag/ | 2.2 | W3C | Success criteria cited in skills and checks (e.g. 1.4.3, 1.4.11, 2.2.2, 2.4.7, 2.5.3, 2.5.7, 2.5.8) — site unreachable; criteria numbers checked against axe-core's rule metadata and the WCAG 2.2 criterion list as known | Adopt |
| MDN Web Docs | https://developer.mozilla.org/ | — | CC-BY-SA (docs) | API behaviour referenced (WebGPU, Web Animations, View Transitions, scroll-driven animations); unreachable — behaviour verified by running in Chromium | Reference |

# G. Summary of decisions

| Module | Built on | Prior art referenced (not copied) |
| - | - | - |
| Product / Cinematic / Data / Social / 3D Studio skills | Original playbooks | Impeccable (surface modes, critique loop), Anthropic frontend-design (plan → review → build), Taste Skill (bounded finish gate) |
| Motion Lab | Original tokens, `createSequence`, 47 recipes | GSAP skills (cleanup and ScrollTrigger rules), iart-ai web-animation-skills (reduced-motion tiers), Motion UI (role-named springs), LottieFiles motion-design (duration budgets), motion-ref-skill (catalogue routing) |
| Design Intelligence Engine | Original deterministic generator, OKLCH maths, schema validator | UI UX Pro Max (data-driven direction selection, page overrides), Vercel agent-skills (one rule per file with impact) |
| Visual Director / Experience Lab | Playwright, axe-core, pixelmatch | Impeccable (scoring with severity), Taste Skill (multi-width rendered checks) |
| 3D Studio and asset pipeline | three.js, R3F, Drei, Rapier, glTF Transform, meshoptimizer | — |
| Packaging | Claude Code docs + CLI; Codex source | — |
