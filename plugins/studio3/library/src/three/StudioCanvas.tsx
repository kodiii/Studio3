'use client';
/**
 * StudioCanvas — the Studio³ R3F canvas wrapper.
 *
 * What it adds on top of <Canvas>:
 *  - capability detection with a real fallback (no WebGL, context lost, render error)
 *  - render-on-demand by default (`frameloop="demand"`); continuous only when asked
 *  - lazy mount when scrolled into view, automatic pause when offscreen / tab hidden
 *  - quality profiles (auto-picked, user-overridable) + frame-time adaptive DPR
 *  - an accessible name/description outside the canvas pixels
 *  - `window.__STUDIO3_3D__` diagnostics (real renderer.info values) for Visual Director
 * R3F disposes the renderer and scene graph on unmount; anything created
 * imperatively must be disposed by the creator (see ./dispose).
 */
import { Canvas, addAfterEffect, useFrame, useThree, type CanvasProps } from '@react-three/fiber';
import { Component, createContext, useContext, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { detectCapabilities, type GraphicsCapabilities } from './capabilities';
import { createAdaptiveQuality, defaultQualityProfiles, pickQualityLevel, type QualityLevel, type QualityProfile } from './quality';

export interface StudioCanvasProps extends Omit<CanvasProps, 'fallback' | 'frameloop' | 'dpr' | 'children'> {
  /** Accessible name for the scene (required). */
  label: string;
  /** Longer text alternative describing what the scene shows/does. */
  description?: string;
  /** Shown when 3D cannot run (no WebGL, context lost, runtime error). Provide a static render or equivalent content. */
  fallback?: ReactNode;
  /** 'auto' picks from device capabilities. */
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
  onQualityChange?: (level: QualityLevel) => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export interface Studio3Diagnostics {
  renderer: { calls: number; triangles: number; geometries: number; textures: number; programs: number };
  frameloop: 'always' | 'demand' | 'never';
  quality: QualityLevel;
  dpr: number;
  frames: number;
  disposed: number;
  contextLost: number;
}

declare global {
  interface Window { __STUDIO3_3D__?: Studio3Diagnostics }
}

const QualityCtx = createContext<QualityProfile>(defaultQualityProfiles.medium);
/** Current quality profile; call inside a StudioCanvas tree. */
export const useQuality = (): QualityProfile => useContext(QualityCtx);

class Boundary extends Component<{ onError: (e: Error) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onError(error); }
  render() { return this.state.failed ? null : this.props.children; }
}

function Instrumentation({ quality, frameloop, adaptive, onContextLost }: { quality: QualityProfile; frameloop: 'always' | 'demand' | 'never'; adaptive: boolean; onContextLost: () => void }) {
  const gl = useThree((s) => s.gl);
  const setDpr = useThree((s) => s.setDpr);
  const frames = useRef(0);

  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (e: Event) => { e.preventDefault(); if (window.__STUDIO3_3D__) window.__STUDIO3_3D__.contextLost++; onContextLost(); };
    canvas.addEventListener('webglcontextlost', lost);
    const prev = window.__STUDIO3_3D__;
    const diag: Studio3Diagnostics = {
      renderer: { calls: 0, triangles: 0, geometries: 0, textures: 0, programs: 0 },
      frameloop, quality: quality.level, dpr: gl.getPixelRatio(), frames: 0, disposed: prev?.disposed ?? 0, contextLost: prev?.contextLost ?? 0,
    };
    window.__STUDIO3_3D__ = diag;
    const off = addAfterEffect(() => {
      const info = gl.info;
      diag.renderer.calls = info.render.calls;
      diag.renderer.triangles = info.render.triangles;
      diag.renderer.geometries = info.memory.geometries;
      diag.renderer.textures = info.memory.textures;
      diag.renderer.programs = info.programs?.length ?? 0;
      diag.frames = ++frames.current;
      diag.dpr = gl.getPixelRatio();
    });
    return () => {
      off();
      canvas.removeEventListener('webglcontextlost', lost);
      if (window.__STUDIO3_3D__ === diag) diag.disposed++;
    };
  }, [gl, frameloop, quality.level, onContextLost]);

  const adaptiveRef = useMemo(() => {
    const [min, max] = quality.dpr;
    const base = Math.min(max, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    return createAdaptiveQuality({ onChange: ({ dprFactor }) => setDpr(Math.max(min, base * dprFactor)) });
  }, [quality, setDpr]);
  useFrame((_, dt) => { if (adaptive && frameloop === 'always') adaptiveRef.sample(dt * 1000); });
  return null;
}

