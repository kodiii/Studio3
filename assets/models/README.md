# Maquettekit sample models — contract

Original, procedurally generated assets (no third-party content; MIT, same as the repo).
Regenerate deterministically with `node scripts/generate-sample-models.mjs` (seeded, no timestamps).
These `*.source.glb` files are **sources**: never edit or overwrite them. Delivery variants live in
`apps/gallery/public/models/` and are rebuilt from the sources:

```bash
node plugins/maquettekit/tools/maquettekit.mjs assets variants assets/models/pulse-speaker.source.glb --out apps/gallery/public/models --thumbnail
node plugins/maquettekit/tools/maquettekit.mjs assets variants assets/models/orbit-token.source.glb  --out apps/gallery/public/models --profiles desktop --thumbnail
node plugins/maquettekit/tools/maquettekit.mjs assets manifest apps/gallery/public/models
```

Units are metres, +Y up, +Z front, centred on x/z = 0 and sitting on y = 0.

## Delivery files (`apps/gallery/public/models/`, served at `/models/…`)

| File | Bytes | Triangles | Vertices | Textures |
| --- | ---: | ---: | ---: | --- |
| `assets/models/pulse-speaker.source.glb` (source) | 19,284,124 | 263,328 | 322,464 | 4 × 2048² PNG |
| `pulse-speaker.desktop.glb` | 2,002,280 | 263,328 | 133,937 | 4 × 2048² WebP |
| `pulse-speaker.mobile.glb` | 1,470,832 | 197,496 | 101,416 | 4 × 1024² WebP |
| `pulse-speaker.low-power.glb` | 1,013,712 | 131,664 | 68,723 | 4 × 512² WebP |
| `assets/models/orbit-token.source.glb` (source) | 381,880 | 5,280 | 15,840 | none |
| `orbit-token.desktop.glb` | 113,184 | 5,280 | 14,368 | none |

Also there: `manifest.json` (all assets), `<id>.manifest.json`, `<id>.variants.report.{json,md}`,
`<id>.png` (512 px transparent thumbnail) and `<id>.webp` (1024 px static fallback image).

**Loading requirements (all variants):** `EXT_meshopt_compression` (required) → call
`gltfLoader.setMeshoptDecoder(MeshoptDecoder)` (`three/addons/libs/meshopt_decoder.module.js`);
`KHR_mesh_quantization` and `EXT_texture_webp` need no decoder. No Draco, no KTX2.

## Important: parts are subtrees, not always meshes

In the **source** files a part node carries its mesh directly (three.js: `Mesh` named `Grille`).
In the **optimized variants** every part node keeps its name, parent, extras and transform, but its
geometry lives in an unnamed child node (three.js: `Object3D`/`Group` named `Grille` containing one
`Mesh` named `GrilleGeo`). This is deliberate: quantization bakes a de-quantization transform into the
mesh-owning node, and the pipeline keeps that off the named part nodes.

So always address a part by name and then traverse it:

```js
const part = gltf.scene.getObjectByName('Grille');
part.traverse((o) => { if (o.isMesh) o.material = highlight; });
// exploded view: move `part` (not the child mesh) along part.userData.explodeDirection
```

`Feet` is a group in both source and variants (children `FootFL`, `FootFR`, `FootRL`, `FootRR`).

## pulse-speaker — "Pulse", a fictional compact portable speaker

Bounds: min `[-0.1115, 0, -0.04]`, max `[0.1115, 0.1436, 0.0453]` (≈ 0.223 × 0.144 × 0.085 m).

### Hierarchy and part names

```
PulseSpeaker                 root (extras: label, description, units, up, front)
├─ Body                      rounded shell                    material ShellMatte
│  ├─ Grille                 perforated front plate           material GrilleMetal
│  ├─ Driver                 cone + dust cap + surround       material DriverRubber
│  ├─ DriverRing             trim ring around the driver      material AccentAnodized
│  ├─ Badge                  logo plate on the grille         material AccentAnodized
│  ├─ Knob                   knurled dial on top (animated)   material AccentAnodized
│  ├─ StatusLight            emissive ring around the dial (animated)  material LightEmissive
│  ├─ StrapPinL              left strap pin                   material AccentAnodized
│  └─ StrapPinR              right strap pin                  material AccentAnodized
├─ Strap                     woven carry handle               material StrapFabric
└─ Feet                      group of four rubber feet        material DriverRubber
   ├─ FootFL  FootFR  FootRL  FootRR      (no extras; one shared mesh `FootGeo` after optimisation)
```

