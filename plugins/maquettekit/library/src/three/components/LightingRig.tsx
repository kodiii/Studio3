'use client';
/**
 * LightingRig — named lighting presets: direct lights + a GENERATED image-based environment.
 *
 * No HDRI is downloaded. The environment is a tiny scene of emissive panels inside a tinted room, prefiltered
 * through three's PMREMGenerator at the resolution of the active quality profile (drei's `<Environment preset>`
 * fetches .hdr files from a CDN — avoid it in offline/privacy-sensitive builds). PMREM never goes below a 256 px
 * cube (three's MIN_SIZE), so `envResolution` values under 256 cost and look the same as 256.
 *
 * Shadows follow the profile: a real shadow map on a shadow-catcher plane when `profile.shadows` is on, otherwise
 * a cheap analytic contact blob (one transparent quad, no extra render pass). `shadowCatcher={false}` keeps the key
 * light's shadow map but leaves out the plane, for scenes whose own geometry (a plinth, a floor) receives it.
 * `followCamera` turns the whole rig — direct lights and the environment — about the vertical axis with the camera,
 * like a turntable under fixed studio lights: the light always comes from the same side of the picture.
 * Everything created here (PMREM target, env scene, blob material) is disposed on preset change/unmount, and the
 * previous `scene.environment` / exposure are restored.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import {
  BackSide, BoxGeometry, Color, DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry, PMREMGenerator, Scene,
  type AmbientLight, type DirectionalLight, type Group, type ShaderMaterial, type Vector3,
} from 'three';
import { useQuality } from '../StudioCanvas';
import type { Vec3 } from './OrbitInspect';

export interface DirectLight { color: string; intensity: number; position: Vec3 }
export interface EnvPanel { color: string; intensity: number; position: Vec3; size: [number, number] }
export interface LightingPreset {
  label: string;
  description: string;
  /** Tone-mapping exposure. */
  exposure: number;
  ambient: { color: string; intensity: number };
  key: DirectLight;
  fill?: DirectLight;
  rim?: DirectLight;
  env: { room: string; intensity: number; panels: readonly EnvPanel[] };
}

export const lightingPresets = {
  'studio-soft': {
    label: 'Studio soft', description: 'Large overhead softbox with a broad fill — even, low-contrast product light.', exposure: 1,
    ambient: { color: '#ffffff', intensity: 0.25 },
    key: { color: '#fff6ea', intensity: 1.7, position: [3, 6, 4] },
    fill: { color: '#dfe8ff', intensity: 0.7, position: [-5, 2.5, 3] },
    env: { room: '#2a2927', intensity: 0.5, panels: [
      { color: '#ffffff', intensity: 9, position: [0, 6, 0], size: [9, 9] },
      { color: '#fff1dc', intensity: 4, position: [6, 2, 3], size: [4, 6] },
      { color: '#dce6ff', intensity: 3, position: [-6, 2, 2], size: [4, 6] },
      { color: '#ffffff', intensity: 1.5, position: [0, 2, -7], size: [10, 5] },
    ] },
  },
  'product-contrast': {
    label: 'Product contrast', description: 'Hard key, narrow strip lights and a strong rim — defines edges and metal.', exposure: 1.05,
    ambient: { color: '#ffffff', intensity: 0.06 },
    key: { color: '#ffffff', intensity: 2.6, position: [4.5, 5, 2.5] },
    rim: { color: '#cfe0ff', intensity: 2.4, position: [-3.5, 3, -5] },
    env: { room: '#0b0b0c', intensity: 0.8, panels: [
      { color: '#ffffff', intensity: 22, position: [5, 3.5, 1], size: [1.1, 7] },
      { color: '#ffffff', intensity: 14, position: [-5.5, 3, -1.5], size: [0.8, 6] },
      { color: '#e9f0ff', intensity: 7, position: [0, 6.5, -2], size: [6, 1.4] },
    ] },
  },
  'warm-evening': {
    label: 'Warm evening', description: 'Low amber key with a cool sky fill — domestic, late-day mood.', exposure: 0.95,
    ambient: { color: '#ffd9b0', intensity: 0.16 },
    key: { color: '#ffb46b', intensity: 2.8, position: [5, 2.4, 3] },
    fill: { color: '#7f9bd6', intensity: 0.55, position: [-4, 4, -2] },
    env: { room: '#1d1612', intensity: 0.65, panels: [
      { color: '#ffae5e', intensity: 13, position: [6.5, 1.6, 2.5], size: [5, 3] },
      { color: '#ff7a3d', intensity: 4, position: [3, 0.8, -6], size: [8, 1.6] },
      { color: '#6f8fd4', intensity: 3.2, position: [-5, 5, 0], size: [7, 5] },
    ] },
  },
  'technical-flat': {
    label: 'Technical flat', description: 'Shadowless, neutral and even — for reading form and part boundaries.', exposure: 1,
    ambient: { color: '#ffffff', intensity: 0.5 },
    key: { color: '#ffffff', intensity: 1.1, position: [2, 6, 5] },
    fill: { color: '#ffffff', intensity: 0.9, position: [-4, 3, -4] },
    env: { room: '#8d8d8d', intensity: 0.45, panels: [
      { color: '#ffffff', intensity: 3, position: [0, 6, 0], size: [12, 12] },
      { color: '#ffffff', intensity: 2, position: [0, -5, 0], size: [12, 12] },
    ] },
  },
} as const satisfies Record<string, LightingPreset>;
export type LightingPresetName = keyof typeof lightingPresets;

