import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'shader-aurora-plane',
  name: 'Aurora Shader Plane',
  description: 'A full-bleed GLSL background of slow, banded light built from domain-warped value noise. One draw call, one triangle pair, no textures.',
  category: 'shaders',
  specialties: ['cinematic', '3d'],
  technology: ['r3f', 'three', 'glsl'],
  interaction: ['time', 'pointer'],
  complexity: 3,
  intensity: 'moderate',
  applications: ['immersive hero background', 'section backdrop behind large type', 'loading curtain'],
  dependencies: [
    { name: 'three', version: '^0.187.0' },
    { name: '@react-three/fiber', version: '^9.8.2' },
  ],
  params: [
    { key: 'speed', label: 'Speed', type: 'number', default: 0.35, min: 0, max: 1.5, step: 0.05 },
    { key: 'bands', label: 'Band scale', type: 'number', default: 2.4, min: 0.8, max: 6, step: 0.1 },
    { key: 'colorA', label: 'Colour A', type: 'color', default: '#ff4a1c' },
    { key: 'colorB', label: 'Colour B', type: 'color', default: '#0f6b57' },
    { key: 'grain', label: 'Grain', type: 'number', default: 0.06, min: 0, max: 0.2, step: 0.01 },
  ],
  accessibility: [
    'Purely decorative: the canvas has a label and nothing depends on it; keep text contrast by placing copy on a scrim or solid surface.',
    'No flashing: luminance changes are slow and low-amplitude (well under three flashes per second).',
  ],
  reducedMotion: 'Renders a single static frame (render-on-demand, time frozen); pointer influence is disabled.',
  performance: [
    'A single full-screen quad: fill-rate bound, so cost scales with canvas pixels — StudioCanvas clamps DPR per quality profile.',
    'Loop pauses when offscreen or the tab is hidden; reduced motion switches to frameloop="demand".',
    'Material and geometry are disposed by R3F on unmount; no render targets or textures are allocated.',
  ],
  preview: { height: 380, stage: 'ink' },
};
