// @ts-check
/**
 * Token exports: CSS custom properties, Tailwind v4 theme, TypeScript module and
 * W3C Design Tokens (DTCG) JSON. All exports read the document with overrides applied.
 */
import { applyOverrides } from './generate.mjs';
import { hexToOklch } from './color.mjs';
import { kebab, round } from './util.mjs';
import { UserError } from '../lib/log.mjs';

export const FORMATS = ['css', 'tailwind', 'ts', 'json-dtcg'];
const P = '--s3';
const spaceKey = (k) => String(k).replace('.', '_');

/** Flat list of [name, value, comment?] colour declarations for one mode. */
function colorDecls(doc, mode, fmt) {
  const c = doc.color[mode];
  const val = (t) => (fmt === 'oklch' ? t.oklch : t.hex);
  const note = (t) => (fmt === 'oklch' ? t.hex : t.oklch);
  /** @type {[string, string, string?][]} */
  const out = [];
  for (const [k, t] of Object.entries(c.roles)) out.push([`color-${kebab(k)}`, val(t), note(t)]);
  for (const [k, g] of Object.entries(c.semantic)) for (const [part, t] of Object.entries(g)) out.push([`color-${k}-${kebab(part)}`, val(t), note(t)]);
  if (c.dataViz) c.dataViz.categorical.forEach((t, i) => out.push([`color-data-${i + 1}`, val(t), note(t)]));
  return out;
}
function rampDecls(doc, fmt) {
  /** @type {[string, string, string?][]} */
  const out = [];
  for (const [ramp, steps] of Object.entries(doc.color.ramps)) for (const [step, t] of Object.entries(steps)) out.push([`color-${ramp}-${step}`, fmt === 'oklch' ? t.oklch : t.hex, fmt === 'oklch' ? t.hex : t.oklch]);
  return out;
}
/** Resolve a `{a.b.c}` token reference to its CSS variable. */
function refToVar(ref) {
  const m = /^\{(.+)\}$/.exec(ref);
  if (!m) return ref;
  const parts = m[1].split('.');
  if (parts[0] === 'radius' && parts[1] === 'scale') return `var(${P}-radius-${parts[2]})`;
  if (parts[0] === 'spacing' && parts[1] === 'density' && parts[2] === 'controlHeight') return `var(${P}-control-height-${parts[3]})`;
  if (parts[0] === 'elevation') return `var(${P}-shadow-${parts[2]})`;
  throw new Error(`Unsupported token reference ${ref}`);
}
function baseDecls(doc) {
  /** @type {[string, string, string?][]} */
  const out = [];
  const t = doc.typography;
  for (const [k, f] of Object.entries(t.families)) out.push([`font-${k}`, f.stack]);
  for (const [k, s] of Object.entries(t.scale.steps)) { out.push([`text-${k}`, s.clamp, `${s.minPx}px → ${s.maxPx}px`]); out.push([`leading-${k}`, String(s.lineHeight)]); }
  for (const [k, v] of Object.entries(t.weights)) out.push([`weight-${k}`, String(v)]);
  for (const [k, v] of Object.entries(t.tracking)) out.push([`tracking-${k}`, v]);
  for (const [k, v] of Object.entries(doc.spacing.scale)) out.push([`space-${spaceKey(k)}`, v === 0 ? '0' : `${round(v / 16, 4)}rem`, `${v}px`]);
  for (const [k, v] of Object.entries(doc.spacing.density.controlHeight)) out.push([`control-height-${k}`, `${round(v / 16, 4)}rem`, `${v}px`]);
  out.push(['target-min', `${doc.components.targetSize.minimumPx}px`], ['target-touch', `${doc.components.targetSize.recommendedTouchPx}px`]);
  for (const [k, v] of Object.entries(doc.radius.scale)) out.push([`radius-${k}`, `${v}px`]);
  for (const [k, v] of Object.entries(doc.radius.roles)) out.push([`radius-${k}`, refToVar(v)]);
  for (const [k, v] of Object.entries(doc.layout.breakpoints)) out.push([`breakpoint-${k}`, `${v}px`]);
  for (const [k, v] of Object.entries(doc.layout.containers)) out.push([`container-${k}`, typeof v === 'number' ? `${round(v / 16, 4)}rem` : v]);
  for (const [k, v] of Object.entries(doc.motion.durations)) out.push([`duration-${k}`, `${v}ms`]);
  for (const [k, v] of Object.entries(doc.motion.easings)) out.push([`ease-${k}`, v.css]);
  out.push(['stagger', `${doc.motion.stagger.eachMs}ms`], ['motion-scale', '1']);
  out.push(['focus-ring', `2px solid var(${P}-color-focus-ring)`], ['focus-ring-offset', '2px']);
  return out;
}
/**
 * Library alias layer: the variable names Studio³ library recipes and demos read (see docs/LIBRARY-CONTRACT.md),
 * mapped onto this design system's role tokens. Declared on :root as var() references, so they follow the
 * light/dark blocks automatically.
 * Motion: the design vocabulary is durations {instant, fast, base, slow, slower, scene} and easings {linear,
 * standard, enter, exit, emphasized, signature}; recipes read --s3-duration-{instant, fast, base, moderate, slow,
 * cinematic} and --s3-ease-{standard, enter, exit, emphasized, inOut}. Library names the design file lacks are
 * aliased as references (never literal ms), so the reduced-motion caps on the design durations apply to them too:
 *   moderate  → midway between base and slow (library: 360 ms between 240 and 380)
 *   cinematic → scene (fallback slower)
 *   inOut     → deliberately NOT aliased: no design easing is a symmetric in-out curve (all decelerate, exit
 *               accelerates, signature is per direction and may overshoot). Recipes use inOut for loops, flips and
 *               curtains and declare their own symmetric fallback (`var(--s3-ease-inOut, cubic-bezier(0.65, 0,
 *               0.35, 1))`); pointing it at a decelerating curve would make every loop restart abruptly.
 * Names the design document already defines are never re-declared.
 * @param {any} doc
 * @returns {[string, string, string?][]}
 */
