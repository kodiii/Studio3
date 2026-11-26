'use client';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, CatmullRomCurve3, Color, MathUtils, MeshBasicMaterial,
  OctahedronGeometry, PlaneGeometry, Raycaster, ShaderMaterial, SphereGeometry, TubeGeometry, Vector2, Vector3,
  type PerspectiveCamera,
} from 'three';
import { spring } from '../../../motion';
import { CameraRig, useQuality, type CameraPose } from '../../../three';
import { NIGHT, STOP_U } from './palette';
import { SIZE, VIEWPOINTS, WATER, cameraPath, height, marchTerrain, routePoints, type StopId } from './terrain';
import { skyFrag, skyVert, starFrag, starVert, terrainFrag, terrainVert } from './shaders';

/** The page owns scroll; the scene only reads it. Written by the page's ScrollTrigger, read every frame here. */
export interface Bridge {
  /** The camera's place on its path (0–1), with rest zones already applied. */
  u: number;
  /** Scroll-speed flare request (0–1): fast scrolling briefly brightens the aurora. Decays in the scene. */
  kick: number;
  invalidate: (() => void) | null;
  /** Scene → DOM: how strongly the sky is lit (0–1.5), for the aurora tint on the caption panels' top edges. */
  light: ((lit: number) => void) | null;
  /** Scene → DOM: the camera sway (−1…1) so the layered title moves in depth with the view. */
  sway: ((x: number, y: number) => void) | null;
}

/** Hands on the scene, written by DOM listeners on the stage (the canvas itself never takes pointer events). */
export interface Input {
  /** Pointer in stage coordinates, −1…1, y up. */
  px: number;
  py: number;
  /** A fine pointer (or a touch drag) is over the stage: the head-torch and the sway follow it. */
  over: boolean;
  /** Look-around yaw from a horizontal drag, radians, already rubber-banded at the limits. */
  drag: number;
  dragging: boolean;
  /** Yaw velocity at release (rad/s): the spring back keeps it. */
  release: number;
  /** Look buttons held: −1 (left), 0, 1 (right). */
  hold: number;
  /** One-shot yaw velocity kick (rad/s) from a Look button press. */
  impulse: number;
  /** Scene → DOM: the current look yaw, so a new drag picks the view up where the spring has it (interruptible). */
  yaw: number;
}

/** ±20° of look-around; the pointer sway is ±1.5°. */
export const LOOK_MAX = MathUtils.degToRad(20);
const SWAY = MathUtils.degToRad(1.5);
const UP = new Vector3(0, 1, 0);
const PRESETS: Record<StopId, CameraPose> = Object.fromEntries(VIEWPOINTS.map((v) => [v.id, { position: v.position, target: v.target, fov: 42 }])) as Record<StopId, CameraPose>;
const color = (hex: string) => ({ value: new Color(hex) });
const smooth = (a: number, b: number, x: number): number => { const t = MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Semi-implicit spring step with a motion token (sub-stepped so a dropped frame cannot blow it up). */
function stepSpring(s: { x: number; v: number }, target: number, cfg: { stiffness: number; damping: number; mass: number }, dt: number): void {
  const n = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    s.v += ((-cfg.stiffness * (s.x - target) - cfg.damping * s.v) / cfg.mass) * h;
    s.x += s.v * h;
  }
}

interface Mats { terrain: ShaderMaterial; sky: ShaderMaterial; stars: ShaderMaterial; route: MeshBasicMaterial; halo: MeshBasicMaterial }

/**
 * One frame loop for everything that moves: camera travel (damped toward the page's progress), the entrance push-in,
 * the look-around spring and pointer sway, the head-torch, the colour script and the aurora flare. It requests frames
 * only while something is still settling, so a paused, settled scene draws nothing.
 */
