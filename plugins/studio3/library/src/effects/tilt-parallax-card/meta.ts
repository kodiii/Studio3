import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'tilt-parallax-card',
  name: 'Tilt Parallax Card',
  description: 'A night-pass card that leans toward the pointer: sky, moon, hill and text sit on separate translateZ planes inside one preserve-3d card, so the tilt opens real parallax between them, while a soft specular highlight slides across the surface. The motion is a hand-rolled damped spring on the shared rAF loop that stops itself at rest; keyboard focus gives the card a gentle fixed tilt.',
  category: 'cards',
  specialties: ['product', '3d', 'social'],
  technology: ['css'],
  interaction: ['pointer', 'hover', 'keyboard'],
  complexity: 2,
  intensity: 'moderate',
  applications: ['ticket, pass or membership card', 'product or collectible showcase', 'pricing plan highlight', 'portfolio cover card'],
  dependencies: [],
  params: [
    { key: 'maxTilt', label: 'Max tilt', type: 'number', default: 10, min: 0, max: 20, step: 1, unit: '°' },
    { key: 'depth', label: 'Layer depth', type: 'number', default: 1, min: 0, max: 2, step: 0.1, unit: '×' },
    { key: 'spring', label: 'Spring token', type: 'select', default: 'settle', options: ['settle', 'glide', 'release', 'press'] },
    { key: 'glare', label: 'Highlight', type: 'number', default: 40, min: 0, max: 100, step: 5, unit: '%' },
    { key: 'perspective', label: 'Perspective', type: 'number', default: 900, min: 500, max: 1600, step: 50, unit: 'px' },
  ],
  accessibility: [
    'The tilt is decorative and never carries information; the pass details are real text and the Save button is a normal toggle button (aria-pressed).',
    'Keyboard focus inside the card (focus-visible) gives it a fixed, gentle tilt and highlight, so keyboard users see the same depth without a pointer.',
    'Coarse pointers (touch) get no tilt, so scrolling past the card never wobbles it; artwork layers are aria-hidden.',
  ],
  reducedMotion: 'No tilt, spring or moving highlight: the card rests flat with a fixed soft sheen, and focus shows only the standard focus ring.',
  performance: [
    'One damped spring per channel is integrated inside useRafLoop and written as CSS custom properties; React never re-renders while the card moves.',
    'The loop runs only while the pointer is over the card or the spring is settling, and pauses offscreen or in a hidden tab.',
    'Pointer position is measured on the untransformed wrapper, so the tilt cannot feed back into its own measurement; only transforms and one gradient change.',
  ],
  preview: { height: 600 },
};
