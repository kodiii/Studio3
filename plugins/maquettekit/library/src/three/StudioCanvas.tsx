'use client';
/**
 * StudioCanvas — the Maquettekit R3F canvas wrapper.
 *
 * What it adds on top of <Canvas>:
 *  - capability detection with a real fallback (no WebGL 2 — three r163+ requires it —, context lost, render error)
 *  - render-on-demand by default (`frameloop="demand"`); continuous only when asked
 *  - lazy mount when scrolled into view, automatic pause when offscreen / tab hidden
 *  - quality profiles (auto-picked, user-overridable) + frame-time adaptive DPR; with `quality="auto"` a sustained
 *    slow-frame signal steps the level down one tier at a time (never back up automatically)
 *  - an accessible name/description outside the canvas pixels: role="img" for a picture, role="group" when the
 *    scene is `interactive` (an image's children are presentational, so controls inside it would be hidden)
 *  - `window.__MAQUETTEKIT_3D__` diagnostics (real renderer.info values) for Visual Director
 * R3F disposes the renderer and scene graph on unmount; anything created
 * imperatively must be disposed by the creator (see ./dispose).
 */
import { Canvas, addAfterEffect, useFrame, useThree, type CanvasProps } from '@react-three/fiber';
import { Component, createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { detectCapabilities, type GraphicsCapabilities } from './capabilities';
import { createAdaptiveQuality, defaultQualityProfiles, pickQualityLevel, stepDownQuality, type QualityLevel, type QualityProfile } from './quality';

export interface StudioCanvasProps extends Omit<CanvasProps, 'fallback' | 'frameloop' | 'dpr' | 'children'> {
  /** Accessible name for the scene (required). */
  label: string;
  /** Longer text alternative describing what the scene shows/does. */
  description?: string;
  /** Shown when 3D cannot run (no WebGL, context lost, runtime error). Provide a static render or equivalent content. */
  fallback?: ReactNode;
  /** 'auto' picks from device capabilities, then steps down one level when adaptive DPR alone cannot hold the frame rate. */
  quality?: QualityLevel | 'auto';
  profiles?: Record<QualityLevel, QualityProfile>;
  /** 'demand' (default) renders only on invalidate(); 'always' runs a loop while visible. */
  frameloop?: 'demand' | 'always';
  /** Freeze rendering (user pause control). */
  paused?: boolean;
  /** Mount the WebGL context only once the element nears the viewport. Default true. */
  lazy?: boolean;
  /** Adapt DPR to measured frame time when frameloop is 'always'. Default true. */
  adaptive?: boolean;
  /** Force the fallback (useful for tests and "disable 3D" user controls). */
  disabled?: boolean;
  /**
   * The scene takes input (orbit, picking, a focusable canvas). The wrapper then gets role="group" named by
   * `label` instead of role="img", whose children are presentational to assistive tech. In-canvas controls that
   * make the canvas focusable (OrbitInspect with `keyboard`) switch this on by themselves. Default false.
   */
  interactive?: boolean;
  onQualityChange?: (level: QualityLevel) => void;
  /** Called with the error that made the scene fall back (render error inside the canvas tree). */
  onSceneError?: (error: Error) => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export interface MaquettekitDiagnostics {
  renderer: { calls: number; triangles: number; points: number; lines: number; geometries: number; textures: number; programs: number };
  frameloop: 'always' | 'demand' | 'never';
  quality: QualityLevel;
  dpr: number;
  frames: number;
  disposed: number;
  contextLost: number;
}

declare global {
  interface Window { __MAQUETTEKIT_3D__?: MaquettekitDiagnostics }
}

const QualityCtx = createContext<QualityProfile>(defaultQualityProfiles.medium);
/** Current quality profile; call inside a StudioCanvas tree. */
export const useQuality = (): QualityProfile => useContext(QualityCtx);

/** What in-canvas controls can ask of the enclosing StudioCanvas. */
export interface StudioCanvasHost {
  /** The scene's accessible name (the `label` prop). */
  label: string;
  /** Treat the scene as `interactive` (wrapper role="group") until the returned release function is called. */
  requestInteractive(): () => void;
}
const HostCtx = createContext<StudioCanvasHost | null>(null);
/** The enclosing StudioCanvas (null outside one). OrbitInspect uses it to name the canvas and mark the scene interactive. */
export const useStudioCanvasHost = (): StudioCanvasHost | null => useContext(HostCtx);

class Boundary extends Component<{ onError: (e: Error) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onError(error); }
  render() { return this.state.failed ? null : this.props.children; }
}

function Instrumentation({ quality, frameloop, adaptive, onContextLost, onDegrade }: { quality: QualityProfile; frameloop: 'always' | 'demand' | 'never'; adaptive: boolean; onContextLost: () => void; onDegrade?: () => void }) {
  const gl = useThree((s) => s.gl);
  const setDpr = useThree((s) => s.setDpr);
  const frames = useRef(0);
  // Kept in a ref: an inline callback must not tear down and recreate the diagnostics object on every parent render.
  const lostRef = useRef(onContextLost);
  lostRef.current = onContextLost;
  const degradeRef = useRef(onDegrade);
  degradeRef.current = onDegrade;
  // Loop mode / quality change while the renderer lives (pause, offscreen, user quality pick). They are updated in
  // place below; only the renderer going away counts as `disposed`.
  const mode = useRef({ frameloop, level: quality.level });
  mode.current = { frameloop, level: quality.level };
  const diagRef = useRef<MaquettekitDiagnostics | null>(null);

  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (e: Event) => { e.preventDefault(); if (window.__MAQUETTEKIT_3D__) window.__MAQUETTEKIT_3D__.contextLost++; lostRef.current(); };
    canvas.addEventListener('webglcontextlost', lost);
    const prev = window.__MAQUETTEKIT_3D__;
    const diag: MaquettekitDiagnostics = {
      renderer: { calls: 0, triangles: 0, points: 0, lines: 0, geometries: 0, textures: 0, programs: 0 },
      frameloop: mode.current.frameloop, quality: mode.current.level, dpr: gl.getPixelRatio(), frames: frames.current,
      disposed: prev?.disposed ?? 0, contextLost: prev?.contextLost ?? 0,
    };
    diagRef.current = diag;
    window.__MAQUETTEKIT_3D__ = diag;
    const off = addAfterEffect(() => {
      const info = gl.info;
      diag.renderer.calls = info.render.calls;
      diag.renderer.triangles = info.render.triangles;
      diag.renderer.points = info.render.points;
      diag.renderer.lines = info.render.lines;
      diag.renderer.geometries = info.memory.geometries;
      diag.renderer.textures = info.memory.textures;
      diag.renderer.programs = info.programs?.length ?? 0;
      diag.frames = ++frames.current;
      diag.dpr = gl.getPixelRatio();
    });
    return () => {
      off();
      canvas.removeEventListener('webglcontextlost', lost);
      if (diagRef.current === diag) diagRef.current = null;
      // Count every renderer teardown exactly once, whatever the mount/unmount order: a newer canvas may already have
      // registered its diagnostics (it inherited the running total), so increment whichever object is current.
      const current = window.__MAQUETTEKIT_3D__;
      if (current) current.disposed++; else diag.disposed++;
    };
  }, [gl]);
  useEffect(() => {
    const d = diagRef.current;
    if (d) { d.frameloop = frameloop; d.quality = quality.level; }
  }, [gl, frameloop, quality.level]);

  const adaptiveRef = useMemo(() => {
    const [min, max] = quality.dpr;
    const base = Math.min(max, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    return createAdaptiveQuality({
      onChange: ({ dprFactor, degrade }) => {
        setDpr(Math.max(min, base * dprFactor));
        // DPR is at its floor and frames are still slow: ask the host for a cheaper profile.
        if (degrade) degradeRef.current?.();
      },
    });
  }, [quality, setDpr]);
  useFrame((_, dt) => { if (adaptive && frameloop === 'always') adaptiveRef.sample(dt * 1000); });
  return null;
}

