import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'interactive-poll',
  name: 'Interactive Poll',
  specialty: 'social',
  summary: 'A community radio station’s listener polls: a single-choice poll with animated results, a multiple-choice poll with honest percentages and clearly labelled simulated live votes you can pause, a no-timer quiz with explanations, and a ranking poll whose ballot is a drag-to-reorder running order.',
  highlights: [
    'Single choice composes poll-result-bars: results grow from zero on one scale, your vote is marked in words, the result is announced once, and you can change your vote.',
    'Multiple choice states its promises up front (results after voting, a real closing time) and explains why “of respondents” percentages don’t add up to 100.',
    'Simulated live tallies are labelled as generated in your browser, finite (40 votes), pausable, and start paused under reduced motion — nothing pretends to be real activity.',
    'Quiz: one question at a time, no timer, the same button turns from Check answer into Next question so focus never jumps; feedback is words and a mark, not colour.',
    'Ranking composes drag-reorder-list as the ballot (pointer drag or Space + arrows + Space); sending adds your order to the sample ballots and shows average positions next to yours.',
  ],
  technology: ['css', 'waapi', 'motion', 'svg'],
  uses: ['poll-result-bars', 'drag-reorder-list'],
  has3d: false,
  accessibility: [
    'Each poll is a fieldset with its question as the legend; options are native radios or checkboxes with 48 px rows.',
    'After voting, focus moves to the results heading; “Change my answer” returns focus to the first option. Results are announced once, politely.',
    'Meter bars are aria-hidden; each row carries its label, percentage and count as text, and your picks are tagged “Your pick”.',
    'The ranking ballot has a full keyboard path (Space to pick up, ↑/↓ to move, Space to drop, Esc to cancel) and the results are an ordered list.',
  ],
  reducedMotion: 'Result bars appear at their final width and meter segments switch without fading; simulated live votes start paused (Resume is still available); the ranking rows swap without gliding.',
  performance: [
    'Meters are 24 plain elements per row toggled by data attributes; the simulation updates React state once per 1.4 s and stops itself after 40 votes.',
    'No canvas or WebGL; the only animation library loaded is Motion, inside the composed reorder list.',
  ],
  dataNote: 'Sample content: Quay FM, The Early Edit and every count are fictional — 640 sample respondents, 312 sample ballots, and live votes generated in the browser from a seeded random sequence. Nothing is sent anywhere.',
};
