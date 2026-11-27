'use client';
/**
 * The hero's product window as a lit object: it leans toward the pointer (≤ 2.6°, the tilt-parallax-card technique
 * with one token spring per channel), a highlight and a lit border ring follow the pointer (spotlight-border-card),
 * and it lifts on hover with a two-layer shadow (tight contact + wide ambient, light from the top-left). While a
 * button is held inside it the lean eases off, so the target never moves under a press. Scrolling drifts it a little
 * slower than the copy. All of it is custom properties on one element, written from a useRafLoop that sleeps.
 */
import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import { createSequence, spring as SPRING, springAtRest, springToLinear, stepSpring, useScrollProgress, useSettleLoop } from '../../../motion';
import styles from './styles.module.css';

type Channel = 'rx' | 'ry' | 'gx' | 'gy' | 'glow' | 'lift';
const CHANNELS: readonly Channel[] = ['rx', 'ry', 'gx', 'gy', 'glow', 'lift'];
const REST: Record<Channel, number> = { rx: 0, ry: 0, gx: 18, gy: 8, glow: 0, lift: 0 };
const MAX_TILT = 2.6;
const SETTLE = springToLinear(SPRING.settle);

export function HeroWindow({ reduced, children }: { reduced: boolean; children: ReactNode }) {
  const visual = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const sim = useRef({ x: { ...REST }, v: Object.fromEntries(CHANNELS.map((c) => [c, 0])) as Record<Channel, number>, t: { ...REST } });
  const pressing = useRef(false);
  const last = useRef<{ px: number; py: number } | null>(null);
  const p0 = useRef<number | null>(null);

  const write = () => {
    const el = scene.current;
    if (!el) return;
    for (const c of CHANNELS) el.style.setProperty(`--${c}`, sim.current.x[c].toFixed(3));
  };
  const aim = (t: Partial<Record<Channel, number>>) => {
    Object.assign(sim.current.t, t);
    wake();
  };

  useEffect(() => {
    if (!reduced) return;
    sim.current.x = { ...REST };
    sim.current.t = { ...REST };
    write();
  }, [reduced]);

  const wake = useSettleLoop(scene, (dt) => {
    const s = sim.current;
    let rest = true;
    for (const k of CHANNELS) {
      const a = { x: s.x[k], v: s.v[k] };
      stepSpring(a, s.t[k], SPRING.settle, dt);
      s.x[k] = a.x; s.v[k] = a.v;
      const eps = k === 'gx' || k === 'gy' ? 0.2 : 0.004;
      if (!springAtRest(a, s.t[k], { restDelta: eps, restSpeed: eps * 4 })) rest = false;
    }
    write();
    return rest;
  }, !reduced);

  // Scroll: the window drifts up a little slower than the page (one layer, ≤ 48 px over the whole hero).
  useScrollProgress(visual, (p) => {
    if (p0.current === null) p0.current = p;
    scene.current?.style.setProperty('--drift', `${((p - p0.current) * -48).toFixed(2)}px`);
  }, { enabled: !reduced });

  // Entrance: the window rises and settles while its shadow spreads under it (secondary action).
  useEffect(() => {
    const el = scene.current;
    if (reduced || !el) return;
    const seq = createSequence()
      .add(el.querySelector('[data-win]'), [{ translate: '0 30px', rotate: 'x 5deg' }, { translate: '0 0', rotate: 'x 0deg' }], { at: 140, duration: SETTLE.duration * 1.2, easing: SETTLE.easing, fill: 'backwards' })
      .add(el.querySelectorAll('[data-shade]'), [{ opacity: 0, scale: '0.9' }, { opacity: 1, scale: '1' }], { at: 140, duration: SETTLE.duration * 1.2, easing: SETTLE.easing, fill: 'backwards' });
    void seq.play();
    return () => seq.cancel();
  }, [reduced]);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduced || e.pointerType === 'touch') return;
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    last.current = { px, py };
    const k = pressing.current ? 0.25 : 1;
    aim({ rx: (0.5 - py) * 2 * MAX_TILT * k, ry: (px - 0.5) * 2 * MAX_TILT * k, gx: px * 100, gy: py * 100, glow: 1, lift: 1 });
  };
  const onLeave = () => { last.current = null; pressing.current = false; if (!reduced) aim(REST); };
  const onDown = () => { pressing.current = true; if (last.current && !reduced) aim({ rx: sim.current.t.rx * 0.25, ry: sim.current.t.ry * 0.25 }); };
  const onUp = () => { pressing.current = false; };

  return (
    <div ref={visual} className={styles.heroVisual} onPointerMove={onMove} onPointerLeave={onLeave} onPointerDownCapture={onDown} onPointerUpCapture={onUp}>
      <div ref={scene} className={styles.scene}>
        <span className={styles.shadeAmbient} data-shade="" aria-hidden="true" />
        <span className={styles.shadeContact} data-shade="" aria-hidden="true" />
        <div className={styles.tiltWin} data-win="">
          {children}
          <span className={styles.glare} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
