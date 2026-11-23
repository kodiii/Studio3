'use client';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  CylinderGeometry, Group, MeshBasicMaterial, MeshStandardMaterial, NeutralToneMapping, PlaneGeometry, TorusGeometry, Vector3,
  type BufferGeometry, type PerspectiveCamera,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { LightingRig, type LightingPreset } from '../../three';
import { blobTexture } from './blob';
import { COLORS, PARTS, partProgress, type PartId } from './parts';

const FRONT = 0.425; // body front face (z)
const LENS: [number, number] = [0.25, -0.05]; // lens axis (x, y)

const LIGHT: LightingPreset = {
  label: 'Product rim', description: 'Soft key, cool fill and a strong rim so dark parts read on any stage.', exposure: 1.05,
  ambient: { color: '#ffffff', intensity: 0.22 },
  key: { color: '#fff4e6', intensity: 2.2, position: [-3, 5, 4] },
  fill: { color: '#dfe7ff', intensity: 0.6, position: [5, 2, 3] },
  rim: { color: '#ffffff', intensity: 2.6, position: [1, 3, -6] },
  env: { room: '#26231f', intensity: 0.75, panels: [
    { color: '#ffffff', intensity: 8, position: [0, 6, 1], size: [7, 5] },
    { color: '#ffeedd', intensity: 5, position: [-6, 2, 3], size: [1.4, 6] },
    { color: '#e6eeff', intensity: 4, position: [6, 2.5, -2], size: [1.2, 6] },
  ] },
};

interface Mesh { geo: BufferGeometry; mat: MeshStandardMaterial; pos?: [number, number, number]; rot?: [number, number, number] }
interface Built { id: PartId; base: [number, number, number]; meshes: Mesh[] }

function ToneMapping() {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => { const prev = gl.toneMapping; gl.toneMapping = NeutralToneMapping; invalidate(); return () => { gl.toneMapping = prev; }; }, [gl, invalidate]);
  return null;
}

export interface SceneProps {
  amount: number;
  smooth: number;
  spread: number;
  stagger: number;
  accent: string;
  highlight: PartId | null;
  cut: boolean;
  onHover: (id: PartId | null) => void;
  onPick: (id: PartId) => void;
}

