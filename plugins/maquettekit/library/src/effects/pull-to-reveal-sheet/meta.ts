import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'pull-to-reveal-sheet',
  name: 'Pull-to-Reveal Sheet',
  description: 'A transit-stop bottom sheet over a drawn map: pull its header between peek, half and full snap points, push past the ends to feel it rubber-band, and fling it to skip a stop. Release velocity picks the snap, a token spring carries that velocity, and the map dims in proportion to how far the sheet is open.',
  category: 'gestures',
  specialties: ['product'],
  technology: ['motion', 'css', 'svg'],
  interaction: ['drag', 'press', 'keyboard'],
  complexity: 3,
  intensity: 'moderate',
  applications: ['map or location details', 'mobile filters and sort panels', 'player or queue drawer', 'checkout summary on small screens'],
  dependencies: [{ name: 'motion', version: '^14.14.0' }],
  params: [
    { key: 'snaps', label: 'Snap points', type: 'select', default: 'peek-half-full', options: ['peek-half-full', 'peek-full'] },
    { key: 'spring', label: 'Spring token', type: 'select', default: 'settle', options: ['settle', 'release', 'glide', 'press'] },
    { key: 'elastic', label: 'Rubber band', type: 'number', default: 0.18, min: 0, max: 0.5, step: 0.02 },
    { key: 'flick', label: 'Flick velocity', type: 'number', default: 650, min: 200, max: 1600, step: 50, unit: 'px/s' },
    { key: 'peek', label: 'Peek height', type: 'number', default: 112, min: 88, max: 168, step: 4, unit: 'px' },
    { key: 'dim', label: 'Map dim at full', type: 'number', default: 45, min: 0, max: 70, step: 5, unit: '%' },
  ],
  accessibility: [
    'The sheet header is a button with aria-expanded and aria-controls: Enter/Space toggles peek ↔ open, Up/Down step between snap points, Home/End jump to full or peek.',
    'Visible Expand and Collapse step buttons do everything a drag does with a single press (WCAG 2.5.7); they stay focusable at the limits (aria-disabled) so focus is never dropped.',
    'Escape collapses the sheet from anywhere inside it and returns focus to the header; at peek the hidden content is inert, and when open the list scrolls within the visible part, so nothing focusable is ever off-screen.',
    'A polite status line reports the sheet position after drags, presses and keys; the map is decorative (aria-hidden) and every departure is written as text.',
  ],
  reducedMotion: 'No spring travel: snap points, buttons and keys jump straight to the target and the scrim follows instantly. Dragging still tracks the pointer because that movement is under the user’s control.',
  performance: [
    'The sheet moves by one motion value (translateY); the scrim opacity is derived from it, so dragging causes no React renders.',
    'Snap offsets are recomputed only when the frame is resized (ResizeObserver), and the list height changes only when a snap settles.',
    'The map is a single static SVG; no layout properties are animated.',
  ],
  preview: { height: 680 },
};
