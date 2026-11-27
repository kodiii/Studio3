'use client';
/**
 * The atlas scene. Data meaning is fixed by data.ts; everything here is presentation:
 *  - nodes: instanced, glazed (env-lit, fresnel rim), sized by calls/min exactly as before;
 *  - links: one instanced tube bent along a quadratic curve in the vertex shader, coloured caller → callee;
 *  - depth: fog towards the paper, contact shadows projected along the key light onto a floor (3D) or onto the
 *    paper behind the map (2D), a camera-relative key light from the upper left that follows the pointer a little,
 *    and a slight parallax of the whole graph towards the pointer (3D only);
 *  - selection: the node pops, a halo ring settles round it, two pulses run along every incident link from caller
 *    to callee and each node they reach answers — then everything is still again (≈2.5 s, so no pause is needed).
 */
import { addAfterEffect, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  Color, CylinderGeometry, Fog, InstancedBufferAttribute, Matrix4, MeshPhysicalMaterial, MeshStandardMaterial, OctahedronGeometry, PlaneGeometry,
  Quaternion, ShaderMaterial, SphereGeometry, Vector3, type DirectionalLight, type Group, type InstancedMesh, type Mesh, type PerspectiveCamera,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { spring as SPRING, useStudioMotion, type SpringConfig } from '../../../motion';
import { CameraRig, LightingRig, OrbitInspect, useQuality, type CameraRigHandle, type LightingPreset, type LightingRigHandle, type OrbitInspectHandle } from '../../../three';
import { CLUSTERS, EDGES_LIST, NODES, PALETTE, layoutBounds, nodeRadius, relax, type ClusterId, type NodeKind } from './data';

export type ViewMode = '3d' | '2d';
const KIND_ORDER: NodeKind[] = ['service', 'store', 'queue', 'external'];
/** Overview viewing directions: a raised three-quarter view for 3D, straight-on for the planar layout. */
const OVERVIEW_DIR = { '3d': new Vector3(0.52, 0.42, 0.74).normalize(), '2d': new Vector3(0, 0, 1) };
const FOCUS_DISTANCE = 7.5;
/** Key light offset in CAMERA space: upper left and towards the viewer — the page's light direction. */
const KEY_VIEW = new Vector3(-6.5, 7.5, 6);
const THEME = {
  light: { bg: '#fbf9f4', ink: '#11110f', shadow: '#2c2418', ring: '#11110f', rim: 0.42 },
  dark: { bg: '#0e0e0c', ink: '#f3f0e8', shadow: '#000000', ring: '#f3f0e8', rim: 0.55 },
} as const;

const ATLAS_LIGHT: LightingPreset = {
  label: 'Atlas', description: 'Soft daylight from the upper left over paper, a cool fill, a back light to lift edges.', exposure: 1,
  ambient: { color: '#ffffff', intensity: 0.3 },
  key: { color: '#fff4e6', intensity: 1.7, position: [-6, 9, 6] },
  fill: { color: '#e6edff', intensity: 0.4, position: [7, 1, 5] },
  rim: { color: '#ffffff', intensity: 0.9, position: [2, 6, -9] },
  env: { room: '#9a968e', intensity: 0.6, panels: [
    { color: '#ffffff', intensity: 7, position: [-6, 7, 5], size: [6, 5] },
    { color: '#fff3e3', intensity: 2.2, position: [0, 9, 0], size: [10, 8] },
    { color: '#dde6fa', intensity: 1.4, position: [7, 2, 4], size: [4, 5] },
  ] },
};

/* ── springs from the motion tokens ───────────────────────────────────────────────────────────────────────────── */
interface Spring { x: number; v: number; to: number }
function stepSpring(s: Spring, cfg: SpringConfig, dt: number): boolean {
  const n = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / n;
  for (let i = 0; i < n; i++) { s.v += ((-cfg.stiffness * (s.x - s.to) - cfg.damping * s.v) / cfg.mass) * h; s.x += s.v * h; }
  if (Math.abs(s.x - s.to) < 1e-4 && Math.abs(s.v) < 1e-3) { s.x = s.to; s.v = 0; return false; }
  return true;
}

/* ── links: a unit cylinder bent along a quadratic curve per instance ─────────────────────────────────────────── */
const LINK_HEAD = /* glsl */ `
attribute vec3 aP0; attribute vec3 aP1; attribute vec3 aP2; attribute vec3 aColA; attribute vec3 aColB; attribute float aWidth; attribute float aFlow;
varying vec3 vLinkColor; varying float vT; varying float vFlow;`;
const LINK_NORMAL = /* glsl */ `
float lt = position.y + 0.5;
vec3 lB = (1.0 - lt) * (1.0 - lt) * aP0 + 2.0 * (1.0 - lt) * lt * aP1 + lt * lt * aP2;
vec3 lT = normalize(2.0 * (1.0 - lt) * (aP1 - aP0) + 2.0 * lt * (aP2 - aP1) + vec3(1e-5, 0.0, 0.0));
vec3 lRef = abs(lT.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
vec3 lN = normalize(cross(lT, lRef));
vec3 lBn = cross(lT, lN);
float lA = atan(position.z, position.x);
vec3 lRadial = cos(lA) * lN + sin(lA) * lBn;
vec3 objectNormal = lRadial;`;
const LINK_BEGIN = /* glsl */ `
vec3 transformed = lB + lRadial * aWidth * (0.6 + 0.4 * sin(lt * 3.14159265));
vT = lt; vLinkColor = mix(aColA, aColB, lt); vFlow = aFlow;`;
const LINK_FRAG_HEAD = /* glsl */ `
uniform float uFlowT; uniform vec3 uPulse;
varying vec3 vLinkColor; varying float vT; varying float vFlow;`;
const LINK_FRAG_PULSE = /* glsl */ `
float lp = 0.0;
for (int k = 0; k < 2; k++) { float c = (uFlowT - float(k) * 0.6) / 1.1; float dd = (vT - c) / 0.07; if (c > -0.1 && c < 1.1) lp += exp(-dd * dd) * (1.0 - float(k) * 0.35); }
totalEmissiveRadiance += uPulse * lp * vFlow;`;

/* ── contact shadows: instanced soft discs on the receiver plane ──────────────────────────────────────────────── */
const SHADOW_VERT = /* glsl */ `attribute float aOpacity; varying vec2 vUv; varying float vO;
void main(){ vUv = uv; vO = aOpacity; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`;
const SHADOW_FRAG = /* glsl */ `uniform vec3 uColor; varying vec2 vUv; varying float vO;
void main(){ float d = length(vUv - 0.5) * 2.0; float a = 1.0 - smoothstep(0.0, 1.0, d); gl_FragColor = vec4(uColor, a * a * vO); }`;

/** DOM labels registered by the page; positions are written after each rendered frame (no React re-render). */
export interface LabelStore { els: Map<string, HTMLElement>; register(key: string, el: HTMLElement | null): void; onChange: (() => void) | null }
export function useLabelStore(): LabelStore {
  return useMemo(() => {
    const els = new Map<string, HTMLElement>();
    const store: LabelStore = {
      els, onChange: null,
      // a newly mounted label needs one frame to be placed; nothing else does
      register(key, el) { if (el) { if (els.get(key) !== el) { els.set(key, el); store.onChange?.(); } } else els.delete(key); },
    };
    return store;
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

// Memoised: the page re-renders on its diagnostics poll, and new inline handler props would make R3F draw a frame.
export const Atlas = memo(forwardRef<AtlasHandle, AtlasProps>(function Atlas({ mode, theme, visible, selected, hovered, matches, labels, onHover, onSelect }, ref) {
  const invalidate = useThree((s) => s.invalidate);
  const get = useThree((s) => s.get);
  const gl = useThree((s) => s.gl);
  const { reduced } = useStudioMotion();
  const quality = useQuality();
  const rig = useRef<CameraRigHandle>(null);
  const orbit = useRef<OrbitInspectHandle>(null);
  const lights = useRef<LightingRigHandle>(null);
  const world = useRef<Group>(null);
  const meshes = useRef<Partial<Record<NodeKind, InstancedMesh | null>>>({});
  const links = useRef<InstancedMesh>(null);
  const shadows = useRef<InstancedMesh>(null);
  const ring = useRef<Mesh>(null);
  const fog = useRef<Fog>(null);
  // In 2D the orbit is locked straight-on — but only once the camera has arrived there, so the lock never snaps it.
  const [flatLocked, setFlatLocked] = useState(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  useEffect(() => { if (mode === '3d') setFlatLocked(false); }, [mode]);

  const layouts = useMemo(() => ({ '3d': relax(false), '2d': relax(true) }), []);
  const current = useMemo(() => Float32Array.from(layouts['3d']), [layouts]);
  const tween = useRef({ from: new Float32Array(current), to: layouts['3d'], t: 1, flat: 0, flatFrom: 0, flatTo: 0 });
  const floorY = useMemo(() => { let m = Infinity; for (let i = 0; i < NODES.length; i++) m = Math.min(m, layouts['3d'][i * 3 + 1]); return m - 1.1; }, [layouts]);

  const groups = useMemo(() => KIND_ORDER.map((kind) => ({ kind, nodes: NODES.filter((n) => n.kind === kind) })).filter((g) => g.nodes.length), []);
  const lacquer = quality.level === 'high';
  const res = useMemo(() => {
    const geometries = {
      service: new SphereGeometry(1, 32, 20),
      store: new CylinderGeometry(0.82, 0.82, 1.45, 32),
      queue: new OctahedronGeometry(1.2, 0),
      external: new RoundedBoxGeometry(1.45, 1.45, 1.45, 3, 0.18),
    };
    const rim = { uRim: { value: 0.45 }, uRimColor: { value: new Color('#fff6ea') } };
    const nodeMat = lacquer
      ? new MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.3, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.18 })
      : new MeshStandardMaterial({ color: '#ffffff', roughness: 0.32, metalness: 0 });
    nodeMat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, rim);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uRim; uniform vec3 uRimColor;')
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nfloat nRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);\ntotalEmissiveRadiance += uRimColor * nRim * uRim;');
    };
    nodeMat.customProgramCacheKey = () => `atlas-node-${lacquer}`;

    // links
    const linkGeo = new CylinderGeometry(1, 1, 1, 7, 14, true);
    const n = EDGES_LIST.length;
    const attr = (size: number) => new InstancedBufferAttribute(new Float32Array(n * size), size);
    const la = { aP0: attr(3), aP1: attr(3), aP2: attr(3), aColA: attr(3), aColB: attr(3), aWidth: attr(1), aFlow: attr(1) };
    for (const [k, v] of Object.entries(la)) linkGeo.setAttribute(k, v);
    const linkUniforms = { uFlowT: { value: 10 }, uPulse: { value: new Color('#fff2dc').multiplyScalar(1.6) } };
    const linkMat = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.45, metalness: 0 });
    linkMat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, linkUniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${LINK_HEAD}`)
        .replace('#include <beginnormal_vertex>', LINK_NORMAL)
        .replace('#include <begin_vertex>', LINK_BEGIN);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${LINK_FRAG_HEAD}`)
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vLinkColor;')
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${LINK_FRAG_PULSE}`);
    };
    linkMat.customProgramCacheKey = () => 'atlas-link-v1';

    // shadows
    const shadowGeo = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const shadowOpacity = new InstancedBufferAttribute(new Float32Array(NODES.length), 1);
    shadowGeo.setAttribute('aOpacity', shadowOpacity);
    const shadowMat = new ShaderMaterial({ uniforms: { uColor: { value: new Color() } }, vertexShader: SHADOW_VERT, fragmentShader: SHADOW_FRAG, transparent: true, depthWrite: false });
    // selection halo
    const ringGeo = new PlaneGeometry(1, 1);
    const ringMat = new ShaderMaterial({
      uniforms: { uColor: { value: new Color() }, uOpacity: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec2 vUv; uniform vec3 uColor; uniform float uOpacity; void main(){ float d = length(vUv - 0.5) * 2.0; float w = fwidth(d) * 1.2; float r = smoothstep(0.915 - w, 0.915, d) * (1.0 - smoothstep(0.95, 0.95 + w, d)); float glow = 0.14 * smoothstep(0.7, 0.915, d) * (1.0 - smoothstep(0.95, 1.0, d)); gl_FragColor = vec4(uColor, (r + glow) * uOpacity); }',
      transparent: true, depthWrite: false, depthTest: false,
    });
    return { geometries, nodeMat, rim, linkGeo, la, linkMat, linkUniforms, shadowGeo, shadowOpacity, shadowMat, ringGeo, ringMat };
  }, [lacquer]);
  useEffect(() => () => {
    Object.values(res.geometries).forEach((g) => g.dispose());
    res.nodeMat.dispose(); res.linkGeo.dispose(); res.linkMat.dispose(); res.shadowGeo.dispose(); res.shadowMat.dispose(); res.ringGeo.dispose(); res.ringMat.dispose();
  }, [res]);

  // Everything the per-frame writers need, without re-subscribing.
  const live = useRef({ visible, selected, hovered, matches, theme, reduced });
  live.current = { visible, selected, hovered, matches, theme, reduced };
  const tmp = useMemo(() => ({
    m: new Matrix4(), q: new Quaternion(), s: new Vector3(), p: new Vector3(), c: new Color(), bg: new Color(), ink: new Color(), a: new Color(), b: new Color(),
    v: new Vector3(), w: new Vector3(), d: new Vector3(), up: new Vector3(0, 1, 0), n: new Vector3(), key: new Vector3(), ld: new Vector3(), o: new Vector3(),
  }), []);

  /* per-node and per-link animated state */
  const anim = useMemo(() => ({
    scale: NODES.map(() => ({ x: 1, v: 0, to: 1 }) as Spring),
    width: new Float32Array(EDGES_LIST.length).fill(0.026),
    ring: { x: 0, v: 0, to: 0 } as Spring,
    flowT: 10,
    bumps: [] as { at: number; nodes: number[]; amount: number }[],
    tilt: { x: 0, y: 0 },
    pointerIn: false,
    dragging: false,
  }), []);

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
    tmp.bg.set(THEME[th].bg);
    for (const g of groups) {
      const mesh = meshes.current[g.kind];
      if (!mesh) continue;
      g.nodes.forEach((n, i) => {
        const shown = vis.has(n.cluster);
        const r = shown ? nodeRadius(n) * anim.scale[n.index].x : 0;
        tmp.p.set(current[n.index * 3], current[n.index * 3 + 1], current[n.index * 3 + 2]);
        tmp.s.setScalar(Math.max(r, 1e-5));
        mesh.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q.identity(), tmp.s));
        const lit = focus ? focus.has(n.index) : hits ? hits.has(n.index) : true;
        tmp.c.set(pal[n.cluster]);
        if (!lit && n.index !== hov) tmp.c.lerp(tmp.bg, 0.78);
        mesh.setColorAt(i, tmp.c);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.boundingSphere = null; // raycasting recomputes it from the moved instances
    }
  };

  /** Link targets for the current selection/hover (widths animate towards them; colours apply at once). */
  const linkTarget = (e: (typeof EDGES_LIST)[number]): number => {
    const { selected: sel, hovered: hov } = live.current;
    if (sel != null) return e.source === sel || e.target === sel ? 0.052 : 0.014;
    if (hov != null && (e.source === hov || e.target === hov)) return 0.04;
    return 0.026;
  };
  const writeLinks = () => {
    const { visible: vis, selected: sel, theme: th } = live.current;
    const pal = PALETTE[th];
    tmp.bg.set(THEME[th].bg);
    tmp.ink.set(THEME[th].ink);
    const flat = tween.current.flat;
    const la = res.la;
    let k = 0;
    for (const e of EDGES_LIST) {
      const s = NODES[e.source], t = NODES[e.target];
      if (!vis.has(s.cluster) || !vis.has(t.cluster)) continue;
      const i = e.source * 3, j = e.target * 3;
      tmp.v.set(current[i], current[i + 1], current[i + 2]);
      tmp.w.set(current[j], current[j + 1], current[j + 2]);
      tmp.d.subVectors(tmp.w, tmp.v);
      const len = tmp.d.length() || 1;
      // Bow: upward arcs in 3D, a consistent sideways bow in the plane in 2D (direction stays readable both ways).
      tmp.n.set(0, 1, 0).multiplyScalar(0.14 * len * (1 - flat));
      tmp.o.set(-tmp.d.y, tmp.d.x, 0).normalize().multiplyScalar(0.1 * len * flat);
      tmp.p.addVectors(tmp.v, tmp.w).multiplyScalar(0.5).add(tmp.n).add(tmp.o);
      la.aP0.setXYZ(k, tmp.v.x, tmp.v.y, tmp.v.z);
      la.aP1.setXYZ(k, tmp.p.x, tmp.p.y, tmp.p.z);
      la.aP2.setXYZ(k, tmp.w.x, tmp.w.y, tmp.w.z);
      const incident = sel != null && (e.source === sel || e.target === sel);
      if (sel == null) {
        // caller end fainter than callee end: direction reads as a gradient towards the dependency
        tmp.a.set(pal[s.cluster]).lerp(tmp.bg, 0.66); tmp.b.set(pal[t.cluster]).lerp(tmp.bg, 0.22);
      } else if (incident) {
        tmp.a.copy(tmp.ink).lerp(tmp.bg, e.source === sel ? 0.05 : 0.5); tmp.b.copy(tmp.ink).lerp(tmp.bg, e.target === sel ? 0.05 : 0.12);
      } else {
        tmp.a.copy(tmp.bg).lerp(tmp.ink, 0.1); tmp.b.copy(tmp.a);
      }
      la.aColA.setXYZ(k, tmp.a.r, tmp.a.g, tmp.a.b);
      la.aColB.setXYZ(k, tmp.b.r, tmp.b.g, tmp.b.b);
      la.aWidth.setX(k, anim.width[e.index]);
      la.aFlow.setX(k, incident ? 1 : 0);
      k++;
    }
    for (const a of Object.values(la)) a.needsUpdate = true;
    if (links.current) links.current.count = k;
  };

  // Restyle on any state change; a new selection starts its pulse train and the bumps on arrival.
  const prevSel = useRef<number | null>(null);
  useEffect(() => {
    const sel = selected;
    if (sel !== prevSel.current) {
      prevSel.current = sel;
      anim.bumps = [];
      if (sel != null && !reduced) {
        anim.flowT = 0;
        const n = NODES[sel];
        // a pulse reaches the far end of a link 1.1 s after it starts; the second follows 0.6 s later
        anim.bumps.push({ at: 1.1, nodes: [...n.out, ...(n.in.length ? [sel] : [])], amount: 2.2 }, { at: 1.7, nodes: [...n.out, ...(n.in.length ? [sel] : [])], amount: 1.3 });
        anim.scale[sel].v += 5; // the pop
      } else anim.flowT = 10;
    }
    NODES.forEach((n) => { anim.scale[n.index].to = n.index === selected ? 1.4 : n.index === hovered ? 1.22 : 1; });
    anim.ring.to = selected != null ? 1 : 0;
    if (reduced) {
      for (const s of anim.scale) { s.x = s.to; s.v = 0; }
      anim.ring.x = anim.ring.to; anim.ring.v = 0;
      EDGES_LIST.forEach((e) => { anim.width[e.index] = linkTarget(e); });
    }
    writeNodes(); writeLinks(); invalidate();
  }, [visible, selected, hovered, matches, theme, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  // Layout morph between the 3D and planar layouts.
  useEffect(() => {
    const tw = tween.current;
    const target = layouts[mode];
    if (tw.to === target) return;
    tw.from.set(current); tw.to = target; tw.t = 0; tw.flatFrom = tw.flat; tw.flatTo = mode === '2d' ? 1 : 0;
    if (reduced) { current.set(target); tw.t = 1; tw.flat = tw.flatTo; writeNodes(); writeLinks(); }
    invalidate();
  }, [mode, layouts, current, reduced, invalidate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pointer presence for the parallax and the light (R3F keeps the last pointer position after leave).
  useEffect(() => {
    const el = gl.domElement;
    const enter = () => { anim.pointerIn = true; invalidate(); };
    const leave = () => { anim.pointerIn = false; invalidate(); };
    el.addEventListener('pointermove', enter);
    el.addEventListener('pointerleave', leave);
    return () => { el.removeEventListener('pointermove', enter); el.removeEventListener('pointerleave', leave); };
  }, [gl, anim, invalidate]);

  useEffect(() => {
    const th = THEME[theme];
    (res.shadowMat.uniforms.uColor.value as Color).set(th.shadow);
    (res.ringMat.uniforms.uColor.value as Color).set(th.ring);
    res.rim.uRim.value = th.rim;
    fog.current?.color.set(th.bg);
    invalidate();
  }, [theme, res, invalidate]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const rm = live.current.reduced;
    let moving = false;
    // layout morph
    const tw = tween.current;
    if (tw.t < 1) {
      tw.t = Math.min(1, tw.t + dt / 0.9);
      const e = easeInOut(tw.t);
      for (let i = 0; i < current.length; i++) current[i] = tw.from[i] + (tw.to[i] - tw.from[i]) * e;
      tw.flat = tw.flatFrom + (tw.flatTo - tw.flatFrom) * e;
      moving = true;
    }
    // springs: node scale, ring, link widths, selection pulses
    if (!rm) {
      if (anim.flowT < 2.4) {
        anim.flowT += dt;
        for (const b of anim.bumps) if (anim.flowT >= b.at && b.amount > 0) { for (const i of b.nodes) anim.scale[i].v += b.amount; b.amount = 0; }
        moving = true;
      }
      for (const s of anim.scale) if (stepSpring(s, s.to > 1.3 ? SPRING.pop : SPRING.settle, dt)) moving = true;
      if (stepSpring(anim.ring, SPRING.settle, dt)) moving = true;
      const k = 1 - Math.exp(-dt * 12);
      for (const e of EDGES_LIST) {
        const to = linkTarget(e), w = anim.width[e.index];
        if (Math.abs(to - w) > 1e-4) { anim.width[e.index] = w + (to - w) * k; moving = true; } else anim.width[e.index] = to;
      }
    }
    res.linkUniforms.uFlowT.value = rm ? 10 : anim.flowT;

    // parallax: the graph turns a few degrees towards the pointer (3D only, never while orbiting)
    const g = world.current;
    const want = !rm && modeRef.current === '3d' && tw.t >= 1 && anim.pointerIn && !anim.dragging;
    const tx = want ? -state.pointer.y * 0.045 : 0, ty = want ? state.pointer.x * 0.07 : 0;
    const pk = 1 - Math.exp(-dt * 4);
    anim.tilt.x += (tx - anim.tilt.x) * pk; anim.tilt.y += (ty - anim.tilt.y) * pk;
    if (Math.abs(tx - anim.tilt.x) + Math.abs(ty - anim.tilt.y) > 2e-4) moving = true;
    if (g) { g.rotation.set(anim.tilt.x, anim.tilt.y, 0); g.updateMatrixWorld(); }

    // key light: camera-relative from the upper left (the page's light), drifting a little towards the pointer
    const cam = state.camera;
    const target = (orbit.current?.controls?.target ?? tmp.o.set(0, 0, 0));
    const key = lights.current?.key;
    if (key) {
      tmp.key.copy(KEY_VIEW);
      if (want) { tmp.key.x += state.pointer.x * 3; tmp.key.y += state.pointer.y * 2; }
      tmp.key.applyQuaternion(cam.quaternion).add(target);
      key.position.lerp(tmp.key, rm ? 1 : 1 - Math.exp(-dt * 6));
      if (key.position.distanceToSquared(tmp.key) > 1e-4) moving = true;
      key.target.position.copy(target);
      key.target.updateMatrixWorld();
    }
    // fog: from just in front of the orbit target to well behind the graph; none in the planar view
    const f = fog.current;
    if (f) {
      const R = bounds['3d'].radius;
      const dist = cam.position.distanceTo(target);
      const far = (1 - tw.flat) < 0.02 ? 1e5 : dist + R * (2.3 + tw.flat * 40);
      f.near = dist - R * 0.3; f.far = far;
    }

    if (moving) { writeNodes(); writeLinks(); }
    writeShadows(key ?? null);
    writeRing();
    if (moving) state.invalidate();
  });

  /** Shadows: every node projected along the key light onto the receiver — the floor in 3D, the paper behind in 2D. */
  const writeShadows = (key: DirectionalLight | null) => {
    const mesh = shadows.current, g = world.current;
    if (!mesh || !g || !key) return;
    const { visible: vis } = live.current;
    const flat = tween.current.flat;
    tmp.ld.subVectors(key.target.position, key.position).normalize();
    // On the floor (3D) the shadows behave like an overhead area light: nearly straight down, drifting a little
    // with the key so they pool under their cluster; on the paper (2D) they are true drop shadows, down and right.
    tmp.d.set(tmp.ld.x * 0.22, -1, tmp.ld.z * 0.22).normalize();
    tmp.ld.lerp(tmp.d, 1 - flat).normalize();
    tmp.n.set(0, 1, 0).lerp(tmp.d.set(0, 0, 1), flat).normalize();                // receiver normal
    tmp.o.set(0, floorY, 0).lerp(tmp.d.set(0, 0, -0.55), flat);                  // a point on the receiver
    tmp.q.setFromUnitVectors(tmp.up, tmp.n);
    const cam = get().camera;
    const camAbove = Math.max(0, Math.min(1, tmp.d.subVectors(cam.position, tmp.o).dot(tmp.n) / 3));
    const denom = tmp.n.dot(tmp.ld);
    let k = 0;
    for (const n of NODES) {
      if (!vis.has(n.cluster)) continue;
      tmp.p.set(current[n.index * 3], current[n.index * 3 + 1], current[n.index * 3 + 2]).applyMatrix4(g.matrixWorld);
      const h = tmp.v.subVectors(tmp.p, tmp.o).dot(tmp.n);                       // height above the receiver
      if (Math.abs(denom) > 0.15) tmp.p.addScaledVector(tmp.ld, -h / denom); else tmp.p.addScaledVector(tmp.n, -h);
      tmp.p.addScaledVector(tmp.n, 0.002 + k * 1e-5);
      const r = nodeRadius(n) * anim.scale[n.index].x;
      const hh = Math.max(0, h);
      const spread = r * (2.5 + hh * 0.32) + hh * 0.08;
      mesh.setMatrixAt(k, tmp.m.compose(tmp.p, tmp.q, tmp.s.set(spread, 1, spread)));
      res.shadowOpacity.setX(k, (0.34 / (1 + hh * 0.3)) * camAbove * (focusDim(n.index)));
      k++;
    }
    mesh.count = k;
    mesh.instanceMatrix.needsUpdate = true;
    res.shadowOpacity.needsUpdate = true;
  };
  const focusDim = (i: number): number => {
    const f = focusSet();
    return f && !f.has(i) ? 0.35 : 1;
  };
  const writeRing = () => {
    const r = ring.current, g = world.current;
    const sel = live.current.selected;
    if (!r || !g) return;
    (res.ringMat.uniforms.uOpacity as { value: number }).value = Math.max(0, Math.min(1, anim.ring.x)) * 0.75;
    r.visible = anim.ring.x > 0.01 && sel != null;
    if (sel == null) return;
    r.position.set(current[sel * 3], current[sel * 3 + 1], current[sel * 3 + 2]).applyMatrix4(g.matrixWorld);
    r.quaternion.copy(get().camera.quaternion);
    const s = nodeRadius(NODES[sel]) * 1.4 * 2.6 * (0.7 + 0.3 * Math.min(1.2, anim.ring.x));
    r.scale.set(s, s, s);
  };

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

  // Labels: projected after every rendered frame so they match the pixels exactly (through the parallax group).
  const sizeRef = useRef(size);
  sizeRef.current = size;
  useEffect(() => addAfterEffect(() => {
    const cam = get().camera;
    const g = world.current;
    const { width, height } = sizeRef.current;
    cam.updateMatrixWorld();
    for (const [key, el] of labels.els) {
      if (key.startsWith('n:')) {
        const i = Number(key.slice(2));
        tmp.p.set(current[i * 3], current[i * 3 + 1] + nodeRadius(NODES[i]) * 1.5 * anim.scale[i].x, current[i * 3 + 2]);
      } else {
        const cid = key.slice(2) as ClusterId;
        let cx = 0, cy = -Infinity, cz = 0, cnt = 0;
        for (const n of NODES) if (n.cluster === cid) { cx += current[n.index * 3]; cy = Math.max(cy, current[n.index * 3 + 1]); cz += current[n.index * 3 + 2]; cnt++; }
        tmp.p.set(cx / cnt, cy + 0.9, cz / cnt);
      }
      if (g) tmp.p.applyMatrix4(g.matrixWorld);
      tmp.p.project(cam);
      if (tmp.p.z > 1 || tmp.p.z < -1) { el.style.visibility = 'hidden'; continue; }
      el.style.visibility = 'visible';
      el.style.transform = `translate3d(${((tmp.p.x * 0.5 + 0.5) * width).toFixed(1)}px, ${((-tmp.p.y * 0.5 + 0.5) * height).toFixed(1)}px, 0) translate(-50%, -100%)`;
    }
  }), [get, labels, current, tmp, anim]);
  useEffect(() => { labels.onChange = invalidate; invalidate(); return () => { labels.onChange = null; }; }, [labels, invalidate]);

  const meshRefs = useMemo(() => Object.fromEntries(KIND_ORDER.map((kind) => [kind, (m: InstancedMesh | null) => {
    meshes.current[kind] = m;
    if (m) { writeNodes(); invalidate(); }
  }])) as Record<NodeKind, (m: InstancedMesh | null) => void>, [res]); // eslint-disable-line react-hooks/exhaustive-deps
  const linkRef = useCallback((l: InstancedMesh | null) => { links.current = l; if (l) { writeLinks(); invalidate(); } }, [res]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (kind: NodeKind, e: ThreeEvent<PointerEvent | MouseEvent>): number | null => {
    const g = groups.find((x) => x.kind === kind);
    const n = e.instanceId != null ? g?.nodes[e.instanceId] : undefined;
    return n && live.current.visible.has(n.cluster) ? n.index : null;
  };

  return (
    <>
      <LightingRig ref={lights} preset={ATLAS_LIGHT} shadow="none" />
      <fog ref={fog} attach="fog" args={[THEME[theme].bg, 10, 1e5]} />
      <OrbitInspect
        ref={orbit} enablePan minDistance={3} maxDistance={60} minPolarAngle={0.05} maxPolarAngle={Math.PI * 0.62}
        onStart={() => { anim.dragging = true; }} onEnd={() => { anim.dragging = false; }}
        {...(mode === '2d' && flatLocked ? { minAzimuthAngle: 0, maxAzimuthAngle: 0, minPolarAngle: Math.PI / 2, maxPolarAngle: Math.PI / 2 } : {})}
      />
      <CameraRig ref={rig} smoothTime={0.6} referenceAspect={0} onArrive={() => { if (modeRef.current === '2d') setFlatLocked(true); }} />
      <group ref={world}>
        {groups.map((g) => (
          <instancedMesh
            key={`${g.kind}-${lacquer}`}
            ref={meshRefs[g.kind]}
            args={[res.geometries[g.kind], res.nodeMat, g.nodes.length]}
            frustumCulled={false}
            onPointerMove={(e) => { e.stopPropagation(); const i = pick(g.kind, e); if (i !== live.current.hovered) onHover(i); }}
            onPointerOut={() => onHover(null)}
            onClick={(e) => { if (e.delta > 4) return; e.stopPropagation(); const i = pick(g.kind, e); onSelect(i === live.current.selected ? null : i); }}
          />
        ))}
        <instancedMesh key={`links-${lacquer}`} ref={linkRef} args={[res.linkGeo, res.linkMat, EDGES_LIST.length]} frustumCulled={false} raycast={noRaycast} />
      </group>
      <instancedMesh ref={shadows} args={[res.shadowGeo, res.shadowMat, NODES.length]} frustumCulled={false} renderOrder={-1} raycast={noRaycast} />
      <mesh ref={ring} geometry={res.ringGeo} material={res.ringMat} renderOrder={5} visible={false} raycast={noRaycast} />
    </>
  );
}));
const noRaycast = () => null;

export { CLUSTERS };
