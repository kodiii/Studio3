import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'interactive-poll',
  name: 'Interactive Poll',
  specialty: 'social',
  summary: 'A community radio station’s listener polls under a tuning dial you can really turn: a single-choice poll whose rows become result bars, a multiple-choice poll with honest percentages and clearly labelled simulated live votes you can pause, a no-timer quiz with explanations, and a ranking poll whose ballot is a drag-to-reorder running order.',
  highlights: [
    'The FM dial is a real tuner: drag or click the band and the needle follows with a pull into each 0.2 MHz detent; throw it and a release spring carries the velocity into the nearest detent, with a magnetic catch on 98.2. A signal meter (the same lit segments as the results) and a readout answer continuously; off-station it says so and offers “Back to 98.2”. Keyboard: ←/→, Page Up/Down, Home/End.',
    'Single choice adapts the poll-result-bars technique flat inside the station’s cue card (no card in a card): rows turn into bars in place on the heavy glide spring, staggered, with percentages counting up; largest-remainder rounding, “Your vote” in words, one polite announcement, change your vote.',
    'Multiple choice states its promises up front (results after voting, a real closing time) and explains why “of respondents” percentages don’t add up to 100; result segments light in a sweep. Simulated live tallies are labelled as generated in your browser, finite (40 votes), pausable, and start paused under reduced motion.',
    'Lit from one top-left light: cue cards carry a two-layer shadow; every option row and button lifts on hover, presses below rest and springs back, and a chosen option sits pressed in.',
    'Quiz: one question at a time, no timer, the same button turns from Check answer into Next question so focus never jumps; feedback is words and a mark, not colour. Ranking composes drag-reorder-list as the ballot (pointer drag with lift and spring, or Space + arrows + Space).',
  ],
  technology: ['css', 'waapi', 'motion', 'svg'],
  uses: ['drag-reorder-list'],
  adapts: ['poll-result-bars', 'press-depth-button'],
  has3d: false,
  accessibility: [
    'The tuning dial is a slider with value text (“98.2 megahertz, Quay FM” / “92.4 megahertz, no station”), a visible focus ring and full keyboard control; the settled position is announced politely, never every frame.',
    'Each poll is a fieldset with its question as the legend; options are native radios or checkboxes with 48 px rows and a visible focus ring.',
    'After voting, focus moves to “Change vote” or the results heading; changing the answer returns focus to the options. Results are announced once, politely; bars are aria-hidden and every row carries its label, percentage and tags as text.',
    'The ranking ballot has a full keyboard path (Space to pick up, ↑/↓ to move, Space to drop, Esc to cancel) and the results are an ordered list.',
  ],
  reducedMotion: 'The needle jumps to each detent (dragging still follows the pointer); result bars appear at their final width with a 160 ms fade and the numbers are shown at once; meter segments switch without a sweep; buttons and options change shadow and fill without moving; simulated live votes start paused (Resume is still available); the ranking rows swap without gliding.',
  performance: [
    'The dial writes the needle transform, the readout and 12 segment attributes directly while it moves; React only re-renders when the detent changes.',
    'Result bars are transform-only WAAPI animations on full-width fills in clipped tracks; the count-up reads each bar’s progress in one rAF loop that runs only while bars move.',
    'Meters are plain elements toggled by data attributes; the simulation updates React state once per 1.4 s and stops itself after 40 votes.',
  ],
  dataNote: 'Sample content: Quay FM, The Early Edit and every count are fictional — 1,269 sample votes on the reading-spot poll, 640 sample respondents, 312 sample ballots, and live votes generated in the browser from a seeded random sequence. The dial plays nothing. Nothing is sent anywhere.',
};
