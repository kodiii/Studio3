# Changelog

All notable changes to Studio³ are documented here. The format follows Keep a Changelog and the project uses
semantic versioning. Plugin manifests (Claude Code and Codex) always carry the same version.

## [4.0.0] — 2026-11-23

First public release of the v4 architecture. No earlier Studio³ version existed in the workspace, so v4.0.0 was built
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
- **Component & Effect Library** with a generated catalogue (`catalog.json`, `CATALOG.md`) and the `studio3 catalog`
  search command.
- **three-kit**: capability detection (WebGL/WebGPU), quality profiles and adaptive DPR, disposal helpers,
  `StudioCanvas` (fallbacks, render-on-demand, lazy mount, diagnostics hook), a framework-free scene helper, and
  model/camera/orbit/part/lighting/animation/hotspot components.
- **3D Asset Pipeline** (`studio3 assets`): inspect, validate (Khronos), optimise (dedup, prune, weld, simplify,
  reorder, quantise, textures, meshopt/Draco), variants per device profile, manifests, thumbnails, Blender import;
  source-preserving with verification.
- **Visual Director** (`studio3 review`): Playwright capture across viewports and motion modes, deterministic checks,
  axe-core, keyboard/focus checks, 3D diagnostics including a no-WebGL fallback run, comparisons, improve loop status
  and summaries.
- **Experience Lab** (`studio3 experience`): heuristic interaction-quality scoring across 14 dimensions with
  Essential/Expressive/Immersive profiles and accessibility gates.
- **Design Intelligence Engine** (`studio3 design`): deterministic brief → `studio3.design.json` generator with 14 art
  directions, OKLCH colour with enforced contrast, motion and 3D direction, schema validation and CSS/Tailwind/TS/DTCG
  exports (including the library alias layer).
- **Gallery** (Next.js): searchable, filterable recipe catalogue with live previews, parameters, device widths,
  reduced-motion and theme toggles, code viewer with copy; specialty pages; full-page demos; a dedicated 3D gallery.
- **Packaging**: Claude Code plugin + marketplace, Codex plugin + marketplace, local installer/uninstaller with
  backups, upgrade and downgrade protection, `studio3 doctor` and `studio3 setup`.
- **Release verification by dogfooding**: Visual Director and Experience Lab were run against the gallery; findings
  fixed a latent screen-reader-table layout defect in two recipes and hardened the checker (inert/aria-hidden and
  visually-hidden exclusions, animation settle, scroll-through reveal, radio-group tab stops) with regression tests.
- **Tests and CI**: plugin structure/manifest/marketplace validation, installer lifecycle (including a real Claude Code
  install), tool unit tests, gallery e2e tests (every recipe and demo), 3D tests, accessibility checks, visual
  regression.
