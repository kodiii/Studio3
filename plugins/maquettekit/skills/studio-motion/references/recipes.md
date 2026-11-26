# Recipes — find, adapt, author

The Component & Effect Library ships each effect as real source with metadata, a reduced-motion path and cleanup.
Adapting a recipe beats writing from scratch: its accessibility, reduced-motion and cleanup work is already done
and tested. Copying mechanics (files, imports, tokens, params → props) is `studio-components`'
`references/adapting.md`; this file is the motion view.

## 1. Reading the catalogue

- `maquettekit catalog search <query>` with facets `--category`, `--tech`, `--specialty`, `--interaction`,
  `--intensity subtle|moderate|bold`, `--max-complexity 1|2|3`, `--no-deps`, `--limit`, `--json`.
- `maquettekit catalog show <id> --source` prints the metadata and every file. `maquettekit catalog list --kind demos` lists
  full compositions.
- `${CLAUDE_PLUGIN_ROOT}/library/CATALOG.md` (generated) groups recipes by category with technology,
  dependencies, complexity, intensity and the reduced-motion behaviour; `catalog.json` is the machine form.
- Read `meta.ts` in full before choosing: `reducedMotion`, `accessibility` and `performance` are requirements.

## 2. All recipes (42, from the catalogue at the time of writing)

New recipes keep landing: confirm an id with `maquettekit catalog search` before citing it.

| id | category | technology | dependencies | typical use |
|---|---|---|---|---|
| `css-cube-carousel` | 3d-transforms | css | — | process or onboarding steps |
| `flip-card-3d` | 3d-transforms | css, waapi | — | pricing plan summary and details |
| `layered-depth-stack` | 3d-transforms | css | — | design-system or architecture explainer |
| `dot-grid-pointer-field` | backgrounds | canvas2d | — | interactive hero backdrop |
| `grain-gradient-mesh` | backgrounds | css, canvas2d | — | hero or section background |
| `magnetic-button` | buttons | css | — | hero call to action |
| `morph-submit-button` | buttons | waapi, svg, css | — | waitlist or newsletter sign-up |
| `press-depth-button` | buttons | css | — | primary action on a device-like control panel |
| `camera-preset-rig` | camera | r3f, three | three, @react-three/fiber | product configurator views |
| `orbit-inspect-controls` | camera | r3f, three | three, @react-three/fiber | product or furniture inspection |
| `scroll-camera-dolly` | camera | r3f, three | three, @react-three/fiber | scrollytelling chapter |
| `expanding-card-detail` | cards | motion, css, svg | motion | event or course listings |
| `cursor-follower` | cursor | css, svg | — | portfolio or studio site: "View" and "Drag" labels, magnetic targets |
| `bar-race-transition` | charts | d3, css | d3 | leaderboard over time |
| `brush-linked-range` | charts | d3, svg, css | d3 | time-series explorer |
| `line-chart-morph` | charts | d3, svg, css | d3 | analytics overview with a range switcher |
| `number-ticker` | charts | waapi, css | — | KPI tile |
| `swipe-card-stack` | gestures | motion, css | motion | shortlist or wish-list triage |
| `flip-grid-reorder` | layout | waapi, css | — | shop or portfolio filters |
| `progress-orbit-loader` | loading | svg, css | — | file export or upload progress |
| `skeleton-shimmer-handoff` | loading | css, waapi | — | feed or reading list first load |
| `command-menu-reveal` | navigation | waapi, css | — | app-wide command palette |
| `fullscreen-menu-curtain` | navigation | css | — | portfolio or agency site menu |
| `morphing-nav-pill` | navigation | motion, css | motion | settings or dashboard section tabs |
| `horizontal-scroll-gallery` | scroll | gsap, css, svg | gsap, @gsap/react | portfolio or case-study strip |
| `parallax-depth-layers` | scroll | css, svg | — | editorial hero image |
| `scroll-pin-chapters` | scroll | gsap, css, svg | gsap, @gsap/react | process or how-it-works section |
| `scroll-progress-rail` | scroll | css | — | long-form article |
| `image-ripple-distortion` | shaders | r3f, three, glsl, canvas2d | three, @react-three/fiber | portfolio or exhibition carousel |
| `liquid-glass-lens` | shaders | glsl, three, r3f, canvas2d | three, @react-three/fiber | draggable glass loupe over a hero or product detail, light that follows the pointer |
| `particle-field-gpu` | shaders | r3f, three, glsl | three, @react-three/fiber | immersive hero background |
| `shader-aurora-plane` | shaders | r3f, three, glsl | three, @react-three/fiber | immersive hero background |
| `like-heart-morph` | social | svg, waapi, css | — | feed post actions |
| `poll-result-bars` | social | css, waapi | — | community or newsletter poll |
| `reaction-burst` | social | canvas2d, waapi, css | — | post or comment reactions |
| `story-progress-segments` | social | waapi, css | — | product or editorial stories |
| `exploded-view` | spatial | r3f, three | three, @react-three/fiber | product anatomy or "what's inside" section |
| `hotspot-annotations` | spatial | r3f, three | three, @react-three/fiber | product feature tour |
| `blob-morph` | svg | svg, waapi | — | avatar or profile-picture mask |
| `svg-path-draw` | svg | svg, waapi | — | brand mark or monogram reveal |
| `kinetic-marquee` | typography | css | — | section divider between case studies |
| `scramble-decode` | typography | css | — | hero kicker or status line |
| `split-line-reveal` | typography | waapi, css | — | hero headline |
| `variable-weight-wave` | typography | css | — | hero headline |
| `rive-state-machine` | vector-animation | rive, css | @rive-app/canvas-lite | reactive mascot; animated rating control over native radios |

