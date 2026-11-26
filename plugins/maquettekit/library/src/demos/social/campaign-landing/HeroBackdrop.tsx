'use client';
/**
 * The denim the patch is sewn onto: two soft indigo fields that sit at different depths (pointer parallax, ≤ 14 px),
 * a work-lamp highlight that follows the pointer across the cloth, and a film-grain tile over everything (the
 * grain-gradient-mesh technique: one 128 px tile generated once with canvas2d, blended with overlay). Nothing moves on
 * its own: the layers ease towards the pointer and stop when it does.
 * Reduced motion: no parallax and no travelling light — the lamp stays where the page's light comes from (top left).
 */
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { useRafLoop, useStudioMotion } from '../../../motion';
import styles from './styles.module.css';

let cached: string | null = null;
function grainTile(size = 128): string {
  if (cached !== null) return cached;
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) { cached = ''; return cached; }
  const img = ctx.createImageData(size, size);
  let a = 0x5eed >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = 0; i < img.data.length; i += 4) {
    // Sum of three uniforms ≈ Gaussian around mid-grey: overlay leaves the colour, adds the grain.
    const v = 128 + (rnd() + rnd() + rnd() - 1.5) * 70;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v < 0 ? 0 : v > 255 ? 255 : v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  cached = canvas.toDataURL('image/png');
  return cached;
}

export function HeroBackdrop({ hero }: { hero: RefObject<HTMLElement | null> }) {
  const { reduced } = useStudioMotion();
  const layer = useRef<HTMLDivElement>(null);
  const [grain, setGrain] = useState('');
  const [active, setActive] = useState(false);
  const want = useRef({ x: 0.28, y: 0.22 });
  const now = useRef({ x: 0.28, y: 0.22 });
  useEffect(() => { setGrain(grainTile()); }, []);

  useEffect(() => {
    const el = hero.current;
    if (!el || reduced) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      want.current = { x: (e.clientX - r.left) / Math.max(1, r.width), y: (e.clientY - r.top) / Math.max(1, r.height) };
      setActive(true);
    };
    const onLeave = () => { want.current = { x: 0.28, y: 0.22 }; setActive(true); };
    el.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerleave', onLeave);
    return () => { el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerleave', onLeave); };
  }, [hero, reduced]);

  // Ease towards the pointer (critically damped feel), write two CSS variables, sleep once there.
  useRafLoop(layer, (dt) => {
    const k = 1 - Math.exp(-dt * 7);
    const n = now.current, w = want.current;
    n.x += (w.x - n.x) * k;
    n.y += (w.y - n.y) * k;
    const el = layer.current;
    if (el) {
      el.style.setProperty('--lx', `${(n.x * 100).toFixed(2)}%`);
      el.style.setProperty('--ly', `${(n.y * 100).toFixed(2)}%`);
      el.style.setProperty('--px', (n.x * 2 - 1).toFixed(3));
      el.style.setProperty('--py', (n.y * 2 - 1).toFixed(3));
    }
    if (Math.abs(w.x - n.x) < 0.001 && Math.abs(w.y - n.y) < 0.001) setActive(false);
  }, active && !reduced);

  return (
    <div ref={layer} className={styles.heroBackdrop} aria-hidden="true" style={{ '--hb-grain': grain ? `url(${grain})` : 'none' } as CSSProperties}>
      <span className={`${styles.heroField} ${styles.heroFieldA}`} />
      <span className={`${styles.heroField} ${styles.heroFieldB}`} />
      <span className={styles.heroLamp} />
      <span className={styles.heroGrain} />
    </div>
  );
}
