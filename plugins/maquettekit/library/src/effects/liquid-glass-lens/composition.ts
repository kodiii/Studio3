/**
 * The sample backdrop: a proof sheet for a fictional optics quarterly, laid out once in design units and rendered
 * twice from the same items — with canvas2d into the lens texture, and as SVG for the no-WebGL fallback — in the
 * current theme's tokens. Large type, colour fields, hairline grid and print marks give the glass something to bend.
 */

export interface Palette {
  paper: string; paper2: string; ink: string; muted: string; line: string;
  signal: string; onSignal: string; blue: string; green: string; ochre: string; magenta: string;
  /** The surface is dark (dark theme or an always-dark stage). */
  dark: boolean;
}
export interface Fonts { display: string; text: string; serif: string; mono: string }
export interface Theme { palette: Palette; fonts: Fonts }

type Rgba = [number, number, number, number];
let probe: CanvasRenderingContext2D | null | undefined;
const ctx2d = () => (probe === undefined ? (probe = document.createElement('canvas').getContext('2d')) : probe);

/** Any CSS colour → [r, g, b, a] (0–255, alpha 0–1), normalised by the browser's own parser. */
export function toRgba(css: string): Rgba {
  const g = ctx2d();
  if (!g) return [0, 0, 0, 1];
  g.fillStyle = '#000';
  g.fillStyle = css;
  const v = String(g.fillStyle);
  if (v.startsWith('#')) return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16), 1];
  const m = v.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 1];
  return [m[0], m[1], m[2], m[3] ?? 1];
}
const hex = ([r, g, b]: Rgba) => `#${[r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`;
/** `a` mixed toward `b` by t, as an opaque hex colour. */
export const mix = (a: string, b: string, t: number): string => {
  const x = toRgba(a), y = toRgba(b);
  return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t, 1]);
};
/** WCAG relative luminance of a CSS colour. */
export function luminance(css: string): number {
  const [r, g, b] = toRgba(css);
  const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Theme tokens as resolved on `el` (inherits the gallery or app theme), with the contract's fallbacks. */
export function readTheme(el: Element): Theme {
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  const paper = v('--mk-surface', '#fbf9f4');
  return {
    palette: {
      paper, paper2: v('--mk-surface-2', '#e9e5da'), ink: v('--mk-ink', '#11110f'), muted: v('--mk-ink-muted', '#5c5a52'),
      line: v('--mk-line', '#11110f24'), signal: v('--mk-signal', '#bf2f09'), onSignal: v('--mk-on-signal', '#ffffff'),
      blue: v('--mk-accent-product', '#2446d8'), green: v('--mk-accent-data', '#0a6e4d'), ochre: v('--mk-accent-3d', '#8a5a00'),
      magenta: v('--mk-accent-social', '#b8166f'), dark: luminance(paper) < 0.2,
    },
    fonts: {
      display: v('--mk-font-display', 'ui-sans-serif, system-ui, sans-serif'), text: v('--mk-font-text', 'ui-sans-serif, system-ui, sans-serif'),
      serif: v('--mk-font-serif', 'Georgia, serif'), mono: v('--mk-font-mono', 'ui-monospace, monospace'),
    },
  };
}

/** Faces the composition uses; resolve them before drawing so the texture never bakes a fallback font. */
export const compositionFonts = (f: Fonts): string[] => [`800 100px ${f.display}`, `italic 400 100px ${f.serif}`, `500 20px ${f.mono}`, `400 20px ${f.text}`];

export type Align = 'left' | 'center' | 'right';
export interface TextItem {
  k: 'text'; x: number; y: number; text: string; family: string; size: number; weight: number;
  italic?: boolean; /** em */ tracking: number; fill: string; align: Align;
}
export type Item =
  | { k: 'rect'; x: number; y: number; w: number; h: number; fill: string }
  | { k: 'grid'; w: number; h: number; step: number; every: number; minor: string; major: string }
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; width: number }
  | { k: 'reg'; cx: number; cy: number; r: number; stroke: string }
  /** A disc with horizontal bars knocked out of its lower half. */
  | { k: 'sun'; cx: number; cy: number; r: number; fill: string; bars: readonly [number, number][]; barFill: string }
  /** Halftone ramp: dots growing left → right. */
  | { k: 'dots'; x: number; y: number; w: number; h: number; step: number; r0: number; r1: number; fill: string }
  | TextItem;
