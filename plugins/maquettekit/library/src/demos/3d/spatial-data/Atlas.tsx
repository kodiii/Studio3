'use client';
import { addAfterEffect, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, CylinderGeometry, IcosahedronGeometry, LineBasicMaterial, Matrix4, MeshLambertMaterial,
  OctahedronGeometry, Quaternion, Vector3, type InstancedMesh, type PerspectiveCamera,
} from 'three';
import { useStudioMotion } from '../../../motion';
import { CameraRig, OrbitInspect, type CameraRigHandle, type OrbitInspectHandle } from '../../../three';
import { CLUSTERS, EDGES_LIST, NODES, PALETTE, layoutBounds, nodeRadius, relax, type ClusterId, type NodeKind } from './data';

export type ViewMode = '3d' | '2d';
const KIND_ORDER: NodeKind[] = ['service', 'store', 'queue', 'external'];
/** Overview viewing directions: a raised three-quarter view for 3D, straight-on for the planar layout. */
const OVERVIEW_DIR = { '3d': new Vector3(0.52, 0.42, 0.74).normalize(), '2d': new Vector3(0, 0, 1) };
const FOCUS_DISTANCE = 7.5;

/** DOM labels registered by the page; positions are written after each rendered frame (no React re-render). */
export interface LabelStore { els: Map<string, HTMLElement>; register(key: string, el: HTMLElement | null): void }
export function useLabelStore(): LabelStore {
  return useMemo(() => {
    const els = new Map<string, HTMLElement>();
    return { els, register(key, el) { if (el) els.set(key, el); else els.delete(key); } };
  }, []);
}

