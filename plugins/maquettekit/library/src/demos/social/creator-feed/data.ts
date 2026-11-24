/**
 * Sample content for the creator feed. Every person, post and count is fictional (Tidewater Print Club and
 * Wrenmouth do not exist). Times are relative to a fixed sample "now" so the page reads the same every visit.
 */
export const SAMPLE_NOW = '2026-11-23T10:00:00Z';

export type Media = 'tide' | 'proofs' | 'moon' | 'swatch' | null;

export interface CommentData {
  id: string;
  author: string;
  initials: string;
  iso: string;
  ago: string;
  text: string;
}

export interface PostData {
  id: string;
  no: number;
  title: string;
  iso: string;
  ago: string;
  text: string;
  media: Media;
  alt: string;
  likes: number;
  comments: CommentData[];
}

export const PROFILE = {
  name: 'Ines Varga',
  handle: 'ines.prints',
  role: 'Risograph printer, Tidewater Print Club',
  place: 'Wrenmouth harbour',
  bio: 'I print tide tables, harbour charts and small things that only need two colours. Open press night is Thursdays, 6 to 9 — bring paper, the ink is on the club.',
  posts: 46,
  followers: 2184,
  following: 311,
} as const;

const c = (id: string, author: string, initials: string, iso: string, ago: string, text: string): CommentData => ({ id, author, initials, iso, ago, text });

export const POSTS: PostData[] = [
  {
    id: 'fn-13', no: 13, title: 'The blue plate', iso: '2026-11-23T08:05:00Z', ago: '2 h',
    text: 'The blue plate for next year’s tide table: every high water in Wrenmouth, set in nine-point figures. Coral goes on tomorrow, so for one day it is a very calm document.',
    media: 'tide', alt: 'A risograph print in blue ink only: twelve rows of wave lines, one per month, with small tide times along each row and a title band reading High Water.',
    likes: 212,
    comments: [
      c('c1', 'Tomasz Brühl', 'TB', '2026-11-23T08:31:00Z', '1 h', 'Nine-point figures on riso and they still read. What screen did you burn the master at?'),
      c('c2', 'نور الهدى', 'ن', '2026-11-23T08:52:00Z', '1 h', 'طباعة جميلة! أنتظر اللون المرجاني.'),
      c('c3', 'Aiyana Cole-Whitfield', 'AC', '2026-11-23T09:40:00Z', '20 min', 'Saving this for the harbour office wall.'),
    ],
  },
  {
    id: 'fn-12', no: 12, title: 'Three proofs', iso: '2026-11-22T16:10:00Z', ago: '18 h',
    text: 'Three proofs of the harbour chart: three millimetres out, one millimetre out, and finally in register. Look at the corner marks — that is the whole story.',
    media: 'proofs', alt: 'Three proofs of the same two-colour harbour chart.',
    likes: 344,
    comments: [
      c('c4', 'Ruairí O’Kane', 'RO', '2026-11-22T17:02:00Z', '17 h', 'The doubled corner marks on proof one are oddly beautiful.'),
      c('c5', 'Mei-Lin Achterberg', 'MA', '2026-11-22T19:45:00Z', '14 h', 'Was it the paper stretching or the drum?'),
    ],
  },
  {
    id: 'fn-11', no: 11, title: 'Paper note', iso: '2026-11-20T11:00:00Z', ago: '3 d',
    text: 'Paper note for Thursday people: the 80 gsm cream feeds better than the 90 when the room is damp. Leave a ream out overnight before a long run and it will stop curling at the tray.',
    media: null, alt: '',
    likes: 97,
    comments: [
      c('c6', 'Sefa Mensah', 'SM', '2026-11-20T12:20:00Z', '3 d', 'This saved my Saturday run. Thank you.'),
    ],
  },
  {
    id: 'fn-10', no: 10, title: 'Halftone moon', iso: '2026-11-16T20:30:00Z', ago: '1 w',
    text: 'Halftone test for the moon page. Coarse dots read as a moon; go much finer and it starts to look like a photograph of one, which is not what this calendar is for.',
    media: 'moon', alt: 'A blue halftone moon made of dots that shrink towards its lit edge, above three coral lines suggesting the sea.',
    likes: 158,
    comments: [],
  },
  {
    id: 'fn-9', no: 9, title: 'Swatch day', iso: '2026-11-09T14:15:00Z', ago: '2 w',
    text: 'Swatch day. Blue printed over coral makes a plum I did not plan for. I am keeping it.',
    media: 'swatch', alt: 'Two overlapping circles, one blue and one coral; where they overlap the inks mix into a deep plum.',
    likes: 129,
    comments: [
      c('c7', 'Joaquín Ferrer-Lund', 'JF', '2026-11-09T15:00:00Z', '2 w', 'Plum is the correct third colour.'),
      c('c8', 'Tomasz Brühl', 'TB', '2026-11-10T09:12:00Z', '2 w', 'Which drum went first?'),
    ],
  },
];

export const EDITIONS = [
  { id: 'ed-tide', title: 'Wrenmouth High Water 2027', detail: 'A3 · two colours · edition of 40', media: 'tide' as const },
  { id: 'ed-chart', title: 'Harbour Chart, third proof', detail: 'A2 · two colours · edition of 25', media: 'proofs' as const },
  { id: 'ed-moon', title: 'Moon Page', detail: 'A4 · blue only · edition of 60', media: 'moon' as const },
  { id: 'ed-swatch', title: 'Unplanned Plum', detail: 'A5 · two colours · edition of 80', media: 'swatch' as const },
];
