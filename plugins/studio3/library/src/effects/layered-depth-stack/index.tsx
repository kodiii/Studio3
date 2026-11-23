'use client';
import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { useStudioMotion } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { separation: number; pitch: number; pointer: number; perspective: number };

const LAYERS = [
  { name: 'Canvas', note: 'Page background and layout grid' },
  { name: 'Content', note: 'Cards, charts and lists' },
  { name: 'Navigation', note: 'Top bar and section rail' },
  { name: 'Overlay', note: 'Toast, focus ring and pointer' },
] as const;

export default function LayeredDepthStack({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const [separation, setSeparation] = useState(params.separation);
  const [yaw, setYaw] = useState(-34);
  const stack = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const sepId = useId();
  const yawId = useId();

  useEffect(() => setSeparation(params.separation), [params.separation]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const tilt = (x: number, y: number) => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      stack.current?.style.setProperty('--px', x.toFixed(3));
      stack.current?.style.setProperty('--py', y.toFixed(3));
    });
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduced || params.pointer === 0 || e.pointerType === 'touch') return;
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    tilt(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
  };

  return (
    <div className={styles.root} data-reduced={reduced || undefined}>
      <div
        className={styles.scene}
        role="img"
        aria-label={`Exploded view of an interface in four layers, from bottom to top: ${LAYERS.map((l) => l.name).join(', ')}.`}
        style={{ perspective: `${params.perspective}px` }}
        onPointerMove={onPointerMove}
        onPointerLeave={() => tilt(0, 0)}
      >
        <div
          ref={stack}
          className={styles.stack}
          style={{ '--sep': `${separation}px`, '--k': separation / 110, '--pitch': `${params.pitch}deg`, '--yaw': `${yaw}deg`, '--reach': `${params.pointer}deg` } as CSSProperties}
        >
          <div className={`${styles.layer} ${styles.canvas}`} style={{ '--i': 0 } as CSSProperties}>
            <Tag n={1} name={LAYERS[0].name} />
          </div>
          <div className={`${styles.layer} ${styles.content}`} style={{ '--i': 1 } as CSSProperties}>
            <span className={styles.hero}><i /><i /><i /><i /><i /><i /><i /></span>
            <span className={styles.tile} />
            <span className={styles.tile} data-accent="" />
            <span className={styles.rows}><i /><i /><i /></span>
            <Tag n={2} name={LAYERS[1].name} />
          </div>
          <div className={`${styles.layer} ${styles.nav}`} style={{ '--i': 2 } as CSSProperties}>
            <span className={styles.bar}><b /><i /><i /><i /><em /></span>
            <span className={styles.rail}><i data-on="" /><i /><i /><i /></span>
            <Tag n={3} name={LAYERS[2].name} />
          </div>
          <div className={`${styles.layer} ${styles.overlay}`} style={{ '--i': 3 } as CSSProperties}>
            <span className={styles.ring} />
            <span className={styles.toast}><b /><i /><i /></span>
            <svg className={styles.cursor} viewBox="0 0 20 20" aria-hidden="true"><path d="M4 2.5v13l3.6-3.2 2.3 5.2 2.2-1-2.3-5.1 4.7-.3z" /></svg>
            <Tag n={4} name={LAYERS[3].name} />
          </div>
        </div>
      </div>

      <div className={styles.panel}>
        <ol className={styles.legend} reversed>
          {[...LAYERS].reverse().map((l, i) => (
            <li key={l.name}>
              <span className={styles.num} aria-hidden="true">{String(LAYERS.length - i).padStart(2, '0')}</span>
              <span><strong>{l.name}</strong><span className={styles.noteText}>{l.note}</span></span>
            </li>
          ))}
        </ol>
        <div className={styles.field}>
          <label htmlFor={sepId}>Separation <output htmlFor={sepId}>{separation} px</output></label>
          <input id={sepId} type="range" min={0} max={110} step={2} value={separation} onChange={(e) => setSeparation(Number(e.target.value))} />
        </div>
        <div className={styles.field}>
          <label htmlFor={yawId}>View angle <output htmlFor={yawId}>{yaw}°</output></label>
          <input id={yawId} type="range" min={-70} max={70} step={2} value={yaw} onChange={(e) => setYaw(Number(e.target.value))} />
        </div>
      </div>
    </div>
  );
}

function Tag({ n, name }: { n: number; name: string }) {
  return <span className={styles.tag} aria-hidden="true"><b>{String(n).padStart(2, '0')}</b>{name}</span>;
}
