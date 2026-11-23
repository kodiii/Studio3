'use client';
/**
 * The 3D post's media. Poster first; "Interact in 3D" mounts ONE StudioCanvas with the orbit-token GLB (three-kit:
 * Model, OrbitInspect, LightingRig, AnimationPlayer). The poster stays until the model reports loaded, then cross-fades.
 * Every scene interaction has a DOM button; Close 3D, or scrolling the post well out of view, unmounts the canvas so
 * the renderer and (one second later) the cached model are released.
 * Without WebGL the poster itself is the fallback (data-studio3-fallback) and no Interact button is offered.
 */
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useStudioMotion } from '../../../motion';
import {
  AnimationPlayer, LightingRig, Model, ModelBoundary, OrbitInspect, StudioCanvas, describeModelError, detectCapabilities, formatBytes, formatCount,
  useModelManifest, useModelProgress, type AnimationPlayerHandle, type AnimationState, type LoadedModel, type OrbitInspectHandle,
} from '../../../three';
import styles from './styles.module.css';

const MANIFEST = '/models/orbit-token.manifest.json';
const GLB = '/models/orbit-token.desktop.glb';
const POSTER = '/models/orbit-token.png';
const ALT = 'The One Orbit token: a brass coin with a ringed planet at its centre and twelve faceted studs around the rim.';
const STEP = Math.PI / 8;

