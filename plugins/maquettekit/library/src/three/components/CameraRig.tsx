'use client';
/**
 * CameraRig — named camera poses with critically-damped transitions.
 *
 *  - Transitions orbit around the (moving) target in spherical space, so "front → back" swings around the subject
 *    instead of dollying through it.
 *  - Critically damped (no overshoot), interruptible: a new `goTo()` retargets mid-flight keeping velocity; any
 *    user input on the registered controls (OrbitInspect) cancels the move.
 *  - Render-on-demand: frames are requested only while a transition is in flight; it ends (snapping to the goal) once
 *    the remaining error is below ARRIVE_EPSILON (relative to the viewing distance), not after a sub-pixel tail.
 *  - Reduced motion → every transition is a cut.
 *  - `fitToBounds()` frames an object/box for the current aspect ratio; presets are widened automatically on
 *    narrow (portrait) canvases so the subject is not cropped at phone widths.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { Box3, MathUtils, Sphere, Spherical, Vector3, type Object3D, type PerspectiveCamera } from 'three';
import { useStudioMotion } from '../../motion';
import type { Vec3 } from './OrbitInspect';

export interface CameraPose { position: Vec3; target: Vec3; fov?: number }

export interface CameraRigHandle {
  /** Move to a named preset or an explicit pose. */
  goTo(pose: string | CameraPose, opts?: { immediate?: boolean }): void;
  /** Frame an object (or box) so it fits the view. `direction` is the camera offset direction; default keeps the current one. */
  fitToBounds(subject: Object3D | Box3, opts?: { padding?: number; direction?: Vec3; immediate?: boolean }): void;
  /** Current camera pose (position, orbit target, fov). */
  getPose(): CameraPose;
  /** Cancel the transition in flight, leaving the camera where it is. */
  stop(): void;
  readonly moving: boolean;
}

export interface CameraRigProps {
  presets?: Readonly<Record<string, CameraPose>>;
  /** Controlled preset: changing it starts a transition. The first value is applied as a cut. */
  preset?: string;
  /** Approximate time to arrive, seconds. */
  smoothTime?: number;
  /** Poses are authored for this aspect ratio or wider; narrower canvases pull the camera back to keep the same horizontal extent. */
  referenceAspect?: number;
  onArrive?: (preset: string | null) => void;
  /** The user grabbed the controls mid-transition. */
  onInterrupt?: () => void;
}

/** One step of a critically damped spring towards `target`; `vel` is `[velocity]` state mutated in place. */
function damp(cur: number, target: number, vel: { v: number }, smoothTime: number, dt: number): number {
  const omega = 2 / Math.max(1e-4, smoothTime);
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = cur - target;
  const temp = (vel.v + omega * change) * dt;
  vel.v = (vel.v - omega * temp) * exp;
  return target + (change + temp) * exp;
}

/**
 * Arrival tolerance relative to the scene scale: 0.1 % of the goal viewing distance for target/radius, 1e-3 rad for
 * the orbit angles, 0.1 % of the goal fov. That is about a pixel on a 1000 px-tall canvas, so the final snap is not
 * visible, and it no longer depends on world units: a 180° swing at smoothTime 0.5 stops requesting frames after
 * ≈2.6 s instead of ≈3.3 s (radius changes ≈2.1 s instead of 3.1–3.6 s) — the rest was sub-pixel motion.
 */
const ARRIVE_EPSILON = 1e-3;
/** Within `eps` of the goal and slow enough that this is the end of the approach, not a pass through the goal. */
const settled = (delta: number, vel: number, eps: number, smoothTime: number): boolean => Math.abs(delta) < eps && Math.abs(vel) * smoothTime < eps * 4;

type OrbitLike = { target: Vector3; update(): void; addEventListener(t: string, f: () => void): void; removeEventListener(t: string, f: () => void): void };
const isOrbit = (c: unknown): c is OrbitLike => !!c && typeof c === 'object' && (c as { target?: { isVector3?: boolean } }).target?.isVector3 === true;

