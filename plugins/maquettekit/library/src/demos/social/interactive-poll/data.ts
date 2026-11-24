/**
 * Sample content for Quay FM's listener polls. The station, its shows and every count are fictional; the
 * "live" votes are generated in the browser from a seeded random sequence and are labelled as simulated.
 */
export const CLOSES = { iso: '2026-11-27T18:00:00Z', text: 'Friday 27 November, 18:00 GMT' };

export const SLOTS = [
  { id: 'early', label: '6–7 · The early hour' },
  { id: 'edit', label: '7–8 · The Early Edit' },
  { id: 'talk', label: '8–9 · Harbour talk' },
  { id: 'music', label: '9–10 · Music till ten' },
] as const;
export type SlotId = (typeof SLOTS)[number]['id'];
/** Sample: how many of the 640 respondents ticked each slot (more than one allowed). */
export const SLOT_BASE: Record<SlotId, number> = { early: 212, edit: 498, talk: 301, music: 263 };
export const SLOT_RESPONDENTS = 640;
/** Chance that a simulated listener ticks each slot. */
export const SLOT_ODDS: Record<SlotId, number> = { early: 0.32, edit: 0.78, talk: 0.46, music: 0.41 };

export interface QuizQuestion { q: string; options: readonly string[]; answer: number; explain: string }
export const QUIZ: readonly QuizQuestion[] = [
  {
    q: 'How many high tides does most of the coast get in a day?',
    options: ['One', 'Two', 'Four'],
    answer: 1,
    explain: 'Two, roughly 12 hours 25 minutes apart: the Moon raises a bulge of water on both sides of the Earth.',
  },
  {
    q: 'What does a harbour pilot do?',
    options: ['Flies the coastguard helicopter', 'Guides visiting ships through local waters', 'Runs the ferry ticket office'],
    answer: 1,
    explain: 'Pilots board incoming ships and steer them through the channel, because they know the local sandbanks and currents.',
  },
  {
    q: 'On the radio, what is a “cold open”?',
    options: ['Starting straight into the content, before any theme music', 'A segment recorded outdoors in winter', 'The first weather report of the day'],
    answer: 0,
    explain: 'A cold open drops you straight into the programme; the theme and introductions come after it.',
  },
];

/** Running-order titles exactly as the drag-reorder-list recipe renders them (its ballot is read from the page). */
export const RUNNING = [
  { id: 'open', title: 'Cold open', avg: 1.6 },
  { id: 'news', title: 'Headlines', avg: 2.3 },
  { id: 'roads', title: 'Weather and roads', avg: 2.8 },
  { id: 'pilot', title: 'Interview: a harbour pilot', avg: 4.1 },
  { id: 'letters', title: 'Listener letters', avg: 4.7 },
  { id: 'music', title: 'Music break', avg: 5.3 },
  { id: 'close', title: 'Sign-off', avg: 6.8 },
] as const;
export const RUNNING_BALLOTS = 312;
