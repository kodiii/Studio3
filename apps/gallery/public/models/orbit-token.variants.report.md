# Variant report — orbit-token

- Result: **all variants verified**
- Source: `../../../../assets/models/orbit-token.source.glb` — 373.0 KB — sha256 `800c6c4c1e6421991f1e90a3490bb24118847d9cd35ca907b3d91c3d8f6f751a` (unchanged by this run)
- Manifest: `orbit-token.manifest.json`
- Thumbnail: ok — `orbit-token.png`, fallback `orbit-token.webp` — the 3D post's poster, rendered by `scripts/render-orbit-token-poster.mjs` with the live view's scene
- Profiles are default starting points unless overridden by a budgets/profile file; they are not universal budgets.
- Generated: 2026-11-27T07:54:01.223Z by Maquettekit Asset Pipeline

| Variant | File | Size | vs source | Triangles | Vertices | Textures (largest) | GPU texture memory (estimate) | Compression | Verified |
| --- | --- | ---: | ---: | ---: | ---: | --- | ---: | --- | --- |
| source | `../../../../assets/models/orbit-token.source.glb` | 373.0 KB | — | 5,280 | 15,840 | none | 0 B | as authored | — |
| desktop | `orbit-token.desktop.glb` | 62.7 KB | -83.18% | 5,280 | 6,150 | none | 0 B | meshopt | yes |

## desktop

Profile origin: built-in default. Settings: `{"description":"Default starting point for desktop-class GPUs: no geometry simplification, textures ≤ 2048 px.","compress":"meshopt","meshoptLevel":"medium","simplify":null,"textures":{"format":"webp","maxSize":2048,"quality":82,"slots":{"normalTexture":{"quality":92},"metallicRoughnessTexture":{"quality":85},"occlusionTexture":{"quality":85}}}}`

Steps: dedup (ran) → prune (ran) → join (skipped: Not requested (--join). Joining is opt-in because it can merge parts that viewers address individually.) → weld (ran) → simplify (skipped: Not requested by the profile/flags; triangle count is preserved.) → reorder (ran) → quantize (ran) → textures (skipped: The asset has no textures.) → compress (ran) → write (ran)


- ✔ validator — No new validator errors (source 0 error(s)/0 warning(s), output 0 error(s)/0 warning(s)).
- ✔ animations — 1 clip(s) preserved: Spin (4s).
- ✔ materials — 1 used material name(s) preserved (1 → 1 material objects; unused/duplicate materials may be pruned or merged).
- ✔ named-nodes — 1 named node(s) preserved with parents, extras and transforms.
- ✔ attributes — Vertex attributes (POSITION, NORMAL), 0 skin(s) and morph targets preserved.
- ✔ bounds — Bounding box drift 0.0022% of the diagonal (tolerance 0.20%).
- ✔ triangles — Rendered triangles unchanged (5280); no simplification ran.
- ✔ source-untouched — Source SHA-256 unchanged (800c6c4c1e6421991f1e90a3490bb24118847d9cd35ca907b3d91c3d8f6f751a).

Consumer requirements: `EXT_meshopt_compression` → MeshoptDecoder; `KHR_mesh_quantization`
