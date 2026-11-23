import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'orbit-inspect-controls',
  name: 'Orbit Inspect Controls',
  description: 'Accessible orbit inspection of a procedural architectural maquette: drag to orbit with damping and limits, zoom only when the viewer is focused (or with a pinch), and a full keyboard and button path. Shadows are baked once for the fixed key light, so the scene renders only while the camera moves.',
  category: 'camera',
  specialties: ['3d', 'product'],
  technology: ['r3f', 'three'],
  interaction: ['drag', 'keyboard', 'press', 'pointer'],
  complexity: 3,
  intensity: 'moderate',
  applications: ['product or furniture inspection', 'architecture and interior model viewer', 'museum object detail page', 'configurator preview'],
  dependencies: [
    { name: 'three', version: '^0.187.0' },
    { name: '@react-three/fiber', version: '^9.8.2' },
  ],
  params: [
    { key: 'damping', label: 'Damping', type: 'number', default: 0.08, min: 0, max: 0.3, step: 0.01 },
    { key: 'step', label: 'Key / button step', type: 'number', default: 15, min: 5, max: 45, step: 5, unit: '°' },
    { key: 'limits', label: 'Orbit limits', type: 'select', default: 'Upper hemisphere', options: ['Upper hemisphere', 'Front arc', 'Plan to eye level'] },
    { key: 'autoRotate', label: 'Idle turntable', type: 'boolean', default: false },
    { key: 'accent', label: 'Figure colour', type: 'color', default: '#bf2f09' },
  ],
  accessibility: [
    'The viewer wrapper is focusable (role="application", labelled, described by the visible instruction line, aria-keyshortcuts): arrows orbit, + / − zoom, 0 or Home resets.',
    'Every pointer gesture has a button: rotate left/right, tilt up/down, zoom in/out and reset, all ≥ 44 px with visible focus.',
    'No scroll hijack: the wheel zooms only while the viewer has focus; ctrl/⌘ + wheel (trackpad pinch) zooms while hovering; touch uses touch-action: pan-y so vertical swipes still scroll the page.',
    'After each move settles, a polite live region reports the view (angle, elevation, zoom); the on-canvas readout is aria-hidden to avoid per-frame chatter.',
    'Without WebGL an SVG axonometric drawn from the same model data is shown and the camera buttons are disabled with an explanation.',
  ],
  reducedMotion: 'Damping and the idle turntable are switched off, so every orbit, zoom and reset is a direct cut with no easing tail; dragging still follows the pointer 1:1.',
  performance: [
    'frameloop="demand": nothing renders at rest; frames are requested only while the camera moves (including the damping tail) or the optional turntable runs.',
    'About 15 draw calls: shared box geometry, instanced columns, steps, trees and figures; no shadow-map pass at any quality level — ground shadows are baked once into a canvas texture for the fixed key light.',
    'Generated environment lighting (PMREM, sized by the quality profile) instead of a downloaded HDRI; NeutralToneMapping keeps paper white and the accent hue true.',
    'All imperatively created geometries, materials and canvas textures are disposed on unmount.',
  ],
  preview: { height: 580 },
};
