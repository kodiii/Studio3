'use client';
/**
 * The configurator's studio, inside the canvas:
 *  - StudioLights: a soft-box studio (direct lights + generated environment) that turns with the camera, like a
 *    turntable under fixed lights, so highlights glide over the finish as you orbit and the page's light (upper
 *    right, shadows falling lower left) is the scene's light from every view. Neutral tone mapping keeps the
 *    swatches true.
 *  - Turntable: real inertia. OrbitInspect follows the hand 1:1 (no damping lag); on release the measured angular
 *    velocity carries on and eases out with friction. ←/→ give the same push. At rest, after a few idle seconds, the
 *    view sways gently (and the status ring breathes) until anything touches it; pausable, off under reduced motion.
 *  - GroundShadow: a contact shadow rendered from the real geometry (depth from below, blurred twice: a tight
 *    contact layer and a wide soft one). It re-renders only when the geometry moves (load, explode, strap).
 *  - MaterialSweep: an option change is laid down by a lit seam that crosses the speaker; ahead of it the old finish,
 *    behind it the new one (colour and roughness), patched into the PartController's material clones.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type MutableRefObject, type RefObject } from 'react';
import {
  Box3, Color, Mesh, MeshDepthMaterial, NeutralToneMapping, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Sphere,
  UniformsUtils, Vector3, WebGLRenderTarget, type Group, type MeshStandardMaterial, type Object3D,
} from 'three';
import { HorizontalBlurShader } from 'three/examples/jsm/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/examples/jsm/shaders/VerticalBlurShader.js';
import { duration, sec } from '../../../motion';
import { LightingRig, useQuality, type CameraRigHandle, type LightingPreset } from '../../../three';

/** Authored for a camera straight in front; the whole rig turns with the camera. Key upper right, fill left, rim behind. */
export const STUDIO: LightingPreset = {
  label: 'Configurator studio', description: 'Soft key upper right, cool fill left, strip rim behind, warm floor bounce.', exposure: 1,
  ambient: { color: '#ffffff', intensity: 0.1 },
  key: { color: '#fff3e4', intensity: 2.5, position: [5.2, 6.6, 4.6] },
  fill: { color: '#e2eaff', intensity: 0.6, position: [-6.2, 2.4, 3.6] },
  rim: { color: '#ffffff', intensity: 1.8, position: [-3.4, 4.2, -6.4] },
  env: { room: '#3d3a36', intensity: 0.85, panels: [
    { color: '#fff4e8', intensity: 9, position: [5.4, 6, 4.8], size: [4.2, 4.2] },
    { color: '#ffffff', intensity: 4, position: [0, 7.5, 0], size: [9, 6] },
    { color: '#e4ecff', intensity: 2.6, position: [-6.5, 2.4, 3.4], size: [3, 6] },
    { color: '#ffffff', intensity: 7, position: [-3.6, 3.4, -6.2], size: [1.2, 6.5] },
    { color: '#efe8dc', intensity: 1.4, position: [0, -3.2, 3.5], size: [10, 3] },
  ] },
};

type Orbit = { target: Vector3; getAzimuthalAngle(): number; rotateLeft(a: number): void; update(dt?: number): boolean; addEventListener(t: string, f: () => void): void; removeEventListener(t: string, f: () => void): void };
const asOrbit = (c: unknown): Orbit | null => (c && typeof (c as Orbit).getAzimuthalAngle === 'function' ? (c as Orbit) : null);

export function StudioLights() {
  const quality = useQuality();
  const group = useRef<Group>(null);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  useEffect(() => { const prev = gl.toneMapping; gl.toneMapping = NeutralToneMapping; return () => { gl.toneMapping = prev; }; }, [gl]);
  useEffect(() => { const prev = scene.environmentRotation.y; return () => { scene.environmentRotation.y = prev; }; }, [scene]);
  // After the rig and the controls have placed the camera (priorities -2, -1), before the frame is drawn.
  useFrame(() => {
    const t = asOrbit(controls)?.target;
    const az = Math.atan2(camera.position.x - (t?.x ?? 0), camera.position.z - (t?.z ?? 0));
    if (group.current) group.current.rotation.y = az;
    scene.environmentRotation.y = az;
  }, -0.5);
  return (
    <group ref={group}>
      <LightingRig preset={STUDIO} shadow={quality.shadows ? 'map' : 'none'} shadowRadius={1.5} shadowOpacity={0.3} />
    </group>
  );
}

