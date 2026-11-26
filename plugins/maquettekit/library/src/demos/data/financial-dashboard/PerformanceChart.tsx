'use client';
/**
 * Growth-of-100 chart. Technique from the line-chart-morph recipe (effects/line-chart-morph): every range is
 * resampled to one shared resolution, so switching presets interpolates DATA VALUES and the y-domain together and
 * the line never tears; gridlines are keyed by value and cross-fade. Here it is multi-series, rebased to the range
 * start, linear (no smoothing that would invent closes), and fed by the dashboard instead of a built-in dataset.
 * Brush drags and key steps are direct manipulation, so they cut instead of tweening.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { easeCubicInOut, scaleLinear } from 'd3';
import { duration as D, profileScale, useElementSize, useStudioMotion } from '../../../motion';
import { fmt } from './data';
import s from './styles.module.css';

export type Transition = 'morph' | 'drag' | 'key' | 'cut';
export interface ChartSeries { key: string; label: string; values: ArrayLike<number>; role: 'fund' | 'comp' | 'pos' }
interface Props { dates: number[]; series: ChartSeries[]; win: readonly [number, number]; transition: Transition }

const N = 640;
const M = { top: 14, bottom: 26, left: 40 };
interface Target { a: number; b: number; lines: Map<string, Float64Array>; lo: number; hi: number }
interface Frame { lines: Map<string, Float64Array>; lo: number; hi: number; e: number; prev: Target | null }

/** Rebase to 100 at index a, then resample [a, b] linearly to N points (exact: a polyline resampled is the same polyline). */
function rebased(values: ArrayLike<number>, a: number, b: number): Float64Array {
  const out = new Float64Array(N);
  const base = values[a];
  for (let k = 0; k < N; k++) {
    const u = a + (k / (N - 1)) * (b - a);
    const i = Math.min(b - 1, Math.floor(u));
    const v = values[i] + (values[i + 1] - values[i]) * (u - i);
    out[k] = (v / base) * 100;
  }
  return out;
}

function domainOf(lines: Iterable<Float64Array>): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (const l of lines) for (const v of l) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const pad = Math.max(0.6, (hi - lo) * 0.08);
  const d = scaleLinear().domain([lo - pad, hi + pad]).nice(5).domain();
  return [d[0], d[1]];
}

/** Calendar ticks for a trading-day window: weeks for short ranges, then months, quarters, half-years or years. */
function xTicks(dates: number[], a: number, b: number, max: number): { i: number; label: string }[] {
  const out: { i: number; label: string }[] = [];
  if (b - a <= 50) {
    for (let i = a + 1; i <= b; i++) if (new Date(dates[i]).getUTCDay() < new Date(dates[i - 1]).getUTCDay()) out.push({ i, label: fmt.dateShort.format(dates[i]) });
  } else {
    const starts: number[] = [];
    for (let i = a + 1; i <= b; i++) if (new Date(dates[i]).getUTCMonth() !== new Date(dates[i - 1]).getUTCMonth()) starts.push(i);
    for (const step of [1, 3, 6, 12]) {
      const keep = starts.filter((i) => new Date(dates[i]).getUTCMonth() % step === 0);
      if (keep.length <= max || step === 12) {
        for (const i of keep) { const m = new Date(dates[i]).getUTCMonth(); out.push({ i, label: m === 0 ? fmt.year.format(dates[i]) : fmt.month.format(dates[i]) }); }
        break;
      }
    }
  }
  if (out.length <= max) return out;
  const k = Math.ceil(out.length / max);
  return out.filter((_, j) => j % k === 0);
}

