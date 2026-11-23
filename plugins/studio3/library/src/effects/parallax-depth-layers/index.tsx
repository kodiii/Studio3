'use client';
import { useRef, type CSSProperties, type ReactNode } from 'react';
import { useScrollProgress, useStudioMotion } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { strength: number; zoom: number; layers: number; horizon: boolean };

interface Layer { id: string; /** travel factor: + lags behind the scroll (far), − runs ahead (near) */ k: number; /** zoom factor */ z: number; shape: ReactNode }

/* Far → near. All shapes extend well below the 500-unit frame so travel never exposes an edge. */
const LAYERS: readonly Layer[] = [
  {
    id: 'sun', k: 1, z: 0,
    shape: (
      <>
        <circle className={styles.sun} cx="590" cy="150" r="46" />
        <path className={styles.rule} d="M86 118h150M132 134h64M470 92h72" />
      </>
    ),
  },
  { id: 'far', k: 0.62, z: 0.25, shape: <path className={styles.far} d="M-40 300C60 250 120 236 190 262S300 196 380 230S520 186 600 226S740 252 840 214V900H-40Z" /> },
  { id: 'mid', k: 0.34, z: 0.5, shape: <path className={styles.mid} d="M-40 356C80 300 160 332 240 318S380 268 470 310S620 352 700 300S790 288 840 296V900H-40Z" /> },
  { id: 'near', k: 0.1, z: 0.75, shape: <path className={styles.near} d="M-40 416C100 380 200 424 300 396S460 348 560 392S720 432 840 380V900H-40Z" /> },
  {
    id: 'fore', k: -0.3, z: 1,
    shape: (
      <>
        <path className={styles.fore} d="M-40 470C140 444 260 476 400 456S660 440 840 474V900H-40Z" />
        <path className={styles.reeds} d="M96 468q6-44-4-78M112 466q-2-30 8-56M128 468q4-22 0-40M642 452q8-48-2-86M660 452q-4-34 8-62M678 454q2-24-2-44" />
      </>
    ),
  },
];

const SUBSETS: Record<number, readonly string[]> = {
  3: ['sun', 'mid', 'fore'],
  4: ['sun', 'far', 'near', 'fore'],
  5: ['sun', 'far', 'mid', 'near', 'fore'],
};

export default function ParallaxDepthLayers({ params }: EffectProps<Params>) {
  const scroller = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLElement>(null);
  const { reduced, scale } = useStudioMotion();

  const count = Math.min(5, Math.max(3, Math.round(params.layers)));
  const layers = LAYERS.filter((l) => SUBSETS[count].includes(l.id));

  // p: 0 → scene enters at the bottom of the container, 1 → leaves at the top. Stored as −1..1 so 0 is "centred".
  useScrollProgress(scene, (p) => { scene.current?.style.setProperty('--p', (p * 2 - 1).toFixed(4)); }, { container: scroller, enabled: !reduced });

  const sceneStyle = {
    '--strength': reduced ? 0 : params.strength * scale.distance,
    '--zoom': reduced ? 0 : params.zoom,
    ...(reduced ? { '--p': 0 } : null),
  } as CSSProperties;

  return (
    <div className={styles.root}>
      <div ref={scroller} className={styles.scroller} tabIndex={0} role="region" aria-label="Field note with a parallax illustration — scroll to read">
        <header className={styles.lead}>
          <p className={styles.label}>Field note 14 · sample content</p>
          <h2 className={styles.heading}>Low cloud, high ground</h2>
          <p className={styles.standfirst}>Three days on the ridge path above a valley that never quite showed itself.</p>
        </header>

        <figure ref={scene} className={styles.scene} style={sceneStyle}>
          <div className={styles.frame} aria-hidden="true">
            {params.horizon && <div className={styles.horizon} />}
            {layers.map((l) => (
              <svg key={l.id} className={styles.layer} style={{ '--k': l.k, '--z': l.z } as CSSProperties} viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" focusable="false">
                {l.shape}
              </svg>
            ))}
          </div>
          <figcaption className={styles.caption}>
            <span>Plate I — the valley at seven in the morning</span>
            <span>{count} layers{reduced ? ' · static' : ` · ${Math.round(params.strength)} px travel`}</span>
          </figcaption>
        </figure>

        <div className={styles.prose}>
          <p>The path keeps to the east side, so mornings arrive late and all at once. For an hour the far ridges are flat shapes pinned to the sky, each one a shade paler than the one in front of it.</p>
          <p>Walk, and the near ground slides past quickly while the distance barely shifts. That difference in speed is the whole of how the eye reads depth here — there is nothing else to go on.</p>
          <p>By nine the cloud lifts off the valley floor and the trick stops working. Everything gains detail, and the ridges go back to being hills.</p>
          <p className={styles.end}>End of note</p>
        </div>
      </div>
    </div>
  );
}
