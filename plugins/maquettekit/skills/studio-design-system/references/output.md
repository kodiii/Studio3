# Reading maquettekit.design.json

Top-level sections and who consumes them:

| Section | Contents | Consumed by |
| - | - | - |
| `meta` | schema version, generator, brief hash, `selection` (method, weights, per-direction scores, runner-up) | you, when explaining the choice |
| `brief` | the normalised brief | every skill |
| `visualDirection` | id, name, thesis, principles, `avoid` list, compositional devices | all specialties; Visual Director's subjective assessment |
| `typography` | families (display, text, mono, longform) with source + licence, fluid `clamp()` scale, weights, tracking, leading, rules | all UI work |
| `color` | strategy, ramps, light/dark roles, semantic colours, data-viz palette (data specialty), contrast report, adjustments | all UI work; `studio-data` uses `dataViz` |
| `spacing`, `radius`, `elevation`, `layout` | scales, roles, grid per breakpoint, container widths, principles | layout work |
| `components` | language, rules per component family, required states, minimum target sizes | `studio-product`, `studio-social`, `studio-components` |
| `interaction` | principles, feedback latency targets | all; `studio-experience` |
| `motion` | profile, temperament, durations, easings, springs, stagger, choreography, reduced-motion policy, presets, intensity scaling, safety | `studio-motion`, every specialty |
| `threeD` | purpose, art direction, lighting, materials, camera, technology recommendation, quality profiles, assets, loading, fallback, budget | `studio-3d`, `studio-asset-optimizer`, `studio-review` budgets |
| `performance` | budgets labelled as project starting points | `studio-review`, `studio-3d` |
| `libraries` | recommended and avoided libraries with reasons, respecting the stack | every build step |
| `accessibility` | requirements and checklist for the requested level and needs | every build step, `studio-review` |
| `specialtyNotes` | guidance for the inferred specialty | the specialty skill |
| `overrides` | your deliberate deviations (deep-merged over generated values) | the exporters, `validate` |
| `history` | regeneration log (brief hash + date) | consistency across sessions |

## Overrides

Never edit generated sections. Put deviations in `overrides`, mirroring the path you change:

```json
{ "overrides": { "color": { "light": { "roles": { "primary": { "hex": "#0b5fff" } } } } } }
```

Overrides are deep-merged into every export and re-validated; `generate --merge` keeps them when the brief changes.
After editing overrides run `maquettekit design validate` and re-export the tokens.

## Consistency across sessions

At the start of any session that touches UI, read `maquettekit.design.json` before writing styles. Use its tokens by
name; if you need a value it does not have, add it to `overrides` (and say why) instead of hard-coding it. When the
brief changes materially (new audience, rebrand, 3D added), regenerate with `--merge` and summarise the diff.