/* ── Turntable: inertia, keyboard push, idle sway ──────────────────────────────────────────────────── */
export interface TurntableHandle {
  /** A push from the keyboard (or a button): +1 turns the view to the right. */
  push(dir: number): void;
  /** Something else took the camera (a preset, zoom): drop any coast and restart the idle clock. */
  touch(): void;
}
/** Friction: the coast decays with the time constant of the `slow` duration token (large thing, soft settle). */
const FRICTION_TAU = sec(duration.slow);
const SWAY = { amplitude: 0.2, period: 14, idle: 3, rampIn: 1.6 };

export const Turntable = forwardRef<TurntableHandle, { reduced: boolean; motion: boolean; rig: RefObject<CameraRigHandle | null>; onSway?: (on: boolean) => void }>(
  function Turntable({ reduced, motion, rig, onSway }, ref) {
    const controls = useThree((s) => s.controls);
    const invalidate = useThree((s) => s.invalidate);
    const s = useRef({ dragging: false, v: 0, samples: [] as { t: number; a: number }[], idle: 0, sway: 0, applied: 0, swaying: false });
    const live = useRef({ reduced, motion, onSway });
    live.current = { reduced, motion, onSway };

    useImperativeHandle(ref, () => ({
      push(dir) {
        const o = asOrbit(controls);
        const st = s.current;
        st.idle = 0; st.applied = 0;
        if (!o) return;
        rig.current?.stop();
        if (live.current.reduced) { o.rotateLeft(-dir * (Math.PI / 12)); o.update(); }
        else st.v = Math.max(-5, Math.min(5, st.v + dir * 1.7));
        invalidate();
      },
      touch() { const st = s.current; st.v = 0; st.idle = 0; st.applied = 0; },
    }), [controls, invalidate, rig]);

    useEffect(() => {
      const o = asOrbit(controls);
      if (!o) return;
      const st = s.current;
      const start = () => { st.dragging = true; st.v = 0; st.samples = []; st.idle = 0; st.applied = 0; };
      const end = () => {
        st.dragging = false;
        const now = performance.now();
        const last = st.samples[st.samples.length - 1];
        let first = last;
        for (let i = st.samples.length - 1; i >= 0; i--) { first = st.samples[i]; if (last && last.t - first.t >= 90) break; }
        const dt = last && first ? (last.t - first.t) / 1000 : 0;
        // A pointer that stopped before letting go throws nothing; a flick keeps its speed.
        st.v = last && first && now - last.t < 80 && dt > 0.01 ? Math.max(-4.5, Math.min(4.5, (last.a - first.a) / dt)) : 0;
        if (live.current.reduced) st.v = 0;
        invalidate();
      };
      o.addEventListener('start', start);
      o.addEventListener('end', end);
      return () => { o.removeEventListener('start', start); o.removeEventListener('end', end); };
    }, [controls, invalidate]);

    useFrame((_, rawDt) => {
      const o = asOrbit(controls);
      if (!o) return;
      const st = s.current;
      const dt = Math.min(rawDt, 1 / 20);
      const L = live.current;
      if (st.dragging) {
        // unwrap so a drag across ±π measures the real travel
        const a = o.getAzimuthalAngle();
        const prev = st.samples[st.samples.length - 1];
        const unwrapped = prev ? prev.a + Math.atan2(Math.sin(a - prev.a), Math.cos(a - prev.a)) : a;
        st.samples.push({ t: performance.now(), a: unwrapped });
        if (st.samples.length > 12) st.samples.shift();
        return;
      }
      let busy = false;
      if (Math.abs(st.v) > 0.02) {
        o.rotateLeft(-st.v * dt);
        o.update();
        st.v *= Math.exp(-dt / FRICTION_TAU);
        st.idle = 0;
        busy = true;
      } else st.v = 0;
      // Idle sway: a slow, eased back-and-forth around wherever the user left the view.
      const canSway = L.motion && !L.reduced && !rig.current?.moving;
      st.idle = canSway ? st.idle + dt : 0;
      const ramp = Math.min(1, Math.max(0, (st.idle - SWAY.idle) / SWAY.rampIn));
      const swaying = ramp > 0;
      if (swaying) {
        st.sway += dt;
        const k = ramp * ramp * (3 - 2 * ramp);
        const want = SWAY.amplitude * k * Math.sin((st.sway * 2 * Math.PI) / SWAY.period);
        o.rotateLeft(-(want - st.applied));
        o.update();
        st.applied = want;
        busy = true;
      } else { st.sway = 0; st.applied = 0; }
      if (swaying !== st.swaying) { st.swaying = swaying; L.onSway?.(swaying); }
      if (busy || (canSway && st.idle < SWAY.idle + SWAY.rampIn)) invalidate();
    }, -1.5);
    return null;
  },
);