export function PerformanceChart({ dates, series, win, transition }: Props) {
  const { reduced } = useStudioMotion();
  const plotRef = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(plotRef);
  const [a, b] = win;
  const [active, setActive] = useState<number | null>(null);
  const focused = useRef(false);
  const transitionRef = useRef(transition);
  transitionRef.current = transition;

  const target = useMemo<Target>(() => {
    const lines = new Map(series.map((sr) => [sr.key, rebased(sr.values, a, b)] as const));
    const [lo, hi] = domainOf(lines.values());
    return { a, b, lines, lo, hi };
  }, [series, a, b]);

  const [frame, setFrame] = useState<Frame>(() => ({ lines: target.lines, lo: target.lo, hi: target.hi, e: 1, prev: null }));
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const shown = useRef(target);

  useEffect(() => {
    if (shown.current === target) return;
    const prev = shown.current;
    shown.current = target;
    const rest: Frame = { lines: target.lines, lo: target.lo, hi: target.hi, e: 1, prev: null };
    // Essential profile: a range change is an axis rescale, `moderate` × 0.7 — quick enough for a terminal, long enough to follow.
    const dur = D.moderate * profileScale.essential.duration;
    if (transitionRef.current !== 'morph' || reduced || dur < 1) { setFrame(rest); return; }
    setActive(null);
    const from = frameRef.current;
    let raf = 0, t0 = 0;
    const step = (now: number) => {
      if (!t0) t0 = now;
      const p = Math.min(1, (now - t0) / dur);
      if (p >= 1) { setFrame(rest); return; }
      const e = easeCubicInOut(p);
      const lines = new Map<string, Float64Array>();
      for (const [key, to] of target.lines) {
        const f = from.lines.get(key);
        if (!f) { lines.set(key, to); continue; }
        const out = new Float64Array(N);
        for (let k = 0; k < N; k++) out[k] = f[k] + (to[k] - f[k]) * e;
        lines.set(key, out);
      }
      setFrame({ lines, lo: from.lo + (target.lo - from.lo) * e, hi: from.hi + (target.hi - from.hi) * e, e, prev });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);

  const wide = width >= 560;
  const right = wide ? 132 : 10;
  const innerW = Math.max(0, width - M.left - right);
  const innerH = Math.max(0, height - M.top - M.bottom);
  const ready = innerW > 40 && innerH > 40;
  const y = useMemo(() => scaleLinear().domain([frame.lo, frame.hi]).range([M.top + innerH, M.top]), [frame.lo, frame.hi, innerH]);
  const xs = (k: number) => M.left + (k / (N - 1)) * innerW;
  const xi = (i: number, w: Target | { a: number; b: number } = { a, b }) => M.left + ((i - w.a) / Math.max(1, w.b - w.a)) * innerW;

  const paths = useMemo(() => {
    const out = new Map<string, string>();
    if (!ready) return out;
    for (const [key, arr] of frame.lines) {
      let d = '';
      for (let k = 0; k < N; k++) d += `${k ? 'L' : 'M'}${xs(k).toFixed(1)} ${y(arr[k]).toFixed(1)}`;
      out.set(key, d);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.lines, y, innerW, ready]);

  const toTicks = scaleLinear().domain([target.lo, target.hi]).ticks(5);
  const fromTicks = frame.prev && frame.e < 1 ? scaleLinear().domain([frame.prev.lo, frame.prev.hi]).ticks(5) : toTicks;
  const grid = Array.from(new Set([...fromTicks, ...toTicks])).map((v) => ({
    v, o: fromTicks.includes(v) && toTicks.includes(v) ? 1 : toTicks.includes(v) ? frame.e : 1 - frame.e,
  })).filter((t) => t.v >= frame.lo && t.v <= frame.hi);
  const maxX = Math.max(2, Math.floor(innerW / 64));
  const axisSets = [
    ...(frame.prev && frame.e < 1 ? [{ key: 'from', w: frame.prev, o: Math.max(0, 1 - frame.e * 2) }] : []),
    { key: 'to', w: { a, b }, o: frame.prev && frame.e < 1 ? Math.max(0, frame.e * 2 - 1) : 1 },
  ];

  const settled = frame.e === 1;
  const idx = active !== null && settled ? Math.min(b, Math.max(a, active)) : null;
  const read = idx ?? b;
  const val = (sr: ChartSeries, i: number) => (sr.values[i] / sr.values[a]) * 100;
  const fund = series.find((x) => x.role === 'fund')!;
  const comp = series.find((x) => x.role === 'comp')!;
  const valueText = (i: number) =>
    `${fmt.dateLong.format(dates[i])}: ${series.map((sr) => `${sr.label} ${fmt.index.format(val(sr, i))}`).join(', ')}. Fund minus composite ${fmt.pp(val(fund, i) - val(comp, i))}.`;

  const onPointer = (ev: PointerEvent<HTMLDivElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const u = Math.min(1, Math.max(0, (ev.clientX - r.left - M.left) / Math.max(1, innerW)));
    setActive(a + Math.round(u * (b - a)));
  };
  const onKey = (ev: KeyboardEvent<HTMLDivElement>) => {
    if (ev.key === 'Escape') { setActive(null); return; }
    const cur = active ?? b;
    const next = ev.key === 'ArrowLeft' || ev.key === 'ArrowDown' ? cur - 1 : ev.key === 'ArrowRight' || ev.key === 'ArrowUp' ? cur + 1
      : ev.key === 'PageDown' ? cur - 5 : ev.key === 'PageUp' ? cur + 5 : ev.key === 'Home' ? a : ev.key === 'End' ? b : null;
    if (next === null) return;
    ev.preventDefault();
    setActive(Math.min(b, Math.max(a, next)));
  };

  // Direct end labels, pushed apart so they never overlap.
  const ends = series.map((sr) => {
    const arr = frame.lines.get(sr.key);
    const v = arr ? arr[N - 1] : 100;
    return { sr, v, y: ready ? y(v) : 0 };
  }).sort((p, q) => p.y - q.y);
  for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 30) ends[k].y = ends[k - 1].y + 30;
  const overflow = ends.length ? ends[ends.length - 1].y - (M.top + innerH) : 0;
  if (overflow > 0) ends.forEach((e) => { e.y -= overflow; });

  const order: ChartSeries['role'][] = ['comp', 'pos', 'fund'];
  const cx = idx === null ? 0 : xi(idx);

  return (
    <div ref={plotRef} className={s.plot}>
      {ready && (
        <svg width={width} height={height} aria-hidden="true" className={s.svg}>
          {grid.map((t) => (
            <g key={t.v} transform={`translate(0 ${y(t.v).toFixed(1)})`} opacity={t.o}>
              <line x1={M.left} x2={M.left + innerW} className={t.v === 100 ? s.ref : s.grid} />
              <text x={M.left - 8} y={4} textAnchor="end" className={s.tick}>{fmt.int.format(t.v)}</text>
            </g>
          ))}
          {axisSets.map((set) => (
            <g key={set.key} opacity={set.o}>
              {xTicks(dates, set.w.a, set.w.b, maxX).map((t) => {
                const x = xi(t.i, set.w);
                return (
                  <g key={t.i} transform={`translate(${x.toFixed(1)} ${M.top + innerH})`}>
                    <line y2={5} className={s.axisTick} />
                    <text y={18} textAnchor={x < M.left + 18 ? 'start' : x > M.left + innerW - 18 ? 'end' : 'middle'} className={s.tick}>{t.label}</text>
                  </g>
                );
              })}
            </g>
          ))}
          <line x1={M.left} x2={M.left + innerW} y1={M.top + innerH} y2={M.top + innerH} className={s.axisLine} />
          {order.flatMap((role) => series.filter((sr) => sr.role === role)).map((sr) => (
            <path key={sr.key} d={paths.get(sr.key) ?? ''} className={s.line} data-role={sr.role} />
          ))}
          {wide && ends.map((e) => (
            <g key={e.sr.key} transform={`translate(${M.left + innerW + 10} ${e.y.toFixed(1)})`} className={s.endLabel} data-role={e.sr.role}>
              <text y={-3} className={s.endName}>{e.sr.label}</text>
              <text y={11} className={s.endValue}>{fmt.index.format(e.v)}</text>
            </g>
          ))}
          {idx !== null && (
            <g>
              <line x1={cx} x2={cx} y1={M.top} y2={M.top + innerH} className={s.crosshair} />
              {series.map((sr) => <circle key={sr.key} cx={cx} cy={y(val(sr, idx))} r={sr.role === 'fund' ? 4.5 : 3.5} className={s.dot} data-role={sr.role} />)}
            </g>
          )}
        </svg>
      )}
      {idx !== null && ready && (
        <div className={s.tip} data-side={cx > M.left + innerW * 0.6 ? 'left' : 'right'} style={{ transform: `translate(${cx}px, ${M.top + 4}px)` }} aria-hidden="true">
          <div>
            <p className={s.tipDate}>{fmt.dateLong.format(dates[idx])}</p>
            {series.map((sr) => (
              <p key={sr.key} className={s.tipRow} data-role={sr.role}><span className={s.swatch} data-role={sr.role} />{sr.label}<strong>{fmt.index.format(val(sr, idx))}</strong></p>
            ))}
            <p className={s.tipRow}>Fund − composite<strong>{fmt.pp(val(fund, idx) - val(comp, idx))}</strong></p>
          </div>
        </div>
      )}
      <div
        className={s.hit}
        role="slider"
        tabIndex={0}
        aria-label="Inspect daily closes. Left and right arrows step one trading day, Page Up and Page Down a week, Escape hides the readout."
        aria-valuemin={1}
        aria-valuemax={b - a + 1}
        aria-valuenow={read - a + 1}
        aria-valuetext={valueText(read)}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => { if (!focused.current) setActive(null); }}
        onFocus={() => { focused.current = true; setActive((x) => x ?? b); }}
        onBlur={() => { focused.current = false; setActive(null); }}
        onKeyDown={onKey}
      />
    </div>
  );
}
