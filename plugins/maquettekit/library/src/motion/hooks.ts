'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

export const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** True once the element intersects the viewport (or always, when `once` is false, while intersecting). */
export function useInView<T extends Element>(ref: RefObject<T | null>, opts: { once?: boolean; margin?: string; amount?: number } = {}): boolean {
  const [inView, setInView] = useState(false);
  const { once = true, margin = '0px', amount = 0.2 } = opts;
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); if (once) io.disconnect(); }
      else if (!once) setInView(false);
    }, { rootMargin: margin, threshold: amount });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, once, margin, amount]);
  return inView;
}

/**
 * Scroll progress (0..1) of `target` through its scroll container, delivered
 * via callback inside rAF (no React re-render per frame). Progress 0 = target
 * top reaches container bottom, 1 = target bottom reaches container top;
 * with `mode: 'contain'` it maps the pinned travel of a tall section instead.
 */
export function useScrollProgress<T extends HTMLElement>(
  target: RefObject<T | null>,
  onProgress: (p: number) => void,
  opts: { container?: RefObject<HTMLElement | null>; mode?: 'through' | 'contain'; enabled?: boolean } = {},
): void {
  const cb = useRef(onProgress);
  cb.current = onProgress;
  const { container, mode = 'through', enabled = true } = opts;
  useEffect(() => {
    const el = target.current;
    if (!el || !enabled) return;
    const scroller: HTMLElement | Window = container?.current ?? findScroller(el);
    let raf = 0;
    let last = -1;
    const measure = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = scroller instanceof Window ? window.innerHeight : scroller.clientHeight;
      const top = scroller instanceof Window ? r.top : r.top - scroller.getBoundingClientRect().top;
      const p = mode === 'contain'
        ? (r.height - vh <= 0 ? 0 : -top / (r.height - vh))
        : (vh - top) / (vh + r.height);
      const c = Math.min(1, Math.max(0, p));
      if (Math.abs(c - last) > 0.0005) { last = c; cb.current(c); }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    measure();
    return () => { scroller.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [target, container, mode, enabled]);
}

function findScroller(el: HTMLElement): HTMLElement | Window {
  let p = el.parentElement;
  while (p) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
    p = p.parentElement;
  }
  return window;
}

/**
 * requestAnimationFrame loop that pauses itself when the element is offscreen
 * or the tab is hidden, and never runs when `enabled` is false.
 * `dt` is clamped seconds; `t` is accumulated active seconds.
 */
export function useRafLoop<T extends Element>(ref: RefObject<T | null>, tick: (dt: number, t: number) => void, enabled = true): void {
  const fn = useRef(tick);
  fn.current = tick;
  useEffect(() => {
    if (!enabled) return;
    let raf = 0, prev = 0, t = 0, visible = true, running = false;
    const loop = (now: number) => {
      const dt = Math.min(0.05, prev ? (now - prev) / 1000 : 0);
      prev = now; t += dt;
      fn.current(dt, t);
      raf = requestAnimationFrame(loop);
    };
    const update = () => {
      const should = visible && !document.hidden;
      if (should && !running) { running = true; prev = 0; raf = requestAnimationFrame(loop); }
      else if (!should && running) { running = false; cancelAnimationFrame(raf); }
    };
    const el = ref.current;
    const io = el && typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; update(); }) : null;
    if (el && io) io.observe(el);
    document.addEventListener('visibilitychange', update);
    update();
    return () => { running = false; cancelAnimationFrame(raf); io?.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, [ref, enabled]);
}

/**
 * A `useRafLoop` that sleeps until woken: call the returned `wake()` when input moves a target, and the loop runs
 * `step(dt, t)` every frame until it returns true (settled), then stops itself. Built for "damp toward the input,
 * then stop once at rest" springs (`stepSpring` returns exactly that flag). Never runs while `enabled` is false.
 */
export function useSettleLoop<T extends Element>(ref: RefObject<T | null>, step: (dt: number, t: number) => boolean, enabled = true): () => void {
  const [running, setRunning] = useState(false);
  const awake = useRef(false);
  const wake = useCallback(() => { if (!awake.current) { awake.current = true; setRunning(true); } }, []);
  useRafLoop(ref, (dt, t) => { if (awake.current && step(dt, t)) { awake.current = false; setRunning(false); } }, running && enabled);
  return wake;
}

/** Element size via ResizeObserver (content box, CSS px). */
export function useElementSize<T extends Element>(ref: RefObject<T | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}
