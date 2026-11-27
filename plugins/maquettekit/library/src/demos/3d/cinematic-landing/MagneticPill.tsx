'use client';
/**
 * The stage's chrome button (Skip intro / Pause light), with weight:
 *  - press depth (technique adapted from press-depth-button): the face drops and its contact shadow tightens within a
 *    frame; letting go springs it back on a CSS linear() curve sampled from the `press` spring token;
 *  - magnetism on fine pointers (adapted from magnetic-button): inside a small field the body leans towards the
 *    pointer and the label leans further (depth); leaving the field hands it to the `release` spring. Off for touch
 *    and reduced motion, where the button keeps its hover, focus and pressed states.
 */
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react';
import { spring as SPRING, stepSpring, useRafLoop, useStudioMotion } from '../../../motion';
import type { Axis } from './stage';
import styles from './styles.module.css';

const FINE = '(hover: hover) and (pointer: fine)';
const subscribe = (cb: () => void) => {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const m = window.matchMedia(FINE);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};
const snapshot = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(FINE).matches;
/** Field around the pill (px) and how far body and label may travel. */
const FIELD = 56, BODY = 7, LABEL = 2.5;

export function MagneticPill({ children, onClick, pressed: ariaPressed }: { children: ReactNode; onClick: () => void; pressed?: boolean }) {
  const { reduced } = useStudioMotion();
  const fine = useSyncExternalStore(subscribe, snapshot, () => false);
  const enabled = fine && !reduced;
  const anchor = useRef<HTMLSpanElement>(null);
  const body = useRef<HTMLButtonElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const m = useRef({ bx: { x: 0, v: 0 } as Axis, by: { x: 0, v: 0 } as Axis, lx: { x: 0, v: 0 } as Axis, ly: { x: 0, v: 0 } as Axis, dx: 0, dy: 0, w: 0, near: false });
  const [active, setActive] = useState(false);
  const [down, setDown] = useState(false);

  useEffect(() => {
    if (!enabled) {
      m.current = { ...m.current, bx: { x: 0, v: 0 }, by: { x: 0, v: 0 }, lx: { x: 0, v: 0 }, ly: { x: 0, v: 0 }, near: false };
      if (body.current) body.current.style.transform = '';
      if (label.current) label.current.style.transform = '';
      setActive(false);
      return;
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const r = anchor.current?.getBoundingClientRect();
      if (!r) return;
      const s = m.current;
      s.dx = e.clientX - (r.left + r.width / 2);
      s.dy = e.clientY - (r.top + r.height / 2);
      const cap = r.height / 2;
      const edge = Math.max(0, Math.hypot(Math.max(0, Math.abs(s.dx) - (r.width / 2 - cap)), s.dy) - cap);
      const near = edge < FIELD;
      s.w = near ? 1 - Math.min(1, edge / FIELD) ** 2 : 0;
      if (near || s.near) { s.near = near; setActive(true); }
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [enabled]);

  useRafLoop(anchor, (dt) => {
    const s = m.current;
    const tx = s.near ? BODY * Math.tanh((s.dx * 0.32 * s.w) / BODY) : 0;
    const ty = s.near ? BODY * Math.tanh((s.dy * 0.32 * s.w) / BODY) : 0;
    const cfg = s.near ? SPRING.settle : SPRING.release;
    stepSpring(s.bx, tx, cfg, dt); stepSpring(s.by, ty, cfg, dt);
    stepSpring(s.lx, (tx / BODY) * LABEL, cfg, dt); stepSpring(s.ly, (ty / BODY) * LABEL, cfg, dt);
    if (body.current) body.current.style.transform = `translate3d(${s.bx.x.toFixed(2)}px, ${s.by.x.toFixed(2)}px, 0)`;
    if (label.current) label.current.style.transform = `translate3d(${s.lx.x.toFixed(2)}px, ${s.ly.x.toFixed(2)}px, 0)`;
    const still = [s.bx, s.by, s.lx, s.ly].every((a) => Math.abs(a.v) < 0.02) && Math.abs(s.bx.x - tx) < 0.02 && Math.abs(s.by.x - ty) < 0.02;
    if (still && !s.near) setActive(false);
  }, active && enabled);

  const press = () => setDown(true);
  const lift = () => setDown(false);
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) press(); };
  const onKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => { if (e.key === ' ' || e.key === 'Enter') lift(); };

  return (
    <span ref={anchor} className={styles.pillAnchor}>
      <button
        ref={body} type="button" className={styles.pill} data-pressed={down || undefined} aria-pressed={ariaPressed}
        onPointerDown={(e) => { if (e.button === 0) press(); }} onPointerUp={lift} onPointerLeave={lift} onPointerCancel={lift}
        onKeyDown={onKeyDown} onKeyUp={onKeyUp} onBlur={lift} onClick={onClick}
      >
        <span className={styles.pillFace}><span ref={label} className={styles.pillLabel}>{children}</span></span>
      </button>
    </span>
  );
}
