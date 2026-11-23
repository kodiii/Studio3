# Variant report — pulse-speaker

- Result: **all variants verified**
- Source: `../../../../assets/models/pulse-speaker.source.glb` — 18.39 MB — sha256 `67987c29573ad55165e4e459a99ad2f944dfe229c642e45fae37c78f3f50d6da` (unchanged by this run)
- Manifest: `pulse-speaker.manifest.json`
- Thumbnail: ok — `pulse-speaker.png`, fallback `pulse-speaker.webp`
- Profiles are default starting points unless overridden by a budgets/profile file; they are not universal budgets.
- Generated: 2026-11-23T11:43:59.470Z by Studio³ Asset Pipeline

| Variant | File | Size | vs source | Triangles | Vertices | Textures (largest) | GPU texture memory (estimate) | Compression | Verified |
| --- | --- | ---: | ---: | ---: | ---: | --- | ---: | --- | --- |
| source | `../../../../assets/models/pulse-speaker.source.glb` | 18.39 MB | — | 263,328 | 322,464 | 4 × ≤2048px (png) | 85.33 MB | as authored | — |
| desktop | `pulse-speaker.desktop.glb` | 1.91 MB | -89.62% | 263,328 | 133,937 | 4 × ≤2048px (webp) | 85.33 MB | meshopt | yes |
| mobile | `pulse-speaker.mobile.glb` | 1.40 MB | -92.37% | 197,496 | 101,416 | 4 × ≤1024px (webp) | 21.33 MB | meshopt | yes |
| low-power | `pulse-speaker.low-power.glb` | 990.0 KB | -94.74% | 131,664 | 68,723 | 4 × ≤512px (webp) | 5.33 MB | meshopt | yes |

## desktop

Profile origin: built-in default. Settings: `{"description":"Default starting point for desktop-class GPUs: no geometry simplification, textures ≤ 2048 px.","compress":"meshopt","meshoptLevel":"medium","simplify":null,"textures":{"format":"webp","maxSize":2048,"quality":82,"slots":{"normalTexture":{"quality":92},"metallicRoughnessTexture":{"quality":85},"occlusionTexture":{"quality":85}}}}`

Steps: dedup (ran) → prune (ran) → join (skipped: Not requested (--join). Joining is opt-in because it can merge parts that viewers address individually.) → weld (ran) → simplify (skipped: Not requested by the profile/flags; triangle count is preserved.) → reorder (ran) → quantize (ran) → textures (ran) → compress (ran) → write (ran)

- texture GrilleNormal [normalTexture, linear]: image/png 2048×2048 382.2 KB → image/webp 2048×2048 230.8 KB (re-encoded webp)
- texture GrilleORM [occlusionTexture, metallicRoughnessTexture, linear]: image/png 2048×2048 1.92 MB → image/webp 2048×2048 119.6 KB (re-encoded webp)
- texture ShellRoughness [metallicRoughnessTexture, linear]: image/png 2048×2048 797.5 KB → image/webp 2048×2048 47.1 KB (re-encoded webp)
- texture StrapWeave [baseColorTexture, srgb]: image/png 2048×2048 3.31 MB → image/webp 2048×2048 159.5 KB (re-encoded webp)

- ✔ validator — No new validator errors (source 0 error(s)/1 warning(s), output 0 error(s)/1 warning(s)).
- ✔ animations — 2 clip(s) preserved: KnobTurn (2s), LightPulse (1.6s).
- ✔ materials — 6 used material name(s) preserved (6 → 6 material objects; unused/duplicate materials may be pruned or merged).
- ✔ named-nodes — 16 named node(s) preserved with parents, extras and transforms.
- ✔ attributes — Vertex attributes (POSITION, NORMAL, TEXCOORD_0), 0 skin(s) and morph targets preserved.
- ✔ bounds — Bounding box drift 0.0018% of the diagonal (tolerance 0.20%).
- ✔ triangles — Rendered triangles unchanged (263328); no simplification ran.
- ✔ source-untouched — Source SHA-256 unchanged (67987c29573ad55165e4e459a99ad2f944dfe229c642e45fae37c78f3f50d6da).

Consumer requirements: `EXT_meshopt_compression` → MeshoptDecoder; `EXT_texture_webp`; `KHR_mesh_quantization`

## mobile

Profile origin: built-in default. Settings: `{"description":"Default starting point for phones/tablets: 75% of triangles (border-locked), textures ≤ 1024 px.","compress":"meshopt","meshoptLevel":"medium","simplify":{"ratio":0.75,"error":0.001},"textures":{"format":"webp","maxSize":1024,"quality":80,"slots":{"normalTexture":{"quality":92},"metallicRoughnessTexture":{"quality":85},"occlusionTexture":{"quality":85}}}}`

