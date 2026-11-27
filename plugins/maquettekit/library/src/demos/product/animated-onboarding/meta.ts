import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'animated-onboarding',
  name: 'Larder Kitchen Setup',
  specialty: 'product',
  summary: 'A five-step workspace setup for a fictional kitchen app where every answer flies onto a ticket hanging on the pass rail: step changes choreographed on the real elements (no snapshots), reward-early/punish-late validation, a ranked list you can drag, async steps with a morphing submit button, and a first real outcome at the end.',
  highlights: [
    'Signature move, built on real elements instead of View Transitions: the answer’s text detaches from its field (a small lift as anticipation), arcs over to its line on the ticket (x and y on two different token springs), changes from the question’s face to the ticket’s mono mid-flight and hands over to the real ticket line at the same pixel. Nothing is ever a bitmap, and the old and new step are never on screen together.',
    'Overlap and follow-through: the leaving step’s parts exit fast and staggered, the next step’s parts arrive slower and staggered while the answer is still in the air, the landing stamps the line with a pop of ink and the ticket swings on its clip.',
    'The ticket is alive: it hangs from a clip and swings on a spring when answers land, when the page scrolls (in proportion to the scroll speed) and when a pointer brushes across it.',
    'Hands on: “What should Larder build first?” is pick-and-rank. Chosen lists rise to the top with FLIP; drag a grip and the card follows, its neighbours make room, and on release it springs into its slot keeping the throw’s velocity. The same grip moves with the arrow keys, and the ticket prints the ranking.',
    'One question per step with honest progress (“Step 2 of 5” in the heading itself), Back at the top, Skip for now on every optional step, and only the kitchen name required. Validation: no errors while first typing, errors on blur or submit, cleared live once fixed, focus to the first problem.',
    'Async steps use the morph-submit-button choreography (pill → circle with a decelerating arc → check or “!” → pill) as a controlled button; every control has depth: lifts on hover with a two-layer shadow, compresses on press, springs back.',
    'Resumable: the step lives in the URL hash (one history entry per step, so the browser Back button steps back) and the answers in sessionStorage. First outcome: a skeleton hands off to tomorrow’s (sample) prep list row by row, with one brief check-mark celebration.',
  ],
  technology: ['waapi', 'css', 'svg'],
  uses: [],
  adapts: ['morph-submit-button', 'drag-reorder-list', 'press-depth-button', 'skeleton-shimmer-handoff'],
  collaborates: ['motion-lab'],
  has3d: false,
  accessibility: [
    'Focus moves to each new step’s heading at the moment the step changes, which announces “Step n of 5” and the question; the heading is the form’s accessible name. The new step is interactive as soon as it is on screen.',
    'Choices are native radios and checkboxes inside labelled fieldsets; Enter on a choice advances, like Enter in a text field.',
    'Ranking has a keyboard path: each chosen list has a grip button named with its priority (“Prep lists: priority 1 of 3”); Arrow Up/Down, Home and End move it, and each move is announced in a polite status line.',
    'Errors are text with an icon and a border change, never colour alone; field errors sit in polite live regions, request errors receive focus.',
    'The busy button stays focusable with aria-busy and aria-disabled; its label names the action and, for connections, the integration.',
    'The ticket is a labelled aside with a definition list, so the summary of answers is available without the animation; the flying copies are aria-hidden.',
  ],
  reducedMotion: 'Step changes become a 180 ms fade of the new step (no slide, flight, stamp or swing), controls do not lift or squash, the button swaps labels without morphing or shaking, ranking moves apply instantly (dragging still works under the pointer), the skeleton does not shimmer and the completion check is drawn statically.',
  performance: [
    'No View Transitions and no snapshots: exits, entrances and flights are WAAPI transform/opacity animations on real elements; the flying answer is one absolutely positioned text node per answer, removed on landing.',
    'Every animation, timer and flyer of a step change is tracked and cancelled when another change interrupts it or on unmount; a double press while a step is leaving is ignored.',
    'The ticket’s swing is one spring on a useRafLoop that sleeps at rest; the drag uses pointer capture and transforms only, and the drop’s spring runs only until it settles.',
  ],
  dataNote: 'Larder, its integrations and the prep list are fictional sample content; requests are simulated and nothing leaves the page.',
};