/* ── Contact shadow from the geometry ──────────────────────────────────────────────────────────────── */
/** Layer the model's meshes join so the shadow camera sees them and nothing else. */
export const SHADOW_LAYER = 7;

export function GroundShadow({ root, version, explodeAmount, width = 4.8, depth = 2.8, height = 1.5, resolution = 512 }: {
  root: Object3D | null; version: string; explodeAmount: MutableRefObject<() => number>;
  width?: number; depth?: number; height?: number; resolution?: number;
}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const res = useMemo(() => {
    const w = resolution, h = Math.round((resolution * depth) / width);
    const target = () => { const t = new WebGLRenderTarget(w, h); t.texture.generateMipmaps = false; return t; };
    const raw = target(), temp = target(), tight = target(), soft = target();
    const cam = new OrthographicCamera(-width / 2, width / 2, depth / 2, -depth / 2, 0, height);
    cam.position.y = -0.002;
    cam.rotation.x = Math.PI / 2;
    cam.layers.set(SHADOW_LAYER);
    cam.updateMatrixWorld();
    // Darkness by height: whatever touches the ground is darkest, the top of the speaker barely registers.
    const depthMat = new MeshDepthMaterial();
    depthMat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace('vec4( vec3( 1.0 - fragCoordZ ), opacity );', 'vec4( vec3( 0.0 ), pow( 1.0 - fragCoordZ, 2.2 ) );');
    };
    depthMat.customProgramCacheKey = () => 'pulse-contact-depth';
    const quad = new Mesh(new PlaneGeometry(2, 2));
    const blurScene = new Scene();
    blurScene.add(quad);
    const blurCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const hBlur = new ShaderMaterial({ ...HorizontalBlurShader, uniforms: UniformsUtils.clone(HorizontalBlurShader.uniforms), depthTest: false });
    const vBlur = new ShaderMaterial({ ...VerticalBlurShader, uniforms: UniformsUtils.clone(VerticalBlurShader.uniforms), depthTest: false });
    // The display planes look down on textures rendered looking up: flip v.
    const plane = new PlaneGeometry(width, depth);
    const uv = plane.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    return { w, h, raw, temp, tight, soft, cam, depthMat, quad, blurScene, blurCam, hBlur, vBlur, plane };
  }, [width, depth, height, resolution]);
  useEffect(() => () => {
    for (const t of [res.raw, res.temp, res.tight, res.soft]) t.dispose();
    res.depthMat.dispose(); res.quad.geometry.dispose(); res.hBlur.dispose(); res.vBlur.dispose(); res.plane.dispose();
  }, [res]);

  // Join the shadow layer (the main camera keeps rendering layer 0 as before).
  useEffect(() => {
    if (!root) return;
    root.traverse((o) => { if ((o as Mesh).isMesh) o.layers.enable(SHADOW_LAYER); });
    invalidate();
    return () => root.traverse((o) => o.layers.disable(SHADOW_LAYER));
  }, [root, invalidate]);

  const last = useRef({ version: '', explode: -1 });
  useFrame(() => {
    if (!root) return;
    const ex = explodeAmount.current();
    if (last.current.version === version && Math.abs(last.current.explode - ex) < 1e-4) return;
    last.current = { version, explode: ex };
    const { raw, temp, tight, soft, cam, depthMat, quad, blurScene, blurCam, hBlur, vBlur, w, h } = res;
    const prevTarget = gl.getRenderTarget();
    const prevBg = scene.background, prevOverride = scene.overrideMaterial;
    const prevClear = gl.getClearColor(new Color()), prevAlpha = gl.getClearAlpha();
    gl.setClearColor(0x000000, 0);
    scene.background = null;
    scene.overrideMaterial = depthMat;
    gl.setRenderTarget(raw); gl.clear(); gl.render(scene, cam);
    scene.overrideMaterial = prevOverride; scene.background = prevBg;
    const pass = (from: WebGLRenderTarget, to: WebGLRenderTarget, mat: ShaderMaterial, px: number) => {
      quad.material = mat;
      mat.uniforms.tDiffuse.value = from.texture;
      if (mat === hBlur) mat.uniforms.h.value = px / w; else mat.uniforms.v.value = px / h;
      gl.setRenderTarget(to); gl.clear(); gl.render(blurScene, blurCam);
    };
    pass(raw, temp, hBlur, 1.4); pass(temp, tight, vBlur, 1.4);
    pass(raw, temp, hBlur, 5); pass(temp, soft, vBlur, 5);
    pass(soft, temp, hBlur, 3); pass(temp, soft, vBlur, 3);
    gl.setRenderTarget(prevTarget);
    gl.setClearColor(prevClear, prevAlpha);
  }, -0.25);

  return (
    <group position-y={0.003} rotation-x={-Math.PI / 2}>
      <mesh geometry={res.plane} renderOrder={1} raycast={() => null}>
        <meshBasicMaterial map={res.soft.texture} transparent depthWrite={false} toneMapped={false} opacity={0.62} />
      </mesh>
      <mesh geometry={res.plane} renderOrder={2} position-z={0.001} raycast={() => null}>
        <meshBasicMaterial map={res.tight.texture} transparent depthWrite={false} toneMapped={false} opacity={0.85} />
      </mesh>
    </group>
  );
}

