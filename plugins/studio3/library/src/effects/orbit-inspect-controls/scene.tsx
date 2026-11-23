'use client';
import { useThree } from '@react-three/fiber';
import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry, CapsuleGeometry, CylinderGeometry, InstancedMesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial,
  NeutralToneMapping, Object3D, PlaneGeometry, SphereGeometry, Vector3, type PerspectiveCamera,
} from 'three';
import { LightingRig, OrbitInspect, type LightingPreset, type OrbitInspectHandle } from '../../three';
import { bakeShadowTexture, blobTexture, groundUv } from './bake';
import {
  CORE, COLORS, COLUMN_RADIUS, COLUMNS, FIGURE_HEIGHT, FIGURES, FIN, GLASS, KEY_DIR, PLINTH, PODIUM, ROOF, SLAB, STEPS, TREE_TRUNK, TREES, type Box,
} from './model';

export type LimitPreset = 'Upper hemisphere' | 'Front arc' | 'Plan to eye level';
export const LIMITS: Record<LimitPreset, { minPolar: number; maxPolar: number; minAz: number; maxAz: number }> = {
  'Upper hemisphere': { minPolar: 0.22, maxPolar: 1.36, minAz: -Infinity, maxAz: Infinity },
  'Front arc': { minPolar: 0.55, maxPolar: 1.34, minAz: -1.2, maxAz: 1.2 },
  'Plan to eye level': { minPolar: 0.02, maxPolar: 1.42, minAz: -Infinity, maxAz: Infinity },
};

/** Model-relative "home": three-quarter view from the front right. Narrow canvases step back to keep the plinth in frame. */
export const TARGET: [number, number, number] = [0.1, 0.42, 0];
const HOME = { azimuth: 0.62, polar: 1.02, distance: 11.2 };
export const MIN_DISTANCE = 5.2;
export const MAX_DISTANCE = 19;

const LIGHT: LightingPreset = {
  label: 'Maquette daylight',
  description: 'Low warm key from front left, cool sky fill, soft overhead panels.',
  exposure: 1,
  ambient: { color: '#fff6ea', intensity: 0.3 },
  key: { color: '#fff0dc', intensity: 2.3, position: KEY_DIR },
  fill: { color: '#dbe3f6', intensity: 0.55, position: [5, 3, -3] },
  env: {
    room: '#38342e',
    intensity: 0.55,
    panels: [
      { color: '#ffffff', intensity: 6, position: [0, 6, 0], size: [8, 8] },
      { color: '#ffe8cc', intensity: 3.5, position: [-6, 2.5, 3], size: [4, 5] },
      { color: '#dde6ff', intensity: 2, position: [6, 2, -3], size: [4, 5] },
    ],
  },
};

export interface ViewInfo { azimuth: number; elevation: number; zoom: number }

function ToneMapping() {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const prev = gl.toneMapping;
    gl.toneMapping = NeutralToneMapping; // keeps paper white and the accent's hue (ACES would yellow them)
    invalidate();
    return () => { gl.toneMapping = prev; };
  }, [gl, invalidate]);
  return null;
}

type V3 = [number, number, number];
const size = (b: Box): V3 => [b.x[1] - b.x[0], b.y[1] - b.y[0], b.z[1] - b.z[0]];
const center = (b: Box): V3 => [(b.x[0] + b.x[1]) / 2, (b.y[0] + b.y[1]) / 2, (b.z[0] + b.z[1]) / 2];

