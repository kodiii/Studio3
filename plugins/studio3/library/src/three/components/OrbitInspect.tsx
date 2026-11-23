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
 *  - reduced motion: damping and auto-rotate are disabled (moves become cuts)
 * It registers itself as R3F's default `controls`, which is how `CameraRig` finds the orbit target.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useStudioMotion } from '../../motion';
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
  readonly controls: OrbitControls | null;
}

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
  wheel = 'focus', touchScroll = 'pan-y', keyboard = true, keyStep = Math.PI / 18, makeDefault = true, onStart, onEnd, onChange,
}, ref) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const set = useThree((s) => s.set);
  const get = useThree((s) => s.get);
  const { reduced } = useStudioMotion();
  const studio = useStudioCanvasHost();
  const controls = useMemo(() => new OrbitControls(camera), [camera]);
  const cb = useRef({ onStart, onEnd, onChange });
  cb.current = { onStart, onEnd, onChange };
  const spin = autoRotate && !reduced;

  const api = useMemo<OrbitInspectHandle>(() => ({
    rotate(az, polar = 0) { if (az) controls.rotateLeft(az); if (polar) controls.rotateUp(polar); controls.update(); invalidate(); },
    zoom(factor) { if (factor > 1) controls.dollyIn(1 / factor); else if (factor < 1) controls.dollyOut(factor); controls.update(); invalidate(); },
    pan(dx, dy) { if (controls.enablePan) { controls.pan(dx, dy); invalidate(); } },
    reset() { controls.reset(); invalidate(); },
    saveHome() { controls.saveState(); },
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
    const change = () => { invalidate(); cb.current.onChange?.(); };
    const start = () => cb.current.onStart?.();
    const end = () => cb.current.onEnd?.();
    controls.addEventListener('change', change);
    controls.addEventListener('start', start);
    controls.addEventListener('end', end);

    // Wheel gate: stop the event before OrbitControls sees it (capture on the parent) unless focus is within the
    // viewer (the canvas itself, or DOM controls inside the StudioCanvas wrapper).
    const host = el.parentElement;
    const viewer = (el.closest('[data-studio3-canvas]') as HTMLElement | null) ?? host?.parentElement ?? el;
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
      if (!controls.enabled || e.altKey || e.ctrlKey || e.metaKey) return;
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

  // Damping tail / auto-rotate: update() returns true while the camera is still moving → request the next frame.
  useFrame((_, dt) => {
    if (!controls.enabled) return;
    if (controls.enableDamping || controls.autoRotate) { if (controls.update(dt) || controls.autoRotate) invalidate(); }
  }, -1);

  return null;
});
