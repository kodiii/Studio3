import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'particle-experience',
  name: 'Drift — a particle study',
  specialty: '3d',
  summary: 'A full-bleed field of glowing GPU particles that forms and re-forms a sphere, a torus and an abstract glyph, turns towards the pointer and is pushed around by a pointer or a finger, with live renderer readouts that are measured, never invented.',
  highlights: [
    'The field is the hero: edge to edge, with the title, the live status, Pause and the form keys laid over it, and an ember nebula plus a soft light that follows the pointer behind the canvas.',
    'Glow and depth come from the shader, not a postprocessing pass: each point is a white-hot core in a soft halo (additive blending turns overlaps into bloom), points behind the focus plane dim and cool, and points away from it spread into wider, fainter discs.',
    'All motion happens in the vertex shader: each particle stores its point on three forms plus a seed; morphs are staggered per particle and bloom outwards mid-flight, a pointer, a sideways touch drag or the Pulse key disturbs the field, and the whole field turns a little towards the pointer.',
    'The controls are keys lit from above by the field (press-depth-button, adapted): they lift on hover, press in, latch on the chosen form and spring back on a linear() curve sampled from a spring token; the panel keeps one height while the forms cycle.',
    'The requested count is scaled by the quality profile (density 1 / 0.6 / 0.3) and the quality can be switched live; the readout is renderer.info from the last frame and the rAF interval, labelled as measured on this device.',
  ],
  technology: ['r3f', 'three', 'glsl'],
  uses: [],
  adapts: ['press-depth-button'],
  has3d: true,
  accessibility: [
    'Every control is a native radio, checkbox, range, select or button with a visible label; the current form is also stated in text, and the form description reserves the height of the longest one so nothing jumps when the form changes.',
    'The pointer disturbance has a keyboard equivalent: the Pulse key sends the same kind of push through the field. Touch drags only claim sideways movement, so vertical swipes keep scrolling the page.',
    'The continuous animation has a Pause control next to it (WCAG 2.2.2); the canvas has a text description that follows the form and count.',
    'Without WebGL a still SVG drawing of the sphere form replaces the canvas.',
  ],
  reducedMotion: 'The field is a still frame rendered on demand: no flow, no automatic cycling, no turning towards the pointer and no pointer light; forms cut instead of morphing, and the pointer push and Pulse are off. Intensity, count, flow (which picks the frozen phase) and form still redraw the still; the keys change state without their spring.',
  performance: [
    'One draw call for the whole field; additive blending with depth writes off, so there is no sorting. Sprites are drawn 2.3× wider to hold the halo, which the low profile’s density offsets.',
    'Count = requested × profile density; DPR is capped per profile. In headless SwiftShader the low profile renders 7,200 points.',
    'Continuous loop only while the field animates and is on screen (StudioCanvas pauses offscreen); paused or reduced motion switches to render-on-demand. The pointer light is two CSS variables written outside React.',
    'Form buffers are generated once per count (seeded, deterministic) and the geometry is disposed when the count changes.',
  ],
};
