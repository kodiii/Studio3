import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'creator-feed',
  name: 'Creator Feed',
  specialty: 'social',
  summary: 'A risograph printer’s profile and field-note feed where every like, save, follow and comment answers in the same frame, reconciles with a simulated server, rolls back with a reason, and the feed ends with “You’re all caught up”.',
  highlights: [
    'Optimistic toggles send the final intended state (debounced, with an idempotency key), reconcile counts with the server value and roll back visibly with a reason — switch on “Simulate failed requests” to watch it.',
    'Like and save morph instead of swapping icons (like-heart-morph technique, made controllable so a rollback plays the quiet reverse); the pinned note composes the reaction-burst recipe as-is.',
    'Comments drawer: optimistic insertion with Sending… / Posted / Not posted + Retry and Edit, drafts kept per post, the audience stated before posting, focus trapped and returned.',
    'Share uses navigator.share when the browser has it; otherwise a copy-link sheet with a polite confirmation (and a select-the-text fallback when the clipboard is blocked).',
    'A chronological feed with a natural end; suggested reading sits after the caught-up marker, is labelled “not from accounts you follow” and can be hidden. “Hide like counts” is one tap away.',
    'Ethics checklist (studio-social §9): no ticking or invented activity, counts labelled sample data, no gated content, unfollow as easy as follow, comment audience visible before posting.',
  ],
  technology: ['svg', 'waapi', 'css', 'canvas2d'],
  uses: ['reaction-burst', 'like-heart-morph'],
  has3d: false,
  accessibility: [
    'ARIA feed pattern: role="feed" with labelled articles, aria-posinset/aria-setsize; Page Down / Page Up move between posts.',
    'Like, save, follow and the settings are toggle buttons (aria-pressed / role="switch") with stable names; counts are text.',
    'Double-tap on a print likes it (touch and mouse) — a shortcut only; the Like button is always visible.',
    'The proofs carousel scrolls natively with snap points, has Previous/Next buttons and a “1/3” position in words; the track is focusable for arrow-key scrolling.',
    'Sheets are modal dialogs contained in the demo: the page behind is inert, Tab wraps inside, Esc and the scrim close, focus returns to the opener.',
    'Failures are shown next to the control and announced once in a polite status region; user-written text uses dir="auto" (one comment is right-to-left).',
  ],
  reducedMotion: 'Like and save cross-fade their fill in 160 ms (no spring, ring or rays); the double-tap heart and reaction particles are removed; sheets and new comments fade instead of sliding; the carousel jumps instead of smooth-scrolling.',
  performance: [
    'Prints are inline SVG (the halftone moon is a single path) with reserved 4:5 aspect ratios, so nothing shifts while the feed renders.',
    'All motion is WAAPI on transform and opacity; every running sequence is cancelled on unmount or on the next toggle.',
    'The simulated server uses timers only; all of them are cleared on unmount.',
  ],
  dataNote: 'Sample content: Ines Varga, Tidewater Print Club, Wrenmouth, every comment and every like/follower count are fictional. Requests go to an in-memory simulated server with ~0.7 s latency; nothing leaves the page.',
};
