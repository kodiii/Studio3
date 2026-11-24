import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'flip-card-3d',
  name: 'Flip Card 3D',
  description: 'A two-sided card that turns over on a real button, never on hover alone. Both sides share one grid cell so the card is always as tall as its taller side, and a moving highlight plus a breathing shadow sell the rotation.',
  category: '3d-transforms',
  specialties: ['product', '3d'],
  technology: ['css', 'waapi'],
  interaction: ['press', 'keyboard'],
  complexity: 2,
  intensity: 'moderate',
  applications: ['pricing plan summary and details', 'product card with specifications on the back', 'flashcards', 'membership or ticket card'],
  dependencies: [],
  params: [
    { key: 'axis', label: 'Flip axis', type: 'select', default: 'y', options: ['y', 'x'] },
    { key: 'duration', label: 'Duration', type: 'number', default: 640, min: 240, max: 1400, step: 20, unit: 'ms' },
    { key: 'perspective', label: 'Perspective', type: 'number', default: 1200, min: 500, max: 2400, step: 50, unit: 'px' },
    { key: 'lift', label: 'Lift', type: 'number', default: 36, min: 0, max: 90, step: 2, unit: 'px' },
  ],
  accessibility: [
    'Flipping is a button press (Enter/Space), and each side has its own clearly named button; nothing is revealed by hover only.',
    'The hidden side is inert, so its text and controls are out of the tab order and the accessibility tree; focus moves to the button on the side that just turned up.',
    'Both sides are real DOM text in a shared grid cell, so the card grows with zoom and translation instead of clipping.',
    'Sample pricing is labelled as sample data.',
  ],
  reducedMotion: 'No rotation, lift or highlight sweep: the two sides cross-fade in 160 ms.',
  performance: [
    'Rotation is a single CSS transform transition; lift, highlight and shadow are three short WAAPI animations on transform/opacity that are cancelled on unmount.',
    'backface-visibility hides the far side, so only one side is painted at a time.',
    'No layout work during the flip: height is resolved once by CSS grid.',
  ],
  preview: { height: 520 },
};
