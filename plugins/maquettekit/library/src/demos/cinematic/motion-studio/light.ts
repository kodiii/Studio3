'use client';
/**
 * One lamp for the whole page. At rest it hangs at the upper left, 38° above the page: the same resting light the
 * liquid-glass lens uses, so DOM shadows and the WebGL glass agree. On fine pointers the visitor carries it: every
 * element marked `data-lit` gets `--lx` / `--ly` (the light's direction projected on the page, pointing from the
 * element toward the lamp), high and close when the pointer is near, low and raking when it is far. CSS turns those
 * into shadows that fall away from the lamp and highlights that face it.
 *
 * One rAF loop for all elements; it reads every rect first, then writes custom properties, skips unchanged values,
 * only visits elements near the viewport and sleeps once every light has settled. Reduced motion and touch: no
 * loop, the CSS rest values apply.
 */
import { useEffect, type RefObject } from 'react';

/** Resting light, the lens recipe's: azimuth (-0.6, -0.8) at 38° elevation, projected on the page. */
export const REST_LIGHT = { x: -0.473, y: -0.63 } as const;
const DEG = Math.PI / 180;
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

interface Lamp { x: number; y: number; tx: number; ty: number; written: string }

export function usePageLight(root: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    const host = root.current;
    if (!host || !enabled || typeof window === 'undefined') return;
    const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    if (!fine) return;

    const lamps = new Map<HTMLElement, Lamp>();
    const near = new Set<HTMLElement>();
    let pointer: { x: number; y: number } | null = null;
    let raf = 0;
    let last = 0;

    const io = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((entries) => {
        for (const e of entries) {
          const el = e.target as HTMLElement;
          if (e.isIntersecting) near.add(el); else near.delete(el);
        }
        wake();
      }, { rootMargin: '160px' })
      : null;
    const collect = () => {
      const now = new Set(Array.from(host.querySelectorAll<HTMLElement>('[data-lit]')));
      for (const el of lamps.keys()) if (!now.has(el)) { lamps.delete(el); near.delete(el); io?.unobserve(el); }
      for (const el of now) if (!lamps.has(el)) {
        lamps.set(el, { x: REST_LIGHT.x, y: REST_LIGHT.y, tx: REST_LIGHT.x, ty: REST_LIGHT.y, written: '' });
        if (io) io.observe(el); else near.add(el);
      }
    };
    collect();
    // Sections mount lazily (the reel, the rating): pick up new lit elements as they arrive (debounced).
    let pending = 0;
    const mo = new MutationObserver(() => { window.clearTimeout(pending); pending = window.setTimeout(collect, 120); });
    mo.observe(host, { childList: true, subtree: true });

    const tick = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
      last = now;
      // Read pass: every target from the rects, before any write.
      const visible = Array.from(near);
      const rects = visible.map((el) => el.getBoundingClientRect());
      visible.forEach((el, i) => {
        const L = lamps.get(el);
        if (!L) return;
        if (!pointer) { L.tx = REST_LIGHT.x; L.ty = REST_LIGHT.y; return; }
        const r = rects[i];
        const dx = pointer.x - (r.left + r.width / 2), dy = pointer.y - (r.top + r.height / 2);
        const dist = Math.hypot(dx, dy);
        const size = Math.max(r.width, r.height);
        if (dist < 1) return;
        const el2 = (60 - 32 * smooth(size * 0.25, size * 1.6 + 500, dist)) * DEG;
        L.tx = (dx / dist) * Math.cos(el2);
        L.ty = (dy / dist) * Math.cos(el2);
      });
      // Write pass: ease toward the targets (a lamp has some weight), skip values that did not change.
      const k = 1 - Math.exp(-dt * 7);
      let busy = false;
      for (const el of visible) {
        const L = lamps.get(el);
        if (!L) continue;
        L.x += (L.tx - L.x) * k;
        L.y += (L.ty - L.y) * k;
        if (Math.abs(L.tx - L.x) > 0.002 || Math.abs(L.ty - L.y) > 0.002) busy = true;
        else { L.x = L.tx; L.y = L.ty; }
        const key = `${L.x.toFixed(3)} ${L.y.toFixed(3)}`;
        if (key !== L.written) {
          L.written = key;
          el.style.setProperty('--lx', L.x.toFixed(3));
          el.style.setProperty('--ly', L.y.toFixed(3));
        }
      }
      if (busy) raf = requestAnimationFrame(tick);
      else last = 0;
    };
    function wake() { if (!raf && !document.hidden) raf = requestAnimationFrame(tick); }

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      pointer = { x: e.clientX, y: e.clientY };
      wake();
    };
    const onOut = (e: PointerEvent) => { if (!e.relatedTarget) { pointer = null; wake(); } };
    const onScroll = () => { if (pointer) wake(); };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerout', onOut, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(pending);
      io?.disconnect();
      mo.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerout', onOut);
      window.removeEventListener('scroll', onScroll, { capture: true });
      for (const el of lamps.keys()) { el.style.removeProperty('--lx'); el.style.removeProperty('--ly'); }
    };
  }, [root, enabled]);
}
