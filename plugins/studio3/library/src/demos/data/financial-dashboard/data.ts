/**
 * Fernhollow Multi-Asset Fund — a FICTIONAL fund. Every figure on the page is generated here, in the browser,
 * from one fixed seed: a five-sleeve factor model (one shared market factor + seeded noise), a fee accrual,
 * quarterly rebalancing to target weights, a 60/40 composite built from the same sleeves, and twelve invented
 * instruments whose prices follow their sleeve plus idiosyncratic noise. Nothing here describes a real market.
 * Replacing `simulateFund()` with a real feed is the only change a production build would need.
 */
export const LOCALE = 'en-GB';
export const SEED = 366;
export const DAY = 86_400_000;
/** Simulated calendar: weekdays only, no holidays. */
export const START = Date.UTC(2023, 10, 20);
export const END = Date.UTC(2026, 10, 20);
export const UNITS = 4_312_870;
/** Rebalancing band around each target weight. */
export const BAND = 0.02;
const FEE = 0.006 / 252;

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
const gaussian = (rnd: () => number): number => {
  let u = 0;
  while (u === 0) u = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
};

export type SleeveId = 'eq' | 'ig' | 'ra' | 'sc' | 'cash';
export interface Sleeve { id: SleeveId; name: string; target: number; mu: number; sigma: number; load: number }
export const SLEEVES: readonly Sleeve[] = [
  { id: 'eq', name: 'Global equity', target: 0.45, mu: 0.075, sigma: 0.15, load: 0.92 },
  { id: 'ig', name: 'Investment-grade bonds', target: 0.25, mu: 0.035, sigma: 0.055, load: -0.18 },
  { id: 'ra', name: 'Real assets', target: 0.12, mu: 0.055, sigma: 0.11, load: 0.6 },
  { id: 'sc', name: 'Short-dated credit', target: 0.1, mu: 0.047, sigma: 0.035, load: 0.3 },
  { id: 'cash', name: 'Cash & deposits', target: 0.08, mu: 0.041, sigma: 0.001, load: 0 },
];
export const sleeveName = (id: SleeveId): string => SLEEVES.find((s) => s.id === id)?.name ?? id;

/** Seeded market episodes (extra daily drift, volatility multiplier) so the history has a correction, a recovery and a rally. */
const EPISODES: readonly { from: number; to: number; drift: Partial<Record<SleeveId, number>>; vol: number }[] = [
  { from: Date.UTC(2024, 7, 1), to: Date.UTC(2024, 7, 9), drift: { eq: -0.006, ra: -0.002 }, vol: 1.5 },
  { from: Date.UTC(2025, 2, 10), to: Date.UTC(2025, 3, 8), drift: { eq: -0.0062, ra: -0.0035 }, vol: 1.7 },
  { from: Date.UTC(2025, 3, 9), to: Date.UTC(2025, 5, 20), drift: { eq: 0.0024, ra: 0.0012 }, vol: 1.2 },
  { from: Date.UTC(2026, 7, 3), to: Date.UTC(2026, 7, 21), drift: { eq: -0.0028, ra: -0.001 }, vol: 1.3 },
  { from: Date.UTC(2026, 9, 1), to: END, drift: { eq: 0.0027, ig: -0.0003 }, vol: 1 },
];

interface InstrumentSpec { code: string; name: string; sleeve: SleeveId; share: number; idio: number; p0: number; bond?: boolean; shock?: number }
const INSTRUMENTS: readonly InstrumentSpec[] = [
  { code: 'FH-EQ-014', name: 'Harrowmere Industrials', sleeve: 'eq', share: 0.29, idio: 0.011, p0: 38.2 },
  { code: 'FH-EQ-027', name: 'Quillon Semiconductor', sleeve: 'eq', share: 0.24, idio: 0.017, p0: 142.6, shock: -3.9 },
  { code: 'FH-EQ-031', name: 'Brackenfield Foods', sleeve: 'eq', share: 0.19, idio: 0.008, p0: 21.45 },
  { code: 'FH-EQ-046', name: 'Tessaly Health Systems', sleeve: 'eq', share: 0.28, idio: 0.012, p0: 64.1 },
  { code: 'FH-IG-102', name: 'Kestrel Water 4.10% 2033', sleeve: 'ig', share: 0.38, idio: 0.0016, p0: 98.4, bond: true },
  { code: 'FH-IG-117', name: 'Arden Rail 3.60% 2031', sleeve: 'ig', share: 0.34, idio: 0.0014, p0: 96.1, bond: true },
  { code: 'FH-IG-125', name: 'Merrow Power 4.80% 2036', sleeve: 'ig', share: 0.28, idio: 0.0019, p0: 101.2, bond: true },
  { code: 'FH-RA-203', name: 'Larchmont Logistics Trust', sleeve: 'ra', share: 0.55, idio: 0.009, p0: 18.4 },
  { code: 'FH-RA-219', name: 'Fennick Wind Partners', sleeve: 'ra', share: 0.45, idio: 0.01, p0: 12.7 },
  { code: 'FH-SC-301', name: 'Oriel Financing 5.20% 2027', sleeve: 'sc', share: 0.52, idio: 0.0008, p0: 100.3, bond: true },
  { code: 'FH-SC-318', name: 'Pendle Leasing 4.95% 2028', sleeve: 'sc', share: 0.48, idio: 0.0009, p0: 99.6, bond: true },
  { code: 'FH-CA-900', name: 'Sterling cash & deposits', sleeve: 'cash', share: 1, idio: 0, p0: 1 },
];

