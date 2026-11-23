'use client';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  BackSide, BufferAttribute, BufferGeometry, CatmullRomCurve3, Color, MathUtils, MeshBasicMaterial, OctahedronGeometry,
  PlaneGeometry, ShaderMaterial, SphereGeometry, TubeGeometry, Vector3, type PerspectiveCamera,
} from 'three';
import { CameraRig, useQuality, type CameraPose } from '../../../three';
import { SIZE, VIEWPOINTS, WATER, cameraPath, height, routePoints, type StopId } from './terrain';
import { skyFrag, skyVert, starFrag, starVert, terrainFrag, terrainVert } from './shaders';

export interface Palette {
  base: string; line: string; index: string; water: string; skyTop: string; horizon: string;
  aurA: string; aurB: string; route: string; stars: string; aurora: number;
}
/** The page owns scroll progress; the scene only reads it. `u` is the camera's place on its path (0–1). */
export interface Bridge { u: number; invalidate: (() => void) | null }

const PRESETS: Record<StopId, CameraPose> = Object.fromEntries(VIEWPOINTS.map((v) => [v.id, { position: v.position, target: v.target, fov: 42 }])) as Record<StopId, CameraPose>;
const color = () => ({ value: new Color() });

/** Damped travel along the camera path; frames are requested only until the camera settles. */
function ScrollCamera({ bridge }: { bridge: Bridge }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const path = useMemo(() => cameraPath(), []);
  const look = useMemo(() => new Vector3(), []);
  const cur = useRef(bridge.u);

  useEffect(() => { bridge.invalidate = invalidate; invalidate(); return () => { bridge.invalidate = null; }; }, [bridge, invalidate]);
  useEffect(() => {
    camera.fov = aspect < 0.8 ? 62 : aspect < 1.2 ? 50 : 42;
    camera.updateProjectionMatrix();
    invalidate();
  }, [aspect, camera, invalidate]);

  useFrame((_, dt) => {
    const goal = MathUtils.clamp(bridge.u, 0, 1);
    cur.current = MathUtils.damp(cur.current, goal, 3.4, Math.min(dt, 0.1));
    if (Math.abs(goal - cur.current) < 1e-4) cur.current = goal;
    path.pos.getPoint(cur.current, camera.position);
    path.look.getPoint(cur.current, look);
    camera.lookAt(look);
    if (cur.current !== goal) invalidate();
  });
  return null;
}

export function Scene({ palette, bridge, reduced, animate, stop }: { palette: Palette; bridge: Bridge; reduced: boolean; animate: boolean; stop: StopId }) {
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
    g.computeBoundingSphere();
    return g;
  }, [segs]);
  const route = useMemo(() => {
    const pts = routePoints();
    return { tube: new TubeGeometry(new CatmullRomCurve3(pts), 220, 0.06, 5, false), cairns: [pts[0], pts[70], pts[pts.length - 1]] };
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
  const skyGeo = useMemo(() => new SphereGeometry(200, 48, 24), []);
  const cairnGeo = useMemo(() => new OctahedronGeometry(0.28, 0), []);

  // Materials are created here so their uniforms objects are the ones we write to.
  const mats = useMemo(() => ({
    terrain: new ShaderMaterial({
      vertexShader: terrainVert, fragmentShader: terrainFrag,
      uniforms: { uBase: color(), uLine: color(), uIndex: color(), uWater: color(), uFog: color(), uInterval: { value: 0.5 }, uFogNear: { value: 16 }, uFogFar: { value: 74 }, uWaterLevel: { value: WATER } },
    }),
    sky: new ShaderMaterial({
      vertexShader: skyVert, fragmentShader: skyFrag, side: BackSide, depthWrite: false,
      uniforms: { uTop: color(), uHorizon: color(), uAurA: color(), uAurB: color(), uTime: { value: 0 }, uAur: { value: 1 } },
    }),
    stars: new ShaderMaterial({
      vertexShader: starVert, fragmentShader: starFrag, transparent: true, depthWrite: false,
      uniforms: { uColor: color(), uTime: { value: 0 }, uSize: { value: 2.4 }, uDpr: { value: 1 } },
    }),
    route: new MeshBasicMaterial({ toneMapped: false }),
  }), []);

  useEffect(() => () => { terrain.dispose(); }, [terrain]);
  useEffect(() => () => { stars.dispose(); }, [stars]);
  useEffect(() => () => {
    route.tube.dispose(); skyGeo.dispose(); cairnGeo.dispose();
    Object.values(mats).forEach((m) => m.dispose());
  }, [route, skyGeo, cairnGeo, mats]);

  useEffect(() => {
    const t = mats.terrain.uniforms;
    t.uBase.value.set(palette.base); t.uLine.value.set(palette.line); t.uIndex.value.set(palette.index);
    t.uWater.value.set(palette.water); t.uFog.value.set(palette.horizon);
    const k = mats.sky.uniforms;
    k.uTop.value.set(palette.skyTop); k.uHorizon.value.set(palette.horizon); k.uAurA.value.set(palette.aurA); k.uAurB.value.set(palette.aurB);
    k.uAur.value = palette.aurora;
    mats.stars.uniforms.uColor.value.set(palette.stars);
    mats.route.color.set(palette.route);
    invalidate();
  }, [palette, mats, invalidate]);
  useEffect(() => { mats.stars.uniforms.uDpr.value = dpr; invalidate(); }, [dpr, mats, invalidate]);

  // Ambient time only advances while the sky is playing; paused or reduced, the frame is frozen.
  useFrame((_, dt) => {
    if (!animate) return;
    mats.sky.uniforms.uTime.value += dt;
    mats.stars.uniforms.uTime.value += dt;
  });

  return (
    <>
      <mesh geometry={skyGeo} material={mats.sky} renderOrder={-1} frustumCulled={false} />
      <points geometry={stars} material={mats.stars} renderOrder={0} frustumCulled={false} />
      <mesh geometry={terrain} material={mats.terrain} />
      <mesh geometry={route.tube} material={mats.route} />
      {route.cairns.map((p, i) => <mesh key={i} geometry={cairnGeo} material={mats.route} position={[p.x, p.y + 0.32, p.z]} />)}
      {reduced ? <CameraRig presets={PRESETS} preset={stop} /> : <ScrollCamera bridge={bridge} />}
    </>
  );
}
