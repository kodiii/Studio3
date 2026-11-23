# Studio³ Design Intelligence Engine

`studio3 design` — a deterministic, context-aware design-system generator. A brief (product, audience, brand,
constraints) becomes one persisted decision file, `studio3.design.json`, with transparent art-direction
selection, an OKLCH palette with guaranteed WCAG contrast, type, spacing, shape, elevation, layout, component,
interaction, motion, optional 3D, performance, library and accessibility guidance — plus token exports.
Zero runtime dependencies (works from an installed plugin without `node_modules`); no network, no telemetry.

## Commands

```
studio3 design init [--out brief.json] [--force]
studio3 design generate [--brief <brief.json>] [--out studio3.design.json] [--css <file>] [--tailwind <file>]
                        [--ts <file>] [--dtcg <file>] [--seed <n>] [--direction <id>] [--force | --merge] [--json]
studio3 design validate <studio3.design.json> [--json]
studio3 design explain  <studio3.design.json> [--section direction|color|type|layout|components|motion|3d|performance|libraries|accessibility|specialty] [--out <file.md>]
studio3 design tokens   <studio3.design.json> --format css|tailwind|ts|json-dtcg [--out <file>] [--color-format hex|oklch]
studio3 design directions [--json]
```

- `init` writes an annotated brief template (keys starting with `_` are comments and are ignored).
- `generate` needs `--brief` or brief flags. Brief flags override file values:
  `--category --audience --name --personality a,b --colors #hex,#hex --fonts "A,B" --goals a,b --devices desktop,mobile
  --aesthetic --complexity low|medium|high --a11y AA|AAA --a11y-needs a,b --budget tight|balanced|generous --low-end
  --framework --styling --libs a,b --motion essential|expressive|immersive --3d [--3d-purpose] --specialty product|cinematic|data|social|3d`.
  It refuses to overwrite an existing file unless `--force` (regenerate, discard overrides, keep history) or
  `--merge` (regenerate, keep overrides). `--css/--tailwind/--ts/--dtcg` write exports in the same run.
  `--json` prints `{ written, direction, score, runnerUp, briefHash, valid, errors, assumptions }`.
- `validate` exits `0` valid / `1` invalid; `explain` prints Markdown rationale (stdout unless `--out`); `tokens`
  prints to stdout unless `--out`; `directions` lists the 14 built-in art directions.
- Exit codes follow the Studio³ convention: `0` success, `1` invalid result, `2` usage error.

## The brief

Schema: `shared/schemas/brief.schema.json`; template: `design init`.

| Field | Values | Default when missing (recorded in `meta.assumptions`) |
|---|---|---|
| `productCategory` | free text; recognised families: saas, fintech, ecommerce, portfolio, agency, editorial, devtool, healthcare, education, gaming, dashboard, social, entertainment, luxury, government, ai, hardware, food | `saas` |
| `audience` | free text | `general audience` |
| `brand.name / personality[] / existingColors[] / existingFonts[]` | hex colours; first chromatic colour = brand hue, second = accent; first font = display, second = text | `Untitled`, none |
| `businessGoals[]`, `preferredAesthetic` | free text (aesthetic may name a direction id) | none — noted as an assumption |
| `targetDevices[]` | e.g. desktop, mobile, tablet | `desktop, mobile` |
| `interactionComplexity` | low · medium · high | `medium` |
| `accessibility.level / needs[]` | AA · AAA; needs such as low-vision, vestibular, keyboard-only, screen-reader, dyslexia | `AA` |
| `performance.budget / lowEndDevices` | tight · balanced · generous; boolean | `balanced`, `false` |
| `stack.framework / styling / libs[]` | e.g. next, vue, svelte, vanilla; tailwind, css; existing libraries | `unspecified`, `css` |
| `motionIntensity` | essential · expressive · immersive (the Studio³ experience profile) | `expressive` |
| `requires3d`, `threeD.purpose` | boolean; e.g. "interactive product configurator" | `false`; `ambient hero object` |
| `specialty` | product · cinematic · data · social · 3d | inferred from the category |

Every default is written to `meta.assumptions`, so nothing is assumed silently. Invalid enum values and non-hex
colours are rejected with an error naming the field.

## Output: `studio3.design.json`

