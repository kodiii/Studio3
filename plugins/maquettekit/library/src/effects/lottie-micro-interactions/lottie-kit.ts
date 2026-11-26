/**
 * lottie-kit — author original Lottie (Bodymovin 5.x) animations as typed code, and render any frame of them as a
 * static SVG tree (used as the fallback before lottie-web loads, or where it cannot run).
 *
 * Authoring model, SVG-like:
 *   - A scene is a tree of `group`s and `draw`s listed bottom → top (later children paint on top).
 *   - A `draw` holds paths painted by an optional fill and an optional stroke (the stroke sits above the fill).
 *   - Any value can be a constant or a `track(...)`: `.to(frame, value, ease)` eases from the previous key INTO the
 *     new one with a motion token (`'overshoot'`, `'emphasized'` …), `'swing'` (half a cosine) or `'hold'` (a jump).
 *   - Path morphs are tracks of `Path`s; every key must keep the same vertex count (checked when compiling).
 *
 * Colours are not baked in. Each paint names a tone (ink, tint, solid, on, knock) that is emitted as class names on the
 * SVG element lottie-web creates (`cl: "lmi-st lmi-ink"`), and CSS maps tones to theme tokens. One data file therefore
 * follows light, dark and any local theme without being rebuilt. The RGB values in the data are only a fallback.
 */
import { easing, type Bezier, type EasingToken } from '../../motion';

/* ── Values, keyframe tracks and easing ─────────────────────────────────────────────────────────────────────── */

export type Vec2 = readonly [number, number];
export type Ease = EasingToken | Bezier | 'swing' | 'hold';

/** One pendulum swing between two turning points: zero velocity at both ends (half a cosine). */
export const SWING: Bezier = [0.37, 0, 0.63, 1];

const bezierFor = (e: Exclude<Ease, 'hold'>): Bezier => (typeof e === 'string' ? (e === 'swing' ? SWING : easing[e]) : e);

export interface Key<T> { t: number; v: T; ease: Ease }

/** A keyframe track. The ease of a key describes how the value ARRIVES at it from the previous key. */
export class Track<T> {
  readonly keys: Key<T>[];
  constructor(v: T, t = 0) { this.keys = [{ t, v, ease: 'linear' }]; }
  get end(): Key<T> { return this.keys[this.keys.length - 1]; }
  /** Ease from the previous key into `v`, arriving at frame `t`. */
  to(t: number, v: T, ease: Ease = 'standard'): this {
    if (!(t > this.end.t)) throw new Error(`lottie-kit: keys must move forward in time (${t} after ${this.end.t})`);
    this.keys.push({ t, v, ease });
    return this;
  }
  /** Keep the current value until frame `t`. */
  hold(t: number): this { return t > this.end.t ? this.to(t, this.end.v, 'linear') : this; }
  /** Append a sequence of `[frame, value, ease]` keys. */
  keysTo(list: readonly (readonly [number, T, Ease?])[]): this {
    for (const [t, v, e] of list) this.to(t, v, e ?? 'standard');
    return this;
  }
}
export const track = <T>(v: T, t = 0): Track<T> => new Track<T>(v, t);
export type Anim<T> = T | Track<T>;

/**
 * Turning points of a damped oscillation released from `amplitude` (a struck bell, a plucked ribbon): one key per
 * swing, each `halfPeriod` frames after the last and `decay` times smaller, eased with `SWING`, ending at 0.
 */
export function oscillation(from: number, amplitude: number, opts: { start: number; halfPeriod: number; decay: number; swings: number }): readonly (readonly [number, number, Ease])[] {
  const out: [number, number, Ease][] = [];
  let a = amplitude;
  let t = opts.start;
  for (let n = 0; n < opts.swings; n++) {
    t += opts.halfPeriod;
    out.push([Math.round(t * 10) / 10, from + a, 'swing']);
    a *= -opts.decay;
  }
  out.push([Math.round((t + opts.halfPeriod) * 10) / 10, from, 'swing']);
  return out;
}

/* ── Geometry on the design grid ─────────────────────────────────────────────────────────────────────────────── */

/** A bezier path. Tangents are relative to their vertex (Lottie's convention): `i` before the vertex, `o` after it. */
export interface Path { readonly v: readonly Vec2[]; readonly i: readonly Vec2[]; readonly o: readonly Vec2[]; readonly c: boolean }

