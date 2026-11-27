/**
 * Copy and sample data for Lead & Lag, a two-person motion studio invented for this demo. The studio, its founders,
 * clients, projects and address are fictional; nothing here describes a real company or real results.
 */

export const STUDIO = {
  name: 'Lead & Lag',
  founders: 'Noor and Teo',
  email: 'hello@leadandlag.example',
  manifesto: ['Nothing', 'stops', 'dead.'] as const,
} as const;

export const NAV = [
  { id: 'll-work', label: 'Work' },
  { id: 'll-archive', label: 'Archive' },
  { id: 'll-process', label: 'Process' },
  { id: 'll-reel', label: 'Reel' },
  { id: 'll-contact', label: 'Contact' },
] as const;

export type CaseId = 'tidewater' | 'ferry' | 'halden' | 'crumb';

export interface CaseStudy {
  id: CaseId;
  client: string;
  title: string;
  kind: string;
  year: string;
  summary: string;
  did: readonly string[];
  /** The feature card is larger: it tilts less and settles slower (mass differs by size). */
  feature?: boolean;
}

export const CASES: readonly CaseStudy[] = [
  {
    id: 'tidewater',
    client: 'Tidewater Institute',
    title: 'A wordmark that keeps the tide',
    kind: 'Identity · motion system',
    year: '2025',
    summary: 'A living identity for a coastal research institute: the wordmark’s baseline rises and falls with the tide table, and every chart, title and transition borrows the same slow swell.',
    did: ['Motion language and tokens', 'Tide-driven wordmark (sample tide table)', 'Title and chart templates'],
    feature: true,
  },
  {
    id: 'ferry',
    client: 'The Night Ferry',
    title: 'Main titles for a slow film',
    kind: 'Title sequence',
    year: '2024',
    summary: 'Ninety seconds of type at sea: names surface like harbour lights, a lighthouse beam carries the director’s credit, and nothing cuts faster than the swell allows.',
    did: ['Title design and timing', 'Lighthouse beam and fog passes', 'Credits in four languages'],
  },
  {
    id: 'halden',
    client: 'Halden Type',
    title: 'A typeface that flexes on cue',
    kind: 'Type animation',
    year: '2024',
    summary: 'A launch film for a variable typeface: every axis is choreographed to the music, so weight lands on the downbeat and width breathes between phrases.',
    did: ['Specimen film', 'Axis choreography', 'Social cut-downs'],
  },
  {
    id: 'crumb',
    client: 'Crumb',
    title: 'Onboarding that rises like dough',
    kind: 'Product motion · Lottie',
    year: '2023',
    summary: 'Four onboarding screens for a neighbourhood bakery app, animated as Lottie files the team ships as they are: rolls hop, ovens glow and every tap lands with a little squash.',
    did: ['Onboarding animation', 'Lottie hand-off with segments', 'Reduced-motion versions'],
  },
];

export type ArchiveArt = 'vane' | 'boats' | 'metro' | 'seeds' | 'beacon' | 'strings' | 'clock' | 'kiln' | 'choir' | 'radio';

export const ARCHIVE: readonly { title: string; year: string; art: ArchiveArt }[] = [
  { title: 'Weather vane loader', year: '2017', art: 'vane' },
  { title: 'Paper boat idents', year: '2018', art: 'boats' },
  { title: 'Metro wayfinding pulses', year: '2019', art: 'metro' },
  { title: 'Seed catalogue specimens', year: '2020', art: 'seeds' },
  { title: 'Lighthouse ticket UI', year: '2021', art: 'beacon' },
  { title: 'Orchestra season trailer', year: '2022', art: 'strings' },
  { title: 'Ferry timetable motion', year: '2022', art: 'clock' },
  { title: 'Pottery studio loop', year: '2023', art: 'kiln' },
  { title: 'Choir poster in motion', year: '2023', art: 'choir' },
  { title: 'Weather radio titles', year: '2024', art: 'radio' },
];

export const PROCESS = [
  { n: '01', title: 'Listen', who: 'Both', body: 'We start with the brief and a stopwatch: what has to move, what must stay still, and what the motion is for.' },
  { n: '02', title: 'Keys', who: 'Noor leads', body: 'Noor draws the key poses: where things start, where they land, and how much they weigh on the way.' },
  { n: '03', title: 'Timing', who: 'Teo lags', body: 'Teo times the spacing between keys: slow in, slow out, and the overshoot that makes a landing feel earned.' },
  { n: '04', title: 'Hand-off', who: 'Both', body: 'Tokens, springs and Lottie or Rive files your developers can ship as they are, each with a reduced-motion version.' },
] as const;

/** Fictional client names for the marquee (the recipe splits phrases on "/"). */
export const CLIENTS = 'Tidewater Institute / Halden Type / Crumb / Orrisford Ferries / Sable Choir / Weatherhouse Radio';

/** The words under the star rating, 0 = not rated. */
export const FEEL = ['Not rated yet', 'Stiff', 'A bit floaty', 'Fine', 'Lively', 'Weighty, in a good way'] as const;

/** Reel shots, in order; `at` and `len` are milliseconds on the reel clock. */
export const SHOTS = [
  { id: 'slate', label: 'Slate', at: 0, len: 2600 },
  { id: 'ball', label: 'Nothing stops dead', at: 2600, len: 3400 },
  { id: 'tide', label: 'Tidewater Institute', at: 6000, len: 3200 },
  { id: 'ferry', label: 'The Night Ferry', at: 9200, len: 3200 },
  { id: 'type', label: 'Halden Type', at: 12400, len: 3000 },
  { id: 'crumb', label: 'Crumb', at: 15400, len: 2800 },
  { id: 'end', label: 'End card', at: 18200, len: 2600 },
] as const;
export type ShotId = (typeof SHOTS)[number]['id'];
export const REEL_MS = SHOTS[SHOTS.length - 1].at + SHOTS[SHOTS.length - 1].len;
