import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'immersive-3d-hero',
  name: 'Kelda Ridge — night walks',
  specialty: 'cinematic',
  summary: 'An immersive hero for a fictional guided night walk: one procedural WebGL landscape drawn as contour lines, a dusk-to-aurora sky and layered type, with the page\'s scroll carrying the camera from the lake, along the ridge and up to the sky before handing over to plain content.',
  highlights: [
    'A colour script driven by scroll: the camera leaves the lake at dusk (afterglow behind the far fells), the stars come out along the ridge, and the aurora reaches full strength at the summit. The stage is always night, in both gallery themes, so the climax reads everywhere.',
    'Aurora curtains with folds: a sinuous lower edge, pleats that glow where the ribbon turns edge-on, shimmering vertical rays and violet tops. Scrolling fast flares them (scroll velocity → brightness, attack fast, decay slow, soft-shouldered so nothing clips).',
    'One light from the north sky: it rims north-facing slopes with aurora green, tints the lake\'s reflection, and in the DOM tints the top edges of the caption panels and controls while every shadow falls below.',
    'Hands on the scene: the pointer aims a warm head-torch at the ground (a ray marched against the height field, lit in the terrain shader with a cone, falloff and facing); the camera sways ±1.5° with it and the layered title moves in depth with the sway.',
    'Horizontal drag looks around ±20° with a rubber band past the limit; release keeps the throw\'s velocity and a spring.release token brings the view home. Look left / Look right buttons are the keyboard twin (a press glances, holding keeps looking).',
    'One persistent StudioCanvas behind four DOM slides: the page owns scroll progress (one ScrollTrigger) and the scene damps toward it, requesting frames only until camera, look, torch and flare have settled. The SVG poster in the same palette paints first and cross-fades into the live scene.',
  ],
  technology: ['r3f', 'three', 'glsl', 'gsap', 'css', 'svg'],
  uses: ['split-line-reveal'],
  adapts: ['shader-aurora-plane', 'press-depth-button'],
  collaborates: ['3d'],
  has3d: true,
  accessibility: [
    'The canvas is labelled and described (including the torch and the look-around); every chapter is DOM text on a solid panel in reading order, and the viewpoint buttons (aria-current) mirror the scroll camera.',
    'Night-stage text uses fixed light-on-dark tokens checked against the brightest sky state; the hero copy sits on a scrim and the captions on 86 %-opaque panels.',
    'The canvas ignores pointer events; the drag listens on the page with touch-action: pan-y pinch-zoom and only claims a pointer once the movement is clearly horizontal, so vertical swipes, the wheel and pinch zoom stay native.',
    'Look left and Look right are real buttons (press glances, hold Space or Enter to keep looking); Pause sky stops the only continuous animation (WCAG 2.2.2) and Turn off 3D swaps the canvas for the poster at any time.',
    'The sample schedule is a real table with a caption that says the data is fictional.',
  ],
  reducedMotion: 'No scroll-driven travel, entrance, sway, look-around or sky animation: the scene sits in a framed still below the title, the viewpoint buttons cut the camera between the three stops (and the colour script with it), the captions follow in normal flow and buttons change state without springs. The head-torch still answers the pointer, as light only.',
  performance: [
    'frameloop is "always" only while the sky plays and the canvas is on screen (StudioCanvas pauses offscreen); paused or reduced it renders on demand, and pointer, drag and scroll input request frames until things settle.',
    'Terrain segments = 220 × quality density (clamped 72–220), stars = 2,600 × density; nine draw calls in all (sky, stars, far-fells ring, terrain, route, route halo, three cairns). The torch is one CPU ray march per rendered frame.',
    'Geometries and materials are created imperatively and disposed on unmount; pointer listeners are removed on unmount; the ScrollTrigger, its ResizeObserver and font listener are reverted with the useGSAP scope.',
  ],
  dataNote: 'The walk schedule (dates, meeting times, lengths and places) is fictional sample data written for this demo; the landscape is generated from a seeded noise function.',
};
