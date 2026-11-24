'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { duration as D, spring, springToLinear, useElementSize, useRafLoop, useStudioMotion } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { count: number; power: number; gravity: number; spread: number; spin: number };

const REACTIONS = [
  { id: 'love', label: 'Love', base: 64, path: 'M12 20.5 4.6 13a4.9 4.9 0 0 1 0-6.900 4.800 4.800 0 0 1 6.800 0l.6.6.6-.6a4.800 4.800 0 0 1 6.800 0 4.900 4.900 0 0 1 0 6.900z' },
  { id: 'spark', label: 'Spark', base: 27, path: 'M12 2.500c.6 5 3 7.900 9.500 9.500-6.500 1.600-8.900 4.500-9.500 9.500-.6-5-3-7.900-9.500-9.500 6.500-1.600 8.900-4.500 9.500-9.500z' },
  { id: 'bloom', label: 'Bloom', base: 12, path: 'M12 12c-4-1-5-6 0-9 5 3 4 8 0 9zm0 0c1-4 6-5 9 0-3 5-8 4-9 0zm0 0c4 1 5 6 0 9-5-3-4-8 0-9zm0 0c-1 4-6 5-9 0 3-5 8-4 9 0z' },
] as const;
type ReactionId = (typeof REACTIONS)[number]['id'];

const POOL = 160;
const DRAG = 1.5; // 1/s — exponential air drag
interface Particle { alive: boolean; x: number; y: number; vx: number; vy: number; rot: number; vr: number; size: number; age: number; ttl: number; shape: number; ink: boolean }

const POP = springToLinear(spring.pop);

export default function ReactionBurst({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { width, height } = useElementSize(rootRef);
  const [pressed, setPressed] = useState<Record<ReactionId, boolean>>({ love: false, spark: false, bloom: false });
  const [status, setStatus] = useState('');
  const [active, setActive] = useState(false);

  const pool = useRef<Particle[]>([]);
  const shapes = useRef<Path2D[]>([]);
  const colors = useRef({ accent: '#bf2f09', ink: '#11110f' });
  const cursor = useRef(0);
  const anims = useRef(new Set<Animation>());

  useEffect(() => {
    pool.current = Array.from({ length: POOL }, () => ({ alive: false, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, size: 0, age: 0, ttl: 0, shape: 0, ink: false }));
    shapes.current = typeof Path2D === 'undefined' ? [] : REACTIONS.map((r) => new Path2D(r.path));
    const running = anims.current;
    return () => { running.forEach((a) => a.cancel()); running.clear(); };
  }, []);

  // Backing store follows the element size (DPR ≤ 2).
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !width || !height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
  }, [width, height]);

  useRafLoop(canvasRef, (dt) => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = c.width / Math.max(1, width);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    const k = Math.exp(-DRAG * dt);
    let alive = 0;
    for (const p of pool.current) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.ttl || p.y > height + 40) { p.alive = false; continue; }
      p.vx *= k;
      p.vy = p.vy * k + params.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      alive++;
      const life = p.age / p.ttl;
      const s = (p.size / 24) * Math.min(1, p.age / 0.09) * dpr;
      ctx.globalAlpha = life > 0.65 ? Math.max(0, 1 - (life - 0.65) / 0.35) : 1;
      ctx.fillStyle = p.ink ? colors.current.ink : colors.current.accent;
      ctx.setTransform(s, 0, 0, s, p.x * dpr, p.y * dpr);
      ctx.rotate(p.rot);
      ctx.translate(-12, -12);
      const shape = shapes.current[p.shape];
      if (shape) ctx.fill(shape);
    }
    if (!alive) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); setActive(false); }
  }, active && !reduced);

  const burst = useCallback((button: HTMLElement, shape: number) => {
    const root = rootRef.current;
    if (!root) return;
    const cs = getComputedStyle(root);
    colors.current = { accent: cs.getPropertyValue('--mk-accent').trim() || '#bf2f09', ink: cs.getPropertyValue('--mk-ink').trim() || '#11110f' };
    const rb = root.getBoundingClientRect();
    const ib = (button.querySelector('svg') ?? button).getBoundingClientRect();
    const ox = ib.left + ib.width / 2 - rb.left, oy = ib.top + ib.height / 2 - rb.top;
    const cone = (params.spread * Math.PI) / 180;
    for (let i = 0; i < params.count; i++) {
      const p = pool.current[cursor.current];
      cursor.current = (cursor.current + 1) % POOL;
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * cone;
      const speed = params.power * (0.45 + Math.random() * 0.55);
      p.alive = true;
      p.x = ox; p.y = oy;
      p.vx = Math.cos(angle) * speed; p.vy = Math.sin(angle) * speed;
      p.rot = Math.random() * Math.PI * 2;
      p.vr = (Math.random() - 0.5) * 2 * params.spin;
      p.size = 9 + Math.random() * 13;
      p.age = 0; p.ttl = 0.9 + Math.random() * 0.7;
      p.shape = shape; p.ink = i % 4 === 3;
    }
    setActive(true);
  }, [params.count, params.power, params.spread, params.spin]);

  const play = (el: Element | null, keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
    if (!el || typeof el.animate !== 'function') return;
    const a = el.animate(keyframes, options);
    anims.current.add(a);
    const done = () => anims.current.delete(a);
    a.finished.then(done, done);
  };

  const toggle = (index: number, button: HTMLButtonElement) => {
    const r = REACTIONS[index];
    const on = !pressed[r.id];
    setPressed((s) => ({ ...s, [r.id]: on }));
    setStatus(on ? `You reacted with ${r.label}. ${r.base + 1} in total.` : `${r.label} reaction removed. ${r.base} in total.`);
    if (reduced) { play(button, [{ opacity: 1 }, { opacity: 0.45 }, { opacity: 1 }], { duration: D.fast }); return; }
    const count = button.querySelector('[data-count]');
    const icon = button.querySelector('svg');
    if (on) {
      play(icon, [{ transform: 'scale(0.6)' }, { transform: 'scale(1)' }], { duration: POP.duration, easing: POP.easing });
      play(count, [{ transform: 'translateY(60%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: POP.duration, easing: POP.easing });
      burst(button, index);
    } else {
      play(count, [{ transform: 'translateY(-40%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: D.base, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
    }
  };

  return (
    <div ref={rootRef} className={styles.root}>
      <article className={styles.post}>
        <header className={styles.byline}>
          <span className={styles.avatar} aria-hidden="true">IV</span>
          <span>
            <span className={styles.author}>Ines Varga</span>
            <span className={styles.where}>Tidewater Print Club · field note 14</span>
          </span>
        </header>
        <p className={styles.body}>First proofs of the tide tables came off the press this morning. Two colours, one very patient machine, and a registration mark that finally sits still.</p>
        <div className={styles.reactions} role="group" aria-label="Reactions">
          {REACTIONS.map((r, i) => {
            const on = pressed[r.id];
            return (
              <button key={r.id} type="button" className={styles.reaction} aria-pressed={on} onClick={(e) => toggle(i, e.currentTarget)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d={r.path} /></svg>
                <span>{r.label}</span>
                <span className={styles.count}><span data-count>{r.base + (on ? 1 : 0)}</span></span>
              </button>
            );
          })}
        </div>
        <p className={styles.note}>Fictional post · counts are sample data</p>
      </article>
      <p className={styles.srOnly} role="status">{status}</p>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
    </div>
  );
}
