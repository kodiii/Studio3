import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'layered-depth-stack',
  name: 'Layered Depth Stack',
  description: 'An exploded-interface illustration: four CSS-drawn UI layers pulled apart along Z under a perspective camera. A range input sets the separation, a second one (or the pointer) turns the view. Pure CSS 3D, no canvas.',
  category: '3d-transforms',
  specialties: ['product', '3d'],
  technology: ['css'],
  interaction: ['pointer', 'drag', 'keyboard'],
  complexity: 2,
  intensity: 'moderate',
  applications: ['design-system or architecture explainer', 'feature hero showing how a screen is built', 'release notes illustration', 'onboarding diagram'],
  dependencies: [],
  params: [
    { key: 'separation', label: 'Separation', type: 'number', default: 58, min: 0, max: 110, step: 2, unit: 'px' },
    { key: 'pitch', label: 'Camera pitch', type: 'number', default: 56, min: 30, max: 72, step: 1, unit: '°' },
    { key: 'pointer', label: 'Pointer influence', type: 'number', default: 8, min: 0, max: 20, step: 1, unit: '°' },
    { key: 'perspective', label: 'Perspective', type: 'number', default: 1500, min: 600, max: 3200, step: 50, unit: 'px' },
  ],
  accessibility: [
    'Separation and view angle are native range inputs with visible labels and value text, so everything the pointer does is available from the keyboard.',
    'The illustration is one labelled image (role="img"); the layer names and what each layer holds are listed as ordinary text beside it.',
    'Pointer tilt is an enhancement on top of the sliders and never the only way to see a layer.',
  ],
  reducedMotion: 'Pointer-driven tilt is switched off and the layers move without easing; the sliders still work because the movement is then directly user-controlled.',
  performance: [
    'Only custom properties change: the browser recomputes five transforms, with no layout and no JavaScript animation loop.',
    'Pointer updates are coalesced to one style write per animation frame.',
    'Layers are plain elements with borders and gradients; there are no images, filters or canvases.',
  ],
  preview: { height: 500 },
};
