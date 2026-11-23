import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'scramble-decode',
  name: 'Scramble Decode',
  description: 'Text resolves from churning glyphs to the final string in a left-to-right sweep. Frames come from a seeded hash, so the same seed always produces the same animation, and every character sits in a fixed 1ch cell so nothing shifts.',
  category: 'typography',
  specialties: ['cinematic', 'product', 'data'],
  technology: ['css'],
  interaction: ['time', 'hover', 'keyboard'],
  complexity: 2,
  intensity: 'moderate',
  applications: ['hero kicker or status line', 'data value that just refreshed', 'section label entering the viewport', 'terminal-style product copy'],
  dependencies: [],
  params: [
    { key: 'text', label: 'Text', type: 'text', default: 'Signal acquired. Decoding the brief.', maxLength: 90 },
    { key: 'duration', label: 'Resolve time', type: 'number', default: 1400, min: 300, max: 4000, step: 50, unit: 'ms' },
    { key: 'churn', label: 'Glyph swap interval', type: 'number', default: 50, min: 16, max: 200, step: 2, unit: 'ms' },
    { key: 'glyphs', label: 'Glyph set', type: 'select', default: 'alphanumeric', options: ['alphanumeric', 'symbols', 'binary', 'blocks'] },
    { key: 'seed', label: 'Seed', type: 'number', default: 7, min: 1, max: 999, step: 1 },
  ],
  accessibility: [
    'The real sentence is rendered once as visually hidden text; the animated cells are aria-hidden, so assistive tech never hears the scramble.',
    'Replay is a real button; hovering the text or keyboard-focusing the button also replays, so no interaction is pointer-only.',
    'Progress is not conveyed by colour alone: a resolved counter accompanies the progress rule.',
  ],
  reducedMotion: 'The final string is shown immediately; replay only runs a 160 ms opacity fade and hover does nothing.',
  performance: [
    'Cells are updated through textContent/data attributes only when their glyph changes; React does not re-render per frame.',
    'The rAF loop (useRafLoop) idles when no decode is running and pauses offscreen or in a hidden tab.',
    'Fixed 1ch cells and nowrap words mean zero layout shift during the churn.',
  ],
  preview: { height: 380 },
};
