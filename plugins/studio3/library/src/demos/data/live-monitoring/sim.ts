/**
 * Switchyard — a SIMULATED stream for a fictional freight company's fleet of AI agents.
 * Each sample is a pure function of (seed, agent, tick), where a tick is one wall-clock second: smooth seeded
 * value-noise for the daily texture, per-tick jitter, and seeded incidents (latency spikes, error bursts,
 * throughput drops) placed by hashing (agent, 4-minute block). Anomaly rules then run over the stream exactly
 * as they would over a real feed; swap `sampleAt()` for a real client and nothing else changes.
 */
export const SEED = 4127;
/** 15 minutes of one-second ticks are kept for display. */
export const CAPACITY = 900;
const WARMUP = 240;
const BASELINE = 120;

export type Tier = 'S' | 'M' | 'L';
export interface AgentSpec { id: string; role: string; tier: Tier; rpm: number; p95: number; err: number; paused?: boolean }
export const AGENTS: readonly AgentSpec[] = [
  { id: 'intake-triage', role: 'Sorts inbound shipper email', tier: 'S', rpm: 48, p95: 1400, err: 0.004 },
  { id: 'invoice-reader', role: 'Extracts invoice fields', tier: 'M', rpm: 36, p95: 2600, err: 0.006 },
  { id: 'customs-docs', role: 'Drafts customs declarations', tier: 'L', rpm: 12, p95: 5200, err: 0.008 },
  { id: 'route-planner', role: 'Plans multi-drop routes', tier: 'L', rpm: 20, p95: 3800, err: 0.003 },
  { id: 'claims-assist', role: 'Summarises damage claims', tier: 'M', rpm: 9, p95: 4400, err: 0.005 },
  { id: 'driver-chat', role: 'Answers driver questions', tier: 'S', rpm: 64, p95: 900, err: 0.002 },
  { id: 'rate-quoter', role: 'Quotes spot rates', tier: 'M', rpm: 30, p95: 1800, err: 0.004 },
  { id: 'dock-scheduler', role: 'Books loading-dock slots', tier: 'S', rpm: 16, p95: 2100, err: 0.003 },
  { id: 'returns-desk', role: 'Handles return requests', tier: 'M', rpm: 22, p95: 1600, err: 0.005 },
  { id: 'eta-notifier', role: 'Sends arrival updates', tier: 'S', rpm: 80, p95: 600, err: 0.002 },
  { id: 'contract-check', role: 'Flags unusual contract clauses', tier: 'L', rpm: 5, p95: 8800, err: 0.006, paused: true },
  { id: 'ledger-recon', role: 'Reconciles carrier invoices', tier: 'L', rpm: 6, p95: 7200, err: 0.006 },
];

export type Kind = 'latency' | 'errors' | 'throughput';
export type Severity = 'critical' | 'major' | 'resolved';
export type Status = 'healthy' | 'degraded' | 'failing' | 'paused';
export interface FleetEvent { id: number; tick: number; agent: number; severity: Severity; kind: Kind; text: string }

interface Rule { open: boolean; since: number; streak: number; calm: number; mean: number; sd: number; peak: number }
interface AgentState { lat: Rule; err: Rule; thr: Rule; latWin: number[]; rpmWin: number[]; errWin: number[] }

export interface Store {
  /** Tick index of buffer position 0, and of the latest sample. */
  n0: number;
  n: number;
  rpm: number[][];
  p95: number[][];
  err: number[][];
  /** Expected p95 band (baseline mean ± 3σ) at each tick. */
  lo: number[][];
  hi: number[][];
  /** Bit flags per tick: 1 latency, 2 errors, 4 throughput anomaly open. */
  flag: number[][];
  state: AgentState[];
  events: FleetEvent[];
  seq: number;
}

