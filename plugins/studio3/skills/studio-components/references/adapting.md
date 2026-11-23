# Adapting a recipe to a project

## 1. Copy

```
<plugin>/library/src/effects/<id>/      → <project>/src/components/studio3/effects/<id>/
<plugin>/library/src/motion/            → <project>/src/components/studio3/motion/        (once)
<plugin>/library/src/three/             → <project>/src/components/studio3/three/         (3D recipes only, once)
<plugin>/library/src/types.ts           → <project>/src/components/studio3/types.ts       (once)
```

Keeping the same relative layout means the recipe's imports (`../../motion`, `../../three`, `../../types`) keep
working. `meta.ts` is documentation plus the param defaults; you may keep it next to the component or delete it
after turning params into props.

## 2. Dependencies

Install exactly `meta.dependencies` at compatible versions. `react`/`react-dom` >= 19 are assumed; for React 18
check any use of `use`, ref-as-prop and `inert` typing. CSS Modules must be supported by the bundler (Next.js,
Vite and Remix do; otherwise convert the module to a plain stylesheet with prefixed class names).

## 3. Tokens

Recipes read CSS custom properties with fallbacks. Map them once, globally:

```css
:root {
  --s3-bg: var(--background);          --s3-surface: var(--card);
  --s3-ink: var(--foreground);         --s3-ink-muted: var(--muted-foreground);
  --s3-line: var(--border);            --s3-line-strong: var(--foreground);
  --s3-signal: var(--primary);         --s3-on-signal: var(--primary-foreground);
  --s3-accent: var(--primary);         --s3-focus: var(--ring);
  --s3-font-display: var(--font-heading); --s3-font-text: var(--font-sans); --s3-font-mono: var(--font-mono);
  --s3-radius-s: 4px; --s3-radius-m: 10px; --s3-radius-l: 18px;
}
```

If the project has `studio3.design.json`, generate the mapping instead: `studio3 design tokens studio3.design.json --format css --out tokens.css`.
Motion tokens come from `motion/tokens.ts`; to align them with a project's own durations/easings edit that one
file rather than individual recipes.

## 4. Params → props

The gallery passes `{ params }`. In a product you usually want a normal component API:

```tsx
// before: export default function MagneticButton({ params }: EffectProps<Params>)
// after:
type Props = { children: React.ReactNode; strength?: number; radius?: number } & React.ComponentProps<'button'>;
export function MagneticButton({ children, strength = 0.35, radius = 120, ...rest }: Props) { /* same body */ }
```

Keep defaults equal to `meta.params[].default`. Remove params you do not expose, including their branches.

## 5. Motion preference

`useStudioMotion()` works without a provider (it follows the OS setting). If the product has its own "reduce
motion" setting, wrap the app in `<StudioMotionProvider reduced={userSetting} profile="expressive">`. The override
can only add reduction; it never disables an OS-level preference.

## 6. Scroll recipes in a real page

Preview versions render their own scroll container. On a page, remove that wrapper and target the document:
for `useScrollProgress` omit the `container` option; for GSAP ScrollTrigger remove the `scroller` option. Re-test
pinning with the site's sticky header and on mobile browsers with collapsing address bars.

## 7. 3D recipes

Keep `StudioCanvas` (fallback, lazy mount, render-on-demand, quality profile, diagnostics hook). Replace
procedural placeholders with optimised assets produced by `studio-asset-optimizer`. One canvas per view.

## 8. Non-React projects

Port, do not wrap: the logic of most recipes is DOM + CSS + `createSequence`/`flip` (framework-free, in
`motion/orchestrator.ts`). Replace hooks with lifecycle equivalents and keep three things identical: the reduced
state, the keyboard path and the teardown. For 3D use `createVanillaScene` from `three/vanilla.ts`.

## 9. Verify

Typecheck, then `studio3 review run --url <page>`; compare normal vs reduced-motion captures; tab through the
component; remount it several times in development and watch for duplicated listeners or animations.
