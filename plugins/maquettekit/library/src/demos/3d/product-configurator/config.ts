import type { CameraPose, Hotspot, MaterialOverride, PartSelector } from '../../../three';

export const MANIFEST_URL = '/models/pulse-speaker.manifest.json';
/** 1024 px transparent studio render shipped with the model (the no-WebGL / "still image" view). */
export const FALLBACK_IMAGE = '/models/pulse-speaker.webp';
/** Assets are authored in metres; the scene works in decimetres so the camera numbers stay readable. */
export const SCALE = 10;
export const BASE_PRICE = 189;

export type Overrides = Partial<Record<PartSelector, MaterialOverride>>;
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
/**
 * Always overridden (with values equal to the originals) so PartController clones these materials at load: the finish
 * sweep patches the clones, and the ring's breathing writes to its clone. Originals are never touched.
 */
export const OWNED_MATERIALS: Overrides = {
  'material:ShellMatte': { envMapIntensity: 1 },
  'material:AccentAnodized': { envMapIntensity: 1 },
  'material:StrapFabric': { envMapIntensity: 1 },
  'material:LightEmissive': { envMapIntensity: 1 },
};

/** Parts removed by the "No strap" option. */
export const STRAP_PARTS = ['Strap', 'StrapPinL', 'StrapPinR'] as const;

export const PRESETS: Record<string, CameraPose & { label: string }> = {
  front: { label: 'Front', position: [0, 0.9, 5.7], target: [0, 0.75, 0] },
  hero: { label: 'Three-quarter', position: [3.1, 1.9, 4.4], target: [0, 0.75, 0] },
  top: { label: 'Top', position: [0.01, 5.8, 1.5], target: [0, 0.7, 0] },
  dial: { label: 'Detail: dial', position: [1.6, 2.3, 1.6], target: [0.55, 1.05, 0] },
};
export const PRESET_ORDER = ['front', 'hero', 'top', 'dial'] as const;
export type PresetId = (typeof PRESET_ORDER)[number];
/** While exploded, every preset backs off along its own direction so the travelling parts stay in frame. */
export const EXPLODED_PULLBACK = 1.32;

export function widen(pose: CameraPose, factor: number): CameraPose {
  const [px, py, pz] = pose.position, [tx, ty, tz] = pose.target;
  return { ...pose, position: [tx + (px - tx) * factor, ty + (py - ty) * factor, tz + (pz - tz) * factor] };
}

export const HOTSPOTS: Hotspot[] = [
  { id: 'driver', node: 'Driver', position: [0, 0, 0.32], label: '52 mm full-range driver', description: 'A single wide-band driver in a rubber surround, tuned for voices and small rooms.' },
  { id: 'dial', node: 'Knob', position: [0, 0.1, 0], label: 'Knurled volume dial', description: 'One control. Turn for volume, press to pause. The ring beneath it glows while paired.' },
  { id: 'strap', node: 'Strap', position: [0, 0.42, 0], label: 'Carry strap', description: 'Woven strap on two pins. It lifts off without tools if you would rather go without.' },
];

/** Mix two #rrggbb colours (t = 0 → a, 1 → b). */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

export const formatPrice = (n: number): string => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
export const formatDelta = (n: number): string => (n === 0 ? 'Included' : `${n > 0 ? '+' : '−'}${formatPrice(Math.abs(n))}`);