const Z: Vec2 = [0, 0];
const add = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
const mul = (a: Vec2, s: number): Vec2 => [a[0] * s, a[1] * s];
const len = (a: Vec2): number => Math.hypot(a[0], a[1]);
const unit = (a: Vec2): Vec2 => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const rad = (deg: number): number => (deg * Math.PI) / 180;
/** Point at `deg` clockwise from 12 o'clock (screen space, y down). */
export const polar = (c: Vec2, r: number, deg: number, ry = r): Vec2 => [c[0] + r * Math.sin(rad(deg)), c[1] - ry * Math.cos(rad(deg))];

/** Straight segments through `points`. */
export function polyline(points: readonly Vec2[], closed = false): Path {
  return { v: points.slice(), i: points.map(() => Z), o: points.map(() => Z), c: closed };
}
export const line = (a: Vec2, b: Vec2): Path => polyline([a, b]);

/**
 * Closed polygon whose corners are true circular arcs. Every corner emits two vertices (arc start, arc end), so two
 * polygons with the same corner count always morph cleanly, whatever their radii (0 keeps a sharp corner).
 */
export function roundedPolygon(points: readonly Vec2[], radius: number | readonly number[]): Path {
  const n = points.length;
  const v: Vec2[] = [], i: Vec2[] = [], o: Vec2[] = [];
  for (let k = 0; k < n; k++) {
    const p = points[k], prev = points[(k + n - 1) % n], next = points[(k + 1) % n];
    const r = typeof radius === 'number' ? radius : radius[k] ?? 0;
    const u1 = unit(sub(prev, p)), u2 = unit(sub(next, p));
    const theta = Math.acos(Math.min(1, Math.max(-1, u1[0] * u2[0] + u1[1] * u2[1])));
    let d = r > 0 && theta > 1e-3 ? r / Math.tan(theta / 2) : 0;
    d = Math.min(d, len(sub(prev, p)) / 2, len(sub(next, p)) / 2);
    const h = (4 / 3) * Math.tan((Math.PI - theta) / 4) * d * Math.tan(theta / 2);
    v.push(add(p, mul(u1, d)), add(p, mul(u2, d)));
    i.push(Z, mul(u2, -h));
    o.push(mul(u1, -h), Z);
  }
  return { v, i, o, c: true };
}

/**
 * Smooth closed curve through points at the given angles (degrees clockwise from 12 o'clock) of an ellipse. With
 * evenly spaced angles it is a circle; with the angles of another shape's vertices it becomes a morph target that
 * travels to that shape without twisting.
 */
export function ellipseAt(c: Vec2, rx: number, ry: number, anglesDeg: readonly number[]): Path {
  const n = anglesDeg.length;
  const a = anglesDeg.map(rad);
  const v: Vec2[] = [], i: Vec2[] = [], o: Vec2[] = [];
  for (let k = 0; k < n; k++) {
    const gPrev = ((a[k] - a[(k + n - 1) % n]) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) || 2 * Math.PI;
    const gNext = ((a[(k + 1) % n] - a[k]) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) || 2 * Math.PI;
    const tan: Vec2 = [Math.cos(a[k]), Math.sin(a[k])]; // clockwise tangent on the unit circle
    const hIn = (4 / 3) * Math.tan(gPrev / 4), hOut = (4 / 3) * Math.tan(gNext / 4);
    v.push([c[0] + rx * Math.sin(a[k]), c[1] - ry * Math.cos(a[k])]);
    i.push([-tan[0] * rx * hIn, -tan[1] * ry * hIn]);
    o.push([tan[0] * rx * hOut, tan[1] * ry * hOut]);
  }
  return { v, i, o, c: true };
}

/** Circle with `n` evenly spaced vertices, the first at `startDeg` (clockwise from 12 o'clock). */
export const circle = (c: Vec2, r: number, n = 4, startDeg = 0): Path =>
  ellipseAt(c, r, r, Array.from({ length: n }, (_, k) => startDeg + (360 / n) * k));

