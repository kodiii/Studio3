import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'expanding-card-detail',
  name: 'Expanding Card Detail',
  description: 'A programme of poster cards where the chosen card grows into a detail panel: card surface, poster and headline are shared elements (Motion layoutId) that travel on a token spring, the details fade in behind them, and focus moves into the panel while the grid goes inert.',
  category: 'cards',
  specialties: ['product', 'cinematic'],
  technology: ['motion', 'css', 'svg'],
  interaction: ['press', 'keyboard'],
  complexity: 3,
  intensity: 'moderate',
  applications: ['event or course listings', 'product cards opening a quick view', 'portfolio case-study previews', 'media library item details'],
  dependencies: [{ name: 'motion', version: '^14.14.0' }],
  params: [
    { key: 'spring', label: 'Spring token', type: 'select', default: 'glide', options: ['glide', 'settle', 'release', 'press'] },
    { key: 'panel', label: 'Panel size', type: 'select', default: 'fill', options: ['fill', 'centered'] },
    { key: 'scrim', label: 'Scrim strength', type: 'number', default: 45, min: 0, max: 80, step: 5, unit: '%' },
    { key: 'contentDelay', label: 'Details delay', type: 'number', default: 260, min: 0, max: 600, step: 20, unit: 'ms' },
    { key: 'columns', label: 'Max columns', type: 'number', default: 3, min: 2, max: 4, step: 1 },
  ],
  accessibility: [
    'Each card title is a real button (stretched over the card) with aria-haspopup="dialog", so the whole card is clickable but only one tab stop.',
    'The panel is role="dialog" labelled by its heading; focus moves to its Close button, and Escape or Close return focus to the card that opened it.',
    'While the panel is open the grid is inert (out of the tab order and the accessibility tree); an exiting panel is inert too, so Tab never lands in a closing view.',
    'Posters are decorative SVG (aria-hidden); the event type, date and place are always real text.',
  ],
  reducedMotion: 'No shared-element travel: the panel and scrim fade in and out over 160 ms and the cards stay where they are.',
  performance: [
    'Motion animates the shared elements with transforms (FLIP-style projection); nothing animates width, height or top/left.',
    'The poster artwork is a square emblem with its own layoutId, so it scales uniformly while the colour field around it morphs from card to panel shape; titles move by position only, so text never stretches.',
    'Only the opened card and its panel are animated; the panel unmounts after its exit animation.',
  ],
  preview: { height: 640 },
};
