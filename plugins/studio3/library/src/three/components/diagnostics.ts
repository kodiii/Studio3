'use client';
/**
 * Diagnostics hooks for stat panels. Everything here is MEASURED on the current device:
 *  - `useCanvasDiagnostics()` polls `window.__STUDIO3_3D__` (written by StudioCanvas from `renderer.info`)
 *  - `useFrameTiming()` measures requestAnimationFrame deltas while enabled
 * Neither produces a number when nothing was measured — show "—", not a guess.
 */
import { addAfterEffect, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import type { Studio3Diagnostics } from '../StudioCanvas';

/** Snapshot of the active StudioCanvas diagnostics, refreshed every `intervalMs`. `null` until a canvas has rendered. */
export function useCanvasDiagnostics(intervalMs = 500): Studio3Diagnostics | null {
  const [snap, setSnap] = useState<Studio3Diagnostics | null>(null);
  useEffect(() => {
    let last = '';
    const read = () => {
      const d = typeof window !== 'undefined' ? window.__STUDIO3_3D__ : undefined;
      const key = d ? JSON.stringify(d) : '';
      if (key === last) return; // no re-render when nothing changed (render-on-demand scenes are mostly idle)
      last = key;
      setSnap(d ? { ...d, renderer: { ...d.renderer } } : null);
    };
    read();
    const id = setInterval(read, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return snap;
}

export interface FrameTiming {
  /** Median rAF delta in ms over the last window, or null before the first window completes. */
  medianMs: number | null;
  /** 95th percentile delta in ms. */
  p95Ms: number | null;
  samples: number;
}

/**
 * Measures browser frame pacing (rAF deltas) while `enabled`. This is the display's frame cadence as seen by the
 * page — label it "measured on this device". It is not a benchmark and says nothing about other hardware.
 */
export function useFrameTiming(enabled: boolean, windowSize = 60): FrameTiming {
  const [timing, setTiming] = useState<FrameTiming>({ medianMs: null, p95Ms: null, samples: 0 });
  const buf = useRef<number[]>([]);
  useEffect(() => {
    if (!enabled) { buf.current = []; setTiming({ medianMs: null, p95Ms: null, samples: 0 }); return; }
    let raf = 0, prev = 0;
    const tick = (now: number) => {
      if (prev && !document.hidden) {
        const dt = now - prev;
        if (dt < 1000) buf.current.push(dt);
        if (buf.current.length >= windowSize) {
          const s = buf.current.splice(0).sort((a, b) => a - b);
          setTiming({ medianMs: s[s.length >> 1], p95Ms: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))], samples: s.length });
        }
      }
      prev = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, windowSize]);
  return timing;
}

/**
 * Render inside a StudioCanvas: after every rendered frame, writes the camera position to the canvas host as
 * `data-camera="x,y,z"` (2 decimals). An observable for tests and review tools; costs nothing while the scene is idle
 * and never re-renders React.
 */
export function CameraProbe(): null {
  const get = useThree((s) => s.get);
  useEffect(() => addAfterEffect(() => {
    const { camera, gl } = get();
    const host = gl.domElement.closest<HTMLElement>('[data-studio3-canvas]');
    if (!host) return;
    const p = camera.position;
    const value = `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`;
    if (host.dataset.camera !== value) host.dataset.camera = value;
  }), [get]);
  return null;
}