type Status = 'pending' | 'ready' | 'unsupported' | 'error' | 'lost';

export function StudioCanvas({
  label, description, fallback, quality = 'auto', profiles = defaultQualityProfiles, frameloop = 'demand', paused = false,
  lazy = true, adaptive = true, disabled = false, interactive = false, onQualityChange, onSceneError, className, style, children, gl, shadows, ...rest
}: StudioCanvasProps) {
  const host = useRef<HTMLDivElement>(null);
  const descId = useId();
  const [caps, setCaps] = useState<GraphicsCapabilities | null>(null);
  const [status, setStatus] = useState<Status>('pending');
  const [near, setNear] = useState(!lazy);
  const [visible, setVisible] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [degraded, setDegraded] = useState(0);
  const [claims, setClaims] = useState(0);

  useEffect(() => {
    const c = detectCapabilities(attempt > 0);
    setCaps(c);
    // three r163+ removed its WebGL 1 path: a WebGL 1-only device must get the fallback, not a renderer that throws.
    setStatus(c.webgl2 ? 'ready' : 'unsupported');
  }, [attempt]);

  useEffect(() => {
    const el = host.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setNear(true); return; }
    // Track both signals separately so the loop resumes when the tab becomes visible again.
    let intersecting = true;
    const sync = () => setVisible(intersecting && !document.hidden);
    const io = new IntersectionObserver(([e]) => { intersecting = e.isIntersecting; sync(); if (e.isIntersecting) setNear(true); }, { rootMargin: '200px' });
    io.observe(el);
    const vis = sync;
    document.addEventListener('visibilitychange', vis);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', vis); };
  }, []);

  const picked: QualityLevel = caps ? pickQualityLevel(caps) : 'medium';
  const level: QualityLevel = quality === 'auto' ? stepDownQuality(picked, degraded) : quality;
  const profile = profiles[level];
  useEffect(() => { if (caps) onQualityChange?.(level); }, [level, caps, onQualityChange]);
  // Adaptive "degrade" (DPR floor reached, still slow): one level down per signal, auto mode only, never back up.
  const onDegrade = useCallback(() => {
    if (quality === 'auto') setDegraded((n) => (stepDownQuality(picked, n) === 'low' ? n : n + 1));
  }, [quality, picked]);

  const hostApi = useMemo<StudioCanvasHost>(() => ({
    label,
    requestInteractive: () => {
      let held = true;
      setClaims((n) => n + 1);
      return () => { if (held) { held = false; setClaims((n) => n - 1); } };
    },
  }), [label]);
  const role = interactive || claims > 0 ? 'group' : 'img';

  const loop: 'always' | 'demand' | 'never' = paused || !visible ? 'never' : frameloop;
  const showFallback = disabled || status === 'unsupported' || status === 'error' || status === 'lost';
  const reason = disabled ? '3D is turned off.' : status === 'unsupported' ? 'This device or browser cannot display interactive 3D: WebGL 2 is required.'
    : status === 'lost' ? 'The graphics context was lost.' : status === 'error' ? 'The 3D scene failed to load.' : '';

  return (
    <div
      ref={host}
      className={className}
      data-maquettekit-canvas=""
      data-status={disabled ? 'disabled' : status}
      data-quality={level}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 120, ...style }}
    >
      {description ? <p id={descId} style={srOnly}>{description}</p> : null}
      {showFallback ? (
        <div data-maquettekit-fallback="" role="group" aria-label={label} aria-describedby={description ? descId : undefined} style={fallbackStyle}>
          {fallback ?? <p style={{ margin: 0, padding: 16, textAlign: 'center' }}>{label}</p>}
          <p style={fallbackNote} role="status">
            {reason}{' '}
            {(status === 'lost' || status === 'error') && !disabled ? (
              <button type="button" onClick={() => { setStatus('pending'); setAttempt((a) => a + 1); }} style={retryStyle}>Try again</button>
            ) : null}
          </p>
        </div>
      ) : status === 'ready' && near ? (
        <Boundary key={attempt} onError={(e) => { setStatus('error'); onSceneError?.(e); }}>
          <QualityCtx.Provider value={profile}>
            <Canvas
              role={role}
              aria-label={label}
              aria-describedby={description ? descId : undefined}
              frameloop={loop}
              dpr={profile.dpr}
              shadows={shadows ?? profile.shadows}
              gl={gl ?? { antialias: profile.antialias, powerPreference: level === 'high' ? 'high-performance' : 'default', alpha: true }}
              {...rest}
            >
              <QualityCtx.Provider value={profile}>
                <HostCtx.Provider value={hostApi}>
                  <Instrumentation quality={profile} frameloop={loop} adaptive={adaptive} onContextLost={() => setStatus('lost')} onDegrade={onDegrade} />
                  {children}
                </HostCtx.Provider>
              </QualityCtx.Provider>
            </Canvas>
          </QualityCtx.Provider>
        </Boundary>
      ) : (
        <div aria-hidden="true" data-maquettekit-placeholder="" style={{ position: 'absolute', inset: 0 }} />
      )}
    </div>
  );
}

const srOnly: CSSProperties = { position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 };
const fallbackStyle: CSSProperties = { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden' };
// Secondary text uses the muted ink token (never opacity, which drops contrast below the guaranteed level).
const fallbackNote: CSSProperties = { margin: 0, padding: '0 16px 12px', fontSize: 13, color: 'var(--mk-ink-muted, #5c5a52)', textAlign: 'center' };
const retryStyle: CSSProperties = { font: 'inherit', textDecoration: 'underline', background: 'none', border: 0, padding: 4, color: 'inherit', cursor: 'pointer' };
