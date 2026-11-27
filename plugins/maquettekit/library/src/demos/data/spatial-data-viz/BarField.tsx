'use client';
/**
 * 384 snow-depth bars in one instanced draw call, lit by ONE light high in the north-west (the top left of the
 * overview), the same direction the page's controls take their shadows from.
 *  - Top faces show the exact sequential colour of the reading (they are what you compare from above), so the colour
 *    encoding never shifts with lighting. Side faces carry the form: shaded by the light, darkened near the ground
 *    (contact occlusion), with a thin highlight along the lit top edge so every bar reads as a solid block.
 *  - A soft shadow is cast toward the south-east onto the ground, drawn on a small canvas from the bar heights and
 *    blurred by texture filtering; it falls on the ground only, never on the bars.
 * Heights and colours tween together between days by interpolating VALUES (`moderate`, token easing); a missing
 * reading cuts to a flat tile, never to a fake value. Frames are rendered on demand only.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry, CanvasTexture, Color, EdgesGeometry, LineBasicMaterial, LinearFilter, Matrix4, MeshBasicMaterial, PlaneGeometry, Quaternion, Vector3,
  type InstancedMesh, type LineSegments,
} from 'three';
import { duration as D, easing as EASE, useStudioMotion } from '../../../motion';
import { CameraRig, OrbitInspect, type CameraPose } from '../../../three';
import { COLS, EXAGGERATION, N, ROWS, type Palette } from './data';

export type Preset = 'overview' | 'windward' | 'plan';
/** Grid centred on the origin: x runs west → east (columns A–X), z north → south (rows 1–16). */
export const PRESETS: Record<Preset, CameraPose> = {
  overview: { position: [-19, 16, 25], target: [0.5, 0.6, 0] },
  windward: { position: [-31, 6.5, 4], target: [0, 1.2, 0] },
  plan: { position: [0, 33, 3.6], target: [0, 0, 0] },
};
/** Direction TO the one light: high, from the north-west. */
const LIGHT = new Vector3(-0.62, 0.92, -0.48).normalize();
const GAP = 0.86;
const GROUND = { w: COLS + 1.4, h: ROWS + 1.4 };
/** Shadow canvas resolution, pixels per world unit (blur comes from linear filtering of this small texture). */
const SHADOW_PX = 4;
const xOf = (i: number) => (i % COLS) - (COLS - 1) / 2;
const zOf = (i: number) => Math.floor(i / COLS) - (ROWS - 1) / 2;
const heightOf = (v: number) => (Number.isFinite(v) ? Math.max(0.03, (v / 100) * EXAGGERATION) : 0.03);

/** The `standard` token as an easing function (cubic-bézier solved by Newton–Raphson). */
const ease = (() => {
  const [x1, y1, x2, y2] = EASE.standard;
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t, sy = (t: number) => ((ay * t + by) * t + cy) * t, dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (p: number) => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    let t = p;
    for (let i = 0; i < 8; i++) { const e = sx(t) - p, d = dx(t); if (Math.abs(e) < 1e-5 || Math.abs(d) < 1e-6) break; t -= e / d; }
    return sy(Math.min(1, Math.max(0, t)));
  };
})();

