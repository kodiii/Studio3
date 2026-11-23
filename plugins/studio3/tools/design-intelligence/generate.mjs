// @ts-check
/**
 * Design Intelligence Engine — deterministic generator.
 * brief (+ seed) → studio3.design.json. No randomness other than the seeded PRNG,
 * no clock unless `now` is supplied, no dependencies.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLOBAL_AVOID } from './directions.mjs';
import { selectDirection } from './select.mjs';
import { normalizeBrief, isReactStack } from './brief.mjs';
import { resolveFont } from './fonts.mjs';
import { buildColor, contrastReport } from './palette.mjs';
import { hexToRgb, tokenFromHex, isHex } from './color.mjs';
import { createRng, hashOf, deepMerge, leafPaths, isPlainObject, round } from './util.mjs';

export const SCHEMA_VERSION = '1.0.0';
export const GENERATOR = 'studio3-design-intelligence';
const HERE = path.dirname(fileURLToPath(import.meta.url));
export function toolVersion() {
  try { return JSON.parse(fs.readFileSync(path.join(HERE, '..', 'package.json'), 'utf8')).version; } catch { return '0.0.0'; }
}

const TYPE_STEPS = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'];
const TYPE_USE = {
  xs: 'Captions, legal, dense table meta', sm: 'Secondary text, labels, table cells', base: 'Body copy and form controls', lg: 'Lead paragraphs, large UI text',
  xl: 'H4 / card titles', '2xl': 'H3', '3xl': 'H2', '4xl': 'H1', '5xl': 'Display / hero headline',
};
const VIEWPORT = { min: 360, max: 1440 };

function buildTypography(brief, dir) {
  const existing = brief.brand.existingFonts;
  const families = {
    display: resolveFont(existing[0] ?? dir.fonts.display, 'display'),
    text: resolveFont(existing[1] ?? existing[0] ?? dir.fonts.text, 'text'),
    mono: resolveFont(dir.fonts.mono, 'mono'),
    ...(dir.fonts.longform && !existing.length ? { longform: resolveFont(dir.fonts.longform, 'text') } : {}),
  };
  const [rMin, rMax] = dir.type.ratio;
  let [bMin, bMax] = dir.type.base;
  /** @type {string[]} */
  const notes = [];
  const needs = brief.accessibility.needs.join(' ');
  if (/low-vision|low vision|senior|elderly|dyslex/.test(`${needs} ${brief.audience.toLowerCase()}`) || brief.accessibility.level === 'AAA') {
    if (bMin < 16) { bMin = 16; bMax = Math.max(bMax, 17); notes.push('Base size raised to ≥16px for the stated accessibility needs.'); }
  }
  if (brief.targetDevices.some((d) => /mobile|phone|tablet/.test(d)) && bMin < 14) { bMin = 14; notes.push('Base size raised to ≥14px because touch devices are targeted.'); }
  /** @type {Record<string, any>} */
  const scale = {};
  let prevMin = 0;
  let prevMax = 0;
  TYPE_STEPS.forEach((name, i) => {
    const e = i - 2;
    let minPx = Math.max(11, bMin * rMin ** e);
    let maxPx = Math.max(12, bMax * rMax ** e, minPx);
    minPx = Math.max(minPx, prevMin + 0.5);
    maxPx = Math.max(maxPx, prevMax + 0.5);
    minPx = round(minPx, 2); maxPx = round(maxPx, 2);
    prevMin = minPx; prevMax = maxPx;
    const slope = (maxPx - minPx) / (VIEWPORT.max - VIEWPORT.min);
    const intercept = minPx - slope * VIEWPORT.min;
    const tScale = Math.max(0, e) / 6;
    scale[name] = {
      minPx, maxPx,
      clamp: maxPx - minPx < 0.26 ? `${round(maxPx / 16, 4)}rem` : `clamp(${round(minPx / 16, 4)}rem, ${round(intercept / 16, 4)}rem + ${round(slope * 100, 4)}vw, ${round(maxPx / 16, 4)}rem)`,
      lineHeight: round(dir.type.bodyLeading + (dir.type.displayLeading - dir.type.bodyLeading) * tScale ** 0.7, 3),
      tracking: `${round(dir.type.displayTracking * tScale, 4)}em`,
      family: e >= 2 ? 'display' : 'text',
      use: TYPE_USE[name],
    };
  });
  return {
    families,
    scale: {
      type: 'modular-fluid',
      ratio: { min: rMin, max: rMax },
      basePx: { min: bMin, max: bMax },
      viewportPx: VIEWPORT,
      formula: 'size(step, vw) = clamp(min, min + (max − min) × (vw − 360) / (1440 − 360), max); min = baseMin × ratioMin^step, max = baseMax × ratioMax^step. rem-based, so user font-size preferences and zoom are respected.',
      steps: scale,
    },
    weights: { regular: dir.type.textWeight, medium: 500, semibold: 600, bold: 700, display: dir.type.displayWeight },
    tracking: { display: `${dir.type.displayTracking}em`, heading: `${round(dir.type.displayTracking / 2, 4)}em`, body: '0em', caps: '0.08em' },
    leading: { display: dir.type.displayLeading, heading: round((dir.type.displayLeading + dir.type.bodyLeading) / 2 - 0.05, 3), body: dir.type.bodyLeading, ui: 1.3 },
    labels: dir.type.labels,
    rules: [
      'Measure: 45–75 characters per line for body copy (max-inline-size: 65ch); up to 90ch only for dense reference text.',
      'Never set body text below the `sm` step; `xs` is for meta only.',
      'Headings use text-wrap: balance; paragraphs use text-wrap: pretty where supported.',
      'Numbers in tables, prices and metrics use font-variant-numeric: tabular-nums.',
      'Load at most two families plus mono; subset to used scripts; font-display: swap with a metric-adjusted fallback (see families.*.fallbackMetrics).',
      'Text must reflow at 320 CSS px and remain usable at 200% zoom (WCAG 1.4.4, 1.4.10); text spacing overrides must not clip (1.4.12).',
      ...(families.display.family === families.text.family ? ['Single-family system: create hierarchy with weight and size, not with a second typeface.'] : [`Use ${families.display.family} from the 2xl step upward only; everything else is ${families.text.family}.`]),
    ],
    notes,
  };
}

