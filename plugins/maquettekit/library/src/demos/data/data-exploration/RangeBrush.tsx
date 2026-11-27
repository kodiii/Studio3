'use client';
/**
 * One-dimensional brush over a chart. Technique from the brush-linked-range recipe (effects/brush-linked-range): the
 * window and both edges are real role="slider" controls (arrows step, Shift steps big, Home/End jump), pointer
 * capture drives drags, and dragging across empty chart draws a new range. Here it is generic (any domain, any
 * background chart as a render function, `null` = no filter) and physical:
 *  - while held, the drawing follows the hand 1:1 and rubber-bands past the ends of the axis;
 *  - on release it keeps the hand's velocity: a flicked window glides with friction (the selection follows it),
 *    bounces off an end of the axis, then lands on the snapped value on the `spring.release` token;
 *  - keyboard steps (`spring.press`) and changes made elsewhere — the scatter brush, Reset, the URL (`spring.settle`) —
 *    spring the drawing to the new value, retargeting from wherever it is.
 * The selection is always the snapped, clamped value; only the drawing springs. Reduced motion: no glide, no band,
 * no spring — the window is drawn exactly at the value.
 */
import { useEffect, useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { scaleLinear, type ScaleLinear } from 'd3';
import { spring as SPRING, useElementSize, useIsomorphicLayoutEffect, useStudioMotion, type SpringConfig } from '../../../motion';
import { createLoop, createVelocity, rubber, stepSpringPair } from './physics';
import s from './styles.module.css';

type Part = 'start' | 'end' | 'window';
type Range = [number, number];
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

/** Friction on a thrown window, per second: its speed halves roughly every 0.17 s. */
const FRICTION = 4;
/** A release faster than this share of the axis per second is a throw; slower is a placement. */
const FLING = 0.12;
/** How far past an end the band can stretch, as a share of the axis. */
const BAND = 0.07;

export function RangeBrush({ domain, step, big, value, onChange, label, format, margin, height, describedBy, inset = 0, children }: Props) {
  const { reduced } = useStudioMotion();
  const ref = useRef<HTMLDivElement>(null);
  const winRef = useRef<HTMLDivElement>(null);
  const handleRefs = useRef<(HTMLDivElement | null)[]>([null, null]);
  const shadeRefs = useRef<(HTMLDivElement | null)[]>([null, null]);
  const { width } = useElementSize(ref);
  const [lo, hi] = domain;
  const span = hi - lo;
  const v: Range = value ? [value[0], value[1]] : [lo, hi];
  const x = scaleLinear().domain([lo, hi]).range([margin.left, Math.max(margin.left + 1, width - margin.right)]);
  const minSpan = step;

  const snap = (n: number) => Math.round(n / step) * step;
  const clampV = (n: number) => Math.min(hi, Math.max(lo, n));
  const clampWin = (a: number, w: number) => Math.min(hi - w, Math.max(lo, a));

  // Live values for handlers and the animation loop (they outlive a render).
  const live = useRef({ x, reduced, onChange, v });
  live.current = { x, reduced, onChange, v };
  /** What is drawn: edges in domain units and their velocities (units/s). */
  const vis = useRef({ a: v[0], b: v[1], va: 0, vb: 0 });
  const goal = useRef<Range>(v);
  const phase = useRef<'rest' | 'drag' | 'glide' | 'spring'>('rest');
  const cfg = useRef<SpringConfig>(SPRING.settle);
  const keyed = useRef(false);
  const lastEmit = useRef<Range | null>(value ? v : null);
  const drag = useRef<{ part: Part | 'new'; px: number; base: Range; moved: boolean; origin: number } | null>(null);
  const vel = useRef(createVelocity());

  const emit = (r: Range | null) => {
    const next = r && (r[0] > lo || r[1] < hi) ? r : null;
    const prev = lastEmit.current;
    if (next === prev || (next && prev && next[0] === prev[0] && next[1] === prev[1])) return;
    lastEmit.current = next;
    live.current.onChange(next);
  };

  const paint = () => {
    const sc = live.current.x;
    const { a, b } = vis.current;
    const [r0, r1] = sc.range();
    const L = sc(a), R = sc(b);
    const w = winRef.current;
    if (w) { w.style.left = `${L.toFixed(2)}px`; w.style.width = `${Math.max(0, R - L).toFixed(2)}px`; }
    const [h0, h1] = handleRefs.current;
    if (h0) h0.style.left = `${L.toFixed(2)}px`;
    if (h1) h1.style.left = `${R.toFixed(2)}px`;
    const [s0, s1] = shadeRefs.current;
    if (s0) { s0.style.left = `${r0}px`; s0.style.width = `${Math.max(0, Math.min(L, r1) - r0).toFixed(2)}px`; }
    if (s1) { const from = Math.max(R, r0); s1.style.left = `${from.toFixed(2)}px`; s1.style.width = `${Math.max(0, r1 - from).toFixed(2)}px`; }
  };

  const tick = (dt: number): boolean => {
    const st = vis.current;
    if (phase.current === 'glide') {
      const w = st.b - st.a;
      const a = st.a + st.va * dt;
      const va = st.va * Math.exp(-FRICTION * dt);
      st.a = a; st.b = a + w; st.va = st.vb = va;
      if (a < lo || a + w > hi) {
        // Hit an end: a spring lands it on the limit, carrying the remaining speed (the band stretches, then returns).
        const g = clampWin(a, w);
        goal.current = [g, g + w];
        cfg.current = SPRING.release;
        phase.current = 'spring';
        emit(goal.current);
      } else {
        const g = clampWin(snap(a), w);
        emit([g, g + w]);
        if (Math.abs(va) < span * FLING * 0.3) {
          goal.current = [g, g + w];
          cfg.current = SPRING.release;
          phase.current = 'spring';
        }
      }
      paint();
      return true;
    }
    if (phase.current === 'spring') {
      const [g0, g1] = goal.current;
      [st.a, st.va] = stepSpringPair(st.a, st.va, g0, cfg.current, dt);
      [st.b, st.vb] = stepSpringPair(st.b, st.vb, g1, cfg.current, dt);
      const eps = span * 1e-4, epsV = span * 1e-3;
      const done = Math.abs(st.a - g0) < eps && Math.abs(st.b - g1) < eps && Math.abs(st.va) < epsV && Math.abs(st.vb) < epsV;
      if (done) { st.a = g0; st.b = g1; st.va = 0; st.vb = 0; phase.current = 'rest'; }
      paint();
      return !done;
    }
    return false;
  };
  const tickRef = useRef(tick);
  tickRef.current = tick;
  const loop = useRef<ReturnType<typeof createLoop> | null>(null);
  if (!loop.current) loop.current = createLoop((dt) => tickRef.current(dt));
  useEffect(() => () => loop.current?.stop(), []);

  const settleAt = (target: Range, c: SpringConfig) => {
    goal.current = target;
    const st = vis.current;
    if (live.current.reduced || width <= 0) {
      loop.current?.stop();
      st.a = target[0]; st.b = target[1]; st.va = 0; st.vb = 0;
      phase.current = 'rest';
      paint();
      return;
    }
    cfg.current = c;
    phase.current = 'spring';
    loop.current?.start();
  };

  // The value changed outside the hand (keys, presets, the scatter brush, Reset, URL): spring the drawing to it.
  const v0 = v[0], v1 = v[1];
  useIsomorphicLayoutEffect(() => {
    lastEmit.current = value ? [v0, v1] : null;
    if (phase.current === 'drag' || phase.current === 'glide') return;
    const [g0, g1] = goal.current;
    if (g0 === v0 && g1 === v1 && phase.current === 'spring') return;
    const c = keyed.current ? SPRING.press : SPRING.settle;
    keyed.current = false;
    const st = vis.current;
    if (st.a === v0 && st.b === v1) { goal.current = [v0, v1]; return; }
    settleAt([v0, v1], c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v0, v1, reduced]);
  // Keep the drawing in step with layout (width, margins) after every render.
  useIsomorphicLayoutEffect(() => { paint(); });

  const valueAt = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return live.current.x.invert(clientX - r.left);
  };

  const down = (part: Part | 'new') => (ev: PointerEvent<HTMLDivElement>) => {
    if (ev.button !== 0 || width <= 0) return;
    ev.stopPropagation();
    ev.currentTarget.setPointerCapture(ev.pointerId);
    // Catch whatever is moving: a thrown window stops where it is, under the hand.
    loop.current?.stop();
    const st = vis.current;
    st.va = 0; st.vb = 0;
    phase.current = 'drag';
    drag.current = { part, px: ev.clientX, base: [st.a, st.b], moved: false, origin: clampV(valueAt(ev.clientX)) };
    vel.current.reset();
    vel.current.push(part === 'end' ? st.b : part === 'new' ? drag.current.origin : st.a);
    if (ref.current) ref.current.dataset.grab = part;
  };

  const move = (ev: PointerEvent<HTMLDivElement>) => {
    const g = drag.current;
    if (!g) return;
    if (!g.moved && Math.abs(ev.clientX - g.px) < 3) return;
    g.moved = true;
    const st = vis.current;
    const banded = !live.current.reduced;
    const reach = span * BAND;
    const sc = live.current.x;
    const per = span / Math.max(1, sc.range()[1] - sc.range()[0]);
    const d = (ev.clientX - g.px) * per;
    if (g.part === 'new') {
      const cur = valueAt(ev.clientX);
      vel.current.push(cur);
      const c = clampV(cur);
      st.a = Math.min(g.origin, c); st.b = Math.max(g.origin, c);
      const a = snap(st.a), b = snap(st.b);
      if (b - a >= step) emit([clampV(a), clampV(b)]);
    } else if (g.part === 'window') {
      const w = g.base[1] - g.base[0];
      const raw = g.base[0] + d;
      vel.current.push(raw);
      let a = raw;
      if (a < lo) a = banded ? lo + rubber(a - lo, reach) : lo;
      else if (a + w > hi) a = banded ? hi - w + rubber(a + w - hi, reach) : hi - w;
      st.a = a; st.b = a + w;
      const ga = clampWin(snap(raw), w);
      emit([ga, ga + w]);
    } else if (g.part === 'start') {
      const other = snap(g.base[1]);
      const raw = g.base[0] + d;
      vel.current.push(raw);
      let a = Math.min(raw, g.base[1] - minSpan);
      if (a < lo) a = banded ? lo + rubber(a - lo, reach) : lo;
      st.a = a; st.b = g.base[1];
      emit([Math.min(other - minSpan, clampV(snap(raw))), other]);
    } else {
      const other = snap(g.base[0]);
      const raw = g.base[1] + d;
      vel.current.push(raw);
      let b = Math.max(raw, g.base[0] + minSpan);
      if (b > hi) b = banded ? hi + rubber(b - hi, reach) : hi;
      st.a = g.base[0]; st.b = b;
      emit([other, Math.max(other + minSpan, clampV(snap(raw)))]);
    }
    paint();
  };

  const release = (cancelled: boolean) => {
    const g = drag.current;
    drag.current = null;
    if (ref.current) delete ref.current.dataset.grab;
    if (!g) return;
    const st = vis.current;
    const target: Range = lastEmit.current ? [lastEmit.current[0], lastEmit.current[1]] : [lo, hi];
    if (!g.moved && g.part === 'new' && !cancelled) {
      // A click on empty chart clears the brush; the window springs back out to the whole axis.
      phase.current = 'rest';
      emit(null);
      settleAt([lo, hi], SPRING.settle);
      return;
    }
    if (live.current.reduced) { settleAt(target, SPRING.settle); return; }
    const speed = cancelled ? 0 : vel.current.get();
    if (g.part === 'window' && g.moved && Math.abs(speed) > span * FLING) {
      st.va = speed; st.vb = speed;
      phase.current = 'glide';
      loop.current?.start();
      return;
    }
    // A placement: land on the snapped value, keeping whatever speed the moving edge had.
    if (g.part === 'window') { st.va = speed; st.vb = speed; }
    else if (g.part === 'start') st.va = speed;
    else if (g.part === 'end') st.vb = speed;
    else if (st.b > g.origin) st.vb = speed; else st.va = speed;
    settleAt(target, SPRING.release);
  };

  const key = (part: Part) => (ev: KeyboardEvent<HTMLDivElement>) => {
    const cur = live.current.v;
    const d = ev.key === 'ArrowLeft' || ev.key === 'ArrowDown' ? -(ev.shiftKey ? big : step) : ev.key === 'ArrowRight' || ev.key === 'ArrowUp' ? (ev.shiftKey ? big : step)
      : ev.key === 'PageDown' ? -big : ev.key === 'PageUp' ? big : ev.key === 'Home' ? lo - hi : ev.key === 'End' ? hi - lo : 0;
    if (ev.key === 'Escape' && value) { ev.preventDefault(); keyed.current = true; onChange(null); return; }
    if (!d) return;
    ev.preventDefault();
    let next: Range;
    if (part === 'start') next = [Math.min(cur[1] - minSpan, clampV(snap(cur[0] + d))), cur[1]];
    else if (part === 'end') next = [cur[0], Math.max(cur[0] + minSpan, clampV(snap(cur[1] + d)))];
    else { const w = cur[1] - cur[0]; const a = clampWin(snap(cur[0] + d), w); next = [a, a + w]; }
    keyed.current = true;
    const r: Range = [clampV(Math.min(next[0], next[1])), clampV(Math.max(next[0], next[1]))];
    onChange(r[0] <= lo && r[1] >= hi ? null : r);
  };

  return (
    <div ref={ref} className={s.brush} style={{ height }} data-active={value ? '' : undefined}
      onPointerDown={down('new')} onPointerMove={move} onPointerUp={() => release(false)} onPointerCancel={() => release(true)}>
      {width > 0 && children ? children(x, width, height) : null}
      <div ref={(el) => { shadeRefs.current[0] = el; }} className={s.shade} style={{ bottom: inset }} aria-hidden="true" />
      <div ref={(el) => { shadeRefs.current[1] = el; }} className={s.shade} style={{ bottom: inset }} aria-hidden="true" />
      <div
        ref={winRef} className={s.window} style={{ bottom: inset }}
        role="slider" tabIndex={0} aria-label={`Move ${label} range`} aria-describedby={describedBy}
        aria-valuemin={lo} aria-valuemax={hi - (v[1] - v[0])} aria-valuenow={v[0]}
        aria-valuetext={value ? `${format(v[0])} to ${format(v[1])}` : `All ${label} values, ${format(lo)} to ${format(hi)}`}
        onPointerDown={down('window')} onKeyDown={key('window')}
      />
      {(['start', 'end'] as const).map((part, i) => (
        <div
          key={part} ref={(el) => { handleRefs.current[i] = el; }} className={s.handle} data-part={part} style={{ bottom: inset }}
          role="slider" tabIndex={0} aria-label={`${label[0].toUpperCase()}${label.slice(1)} ${part === 'start' ? 'from' : 'to'}`} aria-describedby={describedBy}
          aria-valuemin={part === 'start' ? lo : v[0] + minSpan} aria-valuemax={part === 'start' ? v[1] - minSpan : hi}
          aria-valuenow={part === 'start' ? v[0] : v[1]} aria-valuetext={format(part === 'start' ? v[0] : v[1])}
          onPointerDown={down(part)} onKeyDown={key(part)}
        ><span /></div>
      ))}
    </div>
  );
}
