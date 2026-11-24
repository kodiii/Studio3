/**
 * Hollin Drover — option data and the parametric side elevation.
 * Everything here is fictional sample data (brand, geometry, prices, lead time).
 * Units are millimetres, origin at the bottom bracket, +x forward, +y up.
 */

export type SizeId = '50' | '53' | '56' | '59';
export type FrameId = 'steel' | 'titanium';
export type PaintId = 'fern' | 'slate' | 'marigold' | 'chalk';
export type BarId = 'drop' | 'flat' | 'swept';
export type TyreId = 'road38' | 'tan38' | 'gravel45';
export type ExtraId = 'fenders' | 'rack' | 'lights';

export interface Build { size: SizeId; frame: FrameId; paint: PaintId; bar: BarId; tyre: TyreId; extras: readonly ExtraId[] }

export interface Choice<Id extends string> { id: Id; name: string; note: string; price: number; code: string }

export interface SizeSpec extends Choice<SizeId> {
  rider: string;
  /** seat tube (centre–top), head tube, stack, reach, head/seat angles, saddle height, stem length */
  st: number; ht: number; stack: number; reach: number; hta: number; sta: number; saddle: number; stem: number;
}

export const BASE_PRICE = 1890;
export const MODEL = 'Drover';

export const SIZES: SizeSpec[] = [
  { id: '50', name: '50', code: '50', note: 'Riders about 158–168 cm', rider: '158–168', price: 0, st: 500, ht: 115, stack: 548, reach: 372, hta: 71, sta: 74, saddle: 672, stem: 80 },
  { id: '53', name: '53', code: '53', note: 'Riders about 166–176 cm', rider: '166–176', price: 0, st: 530, ht: 135, stack: 568, reach: 380, hta: 71.5, sta: 73.5, saddle: 708, stem: 90 },
  { id: '56', name: '56', code: '56', note: 'Riders about 174–184 cm', rider: '174–184', price: 0, st: 560, ht: 160, stack: 592, reach: 388, hta: 72, sta: 73, saddle: 745, stem: 100 },
  { id: '59', name: '59', code: '59', note: 'Riders about 182–192 cm', rider: '182–192', price: 0, st: 590, ht: 185, stack: 616, reach: 396, hta: 72, sta: 72.5, saddle: 782, stem: 110 },
];

export const FRAMES: Choice<FrameId>[] = [
  { id: 'steel', name: 'Chromoly steel', code: 'CR', note: 'Brazed, painted, repairable almost anywhere.', price: 0 },
  { id: 'titanium', name: 'Titanium', code: 'TI', note: 'Bead-blasted and left raw. Lighter, never rusts.', price: 1150 },
];

export interface Paint extends Choice<PaintId> { colour: string }
export const PAINTS: Paint[] = [
  { id: 'fern', name: 'Fern', code: 'FE', note: 'Deep green, gloss', price: 0, colour: '#3f6b4c' },
  { id: 'slate', name: 'Slate', code: 'SL', note: 'Blue-grey, satin', price: 0, colour: '#4a5866' },
  { id: 'marigold', name: 'Marigold', code: 'MG', note: 'Two-coat pearl', price: 60, colour: '#d39a26' },
  { id: 'chalk', name: 'Chalk', code: 'CH', note: 'Two-coat off-white', price: 60, colour: '#e7e1d2' },
];

export const BARS: Choice<BarId>[] = [
  { id: 'drop', name: 'Drop bar', code: 'DB', note: 'Three hand positions for long days.', price: 0 },
  { id: 'flat', name: 'Flat bar', code: 'FB', note: 'Upright, simpler levers.', price: -40 },
  { id: 'swept', name: 'Swept bar', code: 'SB', note: 'Sits you up, wrists relaxed.', price: 35 },
];

export interface Tyre extends Choice<TyreId> { width: number; tan: boolean }
export const TYRES: Tyre[] = [
  { id: 'road38', name: '38 mm all-road', code: 'R38', note: 'Black, fast on tarmac', price: 0, width: 38, tan: false },
  { id: 'tan38', name: '38 mm tan wall', code: 'T38', note: 'Same tread, tan sidewall', price: 18, width: 38, tan: true },
  { id: 'gravel45', name: '45 mm gravel', code: 'G45', note: 'Knobbed, for loose ground', price: 30, width: 45, tan: false },
];

