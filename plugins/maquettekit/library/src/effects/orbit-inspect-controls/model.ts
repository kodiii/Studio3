/**
 * The pavilion maquette as plain data (metres at model scale, y up, plinth top at y = 0), shared by the WebGL scene,
 * the baked ground-shadow texture and the SVG fallback drawing — one source, three renderings.
 */
export type Box = { x: [number, number]; y: [number, number]; z: [number, number] };

export const SLAB: Box = { x: [-2.35, 2.35], y: [0, 0.05], z: [-1.65, 1.65] };
export const PODIUM: Box = { x: [-2.05, 2.1], y: [0.05, 0.17], z: [-1.4, 0.98] };
export const CORE: Box = { x: [-1.9, -0.55], y: [0.17, 1.24], z: [-1.25, 0.05] };
export const ROOF: Box = { x: [-1.7, 2.05], y: [1.24, 1.3], z: [-1.12, 1.28] };
export const FIN: Box = { x: [1.8, 1.85], y: [0.17, 1.24], z: [-1.1, -0.05] };
export const GLASS: Box = { x: [-0.55, 1.8], y: [0.17, 1.24], z: [-0.86, -0.84] };
export const PLINTH: Box = { x: [-2.6, 2.6], y: [-0.46, 0], z: [-1.9, 1.9] };
/** Two treads (three risers) down from the podium edge to the slab. */
export const STEPS: Box[] = [1, 2].map((i) => ({ x: [-0.2, 0.9], y: [0.05, 0.17 - i * 0.04], z: [0.98 + (i - 1) * 0.12, 1.1 + (i - 1) * 0.12] }));
/** Slender steel columns carrying the cantilevered roof (x, z). */
export const COLUMNS: [number, number][] = [[0.25, 0.92], [1.55, 0.92], [1.55, -0.62], [0.25, -0.62]];
export const COLUMN_RADIUS = 0.028;
/** Foam trees: trunk base (x, z), crown radius. */
export const TREES: { x: number; z: number; r: number }[] = [{ x: -2.0, z: 1.25, r: 0.3 }, { x: 2.05, z: -1.32, r: 0.26 }, { x: -1.55, z: 1.38, r: 0.2 }];
export const TREE_TRUNK = 0.42;
/** Scale figures (x, z, standing surface y). */
export const FIGURES: { x: number; z: number; y: number }[] = [{ x: 0.95, z: 0.55, y: 0.17 }, { x: -0.65, z: 1.32, y: 0.05 }];
export const FIGURE_HEIGHT = 0.36;

/** Direction the key light comes FROM (normalised in use). Shadows are baked for it, so it stays fixed to the model. */
export const KEY_DIR: [number, number, number] = [-4, 6, 3];

export const COLORS = {
  board: '#8c8478',
  paper: '#f3efe6',
  basswood: '#d9c4a0',
  steel: '#2a2925',
};
