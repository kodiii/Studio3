import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'brush-linked-range',
  name: 'Brush Linked Range',
  description: 'Focus + context: an overview strip with a draggable, resizable brush drives a linked detail chart whose domain eases toward the selection. The brush is hand-built so both handles and the window itself are real keyboard sliders.',
  category: 'charts',
  specialties: ['data'],
  technology: ['d3', 'svg', 'css'],
  interaction: ['drag', 'keyboard', 'data', 'press'],
  complexity: 3,
  intensity: 'subtle',
  applications: ['time-series explorer', 'log or metrics zoom', 'financial history with range selection'],
  dependencies: [{ name: 'd3', version: '^7.9.2' }],
  params: [
    { key: 'smoothing', label: 'Domain easing', type: 'number', default: 160, min: 0, max: 600, step: 20, unit: 'ms' },
    { key: 'rescaleY', label: 'Rescale y to window', type: 'boolean', default: true },
    { key: 'minSpan', label: 'Minimum window', type: 'number', default: 10, min: 5, max: 45, step: 1, unit: 'days' },
    { key: 'seed', label: 'Dataset seed', type: 'number', default: 11, min: 1, max: 99, step: 1 },
  ],
  accessibility: [
    'Start handle, end handle and the window are three role="slider" controls with date-based aria-valuetext.',
    'Arrow keys move by one day, Shift+arrow or PageUp/PageDown by a week, Home/End jump to the limits; presets are plain buttons.',
    'The detail chart is role="img" with a generated text summary (range, mean, low, high); the same figures are visible beside it.',
    'Handles have 44 px hit areas; the y-axis always starts at zero and prints its scale, so rescaling is never silent.',
  ],
  reducedMotion: 'The detail domain snaps to the selection with no easing; dragging and keyboard control are unchanged.',
  performance: [
    'Pointer capture + a single rAF chase loop that stops when the displayed domain reaches the target.',
    'Only the points inside the visible window (plus one neighbour each side) are turned into a path each frame.',
    'The overview path is computed once per size; both charts re-measure via ResizeObserver.',
  ],
  preview: { height: 600 },
};
