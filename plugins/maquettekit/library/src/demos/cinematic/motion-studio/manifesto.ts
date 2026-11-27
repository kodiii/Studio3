/**
 * The light table under the glass: Lead & Lag's manifesto, "Nothing stops dead.", set as a staircase the studio's
 * ball bounces down (onion-skinned, shot on twos) until it lands as the full stop, with the animator's furniture
 * around it: a 12-field guide, peg holes, an easing graph, a spring response, a spacing chart and a timeline.
 *
 * Laid out once in design units from the current theme tokens and the stage's aspect ratio, then rendered twice
 * from the same items: canvas2d for the lens texture and SVG for the no-WebGL fallback and the loading poster.
 * The diagrams plot the motion tokens this page really uses (emphasized easing, spring.pop), not invented numbers.
 */
import { easing, spring } from '../../../motion';

export interface Palette {
  paper: string; paper2: string; ink: string; muted: string; line: string; signal: string;
  /** Dark surface (night palette or dark theme). */
  dark: boolean;
}
export interface Fonts { display: string; text: string; serif: string; mono: string }
export interface Theme { palette: Palette; fonts: Fonts }

type Rgba = [number, number, number, number];
let probe: CanvasRenderingContext2D | null | undefined;
const ctx2d = (): CanvasRenderingContext2D | null => (probe === undefined ? (probe = document.createElement('canvas').getContext('2d')) : probe);

/** Any CSS colour → [r, g, b, a], normalised by the browser's own parser. */
function toRgba(css: string): Rgba {
  const g = ctx2d();
  if (!g) return [0, 0, 0, 1];
  g.fillStyle = '#000';
  g.fillStyle = css;
  const v = String(g.fillStyle);
  if (v.startsWith('#')) return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16), 1];
  const m = v.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 1];
  return [m[0], m[1], m[2], m[3] ?? 1];
}
const hex = ([r, g, b]: Rgba): string => `#${[r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`;
/** `a` mixed toward `b` by t, as an opaque hex colour. */
export function mix(a: string, b: string, t: number): string {
  const x = toRgba(a), y = toRgba(b);
  return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t, 1]);
}
function luminance(css: string): number {
  const [r, g, b] = toRgba(css);
  const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Theme tokens as resolved on `el` (the demo's own day or night palette), with the contract's fallbacks. */
export function readTheme(el: Element): Theme {
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  const paper = v('--mk-surface', '#fbf9f4');
  return {
    palette: {
      paper, paper2: v('--mk-surface-2', '#e9e5da'), ink: v('--mk-ink', '#11110f'), muted: v('--mk-ink-muted', '#5c5a52'),
      line: v('--mk-line', '#11110f24'), signal: v('--mk-signal', '#bf2f09'), dark: luminance(paper) < 0.2,
    },
    fonts: {
      display: v('--mk-font-display', 'ui-sans-serif, system-ui, sans-serif'), text: v('--mk-font-text', 'ui-sans-serif, system-ui, sans-serif'),
      serif: v('--mk-font-serif', 'Georgia, serif'), mono: v('--mk-font-mono', 'ui-monospace, monospace'),
    },
  };
}

/** Faces the composition draws with: load them before the texture is drawn so it never bakes a fallback font. */
export const manifestoFonts = (f: Fonts): string[] => [`800 100px ${f.display}`, `italic 400 100px ${f.serif}`, `500 20px ${f.mono}`];

export type Align = 'left' | 'center' | 'right';
export interface TextItem {
  k: 'text'; x: number; y: number; text: string; family: string; size: number; weight: number;
  italic?: boolean; /** em */ tracking: number; fill: string; align: Align; alpha?: number;
}
interface Paint { fill?: string; stroke?: string; width?: number; alpha?: number; dash?: readonly number[] }
export type Item =
  | ({ k: 'rect'; x: number; y: number; w: number; h: number; r?: number } & Paint)
  /** Light-table glow: an elliptical radial gradient. */
  | { k: 'glow'; cx: number; cy: number; rx: number; ry: number; from: string; to: string }
  | ({ k: 'path'; d: string; cap?: 'round' | 'butt' } & Paint)
  | ({ k: 'circle'; cx: number; cy: number; r: number } & Paint)
  | ({ k: 'ellipse'; cx: number; cy: number; rx: number; ry: number; /** deg */ rot: number } & Paint)
  /** Text set round a circle, clockwise from `start` (deg, 0 = top). */
  | { k: 'ring'; cx: number; cy: number; r: number; text: string; family: string; size: number; weight: number; tracking: number; fill: string; start: number; alpha?: number }
  | TextItem;
export interface Composition { width: number; height: number; items: readonly Item[] }

export const fontOf = (t: { family: string; size: number; weight: number; italic?: boolean }): string =>
  `${t.italic ? 'italic ' : ''}${t.weight} ${t.size}px ${t.family}`;

interface Measure {
  width(text: string, font: string, tracking?: number, size?: number): number;
  /** Ascent of a glyph above the baseline (cap height for "H", x-height for "x"). */
  ascent(glyph: string, font: string): number;
}
function canvasMeasure(): Measure {
  return {
    width: (text, font, tracking = 0, size = 0) => {
      const g = ctx2d();
      const raw = g ? ((g.font = font), g.measureText(text).width) : text.length * 10;
      return raw + tracking * size * Math.max(0, text.length - 1);
    },
    ascent: (glyph, font) => { const g = ctx2d(); if (!g) return 70; g.font = font; return g.measureText(glyph).actualBoundingBoxAscent || 70; },
  };
}

const f1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Cubic bezier easing (CSS semantics) sampled at x, by bisection on the x polynomial. */
function bezierAt([x1, y1, x2, y2]: readonly number[], x: number): number {
  const bx = (t: number) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  const by = (t: number) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (bx(m) < x) lo = m; else hi = m; }
  return by((lo + hi) / 2);
}

/** Step response of a damped spring (Motion semantics), position at t seconds; target 1. */
function springAt(c: { stiffness: number; damping: number; mass: number }, t: number): number {
  const w0 = Math.sqrt(c.stiffness / c.mass), z = c.damping / (2 * Math.sqrt(c.stiffness * c.mass));
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
  }
  return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
}

