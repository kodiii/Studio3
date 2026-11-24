import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'scroll-progress-rail',
  name: 'Scroll Progress Rail',
  description: 'A reading-progress rail whose segments fill as each section crosses the reading line and whose marker names the current section. Driven entirely by CSS scroll-driven animations (scroll() and named view() timelines), with a rAF-batched JavaScript fallback where animation-timeline is unsupported.',
  category: 'scroll',
  specialties: ['product', 'data'],
  technology: ['css'],
  interaction: ['scroll', 'press', 'keyboard'],
  complexity: 2,
  intensity: 'subtle',
  applications: ['long-form article', 'documentation page table of contents', 'changelog or policy page', 'multi-section onboarding guide'],
  dependencies: [],
  params: [
    { key: 'sections', label: 'Sections', type: 'number', default: 5, min: 3, max: 6, step: 1 },
    { key: 'rail', label: 'Rail position', type: 'select', default: 'side', options: ['side', 'top'] },
    { key: 'labels', label: 'Section names', type: 'boolean', default: true },
    { key: 'forceFallback', label: 'Force JS fallback', type: 'boolean', default: false },
  ],
  accessibility: [
    'The rail is a nav landmark; each marker is a button named after its section that scrolls it to the reading line and moves focus to the section heading.',
    'The current marker carries aria-current="location" (set by an IntersectionObserver in both drivers, since CSS cannot set ARIA state).',
    'Current and completed states differ by fill length and weight as well as colour; the percentage readout is decorative and aria-hidden.',
    'The scroll container is a focusable, labelled region for keyboard scrolling.',
  ],
  reducedMotion: 'The rail is scroll-linked feedback rather than autonomous motion, so it keeps tracking position; marker label transitions are removed and marker clicks jump instead of smooth-scrolling.',
  performance: [
    'CSS driver: scroll() and view() timelines run on the compositor with zero scroll listeners; timeline-scope lets markers outside the sections subscribe to them.',
    'Fallback driver: one passive, rAF-batched listener (useScrollProgress) reads all section rects first, then writes custom properties — no interleaved layout.',
    'Support: animation-timeline + timeline-scope in Chromium 116+ and Safari 26+; other engines get the fallback automatically via CSS.supports().',
  ],
  preview: { height: 560, scroll: true },
};
