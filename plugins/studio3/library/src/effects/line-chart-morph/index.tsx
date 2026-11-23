'use client';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { area as d3Area, easeCubicInOut, line as d3Line, scaleLinear } from 'd3';
import { duration as D, useElementSize, useStudioMotion } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { duration: number; curve: string; showArea: boolean; seed: number };
type RangeKey = '1W' | '1M' | '1Y';
type CurveMode = 'smooth' | 'linear' | 'step';

interface Series {
  key: RangeKey;
  name: string;
  /** One label per point (used by tooltip, table and screen readers). */
  labels: string[];
  /** Indices that get an axis label, for wide and narrow plots. */
  axis: { wide: number[]; narrow: number[] };
  axisLabel: (i: number) => string;
  values: number[];
}

interface Frame { vals: number[]; yMax: number; e: number; fromYMax: number; fromSeries: Series | null }

/** Shared resolution: 330 is divisible by 6, 30 and 11, so every real point of every range sits on a sample. */
const SAMPLES = 331;
const RANGES: readonly RangeKey[] = ['1W', '1M', '1Y'];
const MARGIN = { top: 22, bottom: 26, left: 46 };
const nf = new Intl.NumberFormat('en-US');

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildData(seed: number): Record<RangeKey, Series> {
  const rnd = mulberry32(seed * 7919 + 13);
  const walk = (n: number, base: number, swing: number, shape: (u: number) => number): number[] => {
    let drift = 0;
    return Array.from({ length: n }, (_, i) => {
      drift = drift * 0.6 + (rnd() - 0.5) * swing;
      return Math.max(40, Math.round((base * shape(i / (n - 1)) + drift) / 10) * 10);
    });
  };
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const phase = rnd() * Math.PI;
  return {
    '1W': {
      key: '1W', name: 'Past week', labels: days, axis: { wide: [0, 1, 2, 3, 4, 5, 6], narrow: [0, 1, 2, 3, 4, 5, 6] },
      axisLabel: (i) => days[i],
      values: walk(7, 1500, 420, (u) => (u > 0.75 ? 0.62 : 1 + 0.12 * Math.sin(u * 9 + phase))),
    },
    '1M': {
      key: '1M', name: 'October', labels: Array.from({ length: 31 }, (_, i) => `${i + 1} Oct`),
      axis: { wide: [0, 5, 10, 15, 20, 25, 30], narrow: [0, 10, 20, 30] },
      axisLabel: (i) => (i === 0 ? '1 Oct' : String(i + 1)),
      values: walk(31, 1900, 700, (u) => 0.8 + 0.5 * u + 0.16 * Math.sin(u * 27 + phase)),
    },
    '1Y': {
      key: '1Y', name: 'Past year, monthly average', labels: months,
      axis: { wide: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], narrow: [0, 3, 6, 9, 11] },
      axisLabel: (i) => months[i],
      values: walk(12, 2500, 520, (u) => 0.55 + 0.95 * Math.sin(Math.PI * Math.min(1, u * 1.08)) ** 2),
    },
  };
}

