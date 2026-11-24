/**
 * The field radio (a fictional sample product) as data: hotspots, their camera poses and the colours shared by the
 * WebGL scene and the SVG fallback. Units are metres, y up, the radio stands on y = 0 facing +z.
 */
import type { CameraPose, Vec3 } from '../../three';

export interface Spot { id: string; label: string; description: string; position: Vec3; side: 'front' | 'top' | 'back' }

export const BODY = { w: 2.6, h: 1.56, d: 0.9, y: 0.84 };
export const FRONT_Z = BODY.d / 2;

export const SPOTS: readonly Spot[] = [
  { id: 'dial', label: 'Tuning dial', side: 'front', position: [0.7, 0.56, 0.68], description: 'A weighted brass dial with a long, slow throw, so stations are found by feel rather than by looking.' },
  { id: 'grille', label: 'Speaker grille', side: 'front', position: [-0.52, 0.84, 0.5], description: 'A perforated front panel over a single full-range driver; the hole pattern is the only decoration.' },
  { id: 'handle', label: 'Carry strap', side: 'top', position: [0, 2.36, 0], description: 'A flat leather strap on two brass posts, long enough to carry the radio with one hand.' },
  { id: 'battery', label: 'Battery door', side: 'back', position: [0.2, 0.72, -0.5], description: 'A tool-free door on the back panel. It is only visible after orbiting round, so its marker fades while hidden.' },
];

export const PRESETS: Readonly<Record<string, CameraPose>> = {
  home: { position: [3.5, 2.5, 6.3], target: [0, 0.98, 0] },
  dial: { position: [2.35, 1.25, 3.35], target: [0.62, 0.62, 0.45] },
  grille: { position: [-1.75, 1.35, 3.45], target: [-0.45, 0.86, 0.45] },
  handle: { position: [2.4, 3.7, 3.2], target: [0, 1.85, 0] },
  battery: { position: [-2.3, 1.7, -3.7], target: [0.2, 0.78, -0.45] },
};

export const COLORS = {
  enamel: '#e7ddc9',
  panel: '#24221e',
  brass: '#b68b4c',
  leather: '#7b4529',
  steel: '#c8c7c2',
  needle: '#d2380f',
  door: '#d8cdb6',
};