export interface LightingRigHandle { key: DirectionalLight | null; fill: DirectionalLight | null; rim: DirectionalLight | null; ambient: AmbientLight | null }

export interface LightingRigProps {
  preset?: LightingPresetName | LightingPreset;
  /** Multiplies every direct light and the environment. */
  intensity?: number;
  /** 'auto' = shadow map when the quality profile allows it, else contact blob. */
  shadow?: 'auto' | 'map' | 'blob' | 'none';
  /** Height of the ground plane the shadow falls on. */
  groundY?: number;
  /** Radius of the area that needs shadow coverage (≈ model footprint radius). */
  shadowRadius?: number;
  shadowOpacity?: number;
  /**
   * With a shadow map (`shadow="map"`, or `"auto"` on a profile with shadows): add the transparent catcher plane at
   * `groundY`. Set false when the scene's own meshes (`receiveShadow`) take the key light's shadow. Default true.
   */
  shadowCatcher?: boolean;
  /** Shadow-map blur radius (PCF soft shadows). Default 4. */
  shadowSoftness?: number;
  /**
   * Turn the rig with the camera: each frame the direct lights and the environment rotate about the vertical axis
   * to the camera's azimuth around the orbit target (the default R3F `controls`, e.g. OrbitInspect, else the
   * origin). Presets are then authored for a camera straight in front (+Z). The shadow catcher and contact blob stay
   * put. The previous `scene.environmentRotation.y` is restored on unmount. Default false.
   */
  followCamera?: boolean;
  /** Use the generated environment as the visible background too. */
  background?: boolean;
  /** Set false to keep the scene's existing environment. */
  environment?: boolean;
}

const BLOB_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const BLOB_FRAG = 'varying vec2 vUv; uniform float uOpacity; void main(){ float d = length(vUv - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, d); gl_FragColor = vec4(0.0, 0.0, 0.0, a * a * uOpacity); }';