/** Open circular arc from `fromDeg` to `toDeg` (clockwise from 12 o'clock) in `segments` bezier segments. */
export function arc(c: Vec2, r: number, fromDeg: number, toDeg: number, segments = 1): Path {
  const step = (toDeg - fromDeg) / segments;
  const h = (4 / 3) * Math.tan(rad(step) / 4) * r;
  const v: Vec2[] = [], i: Vec2[] = [], o: Vec2[] = [];
  for (let k = 0; k <= segments; k++) {
    const d = rad(fromDeg + step * k);
    const tan: Vec2 = [Math.cos(d), Math.sin(d)];
    v.push(polar(c, r, fromDeg + step * k));
    i.push(k === 0 ? Z : mul(tan, -h));
    o.push(k === segments ? Z : mul(tan, h));
  }
  return { v, i, o, c: false };
}

/** Angles (clockwise from 12 o'clock, about `c`) of a path's vertices — for building a matching morph target. */
export const vertexAngles = (p: Path, c: Vec2): number[] =>
  p.v.map(([x, y]) => (Math.atan2(x - c[0], -(y - c[1])) * 180) / Math.PI);

/** Move every vertex of a path (tangents unchanged). */
export const translatePath = (p: Path, d: Vec2): Path => ({ ...p, v: p.v.map((q) => add(q, d)) });

/* ── Scene ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/** Paint roles. CSS maps them to tokens: line art, the "activated" colour, a solid disc, the glyph on it, a knock-out. */
export type Tone = 'ink' | 'tint' | 'solid' | 'on' | 'knock';

export interface Ellipse { readonly kind: 'ellipse'; readonly center: Anim<Vec2>; readonly size: Anim<Vec2> }
export const ellipse = (center: Anim<Vec2>, size: Anim<Vec2>): Ellipse => ({ kind: 'ellipse', center, size });

export interface FillPaint { tone: Tone; opacity?: Anim<number> }
export interface StrokePaint { tone: Tone; width: Anim<number>; opacity?: Anim<number>; cap?: 'butt' | 'round' | 'square'; join?: 'miter' | 'round' | 'bevel' }
/** Rotation and scale happen about `pivot` (anchor = position = pivot), unless `anchor`/`position` are given. */
export interface Transform { pivot?: Vec2; anchor?: Anim<Vec2>; position?: Anim<Vec2>; scale?: Anim<number> | Anim<Vec2>; rotation?: Anim<number>; opacity?: Anim<number> }

export type SceneNode =
  | { kind: 'draw'; name: string; paths: readonly (Anim<Path> | Ellipse)[]; fill?: FillPaint; stroke?: StrokePaint; transform?: Transform }
  | { kind: 'group'; name: string; children: readonly SceneNode[]; transform?: Transform };

export const draw = (name: string, spec: { paths: readonly (Anim<Path> | Ellipse)[]; fill?: FillPaint; stroke?: StrokePaint; transform?: Transform }): SceneNode => ({ kind: 'draw', name, ...spec });
export const group = (name: string, children: readonly SceneNode[], transform?: Transform): SceneNode => ({ kind: 'group', name, children, transform });

/* ── Lottie JSON (the subset this kit writes and the static renderer reads) ─────────────────────────────────── */

export interface LottieEase { x: number | number[]; y: number | number[] }
export interface LottieKeyframe { t: number; s?: unknown[]; e?: unknown[]; o?: LottieEase; i?: LottieEase; h?: number }
export interface LottieProp { a: 0 | 1; k: unknown; ix?: number }
export interface LottieShapePath { c: boolean; v: number[][]; i: number[][]; o: number[][] }
export interface LottieItem { ty: string; nm?: string; [key: string]: unknown }
export interface LottieLayer { ddd: 0; ind: number; ty: number; nm: string; sr: 1; ks: Record<string, unknown>; ao: 0; shapes: LottieItem[]; ip: number; op: number; st: 0; bm: 0 }
export interface LottieMarker { tm: number; cm: string; dr: number }
export interface LottieAnimation { v: string; fr: number; ip: number; op: number; w: number; h: number; nm: string; ddd: 0; assets: unknown[]; layers: LottieLayer[]; markers: LottieMarker[]; __complete?: boolean }

