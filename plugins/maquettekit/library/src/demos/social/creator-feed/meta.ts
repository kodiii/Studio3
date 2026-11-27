import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'creator-feed',
  name: 'Creator Feed',
  specialty: 'social',
  summary: 'A risograph printer’s profile and field-note feed where every print’s two ink plates slip out of register as the page moves and snap back when you pick a sheet up, and every like, save, follow and comment answers in the same frame, reconciles with a simulated server, rolls back with a reason, and the feed ends with “You’re all caught up”.',
  highlights: [
    'Signature — a registration field: each print is two stacked plates, and the coral plate lags 1–4 px behind pointer and scroll speed (one rAF loop, a spring per plate, transform only), settles a hair out at rest, and snaps into exact register on the quick press spring when its sheet is hovered, pressed or holds focus. The profile name’s coral copy is one more plate.',
    'Physical and lit from one top-left light: posts and editions lift with a two-layer shadow (contact + ambient on its own opacity layer, so nothing large repaints); Follow, Like, Save, Share, comments, switches, tabs and the composed reaction chips all lift on hover, stamp down on press and spring back on a token spring.',
    'Proofs carousel with momentum: drag it with a mouse and throw — it rubber-bands at the ends and a release spring carries the throw’s velocity to the next proof; touch and trackpads keep native scroll-snap; Previous/Next and ←/→ glide the same way.',
    'Comments sheet you can throw away: drag its head down (right on the wide drawer) and release past 30 % or faster than 0.5 px/ms to dismiss at the speed of the throw; short of that it springs back. Close, Esc and the scrim do the same without a gesture.',
    'Optimistic toggles send the final intended state (debounced, with an idempotency key), reconcile counts with the server value and roll back visibly with a reason — switch on “Simulate failed requests” to watch it. Like and save morph (the like-heart-morph technique as a controlled toggle); the pinned note composes the reaction-burst recipe.',
    'Ethics checklist (studio-social §9): no ticking or invented activity, counts labelled sample data, no gated content, unfollow as easy as follow, comment audience visible before posting, a chronological feed with a natural end and hideable suggestions.',
  ],
  technology: ['svg', 'waapi', 'css', 'canvas2d', 'motion'],
  uses: ['reaction-burst'],
  adapts: ['like-heart-morph', 'press-depth-button', 'grain-gradient-mesh', 'pull-to-reveal-sheet'],
  has3d: false,
  accessibility: [
    'ARIA feed pattern: role="feed" with labelled articles, aria-posinset/aria-setsize; Page Down / Page Up move between posts.',
    'Like, save, follow and the settings are toggle buttons (aria-pressed / role="switch") with stable names; counts are text.',
    'Double-tap on a print likes it (touch and mouse) — a shortcut only; the Like button is always visible.',
    'The proofs carousel has Previous/Next buttons, ←/→ and Home/End on the focused track, and a “1/3” position in words; dragging is never the only way to move it.',
    'Sheets are modal dialogs contained in the demo: the page behind is inert, Tab wraps inside, Esc, the Close button and the scrim close it as well as the drag; focus returns to the opener.',
    'Registration snaps for keyboard users too (a sheet holding focus comes into register); the drift is decorative and carries no information.',
    'Failures are shown next to the control and announced once in a polite status region; user-written text uses dir="auto" (one comment is right-to-left).',
  ],
  reducedMotion: 'The registration field never runs: every plate sits in register and nothing drifts. Posts and buttons change shadow and fill without travelling or springing; like and save cross-fade their fill in 160 ms (no spring, ring or rays); the double-tap heart and reaction particles are removed; sheets and new comments fade instead of sliding; carousel moves jump. Dragging the carousel or the sheet still follows the pointer, because that movement is the person’s own.',
  performance: [
    'The coral plates are separate SVG layers moved with translate3d by one rAF loop that sleeps as soon as every spring has settled; no React renders while it runs.',
    'Lift shadows are pseudo-element layers whose opacity changes; the paper grain is one 128 px tile generated once with canvas2d.',
    'Prints are inline SVG (the halftone moon is a single path) with reserved 4:5 aspect ratios, so nothing shifts while the feed renders.',
    'All other motion is WAAPI or Motion springs on transform and opacity; every running animation is cancelled on unmount or on the next input.',
    'The simulated server uses timers only; all of them are cleared on unmount.',
  ],
  dataNote: 'Sample content: Ines Varga, Tidewater Print Club, Wrenmouth, every comment and every like/follower count are fictional. Requests go to an in-memory simulated server with ~0.7 s latency; nothing leaves the page.',
};
