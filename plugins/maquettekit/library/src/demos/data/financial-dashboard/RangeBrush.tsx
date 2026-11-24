'use client';
/**
 * Three-year overview with a brushable window. Technique from the brush-linked-range recipe
 * (effects/brush-linked-range): the brush is hand-built so the window and both handles are real role="slider"
 * controls with date valuetext, pointer capture drives drags, and a click on the strip recentres the window.
 * Here the window is controlled by the dashboard (presets, KPIs, allocation and chart all follow it).
 */
import { useMemo, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { scaleLinear } from 'd3';
import { useElementSize } from '../../../motion';
import { fmt } from './data';
import s from './styles.module.css';

type Part = 'start' | 'end' | 'window';
interface Props {
  dates: number[];
  values: ArrayLike<number>;
  win: readonly [number, number];
  minSpan: number;
  describedBy: string;
  onChange: (w: [number, number], via: 'drag' | 'key') => void;
  onCommit: () => void;
}

export function RangeBrush({ dates, values, win, minSpan, describedBy, onChange, onCommit }: Props) {
  const stripRef = useRef<HTMLDivElement>(null);
  const { width: sw, height: sh } = useElementSize(stripRef);
  const n = dates.length;
  const drag = useRef<{ part: Part; x: number; win: readonly [number, number] } | null>(null);
  const sx = useMemo(() => scaleLinear().domain([0, n - 1]).range([0, sw]), [n, sw]);

  const path = useMemo(() => {
    if (sw <= 0 || sh <= 0) return '';
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) { lo = Math.min(lo, values[i]); hi = Math.max(hi, values[i]); }
    const sy = scaleLinear().domain([lo, hi]).range([sh - 6, 6]);
    let d = '';
    for (let i = 0; i < n; i++) d += `${i ? 'L' : 'M'}${sx(i).toFixed(1)} ${sy(values[i]).toFixed(1)}`;
    return d;
  }, [values, n, sx, sw, sh]);

  const years = useMemo(() => {
    const out: { i: number; label: string }[] = [];
    for (let i = 1; i < n; i++) if (new Date(dates[i]).getUTCFullYear() !== new Date(dates[i - 1]).getUTCFullYear()) out.push({ i, label: fmt.year.format(dates[i]) });
    return out;
  }, [dates, n]);
  const quarters = useMemo(() => {
    const out: number[] = [];
    for (let i = 1; i < n; i++) { const m = new Date(dates[i]).getUTCMonth(); if (m % 3 === 0 && m !== new Date(dates[i - 1]).getUTCMonth()) out.push(i); }
    return out;
  }, [dates, n]);

  const apply = (part: Part, base: readonly [number, number], delta: number): [number, number] => {
    const d = Math.round(delta);
    if (part === 'start') return [Math.min(base[1] - minSpan, Math.max(0, base[0] + d)), base[1]];
    if (part === 'end') return [base[0], Math.max(base[0] + minSpan, Math.min(n - 1, base[1] + d))];
    const span = base[1] - base[0];
    const a = Math.min(n - 1 - span, Math.max(0, base[0] + d));
    return [a, a + span];
  };
  const onDown = (part: Part) => (ev: PointerEvent<HTMLDivElement>) => {
    if (ev.button !== 0) return;
    ev.stopPropagation();
    ev.currentTarget.setPointerCapture(ev.pointerId);
    drag.current = { part, x: ev.clientX, win };
  };
  const onMove = (ev: PointerEvent<HTMLDivElement>) => {
    const g = drag.current;
    if (!g || sw <= 0) return;
    const next = apply(g.part, g.win, ((ev.clientX - g.x) / sw) * (n - 1));
    if (next[0] !== win[0] || next[1] !== win[1]) onChange(next, 'drag');
  };
  const onUp = () => { if (drag.current) { drag.current = null; onCommit(); } };
  const onKey = (part: Part) => (ev: KeyboardEvent<HTMLDivElement>) => {
    const big = ev.shiftKey ? 5 : 1;
    const d = ev.key === 'ArrowLeft' || ev.key === 'ArrowDown' ? -big : ev.key === 'ArrowRight' || ev.key === 'ArrowUp' ? big
      : ev.key === 'PageDown' ? -5 : ev.key === 'PageUp' ? 5 : ev.key === 'Home' ? -n : ev.key === 'End' ? n : 0;
    if (!d) return;
    ev.preventDefault();
    onChange(apply(part, win, d), 'key');
  };
  const onTrackDown = (ev: PointerEvent<HTMLDivElement>) => {
    if (ev.button !== 0 || sw <= 0) return;
    const r = ev.currentTarget.getBoundingClientRect();
    const centre = ((ev.clientX - r.left) / r.width) * (n - 1);
    const span = win[1] - win[0];
    const a = Math.min(n - 1 - span, Math.max(0, Math.round(centre - span / 2)));
    onChange([a, a + span], 'drag');
    onCommit();
  };

  const left = sx(win[0]), right = sx(win[1]);
  const text = (i: number) => fmt.dateLong.format(dates[i]);

  return (
    <div className={s.brush}>
      <div ref={stripRef} className={s.strip} onPointerDown={onTrackDown}>
        {sw > 0 && (
          <svg width={sw} height={sh} aria-hidden="true" className={s.svg}>
            {quarters.map((i) => <line key={i} x1={sx(i)} x2={sx(i)} y1={0} y2={sh} className={s.grid} />)}
            <path d={path} className={s.overview} />
          </svg>
        )}
        <div className={s.shade} style={{ left: 0, width: Math.max(0, left) }} />
        <div className={s.shade} style={{ left: right, right: 0 }} />
        <div
          className={s.window}
          style={{ left, width: Math.max(0, right - left) }}
          role="slider" tabIndex={0} aria-label="Move range" aria-describedby={describedBy}
          aria-valuemin={0} aria-valuemax={n - 1 - (win[1] - win[0])} aria-valuenow={win[0]}
          aria-valuetext={`${text(win[0])} to ${text(win[1])}`}
          onPointerDown={onDown('window')} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          onKeyDown={onKey('window')} onKeyUp={(e) => { if (e.key.startsWith('Arrow') || e.key.startsWith('Page') || e.key === 'Home' || e.key === 'End') onCommit(); }}
        />
        {(['start', 'end'] as const).map((part) => (
          <div
            key={part}
            className={s.handle}
            style={{ left: part === 'start' ? left : right }}
            role="slider" tabIndex={0}
            aria-label={part === 'start' ? 'Range start' : 'Range end'} aria-describedby={describedBy}
            aria-valuemin={part === 'start' ? 0 : win[0] + minSpan}
            aria-valuemax={part === 'start' ? win[1] - minSpan : n - 1}
            aria-valuenow={part === 'start' ? win[0] : win[1]}
            aria-valuetext={text(part === 'start' ? win[0] : win[1])}
            onPointerDown={onDown(part)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            onKeyDown={onKey(part)} onKeyUp={(e) => { if (e.key.startsWith('Arrow') || e.key.startsWith('Page') || e.key === 'Home' || e.key === 'End') onCommit(); }}
          ><span /></div>
        ))}
      </div>
      <div className={s.years} aria-hidden="true">
        {years.map((y) => <span key={y.i} style={{ left: sx(y.i) }}>{y.label}</span>)}
      </div>
    </div>
  );
}
