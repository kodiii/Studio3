import type { CameraPose, MaterialOverride, PartSelector } from '@maquettekit/library/three';

export interface Colourway { id: string; name: string; swatch: [string, string]; overrides: Partial<Record<PartSelector, MaterialOverride>> }
export interface Finish { id: string; name: string; note: string; overrides: Partial<Record<PartSelector, MaterialOverride>> }

export interface ViewerModel {
  id: string;
  name: string;
  blurb: string;
  manifestUrl: string;
  /** Uniform scale applied in the viewer (assets are authored in metres). */
  scale: number;
  target: [number, number, number];
  distance: [number, number];
  shadowRadius: number;
  presets: Record<string, CameraPose & { label: string }>;
  colourways: Colourway[];
  finishes: Finish[];
  facts: { label: string; value: string }[];
}

export const VIEWER_MODELS: ViewerModel[] = [
  {
    id: 'pulse-speaker',
    name: 'Pulse speaker',
    blurb: 'A fictional compact portable speaker: eleven named parts, six materials, two clips, three optimised builds.',
    manifestUrl: '/models/pulse-speaker.manifest.json',
    scale: 10,
    target: [0, 0.78, 0],
    distance: [2.2, 11],
    shadowRadius: 1.5,
    presets: {
      hero: { label: 'Three-quarter', position: [3.1, 1.9, 4.4], target: [0, 0.78, 0] },
      front: { label: 'Front', position: [0, 0.9, 5.6], target: [0, 0.78, 0] },
      top: { label: 'Top', position: [0.01, 5.6, 1.5], target: [0, 0.7, 0] },
      dial: { label: 'Dial detail', position: [1.55, 2.25, 1.55], target: [0.55, 1.05, 0] },
      back: { label: 'Back', position: [-2.6, 1.6, -4.6], target: [0, 0.78, 0] },
    },
    colourways: [
      { id: 'graphite', name: 'Graphite / Ember', swatch: ['#17181b', '#ed5c14'], overrides: {} },
      { id: 'bone', name: 'Bone / Cobalt', swatch: ['#d8d2c4', '#2748d6'], overrides: { 'material:ShellMatte': { color: '#cfc8b8' }, 'material:AccentAnodized': { color: '#1f3fd0' }, 'material:StrapFabric': { color: '#c9cfe6' } } },
      { id: 'moss', name: 'Moss / Brass', swatch: ['#3c4a3a', '#b98a35'], overrides: { 'material:ShellMatte': { color: '#33402f' }, 'material:AccentAnodized': { color: '#b98a35' }, 'material:StrapFabric': { color: '#d9c7a0' } } },
      { id: 'clay', name: 'Clay / Ink', swatch: ['#b3644a', '#1b1b1e'], overrides: { 'material:ShellMatte': { color: '#a9573d' }, 'material:AccentAnodized': { color: '#26262a' }, 'material:StrapFabric': { color: '#8f8a84' } } },
    ],
    finishes: [
      { id: 'matte', name: 'Soft-touch matte', note: 'As authored: rough shell, anodized hardware.', overrides: {} },
      { id: 'satin', name: 'Satin', note: 'Smoother shell that picks up the softbox.', overrides: { 'material:ShellMatte': { roughness: 0.45 }, 'material:AccentAnodized': { roughness: 0.22 } } },
      { id: 'blasted', name: 'Bead-blasted', note: 'Diffuse hardware, fully matte shell.', overrides: { 'material:ShellMatte': { roughness: 1 }, 'material:AccentAnodized': { roughness: 0.7, metalness: 0.85 } } },
    ],
    facts: [
      { label: 'Object', value: 'Portable speaker (fictional)' },
      { label: 'Size', value: '223 × 144 × 85 mm' },
      { label: 'Parts', value: 'Shell, grille, driver, dial, strap, feet' },
    ],
  },
  {
    id: 'orbit-token',
    name: 'Orbit token',
    blurb: 'A smooth brass token with faceted studs and a single spin clip — a one-draw-call asset for testing lighting and materials.',
    manifestUrl: '/models/orbit-token.manifest.json',
    scale: 28,
    target: [0, 0.88, 0],
    distance: [2, 10],
    shadowRadius: 1.1,
    presets: {
      hero: { label: 'Three-quarter', position: [2.4, 1.7, 4.2], target: [0, 0.88, 0] },
      front: { label: 'Front', position: [0, 0.88, 5], target: [0, 0.88, 0] },
      top: { label: 'Top', position: [0.01, 5, 1.2], target: [0, 0.8, 0] },
      edge: { label: 'Edge-on', position: [4.6, 1.1, 0.2], target: [0, 0.88, 0] },
    },
    colourways: [
      { id: 'gold', name: 'Gold', swatch: ['#dba038', '#f1d08a'], overrides: {} },
      { id: 'steel', name: 'Steel', swatch: ['#b9bec6', '#e6e9ee'], overrides: { 'material:TokenMetal': { color: '#c3c8d0' } } },
      { id: 'copper', name: 'Copper', swatch: ['#b8623a', '#e3a07f'], overrides: { 'material:TokenMetal': { color: '#c0623a' } } },
      { id: 'ink', name: 'Black oxide', swatch: ['#26272b', '#55575e'], overrides: { 'material:TokenMetal': { color: '#2b2c31' } } },
    ],
    finishes: [
      { id: 'polished', name: 'Polished', note: 'As authored: low roughness, mirror-like facets.', overrides: {} },
      { id: 'brushed', name: 'Brushed', note: 'Broader highlights.', overrides: { 'material:TokenMetal': { roughness: 0.55 } } },
      { id: 'enamel', name: 'Enamel', note: 'Dielectric coat instead of bare metal.', overrides: { 'material:TokenMetal': { metalness: 0, roughness: 0.3 } } },
    ],
    facts: [
      { label: 'Object', value: 'Faceted token (fictional)' },
      { label: 'Size', value: '63 mm diameter' },
      { label: 'Parts', value: 'Single mesh, one material' },
    ],
  },
];
