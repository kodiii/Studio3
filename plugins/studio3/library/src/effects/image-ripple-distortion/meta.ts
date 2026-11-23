import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'image-ripple-distortion',
  name: 'Image Ripple Distortion',
  description: 'A poster series drawn on the fly with canvas2d in the theme\'s own colours and type, swapped by a GLSL ripple: a displacement front with chromatic split travels out from where you click and reveals the next poster. Hovering stirs a faint ripple under the pointer.',
  category: 'shaders',
  specialties: ['cinematic', 'social'],
  technology: ['r3f', 'three', 'glsl', 'canvas2d'],
  interaction: ['press', 'pointer', 'keyboard'],
  complexity: 3,
  intensity: 'bold',
  applications: ['portfolio or exhibition carousel', 'editorial hero rotation', 'product colourway switcher', 'event poster wall'],
  dependencies: [
    { name: 'three', version: '^0.187.0' },
    { name: '@react-three/fiber', version: '^9.8.2' },
  ],
  params: [
    { key: 'amplitude', label: 'Displacement', type: 'number', default: 0.05, min: 0, max: 0.14, step: 0.005 },
    { key: 'chroma', label: 'Chromatic split', type: 'number', default: 1, min: 0, max: 2.5, step: 0.1 },
    { key: 'duration', label: 'Transition', type: 'number', default: 1100, min: 400, max: 2400, step: 50, unit: 'ms' },
    { key: 'frequency', label: 'Ripple frequency', type: 'number', default: 3, min: 1, max: 8, step: 0.5 },
    { key: 'hover', label: 'Hover ripple', type: 'boolean', default: true },
  ],
  accessibility: [
    'A real "Next poster" button is the keyboard path; clicking the poster is only a pointer shortcut that also chooses the ripple origin.',
    'Poster title and subtitle are DOM text in a polite live region, and the canvas label names the current poster, so nothing lives only in pixels.',
    'Distortion is brief, low-frequency and user-triggered; there is no autoplay and no flashing.',
    'Without WebGL the same generated posters are shown as images that cross-fade.',
  ],
  reducedMotion: 'No displacement, chromatic split or hover ripple: Next cross-fades the posters in 160 ms.',
  performance: [
    'frameloop="demand": frames render only during a transition or while the hover ripple is fading; at rest nothing renders.',
    'One full-frame quad, one draw call; three poster CanvasTextures sized by the quality profile (no mipmaps), regenerated only when the theme or fonts change and disposed every time.',
    'Fonts are awaited with document.fonts.load before the posters are redrawn, so textures never bake a fallback face.',
  ],
  preview: { height: 560 },
};