export function libraryAliases(doc) {
  const roles = doc.color?.light?.roles ?? {};
  const semantic = doc.color?.light?.semantic ?? {};
  const fam = doc.typography?.families ?? {};
  const pick = (...keys) => keys.find((k) => k in roles);
  /** @type {[string, string | undefined][]} */
  const color = [
    ['bg', pick('bg')], ['surface', pick('surface')], ['surface-2', pick('surfaceSunken', 'surfaceRaised')],
    ['ink', pick('text')], ['ink-muted', pick('textMuted')], ['line', pick('border')], ['line-strong', pick('borderStrong', 'text')],
    ['signal', pick('primary')], ['on-signal', pick('onPrimary')], ['accent', pick('accent', 'primary')], ['focus', pick('focusRing')],
  ];
  const kebab = (k) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  /** @type {[string, string][]} */
  const out = color.filter(([, r]) => r).map(([n, r]) => [n, `var(${P}-color-${kebab(r)})`]);
  if (semantic.success) out.push(['success', `var(${P}-color-success-text)`]);
  if (semantic.danger) out.push(['danger', `var(${P}-color-danger-text)`]);
  if (!fam.serif) out.push(['font-serif', `var(${P}-font-${fam.longform ? 'longform' : 'display'})`]);
  const rr = doc.radius?.roles ?? {};
  for (const [n, r] of [['radius-s', 'control'], ['radius-m', 'container'], ['radius-l', 'overlay']]) if (r in rr) out.push([n, `var(${P}-radius-${r})`]);
  /** @type {[string, string, string?][]} */
  const motion = [];
  const dur = doc.motion?.durations ?? {};
  if (!('moderate' in dur)) {
    if ('base' in dur && 'slow' in dur) motion.push(['duration-moderate', `calc((var(${P}-duration-base) + var(${P}-duration-slow)) / 2)`, 'library name: between base and slow']);
    else if ('base' in dur) motion.push(['duration-moderate', `var(${P}-duration-base)`, 'library name']);
  }
  if (!('cinematic' in dur)) {
    const c = 'scene' in dur ? 'scene' : 'slower' in dur ? 'slower' : null;
    if (c) motion.push(['duration-cinematic', `var(${P}-duration-${c})`, 'library name']);
  }
  // --s3-ease-inOut: intentionally left to the recipes' own symmetric fallback (see the note above).
  return [...out, ...motion];
}

