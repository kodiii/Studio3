import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'exploded-view',
  name: 'Exploded View',
  description: 'A procedural seven-part compact camera that comes apart along each part\'s own direction as a range slider goes from 0 to 1, with staggered ease-in-out so parts leave one after another. Part rows and 3D parts highlight each other, and the camera steps back to keep the whole assembly framed.',
  category: 'spatial',
  specialties: ['3d', 'product'],
  technology: ['r3f', 'three'],
  interaction: ['drag', 'hover', 'keyboard', 'press', 'pointer'],
  complexity: 3,
  intensity: 'moderate',
  applications: ['product anatomy or "what\'s inside" section', 'repair and assembly guides', 'hardware launch page', 'spec sheet with parts list'],
  dependencies: [
    { name: 'three', version: '^0.187.0' },
    { name: '@react-three/fiber', version: '^9.8.2' },
  ],
  params: [
    { key: 'amount', label: 'Initial separation', type: 'number', default: 0.55, min: 0, max: 1, step: 0.05 },
    { key: 'spread', label: 'Spread', type: 'number', default: 1, min: 0.5, max: 1.5, step: 0.05, unit: '×' },
    { key: 'stagger', label: 'Stagger', type: 'number', default: 0.4, min: 0, max: 0.7, step: 0.05 },
    { key: 'accent', label: 'Highlight colour', type: 'color', default: '#bf2f09' },
  ],
  accessibility: [
    'Separation is a native range input (arrow keys, Page Up/Down, Home/End) with a visible percentage; Assemble and Explode buttons jump to the ends.',
    'Every part is a row button with its name and material in text: hovering or focusing a row lights the part, pointing at a part in the model marks its row, and clicking pins the highlight (aria-pressed).',
    'The emissive highlight is never the only signal — the row gains an accent bar and the part name appears in the label over the view.',
    'Without WebGL a flat exploded diagram is shown; the slider and the row highlights still drive it.',
  ],
  reducedMotion: 'Parts follow the slider directly with no easing tail, and Assemble / Explode cut straight to the end state instead of gliding; the row accent bar no longer animates.',
  performance: [
    'frameloop="demand": a frame is rendered only while the separation is settling or a highlight changes; at rest nothing renders.',
    'About 15 draw calls of primitive geometry, no textures except one baked floor blob; highlight is an emissive change on per-part materials (no extra passes).',
    'Raycasting for hover happens only on pointer events (R3F), never per frame.',
    'All geometries, materials and the canvas texture are created once and disposed on unmount.',
  ],
  preview: { height: 600 },
};
