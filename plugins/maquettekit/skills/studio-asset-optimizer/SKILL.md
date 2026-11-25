---
name: studio-asset-optimizer
description: 3D Asset Pipeline — inspect, validate and optimise glTF/GLB models for the web without ever modifying the source. Reports hierarchy, triangles, textures, GPU-memory and draw-call estimates; runs the Khronos validator; dedups, welds, optionally simplifies, quantises, re-encodes textures (WebP, or KTX2 when the ktx CLI exists) and compresses meshes (meshopt or Draco); verifies materials, animations, named parts and bounds survived; writes desktop/mobile/low-power variants, a manifest, thumbnails and reports. Use for any .glb/.gltf/.fbx/.obj/.blend asset before it ships, when a 3D page loads slowly, or when asked to compress, check or prepare models. Not for scene code (studio-3d).
argument-hint: "[path to model] [target devices]"
license: MIT
metadata:
  short-description: Inspect, validate and optimise glTF/GLB assets, source-preserving
  module: asset-pipeline
---

# 3D Asset Optimizer

Ship the smallest file that still looks right, and prove nothing important was lost. Sources are read-only; every
output is reproducible from them.

## Use when

- A model is about to be added to a project, or a 3D page loads slowly or exceeds its budgets.
- `studio-3d`, `studio-product`, `studio-cinematic` or `studio-social` needs a delivery-ready asset.
- The user asks to compress, validate, convert, or "make this model web-ready".

Don't use it to edit geometry creatively (that is DCC work), or for scene/rendering code (`studio-3d`).

## Tooling

Maquettekit tools run through one dispatcher: `node "${CLAUDE_PLUGIN_ROOT}/tools/maquettekit.mjs" <command>`. On hosts that
do not substitute that variable (Codex), the same file is `../../tools/maquettekit.mjs` relative to this SKILL.md. Below,
`maquettekit <command>` is shorthand for that invocation. The pipeline needs `@gltf-transform/*`, `meshoptimizer`,
`sharp` and `gltf-validator` (and Playwright for thumbnails): exit code 3 means a dependency is missing — hand over to
`studio-setup` (`maquettekit setup --only assets`). Run `maquettekit assets --help` for every flag.

## Workflow

1. **Locate and protect the source.** Keep sources in a sources folder (for example `assets/models/*.source.glb`) and
   deliveries elsewhere (for example `public/models/`). Never point `--out` at the source folder. Ask before
   overwriting any existing delivery file; the tool refuses unless `--force`, and backs the old file up first.
2. **Inspect.** `maquettekit assets inspect model.glb` — note triangles, draw-call estimate, texture count/sizes, estimated
   GPU texture memory, animations, skins/morphs, required extensions, bounds and scale. Explain anything surprising
   (e.g. 8k textures on a 20 cm object, 40 materials on one product).
3. **Validate.** `maquettekit assets validate model.glb` — fix or report Khronos errors before optimising; warnings are
   judged case by case (`references/budgets-and-quality.md`).
4. **Choose targets.** Read budgets from `maquettekit.design.json → threeD` (quality profiles, budgets) or agree them with
   the user; the built-in `desktop`, `mobile` and `low-power` profiles are defaults, not limits. Simplification is
   opt-in and never applied to skinned or morph-target meshes unless explicitly allowed.
5. **Produce variants.** `maquettekit assets variants model.glb --out public/models --thumbnail` (or `optimize` for a
   single profile). Use `--budgets` for project-specific profiles. Read each variant's report: steps run/skipped,
   before/after sizes, per-texture changes, budgets met/over, and the verification block.
6. **Look at it.** Open the thumbnails, then view the desktop and lowest variant in the target scene. Check silhouettes,
   normal-map detail, texture banding, and named parts. Thumbnails are software-rendered previews, not colour references.
7. **Manifest.** `maquettekit assets manifest public/models` → the runtime picks a variant by quality profile and registers
   only the decoders listed in `decoders` (`references/runtime.md`).
8. **Hand over** to `studio-3d` with the manifest path, part names, clip names, decoder requirements and fallback
   image; record the source SHA-256 and the report paths in your summary.

## Non-negotiables

- Source files are never modified, moved or overwritten; reports record their SHA-256 and re-check it.
- Materials, animations, node names/hierarchy/extras, UVs, vertex colours, morphs and skins must survive — a failed
  verification is a failed run, never "close enough".
- Budgets are reported, not forced: do not degrade an asset past what looks right to hit a number; propose LOD,
  splitting or a different presentation instead.
- No asset is uploaded to an external service (including converters and viewers) without the user's permission.
- KTX2 and Blender import depend on external CLIs; when they are missing, say so — the reports mark the step skipped.

## Reference files

Long references open with a quick card: read it first, and the rest only when the task needs the detail.

| File | Load when |
| - | - |
| `references/budgets-and-quality.md` | Choosing profiles/budgets, compression and texture formats; reading validation warnings |
| `references/runtime.md` | Loading the outputs in three.js / R3F; decoders; manifest-driven variant selection; fallbacks |
| `references/conversion.md` | FBX/OBJ/DAE/USDZ/Blend inputs; DCC export settings; naming parts for interaction |
| `${CLAUDE_PLUGIN_ROOT}/tools/asset-pipeline/README.md` | Full flag list, step table, profile/budget file format, manifest schema, licences, limitations |

## Expected deliverables

Optimised variants, `<name>.manifest.json` (and an index `manifest.json`), `<name>.variants.report.{json,md}`,
thumbnail and fallback image, and a summary table: source vs each variant (bytes, triangles, texture sizes,
estimated GPU texture memory, compression, required decoders, budgets met/over, verification status).

## Validation

- Every variant's report shows verification `passed` for validator, animations, materials, named-nodes, attributes,
  bounds, triangles and source-untouched.
- `maquettekit assets validate <variant>` reports no errors.
- The variants load in the target scene with the decoders from the manifest, and `maquettekit review run` shows no
  `3d-assets` failures.
