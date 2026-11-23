'use client';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, NormalBlending, ShaderMaterial, Vector2 } from 'three';
import { useQuality } from '../../three';
import { fragmentShader, vertexShader } from './shader';

export interface Influence { x: number; y: number; active: boolean } // NDC (−1…1)
export interface Look { ink: string; accent: string; dark: boolean }

export interface SceneProps {
  count: number;
  intensity: number;
  flow: number;
  size: number;
  repel: boolean;
  running: boolean;
  interactive: boolean;
  look: Look;
  influence: RefObject<Influence>;
  kick: RefObject<(() => void) | null>;
  onCount: (n: number) => void;
}

/** Deterministic per-particle seeds (no Math.random: the same field on every load). */
function seeds(n: number): { pos: Float32Array; seed: Float32Array } {
  let s = 0x9e3779b9;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1_000_000) / 1_000_000; };
  const pos = new Float32Array(n * 3), seed = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = rnd() * 2 - 1; pos[i * 3 + 1] = rnd() * 2 - 1; pos[i * 3 + 2] = (rnd() - 0.5) * 0.2;
    seed[i * 4] = rnd(); seed[i * 4 + 1] = rnd(); seed[i * 4 + 2] = rnd(); seed[i * 4 + 3] = rnd();
  }
  return { pos, seed };
}

export function Scene({ count, intensity, flow, size, repel, running, interactive, look, influence, kick, onCount }: SceneProps) {
  const gl = useThree((s) => s.gl);
  const viewport = useThree((s) => s.viewport);
  const invalidate = useThree((s) => s.invalidate);
  const { density } = useQuality();
  const n = Math.max(500, Math.round(count * density));
  const state = useRef({ time: 7.5, push: 0 });

  const geometry = useMemo(() => {
    const { pos, seed } = seeds(n);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new BufferAttribute(seed, 4));
    return g;
  }, [n]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => { onCount(n); }, [n, onCount]);

  const material = useMemo(() => new ShaderMaterial({
    vertexShader, fragmentShader, transparent: true, depthWrite: false, depthTest: false,
    uniforms: {
      uTime: { value: 7.5 }, uFlow: { value: 1 }, uSize: { value: 2 }, uPixelRatio: { value: 1 }, uIntensity: { value: 0.8 },
      uPointerStrength: { value: 0 }, uFieldScale: { value: 0.8 }, uBounds: { value: new Vector2(1, 1) }, uPointer: { value: new Vector2() },
      uColor: { value: new Color() }, uAccent: { value: new Color() },
    },
  }), []);
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => { kick.current = invalidate; return () => { kick.current = null; }; }, [kick, invalidate]);
  useEffect(() => {
    const u = material.uniforms;
    u.uFlow.value = flow; u.uSize.value = size; u.uIntensity.value = intensity * (look.dark ? 0.75 : 0.62);
    u.uColor.value.set(look.ink); u.uAccent.value.set(look.accent);
    material.blending = look.dark ? AdditiveBlending : NormalBlending;
    material.needsUpdate = true;
    invalidate();
  }, [material, flow, size, intensity, look, invalidate]);
  useEffect(() => {
    material.uniforms.uBounds.value.set(viewport.width / 2, viewport.height / 2);
    material.uniforms.uPixelRatio.value = gl.getPixelRatio();
    invalidate();
  }, [material, viewport.width, viewport.height, gl, invalidate]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const s = state.current, u = material.uniforms, inf = influence.current;
    if (running) s.time += dt;
    const goal = interactive && inf?.active ? 1 : 0;
    s.push += (goal - s.push) * (1 - Math.exp(-dt * 6));
    if (Math.abs(goal - s.push) < 0.002) s.push = goal;
    if (inf) u.uPointer.value.set((inf.x * viewport.width) / 2, (inf.y * viewport.height) / 2);
    u.uTime.value = s.time;
    u.uPointerStrength.value = s.push * (repel ? 1 : -1);
    if (!running && s.push !== goal) invalidate(); // paused: keep easing the push in/out, then rest
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