/** Unlit base colour (exact on top faces) plus side shading from the one light; see the file header. */
function litBarMaterial(): MeshBasicMaterial {
  const m = new MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uLight = { value: LIGHT };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWN;\nvarying float vWY;\nvarying float vTop;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        mat4 barM = modelMatrix;
        #ifdef USE_INSTANCING
          barM = modelMatrix * instanceMatrix;
        #endif
        vWN = normalize(mat3(barM) * normal);
        vWY = (barM * vec4(position, 1.0)).y;
        vTop = (barM * vec4(0.0, 1.0, 0.0, 1.0)).y;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uLight;\nvarying vec3 vWN;\nvarying float vWY;\nvarying float vTop;')
      .replace('#include <opaque_fragment>', `
        float isTop = step(0.5, vWN.y);
        float lambert = max(dot(normalize(vWN), uLight), 0.0);
        float side = 0.56 + 0.4 * lambert;
        float ao = mix(0.66, 1.0, smoothstep(0.0, 1.25, vWY));
        float rim = smoothstep(vTop - 0.08, vTop, vWY) * 0.12 * lambert;
        outgoingLight *= mix(side * ao + rim, 1.0, isTop);
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'mk-snow-bar-lit-v1';
  return m;
}

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
  const material = useMemo(() => litBarMaterial(), []);
  const edges = useMemo(() => new EdgesGeometry(geometry), [geometry]);
  const edgeMat = useMemo(() => new LineBasicMaterial({ color: '#bf2f09', toneMapped: false }), []);
  const ground = useMemo(() => new PlaneGeometry(GROUND.w, GROUND.h), []);
  const groundMat = useMemo(() => new MeshBasicMaterial({ color: '#e9e5da', toneMapped: false }), []);
  // Cast shadow: a small canvas, linear-filtered on the GPU, on a transparent plane just above the ground.
  const shadow = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(GROUND.w * SHADOW_PX);
    canvas.height = Math.round(GROUND.h * SHADOW_PX);
    const tex = new CanvasTexture(canvas);
    tex.magFilter = LinearFilter;
    tex.minFilter = LinearFilter;
    tex.generateMipmaps = false;
    const mat = new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
    return { canvas, ctx: canvas.getContext('2d'), tex, mat };
  }, []);
  useEffect(() => () => {
    geometry.dispose(); material.dispose(); edges.dispose(); edgeMat.dispose(); ground.dispose(); groundMat.dispose();
    shadow?.tex.dispose(); shadow?.mat.dispose();
  }, [geometry, material, edges, edgeMat, ground, groundMat, shadow]);

  // Heights tween between days by interpolating VALUES (a missing reading cuts to a flat tile, never a fake value).
  const current = useMemo(() => Float32Array.from(values), []); // eslint-disable-line react-hooks/exhaustive-deps
  const tween = useRef({ from: Float32Array.from(values), to: values, t: 1 });
  const tmp = useMemo(() => ({ m: new Matrix4(), q: new Quaternion(), p: new Vector3(), s: new Vector3(), c: new Color() }), []);
  const live = useRef({ hovered, selected, pal });
  live.current = { hovered, selected, pal };

  const drawShadow = useCallback(() => {
    if (!shadow?.ctx) return;
    const { ctx, canvas, tex } = shadow;
    const k = SHADOW_PX;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Ground offset of a bar's shadow per unit of height, along the light (toward the south-east).
    const sx = -LIGHT.x / LIGHT.y, sz = -LIGHT.z / LIGHT.y;
    for (let i = 0; i < N; i++) {
      const h = heightOf(current[i]);
      if (h < 0.06) continue;
      const cx = (xOf(i) + GROUND.w / 2) * k, cz = (zOf(i) + GROUND.h / 2) * k;
      // Contact occlusion around the footprint, then the cast shadow swept toward the south-east, fading with length.
      ctx.fillStyle = `rgba(0,0,0,${Math.min(0.34, 0.1 + h * 0.05).toFixed(3)})`;
      ctx.fillRect(cx - 0.6 * k, cz - 0.6 * k, 1.2 * k, 1.2 * k);
      const steps = 5;
      for (let j = 1; j <= steps; j++) {
        const f = j / steps;
        ctx.fillStyle = `rgba(0,0,0,${(0.2 * (1 - f * 0.8) * Math.min(1, h / 2)).toFixed(3)})`;
        ctx.fillRect(cx + (sx * h * f - 0.45) * k, cz + (sz * h * f - 0.45) * k, 0.9 * k, 0.9 * k);
      }
    }
    tex.needsUpdate = true;
  }, [shadow, current]);

  const write = useCallback(() => {
    const m = mesh.current;
    if (!m) return;
    const { pal: p, hovered: h, selected: sel } = live.current;
    for (let i = 0; i < N; i++) {
      tmp.p.set(xOf(i), 0, zOf(i));
      tmp.s.set(GAP, heightOf(current[i]), GAP);
      m.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q, tmp.s));
      // Colour follows the displayed value, so height and colour always say the same thing on every frame.
      m.setColorAt(i, tmp.c.set(Number.isFinite(current[i]) ? p.color(current[i]) : p.missing));
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
    drawShadow();
  }, [current, tmp, groundMat, edgeMat, drawShadow]);

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
    tw.t = Math.min(1, tw.t + Math.min(dt, 0.05) / ((D.moderate * scale.duration) / 1000));
    const e = ease(tw.t);
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
      <OrbitInspect target={[0.5, 0.6, 0]} minDistance={9} maxDistance={70} maxPolarAngle={Math.PI / 2 - 0.08} enablePan={false} />
      <CameraRig presets={PRESETS} preset={preset} smoothTime={0.55} referenceAspect={1.6} />
      <mesh geometry={ground} material={groundMat} rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} />
      {shadow ? <mesh geometry={ground} material={shadow.mat} rotation-x={-Math.PI / 2} position={[0, -0.004, 0]} renderOrder={1} /> : null}
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, N]}
        frustumCulled={false}
        renderOrder={2}
        onPointerMove={(e) => { e.stopPropagation(); if (e.instanceId !== undefined && e.instanceId !== live.current.hovered) onHover(e.instanceId); }}
        onPointerOut={() => onHover(null)}
        onClick={(e) => { if (e.delta > 4 || e.instanceId === undefined) return; e.stopPropagation(); onSelect(e.instanceId === live.current.selected ? null : e.instanceId); }}
      />
      <lineSegments ref={outline} geometry={edges} material={edgeMat} visible={false} renderOrder={3} />
    </>
  );
}
