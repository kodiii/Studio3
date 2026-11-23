import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'blob-morph',
  name: 'Blob Morph',
  description: 'Seeded organic forms that morph point-for-point on a spring. Every keyframe samples the same angles, so one closed Catmull-Rom path glides between shapes without kinks; the form masks an illustration, an avatar or a solid fill.',
  category: 'svg',
  specialties: ['social', 'product', 'cinematic'],
  technology: ['svg', 'waapi'],
  interaction: ['hover', 'press', 'keyboard', 'time'],
  complexity: 2,
  intensity: 'moderate',
  applications: ['avatar or profile-picture mask', 'hero illustration frame', 'empty-state or onboarding art', 'playful section divider'],
  dependencies: [],
  params: [
    { key: 'points', label: 'Anchor points', type: 'number', default: 9, min: 6, max: 14, step: 1 },
    { key: 'wobble', label: 'Wobble', type: 'number', default: 0.2, min: 0.04, max: 0.4, step: 0.01 },
    { key: 'seed', label: 'Seed', type: 'number', default: 7, min: 1, max: 99, step: 1 },
    { key: 'drift', label: 'Idle drift', type: 'boolean', default: true },
    { key: 'spring', label: 'Spring', type: 'select', default: 'glide', options: ['glide', 'settle', 'release'] },
    { key: 'fill', label: 'Mask content', type: 'select', default: 'Landscape', options: ['Landscape', 'Portrait', 'Solid'] },
  ],
  accessibility: [
    'The shape is a real button: hovering it, focusing it with the keyboard or pressing it picks the next form, and its label names the form that is showing.',
    'Thumbnail buttons (aria-pressed) jump straight to any form; the form counter is a polite live region.',
    'The masked illustration is decorative (aria-hidden) — no information depends on the shape.',
    'Touch taps morph once (hover is ignored for touch, so a tap never skips two forms).',
  ],
  reducedMotion: 'Idle drift is switched off and the shape no longer morphs: forms swap with a 160 ms cross-fade from a ghost of the previous form.',
  performance: [
    'One SVG path (plus its hairline echo) is rewritten per frame only while a spring is settling or drift is on; the useRafLoop loop stops at rest and pauses offscreen or in a hidden tab.',
    'Shapes are generated once per seed / point-count / wobble change; a frame integrates 6–14 springs in fixed substeps with no layout reads.',
    'The mask is plain SVG — no filters, no canvas.',
  ],
  preview: { height: 460 },
};
