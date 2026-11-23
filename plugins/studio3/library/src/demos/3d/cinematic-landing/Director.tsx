'use client';
/**
 * The scene and its camera director. Three phases share one camera:
 *  1. intro    — a choreographed arc on load (Catmull-Rom path, eased), interrupted by Skip or by scrolling;
 *  2. follow   — the camera damps towards the pose for the current scroll progress (beats held, eased between);
 *  3. reduced  — no intro and no easing: the camera cuts to the pose of the beat in view.
 * Lighting "ambience" (a slow key-light sweep and the status ring's breathing glow) runs only when allowed.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { CatmullRomCurve3, MathUtils, Vector3, type Mesh, type MeshStandardMaterial, type PerspectiveCamera } from 'three';
import {
  AnimationPlayer, LightingRig, Model, ModelBoundary, PartController, lightingPresets,
  type AnimationPlayerHandle, type LightingRigHandle, type LoadedModel, type PartControllerCore,
} from '../../../three';

type V3 = [number, number, number];
interface Pose { position: V3; target: V3; fov: number }

/** One pose per beat, for landscape and portrait framings (portrait keeps the subject in the upper half). */
export const BEAT_POSES: { wide: Pose; tall: Pose }[] = [
  { wide: { position: [2.9, 1.7, 5.3], target: [-0.75, 0.68, 0], fov: 30 }, tall: { position: [2.6, 2.2, 6.6], target: [0, 0.2, 0], fov: 34 } },
  { wide: { position: [-1.25, 0.95, 3.35], target: [0.5, 0.6, 0.1], fov: 30 }, tall: { position: [-0.9, 1.2, 4.6], target: [0.1, 0.25, 0.1], fov: 34 } },
  { wide: { position: [1.25, 3.1, 1.55], target: [-0.05, 1.12, -0.05], fov: 32 }, tall: { position: [0.95, 3.6, 2.2], target: [0.3, 0.8, 0], fov: 36 } },
];
const INTRO_SECONDS = 5.2;
const INTRO_PATH: V3[] = [[-4.6, 0.3, 3.6], [-2.6, 1.1, 5.8], [0.4, 2.4, 6.4]];
const INTRO_TARGET_FROM: V3 = [0, 0.55, 0];
const KEY = lightingPresets['product-contrast'].key;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const smooth = (t: number) => t * t * (3 - 2 * t);

export interface DirectorProps {
  /** Scroll progress through the pinned section, 0..1 (written by the page, read every frame). */
  progress: MutableRefObject<number>;
  /** Set by the scene so the page can request a frame (render-on-demand when ambience is off). */
  invalidateRef: MutableRefObject<(() => void) | null>;
  skip: number;
  playIntro: boolean;
  ambience: boolean;
  reduced: boolean;
  onIntroDone: () => void;
  onLoaded: () => void;
  onError: (e: Error) => void;
  variantUrl: string;
}

function damp3(cur: Vector3, goal: Vector3, vel: Vector3, smoothTime: number, dt: number) {
  const omega = 2 / smoothTime, x = omega * dt, k = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  for (const a of ['x', 'y', 'z'] as const) {
    const change = cur[a] - goal[a], temp = (vel[a] + omega * change) * dt;
    vel[a] = (vel[a] - omega * temp) * k;
    cur[a] = goal[a] + (change + temp) * k;
  }
}

