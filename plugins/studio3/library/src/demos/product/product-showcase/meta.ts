import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'product-showcase',
  name: 'Pulse Product Page',
  specialty: 'product',
  summary: 'A storytelling product page for the fictional Pulse speaker that is complete as a photo page and offers real-time 3D only on request: a colourway picker that recolours the 2D render and the 3D materials alike, numbered details in both modes, chapters that dolly in on each detail, and a specification table.',
  highlights: [
    'Poster first: the studio render is the hero and the page never waits for WebGL; “Explore in 3D” lazy-loads a separate chunk with StudioCanvas, the device-appropriate model build from the asset manifest, orbit with limits, named camera presets and tracked hotspots.',
    'One colourway picker for both modes: in 3D it drives PartController material overrides (the same values as the 3D Studio’s configurator); in 2D the single render is tinted in the browser, so four colourways cost no extra images.',
    'The 2D tint isolates the hardware by hue and the shell by masks derived from the image itself (the grille’s convex hull, the driver disc, the strap’s column runs and stitching), then shades in linear light so highlights survive.',
    'Details work in both modes: numbered DOM markers over the photo, the three-kit HotspotLayer over the model, the same data and descriptions; choosing one in 3D moves the camera to a preset that shows it.',
    'Chapters open on the whole product and dolly in on their detail as they enter the viewport (a reveal that explains where the part is), then a semantic specification table that marks which values are measured from the model.',
    'The stage, chapter frames and closing band take the colourway’s own paper tint, defined per theme so text contrast holds in light and dark.',
  ],
  technology: ['r3f', 'three', 'canvas2d', 'css'],
  uses: [],
  collaborates: ['3d'],
  has3d: true,
  accessibility: [
    'Colourways are a radio group with written names and notes; the price change and colourway are announced once in a polite status line.',
    'Photo markers are buttons named “Detail n: …” with aria-expanded; their description appears in a polite live region. In 3D the kit’s hotspot buttons and the canvas’s own keyboard orbit take over.',
    'Every 3D action has a DOM button (camera views, zoom in and out, reset, back to photo); load progress and readiness are announced as text.',
    'Without WebGL 2 the 3D button is replaced by a sentence saying why, and the photo stage is the marked fallback; every detail and the specification remain.',
    'Image alt text says when the photo is a browser-tinted render rather than a separate photograph.',
  ],
  reducedMotion: 'Chapters show their close-up immediately (no dolly or text rise), the poster swaps colourway without a cross-fade, and the 3D camera cuts between presets instead of travelling.',
  performance: [
    'Nothing 3D is downloaded until the visitor asks: three.js, R3F and the 1.0–2.0 MB model (low-power, mobile or desktop build by device) arrive with the button press.',
    'The tinted posters are computed once in an idle callback from the one 66 KB render and cached as object URLs (revoked on unmount).',
    'One canvas at most, render-on-demand, disposed with the viewer when returning to the photo.',
  ],
  dataNote: 'Pulse, its maker, prices and most specifications are fictional sample content; the size is measured from the generated 3D model and the tinted colourway photos are computed from its single studio render.',
};
