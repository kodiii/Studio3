import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'flip-grid-reorder',
  name: 'FLIP Grid Reorder',
  description: 'A filterable, sortable swatch library: tiles glide to their new cells with first-last-invert-play on the Web Animations API (the Motion Lab flip()), entering tiles scale in, leaving tiles fade out where they stood, and a new filter can interrupt a transition mid-flight without a jump.',
  category: 'layout',
  specialties: ['product', 'data'],
  technology: ['waapi', 'css'],
  interaction: ['press', 'keyboard'],
  complexity: 2,
  intensity: 'moderate',
  applications: ['shop or portfolio filters', 'asset and media library sorting', 'search results re-ranking', 'dashboard tile rearrangement'],
  dependencies: [],
  params: [
    { key: 'duration', label: 'Glide duration', type: 'number', default: 520, min: 160, max: 1200, step: 20, unit: 'ms' },
    { key: 'stagger', label: 'Stagger', type: 'number', default: 18, min: 0, max: 80, step: 2, unit: 'ms' },
    { key: 'easing', label: 'Easing token', type: 'select', default: 'emphasized', options: ['emphasized', 'standard', 'inOut', 'overshoot'] },
    { key: 'entrance', label: 'Entering tiles', type: 'select', default: 'scale', options: ['scale', 'rise', 'fade'] },
    { key: 'tileSize', label: 'Tile size', type: 'number', default: 128, min: 88, max: 220, step: 4, unit: 'px' },
    { key: 'filterMode', label: 'Filter mode', type: 'select', default: 'single', options: ['single', 'multiple'] },
  ],
  accessibility: [
    'Filters and sort orders are native buttons with aria-pressed inside labelled groups; every change is a click or Enter/Space away.',
    'A polite status line announces how many of the twelve materials are shown, which filter is on and how they are sorted.',
    'Tiles are a plain list with real text names; leaving tiles are aria-hidden while they fade out, so the list never reads stale items.',
    'Category and tone are written as text on every tile, never implied by colour or position alone.',
  ],
  reducedMotion: 'Tiles jump straight to their new cells with no glide; leaving tiles are removed at once and entering tiles fade in over 160 ms.',
  performance: [
    'One measure pass before and one after a synchronous React commit (flushSync); everything that moves is a composited transform or opacity animation.',
    'An interrupting change measures tiles where they visually are (mid-animation), cancels their animations and glides on from there.',
    'Swatches are pure CSS gradients: no images, canvases or filters. Every animation is cancelled on unmount.',
  ],
  preview: { height: 600 },
};
