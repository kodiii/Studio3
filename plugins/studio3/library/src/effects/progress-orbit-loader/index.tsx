'use client';
import { useEffect, useId, useState, type CSSProperties } from 'react';
import { useStudioMotion } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { sequence: string; duration: number; orbit: number; thickness: number; satellite: boolean };
type Phase = 'preparing' | 'exporting' | 'done';

const PREP = 1400; // ms of "unknown size" before the job reports progress
const TICK = 180;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STATUS: Record<Phase, string> = {
  preparing: 'Preparing export…',
  exporting: 'Exporting. Progress is shown as a percentage.',
  done: 'Export complete: harbour-lights.mov (sample job).',
};

export default function ProgressOrbitLoader({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const uid = useId();
  const sequence = params.sequence === 'determinate' || params.sequence === 'indeterminate' ? params.sequence : 'auto';
  const first: Phase = sequence === 'determinate' ? 'exporting' : 'preparing';
  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState<Phase>(first);
  const [value, setValue] = useState(0);

  // Restart whenever the sequence changes (and on the Restart button via `run`).
  useEffect(() => { setPhase(first); setValue(0); }, [first, run]);

  // Unknown size first, then hand over to determinate progress (auto sequence only).
  useEffect(() => {
    if (phase !== 'preparing' || sequence !== 'auto') return;
    const t = window.setTimeout(() => setPhase('exporting'), PREP);
    return () => window.clearTimeout(t);
  }, [phase, sequence, run]);

  // Simulated job: irregular chunks that average out to `duration`.
  useEffect(() => {
    if (phase !== 'exporting') return;
    const rnd = mulberry32(run * 7919 + 17);
    const mean = 100 / Math.max(1, params.duration / TICK);
    let v = 0;
    let timer = 0;
    const tick = () => {
      v = Math.min(100, v + mean * (0.3 + rnd() * 1.4));
      setValue(v);
      timer = v >= 100 ? window.setTimeout(() => setPhase('done'), 420) : window.setTimeout(tick, TICK);
    };
    timer = window.setTimeout(tick, TICK);
    return () => window.clearTimeout(timer);
  }, [phase, run, params.duration]);

  const known = phase !== 'preparing';
  const pct = phase === 'done' ? 100 : Math.floor(value);
  const progress = phase === 'done' ? 1 : value / 100;
  const step = phase === 'preparing' ? 'Step 1 of 2 · reading clips' : phase === 'exporting' ? 'Step 2 of 2 · encoding' : 'Finished · 2 of 2 steps';

  const style = {
    '--thick': params.thickness,
    '--orbit': `${params.orbit}ms`,
  } as CSSProperties;

  return (
    <div className={styles.root} data-reduced={reduced || undefined} data-mode={known ? 'determinate' : 'indeterminate'} data-phase={phase} style={style}>
      <section className={styles.card} aria-labelledby={`${uid}title`}>
        <header className={styles.head}>
          <div>
            <p className={styles.kicker}>Export queue · sample job</p>
            <h3 id={`${uid}title`} className={styles.title}>harbour-lights.mov</h3>
          </div>
          <button type="button" className={styles.restart} onClick={() => setRun((r) => r + 1)}>Restart</button>
        </header>

        <div
          className={styles.loader}
          role="progressbar"
          aria-labelledby={`${uid}title`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={known ? pct : undefined}
          aria-valuetext={known ? `${pct}% exported` : 'Preparing, size not known yet'}
        >
          <svg className={styles.svg} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
            <circle className={styles.orbitPath} cx="60" cy="60" r="56" />
            <circle className={styles.track} cx="60" cy="60" r="44" />
            {known ? (
              <circle className={styles.arc} cx="60" cy="60" r="44" pathLength={1} transform="rotate(-90 60 60)" style={{ strokeDashoffset: 1 - progress }} />
            ) : (
              <g className={styles.spin}>
                <circle className={styles.indet} cx="60" cy="60" r="44" pathLength={1} transform="rotate(-90 60 60)" />
              </g>
            )}
            {params.satellite ? (
              <g className={styles.satellite} data-free={!known || undefined} style={known ? { transform: `rotate(${progress * 360}deg)` } : undefined}>
                <circle cx="60" cy="4" r="3.25" />
              </g>
            ) : null}
          </svg>
          <div className={styles.readout} aria-hidden="true">
            {known ? (
              <span className={styles.num}>{pct}<span className={styles.pct}>%</span></span>
            ) : (
              <span className={styles.dots}>···</span>
            )}
            <span className={styles.label}>{phase === 'preparing' ? 'Preparing' : phase === 'exporting' ? 'Exporting' : 'Done'}</span>
          </div>
        </div>

        <footer className={styles.foot}>
          <span>{step}</span>
          <span>{sequence === 'auto' ? 'Indeterminate → determinate' : sequence === 'determinate' ? 'Determinate only' : 'Indeterminate only'}</span>
        </footer>
        <p className={styles.srOnly} role="status">{STATUS[phase]}</p>
      </section>
    </div>
  );
}
