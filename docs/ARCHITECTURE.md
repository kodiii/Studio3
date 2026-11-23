# Architecture

Studio³ has four layers. Each is useful alone; together they let an agent design, build, verify and refine.

```
 ┌──────────────────────────── skills/ (instructions the agent follows) ─────────────────────────────┐
 │ studio-product  studio-cinematic  studio-data  studio-social  studio-3d        ← five specialties  │
 │ studio-motion  studio-review  studio-experience  studio-design-system  studio-components          │
 │ studio-asset-optimizer  studio-setup                                            ← shared modules   │
 └───────────────┬──────────────────────────────────┬─────────────────────────────────┬──────────────┘
                 │ runs                              │ copies / adapts                  │ reads
 ┌───────────────▼──────────────┐   ┌────────────────▼─────────────────┐   ┌──────────▼──────────────┐
 │ tools/  `studio3` CLI        │   │ library/  source                 │   │ shared/  docs + schemas │
 │ design   → studio3.design.json│   │ motion/  tokens, orchestration   │   │ workflow, tooling,      │
 │ review   → .studio3/review    │   │ three/   kit + components        │   │ principles, a11y, perf, │
 │ experience → .studio3/exp…    │   │ effects/ recipes (meta + code)   │   │ profiles, tech choice,  │
 │ assets   → GLB variants      │   │ demos/   full compositions       │   │ JSON schemas            │
 │ catalog / doctor / setup     │   │ catalog.json, CATALOG.md (gen.)  │   │                         │
 └───────────────┬──────────────┘   └────────────────┬─────────────────┘   └─────────────────────────┘
                 │ measures                           │ renders
 ┌───────────────▼────────────────────────────────────▼─────────────────────────────────────────────┐
 │ apps/gallery (Next.js) — runs the library's real source; target of the e2e suite                  │
 └───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## The central artefact: `studio3.design.json`

`studio3 design generate` turns a brief into one versioned file per project. Every specialty reads it first, so
decisions persist across sessions and agents: art direction (with the `avoid` list review enforces), type, colour roles
with a contrast report, spacing/layout, component rules, motion profile and choreography, 3D art direction and quality
profiles, performance budgets, library choices and accessibility requirements. Deviations go into its `overrides`
object; exports (CSS, Tailwind v4, TS, DTCG) include an alias layer so library recipes inherit the system.

## Skills (`plugins/studio3/skills/`)

Each skill is a short `SKILL.md` (frontmatter + workflow + validation) with detail in `references/` loaded on demand
(progressive disclosure). Specialties own *what good looks like* for their domain; shared skills own the cross-cutting
procedures. Skills never duplicate each other: they delegate by name. Tool paths are written as
`${CLAUDE_PLUGIN_ROOT}/tools/studio3.mjs` (substituted by Claude Code) with the `../../tools/studio3.mjs` fallback for
hosts that resolve paths relative to the skill (Codex).

## Tools (`plugins/studio3/tools/`)

One dispatcher (`studio3.mjs`) and one directory per command. Rules shared by all tools:

- Plain ESM JavaScript with `// @ts-check`; Node ≥ 20.11; no build step, so the plugin directory runs as installed.
- Heavy dependencies are **optional** and resolved lazily (`lib/resolve.mjs`): `$STUDIO3_DEPS` → the tools directory →
  the Studio³ deps dir (`$CLAUDE_PLUGIN_DATA/studio3-deps` or `~/.studio3/deps`) → the current project. A missing package
  produces exit code 3 and the exact command to install it; nothing downloads implicitly.
- Human progress on stderr, machine output (`--json`) on stdout, artefacts in `./.studio3/`.
- Every check has a status (`passed`, `failed`, `skipped`, `not-applicable`, `limited`, `unavailable`) and `ran`;
  "passed" is only possible when the check executed.

