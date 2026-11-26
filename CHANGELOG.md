# Changelog

All notable changes to Maquettekit are documented here. The format follows Keep a Changelog and the project uses
semantic versioning. Plugin manifests (Claude Code and Codex) always carry the same version.

## [Unreleased]

### Added
- **Motion craft** (`shared/motion-craft.md`): the affirmative bar the shared rules lacked. A craft floor per profile
  (designed, physical, lit, alive, touchable), animation principles mapped to motion tokens, realism (weight and
  light), reactive drivers with catalogue starting points, direct manipulation, and a five-line motion brief.
- Experience Lab rubric question `motionUsefulness.craft`: scores whether a surface meets the craft floor of its
  profile (weight 0.5 Essential, 3 Expressive, 4 Immersive), so inert Expressive and Immersive builds lose points.

### Changed
- `studio-motion` writes a motion brief before choosing technology, picks the lightest technology that delivers the
  brief in full, and treats the craft floor and velocity-carrying gestures as non-negotiables. Steps renumbered.
- Profiles: "pick the lowest profile that achieves the brief" is now "pick the profile the surface deserves and
  deliver it in full". `studio-product`, `studio-cinematic`, `studio-social`, `studio-data` and `studio-3d` point their
  motion and art-direction steps at the craft floor. No gate changed.

## [4.1.0] — 2026-11-25

Two new skills (14 in all: `studio-launch`, `studio-match`), one-command verification (`maquettekit check`), a
design-token lint, an MCP server, recipe install and Web Component export, OpenCode and Antigravity support, a skill
eval suite, and a gallery that loads about a sixth of what it did. Additive: nothing in 4.0.0 changes behaviour except
where listed under Changed.

### Added
- **OpenCode and Google Antigravity support.** `./install.sh --host opencode|antigravity` (also auto-detected, and part
  of `--host all`) links the skills into `~/.config/opencode/skills` and `~/.gemini/config/skills`. Skills are
  rendered with `${CLAUDE_PLUGIN_ROOT}` replaced by the installed payload path, so tool commands resolve on hosts that
  do not substitute it (also applied to Claude Code / Codex skills mode). `--host` accepts a comma list.
- **Skill eval suite** (`plugins/maquettekit/evals/`, run with `claude plugin eval`): 29 cases — routing for every skill
  plus boundary and negative cases, judgement calls, single-file builds checked against the rules the skills teach,
  multi-file project cases (fixture projects copied in by a scaffold script), and the plugin's own tooling. `npm run eval` compares with and without the plugin; `npm run eval:triggers` scores
  routing. `tests/plugin/evals.test.mjs` keeps the suite well-formed.
- `maquettekit design generate --out -` and `design init --out -` print to stdout, and `design validate -` reads stdin, so
  the engine works where the shell cannot write files (sandboxes, CI). A failed write now says so and suggests `--out -`.

- **Visual Director `interaction-reachability` check.** Elements with pointer or click handlers — native listeners,
  inline handlers, React props, Solid delegated handlers — or their own `:hover` styles are scrolled to mid-viewport
  and hit-tested; it reports those covered by another element, such as a stretched card link's `::after`, naming the
  cover. On the gallery build from before the WebGL-preview fix it reports the covered card previews (15, its
  per-page cap) and nothing else; on the fixed gallery (6 pages, 2 viewports, about 700 elements tested) it reports
  nothing.
- **Routing for smaller models.** A Claude Code `UserPromptSubmit` hook names the skill to load when a prompt is UI
  work (once per skill per session, never blocks, off with `MAQUETTEKIT_ROUTING_HINTS=0`), and
  `./install.sh --routing-rules` adds an equivalent marked block to the global rules file of Codex, OpenCode,
  Antigravity (and Claude Code in skills mode); uninstall removes exactly that block. With the hook, a skill loads in
  20/20 judgement, build and project runs on the default model and 18/20 on Haiku (was 12/14 and 5/14), and every
  quality case scores 1.00 with the plugin on both models.

- **`maquettekit design lint`** — values in a project's styles that are not from its design system (off-palette
  colours as major; spacing, font sizes, radii and durations off their scales as minor), each with the nearest token.
  Reads tokens from `maquettekit.design.json` and the project's own `:root`/theme variables and SCSS/LESS variables;
  scans CSS, markup, JSX style objects, styled templates and Tailwind arbitrary values.
- **`maquettekit check`** — design-file validation, token lint, browser review and Experience Lab in one run, merged
  into one ranked fix list (`.maquettekit/check/check.md`); steps that cannot run are reported as unavailable. The
  specialty skills' verify steps start with it.
