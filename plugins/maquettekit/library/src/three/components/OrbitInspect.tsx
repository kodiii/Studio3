'use client';
/**
 * OrbitInspect — accessible orbit / zoom / pan around a target.
 *
 * On top of three's OrbitControls it adds:
 *  - render-on-demand: frames are requested only while the camera is actually moving (incl. damping tail)
 *  - wheel zoom only when focus is within the viewer (or ctrl/⌘ is held), so the page keeps scrolling past the canvas
 *  - touch: one-finger horizontal drag orbits while vertical swipes still scroll the page (`touchScroll="pan-y"`)
 *  - a keyboard path on the canvas element (arrows rotate, +/− zoom, 0 or Home reset, Shift+arrows pan); the focusable
 *    canvas is named after the StudioCanvas label, and the StudioCanvas wrapper becomes role="group" while it is on
 *  - the same operations on an imperative handle so DOM buttons can drive the camera
 *  - optional release inertia (`inertia`): a flick keeps its measured azimuthal speed and coasts out with `friction`;
 *    `push()` gives the same coast to keys and buttons, and `onKeyDown` lets a scene remap keys before the defaults
 *  - reduced motion: damping, inertia and auto-rotate are disabled (moves become cuts)
 * It registers itself as R3F's default `controls`, which is how `CameraRig` finds the orbit target.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { duration, sec, useStudioMotion } from '../../motion';
import { useStudioCanvasHost } from '../StudioCanvas';

export type Vec3 = [number, number, number];

export interface OrbitInspectHandle {
  /** Rotate by radians: positive azimuth orbits to the left, positive polar orbits upward. */
  rotate(azimuth: number, polar?: number): void;
  /** `factor > 1` moves closer, `< 1` moves away. */
  zoom(factor: number): void;
  /** Pan in screen pixels. No-op when `enablePan` is false. */
  pan(dx: number, dy: number): void;
  /** Back to the pose saved at mount (or the last `saveHome()`). */
  reset(): void;
  /** Make the current pose the one `reset()` returns to. */
  saveHome(): void;
  /**
   * Add azimuthal speed (radians per second; positive turns the same way as ArrowRight) that coasts out with
   * `friction`, like a released flick. Clamped to `maxInertia`. Works whether or not `inertia` is on. Under reduced
   * motion the view cuts to where the coast would have come to rest.
   */
  push(velocity: number): void;
  /** Drop any coast (release inertia or `push`). */
  stop(): void;
  /** True while a release or a `push` is still coasting. */
  readonly coasting: boolean;
  readonly controls: OrbitControls | null;
}

/** Default coast decay: the speed falls by e every `slow` duration token (a large thing settling softly). */
export const ORBIT_FRICTION = 1 / sec(duration.slow);

export interface OrbitInspectProps {
  target?: Vec3;
  enabled?: boolean;
  enableZoom?: boolean;
  enablePan?: boolean;
  minDistance?: number;
  maxDistance?: number;
  /** Radians from the +Y pole. Defaults keep the camera above the ground plane. */
  minPolarAngle?: number;
  maxPolarAngle?: number;
  minAzimuthAngle?: number;
  maxAzimuthAngle?: number;
  /** OrbitControls damping factor; 0 disables. Ignored (0) under reduced motion. */
  damping?: number;
  rotateSpeed?: number;
  zoomSpeed?: number;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  /** 'focus' (default): wheel zooms only while focus is within the viewer (StudioCanvas wrapper) or ctrl/⌘ is held. */
  wheel?: 'focus' | 'always' | 'never';
  /** 'pan-y' lets vertical touch swipes scroll the page; 'none' gives the viewer every touch gesture. */
  touchScroll?: 'pan-y' | 'none';
  /**
   * Keyboard operation on the canvas element (adds tabindex=0 + role=application, named after the StudioCanvas
   * label). Inside a StudioCanvas it also marks the scene `interactive` (wrapper role="group").
   */
  keyboard?: boolean;
  /** Radians per arrow-key press. */
  keyStep?: number;
  /**
   * Called for every keydown on the focused canvas before the default keys run. Return true to take the key: the
   * default action is skipped, the event's default is prevented, and onStart/onEnd fire as for a built-in key.
   * Example — ←/→ push a coast instead of stepping:
   * `onKeyDown={(e, orbit) => { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return false; orbit.push(e.key === 'ArrowRight' ? 1.7 : -1.7); return true; }}`
   */
  onKeyDown?: (event: KeyboardEvent, orbit: OrbitInspectHandle) => boolean | void;
  /**
   * Release inertia: when a drag ends, the measured azimuthal speed carries on and decays with `friction`. Meant
   * for `damping={0}` (the view follows the hand 1:1 and the coast comes after); with damping on, damping already
   * gives the release a tail and inertia is not applied. Off under reduced motion. Default false.
   */
  inertia?: boolean;
  /** Coast decay rate, per second: the speed is multiplied by e^(−friction·dt). Higher stops sooner. Default ≈ 1.79 (`slow` token). */
  friction?: number;
  /** Speed cap for release inertia and `push`, radians per second. Default 4.5. */
  maxInertia?: number;
  /** Register as the default R3F controls (needed by CameraRig). */
  makeDefault?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
  onChange?: () => void;
}