export interface AtlasHandle { resetView(): void }
export interface AtlasProps {
  mode: ViewMode;
  theme: 'light' | 'dark';
  visible: ReadonlySet<ClusterId>;
  selected: number | null;
  hovered: number | null;
  /** Search matches (null = no search active). */
  matches: ReadonlySet<number> | null;
  labels: LabelStore;
  onHover: (index: number | null) => void;
  onSelect: (index: number | null) => void;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export const Atlas = forwardRef<AtlasHandle, AtlasProps>(function Atlas({ mode, theme, visible, selected, hovered, matches, labels, onHover, onSelect }, ref) {
  const invalidate = useThree((s) => s.invalidate);
  const get = useThree((s) => s.get);
  const { reduced } = useStudioMotion();
  const rig = useRef<CameraRigHandle>(null);
  const orbit = useRef<OrbitInspectHandle>(null);
  const meshes = useRef<Partial<Record<NodeKind, InstancedMesh | null>>>({});
  // In 2D the orbit is locked straight-on — but only once the camera has arrived there, so the lock never snaps it.
  const [flatLocked, setFlatLocked] = useState(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  useEffect(() => { if (mode === '3d') setFlatLocked(false); }, [mode]);

  const layouts = useMemo(() => ({ '3d': relax(false), '2d': relax(true) }), []);
  const current = useMemo(() => Float32Array.from(layouts['3d']), [layouts]);
  const tween = useRef({ from: new Float32Array(current), to: layouts['3d'], t: 1 });

  const groups = useMemo(() => KIND_ORDER.map((kind) => ({ kind, nodes: NODES.filter((n) => n.kind === kind) })).filter((g) => g.nodes.length), []);
  const geometries = useMemo(() => ({
    service: new IcosahedronGeometry(1, 2),
    store: new CylinderGeometry(0.82, 0.82, 1.45, 24),
    queue: new OctahedronGeometry(1.2, 0),
    external: new BoxGeometry(1.45, 1.45, 1.45),
  }), []);
  const material = useMemo(() => new MeshLambertMaterial({ color: '#ffffff' }), []);
  const edgeGeometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(EDGES_LIST.length * 6), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(EDGES_LIST.length * 6), 3));
    return g;
  }, []);
  const edgeMaterial = useMemo(() => new LineBasicMaterial({ vertexColors: true, toneMapped: false }), []);
  useEffect(() => () => {
    Object.values(geometries).forEach((g) => g.dispose());
    material.dispose(); edgeGeometry.dispose(); edgeMaterial.dispose();
  }, [geometries, material, edgeGeometry, edgeMaterial]);

  // Everything the per-frame writers need, without re-subscribing.
  const live = useRef({ visible, selected, hovered, matches, theme });
  live.current = { visible, selected, hovered, matches, theme };
  const tmp = useMemo(() => ({ m: new Matrix4(), q: new Quaternion(), s: new Vector3(), p: new Vector3(), c: new Color(), bg: new Color(), ink: new Color(), a: new Color(), b: new Color(), v: new Vector3() }), []);

  const focusSet = (): Set<number> | null => {
    const sel = live.current.selected;
    if (sel == null) return null;
    const n = NODES[sel];
    return new Set([sel, ...n.out, ...n.in]);
  };

  const writeNodes = () => {
    const { visible: vis, selected: sel, hovered: hov, matches: hits, theme: th } = live.current;
    const pal = PALETTE[th];
    const focus = focusSet();
    tmp.bg.set(th === 'dark' ? '#0e0e0c' : '#f3f0e8');
    for (const g of groups) {
      const mesh = meshes.current[g.kind];
      if (!mesh) continue;
      g.nodes.forEach((n, i) => {
        const shown = vis.has(n.cluster);
        const r = shown ? nodeRadius(n) * (n.index === sel ? 1.4 : n.index === hov ? 1.22 : 1) : 0;
        tmp.p.set(current[n.index * 3], current[n.index * 3 + 1], current[n.index * 3 + 2]);
        tmp.s.setScalar(Math.max(r, 1e-5));
        mesh.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q, tmp.s));
        const lit = focus ? focus.has(n.index) : hits ? hits.has(n.index) : true;
        tmp.c.set(pal[n.cluster]);
        if (!lit && n.index !== hov) tmp.c.lerp(tmp.bg, 0.8);
        mesh.setColorAt(i, tmp.c);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.boundingSphere = null; // raycasting recomputes it from the moved instances
    }
  };

  const writeEdges = () => {
    const { visible: vis, selected: sel, theme: th } = live.current;
    const pal = PALETTE[th];
    tmp.bg.set(th === 'dark' ? '#0e0e0c' : '#f3f0e8');
    tmp.ink.set(th === 'dark' ? '#f3f0e8' : '#11110f');
    const pos = edgeGeometry.getAttribute('position') as BufferAttribute;
    const col = edgeGeometry.getAttribute('color') as BufferAttribute;
    let k = 0;
    for (const e of EDGES_LIST) {
      const s = NODES[e.source], t = NODES[e.target];
      if (!vis.has(s.cluster) || !vis.has(t.cluster)) continue;
      pos.setXYZ(k * 2, current[e.source * 3], current[e.source * 3 + 1], current[e.source * 3 + 2]);
      pos.setXYZ(k * 2 + 1, current[e.target * 3], current[e.target * 3 + 1], current[e.target * 3 + 2]);
      const incident = sel != null && (e.source === sel || e.target === sel);
      if (sel == null) {
        // caller end fainter than callee end: direction reads as a gradient towards the dependency
        tmp.a.set(pal[s.cluster]).lerp(tmp.bg, 0.72); tmp.b.set(pal[t.cluster]).lerp(tmp.bg, 0.35);
      } else if (incident) {
        tmp.a.copy(tmp.ink).lerp(tmp.bg, e.source === sel ? 0 : 0.45); tmp.b.copy(tmp.ink).lerp(tmp.bg, e.target === sel ? 0 : 0.0);
      } else {
        tmp.a.copy(tmp.bg).lerp(tmp.ink, 0.07); tmp.b.copy(tmp.a);
      }
      col.setXYZ(k * 2, tmp.a.r, tmp.a.g, tmp.a.b);
      col.setXYZ(k * 2 + 1, tmp.b.r, tmp.b.g, tmp.b.b);
      k++;
    }
    pos.needsUpdate = true; col.needsUpdate = true;
    edgeGeometry.setDrawRange(0, k * 2);
    edgeGeometry.computeBoundingSphere();
  };

  // Restyle on any state change.
  useEffect(() => { writeNodes(); writeEdges(); invalidate(); }, [visible, selected, hovered, matches, theme]); // eslint-disable-line react-hooks/exhaustive-deps

  // Layout morph between the 3D and planar layouts.
  useEffect(() => {
    const tw = tween.current;
    const target = layouts[mode];
    if (tw.to === target) return;
    tw.from.set(current); tw.to = target; tw.t = 0;
    if (reduced) { current.set(target); tw.t = 1; writeNodes(); writeEdges(); }
    invalidate();
  }, [mode, layouts, current, reduced, invalidate]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => {
    const tw = tween.current;
    if (tw.t >= 1) return;
    tw.t = Math.min(1, tw.t + Math.min(dt, 1 / 20) / 0.9);
    const e = easeInOut(tw.t);
    for (let i = 0; i < current.length; i++) current[i] = tw.from[i] + (tw.to[i] - tw.from[i]) * e;
    writeNodes(); writeEdges();
    invalidate();
  });

  // Camera: overview per mode; selection focuses the node, keeping the viewing direction (straight-on in 2D).
  const nodePos = (i: number) => {
    const to = tween.current.to;
    return [to[i * 3], to[i * 3 + 1], to[i * 3 + 2]] as [number, number, number];
  };
  // Frame the whole layout for the live aspect ratio (fits the narrower of the two fields of view).
  const bounds = useMemo(() => ({ '3d': layoutBounds(layouts['3d']), '2d': layoutBounds(layouts['2d']) }), [layouts]);
  const goOverview = (immediate = false) => {
    const { camera: cam, size: sz } = get();
    const vfov = ((cam as PerspectiveCamera).fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * (sz.width / Math.max(1, sz.height)));
    const b = bounds[mode];
    const dist = (b.radius * (mode === '2d' ? 0.92 : 0.98)) / Math.sin(Math.min(vfov, hfov) / 2);
    const d = OVERVIEW_DIR[mode];
    rig.current?.goTo({ position: [b.center[0] + d.x * dist, b.center[1] + d.y * dist, b.center[2] + d.z * dist], target: b.center }, { immediate });
  };
  useImperativeHandle(ref, () => ({ resetView: () => goOverview() }));
  const first = useRef(true);
  useEffect(() => {
    if (selected == null) { goOverview(first.current); first.current = false; return; }
    first.current = false;
    const [x, y, z] = nodePos(selected);
    if (mode === '2d') { rig.current?.goTo({ position: [x, y, FOCUS_DISTANCE + 2], target: [x, y, 0] }); return; }
    const cam = get().camera as PerspectiveCamera;
    const dir = tmp.v.copy(cam.position).sub(orbit.current?.controls?.target ?? tmp.p.set(0, 0, 0)).normalize();
    rig.current?.goTo({ position: [x + dir.x * FOCUS_DISTANCE, y + dir.y * FOCUS_DISTANCE, z + dir.z * FOCUS_DISTANCE], target: [x, y, z] });
  }, [selected, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const size = useThree((s) => s.size);
  const aspect = Math.round((size.width / Math.max(1, size.height)) * 50) / 50;
  useEffect(() => { if (!first.current && selected == null) goOverview(true); }, [aspect]); // eslint-disable-line react-hooks/exhaustive-deps

  // Labels: projected after every rendered frame so they match the pixels exactly.
  const sizeRef = useRef(size);
  sizeRef.current = size;
  useEffect(() => addAfterEffect(() => {
    const cam = get().camera;
    const { width, height } = sizeRef.current;
    cam.updateMatrixWorld();
    for (const [key, el] of labels.els) {
      if (key.startsWith('n:')) {
        const i = Number(key.slice(2));
        tmp.p.set(current[i * 3], current[i * 3 + 1] + nodeRadius(NODES[i]) * 1.5, current[i * 3 + 2]);
      } else {
        const cid = key.slice(2) as ClusterId;
        let cx = 0, cy = -Infinity, cz = 0, cnt = 0;
        for (const n of NODES) if (n.cluster === cid) { cx += current[n.index * 3]; cy = Math.max(cy, current[n.index * 3 + 1]); cz += current[n.index * 3 + 2]; cnt++; }
        tmp.p.set(cx / cnt, cy + 0.9, cz / cnt);
      }
      tmp.p.project(cam);
      if (tmp.p.z > 1 || tmp.p.z < -1) { el.style.visibility = 'hidden'; continue; }
      el.style.visibility = 'visible';
      el.style.transform = `translate3d(${((tmp.p.x * 0.5 + 0.5) * width).toFixed(1)}px, ${((-tmp.p.y * 0.5 + 0.5) * height).toFixed(1)}px, 0) translate(-50%, -100%)`;
    }
  }), [get, labels, current, tmp]);
  useEffect(() => { invalidate(); }); // new labels mounted → one frame to place them

  const meshRefs = useMemo(() => Object.fromEntries(KIND_ORDER.map((kind) => [kind, (m: InstancedMesh | null) => {
    meshes.current[kind] = m;
    if (m) { writeNodes(); invalidate(); }
  }])) as Record<NodeKind, (m: InstancedMesh | null) => void>, []); // eslint-disable-line react-hooks/exhaustive-deps
  const lineRef = useCallback((l: unknown) => { if (l) { writeEdges(); invalidate(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (kind: NodeKind, e: ThreeEvent<PointerEvent | MouseEvent>): number | null => {
    const g = groups.find((x) => x.kind === kind);
    const n = e.instanceId != null ? g?.nodes[e.instanceId] : undefined;
    return n && live.current.visible.has(n.cluster) ? n.index : null;
  };

  return (
    <>
      <ambientLight intensity={theme === 'dark' ? 1.05 : 1.25} />
      <directionalLight position={[6, 10, 8]} intensity={1.1} />
      <directionalLight position={[-8, -4, -6]} intensity={0.35} />
      <OrbitInspect
        ref={orbit} enablePan minDistance={3} maxDistance={60} minPolarAngle={0.05} maxPolarAngle={Math.PI - 0.05}
        {...(mode === '2d' && flatLocked ? { minAzimuthAngle: 0, maxAzimuthAngle: 0, minPolarAngle: Math.PI / 2, maxPolarAngle: Math.PI / 2 } : {})}
      />
      <CameraRig ref={rig} smoothTime={0.6} referenceAspect={0} onArrive={() => { if (modeRef.current === '2d') setFlatLocked(true); }} />
      {groups.map((g) => (
        <instancedMesh
          key={g.kind}
          ref={meshRefs[g.kind]}
          args={[geometries[g.kind], material, g.nodes.length]}
          frustumCulled={false}
          onPointerMove={(e) => { e.stopPropagation(); const i = pick(g.kind, e); if (i !== live.current.hovered) onHover(i); }}
          onPointerOut={() => onHover(null)}
          onClick={(e) => { if (e.delta > 4) return; e.stopPropagation(); const i = pick(g.kind, e); onSelect(i === live.current.selected ? null : i); }}
        />
      ))}
      <lineSegments geometry={edgeGeometry} material={edgeMaterial} frustumCulled={false} ref={lineRef} />
    </>
  );
});

export { CLUSTERS };
