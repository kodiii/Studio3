'use client';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { CanvasTexture, LinearFilter, SRGBColorSpace, Vector2, type ShaderMaterial } from 'three';
import { useQuality } from '../../three';
import { POSTERS, posterCanvas, type Theme } from './posters';
import { fragmentShader, vertexShader } from './shader';

export interface Pointer { x: number; y: number; inside: boolean }
export interface SceneProps {
  index: number;
  origin: [number, number];
  theme: Theme | null;
  version: number;
  duration: number;
  amp: number;
  chroma: number;
  freq: number;
  hover: boolean;
  fade: boolean;
  pointer: RefObject<Pointer>;
  kick: RefObject<(() => void) | null>;
}

function uniforms_dbg() { return 0; }
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function Scene({ index, origin, theme, version, duration, amp, chroma, freq, hover, fade, pointer, kick }: SceneProps) {
  const invalidate = useThree((s) => s.invalidate);
  const { textureMax } = useQuality();
  const mat = useRef<ShaderMaterial>(null);
  const anim = useRef({ t: 1, from: index, to: index, hover: 0, time: 0 });

  // Poster textures in the current theme: regenerated on theme/font changes, the old set disposed.
  const textures = useMemo(() => {
    if (!theme) return null;
    const width = Math.min(textureMax, 1024) * 0.75;
    return POSTERS.map((_, i) => {
      const tex = new CanvasTexture(posterCanvas(i, width, theme));
      tex.colorSpace = SRGBColorSpace;
      tex.minFilter = LinearFilter; // no mipmaps needed: the poster is shown at about its own size
      tex.generateMipmaps = false;
      return tex;
    });
  }, [theme, version, textureMax]);
  useEffect(() => () => { for (const t of textures ?? []) t.dispose(); }, [textures]);
  (globalThis as unknown as { __rdbg: unknown }).__rdbg = { theme: !!theme, textures: textures?.length ?? null, textureMax, version, from: uniforms_dbg() };

  const uniforms = useMemo(() => ({
    uFrom: { value: null as CanvasTexture | null }, uTo: { value: null as CanvasTexture | null },
    uProgress: { value: 0 }, uAmp: { value: 0.05 }, uChroma: { value: 1 }, uFreq: { value: 3 }, uTime: { value: 0 },
    uHover: { value: 0 }, uAspect: { value: 0.75 }, uFade: { value: 0 }, uOrigin: { value: new Vector2(0.5, 0.5) }, uPointer: { value: new Vector2(0.5, 0.5) },
  }), []);

  useEffect(() => { kick.current = invalidate; return () => { kick.current = null; }; }, [kick, invalidate]);
  useEffect(() => {
    uniforms.uAmp.value = amp; uniforms.uChroma.value = chroma; uniforms.uFreq.value = freq; uniforms.uFade.value = fade ? 1 : 0;
    invalidate();
  }, [amp, chroma, freq, fade, uniforms, invalidate]);

  // A new index starts a transition from whatever is on screen (an unfinished one is completed first).
  useEffect(() => {
    const a = anim.current;
    if (index === a.to) return;
    a.from = a.to; a.to = index; a.t = 0;
    uniforms.uOrigin.value.set(origin[0], origin[1]);
    invalidate();
  }, [index, origin, uniforms, invalidate]);

  useEffect(() => {
    if (!textures) return;
    const a = anim.current;
    uniforms.uFrom.value = textures[a.t < 1 ? a.from : a.to];
    uniforms.uTo.value = textures[a.to];
    invalidate();
  }, [textures, uniforms, invalidate]);

  useFrame((_, rawDt) => {
    if (!textures) return;
    const a = anim.current;
    const dt = Math.min(rawDt, 1 / 20);
    let busy = false;
    if (a.t < 1) {
      a.t = Math.min(1, a.t + (dt * 1000) / Math.max(60, duration));
      uniforms.uFrom.value = textures[a.from];
      uniforms.uTo.value = textures[a.to];
      uniforms.uProgress.value = ease(a.t);
      if (a.t >= 1) { uniforms.uFrom.value = textures[a.to]; uniforms.uProgress.value = 0; } else busy = true;
    }
    const p = pointer.current;
    const goal = hover && !fade && p?.inside ? 1 : 0;
    if (p) uniforms.uPointer.value.lerp(new Vector2(p.x, p.y), 1 - Math.exp(-dt * 10));
    a.hover += (goal - a.hover) * (1 - Math.exp(-dt * 5));
    if (Math.abs(goal - a.hover) < 0.002) a.hover = goal;
    uniforms.uHover.value = a.hover;
    if (a.hover > 0) { a.time += dt; uniforms.uTime.value = a.time; busy = true; }
    if (busy) invalidate();
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} depthTest={false} depthWrite={false} />
    </mesh>
  );
}
