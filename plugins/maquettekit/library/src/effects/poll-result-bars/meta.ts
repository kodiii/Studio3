import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'poll-result-bars',
  name: 'Poll Result Bars',
  description: 'A single-choice poll whose option rows turn into result bars in place: fills slide out to each share on a staggered WAAPI timeline while the percentages count up in lockstep with each bar’s own eased progress. Your pick keeps its spot, gains a check and "Your vote", and you can change it.',
  category: 'social',
  specialties: ['social', 'data'],
  technology: ['css', 'waapi'],
  interaction: ['press', 'keyboard', 'data'],
  complexity: 2,
  intensity: 'moderate',
  applications: ['community or newsletter poll', 'event feedback question', 'in-feed quick vote', 'product survey teaser'],
  dependencies: [],
  params: [
    { key: 'duration', label: 'Bar duration', type: 'number', default: 1000, min: 400, max: 2000, step: 50, unit: 'ms' },
    { key: 'stagger', label: 'Stagger', type: 'number', default: 90, min: 0, max: 240, step: 10, unit: 'ms' },
    { key: 'easing', label: 'Easing', type: 'select', default: 'emphasized', options: ['emphasized', 'standard', 'inOut', 'overshoot'] },
    { key: 'highlight', label: 'Accent bar', type: 'select', default: 'choice', options: ['choice', 'leader', 'none'] },
    { key: 'countUp', label: 'Count up labels', type: 'boolean', default: true },
  ],
  accessibility: [
    'Native radio group inside a fieldset with the question as its legend: arrow keys move the choice, Enter or the Vote button submits.',
    'Results are a list whose rows read as "option, percent", plus "Your vote" and "Leading" as words with an icon; the accent fill is never the only cue.',
    'A polite live region reads the final results once; the counting numbers are not announced frame by frame.',
    'Focus moves to "Change vote" after voting and back to the checked radio after choosing to change it.',
  ],
  reducedMotion: 'Bars appear at their final width with a 160 ms opacity fade and the percentages are shown immediately.',
  performance: [
    'Each fill is a full-width layer translated inside a clipped track (transform only), so rounded ends never distort.',
    'Counting reads getComputedTiming().progress of each bar inside one useRafLoop that runs only while bars move.',
    'The final transform is the inline style, so no fill-mode animations linger; everything is cancelled on unmount.',
  ],
  preview: { height: 500 },
};