export const EXTRAS: Choice<ExtraId>[] = [
  { id: 'fenders', name: 'Full-length fenders', code: 'F', note: 'Aluminium blades with mudflap.', price: 95 },
  { id: 'rack', name: 'Rear rack', code: 'R', note: 'Steel, rated for 25 kg of bags.', price: 140 },
  { id: 'lights', name: 'Dynamo lighting', code: 'L', note: 'Hub dynamo, front and rear lights.', price: 265 },
];

/** The one hard incompatibility: fender blades clear tyres up to 40 mm. */
export const FENDER_MAX_TYRE = 40;
export const fendersFit = (tyre: TyreId): boolean => (TYRES.find((t) => t.id === tyre)?.width ?? 0) <= FENDER_MAX_TYRE;

export const DEFAULT_BUILD: Build = { size: '56', frame: 'steel', paint: 'fern', bar: 'drop', tyre: 'road38', extras: [] };

const byId = <T extends { id: string }>(list: readonly T[], id: string): T => list.find((x) => x.id === id) ?? list[0];
export const sizeOf = (b: Build) => byId(SIZES, b.size);
export const frameOf = (b: Build) => byId(FRAMES, b.frame);
export const paintOf = (b: Build) => byId(PAINTS, b.paint);
export const barOf = (b: Build) => byId(BARS, b.bar);
export const tyreOf = (b: Build) => byId(TYRES, b.tyre);

export function priceOf(b: Build): number {
  return BASE_PRICE + frameOf(b).price + paintOf(b).price + barOf(b).price + tyreOf(b).price
    + EXTRAS.filter((e) => b.extras.includes(e.id)).reduce((s, e) => s + e.price, 0);
}

export function codeOf(b: Build): string {
  const extras = EXTRAS.filter((e) => b.extras.includes(e.id)).map((e) => e.code).join('') || '0';
  return ['DRV', sizeOf(b).code, frameOf(b).code, paintOf(b).code, barOf(b).code, tyreOf(b).code, extras].join('-');
}

/** Every valid combination, counted from the option data (so the number in the copy is never typed by hand). */
export function countBuilds(): number {
  let n = 0;
  const extraSets = 1 << EXTRAS.length;
  for (const tyre of TYRES) {
    for (let mask = 0; mask < extraSets; mask++) {
      const hasFenders = EXTRAS.some((e, i) => e.id === 'fenders' && mask & (1 << i));
      if (hasFenders && !fendersFit(tyre.id)) continue;
      n += SIZES.length * FRAMES.length * PAINTS.length * BARS.length;
    }
  }
  return n;
}

/* ── URL hash ───────────────────────────────────────────────────────────── */

const isIn = <T extends string>(list: readonly { id: T }[], v: string | null): v is T => !!v && list.some((x) => x.id === v);

export function toHash(b: Build): string {
  const p = new URLSearchParams({ size: b.size, frame: b.frame, paint: b.paint, bar: b.bar, tyre: b.tyre, extras: b.extras.join('.') || 'none' });
  return `#${p.toString()}`;
}

export function fromHash(hash: string): Build | null {
  if (!hash || hash.length < 2) return null;
  const p = new URLSearchParams(hash.slice(1));
  if (!p.has('size')) return null;
  const pick = <T extends string>(key: string, list: readonly { id: T }[], fallback: T): T => { const v = p.get(key); return isIn(list, v) ? v : fallback; };
  const tyre = pick('tyre', TYRES, DEFAULT_BUILD.tyre);
  const extras = (p.get('extras') ?? '').split('.').filter((x): x is ExtraId => isIn(EXTRAS, x))
    .filter((x) => x !== 'fenders' || fendersFit(tyre));
  return {
    size: pick('size', SIZES, DEFAULT_BUILD.size),
    frame: pick('frame', FRAMES, DEFAULT_BUILD.frame),
    paint: pick('paint', PAINTS, DEFAULT_BUILD.paint),
    bar: pick('bar', BARS, DEFAULT_BUILD.bar),
    tyre,
    extras: EXTRAS.map((e) => e.id).filter((id) => extras.includes(id)),
  };
}

export const sameBuild = (a: Build, b: Build): boolean => toHash(a) === toHash(b);

/* ── Geometry ───────────────────────────────────────────────────────────── */

