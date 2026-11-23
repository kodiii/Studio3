'use client';
import { useFrame, useThree } from '@react-three/fiber';
import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import {
  BoxGeometry, CylinderGeometry, Group, InstancedMesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, NeutralToneMapping,
  Object3D, PlaneGeometry, Raycaster, SphereGeometry, TorusGeometry, Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CameraRig, LightingRig, OrbitInspect, type CameraRigHandle } from '../../three';
import { BODY, COLORS, FRONT_Z, PRESETS, SPOTS } from './data';
import { blobTexture, grilleTexture, windowTexture } from './textures';

function ToneMapping() {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const prev = gl.toneMapping;
    gl.toneMapping = NeutralToneMapping;
    invalidate();
    return () => { gl.toneMapping = prev; };
  }, [gl, invalidate]);
  return null;
}

/** OrbitInspect makes the <canvas> focusable (role=application); give it a name too. */
function CanvasName({ label }: { label: string }) {
  const el = useThree((s) => s.gl.domElement);
  useEffect(() => {
    el.setAttribute('aria-label', label);
    return () => el.removeAttribute('aria-label');
  }, [el, label]);
  return null;
}

const Radio = forwardRef<Group>(function Radio(_, ref) {
  const invalidate = useThree((s) => s.invalidate);
  const res = useMemo(() => {
    const tex = { grille: grilleTexture(), window: windowTexture(), blob: blobTexture() };
    const mats = {
      enamel: new MeshPhysicalMaterial({ color: COLORS.enamel, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.3 }),
      grille: new MeshStandardMaterial({ map: tex.grille, color: '#ffffff', roughness: 0.62, metalness: 0.35 }),
      window: new MeshStandardMaterial({ map: tex.window, color: '#ffffff', roughness: 0.12 }),
      brass: new MeshStandardMaterial({ color: COLORS.brass, roughness: 0.3, metalness: 1 }),
      leather: new MeshStandardMaterial({ color: COLORS.leather, roughness: 0.62 }),
      steel: new MeshStandardMaterial({ color: COLORS.steel, roughness: 0.22, metalness: 1 }),
      needle: new MeshStandardMaterial({ color: COLORS.needle, roughness: 0.5 }),
      door: new MeshStandardMaterial({ color: COLORS.door, roughness: 0.55 }),
      dark: new MeshStandardMaterial({ color: COLORS.panel, roughness: 0.7 }),
      blob: new MeshBasicMaterial({ map: tex.blob, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.6 }),
    };
    const geos = {
      body: new RoundedBoxGeometry(BODY.w, BODY.h, BODY.d, 5, 0.15),
      box: new BoxGeometry(1, 1, 1),
      dial: new CylinderGeometry(0.26, 0.27, 0.13, 56),
      knob: new CylinderGeometry(0.095, 0.1, 0.1, 32),
      strap: new TorusGeometry(0.86, 0.06, 10, 64, Math.PI),
      post: new CylinderGeometry(0.075, 0.085, 0.12, 20),
      rod: new CylinderGeometry(0.011, 0.014, 1.5, 8),
      tip: new SphereGeometry(0.03, 12, 8),
      foot: new CylinderGeometry(0.075, 0.075, 0.06, 16),
      plane: new PlaneGeometry(1, 1),
    };
    return { tex, mats, geos };
  }, []);
  useEffect(() => () => {
    for (const t of Object.values(res.tex)) t?.dispose();
    for (const m of Object.values(res.mats)) m.dispose();
    for (const g of Object.values(res.geos)) g.dispose();
  }, [res]);

  const feet = useRef<InstancedMesh>(null);
  const posts = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new Object3D();
    [[-1.0, -0.28], [1.0, -0.28], [-1.0, 0.28], [1.0, 0.28]].forEach(([x, z], i) => {
      o.position.set(x, 0.03, z); o.updateMatrix(); feet.current?.setMatrixAt(i, o.matrix);
    });
    [-0.86, 0.86].forEach((x, i) => { o.position.set(x, BODY.y + BODY.h / 2 + 0.05, 0); o.updateMatrix(); posts.current?.setMatrixAt(i, o.matrix); });
    for (const m of [feet.current, posts.current]) if (m) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); }
    invalidate();
  }, [invalidate]);

  const { mats, geos } = res;
  const top = BODY.y + BODY.h / 2;
  return (
    <>
      <mesh geometry={geos.plane} material={mats.blob} rotation-x={-Math.PI / 2} position={[0, 0.001, 0]} scale={[3.9, 2.1, 1]} renderOrder={-1} />
      <group ref={ref}>
        <mesh geometry={geos.body} material={mats.enamel} position={[0, BODY.y, 0]} />
        {/* front: perforated speaker panel, tuning window + needle, brass dial and volume knob */}
        <mesh geometry={geos.box} material={mats.grille} position={[-0.52, BODY.y, FRONT_Z + 0.004]} scale={[1.2, 1.2, 0.02]} />
        <mesh geometry={geos.box} material={mats.window} position={[0.7, 1.19, FRONT_Z + 0.004]} scale={[0.82, 0.37, 0.02]} />
        <mesh geometry={geos.box} material={mats.needle} position={[0.6, 1.2, FRONT_Z + 0.018]} scale={[0.014, 0.3, 0.008]} />
        <mesh geometry={geos.dial} material={mats.brass} position={[0.7, 0.56, FRONT_Z + 0.065]} rotation-x={Math.PI / 2} />
        <mesh geometry={geos.knob} material={mats.dark} position={[0.7, 0.56, FRONT_Z + 0.14]} rotation-x={Math.PI / 2} scale={[0.9, 0.5, 0.9]} />
        {/* top: leather strap on brass posts, telescopic antenna */}
        <mesh geometry={geos.strap} material={mats.leather} position={[0, top + 0.1, 0]} scale={[1, 0.62, 1.6]} />
        <instancedMesh ref={posts} args={[geos.post, mats.brass, 2]} />
        <group position={[1.08, top, -0.3]} rotation={[-0.18, 0, -0.42]}>
          <mesh geometry={geos.rod} material={mats.steel} position={[0, 0.75, 0]} />
          <mesh geometry={geos.tip} material={mats.steel} position={[0, 1.5, 0]} />
        </group>
        {/* back: battery door */}
        <mesh geometry={geos.box} material={mats.door} position={[0.2, 0.72, -FRONT_Z - 0.004]} scale={[1.05, 0.62, 0.02]} />
        <mesh geometry={geos.box} material={mats.dark} position={[0.2, 0.98, -FRONT_Z - 0.016]} scale={[0.22, 0.03, 0.01]} />
        <instancedMesh ref={feet} args={[geos.foot, mats.dark, 4]} />
      </group>
    </>
  );
});

