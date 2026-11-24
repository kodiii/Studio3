import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'immersive-3d-hero',
  name: 'Kelda Ridge — night walks',
  specialty: 'cinematic',
  summary: 'An immersive hero for a fictional guided night walk: one procedural WebGL landscape drawn as contour lines, an aurora sky and layered type, with the page\'s scroll carrying the camera from the lake, along the ridge and up to the sky before handing over to plain content.',
  highlights: [
    'One persistent StudioCanvas behind four DOM slides: the page owns scroll progress (one ScrollTrigger on the window scroller) and the scene is a pure view of it — a damped camera on a Catmull-Rom path that requests frames only until it settles.',
    'Rest zones are measured from the slides themselves, so each caption is read while the camera holds at its stop; viewpoint buttons reach every stop from the keyboard.',
    'Procedural, theme-aware scene: a seeded height field shaded as iso-lines with fwidth anti-aliasing, a shader sky with aurora curtains, a star field and the walking route — colours come from the theme tokens and update live with the theme.',
    'Poster first: an SVG ridgeline print in the same palette paints immediately and is the fallback without WebGL; quality scales terrain resolution and star count with the profile\'s density.',
    'Layered DOM type (two weights at different depths) drifts apart as the hero leaves; nothing essential is drawn in the canvas.',
  ],
  technology: ['r3f', 'three', 'glsl', 'gsap', 'css', 'svg'],
  uses: ['split-line-reveal'],
  collaborates: ['3d'],
  has3d: true,
  accessibility: [
    'The canvas is labelled and described; every chapter is DOM text on a solid panel, in reading order, and the viewpoint buttons (aria-current) mirror the scroll camera.',
    'Pause sky stops the only continuous animation (WCAG 2.2.2); Turn off 3D swaps the canvas for the poster at any time.',
    'The canvas ignores pointer events, so scrolling and touch always belong to the page; no scroll-jacking.',
    'The sample schedule is a real table with a caption that says the data is fictional.',
  ],
  reducedMotion: 'No scroll-driven travel and no sky animation: the scene sits in a static frame below the title, the viewpoint buttons cut the camera between the three stops (one rendered frame each, via the three-kit CameraRig) and the captions follow in normal flow.',
  performance: [
    'frameloop is "always" only while the sky plays and the canvas is on screen (StudioCanvas pauses offscreen); paused or reduced, it renders on demand when the camera moves.',
    'Terrain segments = 220 × quality density (clamped 72–220) and stars = 2,600 × density; DPR follows the quality profile. One draw call each for terrain, sky, stars and route plus three cairns.',
    'Geometries and materials are created imperatively and disposed on unmount; the ScrollTrigger, its ResizeObserver and font listener are reverted with the useGSAP scope.',
  ],
  dataNote: 'The walk schedule (dates, meeting times, lengths and places) is fictional sample data written for this demo; the landscape is generated from a seeded noise function.',
};
