'use client';
import { useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { spring, springToLinear, useStudioMotion, type SpringToken } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { axis: 'horizontal' | 'vertical'; spring: SpringToken; perspective: number; tilt: number };

const STEPS = [
  { n: '01', kicker: 'Listen', title: 'Brief', body: 'One working session to agree what the page should make people feel, and what it must never do.', tone: 'paper' },
  { n: '02', kicker: 'Sketch', title: 'Prototype', body: 'Motion is designed in the browser from day one: timing, easing and interruption included.', tone: 'ink' },
  { n: '03', kicker: 'Refine', title: 'Polish', body: 'Reduced-motion paths, focus order and frame budgets are tuned alongside the visuals.', tone: 'signal' },
  { n: '04', kicker: 'Release', title: 'Ship', body: 'Recipes land as portable folders. Copy, paste, and theme with custom properties.', tone: 'green' },
] as const;
const COUNT = STEPS.length;
const wrap = (n: number) => ((n % COUNT) + COUNT) % COUNT;

export default function CssCubeCarousel({ params }: EffectProps<Params>) {
  const { reduced, scale } = useStudioMotion();
  /** Unbounded quarter-turn counter, so 4 → 1 keeps turning the same way instead of unwinding. */
  const [turn, setTurn] = useState(0);
  const [done, setDone] = useState<readonly boolean[]>(() => STEPS.map(() => false));
  const active = wrap(turn);
  const vertical = params.axis === 'vertical';
  const motion = useMemo(() => springToLinear(spring[params.spring] ?? spring.settle, 40), [params.spring]);

  const go = (delta: number) => setTurn((t) => t + delta);
  const goTo = (index: number) => {
    // shortest way round: -2..1 quarter turns
    const delta = ((index - active + COUNT + 2) % COUNT) - 2;
    if (delta !== 0) go(delta);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const next = vertical ? ['ArrowDown', 'ArrowRight'] : ['ArrowRight', 'ArrowDown'];
    const prev = vertical ? ['ArrowUp', 'ArrowLeft'] : ['ArrowLeft', 'ArrowUp'];
    if (next.includes(e.key)) { e.preventDefault(); go(1); }
    else if (prev.includes(e.key)) { e.preventDefault(); go(-1); }
    else if (e.key === 'Home') { e.preventDefault(); goTo(0); }
    else if (e.key === 'End') { e.preventDefault(); goTo(COUNT - 1); }
  };

  const tilt = reduced ? 0 : params.tilt;
  const depth = vertical ? 'var(--h)' : 'var(--w)';
  const prismTransform = vertical
    ? `translateZ(calc(${depth} / -2)) rotateY(${tilt}deg) rotateX(${turn * 90}deg)`
    : `translateZ(calc(${depth} / -2)) rotateX(${-tilt}deg) rotateY(${-turn * 90}deg)`;
  const faceTransform = (i: number) => (vertical ? `rotateX(${-i * 90}deg)` : `rotateY(${i * 90}deg)`) + ` translateZ(calc(${depth} / 2))`;

  return (
    <section
      className={styles.root}
      aria-roledescription="carousel"
      aria-label="How a Studio³ project runs (sample content)"
      data-reduced={reduced || undefined}
      onKeyDown={onKeyDown}
      style={{ '--persp': `${params.perspective}px`, '--dur': `${Math.round(motion.duration * scale.duration)}ms`, '--ease': motion.easing } as CSSProperties}
    >
      <div className={styles.scene}>
        <div className={styles.prism} style={{ transform: prismTransform }}>
          {STEPS.map((s, i) => (
            <article
              key={s.n}
              className={styles.face}
              data-tone={s.tone}
              data-active={i === active || undefined}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${COUNT}: ${s.title}`}
              inert={i !== active}
              style={{ transform: faceTransform(i) }}
            >
              <p className={styles.kicker}><span>{s.kicker}</span><span aria-hidden="true">{s.n} / 04</span></p>
              <h3 className={styles.title}>{s.title}</h3>
              <p className={styles.body}>{s.body}</p>
              <button
                type="button"
                className={styles.mark}
                aria-pressed={done[i]}
                onClick={() => setDone((d) => d.map((v, j) => (j === i ? !v : v)))}
              >
                <span className={styles.check} aria-hidden="true" />
                {done[i] ? 'Marked done' : 'Mark as done'}
              </button>
            </article>
          ))}
        </div>
      </div>

      <div className={styles.controls}>
        <button type="button" className={styles.arrow} onClick={() => go(-1)} aria-label="Previous step">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <ol className={styles.dots}>
          {STEPS.map((s, i) => (
            <li key={s.n}>
              <button type="button" className={styles.dot} aria-label={`Go to step ${i + 1}: ${s.title}${done[i] ? ' (done)' : ''}`} aria-current={i === active ? 'step' : undefined} data-done={done[i] || undefined} onClick={() => goTo(i)}>
                <span aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className={styles.arrow} onClick={() => go(1)} aria-label="Next step">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      <p className={styles.srOnly} aria-live="polite">Step {active + 1} of {COUNT}: {STEPS[active].title}</p>
    </section>
  );
}
