import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'like-heart-morph',
  name: 'Like Heart Morph',
  description: 'Like and save controls that morph instead of swapping icons: the heart fills from its centre on an overshoot spring with a ring and ray burst, the bookmark ribbon unrolls downward. Undoing plays a shorter, quieter reverse and rapid toggling never desynchronises.',
  category: 'social',
  specialties: ['social', 'product'],
  technology: ['svg', 'waapi', 'css'],
  interaction: ['press', 'keyboard'],
  complexity: 2,
  intensity: 'moderate',
  applications: ['feed post actions', 'article save for later', 'product wishlist', 'media player favourite'],
  dependencies: [],
  params: [
    { key: 'size', label: 'Icon size', type: 'number', default: 40, min: 24, max: 72, step: 2, unit: 'px' },
    { key: 'spring', label: 'Spring', type: 'select', default: 'pop', options: ['pop', 'settle', 'press'] },
    { key: 'rays', label: 'Burst rays', type: 'number', default: 8, min: 0, max: 14, step: 1 },
    { key: 'speed', label: 'Speed', type: 'number', default: 1, min: 0.5, max: 2, step: 0.1, unit: '×' },
  ],
  accessibility: [
    'Both controls are toggle buttons with aria-pressed and a stable accessible name; the visible caption changes (Like → Liked, Save → Saved) and the like count is text.',
    'State is carried by fill and caption, not colour alone; the burst is aria-hidden decoration.',
    'Works with Enter/Space; focus ring is visible on the whole control; targets are at least 44 px.',
  ],
  reducedMotion: 'The icon fill cross-fades in 160 ms; no spring, ring or rays.',
  performance: [
    'Transform and opacity only, on a handful of SVG nodes.',
    'Each toggle cancels the previous sequence and starts from the current computed transform, so interruptions are seamless and nothing accumulates.',
    'Sequences are cancelled on unmount.',
  ],
  preview: { height: 420 },
};
