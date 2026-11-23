'use client';
import { useFrame, useThree } from '@react-three/fiber';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Matrix4, Plane, Raycaster, ShaderMaterial, Sphere, Vector2, Vector3, type Points } from 'three';
import { useQuality } from '../../../three';
import { FORMS, buildForms } from './shapes';
import { fragmentShader, vertexShader } from './shaders';

export interface FieldHandle { pulse(): void }
export interface FieldProps {
  /** Requested particle count before the quality profile's density is applied. */
  count: number;
  /** Target form index (0 sphere, 1 torus, 2 glyph). */
  form: number;
  autoCycle: boolean;
  /** Animate (flow, morphs, pointer, pulse). False = a still frame that still follows every control. */
  animate: boolean;
  intensity: number;
  /** Flow speed; in a still frame it chooses the frozen phase of the flow instead. */
  flow: number;
  /** The field finished a hold and wants the next form (auto-cycle). */
  onAdvance: (next: number) => void;
  /** Effective particle count after quality scaling. */
  onCount?: (n: number) => void;
}

const MORPH_SECONDS = 2.4;
const HOLD_SECONDS = 5;
const PULSE_SECONDS = 1.5;

export const Field = forwardRef<FieldHandle, FieldProps>(function Field({ count, form, autoCycle, animate, intensity, flow, onAdvance, onCount }, ref) {
  const quality = useQuality();
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const effective = Math.max(600, Math.round((count * quality.density) / 100) * 100);
  const points = useRef<Points>(null);

  const geometry = useMemo(() => {
    const f = buildForms(effective);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(f.sphere, 3));
    g.setAttribute('aSphere', new BufferAttribute(f.sphere, 3));
    g.setAttribute('aTorus', new BufferAttribute(f.torus, 3));
    g.setAttribute('aGlyph', new BufferAttribute(f.glyph, 3));
    g.setAttribute('aSeed', new BufferAttribute(f.seed, 4));
    g.boundingSphere = new Sphere(new Vector3(), 3.5);
    return g;
  }, [effective]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => { onCount?.(effective); invalidate(); }, [effective, onCount, invalidate]);

  const material = useMemo(() => new ShaderMaterial({
    vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uFrom: { value: form }, uTo: { value: form }, uProgress: { value: 1 }, uIntensity: { value: intensity },
      uSize: { value: 2 }, uPixelRatio: { value: 1 }, uPointer: { value: new Vector3(0, 0, 99) }, uPointerStrength: { value: 0 },
      uPulse: { value: new Vector2(0, 0) }, uColorA: { value: new Color('#f3e7d3') }, uColorB: { value: new Color('#ff6a33') }, uAccentShare: { value: 0.14 },
    },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => material.dispose(), [material]);

  // Mutable simulation state: never React state (no per-frame re-renders).
  const sim = useRef({ from: form, to: form, progress: 1, hold: 0, time: 0, pulse: -1, pointerAt: -1e9, inside: false, strength: 0, spin: 0 });
  const live = useRef({ animate, autoCycle, onAdvance, flow });
  live.current = { animate, autoCycle, onAdvance, flow };

  useImperativeHandle(ref, () => ({ pulse() { if (live.current.animate) { sim.current.pulse = 0; invalidate(); } } }), [invalidate]);

  // A new target form: morph from whichever form the field is closest to (a cut when animation is off).
  useEffect(() => {
    const s = sim.current;
    if (form === s.to && s.progress >= 1) return;
    if (!animate) { s.from = s.to = form; s.progress = 1; }
    else if (form !== s.to) { s.from = s.progress < 0.5 ? s.from : s.to; s.to = form; s.progress = 0; }
    s.hold = 0;
    invalidate();
  }, [form, animate, invalidate]);
  useEffect(() => {
    const s = sim.current;
    if (!animate) { s.from = s.to; s.progress = 1; s.pulse = -1; s.strength = 0; }
    invalidate();
  }, [animate, invalidate]);
  useEffect(() => { material.uniforms.uIntensity.value = intensity; invalidate(); }, [intensity, material, invalidate]);
  useEffect(() => { if (!animate) { sim.current.time = flow * 6.5; } invalidate(); }, [flow, animate, invalidate]);

  // Pointer / touch presence on the canvas element (R3F keeps the last pointer position after leave).
  useEffect(() => {
    const el = gl.domElement;
    const prevTouch = el.style.touchAction;
    el.style.touchAction = 'none'; // the field reacts to touch drags; the page scrolls outside the stage
    const move = () => { sim.current.pointerAt = performance.now(); sim.current.inside = true; invalidate(); };
    const leave = () => { sim.current.inside = false; invalidate(); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerdown', move);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('pointercancel', leave);
    return () => {
      el.style.touchAction = prevTouch;
      el.removeEventListener('pointermove', move); el.removeEventListener('pointerdown', move);
      el.removeEventListener('pointerleave', leave); el.removeEventListener('pointercancel', leave);
    };
  }, [gl, invalidate]);

  const tmp = useMemo(() => ({ ray: new Raycaster(), plane: new Plane(), hit: new Vector3(), n: new Vector3(), inv: new Matrix4() }), []);

  useFrame((state, rawDt) => {
    const s = sim.current, u = material.uniforms;
    const dt = Math.min(rawDt, 1 / 20);
    const { animate: on, autoCycle: cycle, flow: speed } = live.current;
    let busy = false;
    if (on) {
      s.time += dt * (0.25 + speed * 1.15);
      s.spin += dt * 0.06;
      if (s.progress < 1) { s.progress = Math.min(1, s.progress + dt / MORPH_SECONDS); busy = true; if (s.progress >= 1) s.from = s.to; }
      else if (cycle) { s.hold += dt; if (s.hold > HOLD_SECONDS) { s.hold = 0; live.current.onAdvance((s.to + 1) % FORMS.length); } }
      if (s.pulse >= 0) { s.pulse += dt; if (s.pulse > PULSE_SECONDS) s.pulse = -1; busy = true; }
      const want = s.inside && performance.now() - s.pointerAt < 1400 ? 1 : 0;
      s.strength += (want - s.strength) * Math.min(1, dt * (want ? 6 : 2.5));
      if (Math.abs(want - s.strength) > 0.002) busy = true;
    }
    if (points.current) points.current.rotation.y = s.spin;
    // pointer → a point on the plane through the field's centre, facing the camera, in the field's local space
    if (s.strength > 0.001 && points.current) {
      tmp.ray.setFromCamera(state.pointer, state.camera);
      state.camera.getWorldDirection(tmp.n);
      tmp.plane.setFromNormalAndCoplanarPoint(tmp.n, points.current.getWorldPosition(tmp.hit));
      if (tmp.ray.ray.intersectPlane(tmp.plane, tmp.hit)) {
        points.current.updateMatrixWorld();
        (u.uPointer.value as Vector3).copy(tmp.hit).applyMatrix4(tmp.inv.copy(points.current.matrixWorld).invert());
      }
    }
    u.uTime.value = s.time;
    u.uFrom.value = s.from; u.uTo.value = s.to; u.uProgress.value = s.progress;
    u.uPointerStrength.value = s.strength;
    (u.uPulse.value as Vector2).set(Math.max(0, s.pulse), s.pulse >= 0 ? 1 - s.pulse / PULSE_SECONDS : 0);
    u.uPixelRatio.value = gl.getPixelRatio();
    u.uSize.value = 2.1 * Math.sqrt(Math.sqrt(24000 / effective));
    // In a demand loop (paused / reduced) keep drawing only while something is still settling.
    if (busy && state.frameloop === 'demand') invalidate();
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />;
});