export function TokenViewer({ onActiveChange }: { onActiveChange?: (active: boolean) => void }) {
  const { reduced } = useStudioMotion();
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [active, setActive] = useState(false);
  const [model, setModel] = useState<LoadedModel | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [anim, setAnim] = useState<AnimationState>({ clip: null, time: 0, duration: 0, playing: false });
  const [az, setAz] = useState(0);
  const [note, setNote] = useState('');
  const frame = useRef<HTMLDivElement>(null);
  const orbit = useRef<OrbitInspectHandle>(null);
  const player = useRef<AnimationPlayerHandle>(null);
  const firstTool = useRef<HTMLButtonElement>(null);
  const interact = useRef<HTMLButtonElement>(null);
  const focusAfter = useRef<'tools' | 'interact' | null>(null);
  const raf = useRef(0);
  const { manifest } = useModelManifest(MANIFEST);
  const variant = manifest?.variants.find((v) => v.file.endsWith('desktop.glb')) ?? manifest?.variants[0];
  const progress = useModelProgress(active ? GLB : null);

  useEffect(() => { setWebgl(detectCapabilities().webgl); }, []);
  useEffect(() => { onActiveChange?.(active); }, [active, onActiveChange]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const open = () => { setError(null); setModel(null); setNote(''); focusAfter.current = 'tools'; setActive(true); };
  const close = useCallback((why = '') => {
    setActive(false); setModel(null); setAz(0);
    setAnim({ clip: null, time: 0, duration: 0, playing: false });
    setNote(why);
    focusAfter.current = why ? null : 'interact';
  }, []);

  useEffect(() => {
    const to = focusAfter.current;
    focusAfter.current = null;
    if (to === 'tools') firstTool.current?.focus();
    if (to === 'interact') interact.current?.focus();
  }, [active]);

  // Release the scene when the post scrolls well away (a full viewport beyond the edge).
  useEffect(() => {
    const el = frame.current;
    if (!active || !el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => { if (!e.isIntersecting) close('The 3D view closed when you scrolled away, to free memory. Interact to open it again.'); }, { rootMargin: '100% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [active, close]);

  const onOrbitChange = () => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const a = orbit.current?.controls?.getAzimuthalAngle() ?? 0;
      setAz(Math.round(((a * 180) / Math.PI + 360) % 360));
    });
  };

  const live = active && !!model && !error;
  const sizeLabel = formatBytes(variant?.bytes ?? null);
  const loading = active && !model && !error;
  const received = progress.loaded ? `${formatBytes(progress.loaded)} of ${formatBytes(progress.total ?? variant?.bytes ?? null)}` : 'starting';

  return (
    <div className={styles.viewer}>
      <div ref={frame} className={styles.frame} data-stage="ink" data-live={live || undefined} data-studio3-fallback={webgl === false ? '' : undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={POSTER} alt={live ? '' : ALT} aria-hidden={live || undefined} className={styles.poster} decoding="async" />
        {active ? (
          <StudioCanvas
            label="One Orbit token, interactive 3D view"
            description={`${ALT} Drag sideways or use the arrow keys to turn it; plus and minus zoom; 0 resets.`}
            lazy={false}
            camera={{ fov: 30, near: 0.05, far: 40, position: [0, 0.63, 3.4] }}
            className={styles.canvas}
            style={{ position: 'absolute', inset: 0 }}
            onSceneError={setError}
            fallback={<p className={styles.frameNote}>{describeModelError(error) || 'Showing the photo instead.'}</p>}
          >
            <LightingRig preset="studio-soft" shadow="none" />
            <OrbitInspect ref={orbit} target={[0, 0.63, 0]} minDistance={1.9} maxDistance={6} minPolarAngle={0.35} maxPolarAngle={Math.PI - 0.35} onChange={onOrbitChange} />
            <ModelBoundary resetKey={attempt} onError={setError}>
              <Suspense fallback={null}>
                <Model src={GLB} scale={20} onLoaded={setModel} />
                <AnimationPlayer ref={player} root={model?.scene ?? null} clips={model?.animations ?? []} clip="Spin" loop onState={setAnim} />
              </Suspense>
            </ModelBoundary>
          </StudioCanvas>
        ) : null}

        <div className={styles.reticle} aria-hidden="true">
          <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
            <circle cx="50" cy="50" r="44" /><circle cx="50" cy="50" r="1" />
            <path d="M50 2v10M50 88v10M2 50h10M88 50h10M50 40v4M50 56v4M40 50h4M56 50h4" />
          </svg>
          <span className={styles.retTL}>Finder · 6×30</span>
          {active ? null : <span className={styles.retTR}>One Orbit · brass</span>}
          <span className={styles.retBL}>{live ? `AZ ${String(az).padStart(3, '0')}°` : 'Photo'}</span>
          <span className={styles.retBR}>{live ? (anim.playing ? 'Spin on' : '3D') : webgl === false ? 'No 3D here' : 'Poster'}</span>
        </div>

        {active ? (
          <button type="button" className={styles.closeIn} onClick={() => close()}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 7l10 10M17 7 7 17" /></svg>Close 3D
          </button>
        ) : null}
        {loading ? <p className={styles.frameStatus} role="status">Loading model… {received}</p> : null}
        {error ? (
          <div className={styles.frameStatus} role="alert">
            {describeModelError(error)}{' '}
            <button type="button" className={styles.textBtnInk} onClick={() => { setError(null); setAttempt((n) => n + 1); }}>Try again</button>
          </div>
        ) : null}
        {webgl === false ? (
          <p className={styles.frameNote}>Interactive 3D isn’t available in this browser. The photo, the details below and the model download are the whole post.</p>
        ) : null}
      </div>

      {active ? (
        <div className={styles.toolbar} role="group" aria-label="3D view controls">
          <button ref={firstTool} type="button" className={styles.tool} onClick={() => orbit.current?.rotate(STEP)}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 7H4V3M4.6 7A8 8 0 1 1 4 12" /></svg><span className="s3-sr-only">Turn left</span>
          </button>
          <button type="button" className={styles.tool} onClick={() => orbit.current?.rotate(-STEP)}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M16 7h4V3M19.400 7A8 8 0 1 0 20 12" /></svg><span className="s3-sr-only">Turn right</span>
          </button>
          <button type="button" className={styles.tool} onClick={() => orbit.current?.zoom(1 / 1.2)}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 12h12" /></svg><span className="s3-sr-only">Zoom out</span>
          </button>
          <button type="button" className={styles.tool} onClick={() => orbit.current?.zoom(1.2)}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 12h12M12 6v12" /></svg><span className="s3-sr-only">Zoom in</span>
          </button>
          <button type="button" className={styles.tool} onClick={() => { orbit.current?.reset(); setAz(0); }}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="1.5" /></svg><span className="s3-sr-only">Reset view</span>
          </button>
          <button type="button" className={styles.tool} aria-pressed={anim.playing} onClick={() => player.current?.toggle()}>
            {anim.playing
              ? <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 6v12M15 6v12" /></svg>
              : <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.500v13l10-6.500z" /></svg>}
            <span className={styles.toolText}>Spin</span>
          </button>
        </div>
      ) : (
        <div className={styles.cta}>
          {webgl ? (
            <button ref={interact} type="button" className={styles.interact} onClick={open}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3 4 7.500v9L12 21l8-4.500v-9z" /><path d="M4 7.500 12 12l8-4.500M12 12v9" /></svg>
              Interact in 3D
              <span className={styles.interactSize}>{sizeLabel}</span>
            </button>
          ) : <span className={styles.ctaSpacer} aria-hidden="true" />}
          <a className={styles.download} href={GLB} download="orbit-token.glb">
            Download model (GLB{variant?.bytes ? `, ${sizeLabel}` : ''})
          </a>
        </div>
      )}
      <p className={styles.viewerHint} aria-live="polite">
        {note || (active
          ? 'Drag sideways to turn the token (vertical swipes still scroll the feed). With the view focused: arrow keys turn, + and − zoom, 0 resets.'
          : `Shown as a photo until you ask for 3D${variant?.triangles ? ` — ${formatCount(variant.triangles)} triangles, nothing loads before you tap` : ''}.`)}
      </p>
      {reduced && active ? <p className={styles.viewerHint}>Reduced motion: the token only spins when you press Spin.</p> : null}
    </div>
  );
}
