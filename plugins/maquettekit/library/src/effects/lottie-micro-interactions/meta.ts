import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'lottie-micro-interactions',
  name: 'Lottie Micro-interactions',
  description: 'Six hand-animated icons authored as original Lottie data in typed code: menu crosses to close on a spring, play splits into pause, an ink drop falls into the bookmark, the bell rings with a lagging clapper, the heart bursts, the sun folds into a moon. Hover previews each wind-up, a click commits from that exact frame and can reverse at any frame, and colours come from theme tokens through CSS.',
  category: 'vector-animation',
  specialties: ['product', 'social'],
  technology: ['lottie', 'svg', 'css'],
  interaction: ['hover', 'press', 'keyboard', 'drag'],
  complexity: 3,
  intensity: 'moderate',
  applications: [
    'app bar menu and theme toggles',
    'media player play / pause',
    'like and save actions in a feed',
    'notification opt-in bell',
    'replacing static icon sets with animated ones that share one data format with After Effects exports',
    'icons that are also cursor magnets or View Transition origins: the ref and data-* / aria-* props reach the button itself',
  ],
  dependencies: [{ name: 'lottie-web', version: '^5.13.0' }],
  params: [
    { key: 'size', label: 'Icon size', type: 'number', default: 28, min: 20, max: 40, step: 2, unit: 'px' },
    { key: 'weight', label: 'Stroke weight', type: 'number', default: 2, min: 1.5, max: 2.5, step: 0.25, unit: 'u' },
    { key: 'tint', label: 'Colour', type: 'select', default: 'duotone', options: ['duotone', 'accent', 'ink'] },
    { key: 'speed', label: 'Speed', type: 'number', default: 1, min: 0.5, max: 2, step: 0.1, unit: '×' },
    { key: 'hover', label: 'Hover / focus preview', type: 'boolean', default: true },
  ],
  accessibility: [
    'Every icon is a real button with a constant accessible name: toggles expose aria-pressed (Play, Like, Save, New-episode alerts, Night mode); the queue button is a disclosure with aria-expanded and aria-controls, and its panel leaves the accessibility tree when closed.',
    'State never relies on colour or motion alone: the shapes differ (lines vs cross, outline vs filled, slashed vs ringing bell, sun vs moon), the like count and "Playing / Paused" are real text, and the animated drawing is aria-hidden.',
    'Keyboard: Enter and Space toggle; focus-visible previews the same wind-up as hover; each timeline lane is a labelled native slider (arrow keys step one frame, leaving the lane plays the icon home).',
    'Targets are at least 44 px; focus rings use --mk-focus; colours map to tokens, and forced-colors mode redraws the icons in system colours.',
    'aria-* props (aria-describedby, aria-keyshortcuts …) pass through to the button, while the state it owns (aria-pressed or aria-expanded, aria-controls, its name) always wins, so a pass-through can never desynchronise it.',
  ],
  reducedMotion: 'Hover and focus previews are off and nothing travels: a state change jumps the Lottie to the final frame of its segment (goToAndStop) under a 160 ms cross-fade, the queue opens without sliding and the cover swaps sun for moon with a fade. Scrubbing still works because it is direct manipulation.',
  performance: [
    'lottie-web’s light SVG player is imported lazily, once, and shared; each icon owns one instance that is destroyed on unmount (StrictMode-safe).',
    'lottie-web only ticks while an instance plays, so an idle toolbar runs no animation frame; the timeline playheads are written straight to the DOM from enterFrame events, with no React render per frame.',
    'Until the player has painted, and wherever it cannot run, each icon shows a static SVG of its rest frame rendered from the same data, so the swap is invisible and nothing is lost if lottie fails.',
    'Colours are CSS on the rendered SVG, so theme or palette changes restyle every icon with no data rebuild; only the stroke-weight param rebuilds the data, and each icon keeps its frame across the rebuild.',
  ],
  preview: { height: 560 },
};
