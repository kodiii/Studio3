# Applying the system

## Export

```bash
studio3 design tokens studio3.design.json --format css       --out src/styles/tokens.css
studio3 design tokens studio3.design.json --format tailwind  --out src/styles/theme.css      # Tailwind CSS v4 @theme
studio3 design tokens studio3.design.json --format ts        --out src/design/tokens.ts
studio3 design tokens studio3.design.json --format json-dtcg --out tokens.json               # W3C DTCG for design tools
```

`--color-format oklch` writes OKLCH values instead of hex (with hex kept as comments where useful). Generated files
say "do not edit by hand"; change `studio3.design.json` or its `overrides` and re-export.

## What the CSS file contains

- `:root` light (or dark, per `color.defaultMode`) roles, ramps, shadows, spacing, radii, fonts, durations, easings.
- `@media (prefers-color-scheme: …)` alternate mode for users who prefer it, and `:root[data-theme="…"]` to force a
  mode from an in-app toggle.
- A reduced-motion block that caps durations and zeroes stagger and the motion scale.
- A coarse-pointer block raising the minimum target size.
- The **library alias layer**: `--s3-bg`, `--s3-surface`, `--s3-surface-2`, `--s3-ink`, `--s3-ink-muted`,
  `--s3-line`, `--s3-line-strong`, `--s3-signal`, `--s3-on-signal`, `--s3-accent`, `--s3-focus`, `--s3-success`,
  `--s3-danger`, `--s3-font-serif`, `--s3-radius-s|m|l` — the names Studio³ recipes read. Motion variables are read by
  recipes with fallbacks, so recipes follow the system's durations and easings where names match.

## Wiring by stack

| Stack | Do |
| - | - |
| Next.js / Vite / Remix (React) | import the CSS once in the root layout/entry; for Tailwind v4 also `@import` the theme file after `tailwindcss` |
| Vue / Nuxt / Svelte / Astro | import the CSS in the global stylesheet or root layout; use `--format ts` only if you need values in JS |
| Plain HTML | `<link rel="stylesheet" href="tokens.css">` before other styles |
| Design tools | import the DTCG JSON into a token plugin that supports the format |

## Fonts

`typography.families.*.source` names the package (usually a Fontsource package) and `license` (OFL-1.1 for the
built-in pairings). Install exactly those, self-host them (no third-party font CDN without the user's agreement),
and keep the fallback stacks from the file — they are chosen to limit layout shift.

## Dark mode

Respect `prefers-color-scheme` by default and offer a toggle that sets `data-theme` on `<html>` (persist the choice;
set it before first paint to avoid a flash). Both modes are contrast-checked by `validate`.

## Existing tokens

When a project already has variables (`--background`, shadcn-style tokens, a Tailwind palette), either map them to the
generated roles in one place or move the project to the generated names in a dedicated change — never mix both
systems inside components.
