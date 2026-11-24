'use client';
/**
 * The physics chunk. Everything that imports @react-three/rapier (and with it the Rapier WebAssembly build) lives in
 * this module, which the page loads with React.lazy only once WebGL is confirmed and the canvas is on screen.
 */
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { BallCollider, CuboidCollider, CylinderCollider, Physics, RigidBody, useAfterPhysicsStep, useBeforePhysicsStep, useRapier, type RapierRigidBody } from '@react-three/rapier';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import {
  BoxGeometry, Color, CylinderGeometry, InstancedBufferAttribute, Matrix4, MeshStandardMaterial, Plane, PlaneGeometry, Quaternion, Raycaster,
  ShaderMaterial, SphereGeometry, Vector2, Vector3, type Group, type InstancedMesh,
} from 'three';
import { useQuality } from '../../../three';
import { BOUNDS, COLOURS, SHAPES, TABLE, type BodySpec, type ColourId, type ShapeId } from './bodies';

export type BodyState = 'resting' | 'moving' | 'held';
export interface WorldStatus { awake: number; total: number; states: Record<number, BodyState>; steps: number }
export interface WorldHandle {
  nudge(id: number, dir: 'left' | 'right' | 'away' | 'toward'): void;
  lift(id: number): void;
  drop(id: number): void;
  isHeld(id: number): boolean;
}
export interface WorldProps {
  bodies: readonly BodySpec[];
  paused: boolean;
  gravity: [number, number, number];
  selected: number | null;
  onSelect: (id: number | null) => void;
  /** Bodies that left the world (fell off the table and out of bounds). */
  onRemove: (ids: number[]) => void;
  onStatus: (s: WorldStatus) => void;
  onReady: () => void;
}

const TYPE = { dynamic: 0, kinematicPosition: 2 } as const;
const TMP = { v: new Vector3(), q: new Quaternion(), m: new Matrix4(), s: new Vector3(), c: new Color(), n: new Vector3(0, 1, 0), up: new Quaternion() };

/* ── Shared GPU resources: one geometry per shape, one material per colour ─────────────────────────────────── */
function useToyResources() {
  const res = useMemo(() => {
    const geometries: Record<ShapeId, BoxGeometry | CylinderGeometry | SphereGeometry> = {
      block: new BoxGeometry(...SHAPES.block.size),
      cube: new BoxGeometry(...SHAPES.cube.size),
      plank: new BoxGeometry(...SHAPES.plank.size),
      pillar: new CylinderGeometry(SHAPES.pillar.size[0] / 2, SHAPES.pillar.size[0] / 2, SHAPES.pillar.size[1], 28),
      ball: new SphereGeometry(SHAPES.ball.size[0] / 2, 32, 18),
    };
    const materials = Object.fromEntries(COLOURS.map((c) => [c.id, new MeshStandardMaterial({ color: c.hex, roughness: 0.62, metalness: 0 })])) as Record<ColourId, MeshStandardMaterial>;
    const table = new MeshStandardMaterial({ color: '#cdb48a', roughness: 0.78 });
    const edge = new MeshStandardMaterial({ color: '#8d7350', roughness: 0.8 });
    return { geometries, materials, table, edge };
  }, []);
  useEffect(() => () => {
    Object.values(res.geometries).forEach((g) => g.dispose());
    Object.values(res.materials).forEach((m) => m.dispose());
    res.table.dispose(); res.edge.dispose();
  }, [res]);
  return res;
}

/* ── Contact shadows for profiles without shadow maps: one instanced quad per body, one draw call ─────────── */
const BLOB_VERT = `attribute float aOpacity; varying vec2 vUv; varying float vO;
void main(){ vUv = uv; vO = aOpacity; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`;
const BLOB_FRAG = `varying vec2 vUv; varying float vO;
void main(){ float d = length(vUv - 0.5) * 2.0; float a = smoothstep(1.0, 0.15, d); gl_FragColor = vec4(0.0, 0.0, 0.0, a * a * vO); }`;

