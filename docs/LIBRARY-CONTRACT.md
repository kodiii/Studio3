# Library contract — effects, demos, and the gallery

This is the contract every recipe and demo in `plugins/maquettekit/library` follows. The gallery, the catalog
generator, the tests and the skills all depend on it.

## Layout

```
plugins/maquettekit/library/src/
  types.ts                  EffectMeta, DemoMeta, ParamSpec, EffectProps …
  motion/                   Motion Lab engine: tokens, stepSpring, createSequence/flip/viewTransition, hooks, useStudioMotion
  three/                    three-kit: detectCapabilities, quality profiles, dispose helpers, StudioCanvas, createVanillaScene
  effects/<id>/             one folder per recipe
    meta.ts                 export const meta: EffectMeta   (pure data; ONLY `import type` — it is loaded by Node directly)
    index.tsx               'use client'; export default function X({ params }: EffectProps<Params>)
    *.module.css | *.ts     optional co-located files (styles, shaders, helpers)
  demos/<specialty>/<id>/   one folder per demo: meta.ts (DemoMeta) + index.tsx (default export, no props) + local files
  registry.generated.ts     generated — never edit: metadata + a lazy load() per item      (import via ./registry)
  meta.generated.ts         generated — the metadata alone                                 (import via ./meta)
  effect-loaders.generated.ts, demo-loaders.generated.ts
                            generated — the lazy imports alone, by id   (import via ./effect-loaders, ./demo-loaders)
```

Which entry point to import: **server code** (React Server Components — Next.js pages, layouts, `generateMetadata`,
sitemaps) reads `@maquettekit/library/meta`, never the registry: there every `import()` of a `'use client'` recipe
becomes a client reference, and the page ships all 69 recipes and demos in its first load. **Client code** that
mounts a recipe takes its metadata as props and loads the component from `effect-loaders` / `demo-loaders`;
`registry` (metadata + loaders together) is for client code that needs both and accepts the whole catalogue's
metadata in its bundle. `tests/unit/library/contract.test.ts` enforces this for the gallery.

After adding/renaming a recipe or demo run `node scripts/build-catalog.mjs` (also runs before `dev`/`build`). It skips
incomplete folders (no `meta.ts`/`index.tsx`, a meta that fails to load, an unresolved relative import, an unknown
recipe id) with a warning so work in progress elsewhere never blocks you; `--strict` and `--check` (CI, release) turn
those into errors.

## Effect rules

1. **Self-contained and portable.** A recipe folder must be copy-pasteable into another React project together with
   `motion/` (and `three/` for 3D recipes). No Tailwind classes in effects: use a co-located CSS module or inline styles.
   Import shared code only from `../../motion`, `../../three`, `../../types`.
2. **Theme through CSS variables with fallbacks**: `var(--mk-ink, #11110f)`, `--mk-bg`, `--mk-surface`, `--mk-surface-2`,
   `--mk-ink-muted`, `--mk-line`, `--mk-line-strong`, `--mk-signal`, `--mk-on-signal`, `--mk-accent`, `--mk-focus`,
   fonts `--mk-font-display|text|mono|serif`, radii `--mk-radius-s|m|l`. Both light and dark themes must work.
3. **Motion tokens, not magic numbers**: durations/easings/springs from `motion/tokens` (or the `--mk-duration-*` /
   `--mk-ease-*` custom properties in CSS).
4. **Reduced motion is mandatory** and read from `useStudioMotion().reduced` (it merges the OS preference with the app
   toggle). CSS-only motion must also sit behind `@media (prefers-reduced-motion: no-preference)` or be neutralised under
   `reduce`. Follow the three-tier policy: remove decorative motion; replace state-change motion with a ≤200 ms opacity
   fade; keep motion that is the content only behind an explicit user control.
5. **Cleanup is mandatory.** Every listener, observer, timer, rAF loop, WAAPI animation, GSAP context
   (`useGSAP({ scope })` or `gsap.context()` + `revert()`), ScrollTrigger, D3 transition and three.js resource created
   by the recipe is released on unmount. The gallery remounts recipes on "Replay" to exercise this.
6. **Responsive via container queries.** The preview stage sets `container-type: inline-size`; size with `cqi` units or
   `@container` rules so the gallery's device-width preview is honest. Never rely on viewport media queries for layout.
7. **Accessible by construction.** Semantic elements, visible `:focus-visible`, keyboard operation for every pointer
   interaction, names for controls, ≥24×24 px targets (44 px for primary touch targets), no information by colour or
   motion alone, decorative layers `aria-hidden`. Split/duplicated text keeps one accessible copy.
