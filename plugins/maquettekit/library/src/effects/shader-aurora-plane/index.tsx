'use client';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Color, Vector2, type ShaderMaterial } from 'three';
import { useStudioMotion } from '../../motion';
import { StudioCanvas } from '../../three';
import type { EffectProps } from '../../types';
import { fragmentShader, vertexShader } from './shader';

type Params = { speed: number; bands: number; colorA: string; colorB: string; grain: number };

function Aurora({ params, animate }: { params: Params; animate: boolean }) {
  const mat = useRef<ShaderMaterial>(null);
  const invalidate = useThree((s) => s.invalidate);
  const size = useThree((s) => s.size);
  const pointer = useRef(new Vector2(0.5, 0.5));
  // Initial values only. R3F 9 copies each uniform into the material's own `uniforms` object when the prop is
  // applied, so later writes must go through the material instance (mat.current.uniforms), never this object.
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uBands: { value: params.bands }, uGrain: { value: params.grain }, uAspect: { value: 1 },
    uPointer: { value: new Vector2(0.5, 0.5) }, uColorA: { value: new Color(params.colorA) }, uColorB: { value: new Color(params.colorB) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  useEffect(() => {
    const u = mat.current?.uniforms;
    if (!u) return;
    u.uBands.value = params.bands;
    u.uGrain.value = params.grain;
    (u.uColorA.value as Color).set(params.colorA);
    (u.uColorB.value as Color).set(params.colorB);
    u.uAspect.value = size.width / Math.max(1, size.height);
    invalidate();
  }, [params.bands, params.grain, params.colorA, params.colorB, size, invalidate]);

  useFrame((state, dt) => {
    const u = mat.current?.uniforms;
    if (!animate || !u) return;
    u.uTime.value += dt * params.speed;
    pointer.current.set(state.pointer.x * 0.5 + 0.5, state.pointer.y * 0.5 + 0.5);
    (u.uPointer.value as Vector2).lerp(pointer.current, 1 - Math.exp(-dt * 3));
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} depthTest={false} depthWrite={false} />
    </mesh>
  );
}

export default function ShaderAuroraPlane({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const animate = !reduced && params.speed > 0;
  return (
    <StudioCanvas
      label="Decorative aurora light background"
      frameloop={animate ? 'always' : 'demand'}
      style={{ position: 'absolute', inset: 0 }}
      fallback={<div style={{ position: 'absolute', inset: 0, background: `linear-gradient(120deg, ${params.colorA}, #11110f 55%, ${params.colorB})` }} />}
    >
      <Aurora params={params} animate={animate} />
    </StudioCanvas>
  );
}
