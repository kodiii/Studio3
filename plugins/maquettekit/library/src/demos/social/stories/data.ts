/**
 * Sample content: Port Ellery and every account, notice and number in these stories are fictional.
 * Segments are real text drawn over flat colour fields, so each one has a written equivalent by construction.
 */
export type Flag = 'H' | 'B' | 'L' | 'F' | 'G';
export type Field = 'navy' | 'red' | 'yellow' | 'blue' | 'paper';

export interface Segment {
  id: string;
  field: Field;
  kicker: string;
  big: string;
  body: string;
  /** Optional drawn element behind the type. */
  art?: 'tide' | 'wind' | 'bun' | 'boat' | 'ferry' | 'knot';
  /** What a screen reader hears for the drawing (when there is one). */
  artAlt?: string;
}

export interface Creator { id: string; name: string; flag: Flag; flagName: string; ago: string; iso: string; segments: Segment[] }

export const CREATORS: Creator[] = [
  {
    id: 'harbour', name: 'Harbour Office', flag: 'H', flagName: 'Hotel', ago: '1 h', iso: '2026-11-23T09:00:00Z',
    segments: [
      { id: 'h1', field: 'navy', kicker: 'Tides today', big: '11:42', body: 'High water this morning, 4.9 m. The next one is at 23:58.', art: 'tide', artAlt: 'A tide curve rising to a peak marked 11:42.' },
      { id: 'h2', field: 'red', kicker: 'Notice', big: 'Slipway closed', body: '14:00 to 16:00 today while the winch is serviced. Launch from the north steps instead.' },
      { id: 'h3', field: 'paper', kicker: 'Wind and sea', big: 'NW 4–5', body: 'Sea slight, becoming moderate this evening. Small boats: come back in by dusk.', art: 'wind', artAlt: 'An arrow pointing south-east, the direction the north-west wind blows towards.' },
    ],
  },
  {
    id: 'bakery', name: 'Ellery Bakery', flag: 'B', flagName: 'Bravo', ago: '3 h', iso: '2026-11-23T07:00:00Z',
    segments: [
      { id: 'b1', field: 'yellow', kicker: 'Out of the oven', big: 'Saffron buns', body: 'First tray at 8, second at 10. The quay door is open from 7:30.', art: 'bun', artAlt: 'Three round buns on a tray.' },
      { id: 'b2', field: 'paper', kicker: 'Sourdough', big: 'Until it’s gone', body: 'Usually around eleven. We don’t hold loaves, but we do tell you when the last one goes.' },
    ],
  },
  {
    id: 'lifeboat', name: 'Lifeboat Station', flag: 'L', flagName: 'Lima', ago: '5 h', iso: '2026-11-23T05:00:00Z',
    segments: [
      { id: 'l1', field: 'blue', kicker: 'Training', big: 'Tuesday 19:00', body: 'Night launch exercise off the breakwater. Expect lights and noise for about an hour.', art: 'boat', artAlt: 'A lifeboat seen from the side, riding a wave.' },
      { id: 'l2', field: 'navy', kicker: 'Open evening', big: '3 December', body: 'Thinking of volunteering? Come and meet the crew, 18:30 at the station. No experience needed.' },
      { id: 'l3', field: 'yellow', kicker: 'This year', big: '214 hours', body: 'At sea on call-outs and training so far this year (sample figure). Thank you for the soup.' },
    ],
  },
  {
    id: 'ferry', name: 'Ferry Desk', flag: 'F', flagName: 'Foxtrot', ago: '8 h', iso: '2026-11-23T02:00:00Z',
    segments: [
      { id: 'f1', field: 'paper', kicker: 'Winter timetable', big: 'From 1 Dec', body: 'First sailing 07:15, last back from the island 17:40. Full times are on the board by the ticket hut.', art: 'ferry', artAlt: 'A small ferry crossing between two shores.' },
      { id: 'f2', field: 'red', kicker: 'On board', big: 'Bikes free', body: 'Dogs welcome on deck. Please fold pushchairs on the stairs.' },
    ],
  },
  {
    id: 'gallery', name: 'Rope Walk Gallery', flag: 'G', flagName: 'Golf', ago: '20 h', iso: '2026-11-22T14:00:00Z',
    segments: [
      { id: 'g1', field: 'navy', kicker: 'New show', big: 'Knots', body: 'Forty years of them, tied by the harbour’s net menders. Opens Thursday.', art: 'knot', artAlt: 'A figure-of-eight knot drawn in a single line.' },
      { id: 'g2', field: 'yellow', kicker: 'Opening hours', big: 'Thu–Sun', body: '11:00 to 16:00. Free entry; the rope walk itself is step-free.' },
    ],
  },
];

export const SEGMENT_MS = 6000;
