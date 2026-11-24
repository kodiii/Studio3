import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'product-configurator',
  name: 'Pulse Configurator',
  specialty: '3d',
  summary: 'A product configurator for a fictional portable speaker: colourways, finishes, camera presets, exploded view, annotations and a price summary that all work with or without the canvas.',
  highlights: [
    'One GLB, three optimised builds: the variant is chosen from the quality profile and its real size is shown.',
    'Per-material overrides through PartController — originals are never mutated and are restored on unmount.',
    'Exploded view driven by glTF node extras, critically damped and staggered; camera presets are interruptible.',
    'Every option is a native radio/range/button and is mirrored in a text summary, so the configuration is complete without WebGL.',
  ],
  technology: ['r3f', 'three'],
  uses: [],
  has3d: true,
  accessibility: [
    'Colourways and finishes are radio groups with text names; colour is never the only signal.',
    'Camera: pointer drag, toolbar buttons, and arrow / + / − / 0 keys on the focused view. Wheel zoom only when the view has focus.',
    'Parts can be selected from a list as well as by clicking the model; the selected part is announced as text.',
    'Annotations are real buttons over the canvas plus a mirrored list; the summary region is aria-live.',
    'Without WebGL the static render and the same controls and summary are shown.',
  ],
  reducedMotion: 'Camera presets and the exploded view cut instead of animating; the dial clip never auto-plays and only runs from its Play button.',
  performance: [
    'Render on demand: the scene draws only while the camera, explode amount or a clip is changing.',
    'Low-power devices load the 1.0 MB build (131k triangles) and use an analytic contact shadow instead of a shadow map.',
    'Material clones are created lazily (only for materials that are overridden) and disposed with the controller.',
  ],
  dataNote: 'Product, brand, specifications and prices are fictional.',
};
