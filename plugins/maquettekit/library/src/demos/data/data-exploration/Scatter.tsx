'use client';
import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { scaleLinear } from 'd3';
import { useElementSize } from '../../../motion';
import { ALT, SCORE, fmt, type Lot } from './data';
import s from './styles.module.css';

export type Mark = 'washed' | 'natural' | 'honey' | 'a' | 'b';
export const SCATTER_M = { top: 14, right: 14, bottom: 30, left: 46 };

interface Props {
  lots: Lot[];
  inSel: (l: Lot) => boolean;
  markOf: (l: Lot) => Mark | null;
  alt: readonly [number, number] | null;
  score: readonly [number, number] | null;
  onBrush: (alt: [number, number] | null, score: [number, number] | null) => void;
  pinned: string | null;
  onPin: (id: string | null) => void;
  describe: (l: Lot) => string;
  trend: { slope: number; intercept: number; r: number; x0: number; x1: number } | null;
}

function Shape({ mark, x, y, r }: { mark: Mark; x: number; y: number; r: number }) {
  if (mark === 'natural' || mark === 'b') return <rect x={x - r * 0.88} y={y - r * 0.88} width={r * 1.76} height={r * 1.76} />;
  if (mark === 'honey') return <path d={`M${x} ${y - r * 1.15}L${x + r * 1.05} ${y + r * 0.75}L${x - r * 1.05} ${y + r * 0.75}Z`} />;
  return <circle cx={x} cy={y} r={r} />;
}