Mesh names are `<Part>Geo` (`BodyGeo`, `GrilleGeo`, …, `FootGeo`).

### Extras on every part node (three.js: `object.userData`)

`Body, Grille, Driver, DriverRing, Badge, Knob, StatusLight, StrapPinL, StrapPinR, Strap, Feet` carry:

| Key | Type | Meaning |
| --- | --- | --- |
| `explodeDirection` | `[x, y, z]` unit vector, model space | direction to move the part in an exploded view |
| `explodeDistance` | number (metres) | distance at full explosion |
| `label` | string | short annotation title |
| `description` | string | one-line annotation text |

| Part | explodeDirection | explodeDistance | label |
| --- | --- | ---: | --- |
| Body | `[0, 0, -1]` | 0.03 | Shell |
| Grille | `[0, 0, 1]` | 0.06 | Grille |
| Driver | `[0, 0, 1]` | 0.035 | Driver |
| DriverRing | `[0, 0, 1]` | 0.085 | Trim ring |
| Badge | `[0.3247, -0.1855, 0.9274]` | 0.075 | Badge |
| Knob | `[0, 1, 0]` | 0.05 | Volume dial |
| StatusLight | `[0, 1, 0]` | 0.025 | Status light |
| StrapPinL | `[-1, 0, 0]` | 0.04 | Strap pin (left) |
| StrapPinR | `[1, 0, 0]` | 0.04 | Strap pin (right) |
| Strap | `[0, 1, 0]` | 0.07 | Carry strap |
| Feet | `[0, -1, 0]` | 0.03 | Feet |

Children of `Body` are parented to it, so moving `Body` moves them too; apply offsets in each part's
parent space or compute them from world positions.

### Materials (PBR metallic-roughness)

| Name | Base colour | Metallic / roughness | Textures |
| --- | --- | --- | --- |
| `ShellMatte` | `[0.062, 0.066, 0.075]` | from texture (non-metal, roughness 0.66–0.94) | metallicRoughness `ShellRoughness` |
| `GrilleMetal` | `[0.58, 0.59, 0.60]` | from texture | normal `GrilleNormal`; occlusion + metallicRoughness `GrilleORM` |
| `DriverRubber` | `[0.022, 0.022, 0.026]` | 0 / 0.62 | — |
| `AccentAnodized` | `[0.93, 0.36, 0.08]` | 1 / 0.34 | — |
| `StrapFabric` | white × texture | 0 / 0.94 | baseColor `StrapWeave` (sRGB, tiling) |
| `LightEmissive` | `[0.02, 0.03, 0.035]`, emissive `[0.25, 0.95, 1]` | 0 / 0.4 | — |

No tangents are stored; the normal map relies on runtime-derived tangents (validator warning
`MESH_PRIMITIVE_GENERATED_TANGENT_SPACE`, expected).

### Animation clips

| Clip | Target | Path | Duration | Motion |
| --- | --- | --- | ---: | --- |
| `KnobTurn` | `Knob` | rotation | 2.0 s | turns 120° about +Y and back (loopable) |
| `LightPulse` | `StatusLight` | scale | 1.6 s | uniform scale 1 → 1.12 → 1 (loopable) |

`LightPulse` animates scale, not emissive: `KHR_animation_pointer` is not supported by the installed
glTF-Transform. There is no "Explode" clip — compute exploded views from the extras above.

## orbit-token — small faceted token

Bounds: 0.063 × 0.063 × 0.0137 m, coin axis +Z, centre at y = 0.0315.

- Node: `Token` (extras: `label`, `description`, `units`, `up`, `front`); mesh `TokenGeo`, flat-shaded, no UVs.
- Material: `TokenMetal` (base `[0.86, 0.6, 0.22]`, metallic 1, roughness 0.28).
- Clip: `Spin` — `Token` rotation, one full turn about +Y in 4.0 s (loopable, linear).
