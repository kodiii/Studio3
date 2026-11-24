import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'particle-field-gpu',
  name: 'Particle Field GPU',
  description: 'THREE.Points with a custom ShaderMaterial: every particle\'s position is a pure function of its seed and time, integrated along the curl of a stream function in the vertex shader, so the field braids and drifts with zero CPU work per particle. The pointer pushes particles aside or draws them in.',
  category: 'shaders',
  specialties: ['cinematic', '3d'],
  technology: ['r3f', 'three', 'glsl'],
  interaction: ['pointer', 'keyboard', 'time'],
  complexity: 3,
  intensity: 'moderate',
  applications: ['immersive hero background', 'launch or event page atmosphere', 'loading or waiting state', 'section transition backdrop'],
  dependencies: [
    { name: 'three', version: '^0.187.0' },
    { name: '@react-three/fiber', version: '^9.8.2' },
  ],
  params: [
    { key: 'count', label: 'Particles (× quality density)', type: 'number', default: 12000, min: 2000, max: 40000, step: 1000 },
    { key: 'intensity', label: 'Intensity', type: 'number', default: 0.8, min: 0.2, max: 1.5, step: 0.05 },
    { key: 'flow', label: 'Flow speed', type: 'number', default: 1, min: 0, max: 3, step: 0.1, unit: '×' },
    { key: 'size', label: 'Point size', type: 'number', default: 2.2, min: 0.8, max: 5, step: 0.1, unit: 'px' },
    { key: 'mode', label: 'Pointer', type: 'select', default: 'Repel', options: ['Repel', 'Attract'] },
  ],
  accessibility: [
    'A visible Pause / Play button (aria-pressed) stops the continuous motion at any time (WCAG 2.2.2).',
    'Keyboard path for the pointer influence: focus the field (role="application", labelled and described), arrows move the influence point, Shift for bigger steps, Esc releases it.',
    'Works on light and dark stages: ink particles with ordinary alpha on light surfaces, additive light on dark ones; colours come from the theme tokens.',
    'Decorative: the canvas has a label and a text description; without WebGL an SVG of the same flow field\'s streamlines is shown.',
  ],
  reducedMotion: 'A single static frame of the field is rendered (frameloop="demand", time frozen); the pointer has no effect and the field is not focusable.',
  performance: [
    'One draw call (THREE.Points); per frame only uniforms change — positions come from per-particle seeds in the vertex shader (7 Euler steps of an analytic curl field).',
    'Particle count is the param × the quality profile\'s density (12 000 → 7 200 on medium, 3 600 on low); the canvas pauses offscreen via StudioCanvas.',
    'frameloop="always" only while playing; paused or reduced motion switches to "demand" and renders only on pointer input.',
    'Geometry and material are created imperatively and disposed on unmount or when the count changes.',
  ],
  preview: { height: 520 },
};
