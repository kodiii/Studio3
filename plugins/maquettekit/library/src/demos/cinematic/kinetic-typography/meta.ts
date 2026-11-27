import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'kinetic-typography',
  name: 'Radio Haar — the night forecast',
  specialty: 'cinematic',
  summary: 'A kinetic type piece staged as a late-night shipping forecast for a fictional coast: every cue uses a different type technique, and one pause control stills them all.',
  highlights: [
    'The pointer is a desk lamp: a warm pool of light follows it across the page, and the display type casts a contact shadow and a soft shadow away from it, with a rim on its lit side (em-scaled, so the biggest type stands highest). At rest the lamp sits upper left.',
    'The tuning dial is the thing you handle: drag the needle (or press anywhere on the scale) and it follows with weight; release keeps the throw\'s velocity, friction slows it and a detent catches it on 97.4 with a spring.pop overshoot. Off-station the presenter\'s line blurs and jitters with static and the signal meter drops. It is a real slider: arrows step 0.1 MHz (stepping toward the station drops into its detent), Page Up/Down 1 MHz, Home/End the band\'s ends.',
    'Entrance: the radio tunes itself in. The needle is thrown from 89.1, slowed by the same friction and caught by the same detent as a hand-thrown needle, and the line comes into focus as it locks.',
    'Variable-font axis choreography: wind force drives weight, width and optical size of each sea area (wght 380–800, wdth 100–77, opsz 12–96), scrubbed by scroll; scroll velocity leans the list like a gust.',
    'Composes four recipes with the piece\'s own copy: variable-weight-wave (pointer and keyboard), scramble-decode (tuning in), split-line-reveal (sea state) and kinetic-marquee (gale warnings, mirrored to the global pause). Type on an SVG path: the area names run along a drawn coastline as a slow, pausable ticker that borrows speed from scrolling.',
  ],
  technology: ['gsap', 'css', 'svg', 'waapi'],
  uses: ['variable-weight-wave', 'scramble-decode', 'split-line-reveal', 'kinetic-marquee'],
  adapts: ['press-depth-button'],
  has3d: false,
  accessibility: [
    'One accessible copy of every animated line: the recipes expose their sentence once (aria-label or visually hidden copy), the coastline is an image with a title and a description listing the areas, and a plain list of areas follows it.',
    'The dial is a focusable slider named Tuning with aria-valuenow and a value text that says whether the station is clear, faint or static; the static effect is blur and jitter only, so the line keeps its colour contrast.',
    'A visible Pause motion toggle (aria-pressed) in the sticky bar stops the idle weight wave, the coastline ticker, the marquee and the static jitter (WCAG 2.2.2).',
    'The weight-wave headline is focusable and responds to arrow keys; every pointer-reactive moment has a keyboard or scroll equivalent. The dial keeps touch-action: pan-y, so vertical swipes scroll the page.',
    'Wind force is stated in words in every row; the axis changes only reinforce it. Gale rows add weight and signal colour plus the word "gale".',
  ],
  reducedMotion: 'Everything is still: the lamp stays upper left with fixed shadows, the dial rests on the station (keys and drags set it directly, with no glide or static), rows sit at their force axes without scrubbing or skew, the coastline shows one static run of names, recipes show their final states, and the pause control is replaced by a note.',
  performance: [
    'The lamp is one viewport-sized sticky layer whose gradient centre moves, plus two custom properties for the shadows; its rAF loop wakes on pointer or scroll input and sleeps once the lamp has settled.',
    'The dial runs on useRafLoop (asleep offscreen and in hidden tabs) and writes one transform, a readout and two custom properties, only when they change; static jitter is re-rolled about 20 times a second while detuned.',
    'Axis changes are confined to six short, nowrap display lines (one reflow per frame while scrubbing), driven by one scrubbed timeline; the gust uses a single quickTo on the list. All triggers are created inside useGSAP and reverted on unmount.',
  ],
};