const SPACE_KEYS = [0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32];
function buildSpacing(brief, dir) {
  const base = 4;
  const touch = brief.targetDevices.some((d) => /mobile|phone|tablet|touch/.test(d));
  const d = {
    compact: { control: { sm: 28, md: 32, lg: 40 }, padInline: 10, gap: 8, section: 48, tableRow: 32 },
    comfortable: { control: { sm: 32, md: 40, lg: 48 }, padInline: 14, gap: 12, section: 72, tableRow: 44 },
    spacious: { control: { sm: 36, md: 44, lg: 52 }, padInline: 18, gap: 16, section: 112, tableRow: 52 },
  }[dir.density];
  return {
    base,
    unit: 'px',
    scale: Object.fromEntries(SPACE_KEYS.map((k) => [String(k), k * base])),
    density: {
      mode: dir.density,
      controlHeight: d.control,
      controlPaddingInline: d.padInline,
      stackGap: d.gap,
      sectionGap: d.section,
      tableRowHeight: d.tableRow,
      note: touch
        ? 'Touch devices are targeted: on coarse pointers (@media (pointer: coarse)) interactive targets expand to at least 44×44 CSS px regardless of density.'
        : 'Pointer-first: 24×24 CSS px is the hard minimum target (WCAG 2.5.8); keep 44px for any touch-capable layout.',
    },
    rules: ['All spacing comes from the scale; no ad-hoc pixel values.', 'Related items sit closer than unrelated ones: at least a 2× step between group gap and item gap.'],
  };
}

const RADII = {
  sharp: { none: 0, sm: 0, md: 0, lg: 2, xl: 4 }, subtle: { none: 0, sm: 2, md: 4, lg: 6, xl: 10 }, soft: { none: 0, sm: 4, md: 8, lg: 12, xl: 20 },
  round: { none: 0, sm: 8, md: 12, lg: 18, xl: 28 }, pill: { none: 0, sm: 8, md: 14, lg: 22, xl: 32 },
};
function buildRadius(dir) {
  return {
    personality: dir.radius,
    unit: 'px',
    scale: { ...RADII[dir.radius], full: 9999 },
    roles: { control: dir.radius === 'pill' ? '{radius.scale.full}' : '{radius.scale.md}', container: '{radius.scale.lg}', overlay: '{radius.scale.xl}', badge: dir.radius === 'sharp' ? '{radius.scale.none}' : '{radius.scale.full}' },
    rule: 'Nested radii: inner radius = outer radius − padding (never equal radii on nested corners).',
  };
}

function shadowCss(layers) {
  if (!layers.length) return 'none';
  return layers.map((l) => {
    const { r, g, b } = hexToRgb(l.color);
    return `${l.inset ? 'inset ' : ''}${l.x}px ${l.y}px ${l.blur}px ${l.spread}px rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)} / ${l.alpha})`;
  }).join(', ');
}
function buildElevation(dir, color) {
  const uses = ['Flat on the page', 'Resting cards, inputs', 'Hover / raised cards, sticky bars', 'Dropdowns, popovers, toasts', 'Dialogs, sheets'];
  const L = (x, y, blur, spread, c, alpha) => ({ x, y, blur, spread, color: c, alpha });
  const mk = (mode) => {
    const ink = color.ramps.neutral['950'].hex;
    const line = color[mode].roles.border.hex;
    const strongInk = mode === 'light' ? color.light.roles.text.hex : '#000000';
    const k = mode === 'light' ? 1 : 2.2;
    const a = (x) => round(Math.min(0.9, x * k), 3);
    switch (dir.elevation) {
      case 'flat': return [[], [], [L(0, 0, 0, 1, line, 1)], [L(0, 0, 0, 1, line, 1), L(0, 8, 24, -8, ink, a(0.16))], [L(0, 0, 0, 1, line, 1), L(0, 24, 48, -16, ink, a(0.24))]];
      case 'hard': return [[], [L(2, 2, 0, 0, strongInk, 1)], [L(4, 4, 0, 0, strongInk, 1)], [L(6, 6, 0, 0, strongInk, 1)], [L(8, 8, 0, 0, strongInk, 1)]];
      case 'glow': return [[], [L(0, 0, 0, 1, line, 1)], [L(0, 0, 0, 1, line, 1), L(0, 8, 24, -6, '#000000', a(0.3))], [L(0, 0, 0, 1, line, 1), L(0, 16, 40, -8, '#000000', a(0.36))], [L(0, 0, 0, 1, line, 1), L(0, 32, 80, -16, '#000000', a(0.42)), L(0, 0, 60, -20, color[mode].roles.primary.hex, 0.12)]];
      default: return [[], [L(0, 1, 2, 0, ink, a(0.05)), L(0, 1, 1, 0, ink, a(0.04))], [L(0, 2, 4, -1, ink, a(0.06)), L(0, 6, 12, -2, ink, a(0.07))], [L(0, 4, 8, -2, ink, a(0.06)), L(0, 14, 28, -6, ink, a(0.11))], [L(0, 8, 16, -4, ink, a(0.07)), L(0, 28, 56, -12, ink, a(0.16))]];
    }
  };
  const light = mk('light');
  const dark = mk('dark');
  const describe = {
    flat: 'No ambient shadows: regions are separated by borders and surface tone. Only overlays (levels 3–4) cast a shadow so they read as temporary.',
    soft: 'One light source from above; two-layer shadows (tight contact + wide ambient) tinted with the neutral hue. Pressed elements drop a level.',
    hard: 'Solid offset shadows with zero blur in the text ink colour; they collapse to 0 on press as the element translates into them.',
    glow: 'Dark-first depth: a hairline light edge plus deep black falloff; a faint brand-tinted bloom on the top level only.',
  }[dir.elevation];
  return {
    style: dir.elevation,
    description: describe,
    levels: Object.fromEntries(uses.map((use, i) => [String(i), { use, light: { layers: light[i], css: shadowCss(light[i]) }, dark: { layers: dark[i], css: shadowCss(dark[i]) } }])),
    rules: ['Elevation encodes stacking order, not importance.', 'In dark mode raise surfaces by lightening them (surface → surfaceRaised) as well as by shadow.'],
  };
}

function buildLayout(brief, dir) {
  const content = { compact: 1320, comfortable: 1200, spacious: 1120 }[dir.density];
  const goals = brief.businessGoals.join(' ').toLowerCase();
  const principles = [
    'Compose asymmetrically by default: anchor the headline to a grid line and let supporting content occupy unequal columns.',
    'One primary action per viewport; secondary actions are visibly subordinate.',
    'Design the 360px layout first, then add columns — not the reverse.',
    ...(/(convert|conversion|signup|sign-up|trial|sales|lead|purchase|checkout|revenue)/.test(goals) ? ['Conversion goal: the primary action and its proof (number, quote, or product view) share the first viewport; forms ask for the minimum.'] : []),
    ...(/(onboard|activation|retention|engage|adoption)/.test(goals) ? ['Activation goal: progressive disclosure — show the next step, not the whole system; empty states teach.'] : []),
    ...(/(trust|credib|compliance|secur)/.test(goals) ? ['Trust goal: evidence (figures, sources, policies) is typeset as primary content, not hidden in footers.'] : []),
    ...(brief.interactionComplexity === 'high' ? ['High-complexity UI: persistent navigation, resizable panes and keyboard shortcuts take priority over marketing-style whitespace.'] : []),
  ];
  return {
    breakpoints: { sm: 480, md: 768, lg: 1024, xl: 1280, '2xl': 1536 },
    grid: {
      columns: { base: 4, md: 8, lg: 12 },
      gutter: { base: 16, md: 24, lg: dir.density === 'compact' ? 24 : 32 },
      margin: { base: 16, md: 32, lg: dir.density === 'spacious' ? 80 : 48 },
    },
    containers: { prose: '65ch', content: content, wide: 1440 },
    compositionalDevices: dir.devices,
    principles,
  };
}