export const LightingRig = forwardRef<LightingRigHandle, LightingRigProps>(function LightingRig(
  {
    preset = 'studio-soft', intensity = 1, shadow = 'auto', groundY = 0, shadowRadius = 2, shadowOpacity = 0.35, shadowCatcher = true, shadowSoftness = 4,
    followCamera = false, background = false, environment = true,
  }, ref,
) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const rig = useRef<Group>(null);
  const quality = useQuality();
  const p: LightingPreset = typeof preset === 'string' ? lightingPresets[preset] : preset;
  const key = useRef<DirectionalLight>(null), fill = useRef<DirectionalLight>(null), rim = useRef<DirectionalLight>(null), ambient = useRef<AmbientLight>(null);
  useImperativeHandle(ref, () => ({
    get key() { return key.current; }, get fill() { return fill.current; }, get rim() { return rim.current; }, get ambient() { return ambient.current; },
  }), []);

  // Generated environment → PMREM
  useEffect(() => {
    if (!environment) return;
    const env = new Scene();
    const room = new Mesh(new BoxGeometry(30, 30, 30), new MeshBasicMaterial({ color: p.env.room, side: BackSide }));
    env.add(room);
    const made: Mesh[] = [room];
    for (const panel of p.env.panels) {
      const m = new Mesh(new PlaneGeometry(panel.size[0], panel.size[1]), new MeshBasicMaterial({ color: new Color(panel.color).multiplyScalar(panel.intensity), side: DoubleSide }));
      m.position.set(...panel.position);
      m.lookAt(0, 0, 0);
      env.add(m);
      made.push(m);
    }
    const pmrem = new PMREMGenerator(gl);
    // three clamps this to its PMREM minimum (256): smaller profile values are not cheaper here.
    const target = pmrem.fromScene(env, 0.035, 0.1, 100, { size: quality.envResolution });
    const prev = { env: scene.environment, intensity: scene.environmentIntensity, bg: scene.background };
    scene.environment = target.texture;
    if (background) scene.background = target.texture;
    for (const m of made) { m.geometry.dispose(); (m.material as MeshBasicMaterial).dispose(); }
    pmrem.dispose();
    invalidate();
    return () => {
      scene.environment = prev.env; scene.environmentIntensity = prev.intensity;
      if (background) scene.background = prev.bg;
      target.dispose();
    };
  }, [gl, scene, p, quality.envResolution, background, environment, invalidate]);

  useEffect(() => { if (environment) { scene.environmentIntensity = p.env.intensity * intensity; invalidate(); } }, [scene, p, intensity, environment, invalidate]);

  useEffect(() => {
    const prev = gl.toneMappingExposure;
    gl.toneMappingExposure = p.exposure;
    invalidate();
    return () => { gl.toneMappingExposure = prev; };
  }, [gl, p.exposure, invalidate]);

  const mode = shadow === 'auto' ? (quality.shadows ? 'map' : 'blob') : shadow;
  // R3F copies each uniform into the material's own `uniforms` when it applies the prop, so later writes to this
  // object never reach the GPU: it only seeds a (re)mounted material; live updates go through the instance.
  const blobUniforms = useMemo(() => ({ uOpacity: { value: shadowOpacity * 1.6 } }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const blobMat = useRef<ShaderMaterial>(null);
  useEffect(() => {
    const v = shadowOpacity * 1.6;
    blobUniforms.uOpacity.value = v;
    const u = blobMat.current?.uniforms.uOpacity;
    if (u) u.value = v;
    invalidate();
  }, [blobUniforms, shadowOpacity, mode, invalidate]);
  useEffect(() => { invalidate(); }, [mode, groundY, shadowRadius, shadowCatcher, shadowSoftness, invalidate]);
  const r = shadowRadius;

  // Follow the camera's azimuth: after camera rigs (−2) and controls (−1) have placed the camera, before the draw.
  useEffect(() => {
    if (!followCamera) return;
    const prev = scene.environmentRotation.y;
    invalidate();
    return () => { scene.environmentRotation.y = prev; rig.current?.rotation.set(0, 0, 0); invalidate(); };
  }, [followCamera, scene, invalidate]);
  useFrame(({ camera, controls }) => {
    if (!followCamera) return;
    const t = (controls as { target?: Vector3 } | null)?.target;
    const az = Math.atan2(camera.position.x - (t?.x ?? 0), camera.position.z - (t?.z ?? 0));
    if (rig.current) rig.current.rotation.y = az;
    scene.environmentRotation.y = az;
  }, -0.5);

  return (
    <group>
      <group ref={rig}>
        <ambientLight ref={ambient} color={p.ambient.color} intensity={p.ambient.intensity * intensity} />
        <directionalLight
          ref={key} color={p.key.color} intensity={p.key.intensity * intensity} position={p.key.position}
          castShadow={mode === 'map'} shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]} shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-radius={shadowSoftness}
          shadow-camera-left={-r * 1.6} shadow-camera-right={r * 1.6} shadow-camera-top={r * 1.6} shadow-camera-bottom={-r * 1.6} shadow-camera-near={0.1} shadow-camera-far={40}
        />
        {p.fill ? <directionalLight ref={fill} color={p.fill.color} intensity={p.fill.intensity * intensity} position={p.fill.position} /> : null}
        {p.rim ? <directionalLight ref={rim} color={p.rim.color} intensity={p.rim.intensity * intensity} position={p.rim.position} /> : null}
      </group>
      {mode === 'map' && shadowCatcher ? (
        <mesh rotation-x={-Math.PI / 2} position-y={groundY} receiveShadow>
          <planeGeometry args={[r * 8, r * 8]} />
          <shadowMaterial transparent opacity={shadowOpacity} depthWrite={false} />
        </mesh>
      ) : mode === 'blob' ? (
        <mesh rotation-x={-Math.PI / 2} position-y={groundY + 0.002} renderOrder={-1}>
          <planeGeometry args={[r * 2.6, r * 2.6]} />
          <shaderMaterial ref={blobMat} uniforms={blobUniforms} vertexShader={BLOB_VERT} fragmentShader={BLOB_FRAG} transparent depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
});
