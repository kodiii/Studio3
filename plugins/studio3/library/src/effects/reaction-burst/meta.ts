import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'reaction-burst',
  name: 'Reaction Burst',
  description: 'Reaction toggles that throw a short burst of matching shapes on a ballistic arc — launch cone, gravity, air drag and spin — while the count pops. Particles are drawn from a fixed pool on one canvas that sleeps when nothing is in the air.',
  category: 'social',
  specialties: ['social', 'product'],
  technology: ['canvas2d', 'waapi', 'css'],
  interaction: ['press', 'keyboard'],
  complexity: 2,
  intensity: 'bold',
  applications: ['post or comment reactions', 'live-stream applause', 'celebratory confirmation on a milestone'],
  dependencies: [],
  params: [
    { key: 'count', label: 'Particles per burst', type: 'number', default: 18, min: 4, max: 40, step: 1 },
    { key: 'power', label: 'Launch speed', type: 'number', default: 520, min: 200, max: 900, step: 20, unit: 'px/s' },
    { key: 'gravity', label: 'Gravity', type: 'number', default: 1100, min: 0, max: 2400, step: 50, unit: 'px/s²' },
    { key: 'spread', label: 'Launch cone', type: 'number', default: 70, min: 10, max: 180, step: 5, unit: '°' },
    { key: 'spin', label: 'Spin', type: 'number', default: 6, min: 0, max: 16, step: 1, unit: 'rad/s' },
  ],
  accessibility: [
    'Each reaction is a real toggle button (aria-pressed) whose name includes its label and text count.',
    'A polite status line confirms the change in words; the canvas is decorative and aria-hidden.',
    'Pressed state is shown by a filled icon and an inverted chip, not by colour alone; targets are 44 px tall.',
  ],
  reducedMotion: 'No particles: the count updates and the chip gives one brief opacity pulse.',
  performance: [
    'Fixed pool of 160 particles, reused; a burst never allocates.',
    'One canvas, DPR capped at 2, driven by useRafLoop and switched off as soon as the last particle dies.',
    'Shapes are cached Path2D objects; no layout reads inside the loop.',
  ],
  preview: { height: 460 },
};
