/** The toy box: shapes, colours and the starting arrangement (deterministic). */
export type ShapeId = 'block' | 'cube' | 'plank' | 'pillar' | 'ball';
export interface ShapeSpec { id: ShapeId; name: string; plural: string; size: [number, number, number]; note: string }

/** `size` = full extents in metres-ish scene units (x, y, z); pillars/balls use x as the diameter. */
export const SHAPES: Record<ShapeId, ShapeSpec> = {
  block: { id: 'block', name: 'Block', plural: 'Blocks', size: [0.8, 0.4, 0.4], note: 'The workhorse brick.' },
  cube: { id: 'cube', name: 'Cube', plural: 'Cubes', size: [0.5, 0.5, 0.5], note: 'Stacks anywhere.' },
  plank: { id: 'plank', name: 'Plank', plural: 'Planks', size: [1.4, 0.14, 0.4], note: 'Bridges two pillars.' },
  pillar: { id: 'pillar', name: 'Pillar', plural: 'Pillars', size: [0.4, 1, 0.4], note: 'Tall, tips easily.' },
  ball: { id: 'ball', name: 'Ball', plural: 'Balls', size: [0.56, 0.56, 0.56], note: 'Rolls off everything.' },
};
export const SHAPE_ORDER: ShapeId[] = ['block', 'cube', 'plank', 'pillar', 'ball'];

export const COLOURS = [
  { id: 'brick', name: 'brick', hex: '#b5452f' },
  { id: 'ochre', name: 'ochre', hex: '#d39b2a' },
  { id: 'slate', name: 'slate', hex: '#3d5b8c' },
  { id: 'sage', name: 'sage', hex: '#6d8d5c' },
  { id: 'birch', name: 'birch', hex: '#e3d5b8' },
] as const;
export type ColourId = (typeof COLOURS)[number]['id'];

export interface BodySpec {
  id: number;
  shape: ShapeId;
  colour: ColourId;
  position: [number, number, number];
  /** Yaw only (radians) — bodies start upright. */
  yaw: number;
}

/** Tabletop: top surface at y = 0, centred on the origin. */
export const TABLE = { width: 7.2, depth: 4.4, thickness: 0.36 };
/** Bodies beyond these limits have fallen off the world and are removed. */
export const BOUNDS = { minY: -5, maxXZ: 11 };
export const MAX_BODIES = 40;

export function initialBodies(): BodySpec[] {
  let id = 0;
  const b = (shape: ShapeId, colour: ColourId, x: number, y: number, z: number, yaw = 0): BodySpec => ({ id: ++id, shape, colour, position: [x, y, z], yaw });
  return [
    // a small tower of blocks
    b('block', 'brick', -2.2, 0.2, 0.2), b('block', 'ochre', -2.2, 0.6, 0.2, Math.PI / 2), b('block', 'slate', -2.2, 1.0, 0.2), b('cube', 'sage', -2.2, 1.45, 0.2),
    // a bridge: two pillars and a plank
    b('pillar', 'birch', 0.1, 0.5, -0.6), b('pillar', 'birch', 1.3, 0.5, -0.6), b('plank', 'brick', 0.7, 1.07, -0.6),
    // loose pieces
    b('cube', 'ochre', 1.9, 0.25, 1.1, 0.4), b('ball', 'slate', -0.6, 0.28, 1.3), b('ball', 'sage', 2.7, 0.28, -0.2),
  ];
}

/** Spawn position for an added body: above the table, cycling through a few drop points (deterministic). */
export function spawnPoint(n: number): [number, number, number] {
  const spots: [number, number][] = [[0, 0.4], [-1.2, -0.8], [1.4, 0.9], [-0.4, 1.2], [2.2, -0.9], [-2.6, -1], [0.9, -1.4]];
  const [x, z] = spots[n % spots.length];
  return [x, 2.6 + (n % 3) * 0.5, z];
}