interface Pt { x: number; y: number }
interface Ghost extends Pt { vx: number; vy: number; contact?: number; frame: number }

/**
 * One parabolic hop from P to Q under gravity g (units per frame²), rising `h` above P first. Samples every `step`
 * frames from `t0` (frames already elapsed), excluding Q itself.
 */
function hop(P: Pt, Q: Pt, h: number, g: number, step: number, t0: number, out: Ghost[]): number {
  const v0 = Math.sqrt(2 * g * h);
  const ta = v0 / g;
  const drop = h + (Q.y - P.y);
  const T = ta + Math.sqrt(Math.max(0, 2 * drop / g));
  const first = Math.ceil(t0 / step) * step - t0;
  for (let t = first; t < T - 0.35; t += step) {
    out.push({ x: P.x + ((Q.x - P.x) * t) / T, y: P.y - v0 * t + 0.5 * g * t * t, vx: (Q.x - P.x) / T, vy: -v0 + g * t, frame: Math.round(t0 + t) + 1 });
  }
  return t0 + T;
}

/**
 * Lay out the sheet at the stage's aspect ratio (width / height) so cover-fitting never crops its marks: a landscape
 * sheet 600 units tall whose width follows the aspect, or below 1.15 a portrait sheet 400 units wide.
 */
export function composeManifesto(aspect: number, { palette: p, fonts: f }: Theme, words: readonly [string, string, string]): Composition {
  const m = canvasMeasure();
  const portrait = aspect < 1.15;
  const W = portrait ? 400 : Math.round(clamp(600 * aspect, 690, 1700));
  const H = portrait ? Math.round(clamp(400 / aspect, 360, 780)) : 600;
  const M = portrait ? 22 : 46;
  const items: Item[] = [];
  const faint = mix(p.paper, p.ink, p.dark ? 0.1 : 0.075);
  const hair = mix(p.paper, p.ink, p.dark ? 0.2 : 0.16);
  const mono = (s: string, x: number, y: number, align: Align, fill = p.muted, size = portrait ? 8.5 : 10.5, alpha?: number) =>
    items.push({ k: 'text', x, y, text: s.toUpperCase(), family: f.mono, size, weight: 500, tracking: 0.12, fill, align, alpha });

  // Paper on a light table: brighter where the lamp underneath is, falling off to the edges.
  items.push({ k: 'rect', x: 0, y: 0, w: W, h: H, fill: p.paper });
  items.push({ k: 'glow', cx: W * 0.42, cy: H * 0.5, rx: W * 0.62, ry: H * 0.78, from: mix(p.paper, '#ffffff', p.dark ? 0.06 : 0.6), to: p.paper });

  // 12-field guide: nested frames round the centre, numbered every second field.
  const fgc = { x: W / 2, y: H / 2 + (portrait ? 0 : 8) };
  const ratio = portrait ? 3 / 4 : 16 / 9;
  for (let k = 1; k <= 6; k++) {
    const h = (H - (portrait ? 70 : 90)) * (k / 6);
    const w = h * ratio;
    if (w > W - 2 * M + 1) continue;
    items.push({ k: 'rect', x: f1(fgc.x - w / 2), y: f1(fgc.y - h / 2), w: f1(w), h: f1(h), stroke: faint, width: 1 });
    mono(String(k * 2), fgc.x + w / 2 - 4, fgc.y - h / 2 + 11, 'right', hair, portrait ? 7 : 8);
  }
  items.push({ k: 'path', d: `M${fgc.x - 9} ${fgc.y}H${fgc.x + 9}M${fgc.x} ${fgc.y - 9}V${fgc.y + 9}`, stroke: hair, width: 1 });

  // Peg holes punched through the sheet: the lamp shines through them.
  const pegY = portrait ? 11 : 15;
  const hole = mix(p.paper, '#ffffff', p.dark ? 0.16 : 0.85);
  const rim = mix(p.paper, p.ink, p.dark ? 0.35 : 0.22);
  const pegGap = portrait ? 46 : 70;
  items.push({ k: 'circle', cx: W / 2, cy: pegY + 6, r: portrait ? 4.5 : 6, fill: hole, stroke: rim, width: 1 });
  for (const s of [-1, 1]) items.push({ k: 'rect', x: W / 2 + s * pegGap - (portrait ? 11 : 16), y: pegY + (portrait ? 2 : 1.5), w: portrait ? 22 : 32, h: portrait ? 8 : 9, r: portrait ? 4 : 4.5, fill: hole, stroke: rim, width: 1 });

  // Sheet header and its rule.
  const top = portrait ? 38 : 46;
  mono(portrait ? 'Lead & Lag · sheet 01' : 'Lead & Lag — sheet 01 · manifesto', M, top, 'left', p.ink);
  mono(portrait ? '24 fps' : 'Sc 01 · take 03 · 24 fps', W - M, top, 'right');
  items.push({ k: 'path', d: `M${M} ${top + 10}H${W - M}`, stroke: p.ink, width: 1, alpha: 0.85 });

  // ── The staircase: each line ends further right, so the ball can bounce down the steps. ──────────────────────
  const disp = (size: number) => ({ family: f.display, size, weight: 800 });
  const ital = (size: number) => ({ family: f.serif, size, weight: 400, italic: true });
  const SERIF = 1.2;
  const per = { d: m.width(words[0], fontOf(disp(100)), -0.035, 100) / 100, s: m.width(words[1], fontOf(ital(100 * SERIF)), -0.01, 100 * SERIF) / 100, e: m.width(words[2].replace(/\.$/, ''), fontOf(disp(100)), -0.035, 100) / 100 };
  const capR = m.ascent('H', fontOf(disp(100))) / 100;
  const xhD = m.ascent('x', fontOf(disp(100))) / 100;
  const ascD = m.ascent('d', fontOf(disp(100))) / 100;
  const xhS = m.ascent('x', fontOf(ital(100 * SERIF))) / 100;
  const step = 1; // each line ends this many em further right than the one above: the ball's steps
  // Line ends (em from the left margin): E1 = w1, E2 = E1 + step, E3 = E2 + step (+ the full stop).
  const ballR = 0.088;
  const ends = { e1: per.d, e2: per.d + step, e3: per.d + 2 * step };
  const blockW = ends.e3 + 0.06 + ballR * 2 + 0.05;
  const colW = portrait ? 0 : clamp(W * 0.25, 240, 340);
  const textRight = portrait ? W - M : W - M - colW - 56;
  const lead = 0.93;
  const headTop = top + (portrait ? 40 : 44);
  const roomH = portrait ? H * 0.5 : H - headTop - 96;
  const S = Math.max(24, Math.min((textRight - M) / blockW, roomH / (capR + 2 * lead + 0.22)));
  const b1 = headTop + capR * S;
  const b2 = b1 + lead * S;
  const b3 = b2 + lead * S;
  const x1 = M - 0.02 * S;
  const x2 = M + (ends.e2 - per.s) * S;
  const x3 = M + (ends.e3 - per.e) * S;
  items.push({ k: 'text', x: x1, y: b1, text: words[0], ...disp(S), tracking: -0.035, fill: p.ink, align: 'left' });
  items.push({ k: 'text', x: x2, y: b2, text: words[1], ...ital(S * SERIF), tracking: -0.01, fill: p.ink, align: 'left' });
  items.push({ k: 'text', x: x3, y: b3, text: words[2].replace(/\.$/, ''), ...disp(S), tracking: -0.035, fill: p.ink, align: 'left' });

  // ── The ball drops in past the end of "Nothing", bounces off the last "s", then the "d", and lands as the stop. ─
  const r = ballR * S;
  const C1 = { x: M + (ends.e2 - 0.19) * S, y: b2 - xhS * S - r };
  const C2 = { x: M + (ends.e3 - 0.17) * S, y: b3 - ascD * S - r };
  const R = { x: M + (ends.e3 + 0.06) * S + r, y: b3 - r };
  const g = 0.021 * S; // a fall of one em takes about ten frames
  const start = { x: M + (ends.e1 + 0.16) * S, y: top + 22 + r };
  const ghosts: Ghost[] = [];
  const EVERY = 3; // one drawing every third frame keeps the onion skin legible
  let t = hop(start, C1, 0, g, EVERY, 0, ghosts);
  ghosts.push({ ...C1, vx: 0, vy: 0, contact: b2 - xhS * S, frame: Math.round(t) + 1 });
  t = hop(C1, C2, 0.42 * S, g, EVERY, t, ghosts);
  ghosts.push({ ...C2, vx: 0, vy: 0, contact: b3 - ascD * S, frame: Math.round(t) + 1 });
  t = hop(C2, R, 0.14 * S, g, EVERY, t, ghosts);
  const visible = ghosts;
  // The arc, dashed through every drawing.
  const arc = [...visible, { ...R }].map((q, i) => `${i ? 'L' : 'M'}${f1(q.x)} ${f1(q.y)}`).join('');
  items.push({ k: 'path', d: arc, stroke: p.muted, width: 1, dash: [3, 4], alpha: 0.7 });
  const n = visible.length;
  visible.forEach((q, i) => {
    const a = 0.34 + 0.5 * (i / Math.max(1, n - 1));
    const paint = { fill: p.paper, stroke: p.ink, width: portrait ? 1 : 1.3, alpha: a };
    if (q.contact !== undefined) {
      // Contact: squashed flat against the letter it lands on, wider than it is tall.
      items.push({ k: 'ellipse', cx: f1(q.x), cy: f1(q.contact - r * 0.7), rx: f1(r * 1.32), ry: f1(r * 0.7), rot: 0, ...paint });
      items.push({ k: 'path', d: `M${f1(q.x + r * 1.9)} ${f1(q.contact - r * 2.2)}l${f1(r * 0.42)} ${f1(r * 0.42)} ${f1(-r * 0.42)} ${f1(r * 0.42)} ${f1(-r * 0.42)} ${f1(-r * 0.42)}z`, fill: p.signal });
    } else {
      // In flight: stretched along the velocity, more so the faster it falls.
      const speed = Math.hypot(q.vx, q.vy) / (g * 10);
      const st = clamp(speed * 0.15, 0, 0.28);
      const rot = (Math.atan2(q.vy, q.vx) * 180) / Math.PI;
      items.push({ k: 'ellipse', cx: f1(q.x), cy: f1(q.y), rx: f1(r * (1 + st)), ry: f1(r / (1 + st)), rot: f1(rot), ...paint });
    }
    if (i % 2 === 0 && q.contact === undefined) mono(String(q.frame).padStart(2, '0'), q.x + r * 1.55, q.y - r * 0.9, 'left', p.muted, portrait ? 6.5 : 8);
  });

  // Fig. 0 and the studio stamp, in the pocket under "Nothing" and left of the stairs.
  const pocketX = M;
  const pocketR = M + (ends.e2 - per.s) * S - 18;
  if (pocketR - pocketX > (portrait ? 110 : 200)) {
    const ny = b1 + (portrait ? 0.62 : 0.55) * S;
    const sz = portrait ? 6.8 : 9.5;
    mono('Fig. 0 — the full stop', pocketX, ny, 'left', p.ink, sz);
    mono(portrait ? 'one ball · two contacts' : 'one ball · two contacts · one hold', pocketX, ny + sz * 1.75, 'left', p.muted, sz);
    if (!portrait) mono('squash on contact, stretch in flight', pocketX, ny + sz * 3.5, 'left', p.muted, sz);
  }
  // The full stop: settled, round, with a soft contact shadow falling away from the upper-left lamp.
  items.push({ k: 'ellipse', cx: f1(R.x + r * 0.22), cy: f1(b3 + r * 0.08), rx: f1(r * 1.05), ry: f1(r * 0.2), rot: 0, fill: p.ink, alpha: p.dark ? 0.5 : 0.2 });
  items.push({ k: 'circle', cx: f1(R.x), cy: f1(R.y), r: f1(r), fill: p.signal });
  const hold = `${String(Math.round(t) + 1).padStart(2, '0')} · hold`;
  const holdSize = portrait ? 6.5 : 8;
  if (R.x + r * 1.8 + m.width(hold.toUpperCase(), `500 ${holdSize}px ${f.mono}`, 0.12, holdSize) < W - M) mono(hold, R.x + r * 1.8, R.y + r * 0.4, 'left', p.signal, holdSize);
  else mono(hold, R.x + r, b3 + holdSize * 1.9, 'right', p.signal, holdSize);

  // ── Diagrams: the tokens this page moves with. ─────────────────────────────────────────────────────────────────
  const curve = (x0: number, y0: number, w: number, h: number, fn: (u: number) => number, samples = 48) => {
    let d = '';
    for (let i = 0; i <= samples; i++) { const u = i / samples; d += `${i ? 'L' : 'M'}${f1(x0 + u * w)} ${f1(y0 + h - fn(u) * h)}`; }
    return d;
  };
  const easingFig = (x0: number, y0: number, b: number, small: boolean) => {
    for (let i = 1; i < 4; i++) items.push({ k: 'path', d: `M${f1(x0 + (b * i) / 4)} ${y0}V${y0 + b}M${x0} ${f1(y0 + (b * i) / 4)}H${x0 + b}`, stroke: faint, width: 1 });
    items.push({ k: 'path', d: `M${x0} ${y0}V${y0 + b}H${x0 + b}`, stroke: p.ink, width: 1 });
    const [ax, ay, bx, by] = easing.emphasized;
    const P1 = { x: x0 + ax * b, y: y0 + b - ay * b }, P2 = { x: x0 + bx * b, y: y0 + b - by * b };
    items.push({ k: 'path', d: `M${x0} ${y0 + b}L${f1(P1.x)} ${f1(P1.y)}M${x0 + b} ${y0}L${f1(P2.x)} ${f1(P2.y)}`, stroke: p.signal, width: 1.2 });
    items.push({ k: 'path', d: curve(x0, y0, b, b, (u) => bezierAt(easing.emphasized, u)), stroke: p.ink, width: small ? 1.6 : 2.2, cap: 'round' });
    for (const q of [P1, P2]) items.push({ k: 'circle', cx: f1(q.x), cy: f1(q.y), r: small ? 2.6 : 3.4, fill: p.paper, stroke: p.signal, width: 1.4 });
    for (const q of [{ x: x0, y: y0 + b }, { x: x0 + b, y: y0 }]) items.push({ k: 'circle', cx: q.x, cy: q.y, r: small ? 2.4 : 3, fill: p.ink });
    mono(small ? 'Fig. 1 — ease' : 'Fig. 1 — ease · emphasized', x0, y0 - 10, 'left', p.ink, small ? 7 : 9);
    mono(easing.emphasized.join(', '), x0, y0 + b + (small ? 13 : 17), 'left', p.muted, small ? 7 : 9);
  };
  const springFig = (x0: number, y0: number, w: number, h: number, small: boolean) => {
    const c = spring.pop;
    const T = 0.9;
    const peak = Math.max(...Array.from({ length: 200 }, (_, i) => springAt(c, (i / 199) * T)));
    const top1 = y0 + h * 0.18; // the target line sits below the top so the overshoot has room
    const k = (h - (top1 - y0)) / 1; // units per 1.0 of travel
    const yOf = (v: number) => y0 + h - v * k;
    items.push({ k: 'path', d: `M${x0} ${y0}V${y0 + h}H${x0 + w}`, stroke: p.ink, width: 1 });
    items.push({ k: 'path', d: `M${x0} ${f1(yOf(1))}H${x0 + w}`, stroke: p.muted, width: 1, dash: [4, 4] });
    let d = '';
    for (let i = 0; i <= 90; i++) { const u = i / 90; d += `${i ? 'L' : 'M'}${f1(x0 + u * w)} ${f1(yOf(springAt(c, u * T)))}`; }
    items.push({ k: 'path', d, stroke: p.signal, width: small ? 1.6 : 2.2, cap: 'round' });
    const over = Math.round((peak - 1) * 100);
    mono(small ? 'Fig. 2 — spring.pop' : 'Fig. 3 — spring.pop · overshoot', x0, y0 - 10, 'left', p.ink, small ? 7 : 9);
    mono(`k ${c.stiffness} · c ${c.damping} · m ${c.mass}${small ? '' : ` · +${over}%`}`, x0, y0 + h + (small ? 13 : 17), 'left', p.muted, small ? 7 : 9);
  };
  const spacingFig = (x0: number, y0: number, len: number) => {
    // Timing chart: nine drawings between two keys, eased (slow out), the breakdown marked.
    items.push({ k: 'path', d: `M${x0} ${y0}V${y0 + len}`, stroke: p.ink, width: 1 });
    for (let i = 0; i <= 8; i++) {
      const y = y0 + bezierAt(easing.emphasized, i / 8) * len;
      const key = i === 0 || i === 8;
      items.push({ k: 'path', d: `M${x0 - (key ? 9 : 6)} ${f1(y)}H${x0 + (key ? 9 : 6)}`, stroke: key ? p.signal : p.ink, width: key ? 1.6 : 1 });
      if (key) items.push({ k: 'circle', cx: x0 + 21, cy: f1(y), r: 7, stroke: p.signal, width: 1.1 });
      if (key) mono(i === 0 ? '1' : '9', x0 + 21, y + 3.2, 'center', p.signal, 8);
    }
    mono('Fig. 2', x0 - 4, y0 - 10, 'left', p.ink, 9);
    mono('spacing', x0 - 4, y0 + len + 17, 'left', p.muted, 9);
  };

  if (!portrait) {
    const cx0 = W - M - colW;
    const b = clamp(colW * 0.44, 104, 140);
    easingFig(cx0, headTop + 22, b, false);
    spacingFig(cx0 + b + clamp(colW * 0.2, 44, 70), headTop + 22, b);
    springFig(cx0, headTop + 22 + b + 74, colW, clamp(H * 0.15, 72, 98), false);
  } else {
    const yRow = b3 + S * 0.55 + 24;
    const room = H - 72 - yRow;
    if (room > 88) {
      const b = clamp(Math.min(room - 34, (W - 2 * M) * 0.3), 60, 104);
      easingFig(M + 2, yRow, b, true);
      springFig(M + b + 34, yRow, W - 2 * M - b - 36, b * 0.8, true);
    }
  }

  // A rubber stamp: honest about the studio, set round a circle and turned against the grid.
  const stampR = portrait ? 25 : 46;
  const stamp = { x: M + stampR + 4, y: b3 - (portrait ? 0.2 : 0.42) * S };
  if (M + (ends.e3 - per.e) * S - (stamp.x + stampR) > 12) {
    items.push({ k: 'circle', cx: f1(stamp.x), cy: f1(stamp.y), r: stampR, stroke: p.signal, width: portrait ? 1.2 : 1.6, alpha: 0.82 });
    items.push({ k: 'circle', cx: f1(stamp.x), cy: f1(stamp.y), r: stampR * 0.66, stroke: p.signal, width: 0.9, alpha: 0.82 });
    items.push({ k: 'ring', cx: f1(stamp.x), cy: f1(stamp.y), r: stampR * 0.79, text: 'Fictional studio · est. 2017 · ', family: f.mono, size: portrait ? 5.4 : 8.6, weight: 600, tracking: 0.14, fill: p.signal, start: -100, alpha: 0.88 });
    items.push({ k: 'text', x: stamp.x, y: stamp.y + stampR * 0.2, text: 'L&L', family: f.serif, size: stampR * 0.56, weight: 400, italic: true, tracking: 0, fill: p.signal, align: 'center', alpha: 0.88 });
  }

  // ── Timeline: 24 frames, keys and breakdowns, the playhead parked on 13. ───────────────────────────────────────
  const ty = H - (portrait ? 30 : 38);
  const tw = W - 2 * M;
  const frames = 24;
  const fx = (i: number) => M + (tw * i) / frames;
  let ticks = '';
  for (let i = 0; i <= frames; i++) ticks += `M${f1(fx(i))} ${ty}V${f1(ty - (i % 6 === 0 ? 11 : 5))}`;
  items.push({ k: 'path', d: `M${M} ${ty}H${W - M}${ticks}`, stroke: p.ink, width: 1 });
  for (let i = 0; i <= frames; i += 6) mono(String(Math.max(1, i)).padStart(2, '0'), fx(i) + 3, ty + (portrait ? 11 : 13), 'left', p.muted, portrait ? 6.5 : 8);
  const diamond = (x: number, y: number, s: number, filled: boolean) =>
    items.push({ k: 'path', d: `M${f1(x)} ${f1(y - s)}L${f1(x + s)} ${f1(y)} ${f1(x)} ${f1(y + s)} ${f1(x - s)} ${f1(y)}Z`, ...(filled ? { fill: p.signal } : { fill: p.paper, stroke: p.signal, width: 1.2 }) });
  const dk = portrait ? 3.4 : 4.6;
  for (const i of [0, 8, 16, 24]) diamond(fx(i), ty - 18, dk, true);
  for (const i of [4, 12, 20]) diamond(fx(i), ty - 18, dk * 0.85, false);
  const ph = fx(13);
  items.push({ k: 'path', d: `M${f1(ph)} ${ty - 30}V${ty + 2}`, stroke: p.signal, width: 1.4 });
  items.push({ k: 'rect', x: f1(ph - 11), y: ty - (portrait ? 40 : 43), w: 22, h: portrait ? 11 : 13, r: 2.5, fill: p.signal });
  mono('13', ph, ty - (portrait ? 31.6 : 33.2), 'center', p.paper, portrait ? 6.5 : 8);
  if (!portrait) {
    mono('Timeline · keys ◆ · breakdowns ◇', W - M, ty - 30, 'right', p.muted, 8.5);
  }

  // Registration marks.
  const reg = portrait ? 9 : 14;
  for (const [cx, cy] of [[reg, reg], [W - reg, reg], [reg, H - reg], [W - reg, H - reg]]) {
    const rr = portrait ? 3.5 : 5.5;
    items.push({ k: 'circle', cx, cy, r: rr, stroke: p.ink, width: 0.9 });
    items.push({ k: 'path', d: `M${cx - rr * 1.8} ${cy}H${cx + rr * 1.8}M${cx} ${cy - rr * 1.8}V${cy + rr * 1.8}`, stroke: p.ink, width: 0.9 });
  }

  return { width: W, height: H, items };
}

