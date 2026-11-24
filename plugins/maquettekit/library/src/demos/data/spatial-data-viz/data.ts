/**
 * Saddleback Plateau snow survey — SIMULATED. A fictional 24 × 16 grid of snow-depth sensors read once a day for
 * 30 days. Depth = (settled storm totals + a base layer) × a fixed wind-redistribution field (scoured windward
 * slope, a drift band in the lee of a ridge, a hollow, a gully) − late-month melt (faster on the sunny southern
 * rows) + noise. Three sensors drop out for a while, so some cells honestly have no reading.
 */
import { interpolateLab } from 'd3';

export const SEED = 912;
export const COLS = 24;
export const ROWS = 16;
export const DAYS = 30;
export const N = COLS * ROWS;
export const START = Date.UTC(2026, 0, 6);
/** Vertical exaggeration of the 3D bars (stated in the legend). */
export const EXAGGERATION = 1.5;
export const MAX_CM = 340;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const colName = (c: number): string => String.fromCharCode(65 + c);
export const cellName = (i: number): string => `${colName(i % COLS)}${Math.floor(i / COLS) + 1}`;

const STORMS = [{ day: 1, cm: 38 }, { day: 7, cm: 55 }, { day: 14, cm: 30 }, { day: 20, cm: 64 }];
const OUTAGES = [{ cell: 'E12', from: 9, to: 13 }, { cell: 'Q3', from: 17, to: 29 }, { cell: 'T15', from: 5, to: 5 }];

/** depth[day][cell] in whole centimetres; NaN = no reading. */
export function simulate(seed = SEED): Float32Array[] {
  const rnd = mulberry32(seed);
  const g = () => { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
  const field = new Float32Array(N);
  const sun = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const c = i % COLS, r = Math.floor(i / COLS);
    const windward = c < 7 ? 0.5 + 0.05 * c : 0;
    const lee = c >= 7 ? Math.max(0.75, 1.75 - 0.11 * Math.abs(c - 10)) : 0;
    const hollow = 0.7 * Math.exp(-(((c - 18) / 2.2) ** 2 + ((r - 11) / 1.8) ** 2));
    const gully = c > 13 && (r === 4 || r === 5) ? 0.28 : 0;
    field[i] = (windward || lee) + hollow + gully + g() * 0.06;
    sun[i] = 0.6 + (r / (ROWS - 1)) * 0.9;
  }
  const out: Float32Array[] = [];
  for (let d = 0; d < DAYS; d++) {
    let acc = 18;
    for (const s of STORMS) if (d >= s.day) acc += s.cm * (1 - 0.24 * (1 - Math.exp(-(d - s.day) / 5)));
    const melt = d >= 24 ? (d - 23) * 4.2 : 0;
    const day = new Float32Array(N);
    for (let i = 0; i < N; i++) day[i] = Math.max(0, Math.round(acc * field[i] - melt * sun[i] + g() * 2.4));
    for (const o of OUTAGES) if (d >= o.from && d <= o.to) day[OUTAGES_INDEX[o.cell]] = NaN;
    out.push(day);
  }
  return out;
}
const OUTAGES_INDEX: Record<string, number> = Object.fromEntries(Array.from({ length: N }, (_, i) => [cellName(i), i]));

export interface DayStats { mean: number; max: number; maxCell: number; min: number; minCell: number; reporting: number; deltaMean: number | null }
export function statsFor(days: Float32Array[], d: number): DayStats {
  const v = days[d];
  let sum = 0, n = 0, max = -1, maxCell = 0, min = Infinity, minCell = 0, dSum = 0, dN = 0;
  for (let i = 0; i < N; i++) {
    const x = v[i];
    if (!Number.isFinite(x)) continue;
    sum += x; n++;
    if (x > max) { max = x; maxCell = i; }
    if (x < min) { min = x; minCell = i; }
    if (d > 0 && Number.isFinite(days[d - 1][i])) { dSum += x - days[d - 1][i]; dN++; }
  }
  return { mean: n ? sum / n : NaN, max, maxCell, min, minCell, reporting: n, deltaMean: d > 0 && dN ? dSum / dN : null };
}

/** Sequential single-hue ramp: more snow = more contrast with the page, in both themes. */
export interface Palette { color: (cm: number) => string; missing: string; ground: string; outline: string; low: string; high: string }
export function palette(theme: 'light' | 'dark'): Palette {
  const low = theme === 'dark' ? '#1d2637' : '#dfe6f1';
  const high = theme === 'dark' ? '#d6e4ff' : '#123067';
  const ramp = interpolateLab(low, high);
  const cache = new Map<number, string>();
  return {
    low, high,
    color: (cm) => {
      const k = Math.round(Math.min(MAX_CM, Math.max(0, cm)));
      let c = cache.get(k);
      if (!c) { c = ramp(Math.pow(k / MAX_CM, 0.85)); cache.set(k, c); }
      return c;
    },
    missing: theme === 'dark' ? '#3a3a35' : '#bdb8ab',
    ground: theme === 'dark' ? '#22221e' : '#e9e5da',
    outline: theme === 'dark' ? '#ff5a2b' : '#bf2f09',
  };
}

/** Pick dark or light text for a cell colour by WCAG contrast. */
export function textOn(hex: string): string {
  const nums = hex.startsWith('rgb') ? hex.match(/[\d.]+/g)?.slice(0, 3).map(Number) : hex.match(/[\da-f]{2}/gi)?.map((h) => parseInt(h, 16));
  const rgb = (nums ?? [0, 0, 0]).map((v) => v / 255);
  const lum = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lum(rgb[0]) + 0.7152 * lum(rgb[1]) + 0.0722 * lum(rgb[2]);
  return (L + 0.05) / 0.05 > 1.05 / (L + 0.05) ? '#000000' : '#ffffff';
}

const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const dayLabel = (d: number): string => dayFmt.format(START + d * 86_400_000);
export const cm = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
export const cmSigned = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0, signDisplay: 'exceptZero' });
