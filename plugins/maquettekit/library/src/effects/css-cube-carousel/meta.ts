import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'css-cube-carousel',
  name: 'CSS Cube Carousel',
  description: 'Four content panels on the faces of a prism that turns with transform-style: preserve-3d and a spring sampled into a CSS linear() easing. No WebGL, no animation loop: one transition on one element.',
  category: '3d-transforms',
  specialties: ['product', '3d'],
  technology: ['css'],
  interaction: ['press', 'keyboard'],
  complexity: 2,
  intensity: 'moderate',
  applications: ['process or onboarding steps', 'feature tour in a hero', 'testimonial rotator', 'product option picker'],
  dependencies: [],
  params: [
    { key: 'axis', label: 'Turn axis', type: 'select', default: 'horizontal', options: ['horizontal', 'vertical'] },
    { key: 'spring', label: 'Spring', type: 'select', default: 'settle', options: ['settle', 'glide', 'release', 'pop'] },
    { key: 'perspective', label: 'Perspective', type: 'number', default: 1100, min: 500, max: 2400, step: 50, unit: 'px' },
    { key: 'tilt', label: 'Tilt', type: 'number', default: 7, min: 0, max: 18, step: 1, unit: '°' },
  ],
  accessibility: [
    'Carousel semantics: a labelled region with aria-roledescription="carousel", each face a group named "n of 4: title"; a polite live region announces the new step.',
    'Only the front face is reachable: the other three are inert, so their controls leave the tab order and the accessibility tree.',
    'Previous/next buttons, step dots (aria-current) and Arrow / Home / End keys anywhere inside the carousel; all targets are at least 44 px (dots 28 px).',
    'It never auto-advances, so there is nothing to pause.',
  ],
  reducedMotion: 'The prism stops turning: the new panel replaces the old one with a 160 ms opacity cross-fade and the tilt is removed.',
  performance: [
    'A single transform transition on the prism element; faces are static compositor layers.',
    'The spring is pre-sampled with springToLinear(), so there is no JavaScript per frame.',
    'Sizes come from container-query units, so the prism depth always matches the face width without measuring.',
  ],
  preview: { height: 440 },
};
