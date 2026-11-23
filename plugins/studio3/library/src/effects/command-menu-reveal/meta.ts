import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'command-menu-reveal',
  name: 'Command Menu Reveal',
  description: 'A ⌘K command palette built on a native modal <dialog>: the backdrop, panel and result rows enter as one WAAPI sequence with a parent→child stagger, results filter with match highlighting, and the exit layers on top of whatever the entrance was doing so it can be dismissed mid-flight.',
  category: 'navigation',
  specialties: ['product'],
  technology: ['waapi', 'css'],
  interaction: ['press', 'keyboard'],
  complexity: 3,
  intensity: 'moderate',
  applications: ['app-wide command palette', 'documentation quick search', 'workspace or project switcher', 'keyboard-first action launcher'],
  dependencies: [],
  params: [
    { key: 'entrance', label: 'Panel entrance', type: 'select', default: 'drop', options: ['drop', 'rise', 'scale'] },
    { key: 'stagger', label: 'Row stagger', type: 'number', default: 28, min: 0, max: 90, step: 2, unit: 'ms' },
    { key: 'dim', label: 'Backdrop dim', type: 'number', default: 0.45, min: 0.1, max: 0.85, step: 0.05 },
    { key: 'shortcut', label: '⌘K / Ctrl K shortcut', type: 'boolean', default: true },
    { key: 'closeOnRun', label: 'Close after running', type: 'boolean', default: true },
  ],
  accessibility: [
    'Native <dialog>.showModal(): focus is trapped by the browser, the page behind is inert, Escape closes and focus returns to the trigger.',
    'Combobox + listbox pattern: the input keeps focus while aria-activedescendant tracks the active option; Arrow Up/Down wrap, Home/End jump, Enter runs.',
    'Options are grouped with labelled role="group"; the empty state and the last-run confirmation are announced through polite live regions.',
    'A visible Esc button closes the palette for pointer and touch users; clicking the backdrop does the same.',
  ],
  reducedMotion: 'The sequence is built with reducedMotion, so backdrop, panel and rows appear in their end state at once and closing is immediate.',
  performance: [
    'Entrance and exit animate opacity and transform only, through createSequence (WAAPI), and are cancelled when the dialog closes or unmounts.',
    'Rows stagger only on open; filtering swaps results without re-animating.',
    'The dialog content is not rendered while closed.',
  ],
  preview: { height: 380 },
};
