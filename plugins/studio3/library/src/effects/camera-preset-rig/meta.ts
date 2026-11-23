import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'camera-preset-rig',
  name: 'Camera Preset Rig',
  description: 'A procedural still-life on a plinth with four named camera positions. Choosing a preset glides position and look-at target on a critically damped spring that can be interrupted mid-flight, and the canvas only renders while the camera is moving.',
  category: 'camera',
  specialties: ['3d', 'product'],
  technology: ['r3f', 'three'],
  interaction: ['press', 'keyboard'],
  complexity: 3,
  intensity: 'moderate',
  applications: ['product configurator views', 'architectural or furniture viewer', 'guided 3D story with fixed viewpoints', 'case-study hero with a detail shot'],
  dependencies: [
    { name: 'three', version: '^0.187.0' },
    { name: '@react-three/fiber', version: '^9.8.2' },
  ],
  params: [
    { key: 'preset', label: 'Opening view', type: 'select', default: 'Three-quarter', options: ['Front', 'Three-quarter', 'Top', 'Detail'] },
    { key: 'glide', label: 'Glide time', type: 'number', default: 0.55, min: 0.15, max: 1.6, step: 0.05, unit: 's' },
    { key: 'fov', label: 'Field of view', type: 'number', default: 30, min: 18, max: 55, step: 1, unit: '°' },
    { key: 'accent', label: 'Sphere colour', type: 'color', default: '#e03a0c' },
  ],
  accessibility: [
    'Views are a native radio group in a fieldset: Tab reaches it, arrow keys change the view, and the current view is announced as the checked option.',
    'The canvas has an accessible name and a text description of the composition; a line of text under the picture says what the current view shows.',
    'When WebGL is unavailable an SVG drawing of the same still-life is shown, and the radio group still describes each view.',
  ],
  reducedMotion: 'The camera cuts straight to the chosen preset: one rendered frame, no travel.',
  performance: [
    'frameloop="demand": at rest nothing renders; while gliding each frame requests the next with invalidate() and stops once position and target have settled.',
    'Eight draw calls of primitive geometry; real shadow maps only on quality profiles that allow them, otherwise generated contact-shadow textures.',
    'The generated shadow texture is disposed on unmount; JSX-declared geometry and materials are released by R3F.',
  ],
  preview: { height: 520 },
};
