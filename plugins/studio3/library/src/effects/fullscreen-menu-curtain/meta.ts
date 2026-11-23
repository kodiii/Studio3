import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'fullscreen-menu-curtain',
  name: 'Fullscreen Menu Curtain',
  description: 'The menu button morphs into a close icon while a clip-path curtain opens from the button, the top edge or the side, revealing oversized navigation links that rise out of masks in sequence. Everything is contained in its own stage and reverses cleanly when interrupted.',
  category: 'navigation',
  specialties: ['cinematic', 'product'],
  technology: ['css'],
  interaction: ['press', 'keyboard'],
  complexity: 2,
  intensity: 'bold',
  applications: ['portfolio or agency site menu', 'mobile navigation overlay', 'campaign microsite index', 'editorial section switcher'],
  dependencies: [],
  params: [
    { key: 'links', label: 'Links (comma separated)', type: 'text', default: 'Work, Studio, Journal, Contact', maxLength: 80 },
    { key: 'origin', label: 'Curtain origin', type: 'select', default: 'button', options: ['button', 'top', 'side'] },
    { key: 'tone', label: 'Curtain tone', type: 'select', default: 'ink', options: ['ink', 'signal', 'paper'] },
    { key: 'duration', label: 'Curtain duration', type: 'number', default: 720, min: 240, max: 1400, step: 20, unit: 'ms' },
    { key: 'stagger', label: 'Link stagger', type: 'number', default: 60, min: 0, max: 160, step: 5, unit: 'ms' },
  ],
  accessibility: [
    'A real button with aria-expanded/aria-controls and a text label that switches between "Menu" and "Close".',
    'Opening moves focus to the first link; Tab cycles between the links and the close button; Escape closes and returns focus to the button.',
    'The closed navigation and, while open, the page behind it are inert, so hidden content cannot be focused or read.',
    'The current page is marked with aria-current and a text marker, not colour alone.',
  ],
  reducedMotion: 'No clip-path reveal or rising links: the menu appears and disappears with a 160 ms opacity fade and the icon swaps without rotating.',
  performance: [
    'Pure CSS transitions on clip-path, transform and opacity; state lives in one data attribute, so the reveal is interruptible mid-flight for free.',
    'No JavaScript runs per frame and nothing is measured.',
    'The curtain is positioned inside the component (not the viewport), so it never triggers page-level layout.',
  ],
  preview: { height: 520 },
};
