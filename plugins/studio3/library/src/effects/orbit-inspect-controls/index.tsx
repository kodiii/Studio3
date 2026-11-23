'use client';
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useStudioMotion } from '../../motion';
import { StudioCanvas, type OrbitInspectHandle } from '../../three';
import type { EffectProps } from '../../types';
import { MaquetteDrawing } from './fallback';
import { Scene, type LimitPreset, type ViewInfo } from './scene';
import styles from './styles.module.css';

type Params = { damping: number; step: number; limits: LimitPreset; autoRotate: boolean; accent: string };

const ZOOM_STEP = 1.18;
const describe = (v: ViewInfo) => `Viewing from ${Math.round(v.azimuth)}°, ${Math.round(v.elevation)}° above the ground, zoom ${v.zoom.toFixed(1)}×.`;

/** Mount/unmount signal from inside the canvas: false whenever StudioCanvas is showing its fallback. */
function Ready({ onChange }: { onChange: (ready: boolean) => void }) {
  useEffect(() => { onChange(true); return () => onChange(false); }, [onChange]);
  return null;
}

const Icon = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">{children}</svg>
);

export default function OrbitInspectControls({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const hintId = useId();
  const viewer = useRef<HTMLDivElement>(null);
  const handle = useRef<OrbitInspectHandle | null>(null);
  const readout = useRef<HTMLParagraphElement>(null);
  const last = useRef<ViewInfo | null>(null);
  const timer = useRef(0);
  const [ready, setReady] = useState(false);
  const [announce, setAnnounce] = useState('');
  const step = (params.step * Math.PI) / 180;

  const onView = useCallback((v: ViewInfo) => {
    last.current = v;
    if (readout.current) readout.current.textContent = `${String(Math.round(v.azimuth)).padStart(3, '0')}°  ·  ${Math.round(v.elevation)}° up  ·  ${v.zoom.toFixed(1)}×`;
  }, []);
  // Screen readers hear the resulting view once a move has settled, never per frame.
  const settle = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { if (last.current) setAnnounce(describe(last.current)); }, reduced ? 50 : 450);
  }, [reduced]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const act = useCallback((fn: (h: OrbitInspectHandle) => void) => {
    const h = handle.current;
    if (!h) return;
    fn(h);
    settle();
  }, [settle]);

  // Wheel: zoom only while the viewer has focus, or for ctrl/⌘ + wheel (how trackpad pinch arrives) while hovering.
  // Otherwise the event is left alone and the page scrolls past the canvas.
  useEffect(() => {
    const el = viewer.current;
    if (!el || !ready) return;
    const onWheel = (e: WheelEvent) => {
      const focused = el.contains(document.activeElement);
      if (!(focused || e.ctrlKey || e.metaKey) || !handle.current) return;
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      handle.current.zoom(Math.pow(0.95, dy * (e.ctrlKey ? 0.04 : 0.01)));
      settle();
    };
    el.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => el.removeEventListener('wheel', onWheel, { capture: true });
  }, [ready, settle]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.altKey || e.ctrlKey || e.metaKey) return;
    const map: Record<string, (h: OrbitInspectHandle) => void> = {
      ArrowLeft: (h) => h.rotate(step), ArrowRight: (h) => h.rotate(-step),
      ArrowUp: (h) => h.rotate(0, step / 2), ArrowDown: (h) => h.rotate(0, -step / 2),
      '+': (h) => h.zoom(ZOOM_STEP), '=': (h) => h.zoom(ZOOM_STEP), '-': (h) => h.zoom(1 / ZOOM_STEP), _: (h) => h.zoom(1 / ZOOM_STEP),
      0: (h) => h.reset(), Home: (h) => h.reset(),
    };
    const fn = map[e.key];
    if (!fn) return;
    e.preventDefault();
    act(fn);
  };

  return (
    <div className={styles.root}>
      <div
        ref={viewer}
        className={styles.viewer}
        tabIndex={ready ? 0 : undefined}
        role={ready ? 'application' : undefined}
        aria-roledescription={ready ? '3D viewer' : undefined}
        aria-label={ready ? 'Pavilion maquette' : undefined}
        aria-describedby={ready ? hintId : undefined}
        aria-keyshortcuts={ready ? 'ArrowLeft ArrowRight ArrowUp ArrowDown + - 0' : undefined}
        onKeyDown={onKeyDown}
      >
        <StudioCanvas
          label="Pavilion maquette, sample model"
          description="A 1:50 architectural model on a grey board plinth: a white cantilevered roof on four slender steel columns and a basswood core, a raised podium with steps, a glazed back wall, three foam trees and two coloured scale figures. Drag, the arrow keys or the toolbar orbit the camera around it."
          camera={{ fov: 30, near: 0.1, far: 120, position: [6, 5, 8] }}
          fallback={<MaquetteDrawing accent={params.accent} />}
        >
          <Ready onChange={setReady} />
          <Scene
            ref={handle}
            accent={params.accent}
            damping={params.damping}
            step={params.step}
            limits={params.limits}
            autoRotate={params.autoRotate}
            onView={onView}
            onSettle={settle}
          />
        </StudioCanvas>
        <p className={styles.tag} aria-hidden="true">Pavilion study · 1:50 · sample model</p>
        {ready ? <p ref={readout} className={styles.readout} aria-hidden="true" /> : null}
      </div>

      <div className={styles.bar}>
        <div role="group" aria-label="Camera controls" className={styles.toolbar}>
          <span className={styles.group}>
            <span className={styles.legend} aria-hidden="true">Orbit</span>
            <button type="button" disabled={!ready} aria-label={`Rotate left ${params.step}°`} onClick={() => act((h) => h.rotate(step))}>
              <Icon><path d="M7 5 3.5 8.5 7 12" /><path d="M3.8 8.5H11a5 5 0 0 1 0 10H8" /></Icon>
            </button>
            <button type="button" disabled={!ready} aria-label={`Rotate right ${params.step}°`} onClick={() => act((h) => h.rotate(-step))}>
              <Icon><path d="m13 5 3.5 3.5L13 12" /><path d="M16.2 8.5H9a5 5 0 0 0 0 10h3" /></Icon>
            </button>
            <button type="button" disabled={!ready} aria-label="Tilt up" onClick={() => act((h) => h.rotate(0, step / 2))}>
              <Icon><path d="M10 16V4M5.5 8.5 10 4l4.5 4.5" /></Icon>
            </button>
            <button type="button" disabled={!ready} aria-label="Tilt down" onClick={() => act((h) => h.rotate(0, -step / 2))}>
              <Icon><path d="M10 4v12M5.5 11.5 10 16l4.5-4.5" /></Icon>
            </button>
          </span>
          <span className={styles.group}>
            <span className={styles.legend} aria-hidden="true">Zoom</span>
            <button type="button" disabled={!ready} aria-label="Zoom out" onClick={() => act((h) => h.zoom(1 / ZOOM_STEP))}>
              <Icon><path d="M4.5 10h11" /></Icon>
            </button>
            <button type="button" disabled={!ready} aria-label="Zoom in" onClick={() => act((h) => h.zoom(ZOOM_STEP))}>
              <Icon><path d="M4.5 10h11M10 4.5v11" /></Icon>
            </button>
          </span>
          <button type="button" className={styles.reset} disabled={!ready} onClick={() => act((h) => h.reset())}>
            <Icon><circle cx="10" cy="10" r="6" /><circle cx="10" cy="10" r="1.6" /></Icon>
            Reset view
          </button>
        </div>
        <p id={hintId} className={styles.hint}>
          {ready
            ? 'Drag to orbit (sideways on touch). Focus the viewer, then use the arrow keys, + / − or the wheel; pinch or Ctrl + wheel zooms while hovering. 0 resets.'
            : 'Interactive 3D is unavailable here, so a drawing of the model from the home view is shown instead.'}
        </p>
        <p className={styles.srOnly} aria-live="polite">{announce}</p>
      </div>
    </div>
  );
}
