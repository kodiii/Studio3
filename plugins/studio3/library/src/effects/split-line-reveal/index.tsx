'use client';
import { useRef } from 'react';
import { createSequence, useIsomorphicLayoutEffect, useStudioMotion } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { text: string; stagger: number; duration: number; rise: number; skew: boolean };

export default function SplitLineReveal({ params }: EffectProps<Params>) {
  const root = useRef<HTMLHeadingElement>(null);
  const { reduced, scale } = useStudioMotion();
  const words = params.text.trim().split(/\s+/).filter(Boolean);

  useIsomorphicLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const targets = el.querySelectorAll<HTMLElement>('[data-word]');
    const seq = createSequence({ reducedMotion: reduced, durationScale: scale.duration });
    seq.add(
      targets,
      [
        { transform: `translateY(${params.rise}%) ${params.skew ? 'skewY(6deg)' : ''}`, opacity: 0 },
        { transform: 'translateY(0) skewY(0deg)', opacity: 1 },
      ],
      { duration: params.duration, stagger: params.stagger * scale.stagger, easing: 'emphasized' },
    );
    void seq.play();
    return () => seq.cancel();
  }, [params.text, params.stagger, params.duration, params.rise, params.skew, reduced, scale.duration, scale.stagger]);

  return (
    <h2 ref={root} className={styles.heading} aria-label={params.text}>
      {words.map((w, i) => (
        <span key={`${w}-${i}`} className={styles.mask} aria-hidden="true">
          <span data-word className={styles.word}>{w}</span>
        </span>
      ))}
    </h2>
  );
}
