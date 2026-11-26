'use client';
/**
 * The Pulse Night scene and its director. One camera, one key light, one pair of hands:
 *  - camera: an opening arc (rim light first, then the key) that ends on chapter 01; then scroll drives it between
 *    three held shots (spherical arcs, lens-shifted so the speaker sits opposite the copy); a ±3° sway follows the
 *    pointer. Reduced motion: no opening, cuts between chapters, no sway.
 *  - light: the key orbits towards the pointer (and drifts slowly on its own while the light plays); the generated
 *    environment turns with it, and the same angle is written to CSS so the headline is lit from the same side.
 *  - hands: drag (or ←/→ on the focused canvas) turns the speaker on its plinth; it keeps the release velocity and
 *    springs back to the chapter's pose. In the dial chapter the same gesture turns the dial through 30 detents.
 * Everything settles and stops requesting frames; with the light paused the canvas renders on demand.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { MathUtils, Object3D, type Group, type Mesh, type MeshStandardMaterial, type PerspectiveCamera, type PointLight, type SpotLight } from 'three';
import { duration, sec, spring as SPRING } from '../../../motion';
import {
  AnimationPlayer, LightingRig, Model, ModelBoundary, PartController, useQuality, useStudioCanvasHost,
  type AnimationPlayerHandle, type LightingRigHandle, type LoadedModel, type PartControllerCore,
} from '../../../three';
import {
  DETENT, INTRO_FROM, KEY_ORBIT, LIGHT_SWING, NIGHT, REFERENCE_ASPECT, RING_LIGHT, SHADOW_PLANE, SWAY_DEG, VOLUME,
  atRest, blendLight, buildContactShadow, buildPlinthGeometry, buildStoneTextures, damp, detented, introShot,
  releaseVelocity, shotForProgress, smooth, softLimit, stepSpring, volumeAt, type Axis, type Framing, type Light, type Shot,
} from './stage';

/** The opening move: 2.5 × the `epic` token (3.5 s), skippable, and it only starts once the speaker is on stage. */
const INTRO_S = sec(duration.epic * 2.5);
/** Radians of turn for a drag across the whole canvas; radians of dial per pixel. */
const TURN_PER_WIDTH = 2.4;
const DIAL_PER_PX = 0.0085;
/** The speaker turns freely to ±0.6 rad, then rubber-bands towards ±1 rad. */
const TURN_FREE = 0.6, TURN_LIMIT = 1.0;
/** Dial end stops: volume 0 and 30. */
const DIAL_MIN = -(VOLUME.max - VOLUME.start) * DETENT, DIAL_MAX = VOLUME.start * DETENT;
const KNOB_LIGHT = { position: [0.55, 1.16, 0.02] as const };
const SPOT_INTENSITY = 26;

export interface PointerLight { x: number; y: number; inside: boolean }
export interface DialApi { step(detents: number): void }

export interface DirectorProps {
  /** Scroll progress through the pinned section, 0..1 (written by the page, read every frame). */
  progress: MutableRefObject<number>;
  /** Set by the scene so the page can request a frame (render on demand when the light is paused). */
  invalidateRef: MutableRefObject<(() => void) | null>;
  /** Pointer position over the stage, -1..1, written by the page. */
  pointer: MutableRefObject<PointerLight>;
  /** The page's volume buttons call into the dial through this. */
  dialRef: MutableRefObject<DialApi | null>;
  /** Stacked (narrow) layout: the copy card sits at the bottom, so the speaker is framed in the top half. */
  stacked: boolean;
  skip: number;
  playIntro: boolean;
  ambience: boolean;
  reduced: boolean;
  onIntroDone: () => void;
  onLoaded: () => void;
  onError: (e: Error) => void;
  onVolume: (v: number) => void;
  /** The shared light, for CSS: the angle the copy is lit from and the speaker's x position (0..1) on screen. */
  onLight: (angleDeg: number, subjectX: number) => void;
  variantUrl: string;
}

