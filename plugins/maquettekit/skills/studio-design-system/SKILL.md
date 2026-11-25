---
name: studio-design-system
description: Design Intelligence Engine — turns a product brief (category, audience, brand, goals, devices, aesthetic, accessibility, performance, stack, motion intensity, 3D needs) into a persisted, validated design system, maquettekit.design.json, with an art direction, type system, OKLCH colour with guaranteed WCAG contrast, spacing, layout, component and interaction rules, motion choreography, 3D art direction and library choices, then exports CSS, Tailwind v4, TypeScript or W3C DTCG tokens. Use when starting a new project or redesign, when asked for a design system, tokens, palette, type scale or "visual direction", or before any specialty builds UI without a maquettekit.design.json. Not for single components (studio-components).
argument-hint: "[product and audience, or path to brief.json]"
license: MIT
metadata:
  short-description: Generate and maintain maquettekit.design.json and its tokens
  module: design-intelligence
---

# Design Intelligence Engine

Decisions before pixels. Every Maquettekit specialty reads `maquettekit.design.json`; this skill creates it, keeps it
consistent across sessions, and exports it into the project. The engine is deterministic: the same brief and seed
always produce the same file, and every choice records why it was made.

## Use when

- A project has no `maquettekit.design.json` and someone is about to build UI, motion or 3D.
- The user asks for a design system, tokens, palette, typography, art direction or a rebrand.
- A specialty needs a section that is missing or stale (for example `threeD` after 3D was added to the scope).

Don't use it for one-off component styling, or to override a brand the user has already fixed — record the brand's
own values in the brief (`existingColors`, `existingFonts`) or in `overrides` instead.

## Tooling

Maquettekit tools run through one dispatcher: `node "${CLAUDE_PLUGIN_ROOT}/tools/maquettekit.mjs" <command>`. On hosts that
do not substitute that variable (Codex), the same file is `../../tools/maquettekit.mjs` relative to this SKILL.md. Below,
`maquettekit <command>` is shorthand for that invocation. Details: `${CLAUDE_PLUGIN_ROOT}/shared/tooling.md`. The
`design` command has no dependencies. Run `maquettekit design --help` for every flag.

## Workflow

1. **Look for an existing system.** If `maquettekit.design.json` exists: `maquettekit design validate maquettekit.design.json`
   and `maquettekit design explain maquettekit.design.json`. Reuse it; regenerate only with `--merge` (keeps `overrides`,
   appends `history`). Also read the project's existing CSS variables, Tailwind theme and fonts.
2. **Build the brief.** `maquettekit design init --out brief.json`, then fill it from the conversation and the codebase
   (`references/brief.md`: what to ask, what to infer, defaults). Ask at most three questions, only for things you
   cannot infer and that change the outcome (usually audience, brand constraints, motion intensity).
3. **Preview the choice.** `maquettekit design directions` lists the art directions. The engine scores every direction
   against the brief and records the breakdown and runner-up in `meta.selection`. Present the winner and the
   runner-up with one line each; force one with `--direction <id>` only when the user picks it.
4. **Generate.** `maquettekit design generate --brief brief.json --out maquettekit.design.json --css src/styles/tokens.css`
   (add `--tailwind`, `--ts` or `--dtcg` to suit the stack; `--seed <n>` for byte-reproducible output). Read every
   `! Assumption:` line it prints and either accept it or fix the brief. If shell commands cannot write files here
   (read-only sandbox), use `--out -` and save stdout with your own file-writing tool; `validate -` reads stdin.
5. **Validate and explain.** `maquettekit design validate maquettekit.design.json` must report valid (contrast pairs, scale
   monotonicity, token references). `maquettekit design explain … --section color` (or any section) produces rationale
   you can paste into a design brief for the user.
6. **Apply** following `references/applying.md`: import the token file once, install the font packages it names,
   map existing variables, wire dark mode. The CSS export includes the library alias layer (`--mk-bg`, `--mk-ink`,
   `--mk-signal`, …) so Maquettekit recipes pick up the system with no further mapping. Then run
   `maquettekit design lint --dir .`: it lists every colour, spacing, type size, radius and duration in the code that
   is not from the system, with the token to use instead. Fix majors (off-palette colours) before handing over.
7. **Persist decisions.** Commit `maquettekit.design.json`. Any deliberate deviation goes into its `overrides` object —
   never hand-edit generated sections or the exported token files. Re-export after every change.
8. **Hand over** to the specialty skill (`studio-product`, `studio-cinematic`, `studio-data`, `studio-social`,
   `studio-3d`) with the chosen direction, profile and any open questions.

## Non-negotiables

- Text/background role pairs meet the requested level (AA by default; AAA when asked) — the engine adjusts lightness
  until they pass and records each adjustment. Never override a role colour without re-running `validate`.
- Respect the brand: existing colours set the hue, existing fonts are used before suggestions.
- Respect the stack: no React-only libraries for non-React projects; no new animation library when one is present.
- Performance budgets and 3D quality profiles in the file are project starting points, not universal limits.
- Avoid formulaic aesthetics (default purple-blue gradients, glass everywhere, everything centred); the direction's
  `avoid` list is part of the system and is enforced in review.

## Reference files

| File | Load when |
| - | - |
| `references/brief.md` | Building or reviewing `brief.json`; mapping user language to fields; defaults |
| `references/output.md` | Reading `maquettekit.design.json`; which skill consumes which section; overrides, merge, history |
| `references/applying.md` | Exporting tokens; wiring CSS/Tailwind/TS/DTCG, fonts, dark mode, existing tokens, the library aliases |
| `references/directions.md` | Choosing or explaining an art direction; the 14 built-in directions |
| `${CLAUDE_PLUGIN_ROOT}/tools/design-intelligence/README.md` | Engine internals: scoring, colour maths, schema, determinism |
| `${CLAUDE_PLUGIN_ROOT}/shared/design-principles.md` | Judging the result; the anti-pattern list |

## Expected deliverables

`brief.json`, `maquettekit.design.json` (valid), at least one token export wired into the project, and a short summary:
direction and why (with runner-up), type pairing and licences, colour strategy and contrast result, motion profile,
3D direction if any, assumptions made.

## Validation

- `maquettekit design validate maquettekit.design.json` exits 0.
- `maquettekit design lint --dir . --fail-on major` exits 0 (no off-palette colours left), and the remaining minor
  findings are either fixed or listed in the report.
- The exported token file is imported by the app and the page renders with it (check with `studio-review`).
- `meta.selection` and every printed assumption were reported to the user.
