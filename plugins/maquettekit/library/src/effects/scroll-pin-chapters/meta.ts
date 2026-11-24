import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'scroll-pin-chapters',
  name: 'Scroll Pin Chapters',
  description: 'A pinned panel whose chapters — numeral, title, line illustration — hand over to each other on a scrubbed GSAP timeline as the container scrolls. Progress dots are real buttons that scroll to each chapter.',
  category: 'scroll',
  specialties: ['cinematic', 'product'],
  technology: ['gsap', 'css', 'svg'],
  interaction: ['scroll', 'press', 'keyboard'],
  complexity: 3,
  intensity: 'bold',
  applications: ['process or how-it-works section', 'product feature walkthrough', 'editorial long-read chapter opener', 'case-study timeline'],
  dependencies: [
    { name: 'gsap', version: '^3.15.1' },
    { name: '@gsap/react', version: '^2.1.2' },
  ],
  params: [
    { key: 'chapters', label: 'Chapters', type: 'number', default: 5, min: 3, max: 5, step: 1 },
    { key: 'transition', label: 'Transition', type: 'select', default: 'rise', options: ['rise', 'wipe'] },
    { key: 'scrub', label: 'Scrub smoothing', type: 'number', default: 0.5, min: 0, max: 1.5, step: 0.1, unit: 's' },
    { key: 'snap', label: 'Snap to chapters', type: 'boolean', default: true },
  ],
  accessibility: [
    'The scroll container is a focusable, labelled region, so arrow keys, Page Up/Down and Space scroll it without a pointer.',
    'Every chapter stays in the DOM as a section with its own heading; only opacity/transform/clip-path are animated, so assistive tech can read all chapters in order.',
    'Progress dots are buttons named "Go to chapter N: title"; the active one carries aria-current="step" and is also distinguished by shape, not colour alone.',
    'Illustrations are decorative and aria-hidden; nothing is conveyed by motion alone.',
  ],
  reducedMotion: 'No pinning and no scrub: chapters render as ordinary stacked sections in the scroll container, and the dots jump to a section without smooth scrolling.',
  performance: [
    'Pinning uses CSS position: sticky (compositor-driven, no jitter in nested scrollers); ScrollTrigger only scrubs one timeline.',
    'One ScrollTrigger on the timeline, never on child tweens; transforms, opacity and clip-path only.',
    'useGSAP scope + revertOnUpdate reverts tweens, inline styles and the trigger on unmount or param change; the ResizeObserver that refreshes the trigger is disconnected with it.',
    'React state changes only when the active chapter index changes, not per scroll frame.',
  ],
  preview: { height: 560, scroll: true },
};
