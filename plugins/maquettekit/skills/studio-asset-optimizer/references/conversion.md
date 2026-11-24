# Conversion and authoring for the web

## Formats

glTF 2.0 binary (`.glb`) is the delivery format. Convert other formats once, at authoring time, and keep the result as
the new source:

```bash
maquettekit assets import chair.fbx --out assets/models/chair.source.glb      # needs Blender on PATH (or --blender <path>)
maquettekit assets import chair.fbx --out assets/models/chair.source.glb --dry-run   # show the Blender command only
```

Blender is invoked as a separate program; it is never bundled. Without it the command exits 3 and explains how to
proceed. Imports are untested in CI without Blender — inspect and validate the result every time.

| Input | Notes |
| - | - |
| FBX | check unit scale (centimetres are common), embedded textures, animation take names |
| OBJ | no hierarchy or animation; materials via `.mtl`; expect to rebuild parts |
| DAE (Collada) | legacy; verify axis and units |
| USDZ | conversion support depends on the Blender version |
| `.blend` | export settings matter more than the importer; prefer exporting glTF from Blender directly |

## DCC export checklist (Blender, Maya, Cinema 4D, …)

- Units in metres, +Y up (glTF convention), object sitting on y = 0 when it is a product.
- Apply transforms; no negative scales.
- One material per distinct surface, named meaningfully (`ShellMatte`, not `Material.004`).
- Name every part the experience needs to address (selection, exploded views, annotations, configurator swaps) and
  keep them as separate nodes; add per-part metadata as custom properties (they export as `extras`).
- Bake what never changes (ambient occlusion, complex shading) into textures; keep textures at power-of-two sizes when
  KTX2 is planned.
- Animation clips named by intent (`KnobTurn`, not `Action.001`); remove unused actions.
- Export tangents if normal maps are used.

## After conversion

`inspect` → `validate` → `variants`, as in the skill workflow. Keep the converted `.source.glb` under version control
(or in your asset store) and treat it as read-only from then on.
