import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'campaign-landing',
  name: 'Campaign Landing',
  specialty: 'social',
  summary: 'Mend March, a fictional city-wide repair challenge: a denim hero where you sew the saffron patch on yourself, honest dates, a gallery of last year’s mends you can turn over to see the “before”, a pledge whose key morphs while it saves, a share-card generator and a café leaderboard clearly marked as sample data.',
  highlights: [
    'Signature — sew it yourself: drag the needle along the tailor’s-chalk line and the running stitch appears behind it (the svg-path-draw technique, driven by the pointer instead of a clock); drag back to unpick. The needle turns corners on a spring, settles into the nearest stitch when released, and its thread is a short verlet rope that trails and whips behind it; the last stitch ties it off and the patch settles onto the cloth. On first view the needle sews one side and hands over.',
    'Every gesture has a twin: the needle is a slider (←/→ one stitch, Page Up/Down a side, Home/End), “Finish for me” plays the one-shot stitch from wherever you are, “Unpick” starts again.',
    'Alive, lit from one top-left light: the denim has a twill weave, film grain and two indigo fields at different depths that follow the pointer (≤ 14 px), plus a work-lamp highlight that moves with it; the share card tilts towards the pointer and catches the light.',
    'Gallery filters reorder with the flip-grid-reorder technique: staying photos glide (staggered, interruptible), leaving ones shrink and fade where they stood, new ones rise into the gap. Each photo lifts on hover, presses down, and turns over on a spring to its “before” side.',
    'Pledge flow: errors on blur and on submit with aria-invalid / aria-describedby and focus to the first problem; the key collapses into a patch with a progress ring, draws a check, and a small burst of patches celebrates the person’s own pledge, once. No email, name optional, gallery opt-in.',
    'Honest framing instead of pressure: real dates (1–31 March 2027) with no countdown, “no prizes, on purpose”, an opt-in gallery and a leaderboard (bar-race pattern on one shared scale, heavy rows on the glide spring) that says nobody is behind.',
  ],
  technology: ['waapi', 'css', 'svg', 'canvas2d', 'motion'],
  uses: ['split-line-reveal'],
  adapts: ['svg-path-draw', 'flip-grid-reorder', 'morph-submit-button', 'grain-gradient-mesh', 'press-depth-button', 'tilt-parallax-card', 'reaction-burst'],
  collaborates: ['cinematic'],
  has3d: false,
  accessibility: [
    'One h2 per section; the hero headline keeps a single accessible copy (split-line-reveal’s aria-label).',
    'The needle is a labelled slider with value text (“9 of 24 stitches sewn”, “Patch sewn on”) and a visible focus ring; dragging is never required — keys and the Finish/Unpick buttons do everything.',
    'Gallery photos are toggle buttons (aria-pressed, “Show the before photo: …”) described by the side that is showing; filters are toggle buttons; categories, thread colours and weeks are native radio groups with visible focus.',
    'Form errors are text (not colour alone), linked with aria-describedby and announced once as a polite summary; the submit key keeps focus and is aria-busy while saving, and the confirmation heading takes focus.',
    'The share-card canvas has a written equivalent that updates with its text; the leaderboard drawing is aria-hidden with a ranked list for assistive tech. Focus rings switch to saffron on the denim hero.',
  ],
  reducedMotion: 'No intro and no travel: the patch starts sewn, the needle and its thread jump to each new stitch and lie still, the denim does not follow the pointer and the share card stays flat. Gallery photos swap and cross-fade instead of gliding and turning (entering ones fade in 160 ms); the pledge key changes its label instead of morphing and there is no burst; keys change shadow and fill without moving; the leaderboard swaps weeks without sliding or growing. Dragging the needle still sews, because that motion is the person’s own.',
  performance: [
    'The needle, its rope (16 points at a fixed 120 Hz) and the stitch mask are written straight into the SVG by one rAF loop that runs only while something moves and sleeps once the thread has settled.',
    'The hero layers move with two CSS variables eased in one short rAF loop; the grain is one 128 px tile generated once. Lift shadows are opacity layers, so hovering a card never repaints a large shadow per frame.',
    'All other motion is WAAPI, CSS transitions sampled from token springs, or Motion tweens on transform, opacity and stroke-dashoffset; FLIP measures once per filter change; every animation, timer and particle is cancelled or removed on unmount.',
    'The share card redraws only when its text or colour changes, and once more when webfonts are ready.',
  ],
  dataNote: 'Sample content: the Mending Commons, its six cafés, every gallery entry (before and after) and every leaderboard number (items per café per week of March 2026) are fictional. Pledges are not sent or stored.',
};