Schema: `shared/schemas/studio3.design.schema.json` (`meta.schemaVersion` 1.0.0).

| Section | Contents |
|---|---|
| `meta` | generator, version, `seed`, `seedSource` (brief-hash / explicit), `briefHash`, `generatedAt` (unseeded only), `selection` (method, weights, chosen + runner-up with breakdown, full ranking), `assumptions`, `overridesApplied` (+ `overridesIgnored`) |
| `brief` | the normalised brief |
| `visualDirection` | id, name, thesis, principles, avoid (direction + global anti-patterns), compositional devices |
| `typography` | display/text/mono families (Fontsource package, licence, fallback-metric advice), modular fluid scale `xs…5xl` with `clamp()` per step, weights, tracking, leading, rules |
| `color` | brand hue/chroma derivation, neutral/brand/accent ramps 50–950, `light`/`dark` roles, semantic success/warn/danger/info sets, optional `dataViz`, per-mode `contrast` report, `contrastPolicy`, `adjustments` |
| `spacing`, `radius`, `elevation` | 4 px scale and density (control heights, gaps), radius scale + roles, five elevation levels per mode (layers + CSS) |
| `layout`, `components`, `interaction` | breakpoints, grid, containers, goal-driven principles; button/input/card/navigation styles, required states, target sizes (24 px minimum, 44 px on touch); latency targets |
| `motion` | profile, durations, easings, springs, stagger, choreography, three-tier reduced-motion policy, presets filtered by profile, device scaling, safety rules |
| `threeD` | only when `requires3d`: technology choice with every option's verdict, packages, lighting, materials, camera, quality tiers, fallback strategy, starting budgets |
| `performance`, `libraries`, `accessibility`, `specialtyNotes` | starting budgets (labelled as such), recommended / avoided libraries with reasons, requirements + checklist, specialty notes |
| `overrides`, `history` | user overrides (see below) and the generate/regenerate log |

## Direction selection

Every built-in direction is scored and the highest wins (unless `--direction` forces one):

`score = Σ weight × component + jitter`, weights `category 0.22, aesthetic 0.26, personality 0.12, audience 0.08,
specialty 0.10, motion 0.08, complexity 0.06, constraints 0.08`.

- `category`: the direction's 0–1 fit for the canonical category (0.4 when unlisted, 0.5 for every direction when
  the category is unrecognised).
- `aesthetic`, `personality`: share of brief tokens (stop-words removed, light stemming) found in the
  direction's keywords (0.5 when the brief gives none). Naming a direction id/name in `preferredAesthetic` sets
  aesthetic to 1 for it and 0 for the rest.
- `audience`: `0.5 + 0.5 × overlap` when any audience word matches, else 0.5.
- `specialty`, `motion`, `complexity`: the direction's fit table for the brief's value (0.5 when unlisted).
- `constraints`: starts at 1 and is multiplied by 0.6 (AAA vs a low-contrast-tint direction), 0.6 (motion
  sensitivity vs energetic motion), 0.4 (low-end devices vs a heavy direction), 0.6 (tight budget vs heavy),
  0.8 (mobile-only vs compact density); each penalty is written to `notes`.
- `jitter`: a seeded tie-break in ±0.005. The full breakdown (value, weight, contribution) of the winner and the
  runner-up, and the ranking of all directions, are stored in `meta.selection`.

## Colour