type Status = 'pending' | 'ready' | 'unsupported' | 'error' | 'lost';

export function StudioCanvas({
  label, description, fallback, quality = 'auto', profiles = defaultQualityProfiles, frameloop = 'demand', paused = false,
  lazy = true, adaptive = true, disabled = false, onQualityChange, className, style, children, gl, shadows, ...rest
}: StudioCanvasProps) {
  const host = useRef<HTMLDivElement>(null);
  const descId = useId();
  const [caps, setCaps] = useState<GraphicsCapabilities | null>(null);
  const [status, setStatus] = useState<Status>('pending');
  const [near, setNear] = useState(!lazy);
  const [visible, setVisible] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const c = detectCapabilities(attempt > 0);
    setCaps(c);
    setStatus(c.webgl ? 'ready' : 'unsupported');
  }, [attempt]);

  useEffect(() => {
    const el = host.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setNear(true); return; }
    const io = new IntersectionObserver(([e]) => { setVisible(e.isIntersecting); if (e.isIntersecting) setNear(true); }, { rootMargin: '200px' });
    io.observe(el);
    const vis = () => setVisible((v) => v && !document.hidden);
    document.addEventListener('visibilitychange', vis);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', vis); };
  }, []);

  const level: QualityLevel = quality === 'auto' ? (caps ? pickQualityLevel(caps) : 'medium') : quality;
  const profile = profiles[level];
  useEffect(() => { if (caps) onQualityChange?.(level); }, [level, caps, onQualityChange]);

  const loop: 'always' | 'demand' | 'never' = paused || !visible ? 'never' : frameloop;
  const showFallback = disabled || status === 'unsupported' || status === 'error' || status === 'lost';
  const reason = disabled ? '3D is turned off.' : status === 'unsupported' ? 'This device or browser cannot display interactive 3D.'
    : status === 'lost' ? 'The graphics context was lost.' : status === 'error' ? 'The 3D scene failed to load.' : '';

  return (
    <div
      ref={host}
      className={className}
      data-studio3-canvas=""
      data-status={disabled ? 'disabled' : status}
      data-quality={level}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 120, ...style }}
    >
      {description ? <p id={descId} style={srOnly}>{description}</p> : null}
      {showFallback ? (
        <div data-studio3-fallback="" role="group" aria-label={label} aria-describedby={description ? descId : undefined} style={fallbackStyle}>
          {fallback ?? <p style={{ margin: 0, padding: 16, textAlign: 'center' }}>{label}</p>}
          <p style={fallbackNote} role="status">
            {reason}{' '}
            {(status === 'lost' || status === 'error') && !disabled ? (
              <button type="button" onClick={() => { setStatus('pending'); setAttempt((a) => a + 1); }} style={retryStyle}>Try again</button>
            ) : null}
          </p>
        </div>
      ) : status === 'ready' && near ? (
        <Boundary key={attempt} onError={() => setStatus('error')}>
          <QualityCtx.Provider value={profile}>
            <Canvas
              role="img"
              aria-label={label}
              aria-describedby={description ? descId : undefined}
              frameloop={loop}
              dpr={profile.dpr}
              shadows={shadows ?? profile.shadows}
              gl={gl ?? { antialias: profile.antialias, powerPreference: level === 'high' ? 'high-performance' : 'default', alpha: true }}
              {...rest}
            >
              <QualityCtx.Provider value={profile}>
                <Instrumentation quality={profile} frameloop={loop} adaptive={adaptive} onContextLost={() => setStatus('lost')} />
                {children}
              </QualityCtx.Provider>
            </Canvas>
          </QualityCtx.Provider>
        </Boundary>
      ) : (
        <div aria-hidden="true" data-studio3-placeholder="" style={{ position: 'absolute', inset: 0 }} />
      )}
    </div>
  );
}

const srOnly: CSSProperties = { position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 };
const fallbackStyle: CSSProperties = { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden' };
const fallbackNote: CSSProperties = { margin: 0, padding: '0 16px 12px', fontSize: 13, opacity: 0.8, textAlign: 'center' };
const retryStyle: CSSProperties = { font: 'inherit', textDecoration: 'underline', background: 'none', border: 0, padding: 4, color: 'inherit', cursor: 'pointer' };
