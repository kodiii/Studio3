'use client';
import { useCallback, useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from 'react';
import { useStudioMotion } from '../../motion';
import { StudioCanvas } from '../../three';
import type { EffectProps } from '../../types';
import { FlowLines } from './fallback';
import { Scene, type Influence, type Look } from './scene';
import styles from './styles.module.css';

type Params = { count: number; intensity: number; flow: number; size: number; mode: 'Repel' | 'Attract' };

function useThemeVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const bump = () => setV((n) => n + 1);
    const mo = new MutationObserver(bump);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener('change', bump);
    return () => { mo.disconnect(); mq?.removeEventListener('change', bump); };
  }, []);
  return v;
}

/** Relative luminance of a CSS colour via a 1×1 canvas (handles hex, rgb() and named colours). */
function luminance(css: string): number {
  const g = document.createElement('canvas').getContext('2d');
  if (!g) return 1;
  g.fillStyle = '#fff'; g.fillStyle = css; g.fillRect(0, 0, 1, 1);
  const [r, gr, b] = g.getImageData(0, 0, 1, 1).data;
  const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(gr) + 0.0722 * lin(b);
}

export default function ParticleFieldGpu({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const hintId = useId();
  const field = useRef<HTMLDivElement>(null);
  const influence = useRef<Influence>({ x: 0, y: 0, active: false });
  const kick = useRef<(() => void) | null>(null);
  const [paused, setPaused] = useState(false);
  const [drawn, setDrawn] = useState<number | null>(null);
  const [look, setLook] = useState<Look>({ ink: '#11110f', accent: '#bf2f09', dark: false });
  const theme = useThemeVersion();
  const running = !paused && !reduced;
  const interactive = !reduced;

  useEffect(() => {
    const el = field.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const v = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
    setLook({ ink: v('--s3-ink', '#11110f'), accent: v('--s3-signal', '#bf2f09'), dark: luminance(v('--s3-surface', '#fbf9f4')) < 0.2 });
  }, [theme]);

  const point = (e: PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const r = e.currentTarget.getBoundingClientRect();
    influence.current = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: 1 - ((e.clientY - r.top) / r.height) * 2, active: true };
    kick.current?.();
  };
  const leave = () => { influence.current = { ...influence.current, active: false }; kick.current?.(); };
  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    if (!interactive || !e.currentTarget.matches(':focus-visible')) return;
    influence.current = { x: 0, y: 0, active: true };
    kick.current?.();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const step = e.shiftKey ? 0.3 : 0.1;
    const c = influence.current;
    const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (move[e.key]) {
      influence.current = { x: Math.max(-1, Math.min(1, c.x + move[e.key][0])), y: Math.max(-1, Math.min(1, c.y + move[e.key][1])), active: true };
    } else if (e.key === 'Escape') influence.current = { ...c, active: false };
    else return;
    e.preventDefault();
    kick.current?.();
  };
  const onCount = useCallback((n: number) => setDrawn(n), []);

  return (
    <div className={styles.root}>
      <div
        ref={field}
        className={styles.field}
        tabIndex={interactive ? 0 : undefined}
        role={interactive ? 'application' : undefined}
        aria-label={interactive ? 'Particle flow field' : undefined}
        aria-describedby={interactive ? hintId : undefined}
        aria-keyshortcuts={interactive ? 'ArrowLeft ArrowRight ArrowUp ArrowDown Escape' : undefined}
        onPointerMove={point}
        onPointerDown={point}
        onPointerLeave={leave}
        onFocus={onFocus}
        onBlur={leave}
        onKeyDown={onKeyDown}
      >
        <StudioCanvas
          label="Particle flow field"
          description="Thousands of fine particles drift from left to right along a swirling, braided flow, like ink in slow water. The pointer pushes them aside or draws them in."
          frameloop={running ? 'always' : 'demand'}
          camera={{ fov: 50, near: 0.1, far: 20, position: [0, 0, 5] }}
          fallback={<FlowLines />}
        >
          <Scene
            count={params.count}
            intensity={params.intensity}
            flow={params.flow}
            size={params.size}
            repel={params.mode !== 'Attract'}
            running={running}
            interactive={interactive}
            look={look}
            influence={influence}
            kick={kick}
            onCount={onCount}
          />
        </StudioCanvas>
      </div>
      <div className={styles.bar}>
        {reduced ? null : (
          <button type="button" className={styles.button} aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">{paused ? <path d="M5 3.5v9l7.5-4.5z" /> : <path d="M5 3.5v9M11 3.5v9" />}</svg>
            {paused ? 'Play' : 'Pause'}
          </button>
        )}
        <p id={hintId} className={styles.hint}>
          {reduced
            ? 'Motion is reduced, so the field is a still frame.'
            : `Move the pointer through the field to ${params.mode === 'Attract' ? 'draw particles in' : 'push particles aside'}. Keyboard: focus the field, arrows move the influence, Esc releases it.`}
        </p>
        <p className={styles.count}>{drawn === null ? 'Static drawing' : `${drawn.toLocaleString('en-US')} particles`}</p>
      </div>
    </div>
  );
}