- **`maquettekit catalog install`** — copies recipes or demos with everything they import into `src/maquettekit/`,
  keeping the library layout; lists missing npm packages with tested versions; never overwrites changed files.
- **`maquettekit catalog export --format web-component`** — `<mk-<id>>` custom elements (recipe + React, attributes =
  params) for Vue, Svelte, Astro and plain HTML projects.
- **MCP server** (`maquettekit mcp`) — 14 typed tools (catalogue, design, lint, check, review match, launch, assets,
  doctor) over stdio; registered by the Claude Code plugin, documented for Codex, OpenCode and Antigravity.
- **`maquettekit:design-critic`** agent (Claude Code) — read-only screenshot critique against the rubric without the
  builder's context; and an opt-in `Stop` hook review gate (`MAQUETTEKIT_REVIEW_GATE`).
- **Two skills (14 in total):** `studio-launch` with `maquettekit launch` (metadata, titles or descriptions shared between routes, share image, icons, robots and
  sitemap, real 404, page weight — over HTTP, production build) and `studio-match` with `maquettekit review match`
  (pixel similarity to a reference image, the regions that differ most, missing colours, run history).
- Quick cards at the top of the 31 reference files over 1,500 words, so small-context models can stop at the essentials.
- Gallery: per-page canonical URLs and link-preview text, favicon, apple icon, a generated share image, `robots.txt` and
  a sitemap (found with the new launch check).
- Library entry points `@maquettekit/library/meta` (catalogue metadata without components — the one to use in React
  Server Components), `effect-loaders` and `demo-loaders` (lazy component imports by id, without metadata), generated
  with the registry. `docs/LIBRARY-CONTRACT.md` says which to import where; the contract test enforces it for the
  gallery and a browser test holds first-load JavaScript under 600 KB on nine routes, one of each kind of page.

### Changed
- Visual Director's overlap heuristic ignores controls inside `inert` subtrees, deliberate overlays (a control wholly
  inside a larger interactive surface, in a positioned layer — a toolbar on a 3D canvas, a play button on a video;
  whether something covers a control is still hit-tested by `interaction-reachability`), and measures what scrolling
  and overflow containers leave on screen. Found by running `maquettekit check` on the gallery; regression fixtures
  for each case.
- `design lint` judges Next.js metadata image routes (`opengraph-image`, `twitter-image`, `icon`, `apple-icon` written
  as code) on palette colours only, and suggests the token's value: they render to PNG, where CSS variables do not
  resolve and the page's scales do not apply.
- Eval LLM graders check one criterion each and read the file the agent wrote rather than the transcript; multi-part
  judges over long transcripts caused the failures that appeared with and without the plugin.
- The Product, Data and Motion skill descriptions now say to load the skill before planning or advising and for
  single-file work. The eval suite showed no skill loaded on planning questions or "create `x.html`" requests;
  routing went from 39/45 to 45/45 and skill loads on build/judgement cases from 0/14 to 12/14 (default model).

### Fixed
- **Gallery page weight: every page shipped every recipe and demo.** Server pages imported the registry for metadata;
  on the server each of its `import()` calls to a `'use client'` recipe became a client reference, so the first load
  of every page carried all 69 recipes and demos with three.js, GSAP and D3 — 2.7–2.9 MB of JavaScript on every route
  that read the registry (1.7 MB on /3d, which imported three.js directly). Server pages now read
  `@maquettekit/library/meta`, recipe stages load one recipe from the loader maps, the 3D gallery is a server
  component whose viewer loads after hydration, and the demo frame no longer pulls in the site header for its
  wordmark. First-load JavaScript is now 467–503 KB per route (140–151 KB gzip), about 450 KB of it the framework;
  whole first views are 544–759 KB, against 1.8–3.6 MB before. (All figures uncompressed unless marked, measured with
  `maquettekit launch` on the production build, without the nomodule polyfills below.)
- Gallery accessibility, found with `maquettekit check`: the code viewer's syntax colours (and any status or accent
  colour inside an always-dark stage) used light-theme values on the dark panel, 3.1:1 — the ink stage now carries
  the dark theme's status and accent colours and specialty accents apply inside it; the sideways-scrolling table on
  `/system` is a named, focusable region (keyboard users could not scroll it); recipe and demo stages set `aria-busy`
  until their content is on screen. The 3D gallery's stage gradient and labels use palette tokens.