function Director({ bridge, input, mats, reduced, animate, stop }: { bridge: Bridge; input: Input; mats: Mats; reduced: boolean; animate: boolean; stop: StopId }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const path = useMemo(() => cameraPath(), []);
  const tmp = useMemo(() => ({ look: new Vector3(), dir: new Vector3(), right: new Vector3(), aim: new Vector3(), ndc: new Vector2(), ray: new Raycaster() }), []);
  const pal = useMemo(() => ({
    duskTop: new Color(NIGHT.duskTop), nightTop: new Color(NIGHT.nightTop), duskHorizon: new Color(NIGHT.duskHorizon),
    nightHorizon: new Color(NIGHT.nightHorizon), groundDusk: new Color(NIGHT.groundDusk), groundNight: new Color(NIGHT.groundNight),
  }), []);
  const st = useRef({
    u: bridge.u,
    intro: { x: reduced ? 0 : 1, v: 0 },
    yaw: { x: 0, v: 0 },
    wasDragging: false,
    swayX: 0,
    swayY: 0,
    torchK: 0,
    torch: new Vector3(0, 3, 4),
    torchSeen: false,
    flare: 0,
    lit: -1,
    swayOut: [9, 9],
  });

  useEffect(() => { bridge.invalidate = invalidate; invalidate(); return () => { bridge.invalidate = null; }; }, [bridge, invalidate]);
  useEffect(() => {
    camera.fov = aspect < 0.8 ? 62 : aspect < 1.2 ? 50 : 42;
    camera.updateProjectionMatrix();
    invalidate();
  }, [aspect, camera, invalidate]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const s = st.current;
    let busy = false;

    // ── Camera (scroll mode only: under reduced motion the three-kit CameraRig cuts between stops) ──
    if (!reduced) {
      const goal = MathUtils.clamp(bridge.u, 0, 1);
      s.u = MathUtils.damp(s.u, goal, 3.4, dt);
      if (Math.abs(goal - s.u) < 1e-4) s.u = goal; else busy = true;

      // Entrance: the camera settles in from higher and further back on a large, slow spring.
      stepSpring(s.intro, 0, spring.glide, dt);
      if (Math.abs(s.intro.x) + Math.abs(s.intro.v) > 1e-4) busy = true; else { s.intro.x = 0; s.intro.v = 0; }

      // Look-around: the drag drives the yaw directly; on release a spring carries the throw and brings it home.
      if (input.dragging) {
        s.yaw.x = input.drag;
        s.wasDragging = true;
      } else {
        if (s.wasDragging) { s.yaw.v = input.release; s.wasDragging = false; }
        if (input.impulse) { s.yaw.v += input.impulse; input.impulse = 0; }
        stepSpring(s.yaw, input.hold * LOOK_MAX * 0.85, spring.release, dt);
        // Rubber-band past the limit instead of a hard stop.
        if (Math.abs(s.yaw.x) > LOOK_MAX) s.yaw.x = Math.sign(s.yaw.x) * (LOOK_MAX + (Math.abs(s.yaw.x) - LOOK_MAX) * 0.5);
      }
      if (input.dragging || Math.abs(s.yaw.v) > 1e-4 || Math.abs(s.yaw.x - input.hold * LOOK_MAX * 0.85) > 1e-4) busy = true;

      // Pointer sway, ±1.5°, heavily damped: the camera is a person standing on a ridge, not a gimbal.
      const sx = input.over ? -input.px * SWAY : 0;
      const sy = input.over ? input.py * SWAY * 0.7 : 0;
      s.swayX = MathUtils.damp(s.swayX, sx, 2.2, dt);
      s.swayY = MathUtils.damp(s.swayY, sy, 2.2, dt);
      if (Math.abs(s.swayX - sx) + Math.abs(s.swayY - sy) > 1e-5) busy = true;
      input.yaw = s.yaw.x;
      const ox = s.swayX / SWAY;
      const oy = s.swayY / SWAY;
      if (Math.abs(ox - s.swayOut[0]) + Math.abs(oy - s.swayOut[1]) > 0.004) { s.swayOut = [ox, oy]; bridge.sway?.(ox, oy); }

      path.pos.getPoint(s.u, camera.position);
      path.look.getPoint(s.u, tmp.look);
      camera.position.y += 3.2 * s.intro.x;
      camera.position.z += 7 * s.intro.x;
      tmp.dir.subVectors(tmp.look, camera.position).applyAxisAngle(UP, s.yaw.x + s.swayX);
      tmp.right.crossVectors(tmp.dir, UP).normalize();
      tmp.dir.applyAxisAngle(tmp.right, s.swayY);
      camera.lookAt(tmp.look.addVectors(camera.position, tmp.dir));
    }

    // ── Head-torch: aims at the pointer's spot on the ground, with a little lag (a hand holds it) ──
    let want = 0;
    if (input.over) {
      camera.updateMatrixWorld();
      tmp.ndc.set(input.px, input.py);
      tmp.ray.setFromCamera(tmp.ndc, camera);
      if (marchTerrain(tmp.ray.ray, tmp.aim)) {
        want = 1;
        if (!s.torchSeen || s.torchK < 0.02) s.torch.copy(tmp.aim);
        s.torchSeen = true;
      }
    }
    s.torchK = MathUtils.damp(s.torchK, want, want > s.torchK ? 8 : 3, dt);
    if (want) {
      const before = s.torch.distanceToSquared(tmp.aim);
      s.torch.x = MathUtils.damp(s.torch.x, tmp.aim.x, 11, dt);
      s.torch.y = MathUtils.damp(s.torch.y, tmp.aim.y, 11, dt);
      s.torch.z = MathUtils.damp(s.torch.z, tmp.aim.z, 11, dt);
      if (before > 1e-5) busy = true;
    }
    if (Math.abs(s.torchK - want) > 0.002) busy = true;
    const tu = mats.terrain.uniforms;
    tu.uTorch.value = s.torchK;
    (tu.uTorchPos.value as Vector3).copy(camera.position).y -= 0.25;
    (tu.uTorchDir.value as Vector3).subVectors(s.torch, tu.uTorchPos.value as Vector3).normalize();

    // ── Colour script: dusk at the lake, night on the ridge, the aurora at the summit ──
    const u = reduced ? STOP_U[stop] : s.u;
    const dusk = 1 - smooth(0.3, 0.64, u);
    const night = smooth(0.24, 0.72, u);
    const aur = 0.24 + 0.76 * smooth(0.42, 0.95, u);
    s.flare = MathUtils.damp(s.flare, bridge.kick, bridge.kick > s.flare ? 9 : 1.3, dt);
    bridge.kick = Math.max(0, bridge.kick - dt * 2.4);
    if (s.flare > 0.002 || bridge.kick > 0) busy = true;
    const ku = mats.sky.uniforms;
    (ku.uTop.value as Color).lerpColors(pal.duskTop, pal.nightTop, night);
    (ku.uHorizon.value as Color).lerpColors(pal.duskHorizon, pal.nightHorizon, night);
    ku.uDusk.value = dusk;
    ku.uAur.value = aur;
    ku.uFlare.value = s.flare;
    (tu.uBase.value as Color).lerpColors(pal.groundDusk, pal.groundNight, night);
    (tu.uFog.value as Color).copy(ku.uHorizon.value as Color);
    tu.uDusk.value = dusk;
    tu.uAurLight.value = aur * aur * (1 + 1.2 * s.flare);
    mats.stars.uniforms.uNight.value = night;
    mats.halo.opacity = 0.16 + 0.2 * night;

    if (animate) {
      ku.uTime.value += dt;
      mats.stars.uniforms.uTime.value += dt;
    }

    const lit = Math.min(1.5, aur * (1 + 1.4 * s.flare));
    if (Math.abs(lit - s.lit) > 0.02) { s.lit = lit; bridge.light?.(lit); }
    if (busy) invalidate();
  });
  return null;
}