/**
 * Projects every hotspot to screen space on each RENDERED frame (free while the demand loop is idle) and writes
 * transform/opacity straight to the DOM markers. Markers behind the radio fade and become `inert` (not clickable,
 * not reachable); markers behind the camera are hidden.
 */
function Anchors({ markers, root }: { markers: RefObject<Map<string, HTMLElement>>; root: RefObject<Group | null> }) {
  const invalidate = useThree((s) => s.invalidate);
  const tmp = useMemo(() => ({ p: new Vector3(), ndc: new Vector3(), dir: new Vector3(), ray: new Raycaster() }), []);
  useFrame(({ camera, size }) => {
    let missing = false;
    for (const s of SPOTS) {
      const el = markers.current?.get(s.id);
      if (!el) { missing = true; continue; }
      tmp.p.set(...s.position);
      tmp.ndc.copy(tmp.p).project(camera);
      if (tmp.ndc.z > 1 || tmp.ndc.z < -1) { el.style.visibility = 'hidden'; continue; }
      const x = (tmp.ndc.x * 0.5 + 0.5) * size.width, y = (-tmp.ndc.y * 0.5 + 0.5) * size.height;
      const dist = tmp.dir.copy(tmp.p).sub(camera.position).length();
      tmp.ray.set(camera.position, tmp.dir.divideScalar(dist));
      tmp.ray.far = dist - 0.04;
      const hidden = !!root.current && tmp.ray.intersectObject(root.current, true).length > 0;
      el.style.visibility = 'visible';
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.style.opacity = hidden ? '0.32' : '1';
      if (el.inert !== hidden) el.inert = hidden;
      el.dataset.occluded = String(hidden);
    }
    if (missing) invalidate(); // the DOM markers mount a moment after the first frame: keep projecting until they exist
  });
  return null;
}

export interface SceneProps { markers: RefObject<Map<string, HTMLElement>>; glide: number }

export const Scene = forwardRef<CameraRigHandle, SceneProps>(function Scene({ markers, glide }, ref) {
  const radio = useRef<Group>(null);
  return (
    <>
      <ToneMapping />
      <CanvasName label="Field radio, 3D view. Arrow keys orbit, plus and minus zoom, 0 resets." />
      <LightingRig preset="studio-soft" shadow="none" />
      <Radio ref={radio} />
      <OrbitInspect target={PRESETS.home.target} minDistance={2.4} maxDistance={12} minPolarAngle={0.25} maxPolarAngle={Math.PI / 2 - 0.06} damping={0.1} />
      <CameraRig ref={ref} presets={PRESETS} preset="home" smoothTime={glide} />
      <Anchors markers={markers} root={radio} />
    </>
  );
});