function ContactShadows({ bodies, rigid }: { bodies: readonly BodySpec[]; rigid: Map<number, RapierRigidBody> }) {
  const mesh = useRef<InstancedMesh>(null);
  const res = useMemo(() => {
    const geometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const opacity = new InstancedBufferAttribute(new Float32Array(64), 1);
    geometry.setAttribute('aOpacity', opacity);
    const material = new ShaderMaterial({ vertexShader: BLOB_VERT, fragmentShader: BLOB_FRAG, transparent: true, depthWrite: false });
    return { geometry, material, opacity };
  }, []);
  useEffect(() => () => { res.geometry.dispose(); res.material.dispose(); }, [res]);
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    let i = 0;
    for (const b of bodies) {
      const rb = rigid.get(b.id);
      if (!rb || i >= 64) continue;
      const t = rb.translation();
      const onTable = Math.abs(t.x) < TABLE.width / 2 && Math.abs(t.z) < TABLE.depth / 2 && t.y > -0.2;
      const [sx, , sz] = SHAPES[b.shape].size;
      const h = Math.max(0, t.y);
      const spread = 1 + h * 0.35;
      TMP.m.compose(TMP.v.set(t.x, 0.004, t.z), TMP.q.identity(), TMP.s.set(Math.max(sx, sz) * 1.5 * spread, 1, Math.max(sx, sz) * 1.5 * spread));
      m.setMatrixAt(i, TMP.m);
      res.opacity.setX(i, onTable ? Math.max(0, 0.55 - h * 0.16) : 0);
      i++;
    }
    m.count = i;
    m.instanceMatrix.needsUpdate = true;
    res.opacity.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[res.geometry, res.material, 64]} frustumCulled={false} renderOrder={1} />;
}

/* ── One toy ───────────────────────────────────────────────────────────────────────────────────────────── */
function Toy({ spec, geometry, material, shadows, register, onGrab }: {
  spec: BodySpec; geometry: BoxGeometry | CylinderGeometry | SphereGeometry; material: MeshStandardMaterial; shadows: boolean;
  register: (id: number, rb: RapierRigidBody | null) => void; onGrab: (id: number, e: ThreeEvent<PointerEvent>) => void;
}) {
  const [x, y, z] = SHAPES[spec.shape].size;
  // Stable per body: an inline ref callback would detach/re-attach on every render and drop the body's "held" state.
  const bodyRef = useCallback((rb: RapierRigidBody | null) => register(spec.id, rb), [spec.id, register]);
  return (
    <RigidBody
      ref={bodyRef}
      colliders={false} position={spec.position} rotation={[0, spec.yaw, 0]}
      friction={0.75} restitution={spec.shape === 'ball' ? 0.45 : 0.08} linearDamping={0.05} angularDamping={0.25}
      userData={{ id: spec.id }}
    >
      {spec.shape === 'ball' ? <BallCollider args={[x / 2]} />
        : spec.shape === 'pillar' ? <CylinderCollider args={[y / 2, x / 2]} />
        : <CuboidCollider args={[x / 2, y / 2, z / 2]} />}
      <mesh geometry={geometry} material={material} castShadow={shadows} receiveShadow={shadows} onPointerDown={(e) => onGrab(spec.id, e)} />
    </RigidBody>
  );
}

