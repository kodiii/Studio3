import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'horizontal-scroll-gallery',
  name: 'Horizontal Scroll Gallery',
  description: 'Vertical scrolling drives a pinned, horizontal track of plates on a scrubbed GSAP timeline with smoothing and per-card snap. Tabbing through cards scrolls the container to the matching position, so keyboard focus is never off-screen.',
  category: 'scroll',
  specialties: ['cinematic', 'product'],
  technology: ['gsap', 'css', 'svg'],
  interaction: ['scroll', 'keyboard', 'press'],
  complexity: 3,
  intensity: 'bold',
  applications: ['portfolio or case-study strip', 'product range showcase', 'timeline of milestones', 'editorial image sequence'],
  dependencies: [
    { name: 'gsap', version: '^3.15.1' },
    { name: '@gsap/react', version: '^2.1.2' },
  ],
  params: [
    { key: 'cards', label: 'Cards', type: 'number', default: 6, min: 4, max: 8, step: 1 },
    { key: 'scrub', label: 'Scrub smoothing', type: 'number', default: 0.6, min: 0, max: 1.5, step: 0.1, unit: 's' },
    { key: 'snap', label: 'Snap to cards', type: 'boolean', default: true },
    { key: 'distance', label: 'Scroll length', type: 'number', default: 1, min: 0.6, max: 2, step: 0.1, unit: '×' },
  ],
  accessibility: [
    'Cards are toggle buttons in a list; focusing a card that is off-screen scrolls the container to the position where that card is visible (the pinned frame uses overflow: clip, so the browser cannot scroll it sideways behind the timeline).',
    'The scroll container is a focusable, labelled region: arrow keys, Space and Page keys drive the horizontal travel.',
    'A text counter ("03 / 06") reports position; pinned state of a card is exposed with aria-pressed and a text mark, not colour alone.',
  ],
  reducedMotion: 'No pinning or scrub. The track becomes a native horizontal overflow list with scroll-snap, scrolled directly by touch, trackpad, or keyboard focus.',
  performance: [
    'Pinning is CSS position: sticky; ScrollTrigger scrubs a single timeline that moves one transform on the track.',
    'Track length and snap points are measured once per layout; a ResizeObserver rebuilds the timeline when the container width changes.',
    'useGSAP with revertOnUpdate reverts tweens, inline styles and the ScrollTrigger on unmount and on every param change.',
  ],
  preview: { height: 560, scroll: true },
};
