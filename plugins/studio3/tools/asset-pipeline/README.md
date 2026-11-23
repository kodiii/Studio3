# Studio³ 3D Asset Pipeline

`node plugins/studio3/tools/studio3.mjs assets <subcommand>` — inspect, validate, optimise and package
glTF/GLB assets for the web. Runs locally: nothing is uploaded, nothing is downloaded, no telemetry.

## Principles

- **Source-preserving.** Inputs are opened read-only. Outputs go to a separate directory. A target equal
  to the source is always refused; an output directory containing the source, or an existing target, is
  refused unless `--force`, and then the old file is first copied to `<out>/.backup/<timestamp>/`.
  The source SHA-256 is recorded in every report/manifest and re-checked after the run. To revert,
  delete the outputs and re-run from the source.
- **Nothing structural is lost silently.** Materials, animations, node names/hierarchy/extras/transforms,
  UVs, vertex colours, morph targets and skins are kept and verified after writing.
- **No universal budgets.** The built-in profiles are *defaults* — starting points you are expected to
  tune per product and device — never presented as limits.
- **Honest reporting.** A step that did not run is `skipped` with a reason. Fields ending in `Estimate`
  are estimates.

## Commands

| Command | Purpose | Exit codes |
| --- | --- | --- |
| `inspect <file.glb\|.gltf> [--json]` | Hierarchy, meshes, materials, textures, animations, skins, extensions, bounds, file size, GPU-texture and draw-call estimates | 0 |
| `validate <file> [--json] [--strict]` | Khronos glTF-Validator + Studio³ checks | 1 on errors (or warnings with `--strict`) |
| `optimize <file> --out <dir> […]` | Optimise one file, verify, write `<name>.glb` + `<name>.report.{json,md}` | 1 if verification fails (output kept) |
| `variants <file> --out <dir> […]` | One `<name>.<profile>.glb` per profile + `<name>.manifest.json` + `<name>.variants.report.{json,md}` | 1 if any variant fails verification |
| `manifest <dir> [--out manifest.json] [--source <dir>] [--force] [--json]` | Scan `<id>.<profile>.glb` files into one manifest | 0 |
| `thumbnail <file> --out <png> [--size 512] [--background '#rrggbb'\|transparent] [--require] [--force] [--json]` | Render a preview with headless Chromium + three.js | 0 ok/skipped, 3 skipped with `--require`, 1 failed |
| `import <file.fbx\|.obj\|.dae\|.blend\|.usdz> --out <file.glb> [--blender <path>] [--dry-run] [--force] [--json]` | Convert through Blender's CLI | 3 when Blender is unavailable |

Usage errors exit 2; a missing npm dependency exits 3 with the install command.

### optimize / variants flags

```
--profile desktop|mobile|low-power|<file.json>   (optimize; default desktop)
--profiles desktop,mobile,low-power              (variants; default all three)
--budgets <file.json>                            (variants; override/add profiles)
--compress meshopt|draco|none     --meshopt-level medium|high     --no-quantize
--texture-format webp|keep|ktx2   --texture-max <px>              --texture-quality <1-100>
--simplify <ratio 0-1>            --simplify-error <fraction of mesh radius>
--allow-skinned-simplify          --join            --prune-attributes
--bounds-tolerance <fraction of diagonal>
--name <base>   --force   --json
--thumbnail [--thumbnail-size 512] [--background …]   (variants: also write <name>.png and <name>.webp)
```

Flags override the profile. `--simplify` is the fraction of triangles to **keep**.

## Pipeline steps (`optimize`)

