'use client';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  CanvasTexture, ClampToEdgeWrapping, Color, LinearFilter, LinearMipmapLinearFilter, ShaderMaterial, SRGBColorSpace, Vector2, Vector3, Vector4,
} from 'three';
import { useQuality } from '../../three';
import type { LensEngine } from './engine';
import { fragmentShader, vertexShader } from './shader';

/** Glass look per theme (sRGB hex; three converts to linear). */
export interface GlassLook { dark: boolean; envLo: string; envHi: string; light: string; shadow: string; shadowAmount: number; caustic: number }

export interface SceneProps {
  engine: LensEngine;
  /** Draws the page in CSS pixels into a context already scaled to the drawing buffer. */
  draw: RefObject<(g: CanvasRenderingContext2D, width: number, height: number) => void>;
  /** Redraw the page texture when this changes (theme, fonts, content). */
  drawKey: unknown;
  refraction: number;
  dispersion: number;
  frost: number;
  look: GlassLook;
  /** The active frame driver: wakes the render loop. */
  wake: RefObject<(() => void) | null>;
  /** Called after each simulated frame so DOM overlays follow the lens in the same frame. */
  onFrame: RefObject<(() => void) | null>;
}

const SAMPLES = { high: 12, medium: 9, low: 6 } as const;

export function Scene({ engine, draw, drawKey, refraction, dispersion, frost, look, wake, onFrame }: SceneProps) {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const invalidate = useThree((s) => s.invalidate);
  const quality = useQuality();
  const buffer = useRef(new Vector2());

  // Page texture at drawing-buffer resolution (already capped by the quality profile's DPR). Resizes are debounced so
  // a window drag does not redraw and re-upload on every frame; the old texture stretches for the moment in between.
  const [texSize, setTexSize] = useState<[number, number] | null>(null);
  const hasTexture = texSize !== null;
  useEffect(() => {
    const max = gl.capabilities.maxTextureSize || 4096;
    const next: [number, number] = [Math.min(max, Math.round(size.width * dpr)), Math.min(max, Math.round(size.height * dpr))];
    if (next[0] < 2 || next[1] < 2) return;
    const apply = () => setTexSize((s) => (s && s[0] === next[0] && s[1] === next[1] ? s : next));
    if (!hasTexture) { apply(); return; }
    const id = window.setTimeout(apply, 140);
    return () => window.clearTimeout(id);
  }, [size.width, size.height, dpr, gl, hasTexture]);

  const texture = useMemo(() => {
    if (!texSize) return null;
    const c = document.createElement('canvas');
    c.width = texSize[0];
    c.height = texSize[1];
    const g = c.getContext('2d');
    if (!g) return null;
    const cssW = texSize[0] / dpr, cssH = texSize[1] / dpr;
    g.setTransform(texSize[0] / cssW, 0, 0, texSize[1] / cssH, 0, 0);
    draw.current?.(g, cssW, cssH);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.generateMipmaps = true; // the frost and the compressed rim sample blurrier levels with textureLod
    t.minFilter = LinearMipmapLinearFilter;
    t.magFilter = LinearFilter;
    t.wrapS = t.wrapT = ClampToEdgeWrapping;
    return t;
    // drawKey is the redraw trigger for content drawn through the `draw` ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texSize, drawKey]);
  useEffect(() => () => { texture?.dispose(); }, [texture]);

  const uniforms = useMemo(() => ({
    uPage: { value: null as CanvasTexture | null }, uRes: { value: new Vector2(1, 1) }, uDpr: { value: 1 },
    uCenter: { value: new Vector2() }, uShape: { value: new Vector4(80, 40, 40, 2) }, uStretch: { value: new Vector3(1, 0, 0) },
    uLight: { value: new Vector3(-0.5, 0.6, 0.6) }, uLift: { value: 6 }, uRefract: { value: 1 }, uDisperse: { value: 0.5 }, uFrost: { value: 0 },
    uMaxLod: { value: 8 }, uEnvLo: { value: new Color() }, uEnvHi: { value: new Color() }, uLightColor: { value: new Color() },
    uShadowColor: { value: new Color() }, uShadow: { value: 0.3 }, uCaustic: { value: 0.2 }, uDark: { value: 0 },
  }), []);

  // Built imperatively: R3F copies uniform objects passed as JSX props, so later writes would not reach the material.
  const samples = SAMPLES[quality.level];
  const material = useMemo(() => new ShaderMaterial({
    uniforms, vertexShader, fragmentShader, defines: { SAMPLES: samples }, depthTest: false, depthWrite: false,
  }), [uniforms, samples]);
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    uniforms.uPage.value = texture;
    if (texture) uniforms.uMaxLod.value = Math.floor(Math.log2(Math.max(texture.image.width, texture.image.height)));
    invalidate();
  }, [texture, uniforms, invalidate]);

  useEffect(() => {
    const u = uniforms;
    u.uRefract.value = refraction; u.uDisperse.value = dispersion; u.uFrost.value = frost;
    u.uEnvLo.value.set(look.envLo); u.uEnvHi.value.set(look.envHi); u.uLightColor.value.set(look.light); u.uShadowColor.value.set(look.shadow);
    u.uShadow.value = look.shadowAmount; u.uCaustic.value = look.caustic; u.uDark.value = look.dark ? 1 : 0;
    invalidate();
  }, [refraction, dispersion, frost, look, uniforms, invalidate]);

  useEffect(() => {
    wake.current = invalidate;
    invalidate();
    return () => { if (wake.current === invalidate) wake.current = null; };
  }, [wake, invalidate]);

  useFrame((state, dt) => {
    const busy = engine.step(dt);
    onFrame.current?.();
    state.gl.getDrawingBufferSize(buffer.current);
    const bw = buffer.current.x, bh = buffer.current.y;
    const k = bw / Math.max(1, state.size.width);
    const f = engine.frame();
    const u = uniforms;
    u.uRes.value.set(bw, bh);
    u.uDpr.value = k;
    u.uCenter.value.set(f.x * k, bh - f.y * k);
    u.uShape.value.set(f.hx * k, f.hy * k, f.r * k, f.n);
    u.uStretch.value.set(f.dirX, -f.dirY, f.stretch);
    u.uLight.value.set(f.lx, -f.ly, f.lz);
    u.uLift.value = (8 + 18 * f.lift) * k; // resting on a thin cushion of air; held glass rises
    if (busy) invalidate();
  });

  if (!texture) return null;
  return (
    <mesh frustumCulled={false} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
