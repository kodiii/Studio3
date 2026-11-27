import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'kinetic-marquee',
  name: 'Kinetic Marquee',
  description: 'A two-rail infinite marquee that borrows momentum from page scroll and pointer travel: velocity adds speed, leans the type into a skew and can briefly reverse the rail. It eases to a stop on hover or focus and has a visible pause control.',
  category: 'typography',
  specialties: ['cinematic', 'social'],
  technology: ['css'],
  interaction: ['scroll', 'pointer', 'hover', 'time'],
  complexity: 2,
  intensity: 'bold',
  applications: ['section divider between case studies', 'client or capability ticker', 'footer sign-off band', 'event announcement strip'],
  dependencies: [],
  params: [
    { key: 'text', label: 'Phrases (separate with /)', type: 'text', default: 'Design intelligence / Motion engineering / Digital experiences', maxLength: 140 },
    { key: 'speed', label: 'Base speed', type: 'number', default: 70, min: 10, max: 260, step: 5, unit: 'px/s' },
    { key: 'reactivity', label: 'Velocity reactivity', type: 'number', default: 1, min: 0, max: 2.5, step: 0.1 },
    { key: 'skew', label: 'Max skew', type: 'number', default: 8, min: 0, max: 16, step: 1, unit: '°' },
    { key: 'direction', label: 'Direction', type: 'select', default: 'left', options: ['left', 'right'] },
    { key: 'pauseOnHover', label: 'Pause on hover', type: 'boolean', default: true },
    { key: 'label', label: 'Header label (empty hides it)', type: 'text', default: 'Capabilities / sample copy', maxLength: 60 },
  ],
  accessibility: [
    'A visible Pause/Play button (aria-pressed) stops all movement, satisfying WCAG 2.2.2 Pause, Stop, Hide.',
    'The phrases are exposed once as a list; every repeated copy and the secondary rail are aria-hidden.',
    'Hovering the band or moving focus into it eases the rails to a stop so the text can be read.',
  ],
  reducedMotion: 'No loop runs: both rails are static, skew is removed and the pause control is replaced by a "motion off" note.',
  performance: [
    'One rAF loop (useRafLoop, paused offscreen) writes one transform per rail; nothing is laid out per frame. Pause eases the rails to a stop, then the loop sleeps until Play.',
    'Scroll and pointer listeners are passive and only accumulate a delta that the loop consumes.',
    'Copies are created from a ResizeObserver measurement: just enough to cover the container plus one.',
  ],
  preview: { height: 380 },
};
