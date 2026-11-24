import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'split-line-reveal',
  name: 'Split Line Reveal',
  description: 'Headline words rise from behind a clipping mask with a parent→child stagger, sequenced on the Web Animations API so it can be interrupted, replayed and cleaned up.',
  category: 'typography',
  specialties: ['cinematic', 'product'],
  technology: ['waapi', 'css'],
  interaction: ['time'],
  complexity: 1,
  intensity: 'moderate',
  applications: ['hero headline', 'section title entering the viewport', 'case-study opener'],
  dependencies: [],
  params: [
    { key: 'text', label: 'Text', type: 'text', default: 'Motion that means something', maxLength: 80 },
    { key: 'stagger', label: 'Stagger', type: 'number', default: 48, min: 0, max: 160, step: 4, unit: 'ms' },
    { key: 'duration', label: 'Duration', type: 'number', default: 720, min: 200, max: 1600, step: 20, unit: 'ms' },
    { key: 'rise', label: 'Rise', type: 'number', default: 110, min: 20, max: 140, step: 5, unit: '%' },
    { key: 'skew', label: 'Skew', type: 'boolean', default: true },
  ],
  accessibility: [
    'The heading exposes the full sentence through aria-label; the split spans are aria-hidden so screen readers do not read word by word.',
    'Text is real DOM text: selectable, translatable and zoomable.',
  ],
  reducedMotion: 'Words are shown immediately with no transform; the sequence collapses to its end state.',
  performance: [
    'Animates transform and opacity only (compositor-friendly).',
    'Splits by word, not by character, to keep the animated layer count low.',
    'The sequence is cancelled on unmount so no animations outlive the component.',
  ],
  preview: { height: 320 },
};
