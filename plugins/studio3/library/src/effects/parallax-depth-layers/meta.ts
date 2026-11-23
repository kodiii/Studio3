import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'parallax-depth-layers',
  name: 'Parallax Depth Layers',
  description: 'A paper-cut landscape whose layers travel at depth-scaled rates as it passes through the scroll container. One scroll-progress custom property drives every layer in CSS — no animation library, no per-layer JavaScript.',
  category: 'scroll',
  specialties: ['cinematic', 'product'],
  technology: ['css', 'svg'],
  interaction: ['scroll'],
  complexity: 1,
  intensity: 'moderate',
  applications: ['editorial hero image', 'section divider illustration', 'landing-page scene between text blocks', 'travel or outdoor brand storytelling'],
  dependencies: [],
  params: [
    { key: 'strength', label: 'Strength', type: 'number', default: 56, min: 0, max: 120, step: 4, unit: 'px' },
    { key: 'zoom', label: 'Depth zoom', type: 'number', default: 0.06, min: 0, max: 0.2, step: 0.01 },
    { key: 'layers', label: 'Layers', type: 'number', default: 5, min: 3, max: 5, step: 1 },
    { key: 'horizon', label: 'Show horizon rules', type: 'boolean', default: true },
  ],
  accessibility: [
    'The scene is a figure with a text caption; every moving layer is aria-hidden decoration.',
    'The scroll container is a focusable, labelled region so it can be scrolled from the keyboard.',
    'Motion is strictly scroll-linked: nothing moves unless the reader scrolls, and layer travel is capped by the Strength param.',
  ],
  reducedMotion: 'The scroll listener is not attached and the progress property stays at 0, so the scene renders as a static, centred composition.',
  performance: [
    'One passive, rAF-batched scroll listener (useScrollProgress) writes a single custom property; the browser resolves each layer transform in CSS.',
    'Layers animate transform only and are promoted with will-change; no layout or paint work per frame beyond compositing.',
    'Layers are oversized inside an overflow: clip frame, so travel never reveals an edge and never changes layout.',
  ],
  preview: { height: 560, scroll: true },
};
