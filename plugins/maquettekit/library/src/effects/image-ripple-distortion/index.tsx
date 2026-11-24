'use client';
import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { duration as D, useStudioMotion } from '../../motion';
import { StudioCanvas } from '../../three';
import type { EffectProps } from '../../types';
import { POSTERS, posterCanvas, posterFonts, readTheme, type Theme } from './posters';
import { Scene, type Pointer } from './scene';
import styles from './styles.module.css';

type Params = { amplitude: number; chroma: number; duration: number; frequency: number; hover: boolean };

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

/** No-WebGL fallback: the same posters drawn with canvas2d, cross-faded with CSS. */
function PosterImages({ index, theme, version }: { index: number; theme: Theme | null; version: number }) {
  const [srcs, setSrcs] = useState<string[]>([]);
  useEffect(() => { if (theme) setSrcs(POSTERS.map((_, i) => posterCanvas(i, 600, theme).toDataURL('image/png'))); }, [theme, version]);
  return (
    <div className={styles.stack}>
      {srcs.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={src} alt="" className={styles.still} data-on={i === index || undefined} />
      ))}
    </div>
  );
}

export default function ImageRippleDistortion({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const root = useRef<HTMLDivElement>(null);
  const pointer = useRef<Pointer>({ x: 0.5, y: 0.5, inside: false });
  const kick = useRef<(() => void) | null>(null);
  const [index, setIndex] = useState(0);
  const [origin, setOrigin] = useState<[number, number]>([0.5, 0.5]);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [fonts, setFonts] = useState(0);
  const themeVersion = useThemeVersion();

  // Theme colours + fonts from the tokens; redraw once the faces have actually loaded.
  useEffect(() => {
    if (!root.current) return;
    const t = readTheme(root.current);
    setTheme(t);
    let alive = true;
    if (document.fonts?.load) Promise.all(posterFonts(t).map((f) => document.fonts.load(f).catch(() => []))).then(() => { if (alive) setFonts((n) => n + 1); });
    return () => { alive = false; };
  }, [themeVersion]);

  const next = useCallback((at: [number, number] = [0.5, 0.5]) => {
    setOrigin(at);
    setIndex((i) => (i + 1) % POSTERS.length);
  }, []);

  const uv = (e: MouseEvent<HTMLDivElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const [x, y] = uv(e);
    pointer.current = { x, y, inside: e.pointerType === 'mouse' };
    kick.current?.();
  };
  const onLeave = () => { pointer.current = { ...pointer.current, inside: false }; kick.current?.(); };

  const poster = POSTERS[index];
  return (
    <div ref={root} className={styles.root}>
      <div className={styles.frame} onPointerMove={onMove} onPointerLeave={onLeave} onClick={(e) => next(uv(e))}>
        <StudioCanvas
          label={`Poster ${index + 1} of ${POSTERS.length}: ${poster.title}`}
          description="A generated typographic poster. Choosing Next sends a ripple across it that bends and splits the colour channels as the next poster is revealed."
          fallback={<PosterImages index={index} theme={theme} version={themeVersion + fonts * 100} />}
        >
          <Scene
            index={index}
            origin={origin}
            theme={theme}
            version={themeVersion + fonts * 100}
            duration={reduced ? D.fast : params.duration}
            amp={params.amplitude}
            chroma={params.chroma}
            freq={params.frequency}
            hover={params.hover}
            fade={reduced}
            pointer={pointer}
            kick={kick}
          />
        </StudioCanvas>
      </div>
      <div className={styles.panel}>
        <p className={styles.kicker}>Poster {String(index + 1).padStart(2, '0')} / {String(POSTERS.length).padStart(2, '0')} · sample series</p>
        <div aria-live="polite" className={styles.caption}>
          <p className={styles.title}>{poster.title}</p>
          <p className={styles.sub}>{poster.subtitle}</p>
        </div>
        <button type="button" className={styles.next} onClick={() => next()}>
          Next poster
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
        </button>
        <p className={styles.hint}>
          {reduced ? 'Reduced motion: posters cross-fade without distortion.' : `Click the poster to ripple from that point${params.hover ? '; hovering stirs the surface' : ''}.`}
        </p>
      </div>
    </div>
  );
}
