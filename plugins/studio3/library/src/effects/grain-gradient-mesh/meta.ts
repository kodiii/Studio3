import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'grain-gradient-mesh',
  name: 'Grain Gradient Mesh',
  description: 'Three or four soft colour fields — paper, ink and one accent from the theme — drift very slowly on compositor transforms under a film-grain tile that is generated once with canvas2d. No per-frame canvas work and no blur filters.',
  category: 'backgrounds',
  specialties: ['cinematic', 'product'],
  technology: ['css', 'canvas2d'],
  interaction: ['time'],
  complexity: 1,
  intensity: 'subtle',
  applications: ['hero or section background', 'pricing or sign-up backdrop', 'editorial cover', 'empty state'],
  dependencies: [],
  params: [
    { key: 'palette', label: 'Palette', type: 'select', default: 'Signal', options: ['Signal', 'Moss', 'Ochre', 'Graphite'] },
    { key: 'drift', label: 'Drift speed', type: 'number', default: 1, min: 0, max: 3, step: 0.1, unit: '×' },
    { key: 'grain', label: 'Grain', type: 'number', default: 0.24, min: 0, max: 0.7, step: 0.02 },
    { key: 'fields', label: 'Colour fields', type: 'number', default: 4, min: 3, max: 4, step: 1 },
  ],
  accessibility: [
    'The gradient and grain layers are aria-hidden decoration; copy sits on a solid surface card, so text contrast never depends on where a field drifts.',
    'Drift is slow (47–89 s periods at 1×), low-contrast and never flashes.',
    'Colours come from theme tokens (paper = --s3-bg, ink = --s3-ink, one accent), so light, dark and always-dark stages all stay coherent.',
  ],
  reducedMotion: 'No drift: the fields render as a still composition. The animation is gated twice — by useStudioMotion() and by a prefers-reduced-motion media query.',
  performance: [
    'Each field is a single radial-gradient element animated with transform only; no filter, no per-frame JavaScript.',
    'The grain is one 128 px PNG data URL generated once per page and cached; it tiles via background-image.',
    'Animations are paused (animation-play-state) while the element is offscreen.',
  ],
  preview: { height: 440 },
};
