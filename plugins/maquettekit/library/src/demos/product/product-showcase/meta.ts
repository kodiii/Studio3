import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'product-showcase',
  name: 'Pulse Product Page',
  specialty: 'product',
  summary: 'A storytelling product page for the fictional Pulse speaker that is complete as a photo page and offers real-time 3D only on request: a render lit by the pointer, a loupe you drag over the product, colourways that wipe in, numbered details in both modes, chapters that dolly and zoom on each detail, and a specification table.',
  highlights: [
    'Poster first: the studio render is the hero and the page never waits for WebGL; “Explore in 3D” lazy-loads a separate chunk with StudioCanvas, the device-appropriate model build, orbit with limits, named camera presets and tracked hotspots, and brings the whole stage into view.',
    'The pointer is the key light: the render leans toward it (≤ 4°, one spring per channel), a specular sheen masked to the product’s own silhouette sits under it, and the two-layer floor shadow (tight contact + wide ambient) slides away from it. At rest the light sits top-left.',
    'Hands on the photo: a loupe rests in the corner of the stage. Drag it over the speaker for a 2× look; it keeps its throw, is pulled toward nearby details and settles on the closest one, whose marker rides its rim while the detail card springs up. Pressing it steps through the details, arrow keys move it, Escape docks it.',
    'Colourways change with a wipe in the new colour: the newly tinted render and its paper sweep in from the left behind a band of the new accent; one picker drives the 2D tint and the 3D materials alike.',
    'Entrance in one sequence: the headline rises word by word, the speaker settles onto its shadow on a spring, the numbered details pop in; everything is usable from the first frame. Chapters dolly in on their detail once, then zoom by at most 10 % with the scroll.',
    'Every control has depth: buttons, swatches, markers and the loupe lift with a two-layer shadow on hover and compress on press, released on a spring sampled with springToLinear().',
  ],
  technology: ['r3f', 'three', 'canvas2d', 'css', 'waapi'],
  uses: [],
  adapts: ['tilt-parallax-card', 'press-depth-button', 'split-line-reveal'],
  collaborates: ['3d', 'motion-lab'],
  has3d: true,
  accessibility: [
    'Colourways are a radio group with written names and notes; the price change and colourway are announced once in a polite status line.',
    'Photo markers are buttons named “Detail n: …” with aria-expanded; their description appears in a polite live region. In 3D the kit’s hotspot buttons and the canvas’s own keyboard orbit take over.',
    'The loupe is a button with a written hint: Enter or Space steps through the details (docked → 1 → 2 → 3 → docked), arrow keys move it (Shift for larger steps), Escape docks it; its name says which detail it is on. The markers are its twin.',
    'Every 3D action has a DOM button (camera views, zoom in and out, reset, back to photo); load progress and readiness are announced as text.',
    'Without WebGL 2 the 3D button is replaced by a sentence saying why, and the photo stage is the marked fallback; every detail, the loupe and the specification remain.',
    'Image alt text says when the photo is a browser-tinted render rather than a separate photograph; the headline keeps one accessible label while its words animate.',
  ],
  reducedMotion: 'No tilt, moving light, entrance or scroll zoom; colourways cross-fade in 160 ms instead of wiping; the loupe and markers jump to their places without springs or throw (the loupe still moves under the user’s control); chapters show their close-up immediately and the 3D camera cuts between presets.',
  performance: [
    'Nothing 3D is downloaded until the visitor asks: three.js, R3F and the 1.0–2.0 MB model (low-power, mobile or desktop build by device) arrive with the button press.',
    'The tinted posters are computed once in an idle callback from the one 66 KB render and cached as object URLs (revoked on unmount).',
    'Light, tilt and loupe springs run on useRafLoop loops that sleep at rest and pause offscreen; they write custom properties and transforms only. Chapter zoom reads scroll progress in rAF and writes one custom property.',
    'The 3D viewer composites in its own render surface (will-change: filter), so a canvas partly under the sticky gallery header is drawn whole; one canvas at most, render-on-demand, disposed with the viewer when returning to the photo.',
  ],
  dataNote: 'Pulse, its maker, prices and most specifications are fictional sample content; the size is measured from the generated 3D model and the tinted colourway photos are computed from its single studio render.',
};