function buildComponents(brief, dir, spacing) {
  const touch = brief.targetDevices.some((d) => /mobile|phone|tablet|touch/.test(d));
  return {
    language: dir.components.language,
    buttons: { style: dir.components.buttons, radius: '{radius.roles.control}', height: '{spacing.density.controlHeight.md}', rules: ['One primary button per view.', 'Labels are verbs ("Save changes"), never "OK" / "Submit" alone.', 'Loading keeps the label visible and the width stable; set aria-busy and disable repeat submission.', 'Disabled buttons explain why nearby, or stay enabled and validate on press.'] },
    inputs: { style: dir.components.inputs, radius: '{radius.roles.control}', height: '{spacing.density.controlHeight.md}', rules: ['Every input has a visible, programmatically associated label; placeholder is never the label.', 'Validate on blur and on submit, not on every keystroke; errors state the problem and the fix.', 'Errors use text + icon + aria-describedby; colour is supplementary.', 'Use the right type/inputmode/autocomplete so mobile keyboards and autofill help.'] },
    cards: { style: dir.components.cards, radius: '{radius.roles.container}', elevation: '{elevation.levels.1}', rules: ['A card has one primary action; if the whole card is clickable it contains exactly one link, stretched.', 'Do not nest cards.'] },
    navigation: { style: dir.components.navigation, rules: ['Same items, same order, on every page; current location exposed with aria-current="page".', 'Provide a skip link to main content.', 'Mobile navigation is reachable with one thumb and closes on Escape / outside press.'] },
    states: ['default', 'hover', 'focus-visible', 'active', 'disabled', 'loading', 'error'],
    stateRules: {
      hover: 'Pointer devices only (@media (hover: hover)); never the sole carrier of information.',
      'focus-visible': '2px ring in {color.roles.focusRing} with 2px offset; never removed, never clipped by overflow.',
      active: 'Immediate (≤ {motion.durations.instant}ms) pressed feedback: tone shift plus the direction-specific press behaviour.',
      disabled: 'Reduced contrast using {color.roles.textDisabled}; not focusable unless explanation is attached.',
      loading: 'Skeletons that match final layout for content; inline spinner only inside the triggering control.',
      error: 'Uses {color.semantic.danger.text} with an icon and message; focus moves to the first invalid field on submit.',
    },
    targetSize: {
      minimumPx: 24,
      recommendedTouchPx: 44,
      appliesTouch: touch,
      rule: `Hard minimum 24×24 CSS px (WCAG 2.2 — 2.5.8). ${touch ? 'Touch devices are in scope, so interactive targets are at least 44×44 CSS px on coarse pointers, with ≥ 8px between adjacent targets.' : '44×44 CSS px is recommended wherever touch input is possible.'}`,
    },
    controlHeights: spacing.density.controlHeight,
  };
}

function buildInteraction(brief, dir) {
  const hi = brief.interactionComplexity === 'high';
  return {
    principles: [
      'Every input gets a visible response within 100ms, even if the result takes longer.',
      'Direct manipulation over modal configuration where the task allows it.',
      'Undo beats confirm: prefer reversible actions with an undo affordance over confirmation dialogs (keep confirms for destructive, irreversible actions).',
      'Preserve user state across navigation, reloads and errors.',
      'Everything pointer-driven has a keyboard path; everything hover-driven has a focus/tap equivalent.',
      ...(hi ? ['Offer keyboard shortcuts and a command palette for frequent actions; show shortcuts in tooltips and menus.', 'Use optimistic updates for frequent, low-risk mutations and reconcile visibly on failure.'] : []),
      ...(brief.interactionComplexity === 'low' ? ['Keep interaction shallow: no gesture or shortcut is required to complete the primary journey.'] : []),
    ],
    feedbackLatency: {
      note: 'Targets for perceived responsiveness; lab values to be verified on target devices.',
      pressFeedbackMs: 100,
      simpleTransitionMs: Math.round(220 * dir.motion.durationScale),
      showProgressAfterMs: 400,
      showSkeletonAfterMs: 200,
      explainWaitAfterMs: 4000,
      inpTargetMs: 200,
    },
    inputModes: brief.targetDevices,
  };
}