export interface Composition { width: number; height: number; items: readonly Item[] }

/** Font shorthand for canvas and measuring. */
export const fontOf = (t: Pick<TextItem, 'family' | 'size' | 'weight' | 'italic'>) => `${t.italic ? 'italic ' : ''}${t.weight} ${t.size}px ${t.family}`;

export interface Measure { width(text: string, font: string): number; capHeight(font: string): number }
export function canvasMeasure(): Measure {
  return {
    width: (text, font) => { const g = ctx2d(); if (!g) return text.length * 10; g.font = font; return g.measureText(text).width; },
    capHeight: (font) => { const g = ctx2d(); if (!g) return 70; g.font = font; return g.measureText('H').actualBoundingBoxAscent || 70; },
  };
}

const HEADLINE = ['Light, bent', 'through thick glass.'];
const BODY = [
  'A thick lens bends whatever it crosses. Where the surface curves, light slows, turns and opens into its colours; over the flat centre it passes almost untouched.',
  'Read the page through it: the rim gathers rules, type and colour into one bright edge, while the shadow falls away from the light, softer the higher the glass is held.',
];

/** Greedy word wrap with the real font metrics. */
function wrap(text: string, font: string, width: number, m: Measure): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && m.width(next, font) > width) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** Largest size at which `text` fits `width` (tracking included), capped at `max`. */
function fit(text: string, family: string, weight: number, tracking: number, width: number, max: number, m: Measure): number {
  const ref = 100;
  const w = m.width(text, `${weight} ${ref}px ${family}`) + tracking * ref * (text.length - 1);
  return Math.min(max, (width / Math.max(1, w)) * ref);
}

/**
 * Lay out the proof sheet for a stage of the given aspect ratio (width / height): a landscape spread, or a portrait
 * page below 1. Everything is in design units; renderers scale the result to cover the stage.
 */
