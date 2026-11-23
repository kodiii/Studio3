'use client';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CanvasTexture, Shape, Vector3, type PerspectiveCamera } from 'three';
import { useStudioMotion } from '../../motion';
import { StudioCanvas, useQuality } from '../../three';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type PresetName = 'Front' | 'Three-quarter' | 'Top' | 'Detail';
type Params = { preset: PresetName; glide: number; fov: number; accent: string };
type V3 = readonly [number, number, number];

const PRESETS: Record<PresetName, { position: V3; target: V3; note: string }> = {
  Front: { position: [0, 0.95, 7.2], target: [0, 0.55, 0], note: 'Eye level, square to the arch.' },
  'Three-quarter': { position: [4.9, 3.3, 5.4], target: [0, 0.42, 0], note: 'The hero angle: all four forms and the plinth edge.' },
  Top: { position: [0, 8.6, 1.1], target: [0, 0, 0.05], note: 'Plan view showing how the forms are spaced.' },
  Detail: { position: [2.25, 0.82, 2.75], target: [0.5, 0.33, 0.45], note: 'Close on the sphere and the ring.' },
};
const NAMES = Object.keys(PRESETS) as PresetName[];
const PAPER = '#efeadd';
const INK = '#1d1d1a';
const GREEN = '#0f6b57';

/** Critically damped spring step (no overshoot, velocity carried between calls so it can be retargeted mid-flight). */
function damp(current: Vector3, goal: Vector3, velocity: Vector3, smoothTime: number, dt: number): void {
  const omega = 2 / Math.max(0.0001, smoothTime);
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  for (const axis of ['x', 'y', 'z'] as const) {
    const change = current[axis] - goal[axis];
    const temp = (velocity[axis] + omega * change) * dt;
    velocity[axis] = (velocity[axis] - omega * temp) * decay;
    current[axis] = goal[axis] + (change + temp) * decay;
  }
}

function Rig({ preset, glide, fov, cut }: { preset: PresetName; glide: number; fov: number; cut: boolean }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const rig = useRef({
    position: new Vector3(), target: new Vector3(), vPosition: new Vector3(), vTarget: new Vector3(),
    goalPosition: new Vector3(), goalTarget: new Vector3(), moving: false, ready: false,
  });

  useEffect(() => {
    const r = rig.current;
    const p = PRESETS[preset] ?? PRESETS['Three-quarter'];
    // Narrow canvases pull the camera back along its own axis so the plinth stays in frame.
    const pull = Math.min(2.4, Math.max(1, 1.45 / aspect));
    r.goalTarget.set(...p.target);
    r.goalPosition.set(...p.position).sub(r.goalTarget).multiplyScalar(pull).add(r.goalTarget);
    if (cut || !r.ready) {
      r.position.copy(r.goalPosition); r.target.copy(r.goalTarget);
      r.vPosition.set(0, 0, 0); r.vTarget.set(0, 0, 0);
      r.moving = false; r.ready = true;
      camera.position.copy(r.position); camera.lookAt(r.target);
    } else r.moving = true;
    invalidate();
  }, [preset, aspect, cut, camera, invalidate]);

  useEffect(() => {
    camera.fov = fov;
    camera.updateProjectionMatrix();
    invalidate();
  }, [fov, camera, invalidate]);

  useFrame((_, delta) => {
    const r = rig.current;
    if (!r.moving) return;
    const dt = Math.min(delta, 1 / 30); // the first frame after resting has a huge delta
    damp(r.position, r.goalPosition, r.vPosition, glide, dt);
    damp(r.target, r.goalTarget, r.vTarget, glide, dt);
    const settled = r.position.distanceToSquared(r.goalPosition) < 1e-6 && r.vPosition.lengthSq() < 1e-6 && r.target.distanceToSquared(r.goalTarget) < 1e-6;
    if (settled) { r.position.copy(r.goalPosition); r.target.copy(r.goalTarget); r.moving = false; }
    camera.position.copy(r.position);
    camera.lookAt(r.target);
    if (!settled) invalidate();
  });
  return null;
}

