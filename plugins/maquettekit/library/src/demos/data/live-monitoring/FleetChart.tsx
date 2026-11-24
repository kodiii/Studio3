'use client';
/**
 * Fleet / agent time-series panel. Every window is resampled to N points, so switching 1 → 5 → 15 minutes
 * interpolates the values and the y-domain together (the line-chart-morph recipe's technique, effects/line-chart-morph);
 * live ticks and agent switches redraw directly — a change of metric has no meaningful in-between state.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { easeCubicInOut, scaleLinear } from 'd3';
import { duration as D, useElementSize, useStudioMotion } from '../../../motion';
import s from './styles.module.css';

export const N = 240;
export interface ChartData {
  mode: 'fleet' | 'agent';
  /** fleet: total runs/min, failed runs/min. agent: p95 ms, expected band low/high, anomaly flags. */
  a: Float64Array;
  b: Float64Array;
  c: Float64Array | null;
  flags: Uint8Array | null;
  t0: number;
  t1: number;
  markers: { tick: number; severity: 'critical' | 'major' }[];
}
interface Shown { a: Float64Array; b: Float64Array; c: Float64Array | null; yMax: number; yMax2: number }

const M = { top: 18, right: 10, bottom: 24, left: 46 };
const nf = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const hm = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
const hms = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' });

const niceMax = (arr: Float64Array, min = 1): number => {
  let m = 0;
  for (const v of arr) m = Math.max(m, v);
  return scaleLinear().domain([0, Math.max(min, m) * 1.1]).nice(3).domain()[1];
};
const yMaxOf = (d: ChartData): number => {
  let m = 0;
  for (const v of d.a) m = Math.max(m, v);
  if (d.mode === 'agent' && d.c) for (const v of d.c) m = Math.max(m, v);
  return scaleLinear().domain([0, Math.max(1, m) * 1.08]).nice(4).domain()[1];
};