export function compose(aspect: number, { palette: p, fonts: f }: Theme, m: Measure): Composition {
  const portrait = aspect < 1.02;
  const W = portrait ? 400 : 1000;
  const H = portrait ? 500 : 562;
  const M = portrait ? 22 : 40;
  const items: Item[] = [];
  const text = (t: Omit<TextItem, 'k'>) => items.push({ k: 'text', ...t });
  const mono = (s: string, x: number, y: number, align: Align, fill = p.muted, size = portrait ? 8.5 : 10) =>
    text({ x, y, text: s.toUpperCase(), family: f.mono, size, weight: 500, tracking: 0.12, fill, align });

  items.push({ k: 'rect', x: 0, y: 0, w: W, h: H, fill: p.paper });
  items.push({ k: 'grid', w: W, h: H, step: portrait ? 25 : 40, every: 4, minor: mix(p.paper, p.ink, p.dark ? 0.09 : 0.06), major: mix(p.paper, p.ink, p.dark ? 0.17 : 0.13) });

  // Masthead and its rule.
  const top = portrait ? 30 : 34;
  mono('Optics & Matter', M + 14, top, 'left', p.ink);
  if (!portrait) mono('Nº 07 — The light issue', W / 2, top, 'center');
  mono('Sample composition', W - M - 14, top, 'right');
  items.push({ k: 'line', x1: M, y1: top + 12, x2: W - M, y2: top + 12, stroke: p.ink, width: 1 });

  // Colour field: the sun, with bars knocked out of its lower half.
  const sun = portrait ? { cx: 300, cy: 142, r: 78 } : { cx: 772, cy: 198, r: 134 };
  const bars: [number, number][] = [];
  for (let k = 0, y = sun.cy + sun.r * 0.12; k < 7 && y < sun.cy + sun.r; k++) {
    const h = sun.r * (0.018 + k * 0.014);
    bars.push([y, h]);
    y += h + sun.r * (0.115 - k * 0.006);
  }
  items.push({ k: 'sun', ...sun, fill: p.signal, bars, barFill: p.paper });
  mono(portrait ? 'Fig. 1 — n = 1.52' : 'Fig. 1 — one light, one lens, n = 1.52', sun.cx + sun.r, sun.cy + sun.r + (portrait ? 16 : 22), 'right');

  // Headline in the serif italic, then two narrow columns of body copy.
  const hSize = portrait ? 34 : 54;
  const hLines = portrait ? ['Light,', 'bent through', 'thick glass.'] : HEADLINE;
  const hTop = portrait ? 92 : 124;
  hLines.forEach((s, i) => text({ x: M, y: hTop + i * hSize * (portrait ? 1.02 : 1.0), text: s, family: f.serif, size: hSize, weight: 400, italic: true, tracking: -0.01, fill: p.ink, align: 'left' }));

  const bSize = portrait ? 10.5 : 12;
  const bLead = bSize * 1.45;
  const bFont = `400 ${bSize}px ${f.text}`;
  const bTop = portrait ? 264 : 248;
  const cols = portrait ? [{ x: M, w: W - 2 * M, s: BODY[0] }] : [{ x: M, w: 212, s: BODY[0] }, { x: M + 236, w: 212, s: BODY[1] }];
  for (const c of cols) wrap(c.s, bFont, c.w, m).slice(0, portrait ? 4 : 6).forEach((s, i) => text({ x: c.x, y: bTop + i * bLead, text: s, family: f.text, size: bSize, weight: 400, tracking: 0, fill: p.muted, align: 'left' }));

  // The display word: as wide as the measure allows while its caps stay clear of the sun.
  const word = 'Refract';
  const baseline = portrait ? 428 : 498;
  const room = baseline - (portrait ? bTop + 4 * bLead + 4 : sun.cy + sun.r + 34);
  const capRatio = m.capHeight(`800 100px ${f.display}`) / 100;
  const dSize = fit(word, f.display, 800, -0.045, W - 2 * M, room / Math.max(0.5, capRatio), m);
  text({ x: M - dSize * 0.02, y: baseline, text: word, family: f.display, size: dSize, weight: 800, tracking: -0.045, fill: p.ink, align: 'left' });

  // Print furniture: colour bar of theme tokens, halftone ramp, ruler, registration marks.
  const barY = portrait ? 448 : 520;
  const sw = portrait ? 22 : 30, sh = portrait ? 12 : 14;
  const swatches = [p.ink, mix(p.ink, p.paper, 0.4), mix(p.ink, p.paper, 0.72), p.signal, mix(p.signal, p.paper, 0.5), p.blue, p.green, p.ochre, p.magenta, p.paper2];
  swatches.forEach((fill, i) => items.push({ k: 'rect', x: M + i * sw, y: barY, w: sw - 2, h: sh, fill }));
  const afterBar = M + swatches.length * sw + (portrait ? 10 : 18);
  items.push({ k: 'dots', x: afterBar, y: barY, w: portrait ? W - M - afterBar : 150, h: sh, step: portrait ? 5 : 6, r0: 0.35, r1: portrait ? 2.3 : 2.8, fill: p.ink });
  if (!portrait) {
    const rx = afterBar + 168, rw = W - M - rx;
    items.push({ k: 'line', x1: rx, y1: barY + sh, x2: rx + rw, y2: barY + sh, stroke: p.ink, width: 1 });
    for (let x = 0, i = 0; x <= rw + 0.01; x += 5, i++) items.push({ k: 'line', x1: rx + x, y1: barY + sh, x2: rx + x, y2: barY + sh - (i % 10 === 0 ? 14 : i % 2 === 0 ? 8 : 4), stroke: p.ink, width: 1 });
    for (let x = 0, n = 0; x <= rw + 0.01; x += 50, n++) mono(String(n), rx + x + 3, barY + 6, 'left', p.muted, 8);
  }
  mono(portrait ? 'Theme tokens' : 'Colour bar · theme tokens', M, barY + sh + (portrait ? 15 : 18), 'left');
  const reg = portrait ? 12 : 16;
  for (const [cx, cy] of [[reg, reg], [W - reg, reg], [reg, H - reg], [W - reg, H - reg]]) items.push({ k: 'reg', cx, cy, r: portrait ? 4.5 : 6, stroke: p.ink });

  return { width: W, height: H, items };
}

