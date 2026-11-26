'use client';
/**
 * Rive State Machine — reference implementation.
 * Two sample .riv files, each driven only through DOM controls: a character (boolean + trigger inputs, pointer
 * reactions) and a five-star rating (a number input behind a native radio group). The reusable part is
 * `RiveCanvas` (./RiveCanvas.tsx); import it with your own file and controls.
 */
import type { CSSProperties } from 'react';
import { spring, springToLinear, useStudioMotion } from '../../motion';
import type { EffectProps } from '../../types';
import { BirdStage } from './BirdStage';
import { RatingStars } from './RatingStars';
import styles from './styles.module.css';

export { RiveCanvas } from './RiveCanvas';
export type { RiveAlignment, RiveCanvasApi, RiveCanvasProps, RiveFit, RiveRuntime } from './RiveCanvas';

type Params = { scene: string; pointer: boolean; backdrop: string; tint: string };
const SCENES = ['both', 'character', 'rating'] as const;
/** Buttons press in within a frame and spring back on release with a small, toy-like overshoot. */
const RELEASE = springToLinear(spring.pop);
/** Values that change (the rating breakdown) settle on the calmer card spring. */
const SETTLE = springToLinear(spring.settle);
const SPRING_VARS = {
  '--rs-spring': RELEASE.easing,
  '--rs-spring-ms': `${RELEASE.duration}ms`,
  '--rs-settle': SETTLE.easing,
  '--rs-settle-ms': `${SETTLE.duration}ms`,
} as CSSProperties;

export default function RiveStateMachine({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const scene = SCENES.find((s) => s === params.scene) ?? 'both';
  return (
    <div className={styles.root} data-reduced={reduced || undefined} style={SPRING_VARS}>
      <div className={styles.grid} data-scene={scene}>
        {scene !== 'rating' ? <BirdStage index="01" pointer={params.pointer} backdrop={params.backdrop} /> : null}
        {scene !== 'character' ? <RatingStars index={scene === 'both' ? '02' : '01'} tint={params.tint} /> : null}
      </div>
      <p className={styles.credit}>Artwork: birb.riv and rating_animation.riv, Rive’s example files (MIT)</p>
    </div>
  );
}
