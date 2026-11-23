import type { CameraPose, Hotspot, MaterialOverride, PartSelector } from '../../../three';

export const MANIFEST_URL = '/models/pulse-speaker.manifest.json';
export const POSTER = '/models/pulse-speaker.png';
export const SCALE = 10;
export const BASE_PRICE = 189;

type Overrides = Partial<Record<PartSelector, MaterialOverride>>;
export interface Option { id: string; name: string; note: string; price: number; swatch?: [string, string]; overrides: Overrides }

export const COLOURWAYS: Option[] = [
  { id: 'graphite', name: 'Graphite & Ember', note: 'Charcoal shell, orange hardware.', price: 0, swatch: ['#3d4045', '#ed5c14'], overrides: {} },
  { id: 'bone', name: 'Bone & Cobalt', note: 'Warm off-white shell, deep blue hardware.', price: 0, swatch: ['#d8d2c4', '#2748d6'], overrides: { 'material:ShellMatte': { color: '#cfc8b8' }, 'material:AccentAnodized': { color: '#1f3fd0' } } },
  { id: 'moss', name: 'Moss & Brass', note: 'Dark green shell, brass hardware.', price: 10, swatch: ['#3c4a3a', '#b98a35'], overrides: { 'material:ShellMatte': { color: '#33402f' }, 'material:AccentAnodized': { color: '#b98a35' } } },
  { id: 'clay', name: 'Clay & Ink', note: 'Terracotta shell, near-black hardware.', price: 10, swatch: ['#b3644a', '#1b1b1e'], overrides: { 'material:ShellMatte': { color: '#a9573d' }, 'material:AccentAnodized': { color: '#26262a' } } },
];
export const SHELL_FINISHES: Option[] = [
  { id: 'matte', name: 'Soft-touch matte', note: 'Diffuse, fingerprint-resistant.', price: 0, overrides: {} },
  { id: 'satin', name: 'Satin', note: 'A smoother coat that catches highlights.', price: 15, overrides: { 'material:ShellMatte': { roughness: 0.42 } } },
];
export const HARDWARE_FINISHES: Option[] = [
  { id: 'anodized', name: 'Anodized', note: 'Coloured aluminium, semi-gloss.', price: 0, overrides: {} },
  { id: 'polished', name: 'Polished', note: 'Mirror-like dial, ring and pins.', price: 20, overrides: { 'material:AccentAnodized': { roughness: 0.08 } } },
  { id: 'blasted', name: 'Bead-blasted', note: 'Soft, diffuse metal.', price: 12, overrides: { 'material:AccentAnodized': { roughness: 0.72 } } },
];
export const STRAPS: Option[] = [
  { id: 'woven', name: 'Woven fabric', note: 'Natural weave.', price: 0, overrides: {} },
  { id: 'dyed', name: 'Dyed to match', note: 'Weave tinted towards the hardware colour.', price: 8, overrides: {} },
  { id: 'none', name: 'No strap', note: 'Strap and pins left out.', price: -9, overrides: {} },
];

export const PRESETS: Record<string, CameraPose & { label: string }> = {
  hero: { label: 'Three-quarter', position: [3.1, 1.9, 4.4], target: [0, 0.8, 0] },
  front: { label: 'Front', position: [0, 0.9, 5.7], target: [0, 0.8, 0] },
  top: { label: 'Top', position: [0.01, 5.8, 1.5], target: [0, 0.7, 0] },
  dial: { label: 'Dial detail', position: [1.6, 2.3, 1.6], target: [0.55, 1.05, 0] },
};
/** Wider framing used while the model is exploded. */
export const EXPLODED_POSE: CameraPose = { position: [4.4, 2.6, 5.6], target: [0, 0.85, 0.15] };

export const HOTSPOTS: Hotspot[] = [
  { id: 'driver', node: 'Driver', label: '52 mm full-range driver', description: 'A single wide-band driver in a rubber surround, tuned for voices and small rooms.' },
  { id: 'dial', node: 'Knob', position: [0, 0.1, 0], label: 'Knurled volume dial', description: 'One control. Turn for volume, press to pause. The ring beneath it glows while paired.' },
  { id: 'strap', node: 'Strap', position: [0, 0.42, 0], label: 'Carry strap', description: 'Woven strap on two pins. It lifts off without tools if you would rather go without.' },
];
