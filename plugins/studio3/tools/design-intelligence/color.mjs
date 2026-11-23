// @ts-check
/**
 * In-house colour maths for the Design Intelligence Engine. Zero dependencies.
 *  - sRGB ⇄ linear sRGB ⇄ OKLab ⇄ OKLCH (Björn Ottosson's matrices)
 *  - sRGB gamut mapping by chroma reduction (lightness and hue are preserved)
 *  - WCAG 2.x relative luminance and contrast ratio
 *  - OKLab ΔE and an approximate colour-vision-deficiency simulation (Machado et al. 2009)
 *
 * @typedef {{ r: number, g: number, b: number }} RGB    components 0–1 (gamma-encoded sRGB unless stated)
 * @typedef {{ L: number, a: number, b: number }} OKLab  L 0–1
 * @typedef {{ l: number, c: number, h: number }} OKLCH  l 0–1, c ≥ 0 (≈0–0.37 inside sRGB), h degrees 0–360
 * @typedef {{ hex: string, oklch: string }} ColorToken
 */

const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** @param {number} c gamma-encoded channel 0–1 */
export function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
/** @param {number} c linear channel */
export function linearToSrgb(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.sign(c) * Math.abs(c) ** (1 / 2.4) - 0.055;
}

/** Parse #rgb / #rrggbb (alpha is ignored). @param {string} hex @returns {RGB} */
export function hexToRgb(hex) {
  let h = String(hex).trim().replace(/^#/, '');
  if (/^[0-9a-f]{3,4}$/i.test(h)) h = [...h.slice(0, 3)].map((x) => x + x).join('');
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(h)) throw new Error(`Invalid hex colour "${hex}"`);
  return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255 };
}
/** @param {RGB} rgb @returns {string} lowercase #rrggbb (channels clamped) */
export function rgbToHex({ r, g, b }) {
  const to = (x) => Math.round(clamp01(x) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}
export function isHex(v) { return typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim()); }

/** @param {RGB} lin linear sRGB @returns {OKLab} */
export function linearRgbToOklab({ r, g, b }) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}
/** @param {OKLab} lab @returns {RGB} linear sRGB (may be out of gamut) */
export function oklabToLinearRgb({ L, a, b }) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}
/** @param {RGB} rgb gamma sRGB @returns {OKLab} */
export function rgbToOklab(rgb) {
  return linearRgbToOklab({ r: srgbToLinear(rgb.r), g: srgbToLinear(rgb.g), b: srgbToLinear(rgb.b) });
}
/** @param {OKLab} lab @returns {OKLCH} */
export function oklabToOklch({ L, a, b }) {
  const c = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h: c < 1e-5 ? 0 : h };
}
/** @param {OKLCH} lch @returns {OKLab} */
export function oklchToOklab({ l, c, h }) {
  const r = (h * Math.PI) / 180;
  return { L: l, a: c * Math.cos(r), b: c * Math.sin(r) };
}
/** @param {string} hex @returns {OKLCH} */
export function hexToOklch(hex) { return oklabToOklch(rgbToOklab(hexToRgb(hex))); }

/** Unclamped gamma sRGB for an OKLCH colour. @param {OKLCH} lch @returns {RGB} */
export function oklchToRgbRaw(lch) {
  const lin = oklabToLinearRgb(oklchToOklab(lch));
  return { r: linearToSrgb(lin.r), g: linearToSrgb(lin.g), b: linearToSrgb(lin.b) };
}
/** @param {OKLCH} lch @param {number} [eps] */
export function inSrgbGamut(lch, eps = 1e-4) {
  const { r, g, b } = oklchToRgbRaw(lch);
  return r >= -eps && r <= 1 + eps && g >= -eps && g <= 1 + eps && b >= -eps && b <= 1 + eps;
}
/**
 * Map an OKLCH colour into sRGB by reducing chroma only (binary search), keeping
 * lightness and hue. Lightness is clamped to 0–1 first.
 * @param {OKLCH} lch @returns {OKLCH}
 */