const block = (selector, decls, indent = '') => `${indent}${selector} {\n${decls.map(([n, v, c]) => `${indent}  ${P}-${n}: ${v};${c ? ` /* ${c} */` : ''}`).join('\n')}\n${indent}}`;

/** @param {any} input design document @param {{ colorFormat?: 'hex' | 'oklch' }} [opts] */
export function toCss(input, opts = {}) {
  const doc = applyOverrides(input);
  const fmt = opts.colorFormat ?? 'hex';
  const def = doc.color.defaultMode === 'dark' ? 'dark' : 'light';
  const alt = def === 'dark' ? 'light' : 'dark';
  const shadows = (mode) => Object.entries(doc.elevation.levels).map(([k, l]) => /** @type {[string, string]} */ ([`shadow-${k}`, l[mode].css]));
  const cap = doc.motion.reducedMotion.maxReplacementMs;
  const reduced = [
    ...Object.entries(doc.motion.durations).map(([k, v]) => /** @type {[string, string]} */ ([`duration-${k}`, `${Math.min(v, cap)}ms`])),
    /** @type {[string, string]} */ (['stagger', '0ms']), /** @type {[string, string]} */ (['motion-scale', '0']),
  ];
  return [
    `/* Studio³ design tokens — ${doc.visualDirection.name} (${doc.visualDirection.id})`,
    ` * Generated by ${doc.meta.generator} ${doc.meta.version} from brief ${doc.meta.briefHash}. Do not edit by hand:`,
    ' * change studio3.design.json (or its "overrides") and re-export.',
    ` * Default colour mode: ${def}. Set data-theme="${alt}" or "${def}" on <html> to force a mode. */`,
    block(':root', [/** @type {[string, string]} */ (['color-scheme', def]), ...rampDecls(doc, fmt), ...colorDecls(doc, def, fmt), ...shadows(def), ...baseDecls(doc)]).replace(`${P}-color-scheme`, 'color-scheme'),
    `/* Library aliases — the names Studio³ recipes read (docs/LIBRARY-CONTRACT.md). */`,
    block(':root', libraryAliases(doc)),
    `@media (prefers-color-scheme: ${alt}) {\n${block(`:root:not([data-theme="${def}"])`, [/** @type {[string, string]} */ (['color-scheme', alt]), ...colorDecls(doc, alt, fmt), ...shadows(alt)], '  ').replace(`${P}-color-scheme`, 'color-scheme')}\n}`,
    block(`:root[data-theme="${alt}"]`, [/** @type {[string, string]} */ (['color-scheme', alt]), ...colorDecls(doc, alt, fmt), ...shadows(alt)]).replace(`${P}-color-scheme`, 'color-scheme'),
    `/* Reduced motion: durations capped at ${cap}ms (opacity-only replacements), stagger off, ${P}-motion-scale 0 for transform distances. */`,
    `@media (prefers-reduced-motion: reduce) {\n${block(':root', reduced, '  ')}\n}`,
    `@media (pointer: coarse) {\n  :root {\n    ${P}-target-min: var(${P}-target-touch);\n  }\n}`,
    '',
  ].join('\n');
}

