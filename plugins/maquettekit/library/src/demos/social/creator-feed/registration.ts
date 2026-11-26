'use client';
/**
 * The feed's signature: a registration field. Every coral plate (Prints.tsx, and the profile name's coral copy)
 * registers here. One rAF loop turns how fast the pointer and the page are moving into a misregistration of
 * 1–4 px — the coral plate lags behind the motion like paper slipping on the drum — and each plate follows that
 * target on a spring. The sheet under the pointer (hovered, pressed or holding focus) snaps into exact register on
 * the quick `press` spring. When nothing moves the plates settle to a hair (0.75 px) out, the riso look at rest,
 * and the loop goes to sleep.
 *
 * Transform only (compositor), one style write per plate per frame, no React renders while it runs.
 * Reduced motion: the loop never starts and every plate sits exactly in register.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type RefObject } from 'react';
import { spring, useRafLoop, useStudioMotion, type SpringConfig } from '../../../motion';

export type Register = (el: HTMLElement | SVGElement) => () => void;
export const RegistrationContext = createContext<Register | null>(null);

/** Join the field: the element becomes a coral plate that drifts and snaps back into register. */
export function usePlate(ref: RefObject<HTMLElement | SVGElement | null>): void {
  const register = useContext(RegistrationContext);
  useEffect(() => {
    const el = ref.current;
    if (!el || !register) return;
    return register(el);
  }, [register, ref]);
}

interface Plate { el: HTMLElement | SVGElement; sheet: Element | null; x: number; y: number; vx: number; vy: number }

const REST = 0.75; // px out of register when still
const MIN = 1; // px as soon as something moves
const MAX = 4; // px at a fast flick or scroll
const DEAD = 40; // px/s of motion that still counts as still
const FULL = 1400; // px/s that reaches MAX

const step = (p: Plate, gx: number, gy: number, s: SpringConfig, dt: number) => {
  // Semi-implicit Euler in small sub-steps: stable for the stiff `press` spring at any frame rate.
  const n = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    p.vx += ((-s.stiffness * (p.x - gx) - s.damping * p.vx) / s.mass) * h;
    p.vy += ((-s.stiffness * (p.y - gy) - s.damping * p.vy) / s.mass) * h;
    p.x += p.vx * h;
    p.y += p.vy * h;
  }
};

export function useRegistrationField(root: RefObject<HTMLElement | null>): Register {
  const { reduced } = useStudioMotion();
  const plates = useRef(new Set<Plate>());
  const engaged = useRef<{ hover: Element | null; press: Element | null; focus: Element | null }>({ hover: null, press: null, focus: null });
  const m = useRef({ px: 0, py: 0, pt: 0, vx: 0, vy: 0, sy: 0, st: 0, svy: 0, dx: 0.8, dy: 0.6 });
  const awakeRef = useRef(false);
  const [awake, setAwake] = useState(false);
  const wake = useCallback(() => {
    if (awakeRef.current) return;
    awakeRef.current = true;
    setAwake(true);
  }, []);

  const register = useCallback<Register>((el) => {
    const p: Plate = { el, sheet: el.closest('[data-sheet]'), x: 0, y: 0, vx: 0, vy: 0 };
    plates.current.add(p);
    el.style.transform = '';
    wake();
    return () => { plates.current.delete(p); el.style.transform = ''; };
  }, [wake]);

  // Inputs: pointer speed anywhere on the page, scroll speed of the page, and which sheet is being handled.
  useEffect(() => {
    const el = root.current;
    if (!el || reduced) return;
    const s = m.current;
    const onMove = (e: PointerEvent) => {
      const t = e.timeStamp;
      const dt = (t - s.pt) / 1000;
      if (s.pt && dt > 0.004 && dt < 0.2) {
        const k = 0.35;
        s.vx += (((e.clientX - s.px) / dt) - s.vx) * k;
        s.vy += (((e.clientY - s.py) / dt) - s.vy) * k;
      }
      s.px = e.clientX; s.py = e.clientY; s.pt = t;
      wake();
    };
    const onScroll = () => {
      const t = performance.now();
      const y = window.scrollY;
      const dt = (t - s.st) / 1000;
      if (s.st && dt > 0.004 && dt < 0.2) s.svy += (((y - s.sy) / dt) - s.svy) * 0.4;
      s.sy = y; s.st = t;
      wake();
    };
    const sheetOf = (t: EventTarget | null) => (t instanceof Element ? t.closest('[data-sheet]') : null);
    const onOver = (e: PointerEvent) => { if (e.pointerType === 'mouse') { engaged.current.hover = sheetOf(e.target); wake(); } };
    const onLeave = () => { engaged.current.hover = null; wake(); };
    const onDown = (e: PointerEvent) => { engaged.current.press = sheetOf(e.target); wake(); };
    const onUp = () => { if (engaged.current.press) { engaged.current.press = null; wake(); } };
    const onFocusIn = (e: FocusEvent) => { engaged.current.focus = sheetOf(e.target); wake(); };
    const onFocusOut = (e: FocusEvent) => { if (!el.contains(e.relatedTarget as Node | null)) { engaged.current.focus = null; wake(); } };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('pointerover', onOver);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    el.addEventListener('focusin', onFocusIn);
    el.addEventListener('focusout', onFocusOut);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
      el.removeEventListener('pointerover', onOver);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      el.removeEventListener('focusin', onFocusIn);
      el.removeEventListener('focusout', onFocusOut);
    };
  }, [root, reduced, wake]);

  // Reduced motion: everything in register, nothing running.
  useEffect(() => {
    if (!reduced) return;
    for (const p of plates.current) { p.x = p.y = p.vx = p.vy = 0; p.el.style.transform = ''; }
    awakeRef.current = false;
    setAwake(false);
  }, [reduced]);

  useRafLoop(root, (dt) => {
    const s = m.current;
    // Speeds fade on their own once input stops (≈ 200 ms), so the drift relaxes without new events.
    s.vx *= Math.exp(-dt * 6);
    s.vy *= Math.exp(-dt * 6);
    s.svy *= Math.exp(-dt * 5);
    const vx = s.vx, vy = s.vy + s.svy * 0.8;
    const speed = Math.hypot(vx, vy);
    if (speed > DEAD) { s.dx = -vx / speed; s.dy = -vy / speed; }
    const mag = speed <= DEAD ? REST : Math.min(MAX, MIN + ((speed - DEAD) / (FULL - DEAD)) * (MAX - MIN));
    const tx = s.dx * mag, ty = s.dy * mag;
    const { hover, press, focus } = engaged.current;
    let busy = speed > DEAD * 0.25;
    for (const p of plates.current) {
      const on = !!p.sheet && (p.sheet === hover || p.sheet === press || p.sheet === focus);
      const gx = on ? 0 : tx, gy = on ? 0 : ty;
      step(p, gx, gy, on ? spring.press : spring.settle, dt);
      if (Math.abs(p.x - gx) > 0.02 || Math.abs(p.y - gy) > 0.02 || Math.abs(p.vx) > 0.05 || Math.abs(p.vy) > 0.05) busy = true;
      p.el.style.transform = `translate3d(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px, 0)`;
    }
    if (!busy) { awakeRef.current = false; setAwake(false); }
  }, awake && !reduced);

  return register;
}
