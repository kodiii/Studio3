'use client';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { area as d3Area, line as d3Line, max as d3Max, mean as d3Mean, min as d3Min, scaleLinear } from 'd3';
import { useElementSize, useStudioMotion } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { smoothing: number; rescaleY: boolean; minSpan: number; seed: number };
type Range = readonly [number, number];
type Part = 'start' | 'end' | 'window';

const DAYS = 180;
const START = Date.UTC(2025, 2, 1);
const ML = 44;
const DETAIL = { top: 16, bottom: 26 };
const nf = new Intl.NumberFormat('en-US');
const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dateAt = (i: number): string => shortDate.format(START + Math.round(i) * 86_400_000);
const PRESETS: readonly { label: string; days: number }[] = [{ label: '2 weeks', days: 14 }, { label: '1 month', days: 30 }, { label: '3 months', days: 90 }, { label: 'All', days: DAYS }];

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

/** Daily trips: seasonal rise, weekly rhythm, a few seeded surges and noise. */
function buildData(seed: number): number[] {
  const rnd = mulberry32(seed * 6151 + 17);
  const surges = Array.from({ length: 4 }, () => ({ at: 12 + rnd() * (DAYS - 24), w: 2 + rnd() * 5, h: 500 + rnd() * 1300 }));
  let drift = 0;
  return Array.from({ length: DAYS }, (_, i) => {
    const u = i / (DAYS - 1);
    drift = drift * 0.82 + (rnd() - 0.5) * 320;
    const season = 1500 + 1900 * Math.sin(Math.PI * (0.12 + u * 0.8)) ** 2;
    const weekly = (i % 7 === 5 || i % 7 === 6 ? -0.26 : 0.06) * season;
    const surge = surges.reduce((s, g) => s + g.h * Math.exp(-(((i - g.at) / g.w) ** 2)), 0);
    return Math.max(120, Math.round(season + weekly + surge + drift));
  });
}

const clampRange = (a: number, b: number, minSpan: number): Range => {
  const span = Math.min(DAYS - 1, Math.max(minSpan, b - a));
  const start = Math.min(DAYS - 1 - span, Math.max(0, a));
  return [start, start + span];
};