/** Tailwind CSS v4 theme (CSS-first configuration). */
export function toTailwind(input) {
  const doc = applyOverrides(input);
  const def = doc.color.defaultMode === 'dark' ? 'dark' : 'light';
  const alt = def === 'dark' ? 'light' : 'dark';
  const colors = (mode) => colorDecls(doc, mode, 'hex').map(([n, v]) => `--${n}: ${v};`);
  const t = doc.typography;
  const theme = [
    ...rampDecls(doc, 'hex').map(([n, v]) => `--${n}: ${v};`),
    ...colors(def),
    ...Object.entries(t.families).map(([k, f]) => `--font-${k === 'text' ? 'sans' : k}: ${f.stack};`),
    ...Object.entries(t.scale.steps).flatMap(([k, s]) => [`--text-${k}: ${s.clamp};`, `--text-${k}--line-height: ${s.lineHeight};`, `--text-${k}--letter-spacing: ${s.tracking};`]),
    ...Object.entries(t.weights).map(([k, v]) => `--font-weight-${k}: ${v};`),
    `--spacing: ${round(doc.spacing.base / 16, 4)}rem;`,
    ...Object.entries(doc.radius.scale).map(([k, v]) => `--radius-${k}: ${v}px;`),
    ...Object.entries(doc.elevation.levels).map(([k, l]) => `--shadow-${k}: ${l[def].css};`),
    ...Object.entries(doc.layout.breakpoints).map(([k, v]) => `--breakpoint-${k}: ${round(v / 16, 4)}rem;`),
    ...Object.entries(doc.layout.containers).map(([k, v]) => `--container-${k}: ${typeof v === 'number' ? `${round(v / 16, 4)}rem` : v};`),
    ...Object.entries(doc.motion.easings).map(([k, v]) => `--ease-${k}: ${v.css};`),
    ...Object.entries(doc.motion.durations).map(([k, v]) => `--duration-${k}: ${v}ms;`),
  ];
  const altVars = [...colors(alt), ...Object.entries(doc.elevation.levels).map(([k, l]) => `--shadow-${k}: ${l[alt].css};`)];
  return [
    `/* Studio³ Tailwind v4 theme — ${doc.visualDirection.name}. Generated from brief ${doc.meta.briefHash}; do not edit by hand. */`,
    '@import "tailwindcss";',
    `@custom-variant ${alt} (&:where([data-theme="${alt}"], [data-theme="${alt}"] *));`,
    `@theme {\n  --color-*: initial;\n  --text-*: initial;\n  --radius-*: initial;\n  --shadow-*: initial;\n  --breakpoint-*: initial;\n${theme.map((l) => `  ${l}`).join('\n')}\n}`,
    `@layer base {\n  :root { color-scheme: ${def}; }\n  @media (prefers-color-scheme: ${alt}) {\n    :root:not([data-theme="${def}"]) {\n      color-scheme: ${alt};\n${altVars.map((l) => `      ${l}`).join('\n')}\n    }\n  }\n  :root[data-theme="${alt}"] {\n    color-scheme: ${alt};\n${altVars.map((l) => `    ${l}`).join('\n')}\n  }\n  :focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }\n  @media (prefers-reduced-motion: reduce) {\n    *, ::before, ::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: ${doc.motion.reducedMotion.maxReplacementMs}ms !important; transition-property: opacity, color, background-color, border-color, outline-color !important; scroll-behavior: auto !important; }\n  }\n}`,
    '',
  ].join('\n');
}