function Maquette({ accent }: { accent: string }) {
  const invalidate = useThree((s) => s.invalidate);
  const res = useMemo(() => {
    const shadow = bakeShadowTexture();
    const blob = blobTexture();
    const mats = {
      board: new MeshStandardMaterial({ color: COLORS.board, roughness: 0.92 }),
      paper: new MeshStandardMaterial({ color: COLORS.paper, roughness: 0.9 }),
      wood: new MeshStandardMaterial({ color: COLORS.basswood, roughness: 0.78 }),
      steel: new MeshStandardMaterial({ color: COLORS.steel, roughness: 0.42, metalness: 0.6 }),
      glass: new MeshPhysicalMaterial({ color: '#d9e6e8', roughness: 0.06, metalness: 0, transparent: true, opacity: 0.26, envMapIntensity: 1.4, depthWrite: false }),
      figure: new MeshStandardMaterial({ color: accent, roughness: 0.55 }),
      shadow: new MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      blob: new MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.55 }),
    };
    const box = new BoxGeometry(1, 1, 1);
    const ground = (b: Box) => {
      const g = new PlaneGeometry(b.x[1] - b.x[0], b.z[1] - b.z[0]);
      const { u, v } = groundUv(b);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u[1] : u[0], uv.getY(i) ? v[1] : v[0]);
      return g;
    };
    const geos = {
      box,
      slabShadow: ground(SLAB),
      podiumShadow: ground(PODIUM),
      column: new CylinderGeometry(COLUMN_RADIUS, COLUMN_RADIUS, 1, 12),
      trunk: new CylinderGeometry(0.018, 0.024, 1, 8),
      crown: new SphereGeometry(1, 20, 14),
      figure: new CapsuleGeometry(0.045, FIGURE_HEIGHT - 0.09, 4, 10),
      blob: new PlaneGeometry(1, 1),
    };
    return { textures: [shadow, blob], mats, geos };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- accent is applied below without rebuilding

  useEffect(() => { res.mats.figure.color.set(accent); invalidate(); }, [accent, res, invalidate]);
  useEffect(() => () => {
    for (const t of res.textures) t?.dispose();
    for (const m of Object.values(res.mats)) m.dispose();
    for (const g of Object.values(res.geos)) g.dispose();
  }, [res]);

  const columns = useRef<InstancedMesh>(null);
  const trunks = useRef<InstancedMesh>(null);
  const crowns = useRef<InstancedMesh>(null);
  const figures = useRef<InstancedMesh>(null);
  const steps = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new Object3D();
    const set = (mesh: InstancedMesh | null, i: number, p: V3, s: V3) => {
      if (!mesh) return;
      o.position.set(p[0], p[1], p[2]); o.scale.set(s[0], s[1], s[2]); o.rotation.set(0, 0, 0); o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.instanceMatrix.needsUpdate = true;
    };
    const colH = ROOF.y[0] - PODIUM.y[1];
    COLUMNS.forEach(([x, z], i) => set(columns.current, i, [x, PODIUM.y[1] + colH / 2, z], [1, colH, 1]));
    TREES.forEach((t, i) => {
      set(trunks.current, i, [t.x, SLAB.y[1] + TREE_TRUNK / 2, t.z], [1, TREE_TRUNK, 1]);
      set(crowns.current, i, [t.x, SLAB.y[1] + TREE_TRUNK + t.r * 0.55, t.z], [t.r, t.r * 0.92, t.r]);
    });
    FIGURES.forEach((f, i) => set(figures.current, i, [f.x, f.y + FIGURE_HEIGHT / 2, f.z], [1, 1, 1]));
    STEPS.forEach((b, i) => set(steps.current, i, center(b), size(b)));
    for (const m of [columns, trunks, crowns, figures, steps]) m.current?.computeBoundingSphere();
    invalidate();
  }, [invalidate]);

  const { mats, geos } = res;
  const solid = (b: Box, material: MeshStandardMaterial | MeshPhysicalMaterial, key: string) => (
    <mesh key={key} geometry={geos.box} material={material} position={center(b)} scale={size(b)} />
  );
  return (
    <group>
      <mesh geometry={geos.blob} material={mats.blob} rotation-x={-Math.PI / 2} position={[0.25, PLINTH.y[0] - 0.002, -0.1]} scale={[7.4, 5.6, 1]} renderOrder={-1} />
      {solid(PLINTH, mats.board, 'plinth')}
      {solid(SLAB, mats.paper, 'slab')}
      {solid(PODIUM, mats.paper, 'podium')}
      <instancedMesh ref={steps} args={[geos.box, mats.paper, STEPS.length]} />
      {solid(CORE, mats.wood, 'core')}
      {solid(FIN, mats.wood, 'fin')}
      {solid(ROOF, mats.paper, 'roof')}
      <instancedMesh ref={columns} args={[geos.column, mats.steel, COLUMNS.length]} />
      <instancedMesh ref={trunks} args={[geos.trunk, mats.steel, TREES.length]} />
      <instancedMesh ref={crowns} args={[geos.crown, mats.paper, TREES.length]} />
      <instancedMesh ref={figures} args={[geos.figure, mats.figure, FIGURES.length]} />
      {/* baked shadows, laid just above the slab and the podium */}
      <mesh geometry={geos.slabShadow} material={mats.shadow} rotation-x={-Math.PI / 2} position={[(SLAB.x[0] + SLAB.x[1]) / 2, SLAB.y[1] + 0.001, (SLAB.z[0] + SLAB.z[1]) / 2]} renderOrder={1} />
      <mesh geometry={geos.podiumShadow} material={mats.shadow} rotation-x={-Math.PI / 2} position={[(PODIUM.x[0] + PODIUM.x[1]) / 2, PODIUM.y[1] + 0.001, (PODIUM.z[0] + PODIUM.z[1]) / 2]} renderOrder={1} />
      {solid(GLASS, mats.glass, 'glass')}
    </group>
  );
}