const SPRINGS = {
  snappy: { stiffness: 520, damping: 38, mass: 1, feel: 'Fast, no visible overshoot. Toggles, tabs, small UI.' },
  smooth: { stiffness: 260, damping: 30, mass: 1, feel: 'Balanced; barely perceptible settle. Panels, cards, layout shifts.' },
  gentle: { stiffness: 120, damping: 22, mass: 1, feel: 'Slow and soft. Large surfaces, page-level moves.' },
  bouncy: { stiffness: 420, damping: 16, mass: 1, feel: 'Clear overshoot. Playful confirmations only; never for navigation.' },
};
function buildMotion(brief, dir) {
  const profile = brief.motionIntensity;
  const pScale = { essential: 0.85, expressive: 1, immersive: 1.15 }[profile];
  const sens = /vestibular|motion|epilep|seizure/.test(brief.accessibility.needs.join(' '));
  const ms = (x) => Math.max(40, Math.round((x * dir.motion.durationScale * pScale) / 10) * 10);
  const durations = { instant: Math.min(100, ms(90)), fast: ms(150), base: ms(240), slow: ms(380), slower: ms(600), scene: ms(1000) };
  for (const [a, b] of [['instant', 'fast'], ['fast', 'base'], ['base', 'slow'], ['slow', 'slower'], ['slower', 'scene']]) if (durations[b] <= durations[a]) durations[b] = durations[a] + 10;
  const bez = (a) => ({ bezier: a, css: `cubic-bezier(${a.join(', ')})` });
  const easings = {
    standard: bez([0.2, 0, 0, 1]),
    enter: bez([0, 0, 0.2, 1]),
    exit: bez([0.4, 0, 1, 1]),
    emphasized: bez([0.3, 0, 0, 1]),
    signature: bez(profile === 'essential' && dir.motion.signature[1] > 1 ? [0.2, 0, 0, 1] : dir.motion.signature),
    linear: bez([0, 0, 1, 1]),
  };
  const P = (name, purpose, tier, duration, easing, properties, from, to, reduced, min = 'essential') => ({ name, purpose, properties, from, to, duration: `{motion.durations.${duration}}`, easing: `{motion.easings.${easing}}`, reducedMotionTier: tier, reducedMotion: reduced, minProfile: min });
  const all = [
    P('press', 'Acknowledge a press', 'keep', 'instant', 'standard', ['transform', 'background-color'], { scale: 1 }, { scale: 0.97 }, 'Keep the colour change; drop the scale.'),
    P('fade-in', 'Reveal content in place', 'keep', 'fast', 'enter', ['opacity'], { opacity: 0 }, { opacity: 1 }, 'Unchanged (opacity only, ≤ 200ms).'),
    P('rise-in', 'Reveal content with direction', 'replace', 'base', 'enter', ['opacity', 'transform'], { opacity: 0, y: 12 }, { opacity: 1, y: 0 }, 'Opacity fade ≤ 200ms, no translation.'),
    P('scale-in', 'Open popovers, menus, dialogs from their origin', 'replace', 'fast', 'emphasized', ['opacity', 'transform'], { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1 }, 'Opacity fade ≤ 200ms.'),
    P('slide-over', 'Sheets, drawers, side panels', 'replace', 'slow', 'emphasized', ['transform'], { x: '100%' }, { x: 0 }, 'Opacity fade ≤ 200ms; panel appears in place.'),
    P('collapse', 'Accordion / disclosure height change', 'replace', 'base', 'standard', ['grid-template-rows', 'opacity'], { rows: '0fr' }, { rows: '1fr' }, 'Instant open/close.'),
    P('stagger-list', 'Sequence a short list (≤ 8 items) on first appearance', 'replace', 'base', 'enter', ['opacity', 'transform'], { opacity: 0, y: 8 }, { opacity: 1, y: 0 }, 'All items fade together ≤ 200ms, no stagger.', 'expressive'),
    P('hover-lift', 'Signal interactivity on pointer hover', 'remove', 'fast', 'signature', ['transform', 'box-shadow'], { y: 0 }, { y: -2 }, 'Removed; hover shown by colour/border only.', 'expressive'),
    P('page-transition', 'Continuity between routes (View Transitions API where supported)', 'replace', 'slow', 'emphasized', ['opacity', 'transform'], { opacity: 0, y: 8 }, { opacity: 1, y: 0 }, 'Cross-fade ≤ 200ms.', 'expressive'),
    P('shared-element', 'Morph an element between two states or routes', 'replace', 'slow', 'signature', ['transform', 'border-radius'], 'source bounds', 'target bounds', 'Cross-fade ≤ 200ms between the two states.', 'expressive'),
    P('scroll-reveal', 'One-time reveal as a section enters the viewport', 'remove', 'slow', 'enter', ['opacity', 'transform'], { opacity: 0, y: 24 }, { opacity: 1, y: 0 }, 'Removed; content is visible from the start.', 'expressive'),
    P('parallax-depth', 'Scroll-linked depth between layers (≤ 10% offset)', 'remove', 'scene', 'linear', ['transform'], { y: '-5%' }, { y: '5%' }, 'Removed; layers are static.', 'immersive'),
    P('scene-intro', 'Opening sequence for a pinned or 3D scene', 'replace', 'scene', 'signature', ['opacity', 'transform', 'camera'], 'poster frame', 'interactive scene', 'Static poster cross-fades to the final frame ≤ 200ms; scene starts paused.', 'immersive'),
    P('scroll-scene', 'Scroll-scrubbed timeline across a pinned section', 'remove', 'scene', 'linear', ['timeline progress'], 0, 1, 'Removed; the section is laid out as ordinary stacked content.', 'immersive'),
  ];
  const rank = { essential: 0, expressive: 1, immersive: 2 };
  const presets = all.filter((p) => rank[p.minProfile] <= rank[profile]);
  const profileNotes = {
    essential: 'Essential: motion only where it explains a state change. No scroll-triggered or ambient animation; nothing longer than the `slow` token.',
    expressive: 'Expressive: purposeful transitions, staggered reveals and shared-element continuity. Ambient loops are rare, short and pausable.',
    immersive: 'Immersive: scroll-driven scenes, depth and choreography are part of the content — always skippable, pausable and replaced under reduced motion.',
  };
  return {
    profile,
    profileNote: profileNotes[profile],
    temperament: dir.motion.temperament,
    durations,
    durationUnit: 'ms',
    easings,
    springs: { default: profile === 'essential' && dir.motion.spring === 'bouncy' ? 'snappy' : dir.motion.spring, ...SPRINGS },
    stagger: { eachMs: profile === 'essential' ? 0 : dir.motion.stagger, maxTotalMs: profile === 'immersive' ? 600 : 400, maxItems: 8, rule: 'Stagger only the first appearance of a short list; total stagger never exceeds maxTotalMs.' },
    choreography: {
      entrance: 'Enter with the `enter` (decelerating) curve; content moves ≤ 24px toward its resting place. Larger surfaces take longer than small ones.',
      exit: 'Exit faster than entrance (about 70% of the duration) with the `exit` (accelerating) curve; exits never delay the next view.',
      sharedElement: 'When an element persists between states, move it instead of fading two copies; everything else cross-fades around it.',
      scroll: profile === 'essential' ? 'No scroll-triggered animation. Sticky and position changes are immediate.' : profile === 'expressive' ? 'Scroll-triggered reveals play once, start when 20% visible, and never scrub. Do not hijack scroll speed or direction.' : 'Scroll-linked scenes use CSS scroll-driven animations or GSAP ScrollTrigger; native scroll position is never altered, pinned sections have a visible progress cue and a skip link.',
      interruption: 'Animations are interruptible and reversible from their current value; never queue or block input while animating.',
      properties: 'Animate transform, opacity, filter and clip-path. Layout properties (width, height, top, left, margin) are not animated; use transforms or grid-template tricks.',
    },
    reducedMotion: {
      policy: 'prefers-reduced-motion: reduce is honoured for every animation via three tiers. A manual “Reduce motion” control mirrors the same behaviour when ambient or scroll-linked motion exists.',
      tiers: {
        remove: 'Decorative or large-scale motion (parallax, scroll scenes, ambient loops, hover lifts) is removed entirely; content is shown in its final state.',
        replace: 'Meaningful transitions (reveals, panel slides, route changes, shared elements) are replaced with an opacity cross-fade of at most 200ms.',
        keep: 'Essential feedback (press state, focus ring, progress indicators, opacity fades ≤ 200ms) is kept because removing it would hide state.',
      },
      maxReplacementMs: 200,
      implementation: 'CSS: wrap motion in @media (prefers-reduced-motion: no-preference) or override tokens under (prefers-reduced-motion: reduce). JS: read matchMedia("(prefers-reduced-motion: reduce)") and subscribe to changes; libraries get reduced-motion config at the root (e.g. MotionConfig reducedMotion="user", gsap.matchMedia()).',
      ...(sens ? { note: 'Motion sensitivity is a stated need: ship with the “replace” tier as the default experience and let users opt in to full motion.' } : {}),
    },
    presets,
    intensityScaling: {
      desktop: { scale: 1, note: 'Full profile.' },
      mobile: { scale: 0.8, note: 'Shorter distances (×0.8) and no pointer-hover effects; avoid scroll-scrubbed scenes longer than two viewports.' },
      lowPower: { scale: brief.performance.lowEndDevices ? 0.4 : 0.5, note: 'Detected via navigator.hardwareConcurrency ≤ 4, deviceMemory ≤ 4, Save-Data, or sustained frame time > 24ms: drop to the Essential preset set, disable blur/filters and ambient loops.' },
    },
    safety: ['No flashing more than three times per second (WCAG 2.3.1).', 'Any motion that starts automatically, lasts more than 5 seconds and runs alongside other content has a pause/stop control (WCAG 2.2.2).', 'Motion triggered by interaction can be disabled unless essential (WCAG 2.3.3).'],
  };
}

