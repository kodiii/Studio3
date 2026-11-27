'use client';
/**
 * The physics chunk. Everything that imports @react-three/rapier (and with it the Rapier WebAssembly build) lives in
 * this module, which the page loads with React.lazy only once WebGL is confirmed and the canvas is on screen.
 *
 * Two rules keep the engine sound:
 *  1. Every body mutation that starts in a DOM or R3F event (grab, release, nudge, lift, drop, wake) is QUEUED and
 *     applied inside useBeforePhysicsStep, at a known point of the step, never from the event handler itself.
 *  2. Every read goes through `alive()`: @react-three/rapier 2.2 calls a function `ref` with the body when it is
 *     created but never with `null` when it is removed, so a registry filled from refs keeps freed bodies. Touching
 *     one (a thrown block that fell out of the world, a removed or recycled block) panics inside Rapier and poisons
 *     every later call — the "unreachable" / "recursive use of an object" crash this demo used to have.
 *
 * Everything visual that is not simulation (the drop-in, landing squash, hover lift and rim light, contact shadows,
 * the selection ring) is a spring on the visual mesh only: the bodies never move for decoration.
 */
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { BallCollider, CuboidCollider, CylinderCollider, Physics, RigidBody, useAfterPhysicsStep, useBeforePhysicsStep, useRapier, type RapierRigidBody } from '@react-three/rapier';
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  Color, InstancedBufferAttribute, Matrix4, Plane, PlaneGeometry, Quaternion, Raycaster, ShaderMaterial, Vector2, Vector3,
  type BufferGeometry, type Group, type InstancedMesh, type Mesh,
} from 'three';
import { spring as SPRING, type SpringConfig } from '../../../motion';
import { useQuality } from '../../../three';
import { BOUNDS, COLOURS, SHAPES, TABLE, type BodySpec, type ShapeId } from './bodies';
import { KEY_LIGHT } from './Table';
import { createToyGeometries, createWoodMaterial, type WoodUniforms } from './wood';

export type BodyState = 'resting' | 'moving' | 'held';
export interface WorldStatus { awake: number; total: number; states: Record<number, BodyState>; steps: number }
export interface WorldHandle {
  nudge(id: number, dir: 'left' | 'right' | 'away' | 'toward'): void;
  lift(id: number): void;
  drop(id: number): void;
  isHeld(id: number): boolean;
  /** Land every block of the drop-in at once. */
  skipIntro(): void;
}
export interface WorldProps {
  bodies: readonly BodySpec[];
  paused: boolean;
  gravity: [number, number, number];
  selected: number | null;
  /** Play the drop-in when the table first appears (false under reduced motion: blocks are simply placed). */
  intro: boolean;
  /** Decorative motion (squash, hover lift, rim fade) off: states still change, instantly. */
  reduced: boolean;
  onSelect: (id: number | null) => void;
  /** Bodies that left the world (fell off the table and out of bounds). */
  onRemove: (ids: number[]) => void;
  onStatus: (s: WorldStatus) => void;
  onReady: () => void;
  onIntro?: (playing: boolean) => void;
}

/* Rapier's numeric body types (RigidBodyType enum): avoids importing the enum from the WASM module. */
const TYPE = { dynamic: 0, kinematicPosition: 2 } as const;
const UP = new Vector3(0, 1, 0);
/** Horizontal shadow drift per unit of height, along the key light's direction (KEY_LIGHT = upper left). */
const KEY_SHADOW = new Vector2(-KEY_LIGHT[0], -KEY_LIGHT[2]).multiplyScalar(1 / KEY_LIGHT[1]);

/** The drop-in: blocks fall into place one after another, lowest first (seconds, scene units). */
const INTRO = { stagger: 0.11, fall: 0.42, height: 2.6 };
interface IntroState { delay: Map<number, number>; clock: number }

/* ── A tiny spring integrator driven by the motion tokens ───────────────────────────────────────────────────────── */
interface Spring { x: number; v: number; to: number }
const spring = (x: number): Spring => ({ x, v: 0, to: x });
/** Advances `s` by `dt` (semi-implicit Euler, sub-stepped). Returns true while it is still moving. */
function stepSpring(s: Spring, cfg: SpringConfig, dt: number): boolean {
  const n = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    s.v += ((-cfg.stiffness * (s.x - s.to) - cfg.damping * s.v) / cfg.mass) * h;
    s.x += s.v * h;
  }
  if (Math.abs(s.x - s.to) < 1e-4 && Math.abs(s.v) < 1e-3) { s.x = s.to; s.v = 0; return false; }
  return true;
}

