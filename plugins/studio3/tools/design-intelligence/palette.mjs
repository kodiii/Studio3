// @ts-check
/**
 * Palette construction in OKLCH with guaranteed WCAG contrast.
 * Every required text/background and UI/background pair is checked; when a pair
 * falls short the foreground (or, for solid fills, the fill) has its lightness
 * moved until the pair passes, and the change is recorded in `adjustments`.
 */
import {
  hexToOklch, token, tokenFromHex, fitContrast, contrastRatio, formatOklch, deltaEOk, simulateCvd, gamutMap, oklchToHex,
} from './color.mjs';
import { round, getPath } from './util.mjs';

export const RAMP_STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
const RAMP_L = [0.975, 0.94, 0.885, 0.815, 0.72, 0.63, 0.54, 0.45, 0.36, 0.27, 0.2];
const RAMP_C = [0.12, 0.25, 0.45, 0.7, 0.9, 1, 1, 0.9, 0.75, 0.6, 0.45];
const NEUTRAL_L = [0.985, 0.965, 0.925, 0.87, 0.72, 0.57, 0.46, 0.37, 0.28, 0.21, 0.15];
const SURFACES = ['bg', 'surface', 'surfaceRaised', 'surfaceSunken'];
const SEMANTIC_HUES = { success: 150, warn: 78, danger: 27, info: 245 };
export const DATAVIZ_MIN_DELTA_E = 0.08;

const wrap = (h) => ((h % 360) + 360) % 360;

/** @param {number} h @param {number} cPeak */
export function chromaRamp(h, cPeak) {
  return Object.fromEntries(RAMP_STEPS.map((s, i) => [s, token({ l: RAMP_L[i], c: cPeak * RAMP_C[i], h })]));
}
/** Neutral ramp tinted toward the brand hue. */
export function neutralRamp(h, chroma) {
  return Object.fromEntries(RAMP_STEPS.map((s, i) => [s, token({ l: NEUTRAL_L[i], c: chroma * (i > 3 && i < 8 ? 1.4 : 1), h })]));
}

/** Text contrast target for a conformance level (WCAG 1.4.3 / 1.4.6). UI components stay at 3:1 (1.4.11). */
export const targetsFor = (level) => ({ text: level === 'AAA' ? 7 : 4.5, ui: 3 });

/**
 * Required pairs: [foreground path, background path, kind].
 * @param {boolean} hasDataViz @returns {[string, string, 'text' | 'ui'][]}
 */
export function requiredPairs(hasDataViz) {
  /** @type {[string, string, 'text' | 'ui'][]} */
  const pairs = [];
  for (const s of SURFACES) { pairs.push(['roles.text', `roles.${s}`, 'text'], ['roles.textMuted', `roles.${s}`, 'text'], ['roles.focusRing', `roles.${s}`, 'ui'], ['roles.borderStrong', `roles.${s}`, 'ui']); }
  for (const s of ['bg', 'surface', 'surfaceRaised', 'primarySubtle']) pairs.push(['roles.primaryText', `roles.${s}`, 'text']);
  for (const s of ['bg', 'surface', 'surfaceRaised']) pairs.push(['roles.accentText', `roles.${s}`, 'text']);
  pairs.push(['roles.onPrimary', 'roles.primary', 'text'], ['roles.onPrimary', 'roles.primaryHover', 'text'], ['roles.onAccent', 'roles.accent', 'text']);
  for (const k of Object.keys(SEMANTIC_HUES)) {
    pairs.push([`semantic.${k}.on`, `semantic.${k}.solid`, 'text']);
    for (const s of ['roles.bg', 'roles.surface', `semantic.${k}.subtle`]) pairs.push([`semantic.${k}.text`, s, 'text']);
  }
  if (hasDataViz) for (let i = 0; i < 8; i++) for (const s of ['bg', 'surface']) pairs.push([`dataViz.categorical.${i}`, `roles.${s}`, 'ui']);
  return pairs;
}