function buildThreeD(brief, dir) {
  const purpose = brief.threeD?.purpose ?? '';
  const p = purpose.toLowerCase();
  const react = isReactStack(brief.stack);
  const fw = brief.stack.framework;
  const tight = brief.performance.budget === 'tight' || brief.performance.lowEndDevices;
  const physics = /physic|collision|rigid|ragdoll|simulation|gravity|throw/.test(p);
  const decorative = /decorat|ambient|background|accent|tilt|card|flip|parallax|subtle/.test(p);
  const interactive = /configur|interactive|explor|viewer|orbit|game|globe|scene|model|product|tour|data|visuali[sz]/.test(p);
  const designerLed = /spline|designer|no-code|nocode/.test(p) || brief.stack.libs.some((l) => /spline/.test(l));
  /** @type {string} */
  let choice;
  if (designerLed) choice = 'Spline embed';
  else if (decorative && !interactive && tight) choice = 'Static renders';
  else if (/tilt|card|flip|carousel|cube|layered/.test(p) && !interactive) choice = 'CSS 3D';
  else choice = react ? 'React Three Fiber' : 'Three.js';
  const considered = [
    { option: 'CSS 3D', verdict: choice === 'CSS 3D' ? 'chosen' : 'rejected', reasoning: choice === 'CSS 3D' ? 'The stated purpose is planar tilt/flip/layer depth, which CSS transforms and perspective deliver with zero runtime cost and full DOM accessibility.' : 'Only suits planar effects (tilt, flip, layered parallax); it cannot render meshes, materials or lighting required here.' },
    { option: 'Three.js', verdict: choice === 'Three.js' ? 'chosen' : 'rejected', reasoning: choice === 'Three.js' ? (fw === 'unspecified' ? 'No framework was specified, so framework-neutral Three.js is the safe choice; if the project turns out to be React, regenerate with --framework to get React Three Fiber.' : `Stack is ${fw} (not React), so the imperative Three.js API is the direct, lowest-overhead route. Community bindings (e.g. TresJS for Vue, Threlte for Svelte) are optional and should be evaluated separately.`) : react ? 'Works, but in a React codebase React Three Fiber gives the same renderer with declarative scene state and lifecycle handling.' : 'Not needed for the stated purpose.' },
    { option: 'React Three Fiber', verdict: choice === 'React Three Fiber' ? 'chosen' : 'rejected', reasoning: choice === 'React Three Fiber' ? `React stack (${fw}): R3F renders Three.js declaratively inside the component tree, with Drei for controls, loaders, environment and performance helpers.${physics ? ' Physics is part of the stated purpose, so @react-three/rapier is justified.' : ' Rapier is not included: nothing in the brief requires physics.'}` : react ? 'Heavier than the stated purpose needs.' : (fw === 'unspecified' ? 'Requires React; no framework was specified in the brief.' : `Requires React; the stack is ${fw}. Not applicable.`) },
    { option: 'Spline embed', verdict: choice === 'Spline embed' ? 'chosen' : 'rejected', reasoning: choice === 'Spline embed' ? 'The scene is designer-authored; embedding keeps the design tool as the source of truth. Budget for the runtime download and lazy-load it behind a poster.' : 'Fast to author but ships a sizeable runtime with limited control over loading, quality tiers and accessibility; prefer only for designer-owned scenes.' },
    { option: 'Static renders', verdict: choice === 'Static renders' ? 'chosen' : 'fallback', reasoning: choice === 'Static renders' ? 'Decorative purpose on a tight budget / low-end devices: pre-rendered AVIF/WebP stills (or a short muted, pausable video) deliver the look with no GPU cost.' : 'Used as the poster and as the fallback tier for no-WebGL, low-power and reduced-motion contexts.' },
  ];
  const packages = {
    'CSS 3D': [], 'Static renders': [], 'Spline embed': [react ? '@splinetool/react-spline' : '@splinetool/runtime'],
    'Three.js': ['three'], 'React Three Fiber': ['three', '@react-three/fiber', '@react-three/drei', ...(physics ? ['@react-three/rapier'] : [])],
  }[choice];
  const realTime = choice === 'Three.js' || choice === 'React Three Fiber' || choice === 'Spline embed';
  const q = (dpr, shadows, post, tex, extra) => ({ dprMax: dpr, shadows, postprocessing: post, textureMaxPx: tex, ...extra });
  return {
    purpose,
    artDirection: dir.threeD.artDirection,
    lighting: { setup: 'three-point (key / fill / rim)', ...dir.threeD.lighting, note: 'Prefer one shadow-casting light plus image-based lighting; bake or use contact shadows where the subject is static.' },
    materials: { principles: dir.threeD.materials, colorManagement: 'Linear workflow, sRGB output; colour textures tagged sRGB, data textures linear. Tone-map once (e.g. ACES Filmic or AgX) and check brand colours after tone mapping.' },
    camera: { fovDeg: dir.threeD.camera.fov, framing: dir.threeD.camera.framing, movement: dir.threeD.camera.movement, limits: ['Clamp polar angle so the camera never goes below the ground plane.', 'Clamp zoom/dolly so the subject can neither clip the near plane nor shrink below 30% of the canvas.', 'Damped movement; no camera motion under reduced motion unless user-initiated.'] },
    technology: {
      recommendation: choice,
      packages,
      reasoning: considered.find((c) => c.verdict === 'chosen')?.reasoning,
      considered,
      webgpu: realTime ? 'WebGL 2 is the baseline renderer. WebGPU may be enabled only behind feature detection ("gpu" in navigator and a successful requestAdapter()) with automatic fallback to WebGL; never ship WebGPU-only paths.' : 'Not applicable to the chosen technology.',
    },
    qualityProfiles: {
      note: 'Starting points only — measure on real target devices and adjust. Select the tier at runtime from device signals and observed frame time, and allow it to step down.',
      desktop: q(2, 'Soft shadow map 2048 or accumulative', dir.fit.heavy ? 'Selective (tone mapping, light bloom or AO if art direction needs it)' : 'Tone mapping only', 2048, { targetFps: 60, antialias: 'MSAA' }),
      mobile: q(1.5, 'Contact/blob shadow or 1024 map', 'Tone mapping only', 1024, { targetFps: 60, antialias: 'MSAA or FXAA' }),
      lowPower: q(1, 'None (baked or blob)', 'None', 512, { targetFps: 30, antialias: 'None', frameloop: 'demand' }),
    },
    assets: { format: 'glTF 2.0 binary (.glb)', geometryCompression: 'Meshopt or Draco', textureCompression: 'KTX2 (Basis Universal) with WebP/AVIF fallback', guidance: 'Run assets through `studio3 assets` to validate, optimise and produce per-tier variants.' },
    loading: ['Render a static poster (LCP element) immediately; hydrate the canvas when it is near the viewport and the main thread is idle.', 'Show determinate progress for downloads over ~1s.', 'Render on demand (no continuous loop) whenever nothing is animating.', 'Pause rendering when the canvas is off-screen or the tab is hidden.'],
    fallback: {
      strategy: ['No WebGL / context creation fails → static render with the same information.', 'webglcontextlost → show the poster, attempt restore once, never leave a blank canvas.', 'Low-power tier or Save-Data → static render with an explicit “Load 3D view” control.', 'prefers-reduced-motion → scene loads paused on its hero frame; movement only on direct user input.'],
      accessibility: ['The canvas has an accessible name and a text alternative describing what it shows.', 'Every in-scene action has an HTML control outside the canvas that is keyboard operable.', 'Visible instructions state how to interact (drag, scroll, keys).', 'Essential information is never available only inside the 3D scene.'],
    },
    budget: tight ? { modelTransferKb: 800, texturesTransferKb: 1200, drawCalls: 60, triangles: 100000 } : brief.performance.budget === 'generous' ? { modelTransferKb: 4000, texturesTransferKb: 6000, drawCalls: 200, triangles: 750000 } : { modelTransferKb: 2000, texturesTransferKb: 3000, drawCalls: 120, triangles: 300000 },
    budgetNote: 'Project-level starting budgets for the hero scene, not universal limits.',
  };
}