/* ── The finish sweep ──────────────────────────────────────────────────────────────────────────────── */
export interface SweepHandle { begin(): void }
const SWEPT = new Set(['ShellMatte', 'AccentAnodized', 'StrapFabric']);
interface Own { uOldColor: { value: Color }; uOldRough: { value: number } }

export const MaterialSweep = forwardRef<SweepHandle, { root: Object3D | null; ready: number; reduced: boolean }>(function MaterialSweep({ root, ready, reduced }, ref) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const shared = useMemo(() => ({
    uSweep: { value: 1e4 }, uSweepDir: { value: new Vector3(1, 0, 0) }, uSweepWidth: { value: 0.12 }, uSeam: { value: 0 }, uSeamColor: { value: new Color('#fff1dc') },
  }), []);
  const mats = useRef<MeshStandardMaterial[]>([]);
  const s = useRef({ active: false, t: 0, from: 0, to: 0, d: 0.7, crossfade: false });
  const live = useRef({ reduced });
  live.current = { reduced };

  // Patch the PartController clones once they exist (it calls onReady after (re)building them: `ready` bumps).
  useEffect(() => {
    if (!root) return;
    const list: MeshStandardMaterial[] = [];
    root.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      for (const m of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as MeshStandardMaterial[]) {
        if (!SWEPT.has(m.name) || list.includes(m)) continue;
        if (!m.userData.sweep) {
          const own: Own = { uOldColor: { value: m.color.clone() }, uOldRough: { value: m.roughness } };
          m.userData.sweep = own;
          m.onBeforeCompile = (shader) => {
            Object.assign(shader.uniforms, shared, own);
            shader.vertexShader = shader.vertexShader
              .replace('#include <common>', '#include <common>\nvarying vec3 vSweepWorld;')
              .replace('#include <project_vertex>', '#include <project_vertex>\nvSweepWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
            shader.fragmentShader = shader.fragmentShader
              .replace('#include <common>', '#include <common>\nvarying vec3 vSweepWorld;\nuniform float uSweep;\nuniform vec3 uSweepDir;\nuniform float uSweepWidth;\nuniform float uSeam;\nuniform vec3 uSeamColor;\nuniform vec3 uOldColor;\nuniform float uOldRough;')
              .replace('#include <color_fragment>', '#include <color_fragment>\nfloat sweepD = dot( vSweepWorld, uSweepDir ) - uSweep;\nfloat sweepAhead = smoothstep( -uSweepWidth, uSweepWidth, sweepD );\ndiffuseColor.rgb = mix( diffuseColor.rgb, uOldColor * ( diffuseColor.rgb / max( diffuse, vec3( 1e-4 ) ) ), sweepAhead );')
              .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix( roughnessFactor, uOldRough * ( roughnessFactor / max( roughness, 1e-4 ) ), sweepAhead );')
              .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uSeamColor * uSeam * ( 1.0 - smoothstep( 0.0, uSweepWidth * 1.4, abs( sweepD ) ) );');
          };
          m.customProgramCacheKey = () => 'pulse-finish-sweep-v1';
          m.needsUpdate = true;
        }
        list.push(m);
      }
    });
    mats.current = list;
    invalidate();
  }, [root, ready, shared, invalidate]);

  useImperativeHandle(ref, () => ({
    begin() {
      const list = mats.current;
      if (!list.length || !root) return;
      for (const m of list) { const own = m.userData.sweep as Own; own.uOldColor.value.copy(m.color); own.uOldRough.value = m.roughness; }
      const st = s.current;
      if (live.current.reduced) {
        // Reduced motion: a short, even cross-fade instead of a travelling seam.
        shared.uSweepWidth.value = 1e4; shared.uSeam.value = 0;
        Object.assign(st, { active: true, t: 0, from: -1e4, to: 1e4, d: sec(duration.fast), crossfade: true });
      } else {
        // Across the screen, rising slightly: the camera's right vector tipped towards its up vector.
        const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
        const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
        const dir = right.addScaledVector(up, 0.45).normalize();
        shared.uSweepDir.value.copy(dir);
        // Travel across the body, not the empty corners of its box: the bounding sphere, projected, slightly tightened.
        const sphere = new Box3().setFromObject(root).getBoundingSphere(new Sphere());
        const mid = sphere.center.dot(dir), reach = sphere.radius * 0.86;
        shared.uSweepWidth.value = 0.12;
        Object.assign(st, { active: true, t: 0, from: mid - reach, to: mid + reach, d: sec(duration.cinematic), crossfade: false });
      }
      shared.uSweep.value = st.from;
      invalidate();
    },
  }), [root, camera, shared, invalidate]);

  useFrame((_, rawDt) => {
    const st = s.current;
    if (!st.active) return;
    st.t = Math.min(1, st.t + Math.min(rawDt, 1 / 20) / st.d);
    const e = st.t < 0.5 ? 4 * st.t ** 3 : 1 - (-2 * st.t + 2) ** 3 / 2;
    shared.uSweep.value = st.from + (st.to - st.from) * (st.crossfade ? st.t : e);
    shared.uSeam.value = st.crossfade ? 0 : 1.1 * Math.sin(Math.PI * Math.min(1, st.t * 1.15));
    if (st.t >= 1) { st.active = false; shared.uSweep.value = 1e4; shared.uSeam.value = 0; shared.uSweepWidth.value = 0.12; }
    invalidate();
  });
  return null;
});

/** The status ring breathes while the studio's motion plays (time-driven, pausable, off under reduced motion). */
export function RingGlow({ material, motion, reduced }: { material: MutableRefObject<MeshStandardMaterial | null>; motion: boolean; reduced: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  const t = useRef(0);
  useEffect(() => { invalidate(); }, [motion, reduced, invalidate]);
  useFrame((_, dt) => {
    const m = material.current;
    if (!m) return;
    const on = motion && !reduced;
    if (on) t.current += Math.min(dt, 1 / 20);
    m.emissiveIntensity = on ? 1.05 + 0.75 * (0.5 + 0.5 * Math.sin(t.current * 2.1)) : 1.4;
    if (on) invalidate();
  });
  return null;
}