const newShot = (): Shot => ({ az: 0, el: 0, dist: 1, fx: 0, fy: 0, fz: 0, fov: 30, sx: 0, sy: 0 });
const SHOT_KEYS = ['az', 'el', 'dist', 'fx', 'fy', 'fz', 'fov', 'sx', 'sy'] as const;
/** How close (per parameter) counts as arrived, so the demand loop can stop. */
const SHOT_EPS: Record<(typeof SHOT_KEYS)[number], number> = { az: 0.01, el: 0.01, dist: 1e-3, fx: 1e-4, fy: 1e-4, fz: 1e-4, fov: 1e-3, sx: 1e-5, sy: 1e-5 };

export function Director({
  progress, invalidateRef, pointer, dialRef, stacked, skip, playIntro, ambience, reduced,
  onIntroDone, onLoaded, onError, onVolume, onLight, variantUrl,
}: DirectorProps) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const quality = useQuality();
  const host = useStudioCanvasHost();
  const lights = useRef<LightingRigHandle>(null);
  const spot = useRef<SpotLight>(null);
  const ringLight = useRef<PointLight>(null);
  const turntable = useRef<Group>(null);
  const player = useRef<AnimationPlayerHandle>(null);
  const ring = useRef<MeshStandardMaterial | null>(null);
  const knob = useRef<{ node: Object3D; base: number } | null>(null);
  const [loaded, setLoaded] = useState(false);

  const s = useRef({
    phase: (playIntro && !reduced ? 'intro' : 'follow') as 'intro' | 'follow',
    introT: 0, time: 0, placed: false,
    cam: newShot(), goal: newShot(), from: newShot(),
    vel: Object.fromEntries(SHOT_KEYS.map((k) => [k, { v: 0 }])) as Record<(typeof SHOT_KEYS)[number], { v: number }>,
    light: { x: 0, y: 0, vx: { v: 0 }, vy: { v: 0 } },
    weights: [1, 0, 0] as [number, number, number],
    plan: { key: 1, keyAz: 0, rim: 1, env: 1, spot: 0, ring: 1 } as Light,
    yaw: { x: 0, v: 0 } as Axis,
    dial: { x: 0, v: 0 } as Axis, dialTarget: 0, volume: VOLUME.start, flash: 0, held: 0,
    drag: null as null | { id: number; mode: 'turn' | 'dial'; x0: number; start: number; samples: { t: number; x: number }[] },
    out: { angle: NaN, sx: NaN }, view: { w: 0, h: 0, sx: NaN, sy: NaN },
  });
  const live = useRef({ reduced, ambience, stacked, playIntro, loaded, onIntroDone, onVolume, onLight });
  live.current = { reduced, ambience, stacked, playIntro, loaded, onIntroDone, onVolume, onLight };
  invalidateRef.current = invalidate;

  const endIntro = useCallback((smoothHandover: boolean) => {
    const st = s.current;
    if (st.phase !== 'intro') return;
    st.phase = 'follow';
    for (const k of SHOT_KEYS) st.vel[k].v = 0;
    st.placed = smoothHandover && st.introT > 0;
    st.introT = 1;
    live.current.onIntroDone();
  }, []);
  // Skip: cut to the held shot for the current scroll position.
  useEffect(() => { if (skip) { endIntro(false); s.current.placed = false; invalidate(); } }, [skip, endIntro, invalidate]);
  useEffect(() => { if (reduced) { endIntro(false); s.current.placed = false; } invalidate(); }, [reduced, endIntro, invalidate]);
  useEffect(() => { invalidate(); }, [stacked, ambience, invalidate]);

  // The ring's breathing clip plays with the light, never under reduced motion.
  useEffect(() => {
    const p = player.current;
    if (!p) return;
    if (ambience && !reduced) p.play(); else p.pause();
    invalidate();
  }, [ambience, reduced, invalidate, loaded]);

  // The key light casts a real shadow on the plinth where the profile allows shadow maps.
  useEffect(() => {
    const key = lights.current?.key;
    if (!key) return;
    key.castShadow = quality.shadows;
    key.shadow.radius = 5;
    invalidate();
    return () => { key.castShadow = false; };
  }, [quality.shadows, invalidate]);

  // The environment turns with the key light; restore what was there before.
  useEffect(() => {
    const prev = scene.environmentRotation.y;
    return () => { scene.environmentRotation.y = prev; };
  }, [scene]);

  // The dial, for the page's volume buttons.
  const stepDial = useCallback((n: number) => {
    const st = s.current;
    st.dialTarget = MathUtils.clamp(Math.round(st.dialTarget / DETENT - n) * DETENT, DIAL_MIN, DIAL_MAX);
    if (live.current.reduced) { st.dial.x = st.dialTarget; st.dial.v = 0; }
    invalidate();
  }, [invalidate]);
  useEffect(() => {
    dialRef.current = { step: stepDial };
    return () => { dialRef.current = null; };
  }, [dialRef, stepDial]);

  // Hands: drag on the canvas turns the speaker (or the dial), ←/→ on the focused canvas do the same.
  useEffect(() => {
    const el = gl.domElement;
    const st = s.current;
    const inDial = () => Math.round(progress.current * 2) === 2;
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const mode = inDial() ? 'dial' : 'turn';
      st.drag = { id: e.pointerId, mode, x0: e.clientX, start: mode === 'dial' ? st.dial.x : st.yaw.x, samples: [] };
      if (mode === 'dial') st.dialTarget = st.dial.x;
      try { el.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
      el.dataset.dragging = '';
      invalidate();
    };
    const move = (e: PointerEvent) => {
      const d = st.drag;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x0;
      const t = performance.now();
      if (d.mode === 'turn') {
        // 1:1 with the hand, then a rubber band towards the limit (what you see is what gets thrown)
        st.yaw.x = softLimit(d.start + (dx / Math.max(1, el.clientWidth)) * TURN_PER_WIDTH, TURN_FREE, TURN_LIMIT);
        st.yaw.v = 0;
        d.samples.push({ t, x: st.yaw.x });
      } else {
        const raw = d.start - dx * DIAL_PER_PX;
        // end stops with a little give
        st.dial.x = raw > DIAL_MAX ? DIAL_MAX + softLimit(raw - DIAL_MAX, 0, DETENT * 0.6) : raw < DIAL_MIN ? DIAL_MIN + softLimit(raw - DIAL_MIN, 0, DETENT * 0.6) : raw;
        st.dial.v = 0;
        d.samples.push({ t, x: st.dial.x });
      }
      if (d.samples.length > 12) d.samples.shift();
      invalidate();
    };
    const up = (e: PointerEvent) => {
      const d = st.drag;
      if (!d || d.id !== e.pointerId) return;
      st.drag = null;
      delete el.dataset.dragging;
      const v = e.type === 'pointercancel' ? 0 : releaseVelocity(d.samples, performance.now());
      if (d.mode === 'turn') st.yaw.v = MathUtils.clamp(v, -8, 8);
      else {
        // The dial keeps a little of its spin, then drops into the nearest notch.
        st.dial.x = detented(st.dial.x);
        st.dial.v = MathUtils.clamp(v, -12, 12);
        st.dialTarget = MathUtils.clamp(Math.round((st.dial.x + st.dial.v * 0.09) / DETENT) * DETENT, DIAL_MIN, DIAL_MAX);
      }
      if (live.current.reduced) { st.yaw.x = 0; st.yaw.v = 0; st.dial.x = st.dialTarget; st.dial.v = 0; }
      invalidate();
    };
    const key = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      if (inDial()) { stepDial(dir); return; }
      if (live.current.reduced) { st.yaw.x = dir * 0.55; st.yaw.v = 0; st.held = dir; }
      else st.yaw.v = MathUtils.clamp(st.yaw.v + dir * 3.2, -6, 6);
      invalidate();
    };
    const keyUp = (e: KeyboardEvent) => {
      if (st.held && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { st.held = 0; st.yaw.x = 0; invalidate(); }
    };
    // A focusable canvas is a control: name it, describe its keys, and make the StudioCanvas wrapper a group.
    const prev = { tabIndex: el.getAttribute('tabindex'), role: el.getAttribute('role'), label: el.getAttribute('aria-label'), keys: el.getAttribute('aria-keyshortcuts') };
    el.tabIndex = 0;
    el.setAttribute('role', 'application');
    el.setAttribute('aria-label', 'Pulse speaker on its plinth. Drag sideways or press the left and right arrow keys to turn it; in the Dial chapter they turn the volume dial.');
    el.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight');
    el.style.touchAction = 'pan-y';
    const release = host?.requestInteractive();
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('keydown', key);
    el.addEventListener('keyup', keyUp);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('lostpointercapture', up);
      el.removeEventListener('keydown', key);
      el.removeEventListener('keyup', keyUp);
      prev.tabIndex === null ? el.removeAttribute('tabindex') : el.setAttribute('tabindex', prev.tabIndex);
      prev.role === null ? el.removeAttribute('role') : el.setAttribute('role', prev.role);
      prev.label === null ? el.removeAttribute('aria-label') : el.setAttribute('aria-label', prev.label);
      prev.keys === null ? el.removeAttribute('aria-keyshortcuts') : el.setAttribute('aria-keyshortcuts', prev.keys);
      el.style.touchAction = '';
      release?.();
    };
  }, [gl, host, progress, invalidate, stepDial]);

  useFrame((state, rawDt) => {
    const st = s.current;
    const L = live.current;
    const dt = Math.min(rawDt, 1 / 20);
    const { width, height } = state.size;
    const frame: Framing = L.stacked ? 'tall' : 'wide';
    const corr = Math.max(1, REFERENCE_ASPECT[frame] / Math.max(0.1, width / Math.max(1, height)));
    shotForProgress(progress.current, frame, L.reduced, st.goal, st.weights);
    st.goal.dist *= corr;
    const animated = L.ambience && !L.reduced;
    if (animated) st.time += dt;
    let busy = false;

    // ── Camera ────────────────────────────────────────────────────────────────────────────────────────
    let rimIn = 1, keyIn = 1, ringIn = 1;
    if (st.phase === 'intro') {
      if (!L.playIntro || L.reduced) endIntro(false);
      else if (progress.current > 0.015) endIntro(true);
      else {
        if (L.loaded) st.introT = Math.min(1, st.introT + dt / INTRO_S);
        Object.assign(st.from, INTRO_FROM[frame]);
        st.from.dist *= corr;
        introShot(st.introT, st.from, st.goal, st.cam);
        // The reveal: the rim draws the silhouette first, then the key comes up, then the ring.
        rimIn = smooth(st.introT / 0.35); keyIn = smooth((st.introT - 0.18) / 0.5); ringIn = smooth((st.introT - 0.55) / 0.4);
        busy = true;
        if (st.introT >= 1) endIntro(true);
      }
    }
    if (st.phase === 'follow') {
      if (L.reduced || !st.placed) {
        Object.assign(st.cam, st.goal);
        for (const k of SHOT_KEYS) st.vel[k].v = 0;
        st.placed = true;
      } else {
        for (const k of SHOT_KEYS) {
          st.cam[k] = damp(st.cam[k], st.goal[k], st.vel[k], k === 'sx' || k === 'sy' ? 0.7 : 0.62, dt);
          if (Math.abs(st.cam[k] - st.goal[k]) > SHOT_EPS[k] || Math.abs(st.vel[k].v) > SHOT_EPS[k] * 4) busy = true;
        }
      }
    }

    // ── The shared light: pointer (or the slow drift while the light plays) ─────────────────────────────
    const P = pointer.current;
    const drift = animated ? 0.62 * Math.sin(st.time * 0.21) + 0.2 * Math.sin(st.time * 0.53 + 1.3) : 0;
    const tx = L.reduced ? 0 : P.inside ? P.x : drift;
    const ty = L.reduced ? 0 : P.inside ? P.y : 0;
    st.light.x = damp(st.light.x, tx, st.light.vx, 0.38, dt);
    st.light.y = damp(st.light.y, ty, st.light.vy, 0.38, dt);
    if (Math.abs(st.light.x - tx) > 1e-3 || Math.abs(st.light.y - ty) > 1e-3 || Math.abs(st.light.vx.v) > 4e-3) busy = true;

    const c = st.cam;
    const az = MathUtils.degToRad(c.az + st.light.x * SWAY_DEG.az * (L.reduced ? 0 : 1));
    const el = MathUtils.degToRad(c.el - st.light.y * SWAY_DEG.el * (L.reduced ? 0 : 1));
    camera.position.set(c.fx + c.dist * Math.cos(el) * Math.sin(az), c.fy + c.dist * Math.sin(el), c.fz + c.dist * Math.cos(el) * Math.cos(az));
    camera.lookAt(c.fx, c.fy, c.fz);
    const v = st.view;
    if (Math.abs(camera.fov - c.fov) > 1e-4 || v.w !== width || v.h !== height || v.sx !== c.sx || v.sy !== c.sy) {
      camera.fov = c.fov;
      v.w = width; v.h = height; v.sx = c.sx; v.sy = c.sy;
      // Lens shift: slide the projection window so the speaker sits opposite the copy (no keystoning).
      camera.setViewOffset(width, height, -c.sx * width, c.sy * height, width, height);
    }

    // ── Hands: the speaker's turn and the dial ─────────────────────────────────────────────────────────
    const yaw = st.yaw;
    if (!st.drag || st.drag.mode !== 'turn') {
      if (L.reduced) { if (!st.held) { yaw.x = 0; yaw.v = 0; } }
      else if (!atRest(yaw, 0)) { stepSpring(yaw, 0, SPRING.release, dt); busy = true; } else { yaw.x = 0; yaw.v = 0; }
    }
    if (turntable.current) turntable.current.rotation.y = yaw.x;

    const dial = st.dial;
    let shown = dial.x;
    if (st.drag?.mode === 'dial') shown = detented(dial.x);
    else if (!atRest(dial, st.dialTarget, 2e-4)) { stepSpring(dial, st.dialTarget, SPRING.press, dt); shown = dial.x; busy = true; }
    else { dial.x = st.dialTarget; dial.v = 0; shown = dial.x; }
    if (knob.current) knob.current.node.rotation.y = knob.current.base + shown;
    const vol = volumeAt(shown);
    if (vol !== st.volume) { st.volume = vol; if (!L.reduced) st.flash = 0.7; L.onVolume(vol); }
    if (st.flash > 1e-3) { st.flash *= Math.exp(-dt / 0.14); busy = true; } else st.flash = 0;

    // ── Lights ─────────────────────────────────────────────────────────────────────────────────────────
    const plan = blendLight(st.weights, st.plan);
    const swing = st.light.x * LIGHT_SWING.az + plan.keyAz;
    const rig = lights.current;
    if (rig?.key) {
      const kAz = KEY_ORBIT.az + swing, kEl = KEY_ORBIT.el - st.light.y * LIGHT_SWING.el;
      rig.key.position.set(Math.sin(kAz) * Math.cos(kEl) * KEY_ORBIT.r, Math.sin(kEl) * KEY_ORBIT.r, Math.cos(kAz) * Math.cos(kEl) * KEY_ORBIT.r);
      rig.key.intensity = NIGHT.key.intensity * plan.key * keyIn;
    }
    if (rig?.rim && NIGHT.rim) rig.rim.intensity = NIGHT.rim.intensity * plan.rim * rimIn;
    if (rig?.fill && NIGHT.fill) rig.fill.intensity = NIGHT.fill.intensity * keyIn * (1 - 0.6 * st.weights[2]);
    scene.environmentRotation.y = swing;
    scene.environmentIntensity = NIGHT.env.intensity * plan.env * (0.25 + 0.75 * keyIn);
    if (spot.current) spot.current.intensity = SPOT_INTENSITY * plan.spot * keyIn;
    const breath = animated ? 0.5 + 0.5 * Math.sin(st.time * 2.2) : 0.55;
    const glow = ((1.15 + 0.95 * breath) * (0.7 + 0.6 * (st.volume / VOLUME.max)) * plan.ring + st.flash) * ringIn;
    if (ring.current) ring.current.emissiveIntensity = glow;
    if (ringLight.current) ringLight.current.intensity = 1.6 * glow * plan.spot;

    // ── The same light, for the page ───────────────────────────────────────────────────────────────────
    const lx = 0.62 + 0.8 * (swing / LIGHT_SWING.az), ly = -0.8 + 0.3 * st.light.y;
    const angle = (Math.atan2(-lx, ly) * 180) / Math.PI + 360;
    const subjectX = 0.5 + c.sx;
    if (Math.abs(angle - st.out.angle) > 0.2 || Math.abs(subjectX - st.out.sx) > 1e-3) {
      st.out.angle = angle; st.out.sx = subjectX;
      L.onLight(angle % 360, subjectX);
    }

    if (busy && state.frameloop === 'demand') invalidate();
  });

  const onModel = useCallback((m: LoadedModel) => {
    const node = m.scene.getObjectByName('Knob');
    knob.current = node ? { node, base: node.rotation.y } : null;
    setLoaded(true);
    onLoaded();
    invalidate();
  }, [onLoaded, invalidate]);
  const onParts = useCallback((_: unknown, core: PartControllerCore) => {
    let mat: MeshStandardMaterial | null = null;
    core.root.getObjectByName('StatusLight')?.traverse((o) => { if ((o as Mesh).isMesh && !mat) mat = (o as Mesh).material as MeshStandardMaterial; });
    ring.current = mat;
    invalidate();
  }, [invalidate]);
  // The ring material is a PartController clone (the cached original is never touched).
  const overrides = useMemo(() => ({ 'material:LightEmissive': { emissiveIntensity: 1.7 } }) as const, []);

  const plinth = useMemo(buildPlinthGeometry, []);
  const stone = useMemo(buildStoneTextures, []);
  const contact = useMemo(buildContactShadow, []);
  useEffect(() => () => { plinth.dispose(); stone.map.dispose(); stone.roughness.dispose(); contact.dispose(); }, [plinth, stone, contact]);
  const spotTarget = useMemo(() => new Object3D(), []);

  return (
    <>
      <fog attach="fog" args={['#14110d', 10.5, 27]} />
      <LightingRig ref={lights} preset={NIGHT} shadow="none" shadowRadius={1.7} />
      <primitive object={spotTarget} position={[0.55, 1.05, 0]} />
      <spotLight ref={spot} position={[1.9, 4.9, 2.4]} angle={0.3} penumbra={0.85} decay={2} intensity={0} color="#ffe9d4" target={spotTarget} />
      {/* The plinth: a filleted drum whose sides fade into the dark; honed-stone top that takes the key's shadow. */}
      <mesh geometry={plinth} receiveShadow>
        <meshStandardMaterial color="#2c2925" vertexColors map={stone.map} roughnessMap={stone.roughness} roughness={1} metalness={0} envMapIntensity={0.9} />
      </mesh>
      <group ref={turntable}>
        <mesh rotation-x={-Math.PI / 2} position-y={0.004} renderOrder={1} raycast={() => null}>
          <planeGeometry args={SHADOW_PLANE} />
          <meshBasicMaterial map={contact} transparent depthWrite={false} toneMapped={false} />
        </mesh>
        <pointLight ref={ringLight} position={KNOB_LIGHT.position} distance={1.8} decay={2} color={RING_LIGHT} intensity={0} />
        <ModelBoundary resetKey={variantUrl} onError={onError}>
          <Suspense fallback={null}>
            <ModelRig url={variantUrl} onModel={onModel} onParts={onParts} overrides={overrides} player={player} ambient={ambience && !reduced} onError={onError} />
          </Suspense>
        </ModelBoundary>
      </group>
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
