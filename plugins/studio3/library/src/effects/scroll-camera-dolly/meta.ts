import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'scroll-camera-dolly',
  name: 'Scroll Camera Dolly',
  description: 'Scrolling a self-contained region moves a camera along a Catmull-Rom spline through a fogged colonnade of gateways towards a low sun, with look-ahead targeting and three captions tied to progress ranges. The canvas renders only when progress changes.',
  category: 'camera',
  specialties: ['cinematic', '3d'],
  technology: ['r3f', 'three'],
  interaction: ['scroll', 'keyboard'],
  complexity: 3,
  intensity: 'bold',
  applications: ['scrollytelling chapter', 'product or venue fly-through', 'case-study opener', 'timeline with a spatial metaphor'],
  dependencies: [
    { name: 'three', version: '^0.187.0' },
    { name: '@react-three/fiber', version: '^9.8.2' },
  ],
  params: [
    { key: 'length', label: 'Scroll length', type: 'number', default: 4, min: 2, max: 7, step: 0.5, unit: '× height' },
    { key: 'lookAhead', label: 'Look-ahead', type: 'number', default: 0.08, min: 0.02, max: 0.25, step: 0.01 },
    { key: 'fog', label: 'Fog', type: 'number', default: 0.6, min: 0, max: 1, step: 0.05 },
    { key: 'gateways', label: 'Gateways', type: 'number', default: 10, min: 5, max: 16, step: 1 },
    { key: 'sway', label: 'Path sway', type: 'number', default: 1, min: 0, max: 1.5, step: 0.1 },
  ],
  accessibility: [
    'The scroll area is a focusable, labelled region, so arrow keys, Page Up/Down and Space scroll it like any other overflow container.',
    'Captions are real text that stays in the DOM; only their opacity follows progress, and a progress bar shows position.',
    'With reduced motion the three captioned viewpoints become numbered step buttons instead of a scroll.',
    'Without WebGL a drawn still of the colonnade is shown with all three captions as a list.',
  ],
  reducedMotion: 'No scroll-driven travel: the region stops scrolling and three step buttons cut between fixed viewpoints, each with its caption (one rendered frame per step).',
  performance: [
    'frameloop="demand": scroll progress is read in a passive, rAF-batched listener and a frame is requested only when it changes; easing towards the new progress stops requesting frames once settled.',
    'Columns and lintels are two instanced meshes, so the whole scene is five draw calls.',
    'Caption opacity is written straight to style, with no React re-render per scroll frame.',
  ],
  preview: { height: 480, stage: 'ink', scroll: true },
};