/** Resample a series to `n` values with linear, stepped or monotone-cubic (Fritsch–Carlson) interpolation. */
function resample(values: number[], n: number, mode: CurveMode): number[] {
  const m = values.length;
  const d = Array.from({ length: m - 1 }, (_, i) => values[i + 1] - values[i]);
  const tg = values.map((_, i) => (i === 0 ? d[0] : i === m - 1 ? d[m - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  for (let i = 0; i < m - 1; i++) {
    if (d[i] === 0) { tg[i] = 0; tg[i + 1] = 0; continue; }
    const a = tg[i] / d[i], b = tg[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const tau = 3 / Math.sqrt(s); tg[i] = tau * a * d[i]; tg[i + 1] = tau * b * d[i]; }
  }
  return Array.from({ length: n }, (_, k) => {
    const u = (k / (n - 1)) * (m - 1);
    const i = Math.min(m - 2, Math.floor(u));
    const f = u - i;
    if (mode === 'linear') return values[i] + d[i] * f;
    if (mode === 'step') return f < 0.5 ? values[i] : values[i + 1];
    const f2 = f * f, f3 = f2 * f;
    return values[i] * (2 * f3 - 3 * f2 + 1) + tg[i] * (f3 - 2 * f2 + f) + values[i + 1] * (-2 * f3 + 3 * f2) + tg[i + 1] * (f3 - f2);
  });
}

const niceMax = (values: number[]): number => scaleLinear().domain([0, Math.max(...values) * 1.08]).nice(4).domain()[1];
const ticksFor = (yMax: number): number[] => scaleLinear().domain([0, yMax]).ticks(4);

export default function LineChartMorph({ params }: EffectProps<Params>) {
  const { reduced, scale } = useStudioMotion();
  const uid = useId();
  const plotRef = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(plotRef);
  const [range, setRange] = useState<RangeKey>('1M');
  const [active, setActive] = useState<number | null>(null);
  const focused = useRef(false);

  const curve = (['smooth', 'linear', 'step'].includes(params.curve) ? params.curve : 'smooth') as CurveMode;
  const data = useMemo(() => buildData(params.seed), [params.seed]);
  const series = data[range];
  const target = useMemo(() => ({ vals: resample(series.values, SAMPLES, curve), yMax: niceMax(series.values) }), [series, curve]);

  const [frame, setFrame] = useState<Frame>(() => ({ vals: target.vals, yMax: target.yMax, e: 1, fromYMax: target.yMax, fromSeries: null }));
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const shown = useRef({ series, target });

  // Morph: interpolate the data values and the y-domain; pixels are always derived from the scale.
  useEffect(() => {
    if (shown.current.target === target) return;
    const from = frameRef.current;
    const fromSeries = shown.current.series;
    shown.current = { series, target };
    setActive(null);
    const dur = params.duration * scale.duration;
    const rest: Frame = { vals: target.vals, yMax: target.yMax, e: 1, fromYMax: target.yMax, fromSeries: null };
    if (reduced || dur < 1) { setFrame(rest); return; }
    let raf = 0;
    let t0 = 0;
    const step = (now: number) => {
      if (!t0) t0 = now;
      const p = Math.min(1, (now - t0) / dur);
      if (p >= 1) { setFrame(rest); return; }
      const e = easeCubicInOut(p);
      setFrame({
        vals: from.vals.map((v, i) => v + (target.vals[i] - v) * e),
        yMax: from.yMax + (target.yMax - from.yMax) * e,
        e, fromYMax: from.yMax, fromSeries: fromSeries === series ? null : fromSeries,
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, series, reduced, params.duration, scale.duration]);

  const innerH = Math.max(0, height - MARGIN.top - MARGIN.bottom);
  const ready = width > MARGIN.left && innerH > 0;
  const y = useMemo(() => scaleLinear().domain([0, frame.yMax]).range([MARGIN.top + innerH, MARGIN.top]), [frame.yMax, innerH]);
  const innerW = Math.max(0, width - MARGIN.left);
  const xAt = (i: number, n: number): number => MARGIN.left + (i / (n - 1)) * innerW;

  const paths = useMemo(() => {
    if (!ready) return { line: '', area: '' };
    const n = frame.vals.length;
    const x = (_: number, i: number) => MARGIN.left + (i / (n - 1)) * (width - MARGIN.left);
    return {
      line: d3Line<number>().x(x).y((v) => y(v))(frame.vals) ?? '',
      area: d3Area<number>().x(x).y0(y(0)).y1((v) => y(v))(frame.vals) ?? '',
    };
  }, [frame.vals, y, width, ready]);

  // Gridlines: union of the outgoing and incoming tick sets, cross-faded while positions follow the live scale.
  const gridTicks = useMemo(() => {
    const to = ticksFor(shown.current.target.yMax);
    const from = frame.e < 1 ? ticksFor(frame.fromYMax) : to;
    return Array.from(new Set([...from, ...to])).map((v) => ({
      v, opacity: from.includes(v) && to.includes(v) ? 1 : to.includes(v) ? frame.e : 1 - frame.e,
    }));
  }, [frame.e, frame.fromYMax]);

  const narrow = width < 480;
  const axisSets = [
    ...(frame.fromSeries ? [{ s: frame.fromSeries, opacity: Math.max(0, 1 - frame.e * 2) }] : []),
    { s: series, opacity: frame.fromSeries ? Math.max(0, frame.e * 2 - 1) : 1 },
  ];

  const settled = frame.e === 1;
  const n = series.values.length;
  const idx = active !== null && settled ? Math.min(active, n - 1) : null;
  const readout = idx ?? n - 1;
  const prev = readout > 0 ? series.values[readout - 1] : null;
  const delta = prev === null ? null : series.values[readout] - prev;
  const valueText = (i: number): string => `${series.labels[i]}: ${nf.format(series.values[i])} riders`;

  const onPointer = (ev: PointerEvent<HTMLDivElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    if (r.width <= MARGIN.left) return;
    setActive(Math.round(Math.min(1, Math.max(0, (ev.clientX - r.left - MARGIN.left) / (r.width - MARGIN.left))) * (n - 1)));
  };
  const onKey = (ev: KeyboardEvent<HTMLDivElement>) => {
    const cur = active ?? n - 1;
    const next = ev.key === 'ArrowLeft' || ev.key === 'ArrowDown' ? cur - 1
      : ev.key === 'ArrowRight' || ev.key === 'ArrowUp' ? cur + 1
      : ev.key === 'Home' ? 0 : ev.key === 'End' ? n - 1
      : ev.key === 'PageDown' ? cur - 5 : ev.key === 'PageUp' ? cur + 5 : null;
    if (next === null) return;
    ev.preventDefault();
    setActive(Math.min(n - 1, Math.max(0, next)));
  };

  const cx = idx === null ? 0 : xAt(idx, n);
  const cy = idx === null ? 0 : y(series.values[idx]);

  return (
    <div className={styles.root}>
      <figure className={styles.figure}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>Tram line 7 · average daily riders</p>
            <p className={styles.readout} aria-hidden="true">
              <span className={styles.value}>{nf.format(series.values[readout])}</span>
              <span className={styles.context}>
                <span>{series.labels[readout]}</span>
                {delta !== null && (
                  <span className={styles.delta}>{delta > 0 ? '▲' : delta < 0 ? '▼' : '■'} {delta > 0 ? '+' : delta < 0 ? '−' : ''}{nf.format(Math.abs(delta))} vs previous</span>
                )}
              </span>
            </p>
          </div>
          <fieldset className={styles.ranges}>
            <legend className={styles.srOnly}>Time range</legend>
            {RANGES.map((r) => (
              <label key={r} className={styles.range}>
                <input type="radio" name={`${uid}-range`} value={r} checked={range === r} onChange={() => setRange(r)} />
                <span>{r}</span>
              </label>
            ))}
          </fieldset>
        </header>

        <div ref={plotRef} className={styles.plot}>
          {ready && (
            <svg width={width} height={height} aria-hidden="true" className={styles.svg}>
              {gridTicks.map((t) => (
                <g key={t.v} transform={`translate(0 ${y(t.v)})`} opacity={t.opacity}>
                  <line x2={width} className={t.v === 0 ? styles.baseline : styles.grid} />
                  {t.v > 0 && <text x={0} y={-6} className={styles.tick}>{nf.format(t.v)}</text>}
                </g>
              ))}
              {params.showArea && <path d={paths.area} className={styles.area} />}
              <path d={paths.line} className={styles.line} />
              {axisSets.map(({ s, opacity }) => (
                <g key={s.key} opacity={opacity}>
                  {(narrow ? s.axis.narrow : s.axis.wide).map((i) => {
                    const last = s.values.length - 1;
                    return (
                      <text key={i} x={xAt(i, s.values.length)} y={height - 6} className={styles.tick} textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'}>
                        {s.axisLabel(i)}
                      </text>
                    );
                  })}
                </g>
              ))}
              {idx !== null && (
                <g>
                  <line x1={cx} x2={cx} y1={MARGIN.top} y2={MARGIN.top + innerH} className={styles.crosshair} />
                  <circle cx={cx} cy={cy} r={5} className={styles.dot} />
                </g>
              )}
            </svg>
          )}
          {idx !== null && (
            <div className={styles.tip} data-side={cx > width * 0.62 ? 'left' : 'right'} style={{ transform: `translate(${cx}px, ${Math.max(0, cy - 18)}px)` }} aria-hidden="true">
              <div>
                <span className={styles.tipLabel}>{series.labels[idx]}</span>
                <span className={styles.tipValue}>{nf.format(series.values[idx])}</span>
              </div>
            </div>
          )}
          <div
            className={styles.hit}
            role="slider"
            tabIndex={0}
            aria-label={`Inspect data points, ${series.name}`}
            aria-valuemin={1}
            aria-valuemax={n}
            aria-valuenow={readout + 1}
            aria-valuetext={valueText(readout)}
            onPointerMove={onPointer}
            onPointerDown={onPointer}
            onPointerLeave={() => { if (!focused.current) setActive(null); }}
            onFocus={() => { focused.current = true; setActive((a) => a ?? n - 1); }}
            onBlur={() => { focused.current = false; setActive(null); }}
            onKeyDown={onKey}
          />
        </div>

        <figcaption className={styles.caption}>
          <span className={styles.badge}>Sample data</span>
          <span>{series.name}. Generated in the browser from a seeded random walk; not real ridership.</span>
        </figcaption>

        <table className={styles.srOnly}>
          <caption>Average daily riders, tram line 7 — {series.name} (sample data)</caption>
          <thead><tr><th scope="col">Period</th><th scope="col">Riders</th></tr></thead>
          <tbody>
            {series.values.map((v, i) => (<tr key={i}><th scope="row">{series.labels[i]}</th><td>{nf.format(v)}</td></tr>))}
          </tbody>
        </table>
      </figure>
    </div>
  );
}