function buildPerformance(brief) {
  const b = brief.performance.budget;
  const t = { tight: { js: 120, css: 30, fonts: 80, img: 300, total: 700, lcp: 2000, tbt: 150 }, balanced: { js: 200, css: 50, fonts: 120, img: 600, total: 1400, lcp: 2500, tbt: 200 }, generous: { js: 350, css: 80, fonts: 180, img: 1200, total: 2800, lcp: 2500, tbt: 300 } }[b];
  return {
    note: 'Project-level starting budgets derived from the brief — not universal truths. Calibrate against field data (CrUX / RUM) for the real audience and revise.',
    budget: b,
    lowEndDevices: brief.performance.lowEndDevices,
    coreWebVitals: { lcpMs: t.lcp, inpMs: 200, cls: b === 'tight' ? 0.05 : 0.1, basis: 'Google “good” thresholds at the 75th percentile; lab runs are a proxy only.' },
    initialRouteKbCompressed: { javascript: t.js, css: t.css, fonts: t.fonts, aboveFoldImages: t.img, total: t.total },
    runtime: { totalBlockingTimeMs: t.tbt, longTaskMs: 50, frameBudgetMs: 16.7, animationFrameTargetFps: 60, ...(brief.performance.lowEndDevices ? { testDevice: 'Verify on a low-end Android class device (≈ 4× CPU throttle, slow 4G) before sign-off.' } : {}) },
    fonts: { maxFamilies: 3, strategy: 'Self-host WOFF2 (Fontsource), subset, preload at most the one above-the-fold text face.' },
    practices: ['Reserve space for every image, embed and late-loading region (width/height or aspect-ratio).', 'Lazy-load below-the-fold media and all 3D/animation runtimes.', 'Ship animation libraries only to routes that use them.', ...(brief.performance.lowEndDevices ? ['Low-end devices are in scope: avoid backdrop-filter, large blurs and full-screen fixed layers; prefer CSS over JS animation.'] : [])],
  };
}

function buildLibraries(brief, threeD) {
  const { stack, motionIntensity: motion, specialty } = brief;
  const react = isReactStack(stack);
  const has = (re) => stack.libs.some((l) => re.test(l));
  /** @type {{ name: string, package?: string, role: string, why: string, status?: string }[]} */
  const rec = [];
  /** @type {{ name: string, why: string }[]} */
  const avoid = [];
  rec.push({ name: 'CSS transitions, @keyframes and the View Transitions API', role: 'Default for simple effects', why: 'Hover, focus, press, fades, reveals and route cross-fades need no library; CSS runs off the main thread where possible and costs zero bytes.' });
  const hasGsap = has(/^gsap$/);
  const hasMotion = has(/^(motion|framer-motion)$/);
  const needsTimeline = motion === 'immersive' || specialty === 'cinematic';
  const needsUiAnim = motion !== 'essential' || brief.interactionComplexity === 'high';
  if (hasMotion) rec.push({ name: 'Motion', package: has(/^framer-motion$/) ? 'framer-motion → motion' : 'motion', role: 'UI animation', status: 'already in stack', why: `Already installed — keep using it for component-level animation, layout and gestures.${has(/^framer-motion$/) ? ' The package was renamed: import from "motion/react" when upgrading.' : ''}` });
  else if (react && needsUiAnim && !(hasGsap && !needsUiAnim)) rec.push({ name: 'Motion (for React)', package: 'motion', role: 'UI animation', why: 'Declarative enter/exit (AnimatePresence), layout and shared-element animation, springs and gestures that fit the React component model. Import from "motion/react".' });
  else if (!react && needsUiAnim && !hasGsap) rec.push({ name: 'Motion (vanilla) or the Web Animations API', package: 'motion', role: 'UI animation', why: `${stack.framework === 'unspecified' ? 'No framework specified' : `Stack is ${stack.framework}`}: use framework-native transitions first; Motion's framework-agnostic animate()/inView()/scroll() (≈ a few kB) covers springs and sequencing with no framework dependency.` });
  if (hasGsap) rec.push({ name: 'GSAP', package: 'gsap', role: 'Timelines and scroll choreography', status: 'already in stack', why: 'Already installed — use it for sequenced timelines and ScrollTrigger scenes rather than adding a second timeline engine.' });
  else if (needsTimeline) rec.push({ name: 'GSAP (+ ScrollTrigger)', package: 'gsap', role: 'Complex timelines and scroll choreography', why: `${motion === 'immersive' ? 'Immersive profile' : 'Cinematic specialty'}: multi-element sequenced timelines, pinning and scrubbed scroll scenes are where GSAP is strongest. Load it only on routes with scenes; wrap in gsap.matchMedia() for reduced motion.` });
  if (stack.styling.includes('tailwind')) rec.push({ name: 'Tailwind CSS theme tokens', role: 'Styling', status: 'already in stack', why: 'Export tokens with `studio3 design tokens --format tailwind` so utilities map 1:1 to this design file.' });
  if (specialty === 'data') rec.push(react ? { name: 'visx or Recharts', package: '@visx/visx | recharts', role: 'Charts', why: 'React-native SVG charting that accepts the dataViz palette directly; choose visx for bespoke figures, Recharts for standard dashboards.' } : { name: 'Observable Plot (on D3)', package: '@observablehq/plot', role: 'Charts', why: 'Framework-agnostic, concise grammar for statistical graphics; accepts the dataViz palette as a colour range.' });
  if (threeD) for (const pkg of threeD.technology.packages) rec.push({ name: pkg, package: pkg, role: '3D', why: pkg === '@react-three/rapier' ? 'Physics is explicitly part of the 3D purpose.' : `Part of the chosen 3D technology (${threeD.technology.recommendation}).` });

  if (!react) avoid.push({ name: 'React Three Fiber / Drei / Motion for React', why: `These require React; ${stack.framework === 'unspecified' ? 'the brief does not specify a React stack' : `the stack is ${stack.framework}`}. Use Three.js directly and framework-native or vanilla animation APIs.` });
  if (!threeD) avoid.push({ name: 'three / WebGL runtimes', why: 'The brief does not require 3D; do not add a 3D runtime for decoration.' });
  if (threeD && !threeD.technology.packages.includes('@react-three/rapier')) avoid.push({ name: 'Physics engines (Rapier, cannon-es)', why: 'Nothing in the brief needs physics; scripted or spring motion is cheaper and more controllable.' });
  if (!needsTimeline && !hasGsap) avoid.push({ name: 'GSAP for simple UI transitions', why: 'No complex timeline or scroll choreography in scope; CSS and (if needed) Motion cover it at lower cost.' });
  avoid.push({ name: 'A second animation runtime', why: 'Pick one UI-animation library and at most one timeline engine; overlapping libraries fight over the same elements and double the bundle.' });
  avoid.push({ name: 'Scroll-hijacking smooth-scroll libraries by default', why: 'Altering native scroll breaks keyboard, assistive-tech and reduced-motion expectations; consider only for immersive scenes, behind a reduced-motion check.' });
  if (motion === 'essential') avoid.push({ name: 'Scroll-triggered animation libraries (AOS and similar)', why: 'The Essential profile has no scroll-triggered motion.' });
  if (brief.performance.budget === 'tight' || brief.performance.lowEndDevices) avoid.push({ name: 'Lottie / large JSON animation players for decoration', why: 'Tight budget: prefer CSS, SVG or a short compressed video with a poster.' });
  avoid.push({ name: 'Icon fonts and whole-library icon imports', why: 'Import individual SVG icons; icon fonts hurt accessibility and performance.' });
  return {
    stack,
    principle: 'CSS first for simple effects; Motion for component-level UI animation; GSAP for complex timelines and scroll choreography; 3D runtimes only when the brief requires 3D. Reuse what the stack already has.',
    recommended: rec,
    avoid,
  };
}

