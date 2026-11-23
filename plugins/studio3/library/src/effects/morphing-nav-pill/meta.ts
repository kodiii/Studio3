import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'morphing-nav-pill',
  name: 'Morphing Nav Pill',
  description: 'A tab bar whose active indicator is one shared element: it glides between tabs and stretches to each label width on a token spring (Motion layoutId), while a faint ghost previews the hovered or focused tab and the panels cross-fade in a fixed-height stack.',
  category: 'navigation',
  specialties: ['product'],
  technology: ['motion', 'css'],
  interaction: ['press', 'hover', 'keyboard'],
  complexity: 2,
  intensity: 'subtle',
  applications: ['settings or dashboard section tabs', 'pricing period toggle', 'segmented view switcher', 'in-page secondary navigation'],
  dependencies: [{ name: 'motion', version: '^14.14.0' }],
  params: [
    { key: 'tabs', label: 'Tabs (comma separated)', type: 'text', default: 'Overview, Activity, Members, Billing', maxLength: 80 },
    { key: 'shape', label: 'Indicator shape', type: 'select', default: 'pill', options: ['pill', 'block', 'underline'] },
    { key: 'spring', label: 'Spring token', type: 'select', default: 'settle', options: ['press', 'settle', 'release', 'glide', 'pop'] },
    { key: 'activation', label: 'Keyboard activation', type: 'select', default: 'automatic', options: ['automatic', 'manual'] },
    { key: 'ghost', label: 'Hover/focus ghost', type: 'boolean', default: true },
  ],
  accessibility: [
    'WAI-ARIA tabs pattern: role="tablist"/"tab"/"tabpanel", aria-selected, aria-controls and aria-labelledby are wired with useId.',
    'Roving tabindex: Arrow Left/Right wrap, Home/End jump; activation follows focus or waits for Enter/Space depending on the activation param.',
    'The indicator and ghost are decorative (aria-hidden); the selected tab is also marked by aria-selected and label weight/colour, not by position alone.',
    'Hidden panels are inert, so their content is out of the tab order and the accessibility tree.',
  ],
  reducedMotion: 'The indicator jumps to the selected tab with no layout animation, the ghost is removed and panels swap with a 160 ms opacity fade.',
  performance: [
    'Motion animates the shared indicator with transforms (FLIP); tabs themselves never resize.',
    'All panels share one grid cell, so the card height is the tallest panel and switching causes no layout shift.',
    'Only two small elements are ever animated; no listeners outside the component.',
  ],
  preview: { height: 400 },
};
