'use client';
import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry, Color, EdgesGeometry, LineBasicMaterial, Matrix4, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry, Quaternion, Vector3,
  type InstancedMesh, type LineSegments,
} from 'three';
import { useStudioMotion } from '../../../motion';
import { CameraRig, OrbitInspect, type CameraPose } from '../../../three';
import { COLS, EXAGGERATION, N, ROWS, type Palette } from './data';

export type Preset = 'overview' | 'windward' | 'plan';
/** Grid centred on the origin: x runs west → east (columns A–X), z north → south (rows 1–16). */
export const PRESETS: Record<Preset, CameraPose> = {
  overview: { position: [-19, 16, 25], target: [0.5, 0.6, 0] },
  windward: { position: [-31, 6.5, 4], target: [0, 1.2, 0] },
  plan: { position: [0, 33, 3.6], target: [0, 0, 0] },
};
const GAP = 0.86;
const xOf = (i: number) => (i % COLS) - (COLS - 1) / 2;
const zOf = (i: number) => Math.floor(i / COLS) - (ROWS - 1) / 2;
const heightOf = (v: number) => (Number.isFinite(v) ? Math.max(0.03, (v / 100) * EXAGGERATION) : 0.03);

interface Props {
  values: Float32Array;
  pal: Palette;
  hovered: number | null;
  selected: number | null;
  onHover: (i: number | null) => void;
  onSelect: (i: number | null) => void;
  preset: Preset;
}

export function BarField({ values, pal, hovered, selected, onHover, onSelect, preset }: Props) {
  const invalidate = useThree((s) => s.invalidate);
  const { reduced, scale } = useStudioMotion();
  const mesh = useRef<InstancedMesh | null>(null);
  const outline = useRef<LineSegments | null>(null);

  const geometry = useMemo(() => { const g = new BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0); return g; }, []);
  const material = useMemo(() => new MeshLambertMaterial({ color: '#ffffff' }), []);
  const edges = useMemo(() => new EdgesGeometry(geometry), [geometry]);
  const edgeMat = useMemo(() => new LineBasicMaterial({ color: '#bf2f09', toneMapped: false }), []);
  const ground = useMemo(() => new PlaneGeometry(COLS + 1.4, ROWS + 1.4), []);
  const groundMat = useMemo(() => new MeshBasicMaterial({ color: '#e9e5da', toneMapped: false }), []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); edges.dispose(); edgeMat.dispose(); ground.dispose(); groundMat.dispose(); }, [geometry, material, edges, edgeMat, ground, groundMat]);

  // Heights tween between days by interpolating VALUES (a missing reading cuts to a flat tile, never a fake value).
  const current = useMemo(() => Float32Array.from(values), []); // eslint-disable-line react-hooks/exhaustive-deps
  const tween = useRef({ from: Float32Array.from(values), to: values, t: 1 });
  const tmp = useMemo(() => ({ m: new Matrix4(), q: new Quaternion(), p: new Vector3(), s: new Vector3(), c: new Color() }), []);
  const live = useRef({ hovered, selected, pal });
  live.current = { hovered, selected, pal };

  const write = useCallback(() => {
    const m = mesh.current;
    if (!m) return;
    const { pal: p, hovered: h, selected: sel } = live.current;
    const to = tween.current.to;
    for (let i = 0; i < N; i++) {
      tmp.p.set(xOf(i), 0, zOf(i));
      tmp.s.set(GAP, heightOf(current[i]), GAP);
      m.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q, tmp.s));
      m.setColorAt(i, tmp.c.set(Number.isFinite(to[i]) ? p.color(to[i]) : p.missing));
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.boundingSphere = null;
    m.boundingBox = null;
    const o = outline.current;
    const k = sel ?? h;
    if (o) {
      o.visible = k !== null;
      if (k !== null) { o.position.set(xOf(k), 0, zOf(k)); o.scale.set(GAP * 1.06, heightOf(current[k]) + 0.02, GAP * 1.06); }
    }
    groundMat.color.set(p.ground);
    edgeMat.color.set(p.outline);
  }, [current, tmp, groundMat, edgeMat]);

  useEffect(() => {
    const tw = tween.current;
    if (tw.to === values) return;
    tw.from = Float32Array.from(current);
    tw.to = values;
    tw.t = reduced ? 1 : 0;
    if (reduced) current.set(values);
    write();
    invalidate();
  }, [values, reduced, current, write, invalidate]);
  useEffect(() => { write(); invalidate(); }, [hovered, selected, pal, write, invalidate]);

  useFrame((_, dt) => {
    const tw = tween.current;
    if (tw.t >= 1) return;
    tw.t = Math.min(1, tw.t + Math.min(dt, 0.05) / (0.42 * scale.duration));
    const e = 1 - (1 - tw.t) ** 3;
    for (let i = 0; i < N; i++) {
      const b = tw.to[i];
      if (!Number.isFinite(b)) { current[i] = NaN; continue; }
      const a = Number.isFinite(tw.from[i]) ? tw.from[i] : 0;
      current[i] = a + (b - a) * e;
    }
    write();
    invalidate();
  });

  const meshRef = useCallback((m: InstancedMesh | null) => { mesh.current = m; if (m) { write(); invalidate(); } }, [write, invalidate]);

  return (
    <>
      <ambientLight intensity={0.78} />
      <directionalLight position={[-6, 20, 9]} intensity={0.36} />
      <directionalLight position={[10, 6, -12]} intensity={0.14} />
      <OrbitInspect target={[0.5, 0.6, 0]} minDistance={9} maxDistance={70} maxPolarAngle={Math.PI / 2 - 0.08} enablePan={false} />
      <CameraRig presets={PRESETS} preset={preset} smoothTime={0.55} referenceAspect={1.6} />
      <mesh geometry={ground} material={groundMat} rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} />
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, N]}
        frustumCulled={false}
        onPointerMove={(e) => { e.stopPropagation(); if (e.instanceId !== undefined && e.instanceId !== live.current.hovered) onHover(e.instanceId); }}
        onPointerOut={() => onHover(null)}
        onClick={(e) => { if (e.delta > 4 || e.instanceId === undefined) return; e.stopPropagation(); onSelect(e.instanceId === live.current.selected ? null : e.instanceId); }}
      />
      <lineSegments ref={outline} geometry={edges} material={edgeMat} visible={false} />
    </>
  );
}