/** Distance from a shape's centre to its lowest point along the unit direction `a` (in the shape's local space). */
function support(shape: ShapeId, a: Vector3): number {
  const [sx, sy, sz] = SHAPES[shape].size;
  if (shape === 'ball') return sx / 2;
  if (shape === 'pillar') return Math.abs(a.y) * (sy / 2) + (sx / 2) * Math.sqrt(Math.max(0, 1 - a.y * a.y));
  return Math.abs(a.x) * (sx / 2) + Math.abs(a.y) * (sy / 2) + Math.abs(a.z) * (sz / 2);
}

/* ── Per-toy visual state (never React state) ──────────────────────────────────────────────────────────────────── */
interface ToyVisual {
  spec: BodySpec;
  group: Group;
  uniforms: WoodUniforms;
  lift: Spring;
  rim: Spring;
  squash: Spring;
  /** Intro: height above the resting pose; < 0 = not dropped yet (hidden). */
  drop: number;
  prevVy: number;
  /** Visual bottom height above the tabletop and footprint, written each frame for the shadows. */
  h: number;
  x: number;
  z: number;
  yaw: number;
  major: number;
  minor: number;
  onTable: boolean;
}

/* ── Contact shadows: a tight contact layer and a wide soft layer per body, one instanced draw call ─────────────── */
/** Two layers per body at the 40-body cap. */
const SHADOW_CAPACITY = 80;
const SHADOW_VERT = /* glsl */ `attribute vec3 aShadow; varying vec2 vUv; varying vec3 vS;
void main(){ vUv = uv; vS = aShadow; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`;
const SHADOW_FRAG = /* glsl */ `varying vec2 vUv; varying vec3 vS;
void main(){
  vec2 q = abs(vUv - 0.5) * 2.0;
  float d = pow(pow(q.x, vS.y) + pow(q.y, vS.y), 1.0 / vS.y);   // superellipse: square-ish for boxes, round for balls
  float a = 1.0 - smoothstep(vS.z, 1.0, d);
  gl_FragColor = vec4(0.09, 0.06, 0.035, a * a * vS.x);           // warm, never pure black
}`;

/* ── One toy ──────────────────────────────────────────────────────────────────────────────────────────────────── */
interface ToyProps {
  spec: BodySpec;
  geometry: BufferGeometry;
  shadows: boolean;
  lacquer: boolean;
  register: (id: number, rb: RapierRigidBody | null) => void;
  attach: (id: number, v: Omit<ToyVisual, 'spec'> | null, spec: BodySpec) => void;
  onGrab: (id: number, e: ThreeEvent<PointerEvent>) => void;
  onHover: (id: number | null, e: ThreeEvent<PointerEvent>) => void;
}
const Toy = memo(function Toy({ spec, geometry, shadows, lacquer, register, attach, onGrab, onHover }: ToyProps) {
  const [x, y, z] = SHAPES[spec.shape].size;
  const hex = COLOURS.find((c) => c.id === spec.colour)?.hex ?? '#c9a26c';
  const wood = useMemo(() => createWoodMaterial({
    color: hex, seed: spec.id * 3 + 1, axis: spec.shape === 'pillar' || spec.shape === 'ball' ? 1 : 0,
    scale: spec.shape === 'ball' ? 4 : 3.2, grain: spec.colour === 'birch' ? 0.3 : 0.24, roughness: lacquer ? 0.46 : 0.5, lacquer,
  }), [hex, spec.id, spec.shape, spec.colour, lacquer]);
  useEffect(() => () => wood.material.dispose(), [wood]);
  // Stable per body: the registry entry is replaced whenever @react-three/rapier (re)creates the body.
  const bodyRef = useCallback((rb: RapierRigidBody | null) => register(spec.id, rb), [spec.id, register]);
  // ...and removed here, because the library never calls the ref with null.
  useEffect(() => () => register(spec.id, null), [spec.id, register]);
  const groupRef = useCallback((g: Group | null) => {
    attach(spec.id, g ? { group: g, uniforms: wood.uniforms, lift: spring(0), rim: spring(0), squash: spring(1), drop: 0, prevVy: 0, h: 0, x: 0, z: 0, yaw: 0, major: 0, minor: 0, onTable: false } : null, spec);
  }, [attach, spec, wood]);
  const rotation = useMemo(() => [0, spec.yaw, 0] as [number, number, number], [spec.yaw]);
  return (
    <RigidBody
      ref={bodyRef}
      colliders={false} position={spec.position} rotation={rotation}
      friction={0.75} restitution={spec.shape === 'ball' ? 0.42 : 0.06} linearDamping={0.05} angularDamping={0.25} ccd={spec.shape === 'plank'}
    >
      {spec.shape === 'ball' ? <BallCollider args={[x / 2]} />
        : spec.shape === 'pillar' ? <CylinderCollider args={[y / 2, x / 2]} />
        : <CuboidCollider args={[x / 2, y / 2, z / 2]} />}
      <group ref={groupRef} matrixAutoUpdate={false}>
        <mesh
          geometry={geometry} material={wood.material} castShadow={shadows} receiveShadow={shadows}
          onPointerDown={(e) => onGrab(spec.id, e)}
          onPointerOver={(e) => onHover(spec.id, e)}
          onPointerOut={(e) => onHover(null, e)}
        />
      </group>
    </RigidBody>
  );
});

