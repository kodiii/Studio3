import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'accordion-height-auto',
  name: 'Accordion Height Auto',
  description: 'A disclosure group that opens to its natural content height and closes again smoothly with pure CSS: each panel animates grid-template-rows from 0fr to 1fr, so there is no measuring, no fixed max-height and no JavaScript animation. The chevron turns (or the plus folds into a minus) on the same token easing, and single- or multiple-open behaviour is a param.',
  category: 'layout',
  specialties: ['product'],
  technology: ['css'],
  interaction: ['press', 'keyboard'],
  complexity: 1,
  intensity: 'subtle',
  applications: ['FAQ and help pages', 'settings groups', 'pricing plan details', 'filter sidebars'],
  dependencies: [],
  params: [
    { key: 'mode', label: 'Open panels', type: 'select', default: 'single', options: ['single', 'multiple'] },
    { key: 'duration', label: 'Duration', type: 'number', default: 360, min: 120, max: 900, step: 20, unit: 'ms' },
    { key: 'easing', label: 'Easing token', type: 'select', default: 'emphasized', options: ['emphasized', 'standard', 'inOut', 'enter'] },
    { key: 'icon', label: 'Icon', type: 'select', default: 'chevron', options: ['chevron', 'plus'] },
    { key: 'defaultOpen', label: 'Open at start (0 = none)', type: 'number', default: 1, min: 0, max: 5, step: 1 },
    { key: 'look', label: 'Look', type: 'select', default: 'hairline', options: ['hairline', 'cards'] },
  ],
  accessibility: [
    'APG accordion pattern: each header is a button inside an h4 with aria-expanded and aria-controls; each panel is a labelled region.',
    'Enter or Space toggles; Up/Down move between headers (wrapping) and Home/End jump to the first and last.',
    'A closed panel switches to visibility: hidden once its collapse has finished, so collapsed content is out of the tab order and the accessibility tree without cutting the animation short.',
    'State is shown by the icon and by aria-expanded, never by colour alone.',
  ],
  reducedMotion: 'Panels open and close at once with no height animation and the icon flips without turning; newly opened content fades in over 160 ms.',
  performance: [
    'Support: the 0fr → 1fr grid-track transition animates to the content height in every evergreen browser (Chrome/Edge 107+, Safari 16+, Firefox 66+), closing included. No dependency on interpolate-size or ::details-content, which are newer and not yet everywhere.',
    'It is a layout animation, but confined to one short panel at a time; the content inside only animates opacity and translate.',
    'No JavaScript runs during the animation: React only flips data attributes and aria-expanded.',
  ],
  preview: { height: 560 },
};
