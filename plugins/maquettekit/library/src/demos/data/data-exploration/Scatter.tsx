'use client';
/**
 * Altitude × score scatter. Marks are one list keyed by lot id (a lot keeps its node as it moves in or out of the
 * selection; context marks are drawn first so selected marks sit on top). On top of the marks, three physical layers:
 *  - a halo with axis guides and exact readouts that glides from mark to mark on `spring.press` as the pointer (or the
 *    keyboard cursor) moves — the continuous pointer response;
 *  - the pinned lot, lifted off the paper (light from the top left, so its shadow falls down and right);
 *  - the brush rectangle, which follows the hand while drawn and springs onto the snapped ranges on release, or onto
 *    ranges set elsewhere (the altitude and score brushes).
 * Brushing is live: the selection updates as the rectangle is drawn. Reduced motion: no glide, no spring, no entrance.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { scaleLinear } from 'd3';
import { spring as SPRING, useElementSize, useIsomorphicLayoutEffect, useStudioMotion } from '../../../motion';
import { ALT, SCORE, fmt, type Lot } from './data';
import { createLoop, stepSpring } from './physics';
import s from './styles.module.css';

export type Mark = 'washed' | 'natural' | 'honey' | 'a' | 'b';
export const SCATTER_M = { top: 14, right: 14, bottom: 30, left: 46 };
/** Pointer reach for hover and click, px. */
const REACH = 20;

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
  /** Play the one-time entrance (marks sweep in by altitude). */
  entering: boolean;
}

function Shape({ mark, x, y, r }: { mark: Mark; x: number; y: number; r: number }) {
  if (mark === 'natural' || mark === 'b') return <rect x={x - r * 0.88} y={y - r * 0.88} width={r * 1.76} height={r * 1.76} />;
  if (mark === 'honey') return <path d={`M${x} ${y - r * 1.15}L${x + r * 1.05} ${y + r * 0.75}L${x - r * 1.05} ${y + r * 0.75}Z`} />;
  return <circle cx={x} cy={y} r={r} />;
}

/** Halo, guides and readouts; positions are written straight to the DOM by the spring loop. */
interface HaloDom { g: SVGGElement | null; read: SVGGElement | null; gx: SVGLineElement | null; gy: SVGLineElement | null; glow: SVGCircleElement | null; ring: SVGCircleElement | null; rx: SVGGElement | null; ry: SVGGElement | null; tip: HTMLDivElement | null }

