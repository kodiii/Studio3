import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'dot-grid-pointer-field',
  name: 'Dot Grid Pointer Field',
  description: 'A canvas grid of dots that leans away from the pointer, swells and warms to the accent colour, then springs back; a click sends a ripple ring through the field. The loop runs only while something is moving and stops the moment every spring has settled.',
  category: 'backgrounds',
  specialties: ['product', 'social', 'cinematic'],
  technology: ['canvas2d'],
  interaction: ['pointer', 'press', 'keyboard'],
  complexity: 2,
  intensity: 'moderate',
  applications: ['interactive hero backdrop', 'empty state or 404 playground', 'event or launch page texture', 'section divider with a tactile response'],
  dependencies: [],
  params: [
    { key: 'spacing', label: 'Grid spacing', type: 'number', default: 22, min: 12, max: 40, step: 1, unit: 'px' },
    { key: 'dotSize', label: 'Dot radius', type: 'number', default: 1.6, min: 0.8, max: 4, step: 0.1, unit: 'px' },
    { key: 'radius', label: 'Influence radius', type: 'number', default: 150, min: 60, max: 280, step: 10, unit: 'px' },
    { key: 'strength', label: 'Push strength', type: 'number', default: 18, min: 0, max: 44, step: 1, unit: 'px' },
    { key: 'ripple', label: 'Click ripple', type: 'boolean', default: true },
  ],
  accessibility: [
    'Keyboard path for every pointer action: focus the field (role="application", labelled and described), arrow keys move the influence point (Shift for bigger steps), Enter or Space sends a ripple, Esc clears it.',
    'A visible "Send ripple" button offers the same burst without aiming, and the instruction line is always on screen.',
    'Touch: vertical swipes keep scrolling the page (touch-action: pan-y); taps send ripples.',
    'Purely decorative output — the canvas itself is aria-hidden and nothing is conveyed by colour alone.',
  ],
  reducedMotion: 'The grid is drawn once as a static pattern; pointer, keyboard and ripple input do nothing and the field is no longer focusable (it becomes a labelled image).',
  performance: [
    'The rAF loop (useRafLoop) runs only while springs or ripples are moving: it stops at rest, pauses offscreen and in hidden tabs, and restarts on the next pointer or key event.',
    'Canvas backing store follows the box via ResizeObserver with devicePixelRatio capped at 2.',
    'Dots are batched into five tint buckets: at most five fill() calls per frame, no per-dot style changes.',
    'Springs use the shared `release` token, integrated in fixed 1/120 s substeps (frame-rate independent).',
  ],
  preview: { height: 480 },
};