| Step | What it does | Skipped when |
| --- | --- | --- |
| `dedup` | Merges identical accessors, meshes, textures, materials; uniquely named properties are kept | — |
| `prune` | Removes unreferenced data; keeps leaf/named nodes, extras, vertex attributes, solid textures | — (`--prune-attributes` also drops unused UV/colour sets) |
| `join` | Joins compatible primitives, never across named nodes/meshes | unless `--join` |
| `weld` | Merges bitwise-identical vertices, builds index buffers | — |
| `simplify` | meshoptimizer simplifier via glTF-Transform, borders locked | unless the profile/flag asks; skinned and morph-target meshes are excluded unless `--allow-skinned-simplify` |
| `reorder` | meshoptimizer vertex/index reordering | Draco selected; meshoptimizer missing |
| `quantize` | `KHR_mesh_quantization` (defaults 14/10/12/8 bits position/normal/uv/colour) | Draco selected; `--no-quantize` |
| `textures` | sharp via glTF-Transform `compressTexture`: resize to the slot's `maxSize`, re-encode | no textures; nothing requested; sharp missing |
| `compress` | `EXT_meshopt_compression` or `KHR_draco_mesh_compression` | `--compress none`; codec missing |
| `write` | Writes the GLB through the output guard | — |

Quantization changes the transform of the node that owns a mesh. To keep part nodes intact, the mesh of
every named or extras-carrying node is first moved to an **unnamed child node**; the named node keeps its
exact transform. Consumers should select a part by name and traverse it for meshes.

Texture rules: a texture is never upscaled; it is resized only when larger than its `maxSize`; colour
space is detected from the slot (base colour/emissive = sRGB, everything else linear) and reported;
normal maps default to a higher quality and are only shrunk to their own `maxSize`; when a texture feeds
several slots the most conservative rule wins; if re-encoding at the same size is not smaller, the
original bytes are kept. Every texture's before/after is listed in the report.

### Verification (after re-reading the written file)

`validator` (no new Khronos errors) · `animations` (count, names, durations, channels, targets) ·
`materials` (names in use) · `named-nodes` (names, parents, extras, world transforms) · `attributes`
(vertex attributes, skins, morph targets) · `bounds` (default tolerance 0.2 % of the diagonal, 2 % when
simplified) · `triangles` (equal without simplify, ≤ source with) · `source-untouched` (SHA-256).
A failure exits 1 and deletes nothing.

## Profiles and budgets

Built-in **defaults** (starting points, override freely):

| Profile | Compression | Textures | Simplify |
| --- | --- | --- | --- |
| `desktop` | meshopt (medium) | WebP ≤ 2048 px, q82 | none |
| `mobile` | meshopt (medium) | WebP ≤ 1024 px, q80 | keep 75 %, error 0.001 |
| `low-power` | meshopt (medium) | WebP ≤ 512 px, q78 | keep 50 %, error 0.002 |

Default slot rules: `normalTexture` q92, `metallicRoughnessTexture`/`occlusionTexture` q85.

Profile file (`--profile my.json`), optionally `"extends": "<built-in>"`:

```json
{
  "extends": "mobile",
  "compress": "meshopt",
  "meshoptLevel": "medium",
  "quantize": { "position": 14, "normal": 10, "texcoord": 12, "color": 8 },
  "simplify": { "ratio": 0.6, "error": 0.002 },
  "textures": {
    "format": "webp", "maxSize": 1024, "quality": 80,
    "slots": { "normalTexture": { "maxSize": 2048, "quality": 95, "lossless": false } }
  },
  "budgets": { "maxBytes": 1500000, "maxTriangles": 150000, "maxTextureSize": 1024 }
}
```

Budgets file (`variants --budgets b.json`): `{ "profiles": { "<name>": { …profile… } } }`. Entries named
like a built-in are merged over it; other names define new profiles usable in `--profiles`.
`budgets` (`maxBytes`, `maxTriangles`, `maxVertices`, `maxTextureSize`, `maxGpuTextureBytesEstimate`,
`maxDrawCallsEstimate`) are **reported** as met/over in the report; the asset is never degraded to meet them.

## Manifest

