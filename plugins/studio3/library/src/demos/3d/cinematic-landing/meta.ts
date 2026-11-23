import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'cinematic-landing',
  name: 'Pulse Night Edition',
  specialty: '3d',
  summary: 'An art-directed launch page: the Pulse speaker on a black stage, an opening camera move you can skip, a slow key-light sweep, and a scroll-driven camera that walks through two chapters of editorial copy.',
  highlights: [
    'A choreographed opening: the camera arcs in on a centripetal Catmull-Rom path while the key light fades up — interrupted by Skip or by the first scroll.',
    'Scroll progress through a pinned section drives the camera between three held poses with critically damped easing, with separate framings for portrait screens.',
    'Ambient light: the key sweeps slowly and the status ring breathes (the LightPulse clip plus an emissive pulse on a cloned material), with a Pause control.',
    'The headline is the split-line-reveal recipe; all copy is DOM text around the canvas, and the poster fallback carries the same copy.',
  ],
  technology: ['r3f', 'three', 'waapi'],
  uses: ['split-line-reveal'],
  collaborates: ['cinematic'],
  has3d: true,
  accessibility: [
    'All copy is real text outside the canvas; the canvas has a name and a description of the scene and of what scrolling does.',
    'The opening move (5.2 s) has a Skip button; the continuous light animation has a Pause control (WCAG 2.2.2).',
    'Section buttons jump to each chapter; normal keyboard scrolling drives the same camera moves.',
    'Without WebGL, or if the model fails to load, a still render sits where the speaker would be and the copy is unchanged.',
  ],
  reducedMotion: 'No opening move: the camera starts at its final pose and cuts to each chapter’s pose instead of gliding; the lights and the status ring hold still; the headline appears without its rise.',
  performance: [
    'Continuous rendering only while the ambient light plays and the stage is on screen; paused or reduced, it renders on demand (scroll and camera settling request frames).',
    'One model (the variant for the quality profile: 131k triangles on low-power), a plinth and a contact shadow — about 16 draw calls.',
    'Scroll is read through a passive, rAF-batched listener into a ref; no React render per scroll event (only when the chapter changes).',
  ],
};