export const CameraRig = forwardRef<CameraRigHandle, CameraRigProps>(function CameraRig({ presets, preset, smoothTime = 0.5, referenceAspect = 1.1, onArrive, onInterrupt }, ref) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown;
  const invalidate = useThree((s) => s.invalidate);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const { reduced } = useStudioMotion();
  const live = useRef({ presets, onArrive, onInterrupt, smoothTime, reduced, aspect, referenceAspect, controls });
  live.current = { presets, onArrive, onInterrupt, smoothTime, reduced, aspect, referenceAspect, controls };

  const s = useMemo(() => ({
    active: false, name: null as string | null, authored: null as CameraPose | null,
    target: new Vector3(), goalTarget: new Vector3(), sph: new Spherical(), goalSph: new Spherical(), fov: 35, goalFov: 35,
    vel: { tx: { v: 0 }, ty: { v: 0 }, tz: { v: 0 }, r: { v: 0 }, phi: { v: 0 }, theta: { v: 0 }, fov: { v: 0 } },
  }), []);

  const api = useMemo<CameraRigHandle>(() => {
    const v = new Vector3();
    const readCurrent = () => {
      const c = live.current.controls;
      if (isOrbit(c)) s.target.copy(c.target);
      else if (!s.active) camera.getWorldDirection(v), s.target.copy(camera.position).addScaledVector(v, s.sph.radius || 5);
      s.sph.setFromVector3(v.copy(camera.position).sub(s.target));
      s.fov = camera.fov;
    };
    const apply = () => {
      camera.position.setFromSpherical(s.sph).add(s.target);
      camera.lookAt(s.target);
      if (camera.isPerspectiveCamera && Math.abs(camera.fov - s.fov) > 1e-3) { camera.fov = s.fov; camera.updateProjectionMatrix(); }
      const c = live.current.controls;
      if (isOrbit(c)) c.target.copy(s.target);
      invalidate();
    };
    const start = (pose: CameraPose, name: string | null, immediate?: boolean) => {
      const { aspect: a, referenceAspect: refA } = live.current;
      readCurrent();
      s.name = name; s.authored = pose;
      s.goalTarget.set(...pose.target);
      s.goalSph.setFromVector3(v.set(...pose.position).sub(s.goalTarget));
      if (a < refA) s.goalSph.radius *= refA / a; // keep horizontal extent on narrow canvases
      // shortest way round
      s.goalSph.theta = s.sph.theta + MathUtils.euclideanModulo(s.goalSph.theta - s.sph.theta + Math.PI, Math.PI * 2) - Math.PI;
      s.goalFov = pose.fov ?? camera.fov;
      if (immediate || live.current.reduced) {
        s.target.copy(s.goalTarget); s.sph.copy(s.goalSph); s.fov = s.goalFov; s.active = false;
        for (const k of Object.values(s.vel)) k.v = 0;
        apply();
        const c = live.current.controls; if (isOrbit(c)) c.update();
        live.current.onArrive?.(name);
      } else { s.active = true; invalidate(); }
    };
    return {
      goTo(pose, opts) {
        const p = typeof pose === 'string' ? live.current.presets?.[pose] : pose;
        if (!p) { if (typeof pose === 'string') console.warn(`[CameraRig] unknown preset "${pose}"`); return; }
        start(p, typeof pose === 'string' ? pose : null, opts?.immediate);
      },
      fitToBounds(subject, opts = {}) {
        const box = (subject as Box3).isBox3 ? (subject as Box3) : new Box3().setFromObject(subject as Object3D);
        if (box.isEmpty()) return;
        const sphere = box.getBoundingSphere(new Sphere());
        const vfov = MathUtils.degToRad(camera.fov);
        const hfov = 2 * Math.atan(Math.tan(vfov / 2) * live.current.aspect);
        const dist = (sphere.radius * (opts.padding ?? 1.15)) / Math.sin(Math.min(vfov, hfov) / 2);
        readCurrent();
        const dir = opts.direction ? v.set(...opts.direction).normalize() : v.copy(camera.position).sub(s.target).normalize();
        const pos = dir.multiplyScalar(dist).add(sphere.center);
        // already aspect-correct: bypass the portrait widening by authoring at the live aspect
        const keep = live.current.referenceAspect;
        live.current.referenceAspect = 0;
        start({ position: pos.toArray() as Vec3, target: sphere.center.toArray() as Vec3 }, null, opts.immediate);
        live.current.referenceAspect = keep;
        s.authored = null;
      },
      getPose() {
        readCurrent();
        return { position: camera.position.toArray() as Vec3, target: s.target.toArray() as Vec3, fov: camera.fov };
      },
      stop() { s.active = false; for (const k of Object.values(s.vel)) k.v = 0; },
      get moving() { return s.active; },
      // internal (not part of the public type)
      ...( { _apply: apply } as object),
    };
  }, [camera, invalidate, s]);
  useImperativeHandle(ref, () => api, [api]);

  // Controlled preset: first value cuts, later values animate.
  const first = useRef(true);
  useEffect(() => {
    if (!preset) return;
    api.goTo(preset, { immediate: first.current });
    first.current = false;
  }, [preset, api]);

  // Re-frame on aspect change (rotation, container resize) so the portrait widening stays correct.
  useEffect(() => {
    if (s.authored && !first.current) api.goTo(s.name ?? s.authored, { immediate: !s.active });
  }, [aspect, api, s]);

  // User input cancels the move.
  useEffect(() => {
    if (!isOrbit(controls)) return;
    const cancel = () => { if (s.active) { api.stop(); live.current.onInterrupt?.(); } s.authored = null; };
    controls.addEventListener('start', cancel);
    return () => controls.removeEventListener('start', cancel);
  }, [controls, api, s]);

  useFrame((_, rawDt) => {
    if (!s.active) return;
    const dt = Math.min(rawDt, 1 / 20);
    const t = live.current.smoothTime;
    s.target.set(damp(s.target.x, s.goalTarget.x, s.vel.tx, t, dt), damp(s.target.y, s.goalTarget.y, s.vel.ty, t, dt), damp(s.target.z, s.goalTarget.z, s.vel.tz, t, dt));
    s.sph.radius = damp(s.sph.radius, s.goalSph.radius, s.vel.r, t, dt);
    s.sph.phi = damp(s.sph.phi, s.goalSph.phi, s.vel.phi, t, dt);
    s.sph.theta = damp(s.sph.theta, s.goalSph.theta, s.vel.theta, t, dt);
    s.fov = damp(s.fov, s.goalFov, s.vel.fov, t, dt);
    const ePos = ARRIVE_EPSILON * Math.max(1e-3, s.goalSph.radius);
    const eFov = Math.max(1e-3, ARRIVE_EPSILON * s.goalFov);
    const done = settled(s.target.x - s.goalTarget.x, s.vel.tx.v, ePos, t) && settled(s.target.y - s.goalTarget.y, s.vel.ty.v, ePos, t)
      && settled(s.target.z - s.goalTarget.z, s.vel.tz.v, ePos, t) && settled(s.sph.radius - s.goalSph.radius, s.vel.r.v, ePos, t)
      && settled(s.sph.phi - s.goalSph.phi, s.vel.phi.v, ARRIVE_EPSILON, t) && settled(s.sph.theta - s.goalSph.theta, s.vel.theta.v, ARRIVE_EPSILON, t)
      && settled(s.fov - s.goalFov, s.vel.fov.v, eFov, t);
    if (done) { s.target.copy(s.goalTarget); s.sph.copy(s.goalSph); s.fov = s.goalFov; s.active = false; for (const k of Object.values(s.vel)) k.v = 0; }
    (api as unknown as { _apply: () => void })._apply();
    if (done) { const c = live.current.controls; if (isOrbit(c)) c.update(); live.current.onArrive?.(s.name); }
  }, -2);

  return null;
});