export interface Position {
  code: string; name: string; sleeve: SleeveId; bond: boolean;
  units: number; price: number; avgCost: number; value: number; weight: number; dayPct: number; pnl: number;
  /** Daily close for every trading day. */
  history: Float64Array;
  /** Day move in multiples of the 60-day standard deviation of daily moves. */
  z: number;
}

export type Severity = 'critical' | 'major' | 'minor' | 'resolved';
export interface Alert { id: string; severity: Severity; title: string; rule: string; at: number }

export interface FundData {
  dates: number[];
  nav: Float64Array;
  composite: Float64Array;
  weights: Record<SleeveId, Float64Array>;
  /** Daily sleeve returns (before fees). */
  rets: Record<SleeveId, Float64Array>;
  rebalances: number[];
  positions: Position[];
  alerts: Alert[];
}

function tradingDays(): number[] {
  const out: number[] = [];
  for (let t = START; t <= END; t += DAY) {
    const wd = new Date(t).getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(t);
  }
  return out;
}

export function simulateFund(seed = SEED): FundData {
  const rnd = mulberry32(seed);
  const dates = tradingDays();
  const n = dates.length;
  const rets = Object.fromEntries(SLEEVES.map((s) => [s.id, new Float64Array(n)])) as Record<SleeveId, Float64Array>;
  for (let t = 1; t < n; t++) {
    const ep = EPISODES.find((e) => dates[t] >= e.from && dates[t] <= e.to);
    const m = gaussian(rnd);
    for (const s of SLEEVES) {
      const vol = ep && (s.id === 'eq' || s.id === 'ra') ? ep.vol : 1;
      const z = s.load * m + Math.sqrt(1 - s.load * s.load) * gaussian(rnd);
      rets[s.id][t] = s.mu / 252 + (s.sigma / Math.sqrt(252)) * vol * z + (ep?.drift[s.id] ?? 0);
    }
  }

  // Fund: sleeve holdings drift with their returns, pay the fee daily, and reset to target at each quarter end.
  const nav = new Float64Array(n);
  const composite = new Float64Array(n);
  const weights = Object.fromEntries(SLEEVES.map((s) => [s.id, new Float64Array(n)])) as Record<SleeveId, Float64Array>;
  let h = SLEEVES.map((s) => s.target * 100);
  nav[0] = 100;
  composite[0] = 100;
  SLEEVES.forEach((s) => { weights[s.id][0] = s.target; });
  const rebalances = [0];
  for (let t = 1; t < n; t++) {
    h = h.map((v, j) => v * (1 + rets[SLEEVES[j].id][t]) * (1 - FEE));
    const total = h.reduce((a, b) => a + b, 0);
    nav[t] = total;
    composite[t] = composite[t - 1] * (1 + 0.6 * rets.eq[t] + 0.4 * rets.ig[t]);
    const month = new Date(dates[t]).getUTCMonth();
    if (t < n - 1 && month % 3 === 2 && new Date(dates[t + 1]).getUTCMonth() !== month) {
      h = SLEEVES.map((s) => s.target * total);
      rebalances.push(t);
    }
    SLEEVES.forEach((s, j) => { weights[s.id][t] = h[j] / total; });
  }

  // Instruments: sleeve return (bonds without their carry, so prices hover near par) plus idiosyncratic noise.
  const last = n - 1;
  const aum = UNITS * nav[last];
  const positions: Position[] = INSTRUMENTS.map((spec) => {
    const sleeve = SLEEVES.find((s) => s.id === spec.sleeve)!;
    const history = new Float64Array(n);
    history[0] = spec.p0;
    for (let t = 1; t < n; t++) {
      if (spec.sleeve === 'cash') { history[t] = 1; continue; }
      const noise = t === last && spec.shock ? spec.shock * spec.idio : spec.idio * gaussian(rnd);
      const r = rets[spec.sleeve][t] - (spec.bond ? sleeve.mu / 252 : 0);
      history[t] = history[t - 1] * (1 + r + noise);
    }
    const price = history[last];
    const value = aum * weights[spec.sleeve][last] * spec.share;
    const units = Math.round(value / price);
    const k = Math.floor(n * (0.15 + 0.5 * rnd()));
    const avgCost = spec.sleeve === 'cash' ? 1 : history[k] * (1 + 0.015 * gaussian(rnd));
    const moves: number[] = [];
    for (let t = last - 60; t < last; t++) moves.push(history[t] / history[t - 1] - 1);
    const mean = moves.reduce((a, b) => a + b, 0) / moves.length;
    const sd = Math.sqrt(moves.reduce((a, b) => a + (b - mean) ** 2, 0) / (moves.length - 1));
    const dayPct = price / history[last - 1] - 1;
    return {
      code: spec.code, name: spec.name, sleeve: spec.sleeve, bond: !!spec.bond,
      units, price, avgCost, value: units * price, weight: 0, dayPct, pnl: (price - avgCost) * units, history,
      z: sd > 0 ? dayPct / sd : 0,
    };
  });
  const held = positions.reduce((a, p) => a + p.value, 0);
  positions.forEach((p) => { p.weight = p.value / held; });

  return { dates, nav, composite, weights, rets, rebalances, positions, alerts: deriveAlerts(dates, nav, weights, rebalances, positions) };
}

