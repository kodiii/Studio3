# Budgets and quality

## Budgets are a project decision

Derive them from the target devices and the scene, then verify on those devices:

| Input | Effect on budgets |
| - | - |
| Lowest target device class (from `studio3.design.json → threeD.qualityProfiles`) | sets the `low-power` variant |
| What else the scene renders (environment, other products, particles) | the model gets a share, not the whole budget |
| Network (first view vs cached, mobile data) | download bytes for the first meaningful frame |
| How close the camera gets | texture resolution needed; simplification tolerance |

Write them in a budgets file and pass it to `variants --budgets`. Budgets are reported as met/over — the pipeline
does not degrade assets to meet them.

## Geometry

- **Weld + reorder + quantise** is almost always free quality-wise and should run for every delivery.
- **meshopt** (`EXT_meshopt_compression`) decodes quickly, compresses quantised data well, and also compresses
  animation and morph data. Default choice.
- **Draco** often produces smaller geometry for dense static meshes, but decodes more slowly, needs WASM files served
  from your origin, cannot compress animation data and does not support every primitive type. Use it when download
  size dominates and geometry is static.
- **Simplify** only with a target (`--simplify` = fraction of triangles to keep). Borders are locked; check the
  silhouette and shading at the closest camera distance the experience allows. Never simplify a mesh whose detail is
  the product (logos, text, mechanical edges) without looking at it.

## Textures

| Format | Download | GPU memory | Notes |
| - | - | - | - |
| PNG/JPEG (`keep`) | large | uncompressed in GPU | use only when nothing else is possible |
| WebP | small | uncompressed in GPU (RGBA, plus mips) | default; quality per slot (normal maps higher) |
| KTX2 / Basis Universal | small-medium | stays compressed in GPU | best for memory-constrained devices and many textures; needs the `ktx` CLI to encode and `KTX2Loader` to decode |

Rules of thumb: resize to the largest size the camera can show (do not ship 4k textures for a thumbnail-size
object); keep normal maps at higher quality than colour maps; never upscale. GPU memory figures in the reports are
estimates (width × height × 4 × 1.33 with mipmaps).

## Reading validator output

| Message family | Action |
| - | - |
| Errors (invalid accessors, missing buffers, broken references) | fix at the source or re-export from the DCC tool; do not ship |
| Missing normals/tangents with normal maps | re-export with tangents, or let three.js compute (cost at load) — decide and note |
| Non-power-of-two textures | informational in WebGL2; matters for mipmapped KTX2 encodes on older paths |
| Unused data | removed by `prune` |
| Absurd scale (e.g. centimetres exported as metres) | fix at the source; never "fix" in the scene with a magic scale |
| Required extensions needing decoders | make sure the runtime registers them (`runtime.md`) |
