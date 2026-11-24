import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'bar-race-transition',
  name: 'Bar Race Transition',
  description: 'Ranked horizontal bars that resize, re-sort and enter or leave the top list as a period stepper advances. Values and the zero-based axis are interpolated together, so bar length is truthful on every frame and labels tick with their bars.',
  category: 'charts',
  specialties: ['data', 'social'],
  technology: ['d3', 'css'],
  interaction: ['data', 'press', 'time', 'keyboard'],
  complexity: 2,
  intensity: 'moderate',
  applications: ['leaderboard over time', 'market-share history', 'annual report ranking explainer'],
  dependencies: [{ name: 'd3', version: '^7.9.2' }],
  params: [
    { key: 'visible', label: 'Bars shown', type: 'number', default: 6, min: 3, max: 8, step: 1 },
    { key: 'stepDuration', label: 'Step duration', type: 'number', default: 900, min: 300, max: 2400, step: 50, unit: 'ms' },
    { key: 'autoplay', label: 'Autoplay', type: 'boolean', default: false },
    { key: 'seed', label: 'Dataset seed', type: 'number', default: 6, min: 1, max: 99, step: 1 },
  ],
  accessibility: [
    'Previous, play/pause and next are real buttons; the period is also a native range input (arrow keys step periods).',
    'A live region announces the period and leader after manual steps and when playback ends, not on every autoplay tick.',
    'Every bar carries its rank, name and value as text; the leader is marked by rank and weight as well as colour.',
    'A visually-hidden table lists the full ranking for the current period.',
  ],
  reducedMotion: 'Play still advances, but each period is swapped in without tweening values or sliding rows; manual stepping is instant.',
  performance: [
    'Bars are scaled and rows translated with transforms only; the track is measured once per resize.',
    'One rAF tween per step, cancelled on pause, interruption and unmount.',
    'All competitors stay mounted and keyed, so enter and exit are opacity/transform changes rather than DOM churn.',
  ],
  preview: { height: 560 },
};
