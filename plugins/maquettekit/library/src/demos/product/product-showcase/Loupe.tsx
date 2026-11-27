'use client';
/**
 * Loupe — the photo view's hands-on control. A jeweller's lens that rests in the corner of the stage: drag it over
 * the speaker to see the render at 2×, throw it and it keeps its velocity, then settles on the nearest numbered
 * detail (magnetic within a small radius) or wherever it was let go. Pressing it steps through the details, the
 * arrow keys nudge it and Escape puts it back, so the same inspection works without a pointer.
 * Physics: one spring per axis plus the open/closed scale, integrated on a useRafLoop that sleeps at rest.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { spring as SPRING, stepSpring, useElementSize, useRafLoop } from '../../../motion';
import { DETAILS } from './data';
import { atRest, axis, clamp, smoothstep } from './physics';
import styles from './styles.module.css';

/** Magnification of the lens. The render is 1024 px, so 2× at the stage's size stays close to native resolution. */
const ZOOM = 2;
/** Resting place, in the poster box (0–1): bottom-right, over empty paper. */
const DOCK = { u: 0.9, v: 0.9 } as const;
/** Within this distance (poster-box units) a released lens settles on a detail; the pull starts at twice that. */
const SNAP = 0.12;
const SCALE_DOCKED = 0.4;
/** How far a throw carries (s): the release point is projected along the velocity before choosing where to land. */
const PROJECT = 0.18;

type Mode = 'dock' | 'free' | 'detail';