House patterns worth knowing before you adapt one:

| Technology | Reference recipe | Pattern |
|---|---|---|
| WAAPI | `split-line-reveal`, `command-menu-reveal` | `createSequence({ reducedMotion, durationScale })` in a layout effect, `seq.cancel()` on cleanup; exits from single-keyframe steps |
| CSS | `scroll-progress-rail` | `@supports (animation-timeline: scroll())` with `CSS.supports` detection and a `useScrollProgress` fallback |
| Motion | `morphing-nav-pill` | `layoutId` prefixed with `useId()`, `transition={{ type: 'spring', ...spring[token] }}`, `{ duration: 0 }` when reduced |
| GSAP | `scroll-pin-chapters`, `horizontal-scroll-gallery` | `useGSAP({ scope, dependencies: [reduced, …], revertOnUpdate: true })`, CSS sticky pinning, `ResizeObserver` → `refresh()`, early return when reduced |
| R3F / GLSL | `shader-aurora-plane` | `StudioCanvas` with fallback; `frameloop` `always` only while animating; uniforms in `useMemo` |
| Rive | `rive-state-machine` (`RiveCanvas`) | Runtime imported lazily; `RuntimeLoader.setWasmUrl`/`setWasmFallbackUrl` to your own origin before the first instance; drawing buffer from a `ResizeObserver` (DPR ≤ 2); stop rendering offscreen and when hidden; inputs set from DOM controls; `cleanup()` on unmount |
| Spring physics on rAF | `cursor-follower`, `magnetic-button` | Sub-stepped springs that keep velocity, one read-then-write pass per frame on a `useRafLoop` that sleeps when settled; fine pointers only; off under reduced motion |

## 3. Adapting

1. Pick by need, then by weight: `--no-deps` and lower complexity first; reuse the animation library the project
   already has.
2. Copy the recipe folder and `library/src/motion/` (plus `library/src/three/` for WebGL recipes) once; fix import
   paths.
3. Map `--mk-*` variables and motion tokens to the project's design tokens (`tokens.md` §7).
4. Turn the `params` you need into props; delete the rest, and the sample content.
5. Keep the reduced-motion branch, ARIA, keyboard handling and cleanup intact. Re-run the remount and reduced-motion
   checks after any change.
6. Install exactly the packages in `meta.dependencies`, with their licences in the report.

## 4. Authoring a new recipe (repository work)

Only after a search found nothing adaptable. The binding rules are `docs/LIBRARY-CONTRACT.md`; `studio-components`
`references/authoring.md` has the file layout.

`meta.ts` exports `meta: EffectMeta` — pure data, type-only imports (it is loaded by Node):

| Field | Content |
|---|---|
| `id`, `name`, `description` | Kebab-case id equal to the folder; one or two sentences on what is distinctive |
| `category`, `specialties`, `technology`, `interaction` | From the unions in `library/src/types.ts`; truthful |
| `complexity` (1–3), `intensity` (`subtle`/`moderate`/`bold`) | Integration effort; visual weight |
| `applications` | Concrete uses ("pricing toggle", "hero headline") |
| `dependencies` | Exactly the non-React imports, each `{ name, version }` with the verified range |
| `params` | 3–6 `ParamSpec`s (number with min/max/step, boolean, select, color, text), each visibly changing behaviour |
| `accessibility`, `reducedMotion`, `performance` | Specific statements about this recipe, not boilerplate |
| `preview` | Optional `height`, `stage` (`surface`/`ink`/`none`), `scroll` for scroll-driven recipes |

`index.tsx`: `'use client'`, default export `({ params }: EffectProps<Params>)`, tokens instead of magic numbers,
`useStudioMotion().reduced`, container-query sizing, themed with `--mk-*` variables and fallbacks, sample content
labelled, complete cleanup.

Gates, all of which must pass:

```bash
node scripts/build-catalog.mjs          # registry, catalog.json, CATALOG.md, gallery sources
npm run typecheck
npm run test:unit                       # metadata contract + StrictMode render/cleanup test for DOM recipes
npm run dev                             # http://localhost:3333/effects/<id>
npm run test:e2e -- --grep "<id>"       # tests/e2e/effects.spec.ts
```

`tests/e2e/effects.spec.ts` runs per recipe: mounts without errors, survives Replay three times, passes axe
(serious/critical) inside its stage; renders under `prefers-reduced-motion: reduce` with no infinite CSS/WAAPI
animation running; fits a 390 px container without horizontal overflow; WebGL recipes must show a canvas or
`[data-maquettekit-fallback]`. `node scripts/shot.mjs /effects/<id> out.png [width] [height] [--reduced] [--dark]`
captures screenshots with console errors.

## 5. Checklist

- [ ] Searched with facets before writing anything; candidates compared by dependency and weight.
- [ ] Adapted recipe keeps its reduced-motion, accessibility and cleanup behaviour.
- [ ] New recipes: truthful metadata, 3–6 working params, all gates green.