export function Scatter({ lots, inSel, markOf, alt, score, onBrush, pinned, onPin, describe, trend, entering }: Props) {
  const uid = useId();
  const { reduced } = useStudioMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(ref);
  const M = SCATTER_M;
  const x = scaleLinear().domain(ALT).range([M.left, Math.max(M.left + 1, width - M.right)]);
  const y = scaleLinear().domain(SCORE).range([Math.max(M.top + 1, height - M.bottom), M.top]);
  const drag = useRef<{ x0: number; y0: number; moved: boolean } | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [hover, setHover] = useState<Lot | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);

  const order = useMemo(() => lots.filter(inSel).sort((a, b) => a.altitude - b.altitude || a.score - b.score || a.id.localeCompare(b.id)), [lots, inSel]);
  const cur = cursor !== null && order.length ? order[Math.min(cursor, order.length - 1)] : null;
  const active = cur ?? hover;
  const activeMark: Mark = active ? (markOf(active) ?? 'washed') : 'washed';

  const local = (ev: PointerEvent<HTMLDivElement>) => { const r = ev.currentTarget.getBoundingClientRect(); return { px: ev.clientX - r.left, py: ev.clientY - r.top }; };
  const nearest = (px: number, py: number): Lot | null => {
    let best: Lot | null = null, bd = REACH * REACH;
    for (const l of lots) { const dx = x(l.altitude) - px, dy = y(l.score) - py, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = l; } }
    return best;
  };
  const toBrush = (x0: number, y0: number, x1: number, y1: number) => {
    const a0 = Math.round(x.invert(Math.min(x0, x1)) / 10) * 10, a1 = Math.round(x.invert(Math.max(x0, x1)) / 10) * 10;
    const s0 = Math.round(y.invert(Math.max(y0, y1)) * 4) / 4, s1 = Math.round(y.invert(Math.min(y0, y1)) * 4) / 4;
    const ca = (v: number) => Math.min(ALT[1], Math.max(ALT[0], v)), cs = (v: number) => Math.min(SCORE[1], Math.max(SCORE[0], v));
    return [a1 - a0 >= 20 ? [ca(a0), ca(a1)] : null, s1 - s0 >= 0.25 ? [cs(s0), cs(s1)] : null] as [[number, number] | null, [number, number] | null];
  };

  /* ── brush rectangle: follows the hand, then springs onto the value ─────────────────────────────────────────── */
  const ready = width > 80 && height > 80;
  const bx0 = alt ? x(alt[0]) : M.left, bx1 = alt ? x(alt[1]) : x.range()[1];
  const by0 = score ? y(score[1]) : M.top, by1 = score ? y(score[0]) : y.range()[0];
  const brushed = !!(alt || score);
  const rectEl = useRef<SVGRectElement | null>(null);
  const rect = useRef({ p: [bx0, by0, bx1, by1], v: [0, 0, 0, 0], o: brushed ? 1 : 0, vo: 0, goal: [bx0, by0, bx1, by1], go: brushed ? 1 : 0 });
  const paintRect = () => {
    const el = rectEl.current;
    if (!el) return;
    const [a, b, c, d] = rect.current.p;
    el.setAttribute('x', Math.min(a, c).toFixed(2)); el.setAttribute('y', Math.min(b, d).toFixed(2));
    el.setAttribute('width', Math.abs(c - a).toFixed(2)); el.setAttribute('height', Math.abs(d - b).toFixed(2));
    el.style.opacity = String(Math.max(0, Math.min(1, rect.current.o)));
  };

  /* ── halo: glides to the active mark ────────────────────────────────────────────────────────────────────────── */
  const halo = useRef<HaloDom>({ g: null, read: null, gx: null, gy: null, glow: null, ring: null, rx: null, ry: null, tip: null });
  const hs = useRef({ x: 0, y: 0, vx: 0, vy: 0, o: 0, vo: 0, tx: 0, ty: 0, to: 0 });
  const geo = useRef({ left: M.left, base: y.range()[0], top: M.top });
  geo.current = { left: M.left, base: y.range()[0], top: M.top };
  const paintHalo = () => {
    const h = halo.current, st = hs.current, g = geo.current;
    const o = Math.max(0, Math.min(1, st.o));
    if (h.g) h.g.style.opacity = o.toFixed(3);
    if (h.gx) { h.gx.setAttribute('x1', st.x.toFixed(2)); h.gx.setAttribute('x2', st.x.toFixed(2)); h.gx.setAttribute('y1', (st.y + 8).toFixed(2)); h.gx.setAttribute('y2', g.base.toFixed(2)); }
    if (h.gy) { h.gy.setAttribute('x1', g.left.toFixed(2)); h.gy.setAttribute('x2', (st.x - 8).toFixed(2)); h.gy.setAttribute('y1', st.y.toFixed(2)); h.gy.setAttribute('y2', st.y.toFixed(2)); }
    const r = 7 + 6 * o;
    if (h.glow) { h.glow.setAttribute('cx', st.x.toFixed(2)); h.glow.setAttribute('cy', st.y.toFixed(2)); h.glow.setAttribute('r', (r + 4).toFixed(2)); }
    if (h.ring) { h.ring.setAttribute('cx', st.x.toFixed(2)); h.ring.setAttribute('cy', st.y.toFixed(2)); h.ring.setAttribute('r', (4 + 2.6 * o).toFixed(2)); }
    // Information is never held behind a fade: readouts and the tooltip are shown at once; only their position glides.
    const shown = st.to > 0 ? '1' : '0';
    if (h.read) h.read.style.opacity = shown;
    if (h.rx) h.rx.setAttribute('transform', `translate(${st.x.toFixed(2)} ${g.base.toFixed(2)})`);
    if (h.ry) h.ry.setAttribute('transform', `translate(${g.left.toFixed(2)} ${st.y.toFixed(2)})`);
    if (h.tip) { h.tip.style.transform = `translate(${st.x.toFixed(1)}px, ${st.y.toFixed(1)}px)`; h.tip.style.opacity = shown; }
  };

  const live = useRef({ reduced, drawing });
  live.current = { reduced, drawing };
  const loop = useRef<ReturnType<typeof createLoop> | null>(null);
  const tick = (dt: number): boolean => {
    let moving = false;
    // Halo: position on `spring.press`, opacity on `spring.settle`.
    const st = hs.current;
    [st.x, st.vx] = stepSpring(st.x, st.vx, st.tx, SPRING.press, dt);
    [st.y, st.vy] = stepSpring(st.y, st.vy, st.ty, SPRING.press, dt);
    [st.o, st.vo] = stepSpring(st.o, st.vo, st.to, SPRING.settle, dt);
    if (Math.abs(st.x - st.tx) > 0.05 || Math.abs(st.y - st.ty) > 0.05 || Math.abs(st.o - st.to) > 0.004 || Math.abs(st.vx) + Math.abs(st.vy) > 0.5) moving = true;
    else { st.x = st.tx; st.y = st.ty; st.o = st.to; st.vx = st.vy = st.vo = 0; }
    paintHalo();
    // Brush rectangle: edges on `spring.settle` (the same family as the range brushes, so they land together).
    const rc = rect.current;
    if (!live.current.drawing) {
      for (let k = 0; k < 4; k++) [rc.p[k], rc.v[k]] = stepSpring(rc.p[k], rc.v[k], rc.goal[k], SPRING.settle, dt);
      [rc.o, rc.vo] = stepSpring(rc.o, rc.vo, rc.go, SPRING.settle, dt);
      const still = rc.p.every((p, k) => Math.abs(p - rc.goal[k]) < 0.05 && Math.abs(rc.v[k]) < 0.5) && Math.abs(rc.o - rc.go) < 0.004;
      if (still) { rc.p = [...rc.goal]; rc.v = [0, 0, 0, 0]; rc.o = rc.go; rc.vo = 0; } else moving = true;
      paintRect();
    }
    return moving;
  };
  const tickRef = useRef(tick);
  tickRef.current = tick;
  if (!loop.current) loop.current = createLoop((dt) => tickRef.current(dt));
  useEffect(() => () => loop.current?.stop(), []);

  // Halo target follows the active lot (pointer hover or keyboard cursor).
  const ax = active ? x(active.altitude) : null, ay = active ? y(active.score) : null;
  useIsomorphicLayoutEffect(() => {
    const st = hs.current;
    if (ax === null || ay === null) { st.to = 0; }
    else {
      // Appearing from nothing: start on the mark rather than gliding in from wherever it last was.
      if (st.o < 0.05) { st.x = ax; st.y = ay; st.vx = st.vy = 0; }
      st.tx = ax; st.ty = ay; st.to = 1;
    }
    if (reduced) { st.x = st.tx; st.y = st.ty; st.o = st.to; st.vx = st.vy = st.vo = 0; paintHalo(); return; }
    loop.current?.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ax, ay, reduced]);

  // Brush rectangle target: the committed ranges (or the whole plot, fading out, when nothing is brushed).
  const primed = useRef(false);
  useIsomorphicLayoutEffect(() => {
    const rc = rect.current;
    rc.goal = [bx0, by0, bx1, by1];
    rc.go = brushed ? 1 : 0;
    if (drawing) return;
    // Before the first measured layout (and under reduced motion) the rectangle is simply placed, never sprung.
    if (reduced || !ready || !primed.current) { primed.current = ready; rc.p = [...rc.goal]; rc.v = [0, 0, 0, 0]; rc.o = rc.go; rc.vo = 0; paintRect(); return; }
    loop.current?.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bx0, by0, bx1, by1, brushed, reduced, ready, drawing]);
  useIsomorphicLayoutEffect(() => { paintRect(); paintHalo(); });

  /* ── pointer ─────────────────────────────────────────────────────────────────────────────────────────────────── */
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
    if (!g.moved) { g.moved = true; setHover(null); setDrawing(true); live.current.drawing = true; }
    // The rectangle follows the hand exactly; the selection follows it live, snapped.
    const rc = rect.current;
    const cx = Math.min(x.range()[1], Math.max(M.left, p.px)), cy = Math.min(y.range()[0], Math.max(M.top, p.py));
    rc.p = [g.x0, g.y0, cx, cy]; rc.v = [0, 0, 0, 0]; rc.o = 1; rc.vo = 0;
    paintRect();
    const [na, ns] = toBrush(g.x0, g.y0, cx, cy);
    onBrush(na, ns);
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
    const rc = rect.current;
    const [a, b, c, d] = rc.p;
    rc.p = [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)];
    setDrawing(false);
    live.current.drawing = false;
    const [na, ns] = toBrush(g.x0, g.y0, Math.min(x.range()[1], Math.max(M.left, p.px)), Math.min(y.range()[0], Math.max(M.top, p.py)));
    onBrush(na, ns);
    loop.current?.start();
  };
  const onCancel = () => {
    drag.current = null;
    if (drawing) { setDrawing(false); live.current.drawing = false; loop.current?.start(); }
  };
  const onKey = (ev: KeyboardEvent<HTMLDivElement>) => {
    if (!order.length) return;
    if (ev.key === 'Escape') { setCursor(null); return; }
    if ((ev.key === 'Enter' || ev.key === ' ') && cur) { ev.preventDefault(); onPin(cur.id === pinned ? null : cur.id); return; }
    // Arrow keys start from what the reader is looking at: the hovered or pinned lot, else the first.
    const c = cursor ?? Math.max(0, order.findIndex((l) => l.id === (hover?.id ?? pinned)));
    const next = ev.key === 'ArrowRight' || ev.key === 'ArrowUp' ? c + 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowDown' ? c - 1
      : ev.key === 'PageUp' ? c + 10 : ev.key === 'PageDown' ? c - 10 : ev.key === 'Home' ? 0 : ev.key === 'End' ? order.length - 1 : null;
    if (next === null) return;
    ev.preventDefault();
    setCursor(Math.min(order.length - 1, Math.max(0, next)));
  };

  const pinnedLot = pinned ? lots.find((l) => l.id === pinned) ?? null : null;
  const pinnedMark: Mark = pinnedLot ? (markOf(pinnedLot) ?? 'washed') : 'washed';
  // Context first, selection on top; one keyed list so a lot keeps its node across selections.
  const ordered = useMemo(() => {
    const ctx: Lot[] = [], sel: Lot[] = [];
    for (const l of lots) (inSel(l) && markOf(l) ? sel : ctx).push(l);
    return [...ctx, ...sel];
  }, [lots, inSel, markOf]);
  const tipSide = active && x(active.altitude) > width * 0.6 ? 'left' : 'right';

  return (
    <div ref={ref} className={s.scatter}>
      {ready && (
        <svg width={width} height={height} aria-hidden="true" className={s.svg}>
          <defs>
            {/* One light, top left: the lifted mark's shadow falls down and to the right. */}
            <filter id={`${uid}-lift`} x="-80%" y="-80%" width="260%" height="260%" colorInterpolationFilters="sRGB">
              <feDropShadow dx="1.1" dy="2.2" stdDeviation="1.5" floodColor="#000" floodOpacity="0.32" />
            </filter>
          </defs>
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
          <rect ref={rectEl} className={drawing ? s.draftRect : s.brushRect} />
          <g className={s.marks} data-enter={entering && !reduced ? '' : undefined}>
            {ordered.map((l) => {
              const m = markOf(l);
              const on = inSel(l) && m;
              return (
                <g key={l.id} className={on ? s.pt : s.ctx} data-mark={on ? m! : undefined}
                  style={{ ['--i' as string]: Math.round((Math.min(13, Math.floor((l.altitude - ALT[0]) / 100)) * 10) / 13) }}>
                  <Shape mark={m ?? 'washed'} x={x(l.altitude)} y={y(l.score)} r={on ? 3.6 : 3.2} />
                </g>
              );
            })}
          </g>
          {trend && (
            <g className={s.trend}>
              <line x1={x(trend.x0)} x2={x(trend.x1)} y1={y(trend.intercept + trend.slope * trend.x0)} y2={y(trend.intercept + trend.slope * trend.x1)} />
              <text x={x(trend.x1) - 4} y={y(trend.intercept + trend.slope * trend.x1) - 8} textAnchor="end">r = {fmt.r.format(trend.r)}</text>
            </g>
          )}
          {pinnedLot && (
            <g key={pinnedLot.id} className={s.pinLift} data-mark={pinnedMark} transform={`translate(${x(pinnedLot.altitude).toFixed(2)} ${y(pinnedLot.score).toFixed(2)})`}>
              <g className={s.pinPop}>
                <circle r={10.5} className={s.pinRing} />
                <g filter={`url(#${uid}-lift)`} className={s.pinMark}><Shape mark={pinnedMark} x={0} y={0} r={5} /></g>
              </g>
              <g className={s.pinTag} transform={`translate(${x(pinnedLot.altitude) > width - 110 ? -14 : 14} -14)`}>
                <text textAnchor={x(pinnedLot.altitude) > width - 110 ? 'end' : 'start'}>{pinnedLot.id}</text>
              </g>
            </g>
          )}
          <g ref={(el) => { halo.current.g = el; }} className={s.halo} data-mark={activeMark} style={{ opacity: 0 }}>
            <line ref={(el) => { halo.current.gx = el; }} className={s.guide} />
            <line ref={(el) => { halo.current.gy = el; }} className={s.guide} />
            <circle ref={(el) => { halo.current.glow = el; }} className={s.haloGlow} />
            <circle ref={(el) => { halo.current.ring = el; }} className={s.haloRing} />
          </g>
          <g ref={(el) => { halo.current.read = el; }} style={{ opacity: 0 }}>
            <g ref={(el) => { halo.current.rx = el; }} className={s.readout}>
              <rect x={-30} y={4} width={60} height={17} rx={3} />
              <text y={16.5} textAnchor="middle">{active ? `${fmt.int.format(active.altitude)} m` : ''}</text>
            </g>
            <g ref={(el) => { halo.current.ry = el; }} className={s.readout}>
              <rect x={-44} y={-8.5} width={40} height={17} rx={3} />
              <text x={-24} y={4} textAnchor="middle">{active ? fmt.score(active.score) : ''}</text>
            </g>
          </g>
        </svg>
      )}
      {ready && (
        <div ref={(el) => { halo.current.tip = el; }} className={s.tip} data-side={tipSide} style={{ opacity: 0 }} aria-hidden="true">
          {active ? <div><strong>{active.id}{active.id === pinned ? ' · pinned' : ''}</strong><span>{describe(active)}</span></div> : null}
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
        data-drawing={drawing || undefined}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
        onPointerLeave={() => { if (!drag.current) setHover(null); }} onPointerCancel={onCancel}
        // Only keyboard focus starts the cursor; a mouse click focuses the plot too, and must leave the hovered mark in charge.
        onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) setCursor((c) => c ?? Math.max(0, order.findIndex((l) => l.id === pinned))); }}
        onBlur={() => setCursor(null)}
        onKeyDown={onKey}
      />
    </div>
  );
}
