import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'svg-path-draw',
  name: 'SVG Path Draw',
  description: 'An original line drawing of a lute assembles itself stroke by stroke: every path is normalised with pathLength="1", so one dash-offset keyframe draws any shape, and each part (body, rosette, frets, pegs, strings) gets its own easing on a single createSequence timeline before the fills arrive. Replay it, or scrub the timeline with a slider.',
  category: 'svg',
  specialties: ['cinematic', 'product'],
  technology: ['svg', 'waapi'],
  interaction: ['time', 'press', 'drag', 'keyboard'],
  complexity: 2,
  intensity: 'moderate',
  applications: ['brand mark or monogram reveal', 'illustrated section opener', 'product line-art explainer', 'empty-state or onboarding illustration'],
  dependencies: [],
  params: [
    { key: 'speed', label: 'Speed', type: 'number', default: 1, min: 0.5, max: 2, step: 0.1, unit: '×' },
    { key: 'stagger', label: 'Part stagger', type: 'number', default: 90, min: 0, max: 300, step: 10, unit: 'ms' },
    { key: 'easing', label: 'Easing', type: 'select', default: 'varied', options: ['varied', 'uniform'] },
    { key: 'fill', label: 'Fill after drawing', type: 'boolean', default: true },
    { key: 'strokeWidth', label: 'Stroke width', type: 'number', default: 2, min: 1, max: 4, step: 0.25, unit: 'px' },
  ],
  accessibility: [
    'The drawing is role="img" with <title> and <desc> describing the instrument; the individual strokes are not exposed.',
    'Replay is a button and the scrubber is a native range input (arrow keys, Page Up/Down, Home/End) with a "percent drawn" value text.',
    'Scrubbing pauses playback, so the drawing only moves while the user is moving it.',
  ],
  reducedMotion: 'The finished drawing is shown at once and Replay is a 160 ms fade; the scrubber still draws the lines, because that motion is under the user’s direct control.',
  performance: [
    'One WAAPI animation per path (stroke-dashoffset or fill-opacity) on a single createSequence timeline, so seek() scrubs everything with no per-frame JavaScript beyond the slider readout.',
    'pathLength="1" means no getTotalLength() measuring and no layout reads.',
    'The timeline is cancelled on unmount and rebuilt only when a parameter changes.',
  ],
  preview: { height: 540 },
};