```jsonc
{ "schemaVersion": 1, "generator": "…", "generatedAt": "…",
  "assets": [{
    "id": "pulse-speaker",
    "source": { "file": "…", "sha256": "…", "bytes": 0 },
    "variants": [{ "profile": "desktop", "file": "…", "bytes": 0, "sha256": "…", "triangles": 0, "vertices": 0,
                   "drawCallsEstimate": 0, "textures": [{ "w": 0, "h": 0, "mime": "image/webp", "bytes": 0, "slots": [] }],
                   "gpuTextureBytesEstimate": 0, "extensionsUsed": [], "extensionsRequired": [],
                   "compression": "meshopt", "decoders": ["MeshoptDecoder"] }],
    "thumbnail": "…png", "fallbackImage": "…webp",
    "animations": ["KnobTurn"], "animationClips": [{ "name": "…", "duration": 0, "targets": [] }],
    "parts": ["…named node names…"], "materials": ["…"],
    "bounds": { "min": [], "max": [], "size": [], "center": [] } }] }
```

Paths are relative to the manifest. `triangles` counts every instance; `thumbnail`/`fallbackImage` are
present only when the images exist.

## Decoder requirements for three.js consumers

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);                                   // EXT_meshopt_compression
loader.setDRACOLoader(new DRACOLoader().setDecoderPath('/draco/gltf/'));    // KHR_draco_mesh_compression
loader.setKTX2Loader(new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer)); // KHR_texture_basisu
```

Register only what the manifest's `decoders` lists. Draco needs the WASM files from
`three/examples/jsm/libs/draco/gltf/`, KTX2 those from `three/examples/jsm/libs/basis/`, served from your
own origin. `KHR_mesh_quantization` and `EXT_texture_webp` need no decoder. Without the decoder for a
*required* extension the file does not load — keep a static `fallbackImage` for that case.

## Dependencies and licences

| Dependency | Used for | Licence |
| --- | --- | --- |
| @gltf-transform/core, /extensions, /functions | I/O and transforms | MIT |
| meshoptimizer | reorder, simplify, `EXT_meshopt_compression` | MIT |
| draco3dgltf | `KHR_draco_mesh_compression` | Apache-2.0 |
| sharp (libvips) | texture resize/encode | Apache-2.0 (libvips LGPL-3.0, dynamically linked prebuilt) |
| gltf-validator | Khronos validation | Apache-2.0 |
| three.js | thumbnail viewer page | MIT |
| Playwright / Chromium | thumbnail rendering | Apache-2.0 / BSD-style |
| KTX-Software `ktx` CLI (not bundled) | KTX2 / Basis Universal encoding | Apache-2.0 |
| Blender (not bundled) | `import` | GPL — invoked as a separate program, never linked or redistributed |

All npm dependencies are loaded lazily through `tools/lib/resolve.mjs`; if one is missing the command
prints how to install it (`studio3 setup`) or records the affected step as skipped.

## Limitations

- **KTX2 is untested here.** `--texture-format ktx2` shells out to `ktx create` (argv array, no shell).
  @gltf-transform/functions 4.5.1 has no ktx/toktx transform. Without `ktx` on PATH the texture step
  falls back to WebP and records `skipped: ktx2 unavailable`. The `ktx` argument set was written from
  documentation and has not been executed.
- **`import` is untested against a real Blender.** Only detection, argument construction and the
  unavailable path are unit-tested; `blender/convert.py` targets Blender 3.6–4.x and has not been run.
- Thumbnails use software WebGL (SwiftShader) in headless Chromium: fine for previews, not colour-exact
  references; animations are shown at their rest pose.
- UVs outside [0, 1] (tiling) are left as floats by quantization.
- Draco does not compress animation data and cannot encode non-triangle or morph-target primitives.
- Simplification is per primitive with locked borders; it does not generate LOD chains or re-bake normals.
- `validate`'s scale check (default 0.001–1000 m) and the GPU-memory/draw-call figures are heuristics.
- External `.gltf` resources must be local relative files; remote URIs are flagged, never fetched.
