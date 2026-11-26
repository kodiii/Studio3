/**
 * Kelda Ridge (fictional): a deterministic height field, the walking route and the camera path.
 * Runs on the client only (inside the canvas), so floating-point output never meets server HTML.
 */
import { CatmullRomCurve3, Vector3, type Ray } from 'three';

export const SIZE = 64; // world units across the terrain square
export const WATER = 0.32;

const fract = (v: number): number => v - Math.floor(v);
function hash(ix: number, iz: number): number {
  let h = Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function noise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = fract(x);
  const fz = fract(z);
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
function fbm(x: number, z: number): number {
  let v = 0;
  let amp = 0.5;
  for (let i = 0; i < 4; i++) { v += amp * noise(x, z); x = x * 2.03 + 17.1; z = z * 2.03 - 9.4; amp *= 0.5; }
  return v;
}

/** The ridge line runs roughly west–east across the middle of the map. */
export const ridgeZ = (x: number): number => -6 + 0.22 * x + 2.2 * Math.sin(0.21 * x);

export function height(x: number, z: number): number {
  const d = z - ridgeZ(x);
  const crest = 6.2 + 1.6 * Math.sin(0.13 * x + 1) + 1.1 * Math.sin(0.31 * x - 0.4);
  let h = crest * Math.exp(-(d * d) / (2 * 4.6 * 4.6));
  h -= 2.8 * Math.exp(-((x + 4) * (x + 4) + (z - 13) * (z - 13)) / (2 * 5.2 * 5.2)); // the lake basin
  h += Math.max(0, -z - 12) * 0.42; // far fells behind the ridge
  h += 1.5 * (fbm(x * 0.11 + 3, z * 0.11) - 0.5) + 0.55 * (fbm(x * 0.36, z * 0.36 + 5) - 0.5);
  return Math.max(WATER, h + 1.25);
}

/** The marked path: lake shore → up the shoulder → along the crest. */
export function routePoints(): Vector3[] {
  const xz: [number, number][] = [[-7, 9.6], [-4.6, 6.2], [-2, 2.4], [0.5, -0.6], [3, ridgeZ(3)], [6, ridgeZ(6)], [9, ridgeZ(9)], [12, ridgeZ(12)], [15, ridgeZ(15) + 0.3]];
  const coarse = new CatmullRomCurve3(xz.map(([x, z]) => new Vector3(x, 0, z)));
  return coarse.getSpacedPoints(160).map((p) => new Vector3(p.x, height(p.x, p.z) + 0.1, p.z));
}

export type StopId = 'overview' | 'lake' | 'ridge' | 'sky';

export interface Viewpoint { id: StopId; position: [number, number, number]; target: [number, number, number] }

/** Camera stops in story order; the scroll camera travels through all four, the step buttons cut between the last three. */
export const VIEWPOINTS: readonly Viewpoint[] = [
  { id: 'overview', position: [0, 13.5, 31], target: [0, 5.6, -6] },
  { id: 'lake', position: [-10.5, 2.6, 18.5], target: [1.5, 3.6, 1] },
  { id: 'ridge', position: [2.2, 10.6, 2.6], target: [14, 8.2, -4.5] },
  { id: 'sky', position: [7.5, 12.4, -1.2], target: [5, 27, -42] },
];

export const cameraPath = (): { pos: CatmullRomCurve3; look: CatmullRomCurve3 } => ({
  pos: new CatmullRomCurve3(VIEWPOINTS.map((v) => new Vector3(...v.position)), false, 'centripetal'),
  look: new CatmullRomCurve3(VIEWPOINTS.map((v) => new Vector3(...v.target)), false, 'centripetal'),
});

/**
 * Where a ray first meets the height field (the head-torch aims at the pointer's spot on the ground).
 * Marches with a step that grows with distance, then bisects the crossing; false when the ray leaves the map or
 * points at the sky. Cheap enough to run once per rendered frame on the CPU.
 */
export function marchTerrain(ray: Ray, out: Vector3, maxDist = 95): boolean {
  const o = ray.origin;
  const d = ray.direction;
  const half = SIZE / 2;
  const above = (t: number): boolean => o.y + d.y * t > height(o.x + d.x * t, o.z + d.z * t);
  let prev = 0.3;
  if (!above(prev)) return false;
  for (let t = prev; t < maxDist; t += 0.18 + t * 0.018) {
    const x = o.x + d.x * t;
    const z = o.z + d.z * t;
    if (Math.abs(x) > half || Math.abs(z) > half) return false;
    if (!above(t)) {
      let a = prev;
      let b = t;
      for (let i = 0; i < 12; i++) { const m = (a + b) / 2; if (above(m)) a = m; else b = m; }
      out.set(o.x + d.x * b, o.y + d.y * b, o.z + d.z * b);
      return true;
    }
    prev = t;
  }
  return false;
}