8. **Performance.** Animate `transform`/`opacity` (and paint-only properties sparingly); no layout thrash in loops; rAF
   loops go through `useRafLoop` (pauses offscreen/hidden) and springs stepped per frame through `stepSpring`; scroll
   work is passive + rAF-batched; canvas work respects `devicePixelRatio` caps.
9. **3D recipes** render inside `StudioCanvas` (fallback content required, `frameloop="demand"` unless something is
   actually animating, quality from `useQuality()`), never create a second renderer, and dispose anything created
   imperatively. WebGPU only behind `detectWebGPU()` with a WebGL path.
10. **Honesty.** No fabricated metrics in UI copy (no made-up FPS, "10x faster", fake customer logos). Sample data is
    labelled as sample data.
11. **Params** declared in `meta.params` are the only inputs of the default export; every param must visibly do
    something. The default export is a *reference implementation*: it renders sample content so the gallery can show
    it. When the recipe is a natural UI primitive (a ticker, a toggle, a list, a chart), also export a content-agnostic
    named component with typed data/callback props (`export function NumberTicker({ value, format })`) and make the
    default export a thin wrapper that feeds it sample content — demos and apps then import the named export instead of
    re-implementing the technique. The named component may live in a sibling file and be re-exported from `index.tsx`
    (`RiveCanvas` in `rive-state-machine`, `CursorFollower` in `cursor-follower`).
12. **Runtime files from your own origin.** A recipe that loads binaries or data at run time (a WASM runtime, a
    `.riv` or model file) takes their URLs as props with defaults under the app's public folder and never falls back
    to a CDN. The gallery serves committed assets from `apps/gallery/public/` and copies runtime binaries from
    `node_modules` before dev and build (`scripts/copy-runtime-assets.mjs`).
13. **Dependencies** listed in `meta.dependencies` must match the imports exactly (react/react-dom are implicit).
    Pick the lightest tool: CSS → WAAPI/`createSequence` → Motion (React state/gesture/layout animation) → GSAP
    (scrubbed scroll timelines, pinning, complex sequencing) → three.js/R3F (genuine 3D only).

## Demo rules

Demos are full-page compositions (default export, no props) rendered at `/demos/<specialty>/<id>` inside a container with
`container-type: inline-size` and `min-height: 100dvh`. They follow all effect rules, except: Tailwind utilities mapped to
the tokens are allowed (`bg-bg`, `bg-surface`, `bg-surface-2`, `text-ink`, `text-muted`, `border-line`,
`border-line-strong`, `text-signal`/`bg-signal`, `text-on-signal`, `text-accent`/`bg-accent`, `font-display`,
`font-sans`, `font-mono`, `font-serif`, `.mk-label`, `.mk-display`) alongside CSS modules. Use `@container` variants
(`@md:`, `@lg:` …) rather than viewport breakpoints. Demos should compose recipes from `effects/` where one exists
(import the default export and pass `params`), and list them in `meta.uses`. `uses` means *imported and rendered* — the
contract test fails if an id in `uses` is not imported. When you re-implement a recipe's technique locally (for example
against your own data), list it in `meta.adapts` instead. All copy, brands and data are original and
fictional; simulated data is labelled in the UI and described in `meta.dataNote`. No external network requests
(no remote images/fonts/CDNs): draw imagery with CSS, SVG or canvas.

## Verifying

- Typecheck: `npx tsc --noEmit -p plugins/maquettekit/library/tsconfig.json`
- Live: dev server on http://localhost:3333 → `/effects/<id>` and `/demos/<specialty>/<id>`
- Screenshot + console errors: `node scripts/shot.mjs /effects/<id> out.png [width] [height] [--reduced] [--dark] [--full] [--wait ms]`
- Accessibility with measured values, light and dark: `node scripts/axe-report.mjs <effect-id | /route>`
- Acceptance gates: `npx playwright test tests/e2e/effects.spec.ts -g "effect <id> "` (mount + replay cleanup + axe in light
  and dark, reduced motion, 390 px) and `tests/e2e/demos.spec.ts -g "demo <specialty>/<id> "` (adds keyboard focus and the
  no-WebGL fallback for 3D demos)
- Lifecycle: `npx vitest run tests/unit/library` mounts every non-WebGL recipe in StrictMode and fails on any listener,
  timer, rAF loop, observer or GSAP trigger left alive after unmount.
- Previews mount client-side only (`EffectStage`, `DemoStage`), so server-rendered HTML never contains recipe markup.
