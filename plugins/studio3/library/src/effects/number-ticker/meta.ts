import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'number-ticker',
  name: 'Number Ticker',
  description: 'An odometer-style numeric transition: each digit is its own rolling column that travels through the intermediate digits in the direction of change, with locale-aware formatting and a delta chip that states the change in words.',
  category: 'charts',
  specialties: ['data', 'product'],
  technology: ['waapi', 'css'],
  interaction: ['data', 'press'],
  complexity: 2,
  intensity: 'subtle',
  applications: ['KPI tile', 'pricing total', 'live counter in a dashboard header', 'checkout summary'],
  dependencies: [],
  params: [
    { key: 'series', label: 'Value preset', type: 'select', default: 'volatile', options: ['volatile', 'steady climb', 'countdown'] },
    { key: 'format', label: 'Format', type: 'select', default: 'integer', options: ['integer', 'currency', 'compact', 'percent'] },
    { key: 'locale', label: 'Locale', type: 'select', default: 'en-US', options: ['en-US', 'de-DE', 'fr-FR', 'en-IN', 'ja-JP'] },
    { key: 'duration', label: 'Roll duration', type: 'number', default: 720, min: 200, max: 2000, step: 20, unit: 'ms' },
    { key: 'stagger', label: 'Digit stagger', type: 'number', default: 36, min: 0, max: 120, step: 4, unit: 'ms' },
  ],
  accessibility: [
    'The value is exposed once, as a single formatted text node in a polite status region; the rolling digit columns are aria-hidden.',
    'The delta chip pairs its arrow with a signed number and the words up/down, so direction never depends on colour.',
    'Tabular numerals and fixed-width digit cells keep the layout from shifting while digits roll.',
  ],
  reducedMotion: 'Digits swap instantly with no roll; entering characters do not slide.',
  performance: [
    'Only changed digits animate, each as one transform-only WAAPI animation on a short strip (≤ 10 cells).',
    'Strips collapse back to a single cell when the roll finishes; animations are cancelled on unmount or retarget.',
  ],
  preview: { height: 380 },
};