function useBlobTexture() {
  const texture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    if (g) {
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(14,13,10,1)');
      grad.addColorStop(0.45, 'rgba(14,13,10,0.5)');
      grad.addColorStop(1, 'rgba(14,13,10,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
    }
    return new CanvasTexture(c);
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function Blob({ texture, position, scale, opacity }: { texture: CanvasTexture; position: V3; scale: readonly [number, number]; opacity: number }) {
  return (
    <mesh position={position as [number, number, number]} rotation-x={-Math.PI / 2} scale={[scale[0], scale[1], 1]} renderOrder={1}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function StillLife({ accent }: { accent: string }) {
  const { shadows, shadowMapSize, density } = useQuality();
  const blob = useBlobTexture();
  const seg = density >= 0.6 ? 64 : 40;
  const arch = useMemo(() => {
    const s = new Shape();
    s.moveTo(-0.62, 0); s.lineTo(-0.62, 0.8); s.absarc(0, 0.8, 0.62, Math.PI, 0, true); s.lineTo(0.62, 0);
    s.lineTo(0.3, 0); s.lineTo(0.3, 0.8); s.absarc(0, 0.8, 0.3, 0, Math.PI, false); s.lineTo(-0.3, 0); s.closePath();
    return s;
  }, []);

  return (
    <>
      <hemisphereLight args={['#eef0ec', '#9a917f', 0.85]} />
      <directionalLight
        position={[3.4, 5.2, 3.6]} intensity={2.3} color="#fff7ec" castShadow={shadows}
        shadow-mapSize={[shadowMapSize, shadowMapSize]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={5}
        shadow-camera-left={-3} shadow-camera-right={3} shadow-camera-top={3} shadow-camera-bottom={-3} shadow-camera-near={1} shadow-camera-far={14}
      />
      <directionalLight position={[-4.5, 3.2, -3.6]} intensity={1.9} color="#ffdcc6" />

      {/* ground contact under the plinth: a generated soft-shadow texture, no shadow pass needed */}
      <Blob texture={blob} position={[-0.25, -0.449, 0.1]} scale={[6.4, 5.2]} opacity={0.42} />
      <mesh position={[0, -0.39, 0]} receiveShadow>
        <cylinderGeometry args={[2.05, 2.05, 0.12, seg]} />
        <meshStandardMaterial color="#d9d2c0" roughness={0.95} />
      </mesh>
      <mesh position={[0, -0.165, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[1.7, 1.7, 0.33, seg]} />
        <meshStandardMaterial color={PAPER} roughness={0.9} />
      </mesh>

      {!shadows ? (
        <>
          {/* offset away from the key light, which sits front-right */}
          <Blob texture={blob} position={[-0.86, 0.004, -0.6]} scale={[2.5, 1.5]} opacity={0.5} />
          <Blob texture={blob} position={[0.46, 0.004, 0.4]} scale={[1.3, 1.15]} opacity={0.55} />
          <Blob texture={blob} position={[0.56, 0.004, -0.82]} scale={[1.25, 1.1]} opacity={0.5} />
          <Blob texture={blob} position={[-0.58, 0.004, 0.72]} scale={[1.05, 0.95]} opacity={0.5} />
        </>
      ) : null}

      <mesh position={[-0.55, 0, -0.38]} rotation-y={0.32} castShadow receiveShadow>
        <extrudeGeometry args={[arch, { depth: 0.42, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: seg / 2 }]} />
        <meshStandardMaterial color="#f7f3ea" roughness={0.82} />
      </mesh>
      <mesh position={[0.62, 0.38, 0.52]} castShadow>
        <sphereGeometry args={[0.38, seg, seg / 2]} />
        <meshStandardMaterial color={accent} roughness={0.5} />
      </mesh>
      <mesh position={[0.72, 0.5, -0.7]} castShadow>
        <coneGeometry args={[0.36, 1, seg]} />
        <meshStandardMaterial color={GREEN} roughness={0.7} />
      </mesh>
      <mesh position={[-0.5, 0.075, 0.8]} rotation-x={Math.PI / 2} castShadow>
        <torusGeometry args={[0.26, 0.075, 20, seg]} />
        <meshStandardMaterial color={INK} roughness={0.35} metalness={0.2} />
      </mesh>
    </>
  );
}

function Still({ accent }: { accent: string }) {
  return (
    <svg viewBox="0 0 400 260" className={styles.still} role="img" aria-label="Drawing of the still-life: an arch, a sphere, a cone and a ring on a round plinth">
      <ellipse cx="196" cy="214" rx="170" ry="26" fill="#11110f" opacity="0.12" />
      <path d="M52 176a148 34 0 0 0 296 0v20a148 34 0 0 1-296 0z" fill="#cfc7b3" />
      <ellipse cx="200" cy="176" rx="148" ry="34" fill={PAPER} stroke="#11110f22" />
      <path d="M108 172V98a44 44 0 0 1 88 0v74h-22V98a22 22 0 0 0-44 0v74z" fill="#f7f3ea" stroke="#11110f33" />
      <path d="M262 90l30 80a30 8 0 0 1-60 0z" fill={GREEN} />
      <circle cx="252" cy="160" r="30" fill={accent} />
      <ellipse cx="150" cy="190" rx="22" ry="7" fill="none" stroke={INK} strokeWidth="6" />
    </svg>
  );
}

export default function CameraPresetRig({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const [preset, setPreset] = useState<PresetName>(params.preset);
  const name = useId();
  useEffect(() => setPreset(params.preset), [params.preset]);
  const current = PRESETS[preset] ?? PRESETS['Three-quarter'];

  return (
    <div className={styles.root}>
      <div className={styles.viewport}>
        <StudioCanvas
          label={`Still-life on a plinth, ${preset} view`}
          description="A procedural still-life: a pale arch, a coloured sphere, a deep green cone and a dark ring arranged on a round two-step plinth, lit by a warm key light with a soft rim light from behind."
          flat
          camera={{ fov: params.fov, near: 0.1, far: 60, position: [4.9, 3.3, 5.4] }}
          fallback={<Still accent={params.accent} />}
        >
          <Rig preset={preset} glide={params.glide} fov={params.fov} cut={reduced} />
          <StillLife accent={params.accent} />
        </StudioCanvas>
      </div>
      <div className={styles.bar}>
        <fieldset className={styles.presets}>
          <legend>Camera</legend>
          {NAMES.map((n) => (
            <label key={n} className={styles.option}>
              <input type="radio" name={name} value={n} checked={preset === n} onChange={() => setPreset(n)} />
              <span>{n}</span>
            </label>
          ))}
        </fieldset>
        <p className={styles.note} aria-live="polite">{current.note}</p>
      </div>
    </div>
  );
}