export default function BrushLinkedRange({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const uid = useId();
  const data = useMemo(() => buildData(params.seed), [params.seed]);
  const minSpan = Math.round(params.minSpan);

  const detailRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const detail = useElementSize(detailRef);
  const strip = useElementSize(stripRef);

  const [sel, setSel] = useState<Range>([96, 140]);
  const [view, setView] = useState<Range>(sel);
  const viewRef = useRef(view);
  viewRef.current = view;
  const drag = useRef<{ part: Part; x: number; sel: Range } | null>(null);

  useEffect(() => { setSel((s) => clampRange(s[0], s[1], minSpan)); }, [minSpan]);

  // The displayed domain chases the selection (exponential ease); the loop ends as soon as it arrives.
  useEffect(() => {
    if (reduced || params.smoothing < 1) { setView(sel); return; }
    let raf = 0;
    let prev = 0;
    const tick = (now: number) => {
      const dt = prev ? Math.min(64, now - prev) : 16;
      prev = now;
      const k = 1 - Math.exp(-dt / params.smoothing);
      const v = viewRef.current;
      const next: Range = [v[0] + (sel[0] - v[0]) * k, v[1] + (sel[1] - v[1]) * k];
      if (Math.abs(next[0] - sel[0]) < 0.02 && Math.abs(next[1] - sel[1]) < 0.02) { setView(sel); return; }
      setView(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sel, reduced, params.smoothing]);

  /* ── overview ─────────────────────────────────────────────────────────── */
  const sw = strip.width, sh = strip.height;
  const sx = useMemo(() => scaleLinear().domain([0, DAYS - 1]).range([0, sw]), [sw]);
  const overview = useMemo(() => {
    if (sw <= 0 || sh <= 0) return '';
    const sy = scaleLinear().domain([0, d3Max(data) ?? 1]).range([sh, 4]);
    return d3Area<number>().x((_, i) => sx(i)).y0(sh).y1((v) => sy(v))(data) ?? '';
  }, [data, sx, sw, sh]);
  const months = useMemo(() => {
    const out: { i: number; label: string }[] = [];
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(START + i * 86_400_000);
      if (d.getUTCDate() === 1) out.push({ i, label: new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(d) });
    }
    return out;
  }, []);

  const apply = (part: Part, base: Range, delta: number): Range => {
    const d = Math.round(delta);
    if (part === 'start') return [Math.min(base[1] - minSpan, Math.max(0, base[0] + d)), base[1]];
    if (part === 'end') return [base[0], Math.max(base[0] + minSpan, Math.min(DAYS - 1, base[1] + d))];
    const span = base[1] - base[0];
    const a = Math.min(DAYS - 1 - span, Math.max(0, base[0] + d));
    return [a, a + span];
  };

  const onDown = (part: Part) => (ev: PointerEvent<HTMLDivElement>) => {
    if (ev.button !== 0) return;
    ev.stopPropagation();
    ev.currentTarget.setPointerCapture(ev.pointerId);
    drag.current = { part, x: ev.clientX, sel };
  };
  const onMove = (ev: PointerEvent<HTMLDivElement>) => {
    const g = drag.current;
    if (!g || sw <= 0) return;
    setSel(apply(g.part, g.sel, ((ev.clientX - g.x) / sw) * (DAYS - 1)));
  };
  const onUp = () => { drag.current = null; };
  const onKey = (part: Part) => (ev: KeyboardEvent<HTMLDivElement>) => {
    const big = ev.shiftKey ? 7 : 1;
    const d = ev.key === 'ArrowLeft' || ev.key === 'ArrowDown' ? -big
      : ev.key === 'ArrowRight' || ev.key === 'ArrowUp' ? big
      : ev.key === 'PageDown' ? -7 : ev.key === 'PageUp' ? 7
      : ev.key === 'Home' ? -DAYS : ev.key === 'End' ? DAYS : 0;
    if (!d) return;
    ev.preventDefault();
    setSel((s) => apply(part, s, d));
  };
  /** Clicking the strip outside the brush recentres the window there. */
  const onTrackDown = (ev: PointerEvent<HTMLDivElement>) => {
    if (ev.button !== 0 || sw <= 0) return;
    const r = ev.currentTarget.getBoundingClientRect();
    const centre = ((ev.clientX - r.left) / r.width) * (DAYS - 1);
    const span = sel[1] - sel[0];
    setSel(clampRange(Math.round(centre - span / 2), Math.round(centre - span / 2) + span, minSpan));
  };
  const preset = (days: number) => {
    const span = Math.min(DAYS - 1, days);
    const centre = (sel[0] + sel[1]) / 2;
    const a = Math.round(centre - span / 2);
    setSel(clampRange(a, a + span, Math.min(minSpan, span)));
  };

  /* ── detail ───────────────────────────────────────────────────────────── */
  const dw = detail.width, dh = detail.height;
  const ready = dw > ML && dh > DETAIL.top + DETAIL.bottom;
  const x = scaleLinear().domain([view[0], view[1]]).range([ML, dw]);
  const lo = Math.max(0, Math.floor(view[0]) - 1), hi = Math.min(DAYS - 1, Math.ceil(view[1]) + 1);
  const valueAt = (t: number): number => {
    const i = Math.min(DAYS - 2, Math.max(0, Math.floor(t)));
    return data[i] + (data[i + 1] - data[i]) * (t - i);
  };
  // Continuous window maximum (edges interpolated) so the y-domain never jumps while the window slides.
  const windowMax = Math.max(valueAt(view[0]), valueAt(view[1]), ...data.slice(Math.ceil(view[0]), Math.floor(view[1]) + 1));
  const yMax = (params.rescaleY ? windowMax : (d3Max(data) ?? 1)) * 1.12;
  const y = scaleLinear().domain([0, yMax]).range([dh - DETAIL.bottom, DETAIL.top]);
  const pts = ready ? Array.from({ length: hi - lo + 1 }, (_, k) => lo + k) : [];
  const linePath = d3Line<number>().x((i) => x(i)).y((i) => y(data[i]))(pts) ?? '';
  const areaPath = d3Area<number>().x((i) => x(i)).y0(y(0)).y1((i) => y(data[i]))(pts) ?? '';

  const span = view[1] - view[0];
  const stepDays = [1, 2, 7, 14, 28].find((s) => span / s <= Math.max(2, Math.floor((dw - ML) / 84))) ?? 28;
  const xTicks: number[] = [];
  for (let i = Math.ceil(view[0] / stepDays) * stepDays; i <= view[1]; i += stepDays) xTicks.push(i);
  const yTicks = y.ticks(4);

  const windowVals = data.slice(sel[0], sel[1] + 1);
  const avg = Math.round(d3Mean(windowVals) ?? 0);
  const low = d3Min(windowVals) ?? 0, high = d3Max(windowVals) ?? 0;
  const days = sel[1] - sel[0] + 1;
  const rangeText = `${dateAt(sel[0])} – ${dateAt(sel[1])} 2025`;
  const summary = `Daily bike-share trips, ${rangeText}, ${days} days. Mean ${nf.format(avg)}, low ${nf.format(low)}, high ${nf.format(high)}. Sample data.`;

  const left = sx(sel[0]), right = sx(sel[1]);
  const clipId = `${uid}-clip`;

  return (
    <div className={styles.root}>
      <figure className={styles.figure}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>Northbank bike share · trips per day</p>
            <p className={styles.range}>{rangeText}</p>
          </div>
          <dl className={styles.stats}>
            <div><dt>Mean</dt><dd>{nf.format(avg)}</dd></div>
            <div><dt>Low</dt><dd>{nf.format(low)}</dd></div>
            <div><dt>High</dt><dd>{nf.format(high)}</dd></div>
            <div><dt>Days</dt><dd>{days}</dd></div>
          </dl>
        </header>

        <div ref={detailRef} className={styles.detail} role="img" aria-label={summary}>
          {ready && (
            <svg width={dw} height={dh} aria-hidden="true" className={styles.svg}>
              <defs><clipPath id={clipId}><rect x={ML} y={0} width={dw - ML} height={dh - DETAIL.bottom} /></clipPath></defs>
              {yTicks.map((t) => (
                <g key={t} transform={`translate(0 ${y(t)})`}>
                  <line x1={0} x2={dw} className={t === 0 ? styles.baseline : styles.grid} />
                  {t > 0 && <text x={0} y={-6} className={styles.tick}>{nf.format(t)}</text>}
                </g>
              ))}
              <g clipPath={`url(#${clipId})`}>
                <path d={areaPath} className={styles.area} />
                <path d={linePath} className={styles.line} />
              </g>
              {xTicks.map((i) => (
                <g key={i} transform={`translate(${x(i)} ${dh - DETAIL.bottom})`}>
                  <line y2={5} className={styles.baseline} />
                  <text y={19} className={styles.tick} textAnchor={x(i) > dw - 28 ? 'end' : x(i) < ML + 24 ? 'start' : 'middle'}>{dateAt(i)}</text>
                </g>
              ))}
            </svg>
          )}
        </div>

        <div className={styles.overviewHead}>
          <p className={styles.kicker} id={`${uid}-ov`}>Overview · drag the window or its handles</p>
          <div className={styles.presets} role="group" aria-label="Window length">
            {PRESETS.map((p) => (
              <button key={p.label} type="button" className={styles.preset} aria-pressed={sel[1] - sel[0] === Math.min(DAYS - 1, p.days)} onClick={() => preset(p.days)}>{p.label}</button>
            ))}
          </div>
        </div>

        <div className={styles.stripWrap}>
          <div ref={stripRef} className={styles.strip} onPointerDown={onTrackDown}>
            {sw > 0 && (
              <svg width={sw} height={sh} aria-hidden="true" className={styles.svg}>
                <path d={overview} className={styles.overviewArea} />
                {months.map((m) => (<line key={m.i} x1={sx(m.i)} x2={sx(m.i)} y1={0} y2={sh} className={styles.grid} />))}
              </svg>
            )}
            <div className={styles.shade} style={{ left: 0, width: Math.max(0, left) }} />
            <div className={styles.shade} style={{ left: right, right: 0 }} />
            <div
              className={styles.window}
              style={{ left, width: Math.max(0, right - left) }}
              role="slider" tabIndex={0}
              aria-label="Move window" aria-describedby={`${uid}-ov`}
              aria-valuemin={0} aria-valuemax={DAYS - 1 - (sel[1] - sel[0])} aria-valuenow={sel[0]}
              aria-valuetext={`${dateAt(sel[0])} to ${dateAt(sel[1])}`}
              onPointerDown={onDown('window')} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey('window')}
            />
            {(['start', 'end'] as const).map((part) => (
              <div
                key={part}
                className={styles.handle}
                style={{ left: part === 'start' ? left : right }}
                role="slider" tabIndex={0}
                aria-label={part === 'start' ? 'Window start' : 'Window end'}
                aria-valuemin={part === 'start' ? 0 : sel[0] + minSpan}
                aria-valuemax={part === 'start' ? sel[1] - minSpan : DAYS - 1}
                aria-valuenow={part === 'start' ? sel[0] : sel[1]}
                aria-valuetext={dateAt(part === 'start' ? sel[0] : sel[1])}
                onPointerDown={onDown(part)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey(part)}
              ><span /></div>
            ))}
          </div>
          <div className={styles.months} aria-hidden="true">
            {months.map((m) => (<span key={m.i} style={{ left: sx(m.i) }}>{m.label}</span>))}
          </div>
        </div>

        <figcaption className={styles.caption}>
          <span className={styles.badge}>Sample data</span>
          <span>Fictional service; 180 seeded daily values. The y-axis starts at zero{params.rescaleY ? ' and rescales to the selected window' : ' and stays fixed to the full range'}.</span>
        </figcaption>
      </figure>
    </div>
  );
}