function buildAccessibility(brief) {
  const { level, needs } = brief.accessibility;
  const aaa = level === 'AAA';
  const req = [
    `Conformance target: WCAG 2.2 ${level}. The selected motion profile never overrides accessibility or user control.`,
    `Text contrast ≥ ${aaa ? '7:1 (4.5:1 for large text)' : '4.5:1 (3:1 for large text)'}; UI components and graphical objects ≥ 3:1. Verified pairs are listed in color.*.contrast.`,
    'All functionality is operable by keyboard with a visible focus indicator (2px, ≥ 3:1) that is never obscured.',
    'Pointer targets ≥ 24×24 CSS px; 44×44 on touch layouts.',
    'prefers-reduced-motion is honoured with the three-tier policy in motion.reducedMotion.',
    'Content reflows at 320px width and 400% zoom without two-dimensional scrolling; zoom is never disabled.',
    'Semantic HTML first: landmarks, one h1, ordered headings, native controls before ARIA.',
    'Forms: visible labels, programmatic errors, autocomplete tokens, no time limits without extension.',
    'Colour is never the only means of conveying information.',
    ...(aaa ? ['AAA extras: no images of text, line spacing ≥ 1.5 and max 80ch in text blocks (1.4.8), link purpose clear from link text alone (2.4.9), target size 44×44 (2.5.5), animation from interactions can be disabled (2.3.3).'] : []),
  ];
  const map = [
    [/low-vision|low vision|contrast/, 'Low vision: support forced-colors / high-contrast modes (system colours, no information in background images); test at 200–400% zoom.'],
    [/vestibular|motion|epilep|seizure/, 'Motion sensitivity: default to the reduced tier, provide a persistent “Reduce motion” control, and avoid parallax and zooming transitions.'],
    [/keyboard/, 'Keyboard-only: document shortcuts, ensure logical focus order, manage focus on route change and when overlays open/close.'],
    [/screen-reader|screen reader|blind/, 'Screen readers: announce async updates with polite live regions, name every control, test with NVDA + Firefox and VoiceOver + Safari.'],
    [/dyslex|cognitive|reading/, 'Reading and cognitive needs: plain language, short paragraphs, no justified text, generous line and paragraph spacing, consistent patterns.'],
    [/colou?r-?blind|cvd|deuter|protan/, 'Colour-vision deficiency: pair every colour signal with shape, icon or text; verify charts with a CVD simulator.'],
    [/motor|tremor|switch|dexterity/, 'Motor needs: large targets (≥ 44px), no drag-only or timed interactions, generous spacing between destructive and primary actions.'],
    [/hearing|deaf|caption/, 'Hearing: captions and transcripts for all audio/video; no information conveyed by sound alone.'],
  ];
  const joined = needs.join(' ');
  for (const [re, text] of map) if (/** @type {RegExp} */ (re).test(joined)) req.push(/** @type {string} */ (text));
  return {
    level,
    needs,
    requirements: req,
    checklist: [
      { id: 'contrast', check: 'Run `studio3 design validate` — every required colour pair passes.', automated: true },
      { id: 'keyboard', check: 'Complete the primary journey using only Tab / Shift+Tab / Enter / Space / arrows / Escape.', automated: false },
      { id: 'focus', check: 'Focus ring is visible on every interactive element, in both colour modes.', automated: false },
      { id: 'reduced-motion', check: 'With reduced motion enabled, no parallax, scroll scenes or ambient loops run; transitions are ≤ 200ms fades.', automated: true },
      { id: 'zoom', check: '200% and 400% zoom and 320px width: no loss of content or function.', automated: false },
      { id: 'screen-reader', check: 'Headings, landmarks, names, roles and live updates make sense with a screen reader.', automated: false },
      { id: 'targets', check: 'Targets ≥ 24px (44px on touch) — `studio3 experience assess` measures this.', automated: true },
      { id: 'axe', check: 'Automated scan (axe-core via `studio3 review`) reports no serious or critical violations.', automated: true },
    ],
  };
}