export function Director({ progress, invalidateRef, skip, playIntro, ambience, reduced, onIntroDone, onLoaded, onError, variantUrl }: DirectorProps) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const lights = useRef<LightingRigHandle>(null);
  const player = useRef<AnimationPlayerHandle>(null);
  const ring = useRef<MeshStandardMaterial | null>(null);
  const curve = useMemo(() => new CatmullRomCurve3(INTRO_PATH.map((p) => new Vector3(...p)), false, 'centripetal'), []);
  const s = useRef({
    phase: (playIntro && !reduced ? 'intro' : 'follow') as 'intro' | 'follow',
    t: 0, time: 0, pos: new Vector3(), tgt: new Vector3(), vPos: new Vector3(), vTgt: new Vector3(),
    goalPos: new Vector3(), goalTgt: new Vector3(), fov: 30, placed: false,
  });
  const live = useRef({ reduced, ambience, onIntroDone });
  live.current = { reduced, ambience, onIntroDone };
  invalidateRef.current = invalidate;

  const onModel = useCallback(() => { onLoaded(); invalidate(); }, [onLoaded, invalidate]);

  const endIntro = () => {
    const st = s.current;
    if (st.phase !== 'intro') return;
    st.phase = 'follow';
    st.vPos.set(0, 0, 0); st.vTgt.set(0, 0, 0);
    live.current.onIntroDone();
  };
  // Skip: cut to the end of the intro (the pose for the current scroll position).
  useEffect(() => {
    if (!skip) return;
    const st = s.current;
    endIntro();
    st.placed = false;
    invalidate();
  }, [skip]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (reduced) { endIntro(); s.current.placed = false; } invalidate(); }, [reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ambience: the LightPulse clip (scale) + emissive breathing on the status ring, and the key sweep in useFrame.
  useEffect(() => {
    const p = player.current;
    if (!p) return;
    if (ambience && !reduced) p.play(); else p.pause();
    invalidate();
  }, [ambience, reduced, invalidate]);

  const goalFor = (p: number, aspect: number, out: { pos: Vector3; tgt: Vector3; fov: number }) => {
    const frame = aspect < 0.95 ? 'tall' : 'wide';
    const last = BEAT_POSES.length - 1;
    const x = p * last;
    let i = Math.min(last - 1, Math.floor(x)), f = x - i;
    if (live.current.reduced) { i = Math.round(x); f = 0; if (i > last - 1) { i = last - 1; f = 1; } }
    // hold each beat for the middle of its scroll range, travel in between
    const k = live.current.reduced ? f : smooth(MathUtils.clamp((f - 0.22) / 0.56, 0, 1));
    const a = BEAT_POSES[i][frame], b = BEAT_POSES[i + 1][frame];
    out.pos.set(...a.position).lerp(new Vector3(...b.position), k);
    out.tgt.set(...a.target).lerp(new Vector3(...b.target), k);
    out.fov = a.fov + (b.fov - a.fov) * k;
  };
  const goal = useMemo(() => ({ pos: new Vector3(), tgt: new Vector3(), fov: 30 }), []);

  useFrame((state, rawDt) => {
    const st = s.current;
    const dt = Math.min(rawDt, 1 / 20);
    const { reduced: still, ambience: amb } = live.current;
    const aspect = state.size.width / Math.max(1, state.size.height);
    goalFor(progress.current, aspect, goal);
    let busy = false;

    if (st.phase === 'intro') {
      if (progress.current > 0.015) endIntro();
      else {
        st.t = Math.min(1, st.t + dt / INTRO_SECONDS);
        const e = ease(st.t);
        // the path ends exactly on the first beat's pose
        const end = goal.pos;
        const p = e < 0.82 ? curve.getPoint(e / 0.82) : curve.getPoint(1).lerp(end, smooth((e - 0.82) / 0.18));
        st.pos.copy(p);
        st.tgt.set(...INTRO_TARGET_FROM).lerp(goal.tgt, smooth(Math.min(1, e * 1.15)));
        st.fov = 26 + (goal.fov - 26) * e;
        st.placed = true;
        busy = true;
        if (st.t >= 1) endIntro();
      }
    }
    if (st.phase === 'follow') {
      if (still || !st.placed) { st.pos.copy(goal.pos); st.tgt.copy(goal.tgt); st.fov = goal.fov; st.vPos.set(0, 0, 0); st.vTgt.set(0, 0, 0); st.placed = true; }
      else {
        damp3(st.pos, goal.pos, st.vPos, 0.65, dt);
        damp3(st.tgt, goal.tgt, st.vTgt, 0.65, dt);
        st.fov += (goal.fov - st.fov) * Math.min(1, dt * 4);
        busy = st.pos.distanceToSquared(goal.pos) > 1e-7 || st.tgt.distanceToSquared(goal.tgt) > 1e-7 || Math.abs(goal.fov - st.fov) > 1e-3;
      }
    }
    camera.position.copy(st.pos);
    camera.lookAt(st.tgt);
    if (Math.abs(camera.fov - st.fov) > 1e-4) { camera.fov = st.fov; camera.updateProjectionMatrix(); }

    // Lighting: intro fade-up, then a slow key sweep and the ring's breathing (only with ambience on).
    const key = lights.current?.key;
    const animated = amb && !still;
    if (animated) st.time += dt;
    const fade = st.phase === 'intro' ? smooth(Math.min(1, st.t * 2.2)) : 1;
    if (key) {
      const sweep = animated ? Math.sin(st.time * 0.23) * 0.55 : 0;
      const r = Math.hypot(KEY.position[0], KEY.position[2]), a0 = Math.atan2(KEY.position[2], KEY.position[0]);
      key.position.set(Math.cos(a0 + sweep) * r, KEY.position[1], Math.sin(a0 + sweep) * r);
      key.intensity = KEY.intensity * fade;
    }
    if (ring.current) ring.current.emissiveIntensity = animated ? 1.25 + 0.95 * (0.5 + 0.5 * Math.sin(st.time * 2.2)) : 1.7;
    if (busy && state.frameloop === 'demand') invalidate();
  });

  const onParts = useCallback((_: unknown, core: PartControllerCore) => {
    let mat: MeshStandardMaterial | null = null;
    core.root.getObjectByName('StatusLight')?.traverse((o) => { if ((o as Mesh).isMesh && !mat) mat = (o as Mesh).material as MeshStandardMaterial; });
    ring.current = mat;
    invalidate();
  }, [invalidate]);
  // The ring material is a PartController clone (the cached original is never touched); emissive starts at 1.7.
  const overrides = useMemo(() => ({ 'material:LightEmissive': { emissiveIntensity: 1.7 } }) as const, []);

  return (
    <>
      <LightingRig ref={lights} preset="product-contrast" shadowRadius={1.6} shadowOpacity={0.5} />
      {/* a flat matte stage disc: no rim to catch the strip lights behind the copy */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.001} receiveShadow>
        <circleGeometry args={[2.6, 72]} />
        <meshStandardMaterial color="#12110f" roughness={0.85} metalness={0} />
      </mesh>
      <ModelBoundary resetKey={variantUrl} onError={onError}>
        <Suspense fallback={null}>
          <ModelRig url={variantUrl} onModel={onModel} onParts={onParts} overrides={overrides} player={player} ambient={ambience && !reduced} onError={onError} />
        </Suspense>
      </ModelBoundary>
    </>
  );
}

/** The speaker, its material controller (clones the ring material) and the LightPulse clip. */
function ModelRig({ url, onModel, onParts, overrides, player, ambient, onError }: {
  url: string; onModel: (m: LoadedModel) => void; onError: (e: Error) => void; onParts: (p: unknown, c: PartControllerCore) => void;
  overrides: Readonly<Record<string, { emissiveIntensity: number }>>; player: MutableRefObject<AnimationPlayerHandle | null>; ambient: boolean;
}) {
  const [model, setModel] = useState<LoadedModel | null>(null);
  return (
    <>
      <Model src={url} scale={10} castShadow onLoaded={(m) => { setModel(m); onModel(m); }} onError={onError} />
      <PartController root={model?.scene ?? null} overrides={overrides} onReady={onParts} />
      <AnimationPlayer ref={player} root={model?.scene ?? null} clips={model?.animations ?? []} clip="LightPulse" loop autoPlay={ambient} />
    </>
  );
}