- `maquettekit launch` counted `nomodule` scripts as page weight. Browsers with ES-module support (all current ones)
  neither download nor run them; on Next.js that inflated every route by its 110 KB polyfill bundle.
- The gallery home page said 12 agent skills; there are 14 (now a constant a packaging test keeps in step).
- `review run` no longer leaks its static server when Chromium cannot launch.
- Long source-path headings in the gallery wrap instead of widening the page at 390 px.
- WebGL previews in the effect catalogue never started: the card's full-size link covered the preview, so its hover
  handler never fired. Hover and keyboard focus are now tracked on the card; on touch screens a WebGL preview runs
  while its card is mostly on screen and stops when it scrolls away.

## [4.0.0] — 2026-11-23

First public release of the v4 architecture. No earlier Maquettekit version existed in the workspace, so v4.0.0 was built
from scratch; there is no migration path from older releases.

### Added
- **Five specialties** as independent skills — Product, Cinematic, Data, Social and the new **3D Studio** — sharing one
  set of infrastructure and able to invoke each other (Product → 3D for configurators, Cinematic → 3D for immersive
  storytelling, Data → 3D for spatial data, Social → Motion for interactions, all → Visual Director).
- **12 skills** for Claude Code and Codex: studio-product, studio-cinematic, studio-data, studio-social, studio-3d,
  studio-motion, studio-review, studio-experience, studio-design-system, studio-components, studio-setup,
  studio-asset-optimizer.
- **Motion Lab**: motion tokens (durations, easings, role-named springs, stagger, distances, experience-profile
  scaling, spring → CSS `linear()`), a dependency-free orchestration engine (`createSequence` with labels, positions,
  stagger, seek, reverse and progress; `flip`; `viewTransition`), React hooks, a motion-preference provider, and
  **47 effect recipes across all 16 categories** (CSS/WAAPI, Motion, GSAP + ScrollTrigger, D3, SVG, canvas, CSS 3D,
  three.js/R3F/GLSL), each with metadata, parameters, a reduced-motion path and cleanup.
- **22 demos**: 3D Studio 5, Product 4, Cinematic 4, Data 4, Social 5.
- **Component & Effect Library** with a generated catalogue (`catalog.json`, `CATALOG.md`) and the `maquettekit catalog`
  search command.
- **three-kit**: capability detection (WebGL/WebGPU), quality profiles and adaptive DPR, disposal helpers,
  `StudioCanvas` (fallbacks, render-on-demand, lazy mount, diagnostics hook), a framework-free scene helper, and
  model/camera/orbit/part/lighting/animation/hotspot components.
- **3D Asset Pipeline** (`maquettekit assets`): inspect, validate (Khronos), optimise (dedup, prune, weld, simplify,
  reorder, quantise, textures, meshopt/Draco), variants per device profile, manifests, thumbnails, Blender import;
  source-preserving with verification.
- **Visual Director** (`maquettekit review`): Playwright capture across viewports and motion modes, deterministic checks,
  axe-core, keyboard/focus checks, 3D diagnostics including a no-WebGL fallback run, comparisons, improve loop status
  and summaries.
- **Experience Lab** (`maquettekit experience`): heuristic interaction-quality scoring across 14 dimensions with
  Essential/Expressive/Immersive profiles and accessibility gates.
- **Design Intelligence Engine** (`maquettekit design`): deterministic brief → `maquettekit.design.json` generator with 14 art
  directions, OKLCH colour with enforced contrast, motion and 3D direction, schema validation and CSS/Tailwind/TS/DTCG
  exports (including the library alias layer).
- **Gallery** (Next.js): searchable, filterable recipe catalogue with live previews, parameters, device widths,
  reduced-motion and theme toggles, code viewer with copy; specialty pages; full-page demos; a dedicated 3D gallery.
- **Packaging**: Claude Code plugin + marketplace, Codex plugin + marketplace, local installer/uninstaller with
  backups, upgrade and downgrade protection, `maquettekit doctor` and `maquettekit setup`.
- **Release verification by dogfooding**: Visual Director and Experience Lab were run against the gallery; findings
  fixed a latent screen-reader-table layout defect in two recipes and hardened the checker (inert/aria-hidden and
  visually-hidden exclusions, animation settle, scroll-through reveal, radio-group tab stops) with regression tests.
- **Tests and CI**: plugin structure/manifest/marketplace validation, installer lifecycle (including a real Claude Code
  install), tool unit tests, gallery e2e tests (every recipe and demo), 3D tests, accessibility checks, visual
  regression.
