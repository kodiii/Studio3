import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'cinematic-landing',
  name: 'Pulse Night Edition',
  specialty: '3d',
  summary: 'An art-directed launch page: the Pulse speaker on a stone plinth in a dark room, an opening camera move you can skip, one key light shared by the scene and the copy, and a scroll-driven camera through two chapters, in which you can turn the speaker and its dial by hand.',
  highlights: [
    'Lens-shifted framing: each chapter sets the camera, the light and the speaker’s pose on its plinth so the speaker always stands opposite the copy, with no keystoning. Measured contrast of every copy block over the scene at each held chapter: 5.8:1 or better for body text.',
    'One light for page and canvas: the key light and the generated environment swing towards the pointer through critically damped smoothing, the camera sways ±3°, and the same angle drives the headline’s sheen and the lit edges and shadows of the controls.',
    'Hands on the subject: drag the speaker (or press ←/→ on the focused stage) and it turns on its plinth, keeps the release velocity and swings back on the heavy `glide` spring; in the dial chapter the same gesture turns the dial through 30 detents that snap on the quick `press` spring and drive the ring’s glow.',
    'A staged opening: the rim light draws the silhouette, then the key comes up, then the ring glows, while the camera arcs in. Between chapters the camera swings and pulls back (01→02) or cranes up while the speaker turns half round on its plinth (02→03).',
    'A filleted stone plinth whose sides fade into the dark, a two-layer contact shadow, a real key-light shadow where the profile allows shadow maps, and fog for depth.',
  ],
  technology: ['r3f', 'three', 'waapi', 'css'],
  uses: ['split-line-reveal'],
  adapts: ['magnetic-button', 'press-depth-button'],
  collaborates: ['cinematic'],
  has3d: true,
  accessibility: [
    'All copy is real text outside the canvas; the canvas has a name and a description of the scene, of what scrolling does and of what dragging does.',
    'The focusable stage is the keyboard twin of the drag: ←/→ turn the speaker, and in the Dial chapter they turn the dial one detent each. Two buttons (Turn the dial down/up) do the same without a pointer; the volume is announced once the dial comes to rest.',
    'The opening move has a Skip button; the light’s slow drift and the ring’s breathing have a Pause control (WCAG 2.2.2). Section buttons jump to each chapter.',
    'Every copy block sits on a directional scrim (or, when stacked, a dark glass card), so contrast holds whatever the camera frames behind it.',
    'Without WebGL, or if the model fails to load, a still render sits opposite the copy and the copy and the volume buttons are unchanged.',
  ],
  reducedMotion: 'No opening move, no camera sway, no light drift or pointer light, no breathing ring: the camera and the speaker’s pose cut to each chapter. Dragging still turns the speaker and the dial under your hand, but they return or snap without springing; ←/→ hold the speaker turned while pressed.',
  performance: [
    'Continuous rendering only while the light plays and the stage is on screen; paused or under reduced motion it renders on demand: scroll, pointer, drag and settling springs request frames and stop when everything is at rest.',
    'One model (the variant for the quality profile: 131k triangles on low-power), the plinth and one contact-shadow quad: about 16 draw calls. The plinth’s stone and the contact shadow are drawn once on 2D canvases (256 px and 512 × 256 px) and disposed on unmount.',
    'Scroll and pointer are read through passive listeners into refs; React renders only when the chapter or the volume changes. The shared light reaches CSS as two custom properties written only when they change.',
  ],
};
