---
name: studio-components
description: Find, read, adapt and install recipes from the Maquettekit Component & Effect Library — 40+ reusable, tested UI effects, 3D components and full reference demos shipped as source inside the plugin. Use when the user wants an existing effect or component ("add a magnetic button", "I need a scroll-pinned section", "a model viewer", "show me what Maquettekit has for charts"), wants to browse or search the catalogue, or when another studio skill needs a building block. Not for designing a page from scratch (use a specialty skill) or authoring brand-new choreography (use studio-motion).
argument-hint: "[what you need, e.g. 'card hover effect without dependencies']"
license: MIT
metadata:
  short-description: Search and adapt recipes from the Component & Effect Library
  module: component-effect-library
---

# Maquettekit Components

The library is real source, not snippets: each recipe is a folder with a typed component, metadata, a
reduced-motion path and cleanup. Your job is to pick the lightest recipe that fits and adapt it to the project
without breaking those guarantees.

## Use when

- A requested interaction, effect or 3D building block probably exists already.
- The user wants to see options ("what do you have for…").

Don't use when the request is a whole page or flow (specialty skills compose recipes for that), or when no recipe
fits after a search — hand over to `studio-motion` (2D) or `studio-3d` (3D) to author one to the same contract.

## Tooling

The CLI is `node "${CLAUDE_PLUGIN_ROOT}/tools/maquettekit.mjs"`; where the variable is not substituted it is
`../../tools/maquettekit.mjs` relative to this `SKILL.md` (local installs: `~/.maquettekit/marketplace/plugins/maquettekit/tools/maquettekit.mjs`).
Below, `maquettekit` means that command and `<plugin>` means its parent directory. The catalogue commands have no
dependencies.

## Workflow

1. **Inspect the target project**: framework (React? version?), styling approach, existing animation and 3D
   libraries, TypeScript settings, and whether `maquettekit.design.json` exists (its tokens override recipe defaults).
2. **Search**. Start broad, then narrow by facet:
   - `maquettekit catalog search "pricing toggle"`
   - `maquettekit catalog search button --no-deps --max-complexity 2`
   - `maquettekit catalog search scroll --tech gsap` · `--category charts` · `--specialty social` · `--intensity subtle`
   - `maquettekit catalog list --kind demos` for full reference compositions.
3. **Choose** using `references/selection.md`: prefer zero-dependency recipes; do not add a second animation
   library to a project that already has one; honour the experience profile and the user's motion intensity.
   Present two or three candidates with their trade-offs when the choice is not obvious.
4. **Read before copying**: `maquettekit catalog show <id> --source` prints metadata and every file. Read
   `meta.ts` in full — `accessibility`, `reducedMotion` and `performance` are requirements, not commentary.
5. **Adapt** following `references/adapting.md`:
   copy `library/src/effects/<id>/` and the shared `library/src/motion/` (plus `library/src/three/` for 3D
   recipes) into the project once; fix import paths; map the `--mk-*` custom properties to the project's tokens;
   install exactly the packages in `meta.dependencies`; turn the `params` you need into props and delete the rest.
   For non-React projects port the logic, keeping the same reduced-motion and cleanup behaviour.
6. **Verify**: typecheck/build, then run the page through `studio-review` (normal and reduced motion, three
   viewports). For 3D recipes confirm the fallback renders with WebGL disabled.
7. **Report** which recipe(s) were used, what was changed, dependencies added, and anything not verified.

## Non-negotiables

- Never strip the reduced-motion branch, focus handling, ARIA, or cleanup to "simplify" a recipe.
- Never add a dependency that is not in the recipe's `meta.dependencies`; never combine Motion and GSAP for one
  element.
- Keep the licence situation intact: library code is MIT; GSAP is under GreenSock's standard no-charge licence.
- Demo content (copy, brands, data) is fictional sample material. Replace it; never present sample data as real.

## Reference files

| File | Load when |
| - | - |
| `references/selection.md` | Choosing between recipes; category map; technology and complexity guidance |
| `references/adapting.md` | Copying a recipe into a project: files, imports, tokens, params → props, non-React ports |
| `references/authoring.md` | No recipe fits and a new one must be written to the library contract (with `studio-motion` / `studio-3d`) |
| `<plugin>/library/CATALOG.md` | The generated index of every recipe and demo |
| `${CLAUDE_PLUGIN_ROOT}/shared/technology-selection.md` | Justifying a technology choice |

## Expected deliverables

Working, adapted component(s) in the project; a note listing recipe ids, files added, dependencies, token
mappings and verification results.

## Validation

- The project typechecks and builds.
- Reduced motion: the adapted component shows its documented reduced state (checked in the browser or via
  `maquettekit review run`).
- Keyboard: every pointer interaction of the recipe is reachable and operable.
- No listeners, timers, observers, animations or GPU resources survive unmount (remount it a few times in dev).