export const OrbitInspect = forwardRef<OrbitInspectHandle, OrbitInspectProps>(function OrbitInspect({
  target, enabled = true, enableZoom = true, enablePan = false, minDistance = 0.5, maxDistance = 50,
  minPolarAngle = 0.1, maxPolarAngle = Math.PI / 2 - 0.02, minAzimuthAngle = -Infinity, maxAzimuthAngle = Infinity,
  damping = 0.1, rotateSpeed = 0.9, zoomSpeed = 0.9, autoRotate = false, autoRotateSpeed = 0.6,
  wheel = 'focus', touchScroll = 'pan-y', keyboard = true, keyStep = Math.PI / 18, makeDefault = true, onStart, onEnd, onChange, onKeyDown,
  inertia = false, friction = ORBIT_FRICTION, maxInertia = 4.5,
}, ref) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const set = useThree((s) => s.set);
  const get = useThree((s) => s.get);
  const { reduced } = useStudioMotion();
  const studio = useStudioCanvasHost();
  const controls = useMemo(() => new OrbitControls(camera), [camera]);
  const cb = useRef({ onStart, onEnd, onChange, onKeyDown });
  cb.current = { onStart, onEnd, onChange, onKeyDown };
  const spin = autoRotate && !reduced;
  // Coast state: v in rad/s (positive = ArrowRight direction, i.e. growing azimuth); samples measure a drag's speed.
  const coast = useRef({ v: 0, dragging: false, samples: [] as { t: number; a: number }[] });
  const opts = useRef({ inertia, friction, maxInertia, reduced, damping });
  opts.current = { inertia, friction, maxInertia, reduced, damping };

  const api = useMemo<OrbitInspectHandle>(() => ({
    rotate(az, polar = 0) { if (az) controls.rotateLeft(az); if (polar) controls.rotateUp(polar); controls.update(); invalidate(); },
    zoom(factor) { if (factor > 1) controls.dollyIn(1 / factor); else if (factor < 1) controls.dollyOut(factor); controls.update(); invalidate(); },
    pan(dx, dy) { if (controls.enablePan) { controls.pan(dx, dy); invalidate(); } },
    reset() { coast.current.v = 0; controls.reset(); invalidate(); },
    saveHome() { controls.saveState(); },
    push(velocity) {
      const o = opts.current, c = coast.current;
      if (!velocity || !controls.enabled) return;
      if (o.reduced) {
        // A cut to where the coast would have stopped: ∫ v·e^(−f·t) dt = v / f.
        const v = Math.max(-o.maxInertia, Math.min(o.maxInertia, velocity));
        controls.rotateLeft(-v / Math.max(o.friction, 1e-3));
        controls.update();
        invalidate();
        return;
      }
      c.v = Math.max(-o.maxInertia, Math.min(o.maxInertia, c.v + velocity));
      invalidate();
    },
    stop() { coast.current.v = 0; },
    get coasting() { return coast.current.v !== 0; },
    get controls() { return controls; },
  }), [controls, invalidate]);
  useImperativeHandle(ref, () => api, [api]);

  // Static configuration
  useEffect(() => {
    Object.assign(controls, {
      enabled, enableZoom, enablePan, minDistance, maxDistance, minPolarAngle, maxPolarAngle, minAzimuthAngle, maxAzimuthAngle,
      rotateSpeed, zoomSpeed, autoRotate: spin, autoRotateSpeed, enableDamping: damping > 0 && !reduced, dampingFactor: damping || 0.1,
    });
    controls.update();
    invalidate();
  }, [controls, enabled, enableZoom, enablePan, minDistance, maxDistance, minPolarAngle, maxPolarAngle, minAzimuthAngle, maxAzimuthAngle, rotateSpeed, zoomSpeed, spin, autoRotateSpeed, damping, reduced, invalidate]);

  const [tx, ty, tz] = target ?? [0, 0, 0];
  useEffect(() => { controls.target.set(tx, ty, tz); controls.update(); controls.saveState(); invalidate(); }, [controls, tx, ty, tz, invalidate]);

  // Connect to the DOM element, events, keyboard, wheel gating
  useEffect(() => {
    const el = gl.domElement;
    controls.connect(el);
    el.style.touchAction = touchScroll === 'pan-y' ? 'pan-y' : 'none';
    const c = coast.current;
    // Unwrapped azimuth samples while a drag is in progress (a drag across ±π still measures the real travel).
    const sample = () => {
      const a = controls.getAzimuthalAngle(), prev = c.samples[c.samples.length - 1];
      c.samples.push({ t: performance.now(), a: prev ? prev.a + Math.atan2(Math.sin(a - prev.a), Math.cos(a - prev.a)) : a });
      if (c.samples.length > 12) c.samples.shift();
    };
    const change = () => { if (c.dragging) sample(); invalidate(); cb.current.onChange?.(); };
    const start = () => { c.dragging = true; c.v = 0; c.samples = []; sample(); cb.current.onStart?.(); };
    const end = () => {
      c.dragging = false;
      const o = opts.current;
      if (o.inertia && !o.reduced && !(o.damping > 0)) {
        const now = performance.now(), last = c.samples[c.samples.length - 1];
        let first = last;
        for (let i = c.samples.length - 1; i >= 0; i--) { first = c.samples[i]; if (last.t - first.t >= 90) break; }
        const dt = last && first ? (last.t - first.t) / 1000 : 0;
        // A pointer that stopped before letting go throws nothing; a flick keeps its speed.
        c.v = last && first && now - last.t < 80 && dt > 0.01 ? Math.max(-o.maxInertia, Math.min(o.maxInertia, (last.a - first.a) / dt)) : 0;
        if (c.v) invalidate();
      }
      c.samples = [];
      cb.current.onEnd?.();
    };
    controls.addEventListener('change', change);
    controls.addEventListener('start', start);
    controls.addEventListener('end', end);

    // Wheel gate: stop the event before OrbitControls sees it (capture on the parent) unless focus is within the
    // viewer (the canvas itself, or DOM controls inside the StudioCanvas wrapper).
    const host = el.parentElement;
    const viewer = (el.closest('[data-maquettekit-canvas]') as HTMLElement | null) ?? host?.parentElement ?? el;
    const gate = (e: WheelEvent) => {
      const allowed = wheel === 'always' || (wheel === 'focus' && (viewer.contains(document.activeElement) || e.ctrlKey || e.metaKey || document.fullscreenElement?.contains(el)));
      if (!allowed) e.stopPropagation();
    };
    host?.addEventListener('wheel', gate, { capture: true, passive: true });

    const prev = { tabIndex: el.getAttribute('tabindex'), role: el.getAttribute('role'), shortcuts: el.getAttribute('aria-keyshortcuts'), label: el.getAttribute('aria-label') };
    // A focusable canvas is a control: it needs its own name, and it must not sit inside role="img" (an image's
    // children are presentational). StudioCanvas owns the wrapper role; ask it to switch to role="group".
    const name = studio?.label ?? el.parentElement?.closest('[aria-label]')?.getAttribute('aria-label') ?? '3D view';
    const ownLabel = `${name}. Arrow keys rotate, plus and minus zoom, 0 resets the view.`;
    const release = keyboard ? studio?.requestInteractive() : undefined;
    const key = (e: KeyboardEvent) => {
      if (!controls.enabled) return;
      if (cb.current.onKeyDown?.(e, api)) { e.preventDefault(); cb.current.onStart?.(); cb.current.onEnd?.(); return; }
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      let used = true;
      const pan = e.shiftKey && controls.enablePan;
      switch (e.key) {
        case 'ArrowLeft': pan ? api.pan(24, 0) : api.rotate(keyStep); break;
        case 'ArrowRight': pan ? api.pan(-24, 0) : api.rotate(-keyStep); break;
        case 'ArrowUp': pan ? api.pan(0, 24) : api.rotate(0, keyStep / 2); break;
        case 'ArrowDown': pan ? api.pan(0, -24) : api.rotate(0, -keyStep / 2); break;
        case '+': case '=': api.zoom(1.15); break;
        case '-': case '_': api.zoom(1 / 1.15); break;
        case '0': case 'Home': api.reset(); break;
        default: used = false;
      }
      if (used) { e.preventDefault(); cb.current.onStart?.(); cb.current.onEnd?.(); }
    };
    if (keyboard) {
      el.tabIndex = 0;
      el.setAttribute('role', 'application');
      el.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown + - 0');
      if (prev.label === null) el.setAttribute('aria-label', ownLabel);
      el.addEventListener('keydown', key);
    }
    return () => {
      controls.removeEventListener('change', change);
      controls.removeEventListener('start', start);
      controls.removeEventListener('end', end);
      host?.removeEventListener('wheel', gate, { capture: true });
      el.removeEventListener('keydown', key);
      if (keyboard) {
        prev.tabIndex === null ? el.removeAttribute('tabindex') : el.setAttribute('tabindex', prev.tabIndex);
        prev.role === null ? el.removeAttribute('role') : el.setAttribute('role', prev.role);
        prev.shortcuts === null ? el.removeAttribute('aria-keyshortcuts') : el.setAttribute('aria-keyshortcuts', prev.shortcuts);
        // only undo our own name (another component may have named the canvas since)
        if (prev.label === null && el.getAttribute('aria-label') === ownLabel) el.removeAttribute('aria-label');
      }
      release?.();
      controls.disconnect();
      el.style.touchAction = '';
    };
  }, [controls, gl, invalidate, wheel, touchScroll, keyboard, keyStep, api, studio]);

  useEffect(() => {
    if (!makeDefault) return;
    const old = get().controls;
    set({ controls: controls as unknown as typeof old });
    return () => set({ controls: old });
  }, [controls, makeDefault, set, get]);

  useEffect(() => () => controls.dispose(), [controls]);
  // Reduced motion (or the controls being switched off) ends any coast at once.
  useEffect(() => { if (reduced || !enabled) coast.current.v = 0; }, [reduced, enabled]);

  // Damping tail / auto-rotate: update() returns true while the camera is still moving → request the next frame.
  // A coast (release inertia, push) turns the view and decays with friction, requesting frames until it settles.
  useFrame((_, rawDt) => {
    if (!controls.enabled) return;
    const c = coast.current;
    if (c.v !== 0 && !c.dragging) {
      const dt = Math.min(rawDt, 1 / 20);
      controls.rotateLeft(-c.v * dt);
      c.v *= Math.exp(-opts.current.friction * dt);
      if (Math.abs(c.v) < 0.02) c.v = 0;
      controls.update(dt);
      invalidate();
      return;
    }
    if (controls.enableDamping || controls.autoRotate) { if (controls.update(rawDt) || controls.autoRotate) invalidate(); }
  }, -1);

  return null;
});