export function FleetChart({ data, modeKey, windowKey, label }: { data: ChartData; modeKey: string; windowKey: number; label: string }) {
  const { reduced, scale } = useStudioMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(ref);
  const target: Shown = useMemo(() => ({ a: data.a, b: data.b, c: data.c, yMax: yMaxOf(data), yMax2: data.mode === 'fleet' ? niceMax(data.b, 4) : 1 }), [data]);
  const [shown, setShown] = useState<Shown>(target);
  const live = useRef(target);
  live.current = target;
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const keys = useRef({ modeKey, windowKey });
  const tween = useRef(0);

  useEffect(() => {
    const prev = keys.current;
    keys.current = { modeKey, windowKey };
    if (prev.modeKey !== modeKey || reduced) { cancelAnimationFrame(tween.current); tween.current = 0; setShown(target); return; }
    if (prev.windowKey === windowKey) { if (!tween.current) setShown(target); return; }
    cancelAnimationFrame(tween.current);
    const from = shownRef.current;
    const dur = D.moderate * 1.2 * scale.duration;
    let t0 = 0;
    const lerp = (p: Float64Array, q: Float64Array, e: number) => { const o = new Float64Array(N); for (let k = 0; k < N; k++) o[k] = p[k] + (q[k] - p[k]) * e; return o; };
    const frame = (now: number) => {
      if (!t0) t0 = now;
      const p = Math.min(1, (now - t0) / dur);
      const to = live.current; // retarget to the latest tick every frame
      if (p >= 1) { tween.current = 0; setShown(to); return; }
      const e = easeCubicInOut(p);
      setShown({ a: lerp(from.a, to.a, e), b: lerp(from.b, to.b, e), c: from.c && to.c ? lerp(from.c, to.c, e) : to.c, yMax: from.yMax + (to.yMax - from.yMax) * e, yMax2: from.yMax2 + (to.yMax2 - from.yMax2) * e });
      tween.current = requestAnimationFrame(frame);
    };
    tween.current = requestAnimationFrame(frame);
  }, [target, modeKey, windowKey, reduced, scale.duration]);
  useEffect(() => () => cancelAnimationFrame(tween.current), []);

  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = Math.max(0, height - M.top - M.bottom);
  const ready = innerW > 40 && innerH > 40;
  // Fleet mode: two aligned bands on one time axis — all runs, then failed runs on their own zero-based scale.
  const fleet = data.mode === 'fleet';
  const GAP = 26;
  const topH = fleet ? Math.round((innerH - GAP) * 0.6) : innerH;
  const y = scaleLinear().domain([0, shown.yMax]).range([M.top + topH, M.top]);
  const y2 = scaleLinear().domain([0, shown.yMax2]).range([M.top + innerH, M.top + topH + GAP]);
  const x = (k: number) => M.left + (k / (N - 1)) * innerW;
  const xt = (tick: number) => M.left + ((tick - data.t0) / Math.max(1, data.t1 - data.t0)) * innerW;
  const pathOf = (arr: Float64Array, sy = y) => { let d = ''; for (let k = 0; k < N; k++) d += `${k ? 'L' : 'M'}${x(k).toFixed(1)} ${sy(arr[k]).toFixed(1)}`; return d; };
  const areaOf = (top: Float64Array, bottom: Float64Array | null, sy = y) => {
    let d = pathOf(top, sy);
    for (let k = N - 1; k >= 0; k--) d += `L${x(k).toFixed(1)} ${sy(bottom ? bottom[k] : 0).toFixed(1)}`;
    return `${d}Z`;
  };
  const flagged = () => {
    if (!data.flags) return '';
    let d = '';
    for (let k = 0; k < N; k++) if (data.flags[k]) d += `${k && data.flags[k - 1] ? 'L' : 'M'}${x(k).toFixed(1)} ${y(shown.a[k]).toFixed(1)}`;
    return d;
  };

  const span = data.t1 - data.t0;
  const stepS = span <= 60 ? 15 : span <= 300 ? 60 : 180;
  const ticks: number[] = [];
  for (let t = Math.ceil(data.t0 / stepS) * stepS; t <= data.t1; t += stepS) ticks.push(t);

  return (
    <div ref={ref} className={s.plot} role="img" aria-label={label}>
      {ready && (
        <svg width={width} height={height} aria-hidden="true" className={s.svg}>
          {[{ sc: y, n: fleet ? 3 : 4, key: 'a' }, ...(fleet ? [{ sc: y2, n: 2, key: 'b' }] : [])].map(({ sc, n, key }) => sc.ticks(n).map((v) => (
            <g key={`${key}${v}`} transform={`translate(0 ${sc(v).toFixed(1)})`}>
              <line x1={M.left} x2={M.left + innerW} className={v === 0 ? s.baseline : s.grid} />
              <text x={M.left - 8} y={4} textAnchor="end" className={s.tick}>{nf.format(v)}</text>
            </g>
          )))}
          {fleet && (
            <>
              <text x={M.left + 6} y={M.top + 12} className={s.bandLabel}>All runs / min</text>
              <text x={M.left + 6} y={M.top + topH + GAP + 12} className={s.bandLabel}>Failed runs / min · own scale</text>
            </>
          )}
          {ticks.map((t) => {
            const px = xt(t);
            return (
              <text key={t} x={px} y={M.top + innerH + 17} textAnchor={px < M.left + 24 ? 'start' : px > M.left + innerW - 24 ? 'end' : 'middle'} className={s.tick}>
                {(span <= 60 ? hms : hm).format(t * 1000)}
              </text>
            );
          })}
          {data.mode === 'fleet' ? (
            <>
              <path d={areaOf(shown.a, null)} className={s.okArea} />
              <path d={pathOf(shown.a)} className={s.okLine} />
              <path d={areaOf(shown.b, null, y2)} className={s.failArea} />
              {data.markers.map((m, i) => {
                const px = xt(m.tick);
                return m.severity === 'critical'
                  ? <rect key={i} x={px - 4} y={M.top - 13} width={8} height={8} className={s.markCritical} transform={`rotate(45 ${px} ${M.top - 9})`} />
                  : <path key={i} d={`M${px} ${M.top - 14}l5 9h-10z`} className={s.markMajor} />;
              })}
            </>
          ) : (
            <>
              {shown.c && <path d={areaOf(shown.c, shown.b)} className={s.band} />}
              <path d={pathOf(shown.a)} className={s.agentLine} />
              <path d={flagged()} className={s.flagLine} />
            </>
          )}
        </svg>
      )}
    </div>
  );
}
