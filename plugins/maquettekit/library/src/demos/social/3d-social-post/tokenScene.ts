/**
 * The 3D post's scene, as data: the generated "observatory" environment, the opening camera, the brass finish and
 * the poster box. TokenViewer.tsx renders from these values, and scripts/render-orbit-token-poster.mjs renders
 * the poster (apps/gallery/public/models/orbit-token.{png,webp}) from the same values, so the photo and the live
 * view line up when they cross-fade. Plain data and type-only imports, so Node can load this file directly.
 * Change a value here → re-run the poster script.
 */
import type { LightingPreset } from '../../../three';

type Vec3 = [number, number, number];

/** A generated environment for brass: bright shapes on a dark room, keyed from the top left like the page. */
export const OBSERVATORY: LightingPreset = {
  label: 'Observatory brass', description: 'Warm softbox top left, a tall white strip right, a cool strip behind, a soft warm wall behind the viewer, a red head-torch.', exposure: 1.02,
  ambient: { color: '#9fb0d8', intensity: 0.08 },
  key: { color: '#fff1dc', intensity: 2.4, position: [-4, 6, 4] },
  fill: { color: '#9db4ff', intensity: 0.35, position: [5, 2, 3] },
  rim: { color: '#cfe0ff', intensity: 1.6, position: [3.5, 3, -5] },
  env: { room: '#070a12', intensity: 1.15, panels: [
    { color: '#fff2dc', intensity: 18, position: [-4.5, 5, 3], size: [5, 2.2] },
    { color: '#ffffff', intensity: 24, position: [5.5, 2.5, 1.5], size: [0.9, 6] },
    { color: '#bcd0ff', intensity: 10, position: [-5, 2.5, -3.5], size: [0.8, 5] },
    { color: '#ffd9a0', intensity: 3, position: [0, -5, 2], size: [10, 3] },
    { color: '#ffe6c2', intensity: 2.6, position: [0.5, 1.6, 7], size: [9, 4.5] },
    { color: '#ff4a3a', intensity: 3.5, position: [-2.5, 0.6, 5], size: [0.28, 0.28] },
  ] },
};

/** The token GLB is in metres (6.3 cm across); the scene works at ×20. */
export const MODEL_SCALE = 20;
/** Opening camera: three-quarters round, looking at the token's centre (0.0315 m × 20). */
export const CAMERA = { fov: 30, near: 0.05, far: 40, position: [1.3, 0.98, 3.12] as Vec3 };
export const TARGET: Vec3 = [0, 0.63, 0];

/** Polished brass with a light clear coat. `color` is linear (working colour space). */
export const BRASS = {
  color: [0.88, 0.68, 0.32] as Vec3, metalness: 1, roughness: 0.3, clearcoat: 0.4, clearcoatRoughness: 0.1, envMapIntensity: 1.25,
};

/**
 * Where the poster sits in the 4:5 frame: a square centred on the frame (where the camera looks), `POSTER_WIDTH` of
 * the frame's width. styles.module.css `.posterTilt` must use the same numbers.
 */
export const FRAME_ASPECT = 4 / 5;
export const POSTER_WIDTH = 0.96;