/** Plain token object shared by the TS export. */
export function tokenObject(input) {
  const doc = applyOverrides(input);
  const flat = (mode) => ({
    ...Object.fromEntries(Object.entries(doc.color[mode].roles).map(([k, t]) => [k, t.hex])),
    semantic: Object.fromEntries(Object.entries(doc.color[mode].semantic).map(([k, g]) => [k, Object.fromEntries(Object.entries(g).map(([p, t]) => [p, t.hex]))])),
    ...(doc.color[mode].dataViz ? { dataViz: doc.color[mode].dataViz.categorical.map((t) => t.hex) } : {}),
  });
  return {
    meta: { direction: doc.visualDirection.id, briefHash: doc.meta.briefHash, defaultMode: doc.color.defaultMode, motionProfile: doc.motion.profile },
    color: { light: flat('light'), dark: flat('dark'), ramps: Object.fromEntries(Object.entries(doc.color.ramps).map(([k, r]) => [k, Object.fromEntries(Object.entries(r).map(([s, t]) => [s, t.hex]))])) },
    font: Object.fromEntries(Object.entries(doc.typography.families).map(([k, f]) => [k, f.stack])),
    text: Object.fromEntries(Object.entries(doc.typography.scale.steps).map(([k, s]) => [k, { size: s.clamp, lineHeight: s.lineHeight, letterSpacing: s.tracking }])),
    weight: doc.typography.weights,
    space: doc.spacing.scale,
    controlHeight: doc.spacing.density.controlHeight,
    radius: doc.radius.scale,
    shadow: { light: Object.fromEntries(Object.entries(doc.elevation.levels).map(([k, l]) => [k, l.light.css])), dark: Object.fromEntries(Object.entries(doc.elevation.levels).map(([k, l]) => [k, l.dark.css])) },
    breakpoint: doc.layout.breakpoints,
    duration: doc.motion.durations,
    ease: Object.fromEntries(Object.entries(doc.motion.easings).map(([k, v]) => [k, v.bezier])),
    easeCss: Object.fromEntries(Object.entries(doc.motion.easings).map(([k, v]) => [k, v.css])),
    spring: Object.fromEntries(Object.entries(doc.motion.springs).filter(([, v]) => typeof v === 'object').map(([k, v]) => [k, { stiffness: v.stiffness, damping: v.damping, mass: v.mass }])),
    defaultSpring: doc.motion.springs.default,
    stagger: doc.motion.stagger.eachMs,
    reducedMotionMaxMs: doc.motion.reducedMotion.maxReplacementMs,
  };
}
export function toTs(input) {
  const obj = tokenObject(input);
  return [
    `// Studio³ design tokens — generated from studio3.design.json (brief ${obj.meta.briefHash}). Do not edit by hand.`,
    '// Durations are milliseconds; `ease` values are cubic-bezier control points; springs are stiffness/damping/mass.',
    `export const tokens = ${JSON.stringify(obj, null, 2)} as const;`,
    '',
    'export type Tokens = typeof tokens;',
    'export type ColorRole = Exclude<keyof Tokens["color"]["light"], "semantic" | "dataViz">;',
    'export type Duration = keyof Tokens["duration"];',
    'export type Easing = keyof Tokens["ease"];',
    '',
  ].join('\n');
}

