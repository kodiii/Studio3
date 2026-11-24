import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'animated-onboarding',
  name: 'Larder Kitchen Setup',
  specialty: 'product',
  summary: 'A five-step workspace setup for a fictional kitchen app where every answer flies onto a ticket on the pass rail: shared-element view transitions, reward-early/punish-late validation, async steps with a morphing submit button, and a first real outcome at the end.',
  highlights: [
    'One question per step with honest progress (“Step 2 of 5” in the heading itself), Back at the top, Skip for now on every optional step, and only the kitchen name required.',
    'Shared-element continuity with viewTransition(): the answer you gave (text field, role card, each chosen list, each connection) morphs into its line on the setup ticket while the step panel slides in the reading direction; Back reverses it.',
    'Validation timing from the flows playbook: no errors while first typing, errors on blur or submit with aria-invalid and aria-describedby, cleared live as soon as the value is fixed, focus to the first problem.',
    'Async steps use the morph-submit-button choreography (pill → circle with a decelerating arc → check or “!” → pill), re-implemented as a controlled button because the recipe is a sealed waitlist card.',
    'Invite rows reflow with flip() when added or removed; a demo switch makes the next request fail so the error, retry and no-data-loss paths can be seen.',
    'Resumable: the step lives in the URL hash (one history entry per step, so the browser Back button steps back) and the answers in sessionStorage.',
    'First outcome: a skeleton hands off to tomorrow’s (sample) prep list, with one brief check-mark celebration.',
  ],
  technology: ['view-transitions', 'waapi', 'css', 'svg'],
  uses: [],
  collaborates: ['motion-lab'],
  has3d: false,
  accessibility: [
    'Focus moves to each new step’s heading, which announces “Step n of 5” and the question; the heading is the form’s accessible name.',
    'Choices are native radios and checkboxes inside labelled fieldsets; Enter on a choice advances, like Enter in a text field.',
    'Errors are text with an icon and a border change, never colour alone; field errors sit in polite live regions, request errors receive focus.',
    'The busy button stays focusable with aria-busy and aria-disabled; its label names the action and, for connections, the integration.',
    'The ticket is a labelled aside with a definition list, so the summary of answers is available without the animation.',
  ],
  reducedMotion: 'Step changes become a 180 ms cross-fade (no slide or flight), the button swaps labels without morphing or shaking, the skeleton does not shimmer and the completion check is drawn statically.',
  performance: [
    'View transitions run on the compositor; only five elements are ever named, and names exist only on the two states being swapped.',
    'Every WAAPI animation and timer is tracked and cancelled on phase change or unmount; durations stay at or under the slow token so input is never blocked for long.',
    'No dependencies beyond React: the View Transitions API is feature-detected and the update simply happens instantly where it is missing.',
  ],
  dataNote: 'Larder, its integrations and the prep list are fictional sample content; requests are simulated and nothing leaves the page.',
};