export function Scene({ amount, smooth, spread, stagger, accent, highlight, cut, onHover, onPick }: SceneProps) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const invalidate = useThree((s) => s.invalidate);
  const dom = useThree((s) => s.gl.domElement);
  const groups = useRef(new Map<PartId, Group>());
  const anim = useRef({ value: -1, vel: 0 });
  const tmp = useMemo(() => ({ dir: new Vector3(-0.6, 0.44, 0.67).normalize(), target: new Vector3(), pos: new Vector3() }), []);

  const res = useMemo(() => {
    const m = (color: string, roughness: number, metalness = 0) => new MeshStandardMaterial({ color, roughness, metalness });
    const blob = blobTexture();
    const geos = {
      body: new RoundedBoxGeometry(2.5, 1.45, 0.85, 4, 0.12),
      plate: new RoundedBoxGeometry(2.46, 0.14, 0.8, 3, 0.05),
      dial: new CylinderGeometry(0.22, 0.22, 0.1, 40),
      button: new CylinderGeometry(0.075, 0.075, 0.07, 24),
      grip: new RoundedBoxGeometry(0.52, 1.18, 0.16, 3, 0.06),
      mount: new CylinderGeometry(0.53, 0.53, 0.1, 56, 1, true),
      lip: new TorusGeometry(0.5, 0.035, 10, 56),
      barrel: new CylinderGeometry(0.46, 0.48, 0.75, 56),
      ring: new TorusGeometry(0.465, 0.022, 8, 56),
      glass: new CylinderGeometry(0.37, 0.37, 0.05, 56),
      battery: new RoundedBoxGeometry(0.95, 0.3, 0.5, 2, 0.04),
      floor: new PlaneGeometry(1, 1),
    };
    const parts: Built[] = [
      { id: 'body', base: [0, 0, 0], meshes: [{ geo: geos.body, mat: m(COLORS.leatherette, 0.88) }] },
      { id: 'top', base: [0, 0.8, 0], meshes: [
        { geo: geos.plate, mat: m(COLORS.alu, 0.34, 1) },
        { geo: geos.dial, mat: m(COLORS.alu, 0.28, 1), pos: [0.62, 0.12, 0] },
        { geo: geos.button, mat: m(accent, 0.45), pos: [0.98, 0.1, 0.2] },
      ] },
      { id: 'grip', base: [-0.82, -0.02, FRONT + 0.08], meshes: [{ geo: geos.grip, mat: m(COLORS.grip, 0.7) }] },
      { id: 'mount', base: [LENS[0], LENS[1], FRONT + 0.05], meshes: [
        { geo: geos.mount, mat: m(COLORS.steel, 0.3, 1), rot: [Math.PI / 2, 0, 0] },
        { geo: geos.lip, mat: m(COLORS.steel, 0.3, 1), pos: [0, 0, 0.05] },
      ] },
      { id: 'barrel', base: [LENS[0], LENS[1], FRONT + 0.1 + 0.375], meshes: [
        { geo: geos.barrel, mat: m(COLORS.anodised, 0.42, 0.55), rot: [Math.PI / 2, 0, 0] },
        { geo: geos.ring, mat: m(accent, 0.5), pos: [0, 0, 0.3] },
      ] },
      { id: 'glass', base: [LENS[0], LENS[1], FRONT + 0.1 + 0.75 + 0.03], meshes: [{ geo: geos.glass, mat: m(COLORS.glass, 0.04, 0.3), rot: [Math.PI / 2, 0, 0] }] },
      { id: 'battery', base: [-0.5, -0.42, 0], meshes: [{ geo: geos.battery, mat: m(COLORS.battery, 0.5, 0.2) }] },
    ];
    const floor = new MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.5 });
    return { parts, geos, floor, blob, accented: [parts[1].meshes[2].mat, parts[4].meshes[1].mat] };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- accent is applied below
  useEffect(() => () => {
    for (const p of res.parts) for (const x of p.meshes) x.mat.dispose();
    for (const g of Object.values(res.geos)) g.dispose();
    res.floor.dispose();
    res.blob?.dispose();
  }, [res]);
  useEffect(() => { for (const mat of res.accented) mat.color.set(accent); invalidate(); }, [accent, res, invalidate]);

  // Emissive lift on the highlighted part (always paired with the part name in the DOM).
  useEffect(() => {
    for (const p of res.parts) for (const x of p.meshes) {
      const on = p.id === highlight;
      x.mat.emissive.set(on ? accent : '#000000');
      x.mat.emissiveIntensity = on ? 0.42 : 0;
    }
    invalidate();
  }, [highlight, accent, res, invalidate]);

  useEffect(() => { invalidate(); }, [amount, spread, stagger, aspect, invalidate]);

  useFrame((_, rawDt) => {
    const a = anim.current;
    const dt = Math.min(rawDt, 1 / 20);
    if (a.value < 0 || cut) { a.value = amount; a.vel = 0; }
    else if (a.value !== amount) {
      // Critically damped follow: the slider stays responsive, the buttons glide.
      const omega = 2 / Math.max(0.02, smooth);
      const x = omega * dt, exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
      const change = a.value - amount, temp = (a.vel + omega * change) * dt;
      a.vel = (a.vel - omega * temp) * exp;
      a.value = amount + (change + temp) * exp;
      if (Math.abs(a.value - amount) < 2e-4 && Math.abs(a.vel) < 2e-3) { a.value = amount; a.vel = 0; }
      else invalidate();
    }
    for (const p of PARTS) {
      const g = groups.current.get(p.id);
      const built = res.parts.find((b) => b.id === p.id);
      if (!g || !built) continue;
      const t = partProgress(p.order, a.value, stagger);
      g.position.set(built.base[0] + p.dir[0] * p.distance * spread * t, built.base[1] + p.dir[1] * p.distance * spread * t, built.base[2] + p.dir[2] * p.distance * spread * t);
    }
    // Frame the assembly: step back (and towards the lens) as it opens; narrow canvases step back further.
    const e = a.value * spread;
    const d = (6.4 + 3.4 * e) * Math.min(1.9, Math.max(1, 1.25 / aspect));
    tmp.target.set(0.15 + 0.2 * e, -0.05, 0.25 + 0.75 * e);
    camera.position.copy(tmp.pos.copy(tmp.dir).multiplyScalar(d).add(tmp.target));
    camera.lookAt(tmp.target);
  });

  const over = (id: PartId) => (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); dom.style.cursor = 'pointer'; onHover(id); };
  const out = () => { dom.style.cursor = ''; onHover(null); };
  useEffect(() => () => { dom.style.cursor = ''; }, [dom]);

  return (
    <>
      <ToneMapping />
      <LightingRig preset={LIGHT} shadow="none" />
      <mesh geometry={res.geos.floor} material={res.floor} rotation-x={-Math.PI / 2} position={[0.1, -2.05, 0.4]} scale={[5.5, 3.6, 1]} />
      {res.parts.map((p) => (
        <group
          key={p.id}
          ref={(g) => { if (g) groups.current.set(p.id, g); else groups.current.delete(p.id); }}
          position={p.base}
          onPointerOver={over(p.id)}
          onPointerOut={out}
          onClick={(e) => { e.stopPropagation(); onPick(p.id); }}
        >
          {p.meshes.map((x, i) => <mesh key={i} geometry={x.geo} material={x.mat} position={x.pos} rotation={x.rot} />)}
        </group>
      ))}
    </>
  );
}