/* ── Selection marker: a ring on the table under the selected body ───────────────────────────────────────── */
function SelectionRing({ id, rigid }: { id: number | null; rigid: Map<number, RapierRigidBody> }) {
  const group = useRef<Group>(null);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const rb = id != null ? rigid.get(id) : undefined;
    g.visible = !!rb;
    if (!rb) return;
    const t = rb.translation();
    g.position.set(t.x, 0.012, t.z);
  });
  return (
    <group ref={group} visible={false}>
      <mesh rotation-x={-Math.PI / 2} renderOrder={2}>
        <ringGeometry args={[0.52, 0.6, 48]} />
        <meshBasicMaterial color="#11110f" transparent opacity={0.85} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ── The simulation ─────────────────────────────────────────────────────────────────────────────────────── */
const Simulation = forwardRef<WorldHandle, Omit<WorldProps, 'gravity'>>(function Simulation({ bodies, paused, selected, onSelect, onRemove, onStatus, onReady }, ref) {
  const { world, step } = useRapier();
  const { shadows } = useQuality();
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const res = useToyResources();
  const rigid = useRef(new Map<number, RapierRigidBody>()).current;
  const held = useRef(new Map<number, Vector3>()).current;
  const steps = useRef(0);
  const live = useRef({ paused, bodies, onRemove, onSelect });
  live.current = { paused, bodies, onRemove, onSelect };
  const drag = useRef<{ id: number; pointer: number; plane: Plane; offset: Vector3; target: Vector3; samples: { p: Vector3; t: number }[] } | null>(null);
  const tmp = useMemo(() => ({ ray: new Raycaster(), ndc: new Vector2(), hit: new Vector3(), n: new Vector3() }), []);

  useEffect(() => { onReady(); }, [onReady]);
  const register = useMemo(() => (id: number, rb: RapierRigidBody | null) => { if (rb) rigid.set(id, rb); else { rigid.delete(id); held.delete(id); } }, [rigid, held]);

  const wake = (rb: RapierRigidBody) => { rb.wakeUp(); invalidate(); };
  const setType = (rb: RapierRigidBody, type: number) => rb.setBodyType(type as unknown as Parameters<RapierRigidBody['setBodyType']>[0], true);

  useImperativeHandle(ref, () => ({
    nudge(id, dir) {
      const rb = rigid.get(id);
      if (!rb || live.current.paused) return;
      const d = dir === 'left' ? [-1, 0] : dir === 'right' ? [1, 0] : dir === 'away' ? [0, -1] : [0, 1];
      const target = held.get(id);
      if (target) { target.x += d[0] * 0.4; target.z += d[1] * 0.4; wake(rb); return; }
      const m = rb.mass();
      rb.applyImpulse({ x: d[0] * m * 2.4, y: m * 0.6, z: d[1] * m * 2.4 }, true);
      invalidate();
    },
    lift(id) {
      const rb = rigid.get(id);
      if (!rb || live.current.paused) return;
      const t = rb.translation();
      setType(rb, TYPE.kinematicPosition);
      held.set(id, new Vector3(t.x, Math.max(t.y + 1.2, 2.4), t.z));
      wake(rb);
    },
    drop(id) {
      const rb = rigid.get(id);
      if (!rb || !held.has(id)) return;
      held.delete(id);
      setType(rb, TYPE.dynamic);
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true); rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
      wake(rb);
    },
    isHeld: (id) => held.has(id),
  }), [rigid, held, invalidate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Held bodies (keyboard lift, pointer drag) glide to their targets as kinematic bodies and turn upright.
  useBeforePhysicsStep(() => {
    for (const [id, target] of held) {
      const rb = rigid.get(id);
      if (!rb) continue;
      const t = rb.translation();
      TMP.v.set(t.x, t.y, t.z);
      if (TMP.v.distanceToSquared(target) > 1e-6) rb.setNextKinematicTranslation(TMP.v.lerp(target, 0.3));
      const r = rb.rotation();
      TMP.q.set(r.x, r.y, r.z, r.w);
      if (1 - Math.abs(TMP.q.w) > 1e-5 || Math.abs(TMP.q.x) + Math.abs(TMP.q.z) > 1e-4) {
        const yaw = Math.atan2(2 * (r.w * r.y + r.x * r.z), 1 - 2 * (r.y * r.y + r.x * r.x));
        rb.setNextKinematicRotation(TMP.q.slerp(TMP.up.setFromAxisAngle(TMP.n.set(0, 1, 0), yaw), 0.25));
      }
    }
  });

  // Out of bounds → removed (the page drops them from its list, which unmounts the RigidBody).
  useAfterPhysicsStep(() => {
    steps.current++;
    let gone: number[] | null = null;
    for (const [id, rb] of rigid) {
      const t = rb.translation();
      if (t.y < BOUNDS.minY || Math.abs(t.x) > BOUNDS.maxXZ || Math.abs(t.z) > BOUNDS.maxXZ) (gone ??= []).push(id);
    }
    if (gone) { const ids = gone; queueMicrotask(() => live.current.onRemove(ids)); }
  });

  // Fixed-timestep stepping on our own clock: frame delta clamped to 50 ms, so a resumed demand loop or a slow
  // frame never fast-forwards the world. Rapier's step() then calls invalidate() while any body is awake —
  // which is what lets the render loop go idle once everything sleeps.
  useFrame((_, dt) => { if (!live.current.paused) step(Math.min(dt, 1 / 20)); });
  useEffect(() => { if (!paused) { world.forEachRigidBody((b) => b.wakeUp()); invalidate(); } }, [paused, world, invalidate]);

  // Status for the DOM list, 4× a second (a timer, so it keeps reporting while the render loop is idle).
  useEffect(() => {
    let last = '';
    const id = setInterval(() => {
      const states: Record<number, BodyState> = {};
      let awake = 0;
      for (const [bid, rb] of rigid) {
        const s: BodyState = held.has(bid) || drag.current?.id === bid ? 'held' : rb.isSleeping() ? 'resting' : 'moving';
        if (!rb.isSleeping()) awake++;
        states[bid] = s;
      }
      const key = JSON.stringify(states) + awake;
      if (key !== last) { last = key; onStatus({ awake, total: rigid.size, states, steps: steps.current }); }
    }, 250);
    return () => clearInterval(id);
  }, [rigid, held, onStatus]);

  // Pointer drag: the grabbed body becomes kinematic and follows the pointer on a vertical plane facing the
  // camera; on release it turns dynamic again with the pointer's recent velocity (a throw).
  const pointerTo = (e: PointerEvent, out: Vector3): boolean => {
    const d = drag.current;
    if (!d) return false;
    const r = gl.domElement.getBoundingClientRect();
    tmp.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    tmp.ray.setFromCamera(tmp.ndc, camera);
    if (!tmp.ray.ray.intersectPlane(d.plane, tmp.hit)) return false;
    out.copy(tmp.hit).sub(d.offset);
    out.y = Math.max(out.y, 0.25);
    out.x = Math.max(-6, Math.min(6, out.x));
    out.z = Math.max(-4, Math.min(4, out.z));
    return true;
  };
  const grabRef = useRef<(id: number, e: ThreeEvent<PointerEvent>) => void>(() => {});
  const onGrab = useCallback((id: number, e: ThreeEvent<PointerEvent>) => grabRef.current(id, e), []);
  grabRef.current = (id: number, e: ThreeEvent<PointerEvent>) => {
    if (live.current.paused || drag.current) return;
    e.stopPropagation();
    const rb = rigid.get(id);
    if (!rb) return;
    const t = rb.translation();
    camera.getWorldDirection(tmp.n);
    tmp.n.y = 0;
    if (tmp.n.lengthSq() < 1e-4) tmp.n.set(0, 0, -1);
    tmp.n.normalize().negate();
    const plane = new Plane().setFromNormalAndCoplanarPoint(tmp.n, e.point);
    drag.current = { id, pointer: e.pointerId, plane, offset: e.point.clone().sub(TMP.v.set(t.x, t.y, t.z)), target: new Vector3(t.x, t.y, t.z), samples: [] };
    held.set(id, drag.current.target);
    setType(rb, TYPE.kinematicPosition);
    gl.domElement.setPointerCapture?.(e.pointerId);
    live.current.onSelect(id);
    wake(rb);
  };
  useEffect(() => {
    const el = gl.domElement;
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointer) return;
      if (pointerTo(e, d.target)) {
        d.samples.push({ p: d.target.clone(), t: performance.now() });
        if (d.samples.length > 8) d.samples.shift();
        const rb = rigid.get(d.id);
        if (rb) wake(rb);
      }
    };
    const up = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointer) return;
      drag.current = null;
      held.delete(d.id);
      const rb = rigid.get(d.id);
      if (!rb) return;
      setType(rb, TYPE.dynamic);
      const s = d.samples.filter((x) => performance.now() - x.t < 120);
      const v = s.length > 1 ? s[s.length - 1].p.clone().sub(s[0].p).divideScalar(Math.max(0.016, (s[s.length - 1].t - s[0].t) / 1000)) : new Vector3();
      if (v.length() > 9) v.setLength(9);
      rb.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
      rb.setAngvel({ x: v.z * 0.6, y: 0, z: -v.x * 0.6 }, true);
      wake(rb);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
  }, [gl, camera, rigid, held]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* tabletop: a fixed body */}
      <RigidBody type="fixed" colliders={false} position={[0, -TABLE.thickness / 2, 0]} friction={0.9}>
        <CuboidCollider args={[TABLE.width / 2, TABLE.thickness / 2, TABLE.depth / 2]} />
        <mesh material={res.table} receiveShadow={shadows} onPointerDown={() => live.current.onSelect(null)}>
          <boxGeometry args={[TABLE.width, TABLE.thickness, TABLE.depth]} />
        </mesh>
        <mesh material={res.edge} position={[0, -TABLE.thickness / 2 - 0.06, 0]}>
          <boxGeometry args={[TABLE.width - 0.3, 0.12, TABLE.depth - 0.3]} />
        </mesh>
      </RigidBody>
      {bodies.map((b) => (
        <Toy key={b.id} spec={b} geometry={res.geometries[b.shape]} material={res.materials[b.colour]} shadows={shadows} register={register} onGrab={onGrab} />
      ))}
      {!shadows ? <ContactShadows bodies={bodies} rigid={rigid} /> : null}
      <SelectionRing id={selected} rigid={rigid} />
    </>
  );
});

const World = forwardRef<WorldHandle, WorldProps>(function World({ gravity, ...rest }, ref) {
  // `paused` on <Physics> stops Rapier's own stepper; Simulation steps the world itself (see above).
  return (
    <Physics gravity={gravity} timeStep={1 / 60} paused colliders={false}>
      <Simulation ref={ref} {...rest} />
    </Physics>
  );
});
export default World;