- In-house maths (`color.mjs`): sRGB ⇄ linear ⇄ OKLab ⇄ OKLCH (Björn Ottosson's matrices); gamut mapping into
  sRGB by chroma reduction only (24-step binary search, lightness and hue preserved); WCAG 2.x relative luminance
  and contrast; ΔE in OKLab; colour-vision-deficiency simulation (Machado, Oliveira & Fernandes 2009, severity 1,
  an approximation for palette checks).
- Colours are authored in OKLCH; `hex` is authoritative and `oklch` is re-derived from it, so both always describe
  the same colour. Brand hue/chroma come from the first chromatic brand colour (chroma > 0.03), otherwise from the
  direction's hue range with the seed. Neutrals are tinted toward the brand hue.
- Required pairs per mode: text and muted text, focus ring and strong borders on every surface; primary/accent
  text on surfaces; on-colours on solid fills; semantic text on its tints; data-viz colours on bg/surface.
  Targets: text 4.5:1 (7:1 at AAA), UI 3:1. A failing foreground (or solid fill) has its lightness stepped by
  0.004 until it passes; every change is recorded in `color.adjustments` with before/after.
- Data specialty: 8 categorical colours ordered so adjacent series keep ΔE_OK ≥ 0.08 in normal vision and under
  simulated protanopia/deuteranopia, each ≥ 3:1 against bg and surface.

## Determinism and seeds

- The PRNG is mulberry32 seeded by FNV-1a; each consumer draws from an independent named stream, so adding a
  consumer never shifts the others.
- `--seed <n>`: byte-reproducible output (no timestamp). Without a seed the brief hash (sha256 of the
  key-sorted normalised brief, 16 hex chars) seeds the generator — still deterministic — and `generatedAt` is
  recorded. Key order in the brief does not matter.

## Overrides, merge and history

- A top-level `overrides` object mirrors any section (e.g. `{"color":{"light":{"roles":{"primary":{"hex":"#0b5fff"}}}}}`).
  It is deep-merged over the generated values (objects merge, arrays and scalars replace) by every export,
  `explain` and `validate`. Colour tokens are re-synchronised (oklch from hex), both contrast reports are
  recomputed and shadow CSS is re-derived from layers, so a non-compliant override shows up in `validate` rather
  than being hidden. Overrides of `meta`, `brief`, `history`, `overrides` and `$schema` are ignored and listed in
  `meta.overridesIgnored`; applied leaf paths are listed in `meta.overridesApplied`.
- `generate --merge` regenerates from the brief, keeps `overrides` and appends a `regenerate-merge` history entry
  (with the previous brief hash and direction). `--force` regenerates without overrides and appends
  `regenerate-force`. History is always kept.

## Validation

Schema validation with an in-house subset validator (type, required, properties, additionalProperties, items,
enum, const, min/max, length, pattern, local `$ref`), then semantic checks on the document with overrides applied:
contrast recomputed from the colour values (never trusted from the stored report), data-viz distinguishability,
hex/oklch agreement, strictly increasing type/spacing/duration scales and darkening ramps, control heights and
minimum target ≥ 24 px, cubic-bezier x values in 0–1, reduced-motion replacements ≤ 200 ms, every `{token.path}`
reference resolvable, and cross-section consistency (3D section vs brief, motion profile vs brief, data palette
for the data specialty, no React Three Fiber on non-React stacks). Warnings flag stored contrast values edited
outside `overrides` and ignored overrides.

## Exports

All exports read the document with overrides applied.

| Format | Output |
|---|---|
| `css` | `--s3-*` custom properties on `:root` for the default mode; the other mode under `prefers-color-scheme` and `[data-theme]`; reduced motion caps durations at the replacement limit and zeroes stagger/motion scale; `pointer: coarse` raises the target size. `--color-format oklch` emits oklch values |
| `tailwind` | a Tailwind CSS v4 CSS-first theme (`@import "tailwindcss"`, `@theme` with colours, fonts, text steps, weights, spacing, radii, shadows, breakpoints, containers, easings, durations; `@custom-variant` for the alternate mode; base focus and reduced-motion rules) |
| `ts` | `export const tokens = { … } as const` with `Tokens`, `ColorRole`, `Duration`, `Easing` types |
| `json-dtcg` | W3C Design Tokens Community Group format (object-valued colours in oklch with hex, dimensions, durations, cubic-bezier, shadows, font families) with Studio³ extensions |

## Limitations

- Direction selection is keyword and table based, not language understanding: unusual wording may match nothing
  (the neutral 0.5 components then decide). Read `meta.selection` and force `--direction` when it is wrong.
- Contrast guarantees are WCAG 2.x ratios on solid colours; text over images, gradients or video, and APCA, are
  out of scope. CVD simulation is an approximation.
- Fonts come from a curated catalogue of OFL families distributed through Fontsource; verify package names at
  install time. Brand-supplied fonts are kept but their web licence is not checked.
- Budgets, latency targets and 3D quality tiers are starting points derived from the brief, labelled as such —
  not universal thresholds. The file describes decisions; it does not verify an implementation (use
  `studio3 review` and `studio3 experience`).
- The schema validator implements only the keywords the Studio³ schemas use.