function buildSpecialty(brief, dir) {
  const notes = {
    product: ['Product UI: optimise for repeated use — predictable layouts, fast feedback and dense-but-legible information beat novelty.', 'Design empty, loading, error and partial states for every view before polishing the ideal state.', 'Motion budget goes to state changes (open, move, confirm), not page decoration.'],
    cinematic: ['Cinematic: plan the page as a sequence of scenes with one idea each; write a shot list (framing, duration, transition) before building.', 'Media carries the story — typography and UI are captions. Guarantee text contrast over imagery with real scrims.', 'Every scene is skippable; scroll position maps predictably to progress; provide chapter navigation.'],
    data: ['Data: choose the chart for the question (comparison, trend, distribution, relationship) and label directly instead of relying on legends.', 'Use the dataViz categorical palette in order; reserve semantic colours for status and thresholds only.', 'Tables: right-align numbers with tabular numerals, keep units in headers, support keyboard navigation and sorting announced to assistive tech.', 'Animate data only to show change between two states (≤ the `slow` token); never animate on initial load of a dashboard.'],
    social: ['Social: content is user-generated and unpredictable — design for long names, missing avatars, extreme counts and offensive-content states.', 'Optimistic updates for likes, follows and posts with visible reconciliation on failure.', 'Feeds restore scroll position on return; infinite scroll has a reachable footer or a “load more” alternative.', 'Reporting, blocking and privacy controls are first-class, not buried.'],
    '3d': ['3D: the scene is content, the HTML around it is the interface — keep product information, controls and calls to action in the DOM.', 'Ship three tiers (static / lightweight / full) and choose at runtime; the static tier must be a complete experience.', 'Budget draw calls, triangles and texture memory per tier before modelling starts.', 'Spatial interactions need visible instructions, keyboard equivalents and a reset control.'],
  }[brief.specialty];
  return { specialty: brief.specialty, notes, directionFit: `${dir.name} suitability for this specialty: ${dir.fit.specialty[brief.specialty] ?? 0.5} (0–1).` };
}

/**
 * Generate a design document from a brief.
 * @param {any} briefInput raw or partial brief
 * @param {{ seed?: number | string, direction?: string, now?: string }} [opts]
 *   seed: explicit seed (omit `now` for byte-reproducible output); defaults to the brief hash.
 */
export function generateDesign(briefInput, opts = {}) {
  const { brief, assumptions } = normalizeBrief(briefInput);
  const briefHash = hashOf(brief);
  const seed = opts.seed ?? briefHash;
  const rng = createRng(seed);
  const { direction: dir, selection } = selectDirection(brief, rng('selection'), opts.direction);
  const color = buildColor({ brief, direction: dir, rand: rng('color') });
  const typography = buildTypography(brief, dir);
  const spacing = buildSpacing(brief, dir);
  const threeD = brief.requires3d ? buildThreeD(brief, dir) : undefined;
  const doc = {
    $schema: 'https://studio3.dev/schemas/studio3.design.schema.json',
    meta: {
      schemaVersion: SCHEMA_VERSION,
      generator: GENERATOR,
      version: toolVersion(),
      ...(opts.now ? { generatedAt: opts.now } : {}),
      seed: String(seed),
      seedSource: opts.seed === undefined ? 'brief-hash' : 'explicit',
      briefHash,
      selection,
      assumptions,
      overridesApplied: [],
    },
    brief,
    visualDirection: {
      id: dir.id,
      name: dir.name,
      thesis: dir.thesis,
      principles: dir.principles,
      avoid: [...dir.avoid, ...GLOBAL_AVOID],
      compositionalDevices: dir.devices,
      references: { layout: 'layout.compositionalDevices', components: 'components.language', motion: 'motion.temperament', ...(threeD ? { threeD: 'threeD.artDirection' } : {}) },
    },
    typography,
    color,
    spacing,
    radius: buildRadius(dir),
    elevation: buildElevation(dir, color),
    layout: buildLayout(brief, dir),
    components: buildComponents(brief, dir, spacing),
    interaction: buildInteraction(brief, dir),
    motion: buildMotion(brief, dir),
    ...(threeD ? { threeD } : {}),
    performance: buildPerformance(brief),
    libraries: buildLibraries(brief, threeD),
    accessibility: buildAccessibility(brief),
    specialtyNotes: buildSpecialty(brief, dir),
    overrides: {},
    history: [{ action: 'generate', briefHash, direction: dir.id, seed: String(seed), ...(opts.now ? { date: opts.now } : {}) }],
  };
  return doc;
}

const PROTECTED = new Set(['meta', 'brief', 'history', 'overrides', '$schema']);
/** Walk colour tokens and re-derive `oklch` from `hex` so overrides stay coherent. */
function syncColorTokens(node) {
  if (Array.isArray(node)) { node.forEach(syncColorTokens); return; }
  if (!isPlainObject(node)) return;
  if (isHex(node.hex) && Object.keys(node).every((k) => k === 'hex' || k === 'oklch')) { Object.assign(node, tokenFromHex(node.hex)); return; }
  Object.values(node).forEach(syncColorTokens);
}
/**
 * Apply `doc.overrides` on top of the generated sections (idempotent). Colour tokens
 * are re-synchronised and both contrast reports recomputed, so a non-compliant
 * override is visible to `validate` rather than hidden.
 * @param {any} doc @returns {any} new document
 */
export function applyOverrides(doc) {
  const overrides = isPlainObject(doc.overrides) ? doc.overrides : {};
  const usable = Object.fromEntries(Object.entries(overrides).filter(([k]) => !PROTECTED.has(k)));
  const ignored = Object.keys(overrides).filter((k) => PROTECTED.has(k));
  const out = deepMerge(doc, usable);
  out.overrides = structuredClone(overrides);
  if (Object.keys(usable).length) {
    syncColorTokens(out.color);
    for (const mode of ['light', 'dark']) if (out.color?.[mode]?.roles) out.color[mode].contrast = contrastReport(out.color[mode], out.brief?.accessibility?.level ?? 'AA');
    if (out.elevation?.levels) {
      for (const [key, lvl] of Object.entries(out.elevation.levels)) {
        for (const m of ['light', 'dark']) {
          // Shadow css is re-derived from layers unless the css string itself was overridden.
          const cssOverridden = typeof usable.elevation?.levels?.[key]?.[m]?.css === 'string';
          if (Array.isArray(lvl?.[m]?.layers) && !cssOverridden) lvl[m].css = shadowCss(lvl[m].layers);
        }
      }
    }
  }
  out.meta = { ...out.meta, overridesApplied: leafPaths(usable).filter(Boolean).sort(), ...(ignored.length ? { overridesIgnored: ignored } : {}) };
  if (!ignored.length) delete out.meta.overridesIgnored;
  return out;
}
/**
 * Regenerate while keeping a previous document's overrides and history.
 * @param {any} briefInput @param {any} previous existing design document (or null)
 * @param {{ seed?: number | string, direction?: string, now?: string, keepOverrides?: boolean }} [opts]
 */
export function regenerateDesign(briefInput, previous, opts = {}) {
  const fresh = generateDesign(briefInput, opts);
  if (!previous) return fresh;
  const prevHistory = Array.isArray(previous.history) ? previous.history : [];
  const entry = { ...fresh.history[0], action: opts.keepOverrides ? 'regenerate-merge' : 'regenerate-force', previousBriefHash: previous.meta?.briefHash ?? null, previousDirection: previous.visualDirection?.id ?? null };
  fresh.history = [...prevHistory, entry];
  if (opts.keepOverrides && isPlainObject(previous.overrides)) fresh.overrides = structuredClone(previous.overrides);
  return applyOverrides(fresh);
}