| Tool | Inputs | Outputs |
| - | - | - |
| `design` (Design Intelligence) | brief JSON or flags | `studio3.design.json`, token files, Markdown rationale |
| `review` (Visual Director) | URL or static dir, routes, states, budgets | `pass-<n>/` screenshots, frames, states, `report.json`, `report.md`; comparisons; loop status; `SUMMARY.md` |
| `experience` (Experience Lab) | URL or static dir, profile, rubric answers | `experience.json`, `experience.md` |
| `assets` (3D pipeline) | glTF/GLB (or DCC formats via Blender) | optimised variants, manifest, thumbnails, reports — sources untouched |
| `catalog` | query and facets | ranked recipes, sources |
| `doctor`, `setup` | — | diagnostics; optional dependency install |

## Library (`plugins/studio3/library/`)

- `src/motion/` — tokens (durations, easings, springs, stagger, distance, experience-profile scaling,
  `springToLinear`), `createSequence` (WAAPI timeline with labels, stagger, seek, reverse, cancel), `flip`,
  `viewTransition`, hooks (`useInView`, `useScrollProgress`, `useRafLoop`, `useElementSize`) and `useStudioMotion`
  (OS reduced-motion preference merged with an in-app override that can only add reduction).
- `src/three/` — capability detection (WebGL, and WebGPU only when an adapter is acquired), quality profiles and
  adaptive DPR, disposal helpers and `ResourceTracker`, `StudioCanvas` (fallback, lazy mount, render-on-demand,
  offscreen pause, context-loss handling, `window.__STUDIO3_3D__` diagnostics read by Visual Director),
  `createVanillaScene` for non-React projects, and components (manifest-driven model loading, stats, camera rig, orbit
  inspection, part control, lighting, animation player, hotspots, fallbacks).
- `src/effects/<id>/` and `src/demos/<specialty>/<id>/` — each with `meta.ts` (pure data) and `index.tsx`.
  `scripts/build-catalog.mjs` generates the typed registry, `catalog.json`, `CATALOG.md` and the gallery's source
  bundles. The binding rules are in `docs/LIBRARY-CONTRACT.md`.

## Gallery (`apps/gallery/`)

Next.js app router, Tailwind v4 mapped to the library's CSS variables, Fontsource fonts. It imports recipes and demos
through the generated registry (lazy chunks), so the gallery is also the integration test bed: the Playwright suite
iterates the catalogue and checks every recipe and demo for errors, accessibility, reduced motion, small screens,
remount cleanup and (for 3D) initialisation, loading, interaction, disposal and fallbacks.

## Packaging

`plugins/studio3/` is the installable payload. Claude Code reads `.claude-plugin/plugin.json` and the repository's
`.claude-plugin/marketplace.json`; Codex reads `.codex-plugin/plugin.json` and `.agents/plugins/marketplace.json`.
Both manifests carry the same version (`npm run validate` enforces it). `scripts/install.mjs` stages the payload in
`~/.studio3/marketplace`, drives each host's own CLI (`claude plugin install …`, `codex plugin add …`) or links the skills
into `~/.claude/skills` / `~/.agents/skills`, records what it did, backs up on upgrade and refuses downgrades.
`scripts/package-release.mjs` builds the plugin archive, source archives and checksums.

## Extending: adding a specialty

No rewrite is needed; specialties are data plus a skill.

1. Add the id to `Specialty` and `SPECIALTIES` in `library/src/types.ts` (name, philosophy, skill id).
2. Create `plugins/studio3/skills/studio-<name>/` with `SKILL.md` and `references/` (playbook, patterns, demos), and add
   it to `REQUIRED_SKILLS` in `scripts/validate-plugin.mjs` and `tools/doctor/index.mjs`.
3. Add `library/src/demos/<name>/<demo-id>/` folders; tag reusable recipes with the new specialty in their `meta.ts`.
4. Add an accent token (`--s3-accent-<name>`) and a `[data-specialty='<name>']` rule in the gallery's `globals.css`.
5. Optionally teach the Design Intelligence Engine the new specialty (category mapping and `specialtyNotes`).
6. `node scripts/build-catalog.mjs`, `npm run validate`, `npm test`, `npm run test:e2e` — the gallery, catalogue and
   e2e suite pick the new specialty and its demos up automatically.
