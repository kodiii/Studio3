import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'spotlight-border-card',
  name: 'Spotlight Border Card',
  description: 'A grid of selectable module cards lit by a single moving spotlight: one pointer listener on the grid hands each card its local pointer position, and pure CSS paints a radial light into a 1px masked border ring (and, optionally, a faint glow on the surface), so neighbouring cards catch the edge of the same light. Keyboard focus lights the focused card on its own.',
  category: 'cards',
  specialties: ['product'],
  technology: ['css'],
  interaction: ['pointer', 'hover', 'press', 'keyboard'],
  complexity: 1,
  intensity: 'subtle',
  applications: ['feature or integration grids', 'plan and add-on pickers', 'dashboard tiles', 'landing-page capability sections'],
  dependencies: [],
  params: [
    { key: 'radius', label: 'Spotlight radius', type: 'number', default: 260, min: 120, max: 480, step: 10, unit: 'px' },
    { key: 'intensity', label: 'Intensity', type: 'number', default: 75, min: 10, max: 100, step: 5, unit: '%' },
    { key: 'surface', label: 'Light the surface too', type: 'boolean', default: true },
    { key: 'color', label: 'Light colour', type: 'select', default: 'signal', options: ['signal', 'ink', 'accent'] },
    { key: 'follow', label: 'Follow', type: 'select', default: 'smooth', options: ['smooth', 'instant'] },
  ],
  accessibility: [
    'Each card is a toggle: a real button (stretched over the card) with aria-pressed, described by the card text; a polite status line counts the selection.',
    'Keyboard focus lights the focused card fully and draws a 2px focus outline, independent of the pointer.',
    'Selection is shown with a text label ("Added") and a check, not by the light or colour alone; the light layers are decorative pseudo-elements.',
  ],
  reducedMotion: 'The light no longer travels with the pointer: hovering a card shows a static lit border instead, and focus still lights the focused card.',
  performance: [
    'One pointermove listener on the grid, batched to one rAF: all card rects are read first, then each card gets two custom properties, so there is no layout thrash.',
    'The light is two gradient pseudo-elements per card; the border ring is a mask (content-box exclude), so nothing is re-laid out.',
    'Smooth follow uses registered @property lengths with a CSS transition rather than a JavaScript loop; touch pointers are ignored.',
  ],
  preview: { height: 560 },
};
