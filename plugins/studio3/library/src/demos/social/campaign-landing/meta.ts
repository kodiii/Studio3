import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'campaign-landing',
  name: 'Campaign Landing',
  specialty: 'social',
  summary: 'Mend March, a fictional city-wide repair challenge: a stitched-in kinetic hero, honest dates, a filterable gallery of last year’s mends, a pledge form with careful validation, a share-card generator and a café leaderboard clearly marked as sample data.',
  highlights: [
    'Kinetic hero: the split-line-reveal headline rises in while a running stitch sews a saffron patch on, once, then the page is still.',
    'Honest framing instead of pressure: real dates (1–31 March 2027) with no countdown, “no prizes, on purpose”, an opt-in gallery and a leaderboard that says nobody is behind.',
    'Gallery filters reorder with FLIP (the motion module’s flip()): staying tiles glide, entering tiles scale in, DOM order stays the reading order, and the count is announced politely.',
    'Pledge flow: errors on blur and on submit with aria-invalid / aria-describedby, focus to the first problem, no email, name optional, success state that takes focus.',
    'Share card drawn on a 1080 px canvas from your pledge; Download PNG always works, “Share image…” appears only where navigator.canShare({ files }) says yes. Sharing never unlocks anything.',
    'Leaderboard: bar-race pattern on one shared scale with Play/Pause and week buttons; an ordered list in rank order carries the same numbers.',
  ],
  technology: ['waapi', 'css', 'svg', 'canvas2d'],
  uses: ['split-line-reveal'],
  collaborates: ['cinematic'],
  has3d: false,
  accessibility: [
    'One h2 per section; the hero headline keeps a single accessible copy (split-line-reveal’s aria-label).',
    'Filters are toggle buttons (aria-pressed); categories, thread colours and weeks are native radio groups styled as chips with visible focus.',
    'Form errors are text (not colour alone), linked with aria-describedby and announced once as a polite summary.',
    'The share-card canvas has a written equivalent that updates with its text; the leaderboard drawing is aria-hidden with a ranked list for assistive tech.',
    'Focus rings switch to saffron on the denim hero so they keep contrast.',
  ],
  reducedMotion: 'The headline appears at once and the patch is shown already stitched; filters swap tiles without gliding (entering tiles fade in 160 ms); the leaderboard swaps weeks without sliding or growing; the pledge check mark is drawn static.',
  performance: [
    'All motion is WAAPI or CSS transitions on transform, opacity and stroke-dashoffset; FLIP measures once per filter change.',
    'The share card redraws only when its text or colour changes, and once more when webfonts are ready.',
    'Every animation and timer is cancelled on unmount.',
  ],
  dataNote: 'Sample content: the Mending Commons, its six cafés, every gallery entry and every leaderboard number (items per café per week of March 2026) are fictional. Pledges are not sent or stored.',
};