/* ── The simulation ───────────────────────────────────────────────────────────────────────────────────────────── */
type SimProps = Omit<WorldProps, 'gravity'> & { gravityKey: string };
const Simulation = forwardRef<WorldHandle, SimProps>(function Simulation(
  { bodies, paused, selected, intro, reduced, gravityKey, onSelect, onRemove, onStatus, onReady, onIntro }, ref,
) {
  const { world, step } = useRapier();
  const { shadows, level } = useQuality();
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const geometries = useMemo(() => createToyGeometries(), []);
  useEffect(() => () => Object.values(geometries).forEach((g) => g.dispose()), [geometries]);

  const rigid = useRef(new Map<number, RapierRigidBody>()).current;
  const visuals = useRef(new Map<number, ToyVisual>()).current;
  const held = useRef(new Map<number, Vector3>()).current;
  /** Body mutations waiting for the next physics step (see rule 1 above). */
  const queue = useRef<(() => void)[]>([]).current;
  const steps = useRef(0);
  const hover = useRef<number | null>(null);
  const live = useRef({ paused, bodies, onRemove, onSelect, onIntro, reduced, selected });
  live.current = { paused, bodies, onRemove, onSelect, onIntro, reduced, selected };
  const drag = useRef<{ id: number; pointer: number; plane: Plane; offset: Vector3; target: Vector3; samples: { p: Vector3; t: number }[] } | null>(null);
  const tmp = useMemo(() => ({
    ray: new Raycaster(), ndc: new Vector2(), hit: new Vector3(), n: new Vector3(), v: new Vector3(), w: new Vector3(),
    q: new Quaternion(), qi: new Quaternion(), up: new Quaternion(), a: new Vector3(), m: new Matrix4(), s: new Vector3(), p: new Vector3(),
  }), []);

  /** The body for `id` if it still exists in this world (identity check: handles are recycled by index). */
  const alive = useCallback((id: number): RapierRigidBody | null => {
    const rb = rigid.get(id);
    if (!rb) return null;
    if (world.getRigidBody(rb.handle) !== rb) { rigid.delete(id); held.delete(id); return null; }
    return rb;
  }, [rigid, held, world]);
  const enqueue = useCallback((fn: () => void) => { queue.push(fn); invalidate(); }, [queue, invalidate]);
  const setType = (rb: RapierRigidBody, type: number) => rb.setBodyType(type as unknown as Parameters<RapierRigidBody['setBodyType']>[0], true);

  useEffect(() => { onReady(); }, [onReady]);
  const register = useCallback((id: number, rb: RapierRigidBody | null) => {
    if (rb) rigid.set(id, rb); else { rigid.delete(id); held.delete(id); if (drag.current?.id === id) drag.current = null; }
  }, [rigid, held]);
  /* Intro: blocks fall into place one after another, lowest first, and squash when they land. Visual only, decided
     once per mounted world (the page remounts the world on Reset, which replays it). */
  const [plan] = useState<Map<number, number> | null>(() => {
    if (!intro) return null;
    const order = [...bodies].sort((a, b) => a.position[1] - b.position[1] || a.position[0] - b.position[0]);
    return new Map(order.map((b, i) => [b.id, i * INTRO.stagger]));
  });
  const introRef = useRef<IntroState | null | undefined>(undefined);
  if (introRef.current === undefined) introRef.current = plan ? { delay: plan, clock: 0 } : null;
  const endIntro = useCallback(() => {
    if (!introRef.current) return;
    introRef.current = null;
    for (const v of visuals.values()) v.drop = 0;
    live.current.onIntro?.(false);
    invalidate();
  }, [visuals, invalidate]);
  useEffect(() => { if (introRef.current) live.current.onIntro?.(true); return () => { live.current.onIntro?.(false); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (reduced || paused) endIntro(); }, [reduced, paused, endIntro]);

  const attach = useCallback((id: number, v: Omit<ToyVisual, 'spec'> | null, spec: BodySpec) => {
    if (!v) { visuals.delete(id); if (hover.current === id) hover.current = null; return; }
    const prev = visuals.get(id);
    // Keep the spring state across re-attachments (StrictMode, material swaps); start hidden while the intro waits.
    visuals.set(id, prev ? { ...prev, ...v, lift: prev.lift, rim: prev.rim, squash: prev.squash, drop: prev.drop, spec } : { ...v, spec, drop: introRef.current ? -1 : 0 });
    invalidate();
  }, [visuals, invalidate]);

  const squash = (v: ToyVisual, amount: number) => {
    if (live.current.reduced) return;
    v.squash.x = Math.min(v.squash.x, 1 - amount);
    v.squash.v = 0;
    invalidate();
  };

  useImperativeHandle(ref, () => ({
    nudge(id, dir) {
      endIntro();
      if (!alive(id) || live.current.paused) return;
      const d = dir === 'left' ? [-1, 0] : dir === 'right' ? [1, 0] : dir === 'away' ? [0, -1] : [0, 1];
      const target = held.get(id);
      if (target) { target.x = Math.max(-3.2, Math.min(3.2, target.x + d[0] * 0.4)); target.z = Math.max(-2, Math.min(2, target.z + d[1] * 0.4)); invalidate(); return; }
      enqueue(() => { const rb = alive(id); if (!rb) return; const m = rb.mass(); rb.applyImpulse({ x: d[0] * m * 2.4, y: m * 0.6, z: d[1] * m * 2.4 }, true); });
    },
    lift(id) {
      endIntro();
      const rb = alive(id);
      if (!rb || live.current.paused) return;
      const t = rb.translation();
      held.set(id, new Vector3(t.x, Math.max(t.y + 1.2, 2.4), t.z));
      enqueue(() => { const b = alive(id); if (b) setType(b, TYPE.kinematicPosition); });
    },
    drop(id) {
      if (!alive(id) || !held.has(id)) return;
      held.delete(id);
      enqueue(() => { const b = alive(id); if (!b) return; setType(b, TYPE.dynamic); b.setLinvel({ x: 0, y: 0, z: 0 }, true); b.setAngvel({ x: 0, y: 0, z: 0 }, true); });
    },
    isHeld: (id) => held.has(id),
    skipIntro: endIntro,
  }), [alive, held, enqueue, endIntro, invalidate]); // eslint-disable-line react-hooks/exhaustive-deps

  useBeforePhysicsStep(() => {
    // 1. Mutations requested by events since the last step, in order.
    if (queue.length) for (const fn of queue.splice(0)) fn();
    // 2. Held bodies (pointer drag, keyboard lift) glide to their targets as kinematic bodies and turn upright.
    for (const [id, target] of held) {
      const rb = alive(id);
      if (!rb || !rb.isKinematic()) continue;
      const t = rb.translation();
      tmp.v.set(t.x, t.y, t.z);
      if (tmp.v.distanceToSquared(target) > 1e-6) rb.setNextKinematicTranslation(tmp.v.lerp(target, 0.3));
      const r = rb.rotation();
      tmp.q.set(r.x, r.y, r.z, r.w);
      if (1 - Math.abs(tmp.q.w) > 1e-5 || Math.abs(tmp.q.x) + Math.abs(tmp.q.z) > 1e-4) {
        const yaw = Math.atan2(2 * (r.w * r.y + r.x * r.z), 1 - 2 * (r.y * r.y + r.x * r.x));
        rb.setNextKinematicRotation(tmp.q.slerp(tmp.up.setFromAxisAngle(UP, yaw), 0.25));
      }
    }
  });

  // Out of bounds → removed (the page drops them from its list, which unmounts the RigidBody); landings → squash.
  useAfterPhysicsStep(() => {
    steps.current++;
    let gone: number[] | null = null;
    for (const id of [...rigid.keys()]) {
      const rb = alive(id);
      if (!rb) continue;
      const t = rb.translation();
      if (t.y < BOUNDS.minY || Math.abs(t.x) > BOUNDS.maxXZ || Math.abs(t.z) > BOUNDS.maxXZ) { (gone ??= []).push(id); continue; }
      const v = visuals.get(id);
      if (!v) continue;
      if (rb.isKinematic()) { v.prevVy = 0; continue; }
      const vy = rb.linvel().y;
      if (v.prevVy < -2.2 && vy > v.prevVy * 0.35) squash(v, Math.min(0.11, (-v.prevVy - 1.6) * 0.022));
      v.prevVy = vy;
    }
    if (gone) { const ids = gone; queueMicrotask(() => live.current.onRemove(ids)); }
  });

  // Gravity changed: sleeping bodies do not notice by themselves.
  const wakeAll = useCallback(() => enqueue(() => { for (const id of [...rigid.keys()]) alive(id)?.wakeUp(); }), [enqueue, rigid, alive]);
  useEffect(() => { if (!paused) wakeAll(); }, [paused, gravityKey, wakeAll]);

  /* Contact shadows + selection ring resources */
  const shadowMesh = useRef<InstancedMesh>(null);
  const shadowRes = useMemo(() => {
    const geometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const attr = new InstancedBufferAttribute(new Float32Array(SHADOW_CAPACITY * 3), 3);
    geometry.setAttribute('aShadow', attr);
    const material = new ShaderMaterial({ vertexShader: SHADOW_VERT, fragmentShader: SHADOW_FRAG, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    return { geometry, material, attr };
  }, []);
  useEffect(() => () => { shadowRes.geometry.dispose(); shadowRes.material.dispose(); }, [shadowRes]);
  const ring = useRef<Mesh>(null);
  const ringRes = useMemo(() => {
    const geometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const material = new ShaderMaterial({
      uniforms: { uColor: { value: new Color('#2a1a0c') }, uOpacity: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec2 vUv; uniform vec3 uColor; uniform float uOpacity; void main(){ float d = length(vUv - 0.5) * 2.0; float w = fwidth(d) * 1.5; float ring = smoothstep(0.88 - w, 0.88, d) * (1.0 - smoothstep(0.93, 0.93 + w, d)) + 0.22 * smoothstep(0.75, 0.9, d) * (1.0 - smoothstep(0.9, 0.98, d)); gl_FragColor = vec4(uColor, ring * uOpacity); }',
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3,
    });
    return { geometry, material, opacity: spring(0) };
  }, []);
  useEffect(() => () => { ringRes.geometry.dispose(); ringRes.material.dispose(); }, [ringRes]);

  // The frame: fixed-timestep stepping on our own clock (frame delta clamped to 50 ms, so a resumed demand loop never
  // fast-forwards), then the visual layer. Rapier's step() requests frames while any body is awake; the visual layer
  // requests them while a spring is still moving — otherwise the canvas is idle.
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    if (!live.current.paused) step(dt);
    let moving = false;
    const rm = live.current.reduced;
    const sel = live.current.selected;

    // intro clock
    const it = introRef.current;
    if (it) { it.clock += dt; moving = true; }
    let pending = 0;
    let shadowCount = 0;
    const attr = shadowRes.attr;
    for (const [id, v] of visuals) {
      const parent = v.group.parent;
      if (!parent) continue;
      // intro drop
      if (it) {
        const t = it.clock - (it.delay.get(id) ?? 0);
        if (t < 0) { v.drop = -1; pending++; }
        else if (t < INTRO.fall) { v.drop = INTRO.height * (1 - (t / INTRO.fall) ** 2); pending++; }
        else if (v.drop !== 0) {
          v.drop = 0;
          squash(v, 0.1);
          // follow-through: whatever it landed on gives a little too
          for (const o of visuals.values()) if (o !== v && o.drop === 0 && o.onTable && Math.hypot(o.x - v.x, o.z - v.z) < 0.55) squash(o, 0.035);
        }
      }
      // spring targets
      const isHeld = held.has(id) || drag.current?.id === id;
      const hovered = hover.current === id && !drag.current;
      v.rim.to = isHeld ? 0.9 : hovered ? 0.75 : sel === id ? 0.25 : 0;
      v.lift.to = hovered && !rm && !loadedFromAbove(v) ? 0.085 : 0;
      if (rm) { v.rim.x = v.rim.to; v.rim.v = 0; v.lift.x = v.lift.to; v.lift.v = 0; v.squash.x = 1; v.squash.v = 0; }
      else {
        if (stepSpring(v.rim, SPRING.press, dt)) moving = true;
        if (stepSpring(v.lift, SPRING.settle, dt)) moving = true;
        if (stepSpring(v.squash, SPRING.pop, dt)) moving = true;
      }
      v.uniforms.uRim.value = Math.max(0, v.rim.x);

      // Visual matrix in the body's local space: squash about the contact point along world-up, plus lift/drop.
      tmp.qi.copy(parent.quaternion).invert();
      const a = tmp.a.copy(UP).applyQuaternion(tmp.qi);
      const sup = support(v.spec.shape, a);
      const s = Math.max(0.6, v.squash.x), k = 1 / Math.sqrt(s), d = s - k;
      const off = Math.max(0, v.lift.x) + Math.max(0, v.drop);
      const e = tmp.m.elements;
      e[0] = k + d * a.x * a.x; e[4] = d * a.x * a.y; e[8] = d * a.x * a.z;
      e[1] = d * a.y * a.x; e[5] = k + d * a.y * a.y; e[9] = d * a.y * a.z;
      e[2] = d * a.z * a.x; e[6] = d * a.z * a.y; e[10] = k + d * a.z * a.z;
      // translation: pivot p = -a·sup stays put; t = p - M p + a·off
      const px = -a.x * sup, py = -a.y * sup, pz = -a.z * sup;
      e[12] = px - (e[0] * px + e[4] * py + e[8] * pz) + a.x * off;
      e[13] = py - (e[1] * px + e[5] * py + e[9] * pz) + a.y * off;
      e[14] = pz - (e[2] * px + e[6] * py + e[10] * pz) + a.z * off;
      e[3] = 0; e[7] = 0; e[11] = 0; e[15] = 1;
      v.group.matrix.copy(tmp.m);
      v.group.matrixWorldNeedsUpdate = true;
      v.group.visible = v.drop >= 0;

      // Footprint for the shadows: project the body's local axes onto the table, take the widest as the major axis.
      const pos = parent.position;
      v.x = pos.x; v.z = pos.z;
      v.h = Math.max(0, pos.y - sup + off);
      v.onTable = v.drop >= 0 && Math.abs(pos.x) < TABLE.width / 2 + 0.05 && Math.abs(pos.z) < TABLE.depth / 2 + 0.05 && pos.y > -0.3;
      footprint(v, parent.quaternion);
      if (v.onTable && shadowCount < SHADOW_CAPACITY - 1) {
        const hx = v.h;
        const lift = Math.min(1, hx);
        // contact layer: tight and dark at rest, gone once lifted (ambient occlusion where it touches)
        writeShadow(shadowMesh.current, attr, shadowCount++, v, hx * 0.35, 1.0 + hx * 0.5, (shadows ? 0.55 : 0.82) * Math.max(0, 1 - hx * 2.4), v.spec.shape === 'ball' || v.spec.shape === 'pillar' ? 2 : 4, 0.35);
        // ambient layer: wide and soft, drifts away from the key light and grows with height
        writeShadow(shadowMesh.current, attr, shadowCount++, v, 0.12 + hx * 0.9, 1.45 + hx * 0.85, (shadows ? 0.16 : 0.42) * (1 - lift * 0.5), 2.4, 0);
      }
    }
    const sm = shadowMesh.current;
    if (sm) { sm.count = shadowCount; sm.instanceMatrix.needsUpdate = true; attr.needsUpdate = true; }
    if (it && pending === 0 && it.clock > 0.2) endIntro();

    // Selection ring under the selected body.
    const rv = sel != null ? visuals.get(sel) : undefined;
    ringRes.opacity.to = rv && rv.onTable ? 0.72 : 0;
    if (rm) ringRes.opacity.x = ringRes.opacity.to; else if (stepSpring(ringRes.opacity, SPRING.press, dt)) moving = true;
    const rg = ring.current;
    if (rg) {
      (ringRes.material.uniforms.uOpacity as { value: number }).value = ringRes.opacity.x;
      rg.visible = ringRes.opacity.x > 0.01;
      if (rv) { const r = Math.max(rv.major, rv.minor) * 2 + 0.34; rg.position.set(rv.x, 0.006, rv.z); rg.scale.set(r, 1, r); }
    }
    if (moving || queue.length) state.invalidate();
  });

  /** Something rests on top of this body: lifting it would push its mesh into the one above. */
  function loadedFromAbove(v: ToyVisual): boolean {
    for (const o of visuals.values()) {
      if (o === v || !o.onTable) continue;
      if (o.h > v.h + 0.05 && Math.hypot(o.x - v.x, o.z - v.z) < Math.max(o.major, v.major) + 0.1) return true;
    }
    return false;
  }
  function footprint(v: ToyVisual, q: Quaternion) {
    const [sx, sy, sz] = SHAPES[v.spec.shape].size;
    if (v.spec.shape === 'ball') { v.major = v.minor = sx / 2; v.yaw = 0; return; }
    const axes = [tmp.p.set(sx / 2, 0, 0).applyQuaternion(q).clone(), tmp.p.set(0, sy / 2, 0).applyQuaternion(q).clone(), tmp.p.set(0, 0, sz / 2).applyQuaternion(q).clone()];
    let best = axes[0];
    for (const ax of axes) if (ax.x * ax.x + ax.z * ax.z > best.x * best.x + best.z * best.z) best = ax;
    const len = Math.hypot(best.x, best.z) || 1;
    const mx = best.x / len, mz = best.z / len;
    let major = 0, minor = 0;
    for (const ax of axes) { major += Math.abs(ax.x * mx + ax.z * mz); minor += Math.abs(-ax.x * mz + ax.z * mx); }
    if (v.spec.shape === 'pillar') { minor = Math.max(minor, sx / 2); major = Math.max(major, sx / 2); }
    v.major = major; v.minor = minor; v.yaw = Math.atan2(-mz, mx);
  }
  function writeShadow(mesh: InstancedMesh | null, attr: InstancedBufferAttribute, i: number, v: ToyVisual, drift: number, grow: number, opacity: number, round: number, core: number) {
    if (!mesh) return;
    tmp.q.setFromAxisAngle(UP, v.yaw);
    tmp.p.set(v.x + KEY_SHADOW.x * drift, 0.004 + i * 1e-5, v.z + KEY_SHADOW.y * drift);
    tmp.s.set(v.major * 2 * grow + 0.04, 1, v.minor * 2 * grow + 0.04);
    mesh.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q, tmp.s));
    attr.setXYZ(i, Math.max(0, opacity), round, core);
  }

  // Status for the DOM list, 4× a second (a timer, so it keeps reporting while the render loop is idle).
  useEffect(() => {
    let last = '';
    const id = setInterval(() => {
      const states: Record<number, BodyState> = {};
      let awake = 0, total = 0;
      for (const bid of [...rigid.keys()]) {
        const rb = alive(bid);
        if (!rb) continue;
        total++;
        const asleep = rb.isSleeping();
        states[bid] = held.has(bid) || drag.current?.id === bid ? 'held' : asleep ? 'resting' : 'moving';
        if (!asleep) awake++;
      }
      const key = JSON.stringify(states) + awake;
      if (key !== last) { last = key; onStatus({ awake, total, states, steps: steps.current }); }
    }, 250);
    return () => clearInterval(id);
  }, [rigid, held, alive, onStatus]);

  // Pointer drag: the grabbed body becomes kinematic and follows the pointer on a vertical plane facing the camera,
  // lifted a little as it is picked up; on release it turns dynamic again with the pointer's recent velocity (a
  // throw) and a spin from where it was held.
  const pointerTo = (e: PointerEvent, out: Vector3): boolean => {
    const d = drag.current;
    if (!d) return false;
    const r = gl.domElement.getBoundingClientRect();
    tmp.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    tmp.ray.setFromCamera(tmp.ndc, camera);
    if (!tmp.ray.ray.intersectPlane(d.plane, tmp.hit)) return false;
    out.copy(tmp.hit).sub(d.offset);
    out.y = Math.max(out.y, 0.3);
    out.x = Math.max(-6, Math.min(6, out.x));
    out.z = Math.max(-4, Math.min(4, out.z));
    return true;
  };
  const grabRef = useRef<(id: number, e: ThreeEvent<PointerEvent>) => void>(() => {});
  const onGrab = useCallback((id: number, e: ThreeEvent<PointerEvent>) => grabRef.current(id, e), []);
  grabRef.current = (id: number, e: ThreeEvent<PointerEvent>) => {
    if (introRef.current) endIntro();
    if (live.current.paused || drag.current || e.button > 0) return;
    e.stopPropagation();
    const rb = alive(id);
    if (!rb) return;
    const t = rb.translation();
    camera.getWorldDirection(tmp.n);
    tmp.n.y = 0;
    if (tmp.n.lengthSq() < 1e-4) tmp.n.set(0, 0, -1);
    tmp.n.normalize().negate();
    const plane = new Plane().setFromNormalAndCoplanarPoint(tmp.n, e.point);
    const offset = e.point.clone().sub(tmp.v.set(t.x, t.y, t.z));
    offset.y -= 0.22; // picked up: it rises a hand's width above where it was grabbed
    const target = new Vector3(t.x, t.y + 0.22, t.z);
    drag.current = { id, pointer: e.pointerId, plane, offset, target, samples: [{ p: target.clone(), t: performance.now() }] };
    held.set(id, target);
    enqueue(() => { const b = alive(id); if (b) setType(b, TYPE.kinematicPosition); });
    gl.domElement.setPointerCapture?.(e.pointerId);
    gl.domElement.style.cursor = 'grabbing';
    live.current.onSelect(id);
  };
  const hoverRef = useRef<(id: number | null, e: ThreeEvent<PointerEvent>) => void>(() => {});
  const onHover = useCallback((id: number | null, e: ThreeEvent<PointerEvent>) => hoverRef.current(id, e), []);
  hoverRef.current = (id, e) => {
    if (id != null) e.stopPropagation();
    // A pointer-out from a block that is no longer the hovered one (the pointer already moved onto another).
    if (id == null && hover.current != null && visuals.get(hover.current)?.group !== e.eventObject.parent) return;
    hover.current = id;
    if (!drag.current) gl.domElement.style.cursor = id != null && !live.current.paused ? 'grab' : '';
    invalidate();
  };
  useEffect(() => {
    const el = gl.domElement;
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointer) return;
      if (pointerTo(e, d.target)) {
        d.samples.push({ p: d.target.clone(), t: performance.now() });
        if (d.samples.length > 8) d.samples.shift();
        invalidate();
      }
    };
    const up = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointer) return;
      drag.current = null;
      held.delete(d.id);
      el.releasePointerCapture?.(e.pointerId);
      el.style.cursor = hover.current != null ? 'grab' : '';
      const now = performance.now();
      const s = d.samples.filter((x) => now - x.t < 120);
      const v = s.length > 1 ? s[s.length - 1].p.clone().sub(s[0].p).divideScalar(Math.max(0.016, (s[s.length - 1].t - s[0].t) / 1000)) : new Vector3();
      if (!Number.isFinite(v.x + v.y + v.z)) v.set(0, 0, 0);
      if (v.length() > 9) v.setLength(9);
      // Spin: a block held off-centre turns as it is thrown (torque = r × v), plus a tumble along the throw.
      const w = new Vector3().crossVectors(d.offset.clone().setY(0), v).multiplyScalar(1.6);
      w.x += v.z * 0.5; w.z -= v.x * 0.5;
      if (w.length() > 12) w.setLength(12);
      const id = d.id;
      enqueue(() => {
        const rb = alive(id);
        if (!rb) return;
        setType(rb, TYPE.dynamic);
        rb.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
        rb.setAngvel({ x: w.x, y: w.y, z: w.z }, true);
      });
    };
    // Input is never blocked by the intro: the first press anywhere on the table lands every block.
    const down = () => { if (introRef.current) endIntro(); };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      el.style.cursor = '';
    };
  }, [gl, camera, held, alive, enqueue, invalidate, endIntro]); // eslint-disable-line react-hooks/exhaustive-deps

  const lacquer = level === 'high';
  return (
    <>
      {/* tabletop collider (the planks themselves are drawn by <Table>, outside the physics chunk) */}
      <RigidBody type="fixed" colliders={false} position={[0, -TABLE.thickness / 2, 0]} friction={0.9}>
        <CuboidCollider args={[TABLE.width / 2, TABLE.thickness / 2, TABLE.depth / 2]} />
      </RigidBody>
      {bodies.map((b) => (
        <Toy key={b.id} spec={b} geometry={geometries[b.shape]} shadows={shadows} lacquer={lacquer} register={register} attach={attach} onGrab={onGrab} onHover={onHover} />
      ))}
      <instancedMesh ref={shadowMesh} args={[shadowRes.geometry, shadowRes.material, SHADOW_CAPACITY]} frustumCulled={false} renderOrder={1} raycast={noRaycast} />
      <mesh ref={ring} geometry={ringRes.geometry} material={ringRes.material} visible={false} renderOrder={2} raycast={noRaycast} />
    </>
  );
});
/** Stable (a new inline function per render would count as a prop change, and R3F draws a frame for each). */
const noRaycast = () => null;

const World = forwardRef<WorldHandle, WorldProps>(function World({ gravity, ...rest }, ref) {
  // `paused` on <Physics> stops Rapier's own stepper; Simulation steps the world itself (see above).
  return (
    <Physics gravity={gravity} timeStep={1 / 60} paused colliders={false}>
      <Simulation ref={ref} {...rest} gravityKey={gravity.join(',')} />
    </Physics>
  );
});
export default World;
