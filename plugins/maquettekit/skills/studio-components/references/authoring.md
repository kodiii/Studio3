# Authoring a new recipe

Write a new recipe only after a catalogue search found nothing adaptable. The binding rules are in
`docs/LIBRARY-CONTRACT.md` of the repository (mirrored below in brief); `studio-motion` covers choreography and
`studio-3d` covers WebGL specifics.

## Files

```
library/src/effects/<id>/
  meta.ts            export const meta: EffectMeta   — pure data, type-only imports
  index.tsx          'use client'; default export ({ params }: EffectProps<Params>)
  styles.module.css  optional, co-located
```

## Checklist

- [ ] `id` is unique, kebab-case, equal to the folder name; `category`, `specialties`, `technology`,
      `interaction`, `complexity`, `intensity` are truthful.
- [ ] `dependencies` equals the non-React imports, with the verified version range.
- [ ] 3–6 `params`, each visibly changing behaviour, each with sensible bounds.
- [ ] `applications`, `accessibility`, `reducedMotion`, `performance` are specific to this recipe.
- [ ] Reduced motion read from `useStudioMotion().reduced`; CSS motion also gated by the media query.
- [ ] Complete cleanup on unmount; survives React StrictMode double invocation.
- [ ] Keyboard path for every pointer interaction; visible focus; names for controls; targets ≥ 24 px.
- [ ] Sized with container queries (`cqi`, `@container`), themed with `--mk-*` variables and fallbacks.
- [ ] 3D: inside `StudioCanvas` with real fallback content, render-on-demand unless animating, imperatively
      created GPU resources disposed.
- [ ] No fabricated metrics or fake social proof in copy; sample data labelled.

## Register and test (repository checkout)

```bash
node scripts/build-catalog.mjs           # regenerates registry, catalog.json, CATALOG.md, gallery sources
npm run typecheck
npm run test:unit                        # metadata contract tests cover every recipe automatically
npm run dev                              # http://localhost:3333/effects/<id>
npm run test:e2e -- --grep "<id>"        # mount, console errors, reduced motion, replay/cleanup, a11y smoke
```

The contract tests are parametrised over the registry, so a new folder is covered as soon as the catalogue is
rebuilt. Add a focused test only for behaviour the generic suite cannot see.
