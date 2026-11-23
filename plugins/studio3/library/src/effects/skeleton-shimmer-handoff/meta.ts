import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'skeleton-shimmer-handoff',
  name: 'Skeleton Shimmer Handoff',
  description: 'Skeleton rows that hand off to real content with a staggered cross-fade and zero layout shift. One shimmer layer, clipped to the union of every bone with a measured clip-path, sweeps the whole list with a single pseudo-element animation; skeleton and content share each row’s grid cell and line-height-locked geometry.',
  category: 'loading',
  specialties: ['product', 'data'],
  technology: ['css', 'waapi'],
  interaction: ['time', 'press', 'keyboard'],
  complexity: 2,
  intensity: 'subtle',
  applications: ['feed or reading list first load', 'search results while fetching', 'dashboard cards waiting on data', 'inbox or notification lists'],
  dependencies: [],
  params: [
    { key: 'latency', label: 'Simulated latency', type: 'number', default: 1400, min: 300, max: 4000, step: 100, unit: 'ms' },
    { key: 'stagger', label: 'Handoff stagger', type: 'number', default: 80, min: 0, max: 200, step: 10, unit: 'ms' },
    { key: 'rows', label: 'Rows', type: 'number', default: 3, min: 2, max: 5, step: 1 },
    { key: 'shimmer', label: 'Shimmer', type: 'select', default: 'sweep', options: ['sweep', 'pulse', 'none'] },
    { key: 'speed', label: 'Shimmer cycle', type: 'number', default: 1700, min: 800, max: 3200, step: 100, unit: 'ms' },
  ],
  accessibility: [
    'The list region is aria-busy while loading, and a polite live region says "Loading reading list…" and then how many articles arrived.',
    'Skeleton bones and the shimmer layer are aria-hidden; real content only enters the accessibility tree once it exists.',
    'Reload is a real button that stays focusable while busy (aria-disabled), so keyboard focus is never lost.',
    'Titles reserve two lines and metadata one, so zooming or narrow containers never push rows around when content lands.',
  ],
  reducedMotion: 'Bones stay static (no sweep or pulse), and the handoff becomes a single 160 ms opacity cross-fade with no stagger or rise.',
  performance: [
    'Exactly one infinite animation while loading: a transform (sweep) or opacity (pulse) keyframe on one pseudo-element, removed as soon as content is ready.',
    'The clip-path is rebuilt only on resize (ResizeObserver, rAF-batched), never per frame.',
    'Handoff is one createSequence timeline (transform/opacity) that is cancelled on unmount and on every reload.',
  ],
  preview: { height: 480 },
};