export interface SceneProps {
  accent: string;
  damping: number;
  step: number;
  limits: LimitPreset;
  autoRotate: boolean;
  onView: (v: ViewInfo) => void;
  onSettle: () => void;
}

/** Spherical → position around TARGET. */
function homePosition(aspect: number): Vector3 {
  const d = HOME.distance * Math.min(1.9, Math.max(1, 1.35 / aspect));
  return new Vector3(Math.sin(HOME.polar) * Math.sin(HOME.azimuth), Math.cos(HOME.polar), Math.sin(HOME.polar) * Math.cos(HOME.azimuth))
    .multiplyScalar(d).add(new Vector3(...TARGET));
}

export const Scene = forwardRef<OrbitInspectHandle, SceneProps>(function Scene({ accent, damping, step, limits, autoRotate, onView, onSettle }, ref) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const invalidate = useThree((s) => s.invalidate);
  const orbit = useRef<OrbitInspectHandle | null>(null);
  const pristine = useRef(true);
  const home = useRef(new Vector3());
  const cb = useRef({ onView, onSettle });
  cb.current = { onView, onSettle };
  const lim = LIMITS[limits] ?? LIMITS['Upper hemisphere'];

  // Place the camera before OrbitInspect saves its "reset" pose; later aspect changes move the saved home too.
  useLayoutEffect(() => {
    home.current.copy(homePosition(aspect));
    const c = orbit.current?.controls;
    if (pristine.current || !c) { camera.position.copy(home.current); camera.lookAt(...TARGET); }
    if (c) { c.position0.copy(home.current); c.target0.set(...TARGET); if (pristine.current) c.update(); }
    invalidate();
  }, [aspect, camera, invalidate]);

  const report = () => {
    const c = orbit.current?.controls;
    if (!c) return;
    const az = ((c.getAzimuthalAngle() * 180) / Math.PI + 360) % 360;
    cb.current.onView({ azimuth: az, elevation: 90 - (c.getPolarAngle() * 180) / Math.PI, zoom: home.current.distanceTo(c.target) / Math.max(0.001, c.getDistance()) });
  };
  useEffect(() => { report(); }); // eslint-disable-line react-hooks/exhaustive-deps -- first paint + after prop changes

  const setRefs = (h: OrbitInspectHandle | null) => {
    orbit.current = h;
    if (typeof ref === 'function') ref(h); else if (ref) ref.current = h;
  };

  return (
    <>
      <ToneMapping />
      <LightingRig preset={LIGHT} shadow="none" />
      <Maquette accent={accent} />
      <OrbitInspect
        ref={setRefs}
        target={TARGET}
        damping={damping}
        keyboard={false}
        wheel="never"
        touchScroll="pan-y"
        keyStep={(step * Math.PI) / 180}
        minDistance={MIN_DISTANCE}
        maxDistance={MAX_DISTANCE}
        minPolarAngle={lim.minPolar}
        maxPolarAngle={lim.maxPolar}
        minAzimuthAngle={lim.minAz}
        maxAzimuthAngle={lim.maxAz}
        autoRotate={autoRotate}
        autoRotateSpeed={0.8}
        onStart={() => { pristine.current = false; }}
        onChange={report}
        onEnd={() => cb.current.onSettle()}
      />
    </>
  );
});