const TONE_RGB: Record<Tone, readonly [number, number, number]> = {
  ink: [0x11, 0x11, 0x0f], tint: [0xbf, 0x2f, 0x09], solid: [0x11, 0x11, 0x0f], on: [0xfb, 0xf9, 0xf4], knock: [0xfb, 0xf9, 0xf4],
};
const toneColor = (t: Tone): LottieProp => ({ a: 0, k: [...TONE_RGB[t].map((c) => Math.round((c / 255) * 1000) / 1000), 1] });
const r3 = (n: number): number => Math.round(n * 1000) / 1000;

/** Constant or keyframed Lottie property. Keyframe values are arrays (`[45]`, `[x, y]`, `[shape]`). */
function encode<T, O>(a: Anim<T>, enc: (v: T) => O, shape = false): LottieProp {
  if (!(a instanceof Track) || a.keys.length === 1) {
    const v = a instanceof Track ? a.keys[0].v : a;
    return { a: 0, k: enc(v) };
  }
  const keys = a.keys;
  return {
    a: 1,
    k: keys.map((key, n): LottieKeyframe => {
      const e: unknown = enc(key.v);
      const kf: LottieKeyframe = { t: key.t, s: Array.isArray(e) && !shape ? e : [e] };
      const next = keys[n + 1];
      if (next) {
        if (next.ease === 'hold') kf.h = 1;
        else {
          const [x1, y1, x2, y2] = bezierFor(next.ease);
          kf.o = shape ? { x: x1, y: y1 } : { x: [x1], y: [y1] };
          kf.i = shape ? { x: x2, y: y2 } : { x: [x2], y: [y2] };
        }
      }
      return kf;
    }),
  };
}
const vec = (v: Vec2): number[] => [r3(v[0]), r3(v[1])];
const scaleVec = (v: number | Vec2): number[] => (typeof v === 'number' ? [r3(v * 100), r3(v * 100)] : [r3(v[0] * 100), r3(v[1] * 100)]);
const shapeJson = (p: Path): LottieShapePath => ({ c: p.c, v: p.v.map(vec), i: p.i.map(vec), o: p.o.map(vec) });

function transformJson(t: Transform = {}): LottieItem {
  const pivot = t.pivot ?? [0, 0];
  return {
    ty: 'tr',
    nm: 'Transform',
    a: encode(t.anchor ?? pivot, vec),
    p: encode(t.position ?? pivot, vec),
    s: encode<number | Vec2, number[]>(t.scale ?? 1, scaleVec),
    r: encode(t.rotation ?? 0, (n) => r3(n)),
    o: encode(t.opacity ?? 1, (n) => r3(n * 100)),
    sk: { a: 0, k: 0 },
    sa: { a: 0, k: 0 },
  };
}

function checkMorph(name: string, p: Anim<Path>): void {
  if (!(p instanceof Track)) return;
  const [first, ...rest] = p.keys;
  for (const k of rest) {
    if (k.v.v.length !== first.v.v.length || k.v.c !== first.v.c) {
      throw new Error(`lottie-kit: "${name}" morphs between paths with different vertex counts (${first.v.v.length} → ${k.v.v.length} at frame ${k.t})`);
    }
  }
}

function nodeJson(node: SceneNode): LottieItem {
  if (node.kind === 'group') {
    return { ty: 'gr', nm: node.name, it: [...[...node.children].reverse().map(nodeJson), transformJson(node.transform)], np: node.children.length + 1, cix: 2, bm: 0, hd: false };
  }
  const it: LottieItem[] = node.paths.map((p, n) => {
    if (typeof p === 'object' && 'kind' in p && p.kind === 'ellipse') {
      return { ty: 'el', nm: `${node.name} ellipse ${n}`, d: 1, p: encode(p.center, vec), s: encode(p.size, vec) };
    }
    const path = p as Anim<Path>;
    checkMorph(node.name, path);
    return { ty: 'sh', nm: `${node.name} path ${n}`, d: 1, ks: encode(path, shapeJson, true) };
  });
  if (node.stroke) {
    const s = node.stroke;
    it.push({ ty: 'st', nm: `${node.name} stroke`, cl: `lmi-st lmi-${s.tone}`, c: toneColor(s.tone), o: encode(s.opacity ?? 1, (n) => r3(n * 100)), w: encode(s.width, (n) => r3(n)), lc: { butt: 1, round: 2, square: 3 }[s.cap ?? 'round'], lj: { miter: 1, round: 2, bevel: 3 }[s.join ?? 'round'], ml: 4, bm: 0 });
  }
  if (node.fill) {
    it.push({ ty: 'fl', nm: `${node.name} fill`, cl: `lmi-fl lmi-${node.fill.tone}`, c: toneColor(node.fill.tone), o: encode(node.fill.opacity ?? 1, (n) => r3(n * 100)), r: 1, bm: 0 });
  }
  it.push(transformJson(node.transform));
  return { ty: 'gr', nm: node.name, it, np: it.length, cix: 2, bm: 0, hd: false };
}

