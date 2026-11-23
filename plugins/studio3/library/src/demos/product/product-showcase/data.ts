/**
 * Pulse — fictional compact speaker (model and contract: assets/models/README.md).
 * Colourway material overrides match the 3D Studio's configurator so both demos show the same product.
 * Prices and the specification are sample content.
 */
import type { CameraPose, Hotspot, MaterialOverride, PartSelector } from '../../../three';

export const MANIFEST_URL = '/models/pulse-speaker.manifest.json';
/** 1024 px transparent studio render shipped with the model: the poster and the no-WebGL view. */
export const POSTER = '/models/pulse-speaker.webp';
/** Assets are authored in metres; the scene works in decimetres so camera numbers stay readable. */
export const SCALE = 10;
export const BASE_PRICE = 189;

export type ColourId = 'graphite' | 'bone' | 'moss' | 'clay';
export interface Colourway {
  id: ColourId;
  name: string;
  note: string;
  price: number;
  /** Shell and hardware colours: the swatch, the 2D tint and the 3D material overrides. */
  shell: string;
  accent: string;
  overrides: Partial<Record<PartSelector, MaterialOverride>>;
  /** Backdrop of the product stage, light and dark theme (seamless paper in the shell's family). */
  stage: { light: string; dark: string };
}

export const COLOURWAYS: Colourway[] = [
  { id: 'graphite', name: 'Graphite & Ember', note: 'Charcoal shell, orange hardware', price: 0, shell: '#3d4045', accent: '#ed5c14', overrides: {}, stage: { light: '#e3e5e8', dark: '#1d2024' } },
  { id: 'bone', name: 'Bone & Cobalt', note: 'Warm off-white shell, deep blue hardware', price: 0, shell: '#cfc8b8', accent: '#1f3fd0', overrides: { 'material:ShellMatte': { color: '#cfc8b8' }, 'material:AccentAnodized': { color: '#1f3fd0' } }, stage: { light: '#ece6da', dark: '#25221d' } },
  { id: 'moss', name: 'Moss & Brass', note: 'Dark green shell, brass hardware', price: 10, shell: '#33402f', accent: '#b98a35', overrides: { 'material:ShellMatte': { color: '#33402f' }, 'material:AccentAnodized': { color: '#b98a35' } }, stage: { light: '#e1e6da', dark: '#1b2119' } },
  { id: 'clay', name: 'Clay & Ink', note: 'Terracotta shell, near-black hardware', price: 10, shell: '#a9573d', accent: '#26262a', overrides: { 'material:ShellMatte': { color: '#a9573d' }, 'material:AccentAnodized': { color: '#26262a' } }, stage: { light: '#f1e1d8', dark: '#281c17' } },
];
export const colourOf = (id: string): Colourway => COLOURWAYS.find((c) => c.id === id) ?? COLOURWAYS[0];

/** Annotated details. `at` places the marker over the 2D poster (percent of the image box); node/position track the model in 3D. */
export interface Detail extends Hotspot { at: { x: number; y: number }; preset: PresetId }
export const DETAILS: Detail[] = [
  { id: 'driver', node: 'Driver', position: [0, 0, 0.32], at: { x: 32.1, y: 57.1 }, preset: 'front', label: '52 mm full-range driver', description: 'One wide-band driver in a rubber surround, tuned for voices and small rooms.' },
  { id: 'dial', node: 'Knob', position: [0, 0.1, 0], at: { x: 67.4, y: 40 }, preset: 'dial', label: 'Knurled volume dial', description: 'The only control. Turn for volume, press to pause. The ring beneath it glows while a phone is paired.' },
  { id: 'strap', node: 'Strap', position: [0, 0.42, 0], at: { x: 84, y: 54.7 }, preset: 'hero', label: 'Removable carry strap', description: 'A woven strap on two pins. It lifts off without tools if you would rather go without.' },
];

export type PresetId = 'hero' | 'front' | 'top' | 'dial';
export const PRESETS: Record<PresetId, CameraPose & { label: string }> = {
  hero: { label: 'Three-quarter', position: [3.1, 1.9, 4.4], target: [0, 0.75, 0] },
  front: { label: 'Front', position: [0, 0.9, 5.7], target: [0, 0.75, 0] },
  top: { label: 'Top', position: [0.01, 5.8, 1.5], target: [0, 0.7, 0] },
  dial: { label: 'Dial', position: [1.6, 2.3, 1.6], target: [0.55, 1.05, 0] },
};
export const PRESET_ORDER: PresetId[] = ['hero', 'front', 'top', 'dial'];

export interface Spec { label: string; value: string; source: 'model' | 'sample' }
export const SPECS: Spec[] = [
  { label: 'Size', value: '223 × 144 × 85 mm (w × h × d)', source: 'model' },
  { label: 'Driver', value: 'One 52 mm full-range driver, rubber surround', source: 'sample' },
  { label: 'Controls', value: 'One dial: turn for volume, press to play or pause', source: 'sample' },
  { label: 'Status', value: 'Light ring under the dial: glows while paired', source: 'sample' },
  { label: 'Connection', value: 'Bluetooth, one phone at a time', source: 'sample' },
  { label: 'Battery', value: 'About 14 hours at half volume', source: 'sample' },
  { label: 'Charging', value: 'USB-C, cable in the box', source: 'sample' },
  { label: 'Materials', value: 'Soft-touch shell, perforated metal grille, anodised aluminium dial, trim ring and pins', source: 'sample' },
  { label: 'Strap', value: 'Woven fabric on two pins, removable without tools', source: 'sample' },
];

export const formatPrice = (n: number): string => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