/** Compute the contrast report for one mode from its current values. */
export function contrastReport(modeColors, level) {
  const t = targetsFor(level);
  return requiredPairs(Boolean(modeColors.dataViz)).map(([fg, bg, kind]) => {
    const f = getPath(modeColors, fg);
    const b = getPath(modeColors, bg);
    const ratio = f?.hex && b?.hex ? contrastRatio(f.hex, b.hex) : 0;
    const required = t[kind];
    return { fg, bg, kind, ratio: round(Math.floor(ratio * 100) / 100, 2), required, pass: ratio >= required };
  });
}

function dataViz(hue, isLight, surfaceHexes, chroma) {
  const order = [0, 3, 6, 1, 4, 7, 2, 5];
  const base = isLight ? 0.56 : 0.74;
  let amp = 0.06;
  let best = null;
  for (let attempt = 0; attempt < 6; attempt++, amp += 0.015) {
    const hexes = order.map((k, i) => fitContrast({ l: base + (i % 2 ? amp : -amp), c: chroma, h: wrap(hue + k * 45) }, surfaceHexes, 3).hex);
    const adj = (sim) => Math.min(...hexes.map((h, i) => { const n = hexes[(i + 1) % hexes.length]; return sim ? deltaEOk(simulateCvd(h, sim), simulateCvd(n, sim)) : deltaEOk(h, n); }));
    const check = { normal: adj(null), protan: adj('protan'), deutan: adj('deutan') };
    const min = Math.min(check.normal, check.protan, check.deutan);
    if (!best || min > best.min) best = { hexes, check, min, amp };
    if (min >= DATAVIZ_MIN_DELTA_E) break;
  }
  return {
    categorical: best.hexes.map(tokenFromHex),
    check: {
      metric: 'Minimum ΔE (OKLab) between adjacent series, in normal vision and under simulated protanopia / deuteranopia (Machado 2009 approximation).',
      threshold: DATAVIZ_MIN_DELTA_E,
      minAdjacentDeltaE: round(best.check.normal, 3),
      minAdjacentDeltaEProtan: round(best.check.protan, 3),
      minAdjacentDeltaEDeutan: round(best.check.deutan, 3),
      lightnessAlternation: round(best.amp, 3),
      pass: best.min >= DATAVIZ_MIN_DELTA_E,
    },
    guidance: [
      'Assign series in array order so neighbours stay distinguishable; beyond 8 series, group or facet instead of adding colours.',
      'Never rely on colour alone: add direct labels, patterns, or distinct marker shapes.',
      'Each series colour meets 3:1 against bg and surface (WCAG 1.4.11 graphical objects).',
    ],
  };
}

/**
 * @param {{ brief: any, direction: import('./directions.mjs').Direction, rand: () => number }} ctx
 */