export function Loupe({ src, active, onActive, onEngage, reduced }: {
  src: string;
  active: string | null;
  onActive: (id: string | null) => void;
  /** True while the lens is held: the stage flattens its tilt so the lens sits exactly on what it magnifies. */
  onEngage: (held: boolean) => void;
  reduced: boolean;
}) {
  const hintId = useId();
  const layer = useRef<HTMLDivElement>(null);
  const lens = useRef<HTMLButtonElement>(null);
  const glass = useRef<HTMLSpanElement>(null);
  const size = useElementSize(layer);
  const sim = useRef({ u: axis(DOCK.u), v: axis(DOCK.v), s: axis(SCALE_DOCKED), tu: DOCK.u as number, tv: DOCK.v as number, ts: SCALE_DOCKED as number });
  const drag = useRef<{ id: number; du: number; dv: number; x0: number; y0: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const mode = useRef<Mode>('dock');
  const [open, setOpen] = useState(false);
  const [near, setNear] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);

  const write = () => {
    const el = lens.current, g = glass.current;
    const { u, v, s } = sim.current;
    if (!el || !g || size.width < 1) return;
    const L = el.offsetWidth;
    el.style.transform = `translate3d(${(u.x * size.width).toFixed(2)}px, ${(v.x * size.height).toFixed(2)}px, 0) translate(-50%, -50%) scale(${s.x.toFixed(4)})`;
    el.style.setProperty('--open', clamp((s.x - SCALE_DOCKED) / (1 - SCALE_DOCKED), 0, 1).toFixed(3));
    g.style.backgroundSize = `${(size.width * ZOOM).toFixed(1)}px ${(size.height * ZOOM).toFixed(1)}px`;
    g.style.backgroundPosition = `${(L / 2 - u.x * size.width * ZOOM).toFixed(1)}px ${(L / 2 - v.x * size.height * ZOOM).toFixed(1)}px`;
  };

  const wake = () => {
    if (reduced) {
      const st = sim.current;
      st.u = axis(st.tu); st.v = axis(st.tv); st.s = axis(st.ts);
      write();
      return;
    }
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
  };

  const aim = (u: number, v: number, s: number) => {
    const st = sim.current;
    st.tu = clamp(u, 0.06, 0.94); st.tv = clamp(v, 0.06, 0.94); st.ts = s;
    wake();
  };

  const toDock = () => {
    mode.current = 'dock';
    setOpen(false);
    setNear(null);
    aim(DOCK.u, DOCK.v, SCALE_DOCKED);
  };
  const toDetail = (id: string) => {
    const d = DETAILS.find((x) => x.id === id);
    if (!d) return;
    mode.current = 'detail';
    setOpen(true);
    setNear(id);
    aim(d.at.x / 100, d.at.y / 100, 1);
  };

  // Keep the lens where it is when the stage resizes.
  useEffect(() => { write(); }); // eslint-disable-line react-hooks/exhaustive-deps

  // The markers are the twin: choosing one flies the lens to it; closing the detail elsewhere docks it.
  useEffect(() => {
    if (drag.current) return;
    if (active) { if (!(mode.current === 'detail' && near === active)) toDetail(active); }
    else if (mode.current === 'detail') toDock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useRafLoop(layer, (dt) => {
    const st = sim.current;
    const held = !!drag.current;
    const move = held ? SPRING.settle : SPRING.release;
    stepSpring(st.u, st.tu, move, dt);
    stepSpring(st.v, st.tv, move, dt);
    stepSpring(st.s, st.ts, SPRING.pop, dt);
    write();
    if (!held && atRest(st.u, st.tu, 0.0005) && atRest(st.v, st.tv, 0.0005) && atRest(st.s, st.ts, 0.002)) {
      st.u = axis(st.tu); st.v = axis(st.tv); st.s = axis(st.ts);
      write();
      runningRef.current = false;
      setRunning(false);
    }
  }, running && !reduced);

  const nearest = (u: number, v: number) => {
    let best: { id: string; d: number; u: number; v: number } | null = null;
    for (const d of DETAILS) {
      const du = d.at.x / 100 - u, dv = d.at.y / 100 - v, dist = Math.hypot(du, dv);
      if (!best || dist < best.d) best = { id: d.id, d: dist, u: d.at.x / 100, v: d.at.y / 100 };
    }
    return best;
  };

  const local = (e: PointerEvent) => {
    const r = layer.current?.getBoundingClientRect();
    if (!r || r.width < 1) return { u: 0.5, v: 0.5 };
    return { u: (e.clientX - r.left) / r.width, v: (e.clientY - r.top) / r.height };
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = local(e);
    const st = sim.current;
    // Grabbing an open lens keeps the grab offset; a docked one jumps under the pointer as it opens.
    const docked = mode.current === 'dock';
    drag.current = { id: e.pointerId, du: docked ? 0 : st.u.x - p.u, dv: docked ? 0 : st.v.x - p.v, x0: e.clientX, y0: e.clientY, moved: false };
    onEngage(true);
  };

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const g = drag.current;
    if (!g || g.id !== e.pointerId) return;
    if (!g.moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 4) return;
    if (!g.moved) { g.moved = true; mode.current = 'free'; setOpen(true); }
    const p = local(e);
    let u = p.u + g.du, v = p.v + g.dv;
    // Magnetic pull toward the closest detail as the lens approaches it.
    const n = nearest(u, v);
    if (n && n.d < SNAP * 2) {
      const w = smoothstep(1 - n.d / (SNAP * 2)) * 0.35;
      u += (n.u - u) * w; v += (n.v - v) * w;
    }
    setNear(n && n.d < SNAP ? n.id : null);
    aim(u, v, 1);
  };

  const release = (e: PointerEvent<HTMLButtonElement>) => {
    const g = drag.current;
    if (!g || g.id !== e.pointerId) return;
    drag.current = null;
    onEngage(false);
    if (!g.moved) return; // a press: the click handler steps through the details
    suppressClick.current = true;
    const st = sim.current;
    const pu = st.u.x + st.u.v * PROJECT, pv = st.v.x + st.v.v * PROJECT;
    const n = nearest(pu, pv);
    if (Math.hypot(pu - DOCK.u, pv - DOCK.v) < 0.1) { toDock(); onActive(null); return; }
    if (n && n.d < SNAP) { toDetail(n.id); onActive(n.id); return; }
    mode.current = 'free';
    setNear(null);
    onActive(null);
    aim(pu, pv, 1);
  };

  /** Press (click, Enter, Space): docked → detail 1 → 2 → 3 → docked. */
  const onClick = () => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    const i = mode.current === 'detail' ? DETAILS.findIndex((d) => d.id === near) : -1;
    const next = DETAILS[i + 1];
    if (mode.current === 'dock' || next) { const id = (mode.current === 'dock' ? DETAILS[0] : next).id; toDetail(id); onActive(id); }
    else { toDock(); onActive(null); }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? 0.1 : 0.03;
    const st = sim.current;
    const d = e.key === 'ArrowLeft' ? [-step, 0] : e.key === 'ArrowRight' ? [step, 0] : e.key === 'ArrowUp' ? [0, -step] : e.key === 'ArrowDown' ? [0, step] : null;
    if (e.key === 'Escape' && mode.current !== 'dock') { e.preventDefault(); toDock(); onActive(null); return; }
    if (!d) return;
    e.preventDefault();
    const u = (mode.current === 'dock' ? 0.5 : st.tu) + d[0], v = (mode.current === 'dock' ? 0.55 : st.tv) + d[1];
    const n = nearest(u, v);
    mode.current = 'free';
    setOpen(true);
    if (n && n.d < SNAP * 0.5) { setNear(n.id); onActive(n.id); mode.current = 'detail'; }
    else { setNear(null); if (active) onActive(null); }
    aim(u, v, 1);
  };

  const at = DETAILS.find((d) => d.id === near) ?? null;
  const n = at ? DETAILS.indexOf(at) + 1 : null;
  return (
    <div ref={layer} className={styles.loupeLayer}>
      <button
        ref={lens}
        type="button"
        className={styles.lens}
        data-open={open || undefined}
        data-moving={running || undefined}
        aria-label={open ? `Loupe, ${ZOOM}× ${at ? `on detail ${n}: ${at.label}` : 'over the photo'}` : `Loupe, ${ZOOM}× magnifier`}
        aria-describedby={hintId}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        <span ref={glass} className={styles.glass} aria-hidden="true" style={{ backgroundImage: `url(${src})` }} />
        <span className={styles.glint} aria-hidden="true" />
        <svg className={styles.lensIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></svg>
        {n ? <span className={styles.lensBadge} aria-hidden="true">{n}</span> : null}
      </button>
      <span id={hintId} className={styles.srOnly}>Drag it over the speaker to look closer; it settles on the nearest numbered detail. Press it to step through the details, use the arrow keys to move it, Escape to put it back.</span>
    </div>
  );
}
