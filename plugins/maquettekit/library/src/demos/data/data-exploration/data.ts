/**
 * Cupping-lot explorer — SAMPLE DATA. Four fictional growing regions, their cooperatives, farms and lots are generated
 * from one seed: altitude by region/coop/farm, a cup score with an altitude trend, process and variety effects, a farm
 * effect and noise (rounded to quarter points like a cupping form), and a yield that falls with altitude. Nothing here
 * describes a real origin, producer or harvest.
 */
export const SEED = 1730;
export const ALT: readonly [number, number] = [900, 2300];
export const SCORE: readonly [number, number] = [80, 90];

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

export type Process = 'washed' | 'natural' | 'honey';
export type Variety = 'bourbon' | 'typica' | 'caturra' | 'hybrid';
export type Level = 'root' | 'region' | 'coop' | 'farm';
export const PROCESSES: readonly { id: Process; label: string }[] = [{ id: 'washed', label: 'Washed' }, { id: 'natural', label: 'Natural' }, { id: 'honey', label: 'Honey' }];
export const VARIETIES: readonly { id: Variety; label: string }[] = [{ id: 'bourbon', label: 'Bourbon' }, { id: 'typica', label: 'Typica' }, { id: 'caturra', label: 'Caturra' }, { id: 'hybrid', label: 'Hybrid' }];
const PROC_FX: Record<Process, number> = { washed: 0, natural: 0.35, honey: 0.2 };
const VAR_FX: Record<Variety, number> = { bourbon: 0.3, typica: 0.45, caturra: 0, hybrid: -0.7 };

const REGIONS = [
  { id: 'kr', name: 'Kettle Ridge', base: 1650, coops: ['Upper Terraces', 'Mill Brook'] },
  { id: 'mb', name: 'Morrow Basin', base: 1220, coops: ['Basin Growers', 'Ferry Road', 'Lowfield'] },
  { id: 'sh', name: 'Sable Hills', base: 1880, coops: ['High Sable', 'Crown Pass'] },
  { id: 'lv', name: 'Lantern Valley', base: 1460, coops: ['Lantern North', 'Weir Side', 'Orchard Bend'] },
] as const;
const PRE = ['Ash', 'Bramble', 'Cinder', 'Dove', 'Elm', 'Fallow', 'Gorse', 'Hazel', 'Ivy', 'Juniper', 'Kestrel', 'Lark', 'Mill', 'Nettle', 'Oak', 'Pine', 'Quarry', 'Rook', 'Sloe', 'Thorn', 'Vetch', 'Wren', 'Yarrow', 'Bracken'];
const SUF = ['grove', 'hill', 'patch', 'cote', 'stead', 'mere', 'end', 'rise', 'shelf', 'bank', 'field', 'fold', 'edge', 'croft', 'top', 'wood'];

export interface TreeNode { id: string; name: string; level: Exclude<Level, 'root'>; parent: string | null }
export interface Lot {
  id: string; region: string; coop: string; farm: string;
  altitude: number; score: number; yield: number; process: Process; variety: Variety; harvest: number;
}

export function buildDataset(seed = SEED): { nodes: Map<string, TreeNode>; lots: Lot[] } {
  const rnd = mulberry32(seed);
  const g = () => { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const nodes = new Map<string, TreeNode>();
  const lots: Lot[] = [];
  const used = new Set<string>();
  const farmName = () => {
    for (;;) {
      const n = PRE[Math.floor(rnd() * PRE.length)] + SUF[Math.floor(rnd() * SUF.length)];
      if (!used.has(n)) { used.add(n); return n; }
    }
  };
  for (const r of REGIONS) {
    nodes.set(r.id, { id: r.id, name: r.name, level: 'region', parent: null });
    r.coops.forEach((cName, ci) => {
      const cid = `${r.id}.${ci + 1}`;
      nodes.set(cid, { id: cid, name: cName, level: 'coop', parent: r.id });
      const coopAlt = r.base + g() * 110;
      const farms = 4 + Math.floor(rnd() * 3);
      for (let fi = 0; fi < farms; fi++) {
        const fid = `${cid}.${fi + 1}`;
        nodes.set(fid, { id: fid, name: farmName(), level: 'farm', parent: cid });
        const farmAlt = coopAlt + g() * 130;
        const farmFx = g() * 0.55;
        const mainVar = VARIETIES[Math.floor(rnd() * VARIETIES.length)].id;
        const mainProc = PROCESSES[Math.floor(rnd() * PROCESSES.length)].id;
        const count = 4 + Math.floor(rnd() * 6);
        for (let li = 0; li < count; li++) {
          const altitude = Math.round(clamp(farmAlt + g() * 55, ALT[0] + 20, ALT[1] - 20) / 5) * 5;
          const variety = rnd() < 0.7 ? mainVar : VARIETIES[Math.floor(rnd() * VARIETIES.length)].id;
          const process = rnd() < 0.6 ? mainProc : PROCESSES[Math.floor(rnd() * PROCESSES.length)].id;
          const raw = 82.8 + 0.0029 * (altitude - 1000) + PROC_FX[process] + VAR_FX[variety] + farmFx + g() * (process === 'natural' ? 0.8 : 0.55);
          lots.push({
            id: `${r.id.toUpperCase()}-${ci + 1}${String(fi + 1).padStart(2, '0')}-${li + 1}`,
            region: r.id, coop: cid, farm: fid, altitude, process, variety,
            score: Math.round(clamp(raw, SCORE[0] + 0.25, SCORE[1] - 0.25) * 4) / 4,
            yield: Math.round(clamp(2600 - 0.55 * altitude + g() * 240 + (variety === 'hybrid' ? 380 : 0), 380, 2600) / 10) * 10,
            harvest: rnd() < 0.5 ? 2025 : 2026,
          });
        }
      }
    });
  }
  return { nodes, lots };
}

/* ── statistics ─────────────────────────────────────────────── */
export const mean = (v: number[]): number => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);
export function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const p = (sorted.length - 1) * q, i = Math.floor(p), f = p - i;
  return i + 1 < sorted.length ? sorted[i] + (sorted[i + 1] - sorted[i]) * f : sorted[i];
}
export function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 3) return NaN;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
}
export interface Summary { n: number; mean: number; median: number; p10: number; p90: number; share86: number }
export function summarise(lots: Lot[]): Summary {
  const s = lots.map((l) => l.score).sort((a, b) => a - b);
  return { n: s.length, mean: mean(s), median: quantile(s, 0.5), p10: quantile(s, 0.1), p90: quantile(s, 0.9), share86: s.length ? s.filter((v) => v >= 86).length / s.length : NaN };
}