/** Alerts come from rules evaluated on the simulated data — none is written by hand. */
function deriveAlerts(dates: number[], nav: Float64Array, weights: Record<SleeveId, Float64Array>, rebalances: number[], positions: Position[]): Alert[] {
  const out: Alert[] = [];
  const last = dates.length - 1;
  const lastReb = rebalances[rebalances.length - 1];
  for (const s of SLEEVES) {
    const d = weights[s.id][last] - s.target;
    if (Math.abs(d) <= BAND) continue;
    let since = last;
    while (since - 1 > lastReb && Math.abs(weights[s.id][since - 1] - s.target) > BAND) since--;
    out.push({
      id: `drift-${s.id}`, severity: 'major', at: dates[since],
      title: `${s.name} ${fmt.pp(d * 100)} ${d > 0 ? 'over' : 'under'} target`,
      rule: `Weight outside the ±2.0 pp band (${fmt.pct1.format(weights[s.id][last])} vs ${fmt.pct1.format(s.target)} target) since the ${fmt.dateShort.format(dates[lastReb])} rebalance.`,
    });
  }
  for (const p of positions) {
    if (Math.abs(p.z) < 3) continue;
    out.push({
      id: `move-${p.code}`, severity: 'minor', at: dates[last],
      title: `${p.name} ${fmt.pctSigned2.format(p.dayPct)} on the day`,
      rule: `Daily move of ${fmt.ratio.format(Math.abs(p.z))}× its 60-day standard deviation (threshold 3×).`,
    });
  }
  // Drawdown watch: opens below −5 % from the running peak, clears above −2 %.
  let peak = nav[0], open = -1, trough = 0;
  let resolved: Alert | null = null;
  for (let t = 0; t <= last; t++) {
    peak = Math.max(peak, nav[t]);
    const dd = nav[t] / peak - 1;
    if (open < 0 && dd < -0.05) { open = t; trough = dd; }
    if (open >= 0) {
      trough = Math.min(trough, dd);
      if (dd > -0.02) {
        resolved = {
          id: `dd-${open}`, severity: 'resolved', at: dates[t],
          title: 'Drawdown watch cleared',
          rule: `Fund more than 5% below its peak from ${(new Date(dates[open]).getUTCFullYear() === new Date(dates[t]).getUTCFullYear() ? fmt.dateShort : fmt.date).format(dates[open])} to ${fmt.date.format(dates[t])}: ${t - open} trading days, trough ${fmt.pct1.format(trough)}.`,
        };
        open = -1;
      }
    }
  }
  if (open >= 0) {
    out.unshift({ id: `dd-${open}`, severity: 'critical', at: dates[open], title: 'Drawdown watch open', rule: `Fund more than 5% below its peak since ${fmt.date.format(dates[open])} (trough ${fmt.pct1.format(trough)}).` });
  }
  if (resolved) out.push(resolved);
  return out;
}