/** Stateless integer hash → [0, 1). */
function rnd(salt: number, i: number, k: number): number {
  let h = Math.imul(SEED ^ Math.imul(salt, 0x27d4eb2d), 0x9e3779b1) ^ Math.imul(i + 1, 0x85ebca6b) ^ Math.imul(k | 0, 0xc2b2ae35);
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function smooth(salt: number, i: number, t: number, scale: number): number {
  const x = t / scale, k = Math.floor(x), f = x - k, u = f * f * (3 - 2 * f);
  const a = rnd(salt, i, k), b = rnd(salt, i, k + 1);
  return a + (b - a) * u;
}

const BLOCK = 240;
function incident(i: number, n: number): { lat: number; err: number; thr: number } {
  const out = { lat: 1, err: 0, thr: 1 };
  const k = Math.floor(n / BLOCK);
  for (const kk of [k - 1, k]) {
    if (rnd(11, i, kk) > 0.3) continue;
    const start = kk * BLOCK + Math.floor(rnd(12, i, kk) * (BLOCK - 70));
    const dur = 22 + Math.floor(rnd(13, i, kk) * 45);
    if (n < start || n > start + dur) continue;
    const ramp = Math.min(1, (n - start) / 4, (start + dur - n) / 4);
    const type = rnd(14, i, kk), mag = rnd(15, i, kk);
    if (type < 0.5) out.lat *= 1 + ramp * (1.4 + mag * 2.2);
    else if (type < 0.8) out.err += ramp * (0.03 + mag * 0.06);
    else out.thr *= 1 - ramp * (0.55 + mag * 0.3);
  }
  return out;
}

export function sampleAt(i: number, n: number): { rpm: number; p95: number; err: number } {
  const a = AGENTS[i];
  const inc = incident(i, n);
  return {
    rpm: a.rpm * (0.82 + 0.36 * smooth(21, i, n, 50)) * (0.94 + 0.12 * rnd(22, i, n)) * inc.thr,
    p95: a.p95 * (0.88 + 0.24 * smooth(23, i, n, 35)) * (0.95 + 0.1 * rnd(24, i, n)) * inc.lat,
    err: Math.min(0.5, a.err * (0.5 + smooth(25, i, n, 25)) + inc.err + (rnd(26, i, n) < 0.02 ? 0.008 : 0)),
  };
}

const rule = (): Rule => ({ open: false, since: 0, streak: 0, calm: 0, mean: 0, sd: 0, peak: 0 });
const stats = (w: number[]): { mean: number; sd: number } => {
  if (!w.length) return { mean: 0, sd: 0 };
  let s = 0, s2 = 0;
  for (const v of w) { s += v; s2 += v * v; }
  const mean = s / w.length;
  return { mean, sd: Math.sqrt(Math.max(0, s2 / w.length - mean * mean)) };
};
const msFmt = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat('en-GB', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });

function step(st: Store, n: number, record: boolean): void {
  AGENTS.forEach((spec, i) => {
    const a = st.state[i];
    if (spec.paused) { st.rpm[i].push(NaN); st.p95[i].push(NaN); st.err[i].push(NaN); st.lo[i].push(NaN); st.hi[i].push(NaN); st.flag[i].push(0); return; }
    const smp = sampleAt(i, n);
    const emit = (severity: Severity, kind: Kind, text: string) => { if (record) st.events.push({ id: ++st.seq, tick: n, agent: i, severity, kind, text }); };

    // Latency: z-score against a frozen 2-minute baseline; opens after 3 s above 3σ, clears after 5 s below 1.5σ.
    const L = a.lat;
    const base = L.open ? { mean: L.mean, sd: L.sd } : stats(a.latWin);
    const sd = Math.max(base.sd, base.mean * 0.03);
    const z = base.mean ? (smp.p95 - base.mean) / sd : 0;
    if (!L.open) {
      L.streak = z >= 3 ? L.streak + 1 : 0;
      if (L.streak >= 3 && a.latWin.length >= BASELINE / 2) {
        Object.assign(L, { open: true, since: n - 2, calm: 0, mean: base.mean, sd, peak: smp.p95 });
        emit('major', 'latency', `p95 latency ${msFmt.format(smp.p95)} ms, ${z.toFixed(1)}σ above its 2-minute baseline of ${msFmt.format(base.mean)} ms`);
      }
    } else {
      L.peak = Math.max(L.peak, smp.p95);
      L.calm = z < 1.5 ? L.calm + 1 : 0;
      if (L.calm >= 5) { L.open = false; L.streak = 0; emit('resolved', 'latency', `p95 latency back to ${msFmt.format(smp.p95)} ms after ${n - L.since} s (peak ${msFmt.format(L.peak)} ms)`); }
    }
    if (!L.open) { a.latWin.push(smp.p95); if (a.latWin.length > BASELINE) a.latWin.shift(); }

    // Errors: 10-second mean at or above 2 % for 3 s opens (critical); below 1 % for 10 s clears.
    a.errWin.push(smp.err);
    if (a.errWin.length > 10) a.errWin.shift();
    const e10 = stats(a.errWin).mean;
    const E = a.err;
    if (!E.open) {
      E.streak = e10 >= 0.02 ? E.streak + 1 : 0;
      if (E.streak >= 3) { Object.assign(E, { open: true, since: n - 2, calm: 0, peak: e10 }); emit('critical', 'errors', `error rate ${pctFmt.format(e10)} over 10 s (threshold 2.0%)`); }
    } else {
      E.peak = Math.max(E.peak, e10);
      E.calm = e10 < 0.01 ? E.calm + 1 : 0;
      if (E.calm >= 10) { E.open = false; E.streak = 0; emit('resolved', 'errors', `error rate back to ${pctFmt.format(e10)} after ${n - E.since} s (peak ${pctFmt.format(E.peak)})`); }
    }

    // Throughput: under half the frozen 2-minute average for 5 s opens; back above 75 % for 5 s clears.
    const T = a.thr;
    const tBase = T.open ? T.mean : stats(a.rpmWin).mean;
    const ratio = tBase ? smp.rpm / tBase : 1;
    if (!T.open) {
      T.streak = ratio < 0.5 ? T.streak + 1 : 0;
      if (T.streak >= 5 && a.rpmWin.length >= BASELINE / 2) {
        Object.assign(T, { open: true, since: n - 4, calm: 0, mean: tBase, peak: smp.rpm });
        emit('major', 'throughput', `throughput ${msFmt.format(smp.rpm)} runs/min, ${pctFmt.format(ratio)} of its 2-minute average`);
      }
    } else {
      T.calm = ratio >= 0.75 ? T.calm + 1 : 0;
      if (T.calm >= 5) { T.open = false; T.streak = 0; emit('resolved', 'throughput', `throughput recovered to ${msFmt.format(smp.rpm)} runs/min after ${n - T.since} s`); }
    }
    if (!T.open) { a.rpmWin.push(smp.rpm); if (a.rpmWin.length > BASELINE) a.rpmWin.shift(); }

    st.rpm[i].push(smp.rpm); st.p95[i].push(smp.p95); st.err[i].push(smp.err);
    st.lo[i].push(Math.max(0, base.mean - 3 * sd)); st.hi[i].push(base.mean + 3 * sd);
    st.flag[i].push((L.open ? 1 : 0) | (E.open ? 2 : 0) | (T.open ? 4 : 0));
  });
  st.n = n;
}

function trim(st: Store): void {
  const over = st.rpm[0].length - CAPACITY;
  if (over <= 0) return;
  for (const arr of [st.rpm, st.p95, st.err, st.lo, st.hi, st.flag]) for (const a of arr) a.splice(0, over);
  st.n0 += over;
  const keepFrom = st.n0;
  if (st.events.length > 240) st.events.splice(0, st.events.length - 240);
  while (st.events.length && st.events[0].tick < keepFrom - CAPACITY) st.events.shift();
}

export function createStore(now: number): Store {
  const first = now - CAPACITY - WARMUP + 1;
  const mk = () => AGENTS.map(() => [] as number[]);
  const st: Store = {
    n0: first, n: first - 1, rpm: mk(), p95: mk(), err: mk(), lo: mk(), hi: mk(), flag: mk(),
    state: AGENTS.map(() => ({ lat: rule(), err: rule(), thr: rule(), latWin: [], rpmWin: [], errWin: [] })), events: [], seq: 0,
  };
  for (let n = first; n <= now; n++) { step(st, n, n > first + WARMUP); trim(st); }
  return st;
}

/** Append every tick up to `now` (catch-up after a throttled background tab is capped at the buffer size). */
export function advance(st: Store, now: number): void {
  if (now <= st.n) return;
  if (now - st.n > CAPACITY) { Object.assign(st, createStore(now)); return; }
  for (let n = st.n + 1; n <= now; n++) { step(st, n, true); trim(st); }
}

export function statusOf(st: Store, i: number, flags: number): Status {
  if (AGENTS[i].paused) return 'paused';
  return flags & 2 ? 'failing' : flags & 5 ? 'degraded' : 'healthy';
}