export interface ComposeSpec {
  name: string;
  /** Last authored frame (the timeline runs 0 … frames). */
  frames: number;
  fps?: number;
  /** Design grid in composition units (24 for a 24-unit icon). */
  grid?: number;
  /** Empty margin around the grid, in grid units, so bursts and overshoot are not clipped. */
  bleed?: number;
  scene: readonly SceneNode[];
  /** Named segments, written as Lottie markers (the convention After Effects exports use). */
  markers?: Record<string, readonly [number, number]>;
}

/** Compile a scene into a Lottie animation: one shape layer, the grid offset by `bleed` inside the composition. */
export function compose(spec: ComposeSpec): LottieAnimation {
  const grid = spec.grid ?? 24;
  const bleed = spec.bleed ?? 8;
  const size = grid + bleed * 2;
  // One frame of headroom past the last key: a forward segment that ends ON a frame needs to be played to frame + 1.
  const op = spec.frames + 2;
  const root = group('root', spec.scene, { position: [bleed, bleed] });
  return {
    v: '5.12.0', fr: spec.fps ?? 60, ip: 0, op, w: size, h: size, nm: spec.name, ddd: 0, assets: [],
    layers: [{
      ddd: 0, ind: 1, ty: 4, nm: spec.name, sr: 1, ao: 0, ip: 0, op, st: 0, bm: 0,
      ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [0, 0, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } },
      shapes: [nodeJson(root)],
    }],
    markers: Object.entries(spec.markers ?? {}).map(([cm, [a, b]]) => ({ tm: a, cm, dr: b - a })),
  };
}

/* ── Static renderer: any frame of the data above as an SVG tree ────────────────────────────────────────────── */

export interface SvgNode { tag: 'g' | 'path'; attrs: Record<string, string>; children?: SvgNode[] }

/** The cubic-bezier solver lottie-web uses (bezier-easing by G. Renaudeau), so fallback frames match the player. */
function bezierEasing(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  if (x1 === y1 && x2 === y2) return (x) => x;
  const A = (a1: number, a2: number) => 1 - 3 * a2 + 3 * a1;
  const B = (a1: number, a2: number) => 3 * a2 - 6 * a1;
  const C = (a1: number) => 3 * a1;
  const calc = (t: number, a1: number, a2: number) => ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t;
  const slope = (t: number, a1: number, a2: number) => 3 * A(a1, a2) * t * t + 2 * B(a1, a2) * t + C(a1);
  const N = 11, step = 1 / (N - 1);
  const samples = Array.from({ length: N }, (_, k) => calc(k * step, x1, x2));
  const tForX = (x: number): number => {
    let start = 0, k = 1;
    for (; k !== N - 1 && samples[k] <= x; k++) start += step;
    k--;
    const guess = start + ((x - samples[k]) / (samples[k + 1] - samples[k])) * step;
    const s = slope(guess, x1, x2);
    if (s >= 0.001) {
      let t = guess;
      for (let n = 0; n < 4; n++) { const sl = slope(t, x1, x2); if (sl === 0) return t; t -= (calc(t, x1, x2) - x) / sl; }
      return t;
    }
    if (s === 0) return guess;
    let a = start, b = start + step, t = 0, cx = 0, n = 0;
    do { t = a + (b - a) / 2; cx = calc(t, x1, x2) - x; if (cx > 0) b = t; else a = t; } while (Math.abs(cx) > 1e-7 && ++n < 10);
    return t;
  };
  return (x) => (x === 0 ? 0 : x === 1 ? 1 : calc(tForX(x), y1, y2));
}
const pick = (v: number | number[] | undefined, d: number): number => (Array.isArray(v) ? (v[d] ?? v[0]) : (v ?? 0));
function progress(kf: LottieKeyframe, d: number, p: number): number {
  if (!kf.o || !kf.i) return p;
  return bezierEasing(pick(kf.o.x, d), pick(kf.o.y, d), pick(kf.i.x, d), pick(kf.i.y, d))(p);
}