export type PresetId = '1M' | '3M' | 'YTD' | '1Y' | '3Y';
export const PRESETS: readonly { id: PresetId; label: string; name: string }[] = [
  { id: '1M', label: '1M', name: 'one month' }, { id: '3M', label: '3M', name: 'three months' },
  { id: 'YTD', label: 'YTD', name: 'year to date' }, { id: '1Y', label: '1Y', name: 'one year' }, { id: '3Y', label: '3Y', name: 'three years' },
];
/** Window start is the close on or before the period start, so a range's return is measured from a real close. */
export function presetWindow(dates: number[], id: PresetId): [number, number] {
  const b = dates.length - 1;
  const end = new Date(dates[b]);
  const from = id === '3Y' ? dates[0]
    : id === 'YTD' ? Date.UTC(end.getUTCFullYear(), 0, 1) - DAY
    : Date.UTC(end.getUTCFullYear() - (id === '1Y' ? 1 : 0), end.getUTCMonth() - (id === '1M' ? 1 : id === '3M' ? 3 : 0), end.getUTCDate());
  let a = 0;
  for (let i = 0; i <= b; i++) if (dates[i] <= from) a = i;
  return [a, b];
}

export interface WindowStats { fundRet: number; compRet: number; excessPp: number; vol: number; compVol: number; mdd: number; troughIdx: number; days: number }
export function windowStats(d: FundData, a: number, b: number): WindowStats {
  const vol = (v: Float64Array) => {
    let s = 0, s2 = 0, k = 0;
    for (let i = a + 1; i <= b; i++) { const lr = Math.log(v[i] / v[i - 1]); s += lr; s2 += lr * lr; k++; }
    return k > 1 ? Math.sqrt(Math.max(0, (s2 - (s * s) / k) / (k - 1)) * 252) : 0;
  };
  let peak = d.nav[a], mdd = 0, troughIdx = a;
  for (let i = a; i <= b; i++) {
    peak = Math.max(peak, d.nav[i]);
    const dd = d.nav[i] / peak - 1;
    if (dd < mdd) { mdd = dd; troughIdx = i; }
  }
  const fundRet = d.nav[b] / d.nav[a] - 1;
  const compRet = d.composite[b] / d.composite[a] - 1;
  return { fundRet, compRet, excessPp: (fundRet - compRet) * 100, vol: vol(d.nav), compVol: vol(d.composite), mdd, troughIdx, days: b - a };
}

/**
 * Return attribution over [a, b]: each sleeve's contribution is the sum of its start-of-day weight × its daily return.
 * Fees and compounding are reported as their own rows, so the rows reconcile exactly to the fund's return.
 */
export function contributions(d: FundData, a: number, b: number): { rows: { id: SleeveId; name: string; pp: number }[]; fees: number; other: number; total: number } {
  const rows = SLEEVES.map((s) => {
    let c = 0;
    for (let t = a + 1; t <= b; t++) c += d.weights[s.id][t - 1] * d.rets[s.id][t];
    return { id: s.id, name: s.name, pp: c * 100 };
  });
  const fees = -FEE * (b - a) * 100;
  const total = (d.nav[b] / d.nav[a] - 1) * 100;
  return { rows, fees, other: total - fees - rows.reduce((x, r) => x + r.pp, 0), total };
}

const nf = (o: Intl.NumberFormatOptions) => new Intl.NumberFormat(LOCALE, o);
const df = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', ...o });
const ppFmt = nf({ signDisplay: 'exceptZero', minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** Formatters are built once (they are expensive) and shared by every panel. */
export const fmt = {
  gbp: nf({ style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  gbpK: nf({ maximumFractionDigits: 0 }),
  gbpKSigned: nf({ maximumFractionDigits: 0, signDisplay: 'exceptZero' }),
  gbpCompact: nf({ style: 'currency', currency: 'GBP', notation: 'compact', minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  price: nf({ minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  int: nf({ maximumFractionDigits: 0 }),
  index: nf({ minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  ratio: nf({ minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  pct1: nf({ style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  pctSigned1: nf({ style: 'percent', signDisplay: 'exceptZero', minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  pctSigned2: nf({ style: 'percent', signDisplay: 'exceptZero', minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  pp: (v: number): string => `${ppFmt.format(v)} pp`,
  date: df({ day: 'numeric', month: 'short', year: 'numeric' }),
  dateLong: df({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
  dateShort: df({ day: 'numeric', month: 'short' }),
  month: df({ month: 'short' }),
  monthYear: df({ month: 'short', year: 'numeric' }),
  year: df({ year: 'numeric' }),
  iso: (t: number): string => new Date(t).toISOString().slice(0, 10),
};
