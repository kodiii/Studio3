'use client';
/**
 * One-dimensional brush over a chart. Technique from the brush-linked-range recipe (effects/brush-linked-range): the
 * window and both edges are real role="slider" controls (arrows step, Shift steps big, Home/End jump), pointer
 * capture drives drags, and dragging across empty chart draws a new range. Here it is generic: any domain, any
 * background chart (passed as a render function), and `null` means "no filter".
 */
import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { scaleLinear, type ScaleLinear } from 'd3';
import { useElementSize } from '../../../motion';
import s from './styles.module.css';

type Part = 'start' | 'end' | 'window';
interface Props {
  domain: readonly [number, number];
  step: number;
  big: number;
  value: readonly [number, number] | null;
  onChange: (v: [number, number] | null) => void;
  label: string;
  format: (v: number) => string;
  margin: { left: number; right: number };
  height: number;
  describedBy?: string;
  /** Space kept free under the window and handles (for an axis label row). */
  inset?: number;
  children?: (x: ScaleLinear<number, number>, width: number, height: number) => ReactNode;
}

export function RangeBrush({ domain, step, big, value, onChange, label, format, margin, height, describedBy, inset = 0, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { width } = useElementSize(ref);
  const [lo, hi] = domain;
  const v: [number, number] = value ? [value[0], value[1]] : [lo, hi];
  const x = scaleLinear().domain([lo, hi]).range([margin.left, Math.max(margin.left + 1, width - margin.right)]);
  const drag = useRef<{ part: Part | 'new'; px: number; v: [number, number]; moved: boolean } | null>(null);
  const [draft, setDraft] = useState<[number, number] | null>(null);
  const snap = (n: number) => Math.round(n / step) * step;
  const clampV = (n: number) => Math.min(hi, Math.max(lo, n));
  const emit = (a: number, b: number) => {
    const r: [number, number] = [clampV(Math.min(a, b)), clampV(Math.max(a, b))];
    onChange(r[0] <= lo && r[1] >= hi ? null : r);
  };
  const minSpan = step;
  const apply = (part: Part, base: [number, number], d: number): [number, number] => {
    if (part === 'start') return [Math.min(base[1] - minSpan, clampV(snap(base[0] + d))), base[1]];
    if (part === 'end') return [base[0], Math.max(base[0] + minSpan, clampV(snap(base[1] + d)))];
    const span = base[1] - base[0];
    const a = Math.min(hi - span, Math.max(lo, snap(base[0] + d)));
    return [a, a + span];
  };
  const valueAt = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return clampV(x.invert(clientX - r.left));
  };

  const down = (part: Part | 'new') => (ev: PointerEvent<HTMLDivElement>) => {
    if (ev.button !== 0 || width <= 0) return;
    ev.stopPropagation();
    ev.currentTarget.setPointerCapture(ev.pointerId);
    drag.current = { part, px: ev.clientX, v, moved: false };
  };
  const move = (ev: PointerEvent<HTMLDivElement>) => {
    const g = drag.current;
    if (!g) return;
    if (!g.moved && Math.abs(ev.clientX - g.px) < 3) return;
    g.moved = true;
    if (g.part === 'new') { setDraft([valueAt(g.px), valueAt(ev.clientX)]); return; }
    const per = (hi - lo) / Math.max(1, x.range()[1] - x.range()[0]);
    const next = apply(g.part, g.v, (ev.clientX - g.px) * per);
    emit(next[0], next[1]);
  };
  const up = (ev: PointerEvent<HTMLDivElement>) => {
    const g = drag.current;
    drag.current = null;
    if (!g) return;
    if (g.part === 'new') {
      setDraft(null);
      if (!g.moved) { onChange(null); return; }
      const a = snap(valueAt(g.px)), b = snap(valueAt(ev.clientX));
      if (Math.abs(b - a) >= step) emit(a, b);
    }
  };
  const key = (part: Part) => (ev: KeyboardEvent<HTMLDivElement>) => {
    const d = ev.key === 'ArrowLeft' || ev.key === 'ArrowDown' ? -(ev.shiftKey ? big : step) : ev.key === 'ArrowRight' || ev.key === 'ArrowUp' ? (ev.shiftKey ? big : step)
      : ev.key === 'PageDown' ? -big : ev.key === 'PageUp' ? big : ev.key === 'Home' ? lo - hi : ev.key === 'End' ? hi - lo : 0;
    if (ev.key === 'Escape' && value) { ev.preventDefault(); onChange(null); return; }
    if (!d) return;
    ev.preventDefault();
    const next = apply(part, v, d);
    emit(next[0], next[1]);
  };

  const shown = draft ? [Math.min(draft[0], draft[1]), Math.max(draft[0], draft[1])] : v;
  const left = x(shown[0]), right = x(shown[1]);
  return (
    <div ref={ref} className={s.brush} style={{ height }} data-active={value || draft ? '' : undefined}
      onPointerDown={down('new')} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; setDraft(null); }}>
      {width > 0 && children ? children(x, width, height) : null}
      {(value || draft) && (
        <>
          <div className={s.shade} style={{ left: margin.left, width: Math.max(0, left - margin.left), bottom: inset }} />
          <div className={s.shade} style={{ left: right, width: Math.max(0, x.range()[1] - right), bottom: inset }} />
        </>
      )}
      <div
        className={s.window} style={{ left, width: Math.max(0, right - left), bottom: inset }}
        role="slider" tabIndex={0} aria-label={`Move ${label} range`} aria-describedby={describedBy}
        aria-valuemin={lo} aria-valuemax={hi - (v[1] - v[0])} aria-valuenow={v[0]}
        aria-valuetext={value ? `${format(v[0])} to ${format(v[1])}` : `All ${label} values, ${format(lo)} to ${format(hi)}`}
        onPointerDown={down('window')} onKeyDown={key('window')}
      />
      {(['start', 'end'] as const).map((part) => (
        <div
          key={part} className={s.handle} style={{ left: part === 'start' ? left : right, bottom: inset }}
          role="slider" tabIndex={0} aria-label={`${label[0].toUpperCase()}${label.slice(1)} ${part === 'start' ? 'from' : 'to'}`} aria-describedby={describedBy}
          aria-valuemin={part === 'start' ? lo : v[0] + minSpan} aria-valuemax={part === 'start' ? v[1] - minSpan : hi}
          aria-valuenow={part === 'start' ? v[0] : v[1]} aria-valuetext={format(part === 'start' ? v[0] : v[1])}
          onPointerDown={down(part)} onKeyDown={key(part)}
        ><span /></div>
      ))}
    </div>
  );
}