/** Find the active keyframe pair: [from, to, local progress 0…1] (lottie-web's lookup rules, holds included). */
function span(k: LottieKeyframe[], f: number): [LottieKeyframe, LottieKeyframe | null, number] {
  if (f < k[0].t) return [k[0], null, 0];
  const last = k[k.length - 1];
  if (f >= last.t) return [last.s ? last : { ...k[k.length - 2], s: k[k.length - 2].e }, null, 0];
  let n = 0;
  while (n < k.length - 2 && k[n + 1].t <= f) n++;
  const a = k[n], b = k[n + 1];
  if (a.h === 1) return [a, null, 0];
  return [a, b, (f - a.t) / (b.t - a.t)];
}

function num(prop: unknown, f: number, fallback: number[]): number[] {
  const p = prop as LottieProp | undefined;
  if (!p) return fallback;
  if (!p.a) return Array.isArray(p.k) ? (p.k as number[]) : [p.k as number];
  const [a, b, t] = span(p.k as LottieKeyframe[], f);
  const from = (a.s ?? a.e ?? fallback) as number[];
  if (!b) return from;
  const to = (b.s ?? a.e ?? from) as number[];
  return from.map((v, d) => v + (to[d] - v) * progress(a, d, t));
}

function shapeAt(prop: unknown, f: number): LottieShapePath {
  const p = prop as LottieProp;
  if (!p.a) return p.k as LottieShapePath;
  const [a, b, t] = span(p.k as LottieKeyframe[], f);
  const from = (a.s ?? a.e)![0] as LottieShapePath;
  if (!b) return from;
  const to = ((b.s ?? a.e)![0]) as LottieShapePath;
  const e = progress(a, 0, t);
  const lerp = (x: number[][], y: number[][]) => x.map((q, n) => [q[0] + (y[n][0] - q[0]) * e, q[1] + (y[n][1] - q[1]) * e]);
  return { c: from.c, v: lerp(from.v, to.v), i: lerp(from.i, to.i), o: lerp(from.o, to.o) };
}

const fmt = (n: number): string => String(Math.round(n * 1000) / 1000);

function pathD(s: LottieShapePath, absolute: boolean): string {
  const n = s.v.length;
  if (!n) return '';
  const ctl = (k: number, t: number[][]) => (absolute ? t[k] : [s.v[k][0] + t[k][0], s.v[k][1] + t[k][1]]);
  let d = `M${fmt(s.v[0][0])},${fmt(s.v[0][1])}`;
  const seg = (a: number, b: number) => {
    const o = ctl(a, s.o), i = ctl(b, s.i);
    d += `C${fmt(o[0])},${fmt(o[1])} ${fmt(i[0])},${fmt(i[1])} ${fmt(s.v[b][0])},${fmt(s.v[b][1])}`;
  };
  for (let k = 1; k < n; k++) seg(k - 1, k);
  if (s.c) { seg(n - 1, 0); d += 'z'; }
  return d;
}

/** Ellipse as lottie-web draws it: four bezier quadrants from 12 o'clock, clockwise. */
function ellipseD(item: LottieItem, f: number): string {
  const [cx, cy] = num(item.p, f, [0, 0]);
  const [w, h] = num(item.s, f, [0, 0]);
  if (!w && !h) return '';
  const rx = w / 2, ry = h / 2, k = 0.5519;
  const P = (x: number, y: number) => `${fmt(x)},${fmt(y)}`;
  return `M${P(cx, cy - ry)}C${P(cx + rx * k, cy - ry)} ${P(cx + rx, cy - ry * k)} ${P(cx + rx, cy)}`
    + `C${P(cx + rx, cy + ry * k)} ${P(cx + rx * k, cy + ry)} ${P(cx, cy + ry)}`
    + `C${P(cx - rx * k, cy + ry)} ${P(cx - rx, cy + ry * k)} ${P(cx - rx, cy)}`
    + `C${P(cx - rx, cy - ry * k)} ${P(cx - rx * k, cy - ry)} ${P(cx, cy - ry)}z`;
}

