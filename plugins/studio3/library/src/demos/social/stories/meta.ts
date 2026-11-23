import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'stories',
  name: 'Stories',
  specialty: 'social',
  summary: 'Mobile-first stories for a fictional harbour town: a tray of accounts, a full-screen viewer with segmented progress, tap zones, hold to pause, swipes between accounts and down to close — every one mirrored by a button and a key — plus a story embedded in the page.',
  highlights: [
    'The current progress segment’s animation is the clock (the story-progress-segments technique): pausing it pauses the story; it stops for the Pause button, a held press, reply focus and a hidden tab.',
    'Gestures with twins: tap left/right ↔ Previous/Next card buttons and ←/→; swipe sideways ↔ account buttons and Shift+←/→; hold ↔ Pause and Space; swipe down ↔ Close and Esc. Tap zones mirror in right-to-left layouts.',
    'Swipes follow the finger with resistance at the ends and commit past 30 % of the width or 0.5 px/ms; short of that the card springs back.',
    'A natural end: after the last account the viewer says “You’re all caught up” and nothing else plays. Rings show “3 new” or “Seen” in words, not only by colour.',
    'The story-progress-segments recipe is composed as an embedded single story (a newsletter embed), themed to the harbour red.',
  ],
  technology: ['waapi', 'css', 'svg'],
  uses: ['story-progress-segments'],
  has3d: false,
  accessibility: [
    'The viewer is a modal dialog contained in the demo: the page behind is inert and does not scroll, focus starts on Pause and returns to the ring that opened it.',
    'Each card is a labelled group (“Card 2 of 3 from Ellery Bakery, 3 h ago”) with real text; drawings have their own descriptions. Manual moves are announced politely, automatic ones are not.',
    'The reply field is labelled, pauses the story while focused, and states that replies are private.',
    'All controls are 44 px; focus rings turn flag-yellow on the dark viewer so they keep contrast.',
  ],
  reducedMotion: 'No clock at all: cards never advance on their own (the Pause button is not needed and is removed), progress shows position statically, account changes cross-fade in 160 ms instead of sliding, and the embedded story waits for its step buttons.',
  performance: [
    'Cards are DOM and inline SVG — nothing to download or preload, so the progress never runs ahead of content.',
    'One WAAPI animation per visible card drives the clock; transforms only for drags and transitions; everything is cancelled on close.',
  ],
  dataNote: 'Sample content: Port Ellery, its accounts, notices, times and the “214 hours” figure are fictional. Replies are not sent anywhere.',
};