export function Scene({ bridge, input, reduced, animate, stop }: { bridge: Bridge; input: Input; reduced: boolean; animate: boolean; stop: StopId }) {
  const quality = useQuality();
  const invalidate = useThree((s) => s.invalidate);
  const dpr = useThree((s) => s.viewport.dpr);
  const segs = Math.round(MathUtils.clamp(220 * quality.density, 72, 220));
  const starCount = Math.round(2600 * quality.density);

  const terrain = useMemo(() => {
    const g = new PlaneGeometry(SIZE, SIZE, segs, segs);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)));
    p.needsUpdate = true;
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }, [segs]);
  const route = useMemo(() => {
    const pts = routePoints();
    const curve = new CatmullRomCurve3(pts);
    return {
      tube: new TubeGeometry(curve, 220, 0.042, 5, false),
      halo: new TubeGeometry(curve, 160, 0.16, 6, false),
      cairns: [pts[14], pts[72], pts[pts.length - 1]],
    };
  }, []);
  const stars = useMemo(() => {
    const g = new BufferGeometry();
    const pos = new Float32Array(starCount * 3);
    const seed = new Float32Array(starCount);
    let h = 12345;
    const rnd = () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
    for (let i = 0; i < starCount; i++) {
      const az = rnd() * Math.PI * 2;
      const el = Math.asin(0.05 + rnd() * 0.95);
      pos[i * 3] = Math.cos(el) * Math.sin(az) * 190;
      pos[i * 3 + 1] = Math.sin(el) * 190;
      pos[i * 3 + 2] = Math.cos(el) * Math.cos(az) * 190;
      seed[i] = rnd();
    }
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new BufferAttribute(seed, 1));
    return g;
  }, [starCount]);
  const skyGeo = useMemo(() => new SphereGeometry(200, 64, 32), []);
  const cairnGeo = useMemo(() => new OctahedronGeometry(0.2, 0), []);

  // Materials are created here so their uniform objects are the ones the Director writes to.
  const mats = useMemo<Mats>(() => ({
    terrain: new ShaderMaterial({
      vertexShader: terrainVert, fragmentShader: terrainFrag,
      uniforms: {
        uBase: color(NIGHT.groundDusk), uLine: color(NIGHT.line), uIndex: color(NIGHT.index), uWater: color(NIGHT.water),
        uFog: color(NIGHT.duskHorizon), uAurA: color(NIGHT.aurGreen), uGlow: color(NIGHT.afterglow), uTorchCol: color(NIGHT.torch),
        uInterval: { value: 0.5 }, uFogNear: { value: 18 }, uFogFar: { value: 78 }, uWaterLevel: { value: WATER },
        uAurLight: { value: 0 }, uDusk: { value: 1 }, uTorch: { value: 0 },
        uTorchPos: { value: new Vector3() }, uTorchDir: { value: new Vector3(0, -1, 0) },
      },
    }),
    sky: new ShaderMaterial({
      vertexShader: skyVert, fragmentShader: skyFrag, side: BackSide, depthWrite: false,
      uniforms: {
        uTop: color(NIGHT.duskTop), uHorizon: color(NIGHT.duskHorizon), uGlow: color(NIGHT.afterglow),
        uAurA: color(NIGHT.aurGreen), uAurB: color(NIGHT.aurViolet), uAurC: color(NIGHT.aurRose),
        uTime: { value: 7 }, uAur: { value: 0.24 }, uFlare: { value: 0 }, uDusk: { value: 1 },
      },
    }),
    stars: new ShaderMaterial({
      vertexShader: starVert, fragmentShader: starFrag, transparent: true, depthWrite: false,
      uniforms: { uColor: color(NIGHT.star), uTime: { value: 0 }, uSize: { value: 2.6 }, uDpr: { value: 1 }, uNight: { value: 0 } },
    }),
    route: new MeshBasicMaterial({ color: new Color(NIGHT.route), toneMapped: false }),
    halo: new MeshBasicMaterial({ color: new Color(NIGHT.route), toneMapped: false, transparent: true, opacity: 0.2, blending: AdditiveBlending, depthWrite: false }),
  }), []);

  useEffect(() => () => { terrain.dispose(); }, [terrain]);
  useEffect(() => () => { stars.dispose(); }, [stars]);
  useEffect(() => () => {
    route.tube.dispose(); route.halo.dispose(); skyGeo.dispose(); cairnGeo.dispose();
    Object.values(mats).forEach((m) => m.dispose());
  }, [route, skyGeo, cairnGeo, mats]);
  useEffect(() => { mats.stars.uniforms.uDpr.value = dpr; invalidate(); }, [dpr, mats, invalidate]);

  return (
    <>
      <mesh geometry={skyGeo} material={mats.sky} renderOrder={-1} frustumCulled={false} />
      <points geometry={stars} material={mats.stars} renderOrder={0} frustumCulled={false} />
      <mesh geometry={terrain} material={mats.terrain} />
      <mesh geometry={route.halo} material={mats.halo} renderOrder={1} />
      <mesh geometry={route.tube} material={mats.route} />
      {route.cairns.map((p, i) => <mesh key={i} geometry={cairnGeo} material={mats.route} position={[p.x, p.y + 0.24, p.z]} />)}
      {reduced ? <CameraRig presets={PRESETS} preset={stop} /> : null}
      <Director bridge={bridge} input={input} mats={mats} reduced={reduced} animate={animate} stop={stop} />
    </>
  );
}