Steps: dedup (ran) → prune (ran) → join (skipped: Not requested (--join). Joining is opt-in because it can merge parts that viewers address individually.) → weld (ran) → simplify (ran) → reorder (ran) → quantize (ran) → textures (ran) → compress (ran) → write (ran)

- texture GrilleNormal [normalTexture, linear]: image/png 2048×2048 382.2 KB → image/webp 1024×1024 115.4 KB (resized + re-encoded webp)
- texture GrilleORM [occlusionTexture, metallicRoughnessTexture, linear]: image/png 2048×2048 1.92 MB → image/webp 1024×1024 51.6 KB (resized + re-encoded webp)
- texture ShellRoughness [metallicRoughnessTexture, linear]: image/png 2048×2048 797.5 KB → image/webp 1024×1024 19.0 KB (resized + re-encoded webp)
- texture StrapWeave [baseColorTexture, srgb]: image/png 2048×2048 3.31 MB → image/webp 1024×1024 25.0 KB (resized + re-encoded webp)

- ✔ validator — No new validator errors (source 0 error(s)/1 warning(s), output 0 error(s)/1 warning(s)).
- ✔ animations — 2 clip(s) preserved: KnobTurn (2s), LightPulse (1.6s).
- ✔ materials — 6 used material name(s) preserved (6 → 6 material objects; unused/duplicate materials may be pruned or merged).
- ✔ named-nodes — 16 named node(s) preserved with parents, extras and transforms.
- ✔ attributes — Vertex attributes (POSITION, NORMAL, TEXCOORD_0), 0 skin(s) and morph targets preserved.
- ✔ bounds — Bounding box drift 0.0022% of the diagonal (tolerance 2.00%, simplified).
- ✔ triangles — Rendered triangles 263328 → 197496 (simplification requested; must not increase).
- ✔ source-untouched — Source SHA-256 unchanged (67987c29573ad55165e4e459a99ad2f944dfe229c642e45fae37c78f3f50d6da).

Consumer requirements: `EXT_meshopt_compression` → MeshoptDecoder; `EXT_texture_webp`; `KHR_mesh_quantization`

## low-power

Profile origin: built-in default. Settings: `{"description":"Default starting point for low-power / data-saver devices: 50% of triangles (border-locked), textures ≤ 512 px.","compress":"meshopt","meshoptLevel":"medium","simplify":{"ratio":0.5,"error":0.002},"textures":{"format":"webp","maxSize":512,"quality":78,"slots":{"normalTexture":{"quality":92},"metallicRoughnessTexture":{"quality":85},"occlusionTexture":{"quality":85}}}}`

Steps: dedup (ran) → prune (ran) → join (skipped: Not requested (--join). Joining is opt-in because it can merge parts that viewers address individually.) → weld (ran) → simplify (ran) → reorder (ran) → quantize (ran) → textures (ran) → compress (ran) → write (ran)

- texture GrilleNormal [normalTexture, linear]: image/png 2048×2048 382.2 KB → image/webp 512×512 52.8 KB (resized + re-encoded webp)
- texture GrilleORM [occlusionTexture, metallicRoughnessTexture, linear]: image/png 2048×2048 1.92 MB → image/webp 512×512 30.8 KB (resized + re-encoded webp)
- texture ShellRoughness [metallicRoughnessTexture, linear]: image/png 2048×2048 797.5 KB → image/webp 512×512 7.8 KB (resized + re-encoded webp)
- texture StrapWeave [baseColorTexture, srgb]: image/png 2048×2048 3.31 MB → image/webp 512×512 6.0 KB (resized + re-encoded webp)

- ✔ validator — No new validator errors (source 0 error(s)/1 warning(s), output 0 error(s)/1 warning(s)).
- ✔ animations — 2 clip(s) preserved: KnobTurn (2s), LightPulse (1.6s).
- ✔ materials — 6 used material name(s) preserved (6 → 6 material objects; unused/duplicate materials may be pruned or merged).
- ✔ named-nodes — 16 named node(s) preserved with parents, extras and transforms.
- ✔ attributes — Vertex attributes (POSITION, NORMAL, TEXCOORD_0), 0 skin(s) and morph targets preserved.
- ✔ bounds — Bounding box drift 0.0022% of the diagonal (tolerance 2.00%, simplified).
- ✔ triangles — Rendered triangles 263328 → 131664 (simplification requested; must not increase).
- ✔ source-untouched — Source SHA-256 unchanged (67987c29573ad55165e4e459a99ad2f944dfe229c642e45fae37c78f3f50d6da).

Consumer requirements: `EXT_meshopt_compression` → MeshoptDecoder; `EXT_texture_webp`; `KHR_mesh_quantization`