/** SVG `matrix()` for a Lottie transform: translate(p) · rotate(r) · scale(s) · translate(−a). */
function matrixOf(tr: Record<string, unknown>, f: number): { m: string; opacity: number } {
  const p = tr.p as { s?: boolean; x?: unknown; y?: unknown } | undefined;
  const [px, py] = p && p.s ? [num(p.x, f, [0])[0], num(p.y, f, [0])[0]] : num(tr.p, f, [0, 0]);
  const [ax, ay] = num(tr.a, f, [0, 0]);
  const [sx, sy] = num(tr.s, f, [100, 100]).map((v) => v / 100);
  const r = rad(num(tr.r, f, [0])[0]);
  const cos = Math.cos(r), sin = Math.sin(r);
  const a = cos * sx, b = sin * sx, c = -sin * sy, d = cos * sy;
  const e = px - (a * ax + c * ay), g = py - (b * ax + d * ay);
  return { m: `matrix(${[a, b, c, d, e, g].map(fmt).join(',')})`, opacity: num(tr.o, f, [100])[0] / 100 };
}

const rgb = (prop: unknown, f: number): string => {
  const [r, g, b] = num(prop, f, [0, 0, 0]);
  return `rgb(${Math.floor(r * 255)},${Math.floor(g * 255)},${Math.floor(b * 255)})`;
};

function renderItems(items: LottieItem[], f: number, absolute: boolean): SvgNode[] {
  const out: SvgNode[] = [];
  // Lottie lists items top-first: walk bottom-up so later output paints on top.
  for (let n = items.length - 1; n >= 0; n--) {
    const it = items[n];
    if (it.hd === true) continue;
    if (it.ty === 'gr') {
      const its = it.it as LottieItem[];
      const tr = its.find((x) => x.ty === 'tr');
      const { m, opacity } = tr ? matrixOf(tr, f) : { m: 'matrix(1,0,0,1,0,0)', opacity: 1 };
      out.push({ tag: 'g', attrs: { transform: m, opacity: fmt(opacity) }, children: renderItems(its, f, absolute) });
    } else if (it.ty === 'fl' || it.ty === 'st') {
      // A style paints every path listed above it in the same group.
      const d = items.slice(0, n).map((s) => (s.hd === true ? '' : s.ty === 'sh' ? pathD(shapeAt(s.ks, f), absolute) : s.ty === 'el' ? ellipseD(s, f) : '')).join('');
      const attrs: Record<string, string> = { d: d || 'M0 0' };
      if (typeof it.cl === 'string') attrs.class = it.cl;
      const o = fmt(num(it.o, f, [100])[0] / 100);
      if (it.ty === 'fl') {
        Object.assign(attrs, { fill: rgb(it.c, f), 'fill-opacity': o });
        if (it.r === 2) attrs['fill-rule'] = 'evenodd';
      } else {
        Object.assign(attrs, {
          fill: 'none', stroke: rgb(it.c, f), 'stroke-opacity': o, 'stroke-width': fmt(num(it.w, f, [1])[0]),
          'stroke-linecap': ['butt', 'butt', 'round', 'square'][Number(it.lc ?? 2)] ?? 'round',
          'stroke-linejoin': ['miter', 'miter', 'round', 'bevel'][Number(it.lj ?? 2)] ?? 'round',
        });
      }
      out.push({ tag: 'path', attrs });
    }
  }
  return out;
}

/**
 * Render one frame of a Lottie animation (shape layers: groups, paths, ellipses, fills, strokes, transforms) as an SVG
 * tree in composition coordinates. Exact at keyframes; between keys it follows lottie-web's interpolation.
 */
export function renderFrame(anim: LottieAnimation, frame: number): SvgNode[] {
  const absolute = anim.__complete === true; // data already processed by lottie-web holds absolute tangents
  const out: SvgNode[] = [];
  for (let n = anim.layers.length - 1; n >= 0; n--) {
    const layer = anim.layers[n];
    if (layer.ty !== 4 || frame < layer.ip || frame >= layer.op) continue;
    const { m, opacity } = matrixOf(layer.ks, frame);
    out.push({ tag: 'g', attrs: { transform: m, opacity: fmt(opacity) }, children: renderItems(layer.shapes, frame, absolute) });
  }
  return out;
}