/** Cover-fit transform from design units to a stage of cssW × cssH (centred, like SVG `xMidYMid slice`). */
export function coverTransform(cssW: number, cssH: number, c: Composition) {
  const s = Math.max(cssW / c.width, cssH / c.height);
  return { s, ox: (cssW - c.width * s) / 2, oy: (cssH - c.height * s) / 2 };
}

/** Draw the composition with canvas2d, covering a cssW × cssH area (the caller sets any device-pixel scale first). */
export function drawComposition(g: CanvasRenderingContext2D, cssW: number, cssH: number, c: Composition): void {
  const { s, ox, oy } = coverTransform(cssW, cssH, c);
  g.save();
  g.transform(s, 0, 0, s, ox, oy);
  const tracked = 'letterSpacing' in g;
  for (const it of c.items) {
    switch (it.k) {
      case 'rect': g.fillStyle = it.fill; g.fillRect(it.x, it.y, it.w, it.h); break;
      case 'grid': {
        const hair = 1 / s; // one device-independent pixel, whatever the scale
        for (let i = 0, x = 0; x <= it.w; x += it.step, i++) { g.fillStyle = i % it.every ? it.minor : it.major; g.fillRect(x - hair / 2, 0, hair, it.h); }
        for (let i = 0, y = 0; y <= it.h; y += it.step, i++) { g.fillStyle = i % it.every ? it.minor : it.major; g.fillRect(0, y - hair / 2, it.w, hair); }
        break;
      }
      case 'line': g.strokeStyle = it.stroke; g.lineWidth = it.width; g.beginPath(); g.moveTo(it.x1, it.y1); g.lineTo(it.x2, it.y2); g.stroke(); break;
      case 'reg':
        g.strokeStyle = it.stroke; g.lineWidth = 0.9;
        g.beginPath(); g.arc(it.cx, it.cy, it.r, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.moveTo(it.cx - it.r * 1.8, it.cy); g.lineTo(it.cx + it.r * 1.8, it.cy); g.moveTo(it.cx, it.cy - it.r * 1.8); g.lineTo(it.cx, it.cy + it.r * 1.8); g.stroke();
        break;
      case 'sun':
        g.save();
        g.beginPath(); g.arc(it.cx, it.cy, it.r, 0, Math.PI * 2); g.fillStyle = it.fill; g.fill(); g.clip();
        g.fillStyle = it.barFill;
        for (const [y, h] of it.bars) g.fillRect(it.cx - it.r, y, it.r * 2, h);
        g.restore();
        break;
      case 'dots': {
        g.fillStyle = it.fill;
        const cols = Math.floor(it.w / it.step), rows = Math.max(1, Math.floor(it.h / it.step));
        for (let i = 0; i <= cols; i++) {
          const r = it.r0 + (it.r1 - it.r0) * (i / Math.max(1, cols));
          for (let j = 0; j < rows; j++) { g.beginPath(); g.arc(it.x + i * it.step, it.y + (j + 0.5) * (it.h / rows), r, 0, Math.PI * 2); g.fill(); }
        }
        break;
      }
      case 'text':
        g.font = fontOf(it);
        g.fillStyle = it.fill;
        g.textAlign = it.align;
        g.textBaseline = 'alphabetic';
        if (tracked) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${it.tracking * it.size}px`;
        g.fillText(it.text, it.x, it.y);
        break;
    }
  }
  if (tracked) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
  g.restore();
}
