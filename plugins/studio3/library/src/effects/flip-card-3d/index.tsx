'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { cssEase, useStudioMotion } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { axis: 'y' | 'x'; duration: number; perspective: number; lift: number };

const INCLUDED = [
  ['Recipes', 'Every motion and 3D recipe'],
  ['Seats', 'Five editors, unlimited viewers'],
  ['Reviews', 'Two motion reviews a month'],
  ['Support', 'Reply within two working days'],
  ['Licence', 'One product, perpetual'],
] as const;

export default function FlipCard3d({ params }: EffectProps<Params>) {
  const { reduced, scale } = useStudioMotion();
  /** Half-turn counter: the card keeps turning the same way rather than unwinding. */
  const [turns, setTurns] = useState(0);
  const flipped = turns % 2 === 1;
  const lift = useRef<HTMLDivElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const lights = useRef<(HTMLSpanElement | null)[]>([]);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const running = useRef<Animation[]>([]);
  const first = useRef(true);
  const ms = Math.round(params.duration * scale.duration);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    // The side that was focused just became inert: hand focus to the visible side.
    buttons.current[flipped ? 1 : 0]?.focus({ preventScroll: true });
    running.current.forEach((a) => a.cancel());
    running.current = [];
    if (reduced || typeof Element.prototype.animate !== 'function') return;
    const timing: KeyframeAnimationOptions = { duration: ms, easing: cssEase('inOut') };
    const add = (el: Element | null | undefined, frames: Keyframe[]) => { if (el) running.current.push(el.animate(frames, timing)); };
    add(lift.current, [{ transform: 'translateZ(0)' }, { transform: `translateZ(${params.lift}px)` }, { transform: 'translateZ(0)' }]);
    add(shadow.current, [
      { transform: 'scale(1)', opacity: 0.55 },
      { transform: `scale(${params.axis === 'y' ? '0.72, 1.04' : '1.04, 0.6'})`, opacity: 0.28 },
      { transform: 'scale(1)', opacity: 0.55 },
    ]);
    for (const el of lights.current) add(el, [{ opacity: 0, backgroundPosition: '0% 0%' }, { opacity: 1, offset: 0.5 }, { opacity: 0, backgroundPosition: '100% 100%' }]);
  }, [turns]); // eslint-disable-line react-hooks/exhaustive-deps -- params are read at flip time on purpose
  useEffect(() => () => running.current.forEach((a) => a.cancel()), []);

  const rotate = params.axis === 'x' ? 'rotateX' : 'rotateY';
  const flip = () => setTurns((t) => t + 1);

  return (
    <div
      className={styles.root}
      data-reduced={reduced || undefined}
      data-axis={params.axis}
      style={{ '--persp': `${params.perspective}px`, '--dur': `${ms}ms` } as CSSProperties}
    >
      <div className={styles.shadow} ref={shadow} aria-hidden="true" />
      <div className={styles.lift} ref={lift}>
        <div className={styles.card} style={reduced ? undefined : { transform: `${rotate}(${turns * 180}deg)` }}>
          <section className={`${styles.face} ${styles.front}`} aria-label="Studio plan summary" inert={flipped} data-shown={!flipped || undefined}>
            <p className={styles.kicker}><span>Studio plan</span><span>Sample pricing</span></p>
            <p className={styles.price}><span className={styles.amount}>€480</span><span className={styles.per}>per month, billed yearly</span></p>
            <p className={styles.lede}>For a product team shipping motion every sprint.</p>
            <ul className={styles.points}>
              <li>All recipes, 3D included</li>
              <li>Five editor seats</li>
              <li>Two motion reviews a month</li>
            </ul>
            <button type="button" className={styles.action} ref={(el) => { buttons.current[0] = el; }} onClick={flip}>
              See what’s included <Turn />
            </button>
            <span className={styles.light} ref={(el) => { lights.current[0] = el; }} aria-hidden="true" />
          </section>

          <section className={`${styles.face} ${styles.back}`} aria-label="Studio plan details" inert={!flipped} data-shown={flipped || undefined}>
            <p className={styles.kicker}><span>What’s included</span><span>Sample data</span></p>
            <dl className={styles.table}>
              {INCLUDED.map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
            <p className={styles.note}>Cancel any time; the recipes you have shipped stay licensed.</p>
            <button type="button" className={styles.action} ref={(el) => { buttons.current[1] = el; }} onClick={flip}>
              Back to summary <Turn />
            </button>
            <span className={styles.light} ref={(el) => { lights.current[1] = el; }} aria-hidden="true" />
          </section>
        </div>
      </div>
    </div>
  );
}

function Turn() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M3 8a5 5 0 0 1 8.6-3.5L13 6M13 3v3h-3M13 8a5 5 0 0 1-8.6 3.5L3 10M3 13v-3h3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