/** Cover-fit transform from design units to a cssW × cssH stage (centred, like SVG `xMidYMid slice`). */
export function coverTransform(cssW: number, cssH: number, c: Composition) {
  const s = Math.max(cssW / c.width, cssH / c.height);
  return { s, ox: (cssW - c.width * s) / 2, oy: (cssH - c.height * s) / 2 };
}

/** Draw the composition with canvas2d over a cssW × cssH area (the caller sets any device-pixel scale first). */
export function drawManifesto(g: CanvasRenderingContext2D, cssW: number, cssH: number, c: Composition): void {
  const { s, ox, oy } = coverTransform(cssW, cssH, c);
  g.save();
  g.transform(s, 0, 0, s, ox, oy);
  const spaced = 'letterSpacing' in g;
  const setTracking = (px: number) => { if (spaced) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`; };
  const paint = (it: { fill?: string; stroke?: string; width?: number; alpha?: number; dash?: readonly number[] }, path?: Path2D, cap?: CanvasLineCap) => {
    g.globalAlpha = it.alpha ?? 1;
    if (it.fill) { g.fillStyle = it.fill; if (path) g.fill(path); else g.fill(); }
    if (it.stroke) {
      g.strokeStyle = it.stroke;
      g.lineWidth = it.width ?? 1;
      g.lineCap = cap ?? 'butt';
      g.lineJoin = 'round';
      g.setLineDash(it.dash ? [...it.dash] : []);
      if (path) g.stroke(path); else g.stroke();
    }
    g.globalAlpha = 1;
  };
  for (const it of c.items) {
    switch (it.k) {
      case 'rect': {
        g.beginPath();
        if (it.r && 'roundRect' in g) g.roundRect(it.x, it.y, it.w, it.h, it.r); else g.rect(it.x, it.y, it.w, it.h);
        paint(it);
        break;
      }
      case 'glow': {
        g.save();
        g.translate(it.cx, it.cy);
        g.scale(1, it.ry / it.rx);
        const grad = g.createRadialGradient(0, 0, 0, 0, 0, it.rx);
        grad.addColorStop(0, it.from);
        grad.addColorStop(1, it.to);
        g.fillStyle = grad;
        g.fillRect(-it.rx, -it.rx, it.rx * 2, it.rx * 2);
        g.restore();
        break;
      }
      case 'path': paint(it, new Path2D(it.d), it.cap); break;
      case 'circle': g.beginPath(); g.arc(it.cx, it.cy, it.r, 0, Math.PI * 2); paint(it); break;
      case 'ellipse': g.beginPath(); g.ellipse(it.cx, it.cy, it.rx, it.ry, (it.rot * Math.PI) / 180, 0, Math.PI * 2); paint(it); break;
      case 'ring': {
        g.font = fontOf(it);
        g.fillStyle = it.fill;
        g.globalAlpha = it.alpha ?? 1;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        setTracking(0);
        let a = (it.start * Math.PI) / 180;
        for (const ch of it.text) {
          const cw = g.measureText(ch).width + it.tracking * it.size;
          a += cw / 2 / it.r;
          g.save();
          g.translate(it.cx + Math.sin(a) * it.r, it.cy - Math.cos(a) * it.r);
          g.rotate(a);
          g.fillText(ch, 0, 0);
          g.restore();
          a += cw / 2 / it.r;
        }
        g.globalAlpha = 1;
        break;
      }
      case 'text':
        g.font = fontOf(it);
        g.fillStyle = it.fill;
        g.globalAlpha = it.alpha ?? 1;
        g.textAlign = it.align;
        g.textBaseline = 'alphabetic';
        setTracking(it.tracking * it.size);
        g.fillText(it.text, it.x, it.y);
        g.globalAlpha = 1;
        break;
    }
  }
  setTracking(0);
  g.restore();
}

/** Character advances for ring text in the SVG renderer (same measuring as the canvas). */
export function ringGlyphs(it: Extract<Item, { k: 'ring' }>): { ch: string; x: number; y: number; deg: number }[] {
  const g = ctx2d();
  const out: { ch: string; x: number; y: number; deg: number }[] = [];
  let a = (it.start * Math.PI) / 180;
  for (const ch of it.text) {
    let w = it.size * 0.6;
    if (g) { g.font = fontOf(it); w = g.measureText(ch).width; }
    const cw = w + it.tracking * it.size;
    a += cw / 2 / it.r;
    out.push({ ch, x: it.cx + Math.sin(a) * it.r, y: it.cy - Math.cos(a) * it.r, deg: (a * 180) / Math.PI });
    a += cw / 2 / it.r;
  }
  return out;
}