/** W3C Design Tokens Community Group format (2025.10 structure: object-valued colours and dimensions). */
export function toDtcg(input) {
  const doc = applyOverrides(input);
  const color = (t, desc) => {
    const { l, c, h } = hexToOklch(t.hex);
    return { $type: 'color', $value: { colorSpace: 'oklch', components: [round(l, 4), round(c, 4), c < 0.0005 ? 0 : round(h, 2)], hex: t.hex }, ...(desc ? { $description: desc } : {}) };
  };
  const dim = (v, unit = 'px') => ({ $type: 'dimension', $value: { value: v, unit } });
  const map = (obj, fn) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v, k)]));
  const modeGroup = (mode) => ({
    ...map(doc.color[mode].roles, (t) => color(t)),
    ...map(doc.color[mode].semantic, (g) => map(g, (t) => color(t))),
    ...(doc.color[mode].dataViz ? { data: Object.fromEntries(doc.color[mode].dataViz.categorical.map((t, i) => [String(i + 1), color(t)])) } : {}),
  });
  const shadow = (layers) => ({ $type: 'shadow', $value: layers.map((l) => ({ color: { colorSpace: 'srgb', components: (() => { const n = parseInt(l.color.slice(1), 16); return [round(((n >> 16) & 255) / 255, 4), round(((n >> 8) & 255) / 255, 4), round((n & 255) / 255, 4)]; })(), alpha: l.alpha, hex: l.color }, offsetX: { value: l.x, unit: 'px' }, offsetY: { value: l.y, unit: 'px' }, blur: { value: l.blur, unit: 'px' }, spread: { value: l.spread, unit: 'px' } })) });
  const fam = (f) => ({ $type: 'fontFamily', $value: f.stack.split(',').map((s) => s.trim().replace(/^"|"$/g, '')), $description: `${f.source} — ${f.license}` });
  return {
    $description: `Studio³ design tokens — ${doc.visualDirection.name}. Generated from brief ${doc.meta.briefHash}.`,
    $extensions: { 'dev.studio3': { direction: doc.visualDirection.id, schemaVersion: doc.meta.schemaVersion, defaultMode: doc.color.defaultMode, motionProfile: doc.motion.profile } },
    color: {
      light: modeGroup('light'),
      dark: modeGroup('dark'),
      ramp: map(doc.color.ramps, (r) => map(r, (t) => color(t))),
    },
    font: {
      family: map(doc.typography.families, fam),
      weight: map(doc.typography.weights, (v) => ({ $type: 'fontWeight', $value: v })),
      size: map(doc.typography.scale.steps, (s) => ({
        min: dim(s.minPx), max: dim(s.maxPx),
        $extensions: { 'dev.studio3': { fluid: s.clamp, lineHeight: s.lineHeight, letterSpacing: s.tracking } },
      })),
      lineHeight: map(doc.typography.scale.steps, (s) => ({ $type: 'number', $value: s.lineHeight })),
    },
    space: Object.fromEntries(Object.entries(doc.spacing.scale).map(([k, v]) => [spaceKey(k), dim(v)])),
    size: { controlHeight: map(doc.spacing.density.controlHeight, (v) => dim(v)), targetMin: dim(doc.components.targetSize.minimumPx), targetTouch: dim(doc.components.targetSize.recommendedTouchPx), breakpoint: map(doc.layout.breakpoints, (v) => dim(v)) },
    radius: { ...map(doc.radius.scale, (v) => dim(v)), ...map(doc.radius.roles, (v) => ({ $type: 'dimension', $value: v.replace('.scale.', '.') })) },
    shadow: { light: map(doc.elevation.levels, (l) => shadow(l.light.layers)), dark: map(doc.elevation.levels, (l) => shadow(l.dark.layers)) },
    motion: {
      duration: map(doc.motion.durations, (v) => ({ $type: 'duration', $value: { value: v, unit: 'ms' } })),
      easing: map(doc.motion.easings, (v) => ({ $type: 'cubicBezier', $value: v.bezier })),
      stagger: { $type: 'duration', $value: { value: doc.motion.stagger.eachMs, unit: 'ms' } },
      spring: { $extensions: { 'dev.studio3': Object.fromEntries(Object.entries(doc.motion.springs).filter(([, v]) => typeof v === 'object').map(([k, v]) => [k, { stiffness: v.stiffness, damping: v.damping, mass: v.mass }])) } },
    },
  };
}

/** @param {any} doc @param {string} format @param {{ colorFormat?: 'hex' | 'oklch' }} [opts] @returns {string} */
export function exportTokens(doc, format, opts = {}) {
  switch (format) {
    case 'css': return toCss(doc, opts);
    case 'tailwind': return toTailwind(doc);
    case 'ts': return toTs(doc);
    case 'json-dtcg': case 'dtcg': return `${JSON.stringify(toDtcg(doc), null, 2)}\n`;
    default: throw new UserError(`Unknown token format "${format}". Use one of: ${FORMATS.join(', ')}.`);
  }
}
