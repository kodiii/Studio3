/**
 * Framework-free three.js scene bootstrap for non-React projects.
 * Render-on-demand by default, ResizeObserver-driven sizing, pause when
 * offscreen/hidden, and complete teardown. Pair with a static fallback when
 * `detectCapabilities().webgl2` is false: three r163+ requires WebGL 2 (WebGL 1
 * support was removed), so a WebGL 1-only device cannot run this renderer.
 */
import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { disposeObject, disposeRenderer } from './dispose';
import type { QualityProfile } from './quality';

export interface VanillaScene {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  /** Request a single frame (render-on-demand). */
  invalidate(): void;
  /** Run a continuous loop calling `tick`; returns a stop function. Pauses automatically offscreen. */
  loop(tick: (dt: number, t: number) => void): () => void;
  dispose(): void;
}

export function createVanillaScene(container: HTMLElement, profile: QualityProfile, opts: { fov?: number; alpha?: boolean } = {}): VanillaScene {
  const renderer = new WebGLRenderer({ antialias: profile.antialias, alpha: opts.alpha ?? true, powerPreference: profile.level === 'high' ? 'high-performance' : 'default' });
  const scene = new Scene();
  const camera = new PerspectiveCamera(opts.fov ?? 35, 1, 0.1, 100);
  renderer.shadowMap.enabled = profile.shadows;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';

  let queued = 0, raf = 0, visible = true, tickFn: ((dt: number, t: number) => void) | null = null, prev = 0, elapsed = 0, dead = false;
  const render = () => { queued = 0; if (!dead) renderer.render(scene, camera); };
  const invalidate = () => { if (!queued && !tickFn && !dead) queued = requestAnimationFrame(render); };

  const resize = () => {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setPixelRatio(Math.min(profile.dpr[1], Math.max(profile.dpr[0], window.devicePixelRatio || 1)));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    tickFn ? renderer.render(scene, camera) : invalidate();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  const frame = (now: number) => {
    const dt = Math.min(0.05, prev ? (now - prev) / 1000 : 0);
    prev = now; elapsed += dt;
    tickFn?.(dt, elapsed);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  const sync = () => {
    const should = !!tickFn && visible && !document.hidden;
    if (should && !raf) { prev = 0; raf = requestAnimationFrame(frame); }
    if (!should && raf) { cancelAnimationFrame(raf); raf = 0; }
  };
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); });
  io.observe(container);
  document.addEventListener('visibilitychange', sync);
  resize();

  return {
    scene, camera, renderer, invalidate,
    loop(tick) { tickFn = tick; sync(); return () => { tickFn = null; sync(); invalidate(); }; },
    dispose() {
      dead = true; tickFn = null;
      if (raf) cancelAnimationFrame(raf);
      if (queued) cancelAnimationFrame(queued);
      ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', sync);
      disposeObject(scene);
      disposeRenderer(renderer);
    },
  };
}
