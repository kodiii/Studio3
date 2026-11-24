import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'line-chart-morph',
  name: 'Line Chart Morph',
  description: 'A line and area chart that morphs between time ranges by interpolating data values, not pixels: the y-axis rescales continuously, gridlines cross-fade and the line never tears. A crosshair reads every point by pointer or arrow keys.',
  category: 'charts',
  specialties: ['data', 'product'],
  technology: ['d3', 'svg', 'css'],
  interaction: ['data', 'pointer', 'keyboard'],
  complexity: 2,
  intensity: 'moderate',
  applications: ['analytics overview with a range switcher', 'portfolio or usage history', 'KPI drill-down panel'],
  dependencies: [{ name: 'd3', version: '^7.9.2' }],
  params: [
    { key: 'duration', label: 'Morph duration', type: 'number', default: 560, min: 0, max: 1600, step: 20, unit: 'ms' },
    { key: 'curve', label: 'Curve', type: 'select', default: 'smooth', options: ['smooth', 'linear', 'step'] },
    { key: 'showArea', label: 'Area fill', type: 'boolean', default: true },
    { key: 'seed', label: 'Dataset seed', type: 'number', default: 7, min: 1, max: 99, step: 1 },
  ],
  accessibility: [
    'The range switcher is a native radio group (arrow keys move between ranges).',
    'The plot is a focusable slider: ←/→ step through points, Home/End jump, and aria-valuetext announces label and value.',
    'A visually-hidden data table mirrors the visible series; the SVG itself is aria-hidden.',
    'Single series: nothing is encoded by colour alone, and all figures use tabular numerals.',
  ],
  reducedMotion: 'Switching ranges swaps the dataset and axis instantly; crosshair and tooltip still work.',
  performance: [
    'Both datasets are resampled once to a shared resolution, so each frame is one array lerp and two path strings.',
    'The rAF loop only runs during a morph and is cancelled on unmount or interruption.',
    'Re-measures with ResizeObserver; no layout reads inside the animation loop.',
  ],
  preview: { height: 520 },
};
