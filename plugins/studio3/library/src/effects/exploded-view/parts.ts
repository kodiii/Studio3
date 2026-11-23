/**
 * The compact camera assembly as data: each part's name, what it is made of, the direction it leaves in, how far,
 * and its place in the stagger. Shared by the WebGL scene and the SVG fallback.
 */
export type PartId = 'body' | 'top' | 'grip' | 'mount' | 'barrel' | 'glass' | 'battery';
export interface Part { id: PartId; name: string; material: string; dir: [number, number, number]; distance: number; order: number }

export const PARTS: readonly Part[] = [
  { id: 'glass', name: 'Front element', material: 'Coated optical glass', dir: [0, 0, 1], distance: 2.3, order: 0 },
  { id: 'barrel', name: 'Lens barrel', material: 'Anodised aluminium, accent ring', dir: [0, 0, 1], distance: 1.55, order: 1 },
  { id: 'mount', name: 'Lens mount', material: 'Machined steel bayonet', dir: [0, 0, 1], distance: 0.8, order: 2 },
  { id: 'top', name: 'Top plate', material: 'Brushed aluminium, shutter dial', dir: [0, 1, 0], distance: 1.0, order: 3 },
  { id: 'grip', name: 'Front grip', material: 'Leather over cork', dir: [-1, 0, 0.35], distance: 1.0, order: 4 },
  { id: 'battery', name: 'Battery', material: 'Lithium cell, keyed housing', dir: [0, -1, 0], distance: 1.2, order: 5 },
  { id: 'body', name: 'Body shell', material: 'Die-cast chassis in leatherette', dir: [0, 0, 0], distance: 0, order: 6 },
];

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Per-part progress for the global amount: parts leave one after another (stagger = share of the range spent waiting). */
export function partProgress(order: number, amount: number, stagger: number, movers = 6): number {
  const delay = movers > 1 ? (Math.min(order, movers - 1) / (movers - 1)) * stagger : 0;
  return easeInOut(Math.min(1, Math.max(0, (amount - delay) / Math.max(0.05, 1 - stagger))));
}

export const COLORS = {
  leatherette: '#2c2926',
  alu: '#cfcbc3',
  steel: '#9d9a94',
  anodised: '#1d1c1a',
  glass: '#10171a',
  grip: '#73452a',
  battery: '#474a50',
};