/* ── URL-hash state ─────────────────────────────────────────── */
export type CompareDim = 'process' | 'variety' | 'region';
export type SortKey = 'id' | 'farm' | 'altitude' | 'score' | 'yield' | 'process' | 'variety';
export interface ViewState {
  proc: Process[];
  vari: Variety[];
  /** Drill-down path of node ids, root first (region, coop, farm). */
  path: string[];
  alt: [number, number] | null;
  score: [number, number] | null;
  cmp: { dim: CompareDim; a: string; b: string } | null;
  sort: { key: SortKey; dir: 1 | -1 };
  pin: string | null;
}
export const DEFAULT_STATE: ViewState = {
  proc: PROCESSES.map((p) => p.id), vari: VARIETIES.map((v) => v.id), path: [], alt: null, score: null, cmp: null,
  sort: { key: 'score', dir: -1 }, pin: null,
};
const SORT_KEYS: readonly SortKey[] = ['id', 'farm', 'altitude', 'score', 'yield', 'process', 'variety'];

export function encodeState(s: ViewState): string {
  const q = new URLSearchParams();
  if (s.proc.length !== PROCESSES.length) q.set('process', s.proc.join(','));
  if (s.vari.length !== VARIETIES.length) q.set('variety', s.vari.join(','));
  if (s.path.length) q.set('at', s.path[s.path.length - 1]);
  if (s.alt) q.set('alt', `${s.alt[0]}-${s.alt[1]}`);
  if (s.score) q.set('score', `${s.score[0]}-${s.score[1]}`);
  if (s.cmp) q.set('compare', `${s.cmp.dim}:${s.cmp.a}:${s.cmp.b}`);
  if (s.sort.key !== 'score' || s.sort.dir !== -1) q.set('sort', `${s.sort.key}:${s.sort.dir === 1 ? 'asc' : 'desc'}`);
  if (s.pin) q.set('lot', s.pin);
  return q.toString().replace(/%2C/g, ',').replace(/%3A/g, ':');
}

export function decodeState(hash: string, nodes: Map<string, TreeNode>, lotIds: Set<string>): ViewState {
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  const list = <T extends string>(v: string | null, all: readonly { id: T }[]): T[] => {
    if (v === null) return all.map((x) => x.id);
    const ids = v.split(',').filter((x): x is T => all.some((a) => a.id === x));
    return ids.length ? ids : all.map((x) => x.id);
  };
  const range = (v: string | null, lim: readonly [number, number]): [number, number] | null => {
    const m = v?.match(/^(-?[\d.]+)-(-?[\d.]+)$/);
    if (!m) return null;
    const a = Math.max(lim[0], Number(m[1])), b = Math.min(lim[1], Number(m[2]));
    return Number.isFinite(a) && Number.isFinite(b) && b > a ? [a, b] : null;
  };
  const path: string[] = [];
  for (let id = q.get('at'); id && nodes.has(id); id = nodes.get(id)!.parent) path.unshift(id);
  const [dim, a, b] = (q.get('compare') ?? '').split(':');
  const dims: Record<CompareDim, readonly { id: string }[]> = { process: PROCESSES, variety: VARIETIES, region: [...nodes.values()].filter((n) => n.level === 'region') };
  const cmp = (dim === 'process' || dim === 'variety' || dim === 'region') && dims[dim].some((x) => x.id === a) && dims[dim].some((x) => x.id === b) && a !== b ? { dim: dim as CompareDim, a, b } : null;
  const [sk, sd] = (q.get('sort') ?? '').split(':');
  const lot = q.get('lot');
  return {
    proc: list(q.get('process'), PROCESSES), vari: list(q.get('variety'), VARIETIES), path,
    alt: range(q.get('alt'), ALT), score: range(q.get('score'), SCORE), cmp,
    sort: SORT_KEYS.includes(sk as SortKey) ? { key: sk as SortKey, dir: sd === 'asc' ? 1 : -1 } : DEFAULT_STATE.sort,
    pin: lot && lotIds.has(lot) ? lot : null,
  };
}

const nf1 = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmt = {
  score: (v: number) => (Number.isFinite(v) ? nf2.format(v) : '—'),
  mean: (v: number) => (Number.isFinite(v) ? nf1.format(v) : '—'),
  int: new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }),
  pct: new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 0 }),
  signed1: new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero' }),
  r: new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' }),
};
