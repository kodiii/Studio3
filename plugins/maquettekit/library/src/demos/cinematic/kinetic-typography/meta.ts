import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'kinetic-typography',
  name: 'Radio Haar — the night forecast',
  specialty: 'cinematic',
  summary: 'A kinetic type piece staged as a late-night shipping forecast for a fictional coast: every cue uses a different type technique, and one pause control stills them all.',
  highlights: [
    'Variable-font axis choreography: wind force drives weight, width and optical size of each sea area (wght 380–800, wdth 100–77, opsz 12–96), scrubbed by scroll; scroll velocity leans the list like a gust.',
    'Composes four recipes with the piece\'s own copy: variable-weight-wave (pointer and keyboard), scramble-decode (tuning in), split-line-reveal (sea state) and kinetic-marquee (gale warnings, mirrored to the global pause).',
    'Type on an SVG path: the area names run along a drawn coastline as a slow, pausable ticker that borrows speed from scrolling.',
    'A tuning dial needle sweeps onto the station as the hero scrolls away; a timecode gutter sticks beside each cue like a transcript.',
    'The gallery font only exposes Bricolage\'s wght axis, so the demo declares the local three-axis cut under its own family name, scoped to this page.',
  ],
  technology: ['gsap', 'css', 'svg', 'waapi'],
  uses: ['variable-weight-wave', 'scramble-decode', 'split-line-reveal', 'kinetic-marquee'],
  has3d: false,
  accessibility: [
    'One accessible copy of every animated line: the recipes expose their sentence once (aria-label or visually hidden copy), the coastline is an image with a title and a description listing the areas, and a plain list of areas follows it.',
    'A visible Pause motion toggle (aria-pressed) in the sticky bar stops the idle weight wave, the coastline ticker and the marquee (WCAG 2.2.2).',
    'The weight-wave headline is focusable and responds to arrow keys; every pointer-reactive moment has a keyboard or scroll equivalent.',
    'Wind force is stated in words in every row; the axis changes only reinforce it. Gale rows add weight and signal colour plus the word "gale".',
  ],
  reducedMotion: 'Everything is still: rows sit at their force axes without scrubbing or skew, the coastline shows one static run of names, the dial rests on the station, recipes show their final states, and the pause control is replaced by a note.',
  performance: [
    'Axis changes are confined to six short, nowrap display lines (one reflow per frame while scrubbing), driven by one scrubbed timeline; the gust uses a single quickTo on the list.',
    'The coastline ticker and recipes run on useRafLoop, so they stop offscreen, in hidden tabs and when paused.',
    'All triggers are created inside useGSAP and reverted on unmount; one ResizeObserver and a fonts-ready listener refresh them.',
  ],
};
