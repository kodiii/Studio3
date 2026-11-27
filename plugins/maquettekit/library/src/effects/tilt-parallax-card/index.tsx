'use client';
import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type PointerEvent } from 'react';
import { spring, useRafLoop, useStudioMotion, type SpringToken } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { maxTilt: number; depth: number; spring: string; glare: number; perspective: number };

/** Channels driven by the spring: tilt (deg), highlight position (%) and highlight strength (0–1). */
type Channel = 'rx' | 'ry' | 'hx' | 'hy' | 'glow';
const CHANNELS: readonly Channel[] = ['rx', 'ry', 'hx', 'hy', 'glow'];
const REST: Record<Channel, number> = { rx: 0, ry: 0, hx: 30, hy: 18, glow: 0 };
const isSpring = (v: string): v is SpringToken => v in spring;

export default function TiltParallaxCard({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  // Custom properties live on the untransformed scene so the card and its ground shadow both read them.
  const scene = useRef<HTMLDivElement>(null);
  const sim = useRef({ x: { ...REST }, v: { rx: 0, ry: 0, hx: 0, hy: 0, glow: 0 } as Record<Channel, number>, target: { ...REST } });
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const hovering = useRef(false);
  const focused = useRef(false);
  const [coarse, setCoarse] = useState(false);
  const [saved, setSaved] = useState(false);
  const token: SpringToken = isSpring(params.spring) ? params.spring : 'settle';
  const tiltOff = reduced || coarse || params.maxTilt === 0;

  useEffect(() => {
    const mq = window.matchMedia('(hover: none), (pointer: coarse)');
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const write = () => {
    const el = scene.current;
    if (!el) return;
    const { x } = sim.current;
    el.style.setProperty('--rx', x.rx.toFixed(3));
    el.style.setProperty('--ry', x.ry.toFixed(3));
    el.style.setProperty('--hx', x.hx.toFixed(2));
    el.style.setProperty('--hy', x.hy.toFixed(2));
    el.style.setProperty('--glow', x.glow.toFixed(3));
  };
  const wake = () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
  };
  const aim = (t: Partial<Record<Channel, number>>) => {
    Object.assign(sim.current.target, t);
    wake();
  };
  /** Where the card rests when the pointer leaves: flat, or the gentle focus pose. */
  const restPose = () => (focused.current
    ? { rx: params.maxTilt * 0.35, ry: -params.maxTilt * 0.55, hx: 24, hy: 14, glow: 0.65 }
    : REST);

  // Reduced motion / coarse pointer / tilt 0: snap flat and stay there.
  useEffect(() => {
    if (!tiltOff) return;
    sim.current.x = { ...REST };
    sim.current.target = { ...REST };
    for (const c of CHANNELS) sim.current.v[c] = 0;
    write();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiltOff]);

  useRafLoop(scene, (dt) => {
    const s = sim.current;
    const { stiffness: k, damping: d, mass: m } = spring[token];
    // Semi-implicit Euler in ≤ 1/120 s sub-steps: stable for every spring token.
    // Kept local, not stepSpring: the card's tilt was tuned at 1/120 s steps (stepSpring's 1/240 s would damp it differently).
    const steps = Math.max(1, Math.ceil(dt * 120));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      for (const c of CHANNELS) {
        const a = (-k * (s.x[c] - s.target[c]) - d * s.v[c]) / m;
        s.v[c] += a * h;
        s.x[c] += s.v[c] * h;
      }
    }
    let settled = true;
    for (const c of CHANNELS) {
      const eps = c === 'glow' ? 0.002 : 0.02;
      if (Math.abs(s.x[c] - s.target[c]) > eps || Math.abs(s.v[c]) > eps * 4) { settled = false; break; }
    }
    if (settled) {
      for (const c of CHANNELS) { s.x[c] = s.target[c]; s.v[c] = 0; }
      runningRef.current = false;
      setRunning(false);
    }
    write();
  }, running && !tiltOff);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (tiltOff || e.pointerType === 'touch') return;
    // Measure the untransformed wrapper, never the tilted card, so the tilt cannot feed back.
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    hovering.current = true;
    aim({ rx: (0.5 - py) * 2 * params.maxTilt, ry: (px - 0.5) * 2 * params.maxTilt, hx: px * 100, hy: py * 100, glow: 1 });
  };
  const onLeave = () => {
    hovering.current = false;
    if (!tiltOff) aim(restPose());
  };
  const onFocus = (e: FocusEvent<HTMLElement>) => {
    const visible = e.target instanceof HTMLElement && e.target.matches(':focus-visible');
    focused.current = visible;
    if (visible && !hovering.current && !tiltOff) aim(restPose());
  };
  const onBlur = (e: FocusEvent<HTMLElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    focused.current = false;
    if (!hovering.current && !tiltOff) aim(REST);
  };

  // Each raised plane is scaled by (P − z) / P, so at rest it projects exactly onto the card and only tilt reveals depth.
  const plane = (n: number): CSSProperties => {
    const zz = n * params.depth;
    return { transform: `translateZ(${zz.toFixed(1)}px) scale(${((params.perspective - zz) / params.perspective).toFixed(4)})` };
  };
  return (
    <div className={styles.root} data-reduced={reduced || undefined} data-flat={tiltOff || undefined}>
      <div
        ref={scene}
        className={styles.scene}
        style={{ perspective: `${params.perspective}px`, '--glare': params.glare / 100 } as CSSProperties}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
      >
        <div className={styles.shadow} aria-hidden="true" />
        <article className={styles.card} aria-label="Night pass, sample" onFocus={onFocus} onBlur={onBlur}>
          {/* Base plane (z = 0): sky, stars and the full-bleed hills, clipped to the card. */}
          <div className={`${styles.layer} ${styles.sky}`} aria-hidden="true">
            <svg className={styles.hills} viewBox="0 0 100 40" preserveAspectRatio="none">
              <path d="M0 14c14-6 26-9 40-8s22 5 34 3 18-6 26-8v39H0z" fill="#0c0b09" />
              <path d="M0 14c14-6 26-9 40-8s22 5 34 3 18-6 26-8" fill="none" stroke="#5a4c33" strokeWidth="0.35" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
          <div className={`${styles.layer} ${styles.sheen}`} aria-hidden="true" />
          {/* Raised planes: only inset objects float, so nothing pokes past the card edge when it tilts. */}
          <div className={`${styles.layer} ${styles.orbitLayer}`} style={plane(14)} aria-hidden="true"><span className={styles.orbit} /></div>
          <div className={`${styles.layer} ${styles.moonLayer}`} style={plane(32)} aria-hidden="true"><span className={styles.moon}><i /><i /><i /></span></div>
          <div className={`${styles.layer} ${styles.domeLayer}`} style={plane(52)} aria-hidden="true">
            <svg className={styles.dome} viewBox="0 0 24 14">
              <path d="M2 13.5a10 10 0 0 1 20 0z" fill="#0c0b09" stroke="#6b5a3b" strokeWidth="0.5" />
              <rect x="11.1" y="3.8" width="1.8" height="9.5" rx="0.6" fill="#e6b35c" />
            </svg>
          </div>
          <div className={`${styles.layer} ${styles.content}`} style={plane(80)}>
            <p className={styles.kicker}><span>Night pass</span><span>Sample</span></p>
            <h3 className={styles.title}>Hallowell Observatory</h3>
            <dl className={styles.facts}>
              <div><dt>Date</dt><dd>Fri 14 Mar</dd></div>
              <div><dt>Gates</dt><dd>20:30</dd></div>
              <div><dt>Dome</dt><dd>B</dd></div>
              <div><dt>Admit</dt><dd>One</dd></div>
            </dl>
            <button type="button" className={styles.save} aria-pressed={saved} onClick={() => setSaved((v) => !v)}>
              <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M4 2.5h8v11l-4-3-4 3z" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
              Save pass
            </button>
          </div>
        </article>
      </div>
      <p className={styles.caption}>Tilts toward the pointer · keyboard focus gives a fixed tilt · artwork drawn in CSS and SVG</p>
    </div>
  );
}