export interface Pt { x: number; y: number }
/** The numbers the drawing is computed from; tweened as a whole when the size or tyre changes. */
export interface Fit { st: number; ht: number; stack: number; reach: number; hta: number; sta: number; saddle: number; stem: number; tyre: number }

export const fitOf = (b: Build): Fit => {
  const s = sizeOf(b);
  return { st: s.st, ht: s.ht, stack: s.stack, reach: s.reach, hta: s.hta, sta: s.sta, saddle: s.saddle, stem: s.stem, tyre: tyreOf(b).width };
};

export const CHAINSTAY = 450;
export const BB_DROP = 72;
export const FORK_OFFSET = 50;
/** ISO 622 bead seat radius (700C). */
export const RIM_R = 311;

const rad = (d: number) => (d * Math.PI) / 180;
export const pt = (x: number, y: number): Pt => ({ x, y });
export const along = (from: Pt, dir: Pt, len: number): Pt => ({ x: from.x + dir.x * len, y: from.y + dir.y * len });
export const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export interface Solved {
  bb: Pt; rear: Pt; front: Pt; stTop: Pt; htTop: Pt; htBot: Pt;
  stDir: Pt; down: Pt; perp: Pt; forkLen: number;
  radius: number; ground: number; wheelbase: number;
  seatCluster: Pt; ssTop: Pt; ttFront: Pt; dtFront: Pt; crown: Pt; forkCtrl: Pt;
  saddle: Pt; postTop: Pt; steererTop: Pt; clamp: Pt;
}

export function solve(f: Fit): Solved {
  const bb = pt(0, 0);
  const rear = pt(-Math.sqrt(CHAINSTAY ** 2 - BB_DROP ** 2), BB_DROP);
  const stDir = pt(-Math.cos(rad(f.sta)), Math.sin(rad(f.sta)));
  const stTop = along(bb, stDir, f.st);
  const down = pt(Math.cos(rad(f.hta)), -Math.sin(rad(f.hta)));
  const perp = pt(Math.sin(rad(f.hta)), Math.cos(rad(f.hta)));
  const htTop = pt(f.reach, f.stack);
  const htBot = along(htTop, down, f.ht);
  // Fork: the axle sits FORK_OFFSET ahead of the steering axis, level with the rear axle.
  const forkLen = (htBot.y + FORK_OFFSET * perp.y - BB_DROP) / Math.sin(rad(f.hta));
  const axis = along(htBot, down, forkLen);
  const front = along(axis, perp, FORK_OFFSET);
  const radius = RIM_R + f.tyre;
  const stem = pt(Math.cos(rad(8)), Math.sin(rad(8)));
  const steererTop = along(htTop, down, -24);
  return {
    bb, rear, front, stTop, htTop, htBot, stDir, down, perp, forkLen,
    radius, ground: BB_DROP - radius, wheelbase: front.x - rear.x,
    seatCluster: along(bb, stDir, f.st - 22),
    ssTop: along(bb, stDir, f.st - 36),
    ttFront: along(htTop, down, 26),
    dtFront: along(htBot, down, -34),
    crown: along(htBot, down, 16),
    forkCtrl: along(htBot, down, forkLen * 0.8),
    saddle: along(bb, stDir, f.saddle),
    postTop: along(bb, stDir, f.saddle - 34),
    steererTop,
    clamp: along(steererTop, stem, f.stem),
  };
}

/** The fixed drawing frame (largest size, widest tyre) so sizes compare at true scale. */
export const VIEW = { minX: -880, maxX: 1060, minY: -400, maxY: 810 } as const;
export const VIEW_W = VIEW.maxX - VIEW.minX;
export const VIEW_H = VIEW.maxY - VIEW.minY;
/** Model point → percentage position inside the drawing box (for HTML labels laid over the SVG). */
export const toPct = (p: Pt) => ({ left: `${((p.x - VIEW.minX) / VIEW_W) * 100}%`, top: `${((VIEW.maxY - p.y) / VIEW_H) * 100}%` });

export function interpolateFit(a: Fit, b: Fit, t: number): Fit {
  const out = {} as Fit;
  for (const k of Object.keys(b) as (keyof Fit)[]) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

export const formatPrice = (n: number): string => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
export const formatDelta = (n: number): string => (n === 0 ? 'Included' : `${n > 0 ? '+' : '−'}${formatPrice(Math.abs(n))}`);
export const mm = (n: number): string => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
