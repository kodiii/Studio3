import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'liquid-glass-lens',
  name: 'Liquid Glass Lens',
  description: 'A thick glass lens you drag and throw across an editorial page drawn in the theme\'s own colours and type. A GLSL pass refracts the page through a flat-topped, round-edged SDF lens (pill, circle or squircle): the centre stays sharp while the rim bends, splits into spectral colour and catches one light that follows your pointer, over a soft glass shadow with a caustic.',
  category: 'shaders',
  specialties: ['cinematic', 'product', '3d'],
  technology: ['glsl', 'three', 'r3f', 'canvas2d'],
  interaction: ['drag', 'pointer', 'keyboard'],
  complexity: 3,
  intensity: 'bold',
  applications: [
    'hero over a headline or key visual',
    'product detail loupe over packaging or a label',
    'image inspection: drag a magnifier-style glass across a chart, map or scan',
    'glass control surface (tab bar, toolbar) prototype over live content',
  ],
  dependencies: [
    { name: 'three', version: '^0.187.0' },
    { name: '@react-three/fiber', version: '^9.8.2' },
  ],
  params: [
    { key: 'refraction', label: 'Refraction strength', type: 'number', default: 1, min: 0, max: 1.5, step: 0.05 },
    { key: 'dispersion', label: 'Dispersion', type: 'number', default: 0.55, min: 0, max: 1, step: 0.05 },
    { key: 'frost', label: 'Frost', type: 'number', default: 0, min: 0, max: 1, step: 0.05 },
    { key: 'shape', label: 'Shape', type: 'select', default: 'pill', options: ['pill', 'circle', 'squircle'] },
    { key: 'light', label: 'Light follows pointer', type: 'boolean', default: true },
  ],
  accessibility: [
    'The lens is a focusable control named "Glass lens" with visible focus: arrow keys move it, Shift with an arrow moves it four times further, Home centres it; its new position is announced in a polite live region.',
    'Shape is chosen with real buttons (aria-pressed) and a Centre button repeats the Home key, so nothing depends on dragging.',
    'The page under the glass is decorative sample content; the canvas carries a name and a description of what it shows.',
    'Without WebGL the same page is drawn as SVG under a CSS glass panel that is dragged and keyed the same way.',
  ],
  reducedMotion: 'The lens follows the pointer or keys directly: no momentum, rubber band, stretch or lift animation, shape changes snap, and the light stays at its resting angle. Everything stays operable.',
  performance: [
    'frameloop="demand": frames render only while the lens is held, gliding or settling, or while the light eases after the pointer; at rest nothing renders.',
    'One full-frame quad and one draw call. Pixels away from the lens and its shadow take a single texture read; the lens itself takes 6, 9 or 12 spectral taps by quality level.',
    'The page texture is drawn once at the drawing-buffer size (CSS size × the profile\'s DPR cap), with mipmaps for frost; it is redrawn only on theme, font or resize changes (debounced) and disposed each time.',
    'The lens physics runs in the R3F frame loop (or a rAF loop that pauses offscreen in the fallback) and stops when everything has settled.',
  ],
  preview: { height: 620 },
};
