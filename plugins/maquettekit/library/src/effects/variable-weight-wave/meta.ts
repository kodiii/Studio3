import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'variable-weight-wave',
  name: 'Variable Weight Wave',
  description: 'A headline whose variable-font weight (and optionally width) swells letter by letter under the pointer, breathes when idle and can be swept from the keyboard. Lines are locked after measuring so the block never reflows.',
  category: 'typography',
  specialties: ['cinematic', 'product'],
  technology: ['css'],
  interaction: ['pointer', 'keyboard', 'time'],
  complexity: 2,
  intensity: 'moderate',
  applications: ['hero headline', 'brand wordmark', '404 or empty-state title', 'section divider statement'],
  dependencies: [],
  params: [
    { key: 'text', label: 'Text', type: 'text', default: 'Weight follows attention', maxLength: 60 },
    { key: 'minWeight', label: 'Rest weight', type: 'number', default: 260, min: 200, max: 500, step: 10 },
    { key: 'maxWeight', label: 'Peak weight', type: 'number', default: 800, min: 500, max: 800, step: 10 },
    { key: 'radius', label: 'Wave radius', type: 'number', default: 1.1, min: 0.4, max: 3, step: 0.1, unit: 'em' },
    { key: 'squeeze', label: 'Narrow width at peak', type: 'boolean', default: true },
    { key: 'idle', label: 'Idle breathing', type: 'boolean', default: true },
  ],
  accessibility: [
    'The heading carries the sentence once through aria-label; every per-letter span and the measuring copy are aria-hidden.',
    'The heading is focusable: keyboard focus sweeps the wave across the line and Arrow/Home/End keys move it letter by letter.',
    'Text stays real DOM text and scales with zoom; weight never drops below the rest weight chosen for contrast.',
  ],
  reducedMotion: 'The loop does not run: letters sit at a single mid weight and neither pointer, focus nor idle changes them.',
  performance: [
    'One rAF loop (useRafLoop, paused offscreen) writes a single custom property per letter and skips letters whose value did not change.',
    'Letter centres are measured once per layout change, never inside the loop.',
    'Lines are pre-measured and rendered nowrap, so weight changes cannot re-break lines or change the block height.',
  ],
  preview: { height: 380 },
};
