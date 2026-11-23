import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'particle-experience',
  name: 'Drift — a particle study',
  specialty: '3d',
  summary: 'GPU-driven particles that form and re-form a sphere, a torus and an abstract glyph, pushed around by a pointer or a finger, with live renderer readouts that are measured, never invented.',
  highlights: [
    'All motion happens in the vertex shader: each particle stores its point on three forms plus a seed; the CPU only updates uniforms.',
    'Morphs are staggered per particle and bloom outwards mid-flight; a pointer, a touch drag or the Pulse button disturbs the field.',
    'The requested count is scaled by the quality profile (density 1 / 0.6 / 0.3) and the quality can be switched live, rebuilding the canvas.',
    'The readout is renderer.info from the last frame; the only timing shown is the rAF interval, measured on this device and labelled as such.',
  ],
  technology: ['r3f', 'three', 'glsl'],
  uses: [],
  has3d: true,
  accessibility: [
    'Every control is a native radio, checkbox, range, select or button with a visible label; the current form is also stated in text.',
    'The pointer disturbance has a keyboard equivalent: the Pulse button sends the same kind of push through the field.',
    'The continuous animation has a Pause control (WCAG 2.2.2); the canvas has a text description that follows the form and count.',
    'Without WebGL a still SVG drawing of the sphere form replaces the canvas.',
  ],
  reducedMotion: 'The field is a still frame rendered on demand: no flow, no automatic cycling, forms cut instead of morphing, and the pointer push and Pulse are off. Intensity, count, flow (which picks the frozen phase) and form still redraw the still.',
  performance: [
    'One draw call for the whole field; additive blending with depth writes off, so there is no sorting.',
    'Count = requested × profile density; DPR is capped per profile. In headless SwiftShader the low profile renders 7,200 points.',
    'Continuous loop only while the field animates and is on screen (StudioCanvas pauses offscreen); paused or reduced motion switches to render-on-demand.',
    'Form buffers are generated once per count (seeded, deterministic) and the geometry is disposed when the count changes.',
  ],
};