export function buildColor({ brief, direction: dir, rand }) {
  const level = brief.accessibility.level;
  const t = targetsFor(level);
  const brandInputs = brief.brand.existingColors.map((hex) => ({ hex, lch: hexToOklch(hex) }));
  const chromatic = brandInputs.filter((c) => c.lch.c > 0.03);
  const jitter = (rand() * 2 - 1) * dir.color.hue.range;
  const chromaPick = dir.color.brandChroma[0] + rand() * (dir.color.brandChroma[1] - dir.color.brandChroma[0]);
  const sign = rand() < 0.5 ? -1 : 1;
  const fromBrand = chromatic.length > 0;
  const hue = fromBrand ? chromatic[0].lch.h : wrap(dir.color.hue.base + jitter);
  const chroma = fromBrand ? Math.min(0.3, Math.max(0.04, chromatic[0].lch.c)) : chromaPick;
  const accentOffset = { complement: 180, analogous: 35 * sign, split: 150 * sign, triad: 120 * sign, mono: 0 }[dir.color.accent];
  const accentFromBrand = chromatic.length > 1;
  const accentHue = accentFromBrand ? chromatic[1].lch.h : wrap(hue + accentOffset);
  const accentChroma = accentFromBrand ? Math.max(0.04, chromatic[1].lch.c) : dir.color.accent === 'mono' ? chroma * 0.45 : Math.min(0.2, chroma * 0.95 + 0.01);
  const semC = Math.min(0.17, Math.max(0.11, chroma));
  const nC = dir.color.neutralChroma;
  const neutrals = neutralRamp(hue, nC);
  /** @type {any[]} */
  const adjustments = [];

  const buildMode = (mode) => {
    const isLight = mode === 'light';
    const bgL = isLight ? dir.color.lightBg : dir.color.darkBg;
    const N = (l, m = 1) => ({ l, c: nC * m, h: hue });
    /** @type {Record<string, any>} */
    const roles = {};
    roles.bg = token(N(bgL));
    roles.surface = token(N(isLight ? Math.min(1, bgL + 0.012) : bgL + 0.035));
    roles.surfaceRaised = token(N(isLight ? Math.min(1, bgL + 0.022) : bgL + 0.07));
    roles.surfaceSunken = token(N(isLight ? bgL - 0.028 : Math.max(0.06, bgL - 0.03)));
    const surfaces = SURFACES.map((s) => roles[s].hex);
    const record = (role, start, res, target, against) => {
      if (res.adjusted) adjustments.push({ mode, role, reason: `raised to ${target}:1 against ${against}`, from: formatOklch(gamutMap(start)), to: formatOklch(res.lch), lightnessSteps: res.steps });
    };
    /** Fit a foreground against backgrounds. */
    const fg = (role, start, bgs, target, against) => {
      const res = fitContrast(start, bgs, target);
      record(role, start, res, target, against);
      return tokenFromHex(res.hex);
    };
    /** Fit a solid fill and choose its "on" colour. */
    const solid = (role, start) => {
      const light = token(N(0.99, 0.6));
      const dark = token(N(0.16, 1.5));
      const s0 = oklchToHex(start);
      const useLight = contrastRatio(light.hex, s0) >= contrastRatio(dark.hex, s0);
      const on = useLight ? light : dark;
      const res = fitContrast(start, [on.hex], t.text, { direction: useLight ? 'darker' : 'lighter' });
      record(role, start, res, t.text, `its on-colour ${on.hex}`);
      return { fill: tokenFromHex(res.hex), on, lch: res.lch, useLight };
    };

    roles.text = fg('text', N(isLight ? 0.21 : 0.95, 1.6), surfaces, t.text, 'all surfaces');
    roles.textMuted = fg('textMuted', N(isLight ? 0.47 : 0.75, 1.6), surfaces, t.text, 'all surfaces');
    roles.textDisabled = token(N(isLight ? 0.68 : 0.5, 1.2));
    roles.border = token(N(isLight ? bgL - 0.085 : bgL + 0.11, 1.4));
    roles.borderStrong = fg('borderStrong', N(isLight ? 0.62 : 0.52, 1.6), surfaces, t.ui, 'all surfaces');

    const brandStart = fromBrand
      ? (isLight ? chromatic[0].lch : { l: Math.min(0.78, Math.max(0.62, chromatic[0].lch.l + 0.12)), c: chroma, h: hue })
      : { l: isLight ? 0.52 : 0.72, c: chroma, h: hue };
    const p = solid('primary', brandStart);
    roles.primary = p.fill;
    roles.onPrimary = p.on;
    roles.primaryHover = token({ l: p.lch.l + (p.useLight ? -0.045 : 0.045), c: p.lch.c, h: hue });
    roles.primarySubtle = token({ l: isLight ? 0.95 : bgL + 0.09, c: Math.min(chroma * (isLight ? 0.3 : 0.4), isLight ? 0.045 : 0.06), h: hue });
    roles.primaryText = fg('primaryText', { l: isLight ? Math.min(p.lch.l, 0.55) : Math.max(p.lch.l, 0.72), c: chroma, h: hue }, [roles.bg.hex, roles.surface.hex, roles.surfaceRaised.hex, roles.primarySubtle.hex], t.text, 'bg, surface, surfaceRaised, primarySubtle');

    const a = solid('accent', accentFromBrand && isLight ? chromatic[1].lch : { l: isLight ? 0.6 : 0.76, c: accentChroma, h: accentHue });
    roles.accent = a.fill;
    roles.onAccent = a.on;
    roles.accentText = fg('accentText', { l: isLight ? 0.5 : 0.78, c: accentChroma, h: accentHue }, [roles.bg.hex, roles.surface.hex, roles.surfaceRaised.hex], t.text, 'bg, surface, surfaceRaised');
    roles.focusRing = fg('focusRing', { l: isLight ? 0.55 : 0.78, c: Math.max(chroma, 0.16), h: dir.color.accent === 'mono' ? hue : accentHue }, surfaces, t.ui, 'all surfaces');

    /** @type {Record<string, any>} */
    const semantic = {};
    for (const [k, h] of Object.entries(SEMANTIC_HUES)) {
      const s = solid(`semantic.${k}.solid`, { l: k === 'warn' ? 0.8 : isLight ? 0.55 : 0.7, c: semC, h });
      const subtle = token({ l: isLight ? 0.955 : bgL + 0.085, c: isLight ? 0.035 : 0.045, h });
      semantic[k] = {
        solid: s.fill,
        on: s.on,
        text: fg(`semantic.${k}.text`, { l: isLight ? 0.48 : 0.8, c: semC, h }, [roles.bg.hex, roles.surface.hex, subtle.hex], t.text, 'bg, surface and its subtle tint'),
        subtle,
      };
    }
    /** @type {any} */
    const out = { roles, semantic };
    if (brief.specialty === 'data') out.dataViz = dataViz(hue, isLight, [roles.bg.hex, roles.surface.hex], Math.max(0.12, Math.min(0.17, chroma)));
    out.contrast = contrastReport(out, level);
    return out;
  };

  const light = buildMode('light');
  const dark = buildMode('dark');
  return {
    space: 'oklch',
    note: 'Colours are authored in OKLCH and gamut-mapped to sRGB by chroma reduction. `hex` is authoritative; `oklch` is the same colour expressed for CSS Color 4.',
    defaultMode: dir.color.mode,
    strategy: dir.color.note,
    brand: {
      hue: round(hue, 2),
      chroma: round(chroma, 4),
      source: fromBrand ? chromatic[0].hex : 'direction-default',
      derivation: fromBrand
        ? `Hue and chroma taken from brand colour ${chromatic[0].hex}; lightness adjusted only where contrast required it.`
        : `No chromatic brand colour supplied — hue ${round(hue, 1)}° chosen from the direction's range (${dir.color.hue.base}° ± ${dir.color.hue.range}°) with the seed.`,
      accentHue: round(accentHue, 2),
      accentDerivation: accentFromBrand ? `Second brand colour ${chromatic[1].hex}.` : `${dir.color.accent} of the brand hue.`,
      ...(brandInputs.length ? { supplied: brandInputs.map((c) => c.hex) } : {}),
    },
    ramps: { neutral: neutrals, brand: chromaRamp(hue, chroma), accent: chromaRamp(accentHue, accentChroma) },
    light,
    dark,
    contrastPolicy: {
      level,
      textRatio: t.text,
      uiRatio: t.ui,
      standard: level === 'AAA' ? 'WCAG 2.2 — 1.4.6 Contrast (Enhanced) 7:1 for text; 1.4.11 Non-text Contrast 3:1 for UI.' : 'WCAG 2.2 — 1.4.3 Contrast (Minimum) 4.5:1 for text; 1.4.11 Non-text Contrast 3:1 for UI.',
      exempt: ['roles.textDisabled (inactive components are exempt)', 'roles.border (decorative separators; use roles.borderStrong for control boundaries)'],
    },
    adjustments,
  };
}
