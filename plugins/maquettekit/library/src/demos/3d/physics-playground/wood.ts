/**
 * Wood for the play table: procedural grain in OBJECT space, so every block reads as if it was cut from one piece
 * (long grain on the sides, growth rings on the end grain) and the grain stays glued to the block as it tumbles.
 * Built-in lit materials patched with onBeforeCompile (graphics.md §3): three's lights, shadows, fog and the
 * generated environment all still apply. No textures, no downloads.
 *
 * Also carries a fresnel rim (`uRim`, 0–1) that the scene raises on the hovered or held block.
 */
import { Color, LatheGeometry, MeshPhysicalMaterial, MeshStandardMaterial, SphereGeometry, Vector2, Vector3, type BufferGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SHAPES, type ShapeId } from './bodies';

export interface WoodUniforms {
  uRim: { value: number };
  uRimColor: { value: Color };
  uSeed: { value: Vector3 };
  uScale: { value: number };
  uRings: { value: number };
  uGrain: { value: number };
  /** 0: the log runs along local X (blocks, planks); 1: along local Y (pillars, balls). */
  uAxis: { value: number };
}

export interface WoodOptions {
  color: string;
  /** Deterministic per-piece variation of the grain. */
  seed: number;
  axis?: 0 | 1;
  /** Grain scale: larger = tighter grain. */
  scale?: number;
  rings?: number;
  /** How much darker the latewood lines are (0–1). */
  grain?: number;
  roughness?: number;
  /** Lacquer coat (MeshPhysicalMaterial clearcoat) — gate it by quality. */
  lacquer?: boolean;
  rimColor?: string;
}

const NOISE = /* glsl */ `
varying vec3 vWoodPos;
uniform float uRim;
uniform vec3 uRimColor;
uniform vec3 uSeed;
uniform float uScale;
uniform float uRings;
uniform float uGrain;
uniform float uAxis;
// Small-input value noise (no sin hash: stays precise on mediump GPUs, graphics.md §12).
float wHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float wNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(wHash(i), wHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(wHash(i + vec3(0.0, 1.0, 0.0)), wHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(wHash(i + vec3(0.0, 0.0, 1.0)), wHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(wHash(i + vec3(0.0, 1.0, 1.0)), wHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
// 0 = earlywood (light), 1 = latewood line (dark). The log axis is X after the swizzle.
float woodPattern(vec3 p0) {
  vec3 p = mix(p0, p0.yxz, uAxis) * uScale + uSeed;
  float warp = wNoise(p * vec3(0.22, 1.05, 1.05)) * 1.5 + wNoise(p * vec3(0.55, 2.4, 2.4)) * 0.45;
  float r = length(p.yz + vec2(2.3, 1.4)) + warp * 0.32;
  float ring = fract(r * uRings);
  float late = smoothstep(0.55, 0.86, ring) * (1.0 - smoothstep(0.88, 1.0, ring));
  float fibre = wNoise(vec3(p.x * 0.7, p.y * 36.0, p.z * 36.0));
  float pore = wNoise(vec3(p.x * 2.5, p.y * 90.0, p.z * 90.0));
  return clamp(late * 0.82 + (fibre - 0.5) * 0.3 + (pore - 0.5) * 0.12, 0.0, 1.0);
}
`;

/** A lit wood material with grain and a rim term. Dispose `material` yourself (it is not owned by R3F). */
export function createWoodMaterial(o: WoodOptions): { material: MeshStandardMaterial; uniforms: WoodUniforms } {
  const uniforms: WoodUniforms = {
    uRim: { value: 0 },
    uRimColor: { value: new Color(o.rimColor ?? '#ffd9a8') },
    uSeed: { value: new Vector3(((o.seed * 7.31) % 13) - 6.5, ((o.seed * 3.17) % 9) - 4.5, ((o.seed * 5.03) % 11) - 5.5) },
    uScale: { value: o.scale ?? 3.2 },
    uRings: { value: o.rings ?? 2.6 },
    uGrain: { value: o.grain ?? 0.26 },
    uAxis: { value: o.axis ?? 0 },
  };
  const params = { color: o.color, roughness: o.roughness ?? 0.5, metalness: 0 };
  const material = o.lacquer
    ? new MeshPhysicalMaterial({ ...params, clearcoat: 0.55, clearcoatRoughness: 0.32 })
    : new MeshStandardMaterial(params);
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWoodPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWoodPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat woodLine = woodPattern(vWoodPos);\ndiffuseColor.rgb *= 1.0 - uGrain * woodLine;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + woodLine * 0.14, 0.0, 1.0);')
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nfloat rimF = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.2);\ntotalEmissiveRadiance += uRimColor * rimF * uRim * 0.85;\nreflectedLight.directSpecular *= 1.0 + uRim * 0.6;');
  };
  // One compiled program per material class, whatever the colour or seed.
  material.customProgramCacheKey = () => `blockwerk-wood-${o.lacquer ? 'lacquer' : 'satin'}`;
  return { material, uniforms };
}

/* ── Geometry: bevelled pieces (edges catch the light) ────────────────────────────────────────────────────────── */

/** A cylinder with rounded top and bottom edges (LatheGeometry profile). */
function roundedCylinder(radius: number, height: number, fillet: number, segments: number): LatheGeometry {
  const pts: Vector2[] = [];
  const h = height / 2;
  pts.push(new Vector2(0, -h));
  const arc = 6;
  for (let i = 0; i <= arc; i++) { const a = -Math.PI / 2 + (i / arc) * (Math.PI / 2); pts.push(new Vector2(radius - fillet + Math.cos(a) * fillet, -h + fillet + Math.sin(a) * fillet)); }
  for (let i = 0; i <= arc; i++) { const a = (i / arc) * (Math.PI / 2); pts.push(new Vector2(radius - fillet + Math.cos(a) * fillet, h - fillet + Math.sin(a) * fillet)); }
  pts.push(new Vector2(0, h));
  return new LatheGeometry(pts, segments);
}

/** One shared geometry per shape. Dispose them when the table goes away. */
export function createToyGeometries(): Record<ShapeId, BufferGeometry> {
  const s = SHAPES;
  return {
    block: new RoundedBoxGeometry(...s.block.size, 3, 0.04),
    cube: new RoundedBoxGeometry(...s.cube.size, 3, 0.045),
    plank: new RoundedBoxGeometry(...s.plank.size, 2, 0.03),
    pillar: roundedCylinder(s.pillar.size[0] / 2, s.pillar.size[1], 0.045, 36),
    ball: new SphereGeometry(s.ball.size[0] / 2, 36, 22),
  };
}

/** Plank geometry for the tabletop; legs and rails reuse RoundedBox too. */
export const tableGeometry = {
  plank: (w: number, t: number, d: number) => new RoundedBoxGeometry(w, t, d, 2, 0.022),
  rail: (w: number, t: number, d: number) => new RoundedBoxGeometry(w, t, d, 2, 0.02),
  leg: (w: number, h: number) => new RoundedBoxGeometry(w, h, w, 2, 0.03),
};
