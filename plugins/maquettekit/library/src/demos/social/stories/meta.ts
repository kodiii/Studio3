import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'stories',
  name: 'Stories',
  specialty: 'social',
  summary: 'Mobile-first stories for a fictional harbour town: a tray of accounts that opens into a full-screen viewer with segmented progress, tap zones, hold to pause, swipes between accounts and down to close — every one mirrored by a button and a key — on a desktop stage that takes the colour of the story, plus a story embedded in the page.',
  highlights: [
    'Signature: the ring you press grows into the viewer (a circular reveal from the ring’s own position) and the viewer closes back into it, faster than it opened.',
    'A desktop stage, not just a phone in a void: a device with a lit bezel, a room that takes the colour of the card on screen (a registered colour property, so it blends between cards), the neighbouring accounts waiting on either side as dimmed peek cards you can click, and the keys set out as keycaps under the phone.',
    'The page itself is composed for wide screens: masthead, tray and the gesture guide on the left, the embedded story on a lit stage on the right. The guide is a set of designed hints — a pictogram of each gesture with its button and keycaps — instead of a table.',
    'The current progress segment’s animation is the clock (the story-progress-segments technique): pausing it pauses the story; it stops for the Pause button, a held press, reply focus and a hidden tab.',
    'Gestures with twins: tap left/right ↔ Previous/Next card buttons and ←/→; swipe sideways ↔ peek cards, account buttons and Shift+←/→; hold ↔ Pause and Space; swipe down ↔ Close and Esc. Swipes follow the finger with resistance at the ends and commit past 30 % or 0.5 px/ms; short of that the card springs back. Tap zones mirror in right-to-left layouts.',
    'Every control has depth: rings lift and press, head buttons, card arrows, Send and the account buttons lift on hover and press in on a token spring. A natural end: after the last account the viewer says “You’re all caught up” and nothing else plays.',
  ],
  technology: ['waapi', 'css', 'svg'],
  uses: ['story-progress-segments'],
  adapts: ['expanding-card-detail', 'press-depth-button'],
  has3d: false,
  accessibility: [
    'The viewer is a modal dialog contained in the demo: the page behind is inert and does not scroll, focus starts on Pause and returns to the ring that opened it; the dialog is described by the keyboard keys.',
    'Each card is a labelled group (“Card 2 of 3 from Ellery Bakery, 3 h ago”) with real text; drawings have their own descriptions. Manual moves are announced politely, automatic ones are not.',
    'Peek cards are real buttons named “Previous account: …” / “Next account: …”; the gesture guide is a list of text with decorative pictograms.',
    'The reply field is labelled, pauses the story while focused, and states that replies are private.',
    'All controls are 44 px or larger; focus rings turn flag-yellow on the dark viewer so they keep contrast.',
  ],
  reducedMotion: 'No clock at all: cards never advance on their own (the Pause button is not needed and is removed), progress shows position statically, the viewer opens and closes with a 160 ms fade instead of the reveal, account changes cross-fade in 160 ms instead of sliding, the stage changes colour without blending, controls change fill without moving, and the embedded story waits for its step buttons.',
  performance: [
    'Cards are DOM and inline SVG — nothing to download or preload, so the progress never runs ahead of content.',
    'One WAAPI animation per visible card drives the clock; the open and close reveal is one clip-path animation; transforms only for drags and transitions; everything is cancelled on close.',
    'The stage colour is a single registered custom property transition; peek cards and controls animate transform and opacity only.',
  ],
  dataNote: 'Sample content: Port Ellery, its accounts, notices, times and the “214 hours” figure are fictional. Replies are not sent anywhere.',
};
