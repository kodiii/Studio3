'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useStudioMotion } from '../../motion';
import type { EffectProps } from '../../types';
import { grainTile } from './grain';
import styles from './styles.module.css';

type Palette = 'Signal' | 'Moss' | 'Ochre' | 'Graphite';
type Params = { palette: Palette; drift: number; grain: number; fields: number };

/** Each preset is paper + ink + ONE accent, all theme tokens, so both themes (and the always-dark stage) follow. */
const PALETTES: Record<Palette, { accent: string; name: string }> = {
  Signal: { accent: 'var(--mk-signal, #bf2f09)', name: 'Signal' },
  Moss: { accent: 'var(--mk-accent-data, #0a6e4d)', name: 'Moss' },
  Ochre: { accent: 'var(--mk-accent-3d, #8a5a00)', name: 'Ochre' },
  Graphite: { accent: 'color-mix(in oklab, var(--mk-ink, #11110f) 78%, var(--mk-bg, #f3f0e8))', name: 'Graphite' },
};

/** Base drift periods (s) at drift = 1 — long and mutually prime-ish so the fields never visibly sync. */
const PERIODS = [47, 61, 73, 89];

export default function GrainGradientMesh({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const root = useRef<HTMLDivElement>(null);
  const [grain, setGrain] = useState('');
  const [offscreen, setOffscreen] = useState(false);
  const palette = PALETTES[params.palette] ?? PALETTES.Signal;
  const drifting = !reduced && params.drift > 0;
  const fields = Math.round(Math.min(4, Math.max(3, params.fields)));

  // Generated once per page (module cache), never per frame.
  useEffect(() => { setGrain(grainTile()); }, []);

  // CSS animations are cheap, but there is no reason to composite them while the hero is scrolled away.
  useEffect(() => {
    const el = root.current;
    if (!el || !drifting || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [drifting]);

  const vars = {
    '--gg-accent': palette.accent,
    '--gg-grain': grain ? `url(${grain})` : 'none',
    '--gg-grain-opacity': String(params.grain),
    ...Object.fromEntries(PERIODS.map((p, i) => [`--gg-t${i}`, `${(p / Math.max(0.05, params.drift)).toFixed(1)}s`])),
  } as CSSProperties;

  return (
    <div
      ref={root}
      className={styles.root}
      style={vars}
      data-drift={drifting ? '' : undefined}
      data-paused={offscreen ? '' : undefined}
    >
      <div className={styles.mesh} aria-hidden="true">
        <span className={`${styles.field} ${styles.f0}`} />
        <span className={`${styles.field} ${styles.f1}`} />
        <span className={`${styles.field} ${styles.f2}`} />
        {fields === 4 ? <span className={`${styles.field} ${styles.f3}`} /> : null}
        <span className={styles.grain} />
      </div>

      <div className={styles.card}>
        <p className={styles.kicker}>Sample hero</p>
        <h2 className={styles.title}>Warm light, slowly mixed.</h2>
        <p className={styles.body}>
          {fields === 4 ? 'Four' : 'Three'} soft colour fields drift on the compositor over a paper ground. One grain tile, generated once, keeps the large gradients from banding.
        </p>
        <ul className={styles.swatches} aria-label="Palette">
          <li><span className={styles.chip} data-tone="paper" aria-hidden="true" />Paper</li>
          <li><span className={styles.chip} data-tone="ink" aria-hidden="true" />Ink</li>
          <li><span className={styles.chip} data-tone="accent" aria-hidden="true" />{palette.name}</li>
        </ul>
      </div>
    </div>
  );
}
