import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'progress-orbit-loader',
  name: 'Progress Orbit Loader',
  description: 'One SVG loader for the whole life of a job: while the size is unknown a dash orbits on eased turns and breathes in length, then it hands over to a determinate arc with a satellite marking the leading edge and a tabular-figure percentage that never jitters, and finally settles on "Done".',
  category: 'loading',
  specialties: ['product', 'data'],
  technology: ['svg', 'css'],
  interaction: ['time', 'press', 'keyboard'],
  complexity: 2,
  intensity: 'subtle',
  applications: ['file export or upload progress', 'report generation', 'install or sync screens', 'inline busy indicator in buttons and rows'],
  dependencies: [],
  params: [
    { key: 'sequence', label: 'Sequence', type: 'select', default: 'auto', options: ['auto', 'determinate', 'indeterminate'] },
    { key: 'duration', label: 'Job length', type: 'number', default: 5200, min: 2000, max: 12000, step: 200, unit: 'ms' },
    { key: 'orbit', label: 'Orbit period', type: 'number', default: 1500, min: 700, max: 3200, step: 100, unit: 'ms' },
    { key: 'thickness', label: 'Stroke', type: 'number', default: 6, min: 2, max: 12, step: 1, unit: 'px' },
    { key: 'satellite', label: 'Satellite', type: 'boolean', default: true },
  ],
  accessibility: [
    'role="progressbar" with aria-valuemin/max; aria-valuenow and a spoken aria-valuetext only while the amount is known (indeterminate omits aria-valuenow, as ARIA specifies).',
    'A separate polite live region announces phase changes (preparing, exporting, complete) instead of every percent.',
    'The readout uses tabular figures, so the number never shifts width; the ring and satellite are aria-hidden decoration.',
    'Restart is a real button reachable by keyboard.',
  ],
  reducedMotion: 'No orbit, breathing or easing: a static quarter ring with "Preparing" while indeterminate, then the ring and percentage update in place without transitions.',
  performance: [
    'Indeterminate motion is two CSS keyframe animations (rotation on a group, dash length on one circle); they unmount the moment the job becomes determinate.',
    'Determinate progress changes one stroke-dashoffset and one rotation per update (a few per second), smoothed by CSS transitions.',
    'The simulated job is one timer chain, cleared on restart and unmount.',
  ],
  preview: { height: 460 },
};
