import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'story-progress-segments',
  name: 'Story Progress Segments',
  description: 'A Stories-style viewer with segmented progress: each segment fills on a WAAPI timeline and advances the story, the left third goes back and the rest goes forward, pressing and holding pauses, and visible Previous / Pause / Next buttons plus arrow keys and Space make every gesture optional. Slides are typographic compositions drawn in CSS.',
  category: 'social',
  specialties: ['social', 'cinematic'],
  technology: ['waapi', 'css'],
  interaction: ['press', 'keyboard', 'time'],
  complexity: 3,
  intensity: 'moderate',
  applications: ['product or editorial stories', 'onboarding walkthrough', 'event recap', 'release notes highlights'],
  dependencies: [],
  params: [
    { key: 'duration', label: 'Slide duration', type: 'number', default: 5000, min: 2000, max: 10000, step: 250, unit: 'ms' },
    { key: 'slides', label: 'Slides', type: 'number', default: 5, min: 3, max: 6, step: 1 },
    { key: 'transition', label: 'Transition', type: 'select', default: 'slide', options: ['slide', 'fade', 'none'] },
    { key: 'autoAdvance', label: 'Auto-advance', type: 'boolean', default: true },
  ],
  accessibility: [
    'Visible Previous, Pause/Play and Next buttons (WCAG 2.2.2 pause control and 2.5.1 single-pointer alternative to tap zones and press-and-hold).',
    'The focusable story region answers ← and → (previous/next) and Space (pause/play); a text line always says "Slide n of N".',
    'Slides are groups labelled "n of N"; hidden slides are inert. The slide region is aria-live="polite" only while not auto-advancing, so screen readers are not interrupted mid-story.',
    'Tap zones and the progress segments are aria-hidden duplicates of the buttons; all copy is fictional sample content.',
  ],
  reducedMotion: 'No auto-advance and no slide movement: the story waits for Previous/Next, segments show position statically and slides swap with a 160 ms fade.',
  performance: [
    'One WAAPI scaleX animation per visible segment drives both the bar and the advance (its finish event), so pausing is animation.pause() with no timers to resync.',
    'Slide transitions are two short transform/opacity animations; every animation is cancelled on change and on unmount.',
  ],
  preview: { height: 620 },
};