export function Scatter({ lots, inSel, markOf, alt, score, onBrush, pinned, onPin, describe, trend }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(ref);
  const M = SCATTER_M;
  const x = scaleLinear().domain(ALT).range([M.left, Math.max(M.left + 1, width - M.right)]);
  const y = scaleLinear().domain(SCORE).range([Math.max(M.top + 1, height - M.bottom), M.top]);
  const drag = useRef<{ x0: number; y0: number; moved: boolean } | null>(null);
  const [draft, setDraft] = useState<[number, number, number, number] | null>(null);
  const [hover, setHover] = useState<Lot | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);

  const order = useMemo(() => lots.filter(inSel).sort((a, b) => a.altitude - b.altitude || a.score - b.score || a.id.localeCompare(b.id)), [lots, inSel]);
  const cur = cursor !== null && order.length ? order[Math.min(cursor, order.length - 1)] : null;
  const active = cur ?? hover;

  const local = (ev: PointerEvent<HTMLDivElement>) => { const r = ev.currentTarget.getBoundingClientRect(); return { px: ev.clientX - r.left, py: ev.clientY - r.top }; };
  const nearest = (px: number, py: number, radius = 14): Lot | null => {
    let best: Lot | null = null, bd = radius * radius;
    for (const l of lots) { const dx = x(l.altitude) - px, dy = y(l.score) - py, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = l; } }
    return best;
  };
  const onDown = (ev: PointerEvent<HTMLDivElement>) => {
    if (ev.button !== 0) return;
    ev.currentTarget.setPointerCapture(ev.pointerId);
    const p = local(ev);
    drag.current = { x0: p.px, y0: p.py, moved: false };
  };
  const onMove = (ev: PointerEvent<HTMLDivElement>) => {
    const p = local(ev);
    const g = drag.current;
    if (!g) { setHover(nearest(p.px, p.py)); return; }
    if (!g.moved && Math.hypot(p.px - g.x0, p.py - g.y0) < 5) return;
    g.moved = true;
    setHover(null);
    setDraft([g.x0, g.y0, p.px, p.py]);
  };
  const onUp = (ev: PointerEvent<HTMLDivElement>) => {
    const g = drag.current;
    drag.current = null;
    if (!g) return;
    const p = local(ev);
    if (!g.moved) {
      const hit = nearest(p.px, p.py);
      if (hit) onPin(hit.id === pinned ? null : hit.id);
      else { onPin(null); if (alt || score) onBrush(null, null); }
      return;
    }
    setDraft(null);
    const a0 = Math.round(x.invert(Math.min(g.x0, p.px)) / 10) * 10, a1 = Math.round(x.invert(Math.max(g.x0, p.px)) / 10) * 10;
    const s0 = Math.round(y.invert(Math.max(g.y0, p.py)) * 4) / 4, s1 = Math.round(y.invert(Math.min(g.y0, p.py)) * 4) / 4;
    const ca = (v: number) => Math.min(ALT[1], Math.max(ALT[0], v)), cs = (v: number) => Math.min(SCORE[1], Math.max(SCORE[0], v));
    onBrush(a1 - a0 >= 20 ? [ca(a0), ca(a1)] : null, s1 - s0 >= 0.25 ? [cs(s0), cs(s1)] : null);
  };
  const onKey = (ev: KeyboardEvent<HTMLDivElement>) => {
    if (!order.length) return;
    if (ev.key === 'Escape') { setCursor(null); return; }
    if ((ev.key === 'Enter' || ev.key === ' ') && cur) { ev.preventDefault(); onPin(cur.id === pinned ? null : cur.id); return; }
    const c = cursor ?? 0;
    const next = ev.key === 'ArrowRight' || ev.key === 'ArrowUp' ? c + 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowDown' ? c - 1
      : ev.key === 'PageUp' ? c + 10 : ev.key === 'PageDown' ? c - 10 : ev.key === 'Home' ? 0 : ev.key === 'End' ? order.length - 1 : null;
    if (next === null) return;
    ev.preventDefault();
    setCursor(Math.min(order.length - 1, Math.max(0, next)));
  };

  const ready = width > 80 && height > 80;
  const bx0 = alt ? x(alt[0]) : M.left, bx1 = alt ? x(alt[1]) : x.range()[1];
  const by0 = score ? y(score[1]) : M.top, by1 = score ? y(score[0]) : y.range()[0];
  const pinnedLot = pinned ? lots.find((l) => l.id === pinned) ?? null : null;

  return (
    <div ref={ref} className={s.scatter}>
      {ready && (
        <svg width={width} height={height} aria-hidden="true" className={s.svg}>
          {y.ticks(10).map((t) => (
            <g key={`y${t}`} transform={`translate(0 ${y(t)})`}>
              <line x1={M.left} x2={x.range()[1]} className={s.grid} />
              <text x={M.left - 8} y={4} textAnchor="end" className={s.tick}>{t}</text>
            </g>
          ))}
          {x.ticks(width < 520 ? 4 : 7).map((t) => (
            <g key={`x${t}`} transform={`translate(${x(t)} 0)`}>
              <line y1={M.top} y2={y.range()[0]} className={s.grid} />
              <text y={y.range()[0] + 18} textAnchor="middle" className={s.tick}>{fmt.int.format(t)}</text>
            </g>
          ))}
          {(alt || score) && <rect x={bx0} y={by0} width={Math.max(0, bx1 - bx0)} height={Math.max(0, by1 - by0)} className={s.brushRect} />}
          {lots.filter((l) => !inSel(l) || !markOf(l)).map((l) => <g key={l.id} className={s.ctx}><Shape mark={markOf(l) ?? 'washed'} x={x(l.altitude)} y={y(l.score)} r={3.2} /></g>)}
          {lots.filter((l) => inSel(l) && markOf(l)).map((l) => <g key={l.id} className={s.pt} data-mark={markOf(l)!}><Shape mark={markOf(l)!} x={x(l.altitude)} y={y(l.score)} r={3.6} /></g>)}
          {trend && (
            <g className={s.trend}>
              <line x1={x(trend.x0)} x2={x(trend.x1)} y1={y(trend.intercept + trend.slope * trend.x0)} y2={y(trend.intercept + trend.slope * trend.x1)} />
              <text x={x(trend.x1) - 4} y={y(trend.intercept + trend.slope * trend.x1) - 8} textAnchor="end">r = {fmt.r.format(trend.r)}</text>
            </g>
          )}
          {pinnedLot && <circle cx={x(pinnedLot.altitude)} cy={y(pinnedLot.score)} r={8} className={s.pinRing} />}
          {active && <circle cx={x(active.altitude)} cy={y(active.score)} r={6.5} className={s.focusRing} />}
          {draft && <rect x={Math.min(draft[0], draft[2])} y={Math.min(draft[1], draft[3])} width={Math.abs(draft[2] - draft[0])} height={Math.abs(draft[3] - draft[1])} className={s.draftRect} />}
        </svg>
      )}
      {active && ready && (
        <div className={s.tip} data-side={x(active.altitude) > width * 0.6 ? 'left' : 'right'} style={{ transform: `translate(${x(active.altitude)}px, ${y(active.score)}px)` }} aria-hidden="true">
          <div><strong>{active.id}</strong><span>{describe(active)}</span></div>
        </div>
      )}
      <div
        className={s.hit}
        role="slider"
        tabIndex={0}
        aria-label="Lots in the scatter plot. Arrow keys step through the selected lots by altitude, Enter pins one, Escape hides the readout."
        aria-valuemin={order.length ? 1 : 0}
        aria-valuemax={order.length}
        aria-valuenow={cur ? Math.min(cursor!, order.length - 1) + 1 : 0}
        aria-valuetext={cur ? `${cur.id}: ${describe(cur)}${cur.id === pinned ? ', pinned' : ''}` : `${order.length} selected lots. Use the arrow keys to step through them.`}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
        onPointerLeave={() => setHover(null)} onPointerCancel={() => { drag.current = null; setDraft(null); }}
        onFocus={() => setCursor((c) => c ?? Math.max(0, order.findIndex((l) => l.id === pinned)))}
        onBlur={() => setCursor(null)}
        onKeyDown={onKey}
      />
    </div>
  );
}