export function gamutMap(lch) {
  const l = clamp01(lch.l);
  const h = ((lch.h % 360) + 360) % 360;
  let c = Math.max(0, lch.c);
  if (l <= 0 || l >= 1) return { l, c: 0, h };
  if (inSrgbGamut({ l, c, h })) return { l, c, h };
  let lo = 0;
  let hi = c;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inSrgbGamut({ l, c: mid, h })) lo = mid; else hi = mid;
  }
  return { l, c: lo, h };
}
/** Gamut-map and convert to hex. @param {OKLCH} lch */
export function oklchToHex(lch) { return rgbToHex(oklchToRgbRaw(gamutMap(lch))); }

/** CSS `oklch()` string with stable rounding. @param {OKLCH} lch */
export function formatOklch({ l, c, h }) {
  const r = (x, d) => Number(x.toFixed(d));
  return `oklch(${r(l * 100, 2)}% ${r(c, 4)} ${r(c < 0.0005 ? 0 : h, 2)})`;
}
/** Parse the strings produced by formatOklch. @param {string} s @returns {OKLCH | null} */
export function parseOklch(s) {
  const m = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(String(s));
  return m ? { l: Number(m[1]) / 100, c: Number(m[2]), h: Number(m[3]) } : null;
}
/**
 * Build a colour token. The hex is authoritative (8-bit sRGB); the oklch string is
 * derived back from the hex so the two always describe the same colour.
 * @param {OKLCH} lch @returns {ColorToken}
 */
export function token(lch) {
  const hex = oklchToHex(lch);
  return { hex, oklch: formatOklch(hexToOklch(hex)) };
}
/** @param {string} hex @returns {ColorToken} */
export function tokenFromHex(hex) {
  const h = rgbToHex(hexToRgb(hex));
  return { hex: h, oklch: formatOklch(hexToOklch(h)) };
}

/** WCAG 2.x relative luminance. @param {string | RGB} color */
export function relativeLuminance(color) {
  const { r, g, b } = typeof color === 'string' ? hexToRgb(color) : color;
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}
/** WCAG 2.x contrast ratio (1–21). @param {string | RGB} a @param {string | RGB} b */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Euclidean distance in OKLab (ΔE_OK). ~0.02 is a just-noticeable difference. */
export function deltaEOk(hexA, hexB) {
  const a = rgbToOklab(hexToRgb(hexA));
  const b = rgbToOklab(hexToRgb(hexB));
  return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);
}

const CVD = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
};
/**
 * Approximate dichromat simulation (Machado, Oliveira & Fernandes 2009, severity 1.0),
 * applied in linear sRGB. An approximation for palette checks, not a clinical model.
 * @param {string} hex @param {'protan' | 'deutan'} type @returns {string}
 */
export function simulateCvd(hex, type) {
  const { r, g, b } = hexToRgb(hex);
  const v = [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
  const m = CVD[type];
  const o = m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
  return rgbToHex({ r: linearToSrgb(clamp01(o[0])), g: linearToSrgb(clamp01(o[1])), b: linearToSrgb(clamp01(o[2])) });
}

/**
 * Move the lightness of `fg` away from the backgrounds until every contrast ratio
 * reaches `target` (or lightness hits 0/1). Chroma is re-gamut-mapped at each step.
 * @param {OKLCH} fg @param {string[]} bgHexes @param {number} target
 * @param {{ step?: number, direction?: 'darker' | 'lighter' }} [opts]
 * @returns {{ lch: OKLCH, hex: string, adjusted: boolean, steps: number, minRatio: number }}
 */
export function fitContrast(fg, bgHexes, target, opts = {}) {
  const step = opts.step ?? 0.004;
  const meanLum = bgHexes.reduce((s, h) => s + relativeLuminance(h), 0) / bgHexes.length;
  const dir = (opts.direction ?? (meanLum > 0.179 ? 'darker' : 'lighter')) === 'darker' ? -1 : 1;
  let cur = gamutMap(fg);
  let steps = 0;
  const minRatio = (lch) => { const hex = oklchToHex(lch); return Math.min(...bgHexes.map((b) => contrastRatio(hex, b))); };
  let ratio = minRatio(cur);
  while (ratio < target && cur.l > 0 && cur.l < 1) {
    cur = gamutMap({ l: clamp01(cur.l + dir * step), c: fg.c, h: fg.h });
    ratio = minRatio(cur);
    steps++;
  }
  return { lch: cur, hex: oklchToHex(cur), adjusted: steps > 0, steps, minRatio: ratio };
}
