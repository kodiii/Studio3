import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'motion-studio',
  name: 'Lead & Lag — motion studio',
  specialty: 'cinematic',
  summary: 'The one-page site of a fictional two-person motion studio, where the page is the portfolio: a glass loupe you throw across the manifesto on a light table, one lamp that lights the DOM and the WebGL glass alike, a cursor that reads the page, Lottie controls, a reel with a dancing Rive mascot and a Rive star rating.',
  highlights: [
    'Built to the Immersive craft floor. Signature move, "thrown, then landed": whatever you move keeps your hand\'s velocity (spring.release), stretches a little along its travel and lands with a settle and a squash while its shadow tightens. The loupe, the archive film, the cursor ring and the reel\'s ball all move this way; even the manifesto\'s full stop is a ball that bounced down the words, drawn as onion-skin frames that squash on each contact and stretch in flight.',
    'The hero is the liquid-glass-lens recipe as a loupe on a light table: drag or throw it over "Nothing stops dead." The sheet under the glass (12-field guide, peg holes, an easing graph, a spring curve, a spacing chart and a timeline that plot the page\'s real motion tokens) is drawn through the lens\'s draw callback in the page\'s own palette tokens, and redrawn when the palette changes.',
    'One lamp for DOM and canvas: at rest it hangs at the upper left, 38° up, the lens\'s own resting light; on fine pointers the visitor carries it. Each lit element gets the light\'s direction (--lx, --ly) from one rAF loop that sleeps when settled, so card, button, screen and rating-band shadows swing away from the pointer while the glass\'s highlight and shadow follow the same pointer in WebGL.',
    'The cursor-follower recipe scoped to the whole page: a "View" disc over case studies, "Drag" over the archive film, "Play"/"Pause" over the reel screen, a magnet around the calls to action and round buttons, and a caret that lands between letters in paragraphs; it steps aside over the glass and the stars.',
    'Lottie controls from the recipe\'s icon data: sun ⇄ moon switches a local night palette for the whole page, which spreads from the switch as a circle (a View Transition: the old page a still snapshot, the new one live underneath, the glass already in its night look and the sheet redrawn); the menu icon opens the narrow-screen menu, hearts save case studies to a shortlist shown under Contact, and play ⇄ pause runs the reel.',
    'Two Rive state machines through RiveCanvas: Birb (birb.riv) looks up when the pointer comes in above its head, dances while the reel plays, and has Pause, Dance and Look up controls; "How did this page feel?" is rating_animation.riv under a native radio group, recoloured from the signal token with a luminosity blend.',
    'Case cards lean toward the pointer with mass by size (the feature card leans 4° on spring.glide, the others 7° on spring.settle), lift toward the lamp, press within a frame and pop back; the hovered card plays its still. "View" flies the artwork out of the card into a modal case sheet (FLIP on spring.glide) and back, faster, on close.',
    'Alive between inputs: scroll speed makes the "Lag" in the wordmark lag behind in onion-skin ghosts and skews the clients marquee (kinetic-marquee); the process playhead follows the page\'s own scroll through four keys, with no pinning, and each key it passes draws the studio\'s ball at that stage: the brief, Noor\'s key poses, Teo\'s inbetweens, the shipped curve.',
  ],
  technology: ['r3f', 'three', 'glsl', 'canvas2d', 'lottie', 'rive', 'waapi', 'view-transitions', 'css', 'svg'],
  uses: ['cursor-follower', 'liquid-glass-lens', 'lottie-micro-interactions', 'rive-state-machine', 'kinetic-marquee', 'split-line-reveal'],
  adapts: ['tilt-parallax-card', 'press-depth-button', 'spotlight-border-card', 'expanding-card-detail'],
  collaborates: ['3d', 'motion-lab'],
  has3d: true,
  accessibility: [
    'Everything is reachable in reading order without the spectacle: the manifesto is a real heading, the canvas is labelled and described, every pointer interaction has a keyboard twin (the loupe moves with the arrow keys, Shift for bigger steps, Home to centre, plus a Centre button; the archive scrolls with the arrows; the reel has a labelled slider; the stars are native radios).',
    'All controls are real buttons, links or inputs with visible focus rings and targets of at least 44 px; Lottie toggles expose aria-pressed (Night palette, Save, Play reel) or aria-expanded (Menu); state never relies on colour or motion alone.',
    'Anything that moves by itself for more than five seconds can be paused: the reel only plays after Play, the marquee has Pause, Birb\'s idle loop has Pause; the entrance lasts under a second, never blocks input, and finishes at once on the first key, click or wheel.',
    'The custom cursor is decoration on fine pointers only; the native cursor stays visible and the follower steps aside for keyboard use.',
    'The case sheet is a native modal dialog (Escape or Close returns focus to the card); saves, copies, ratings and reel state are announced in polite live regions.',
    'Both palettes were set for WCAG AA text contrast, including the always-dark archive and screening room; the studio, its people, clients, work and address are fictional and labelled as such.',
  ],
  reducedMotion: 'No entrance, tilt, lift, lamp tracking, wordmark lag, card stills, playhead or custom cursor; the night palette switches at once, the process drawings are all drawn, the case sheet opens and closes with a 160 ms fade, the loupe follows the hand directly with no momentum or light motion, the archive stops where you let go, the marquee is static and Lottie icons jump to their end frames under a 160 ms cross-fade. Birb holds a still frame and the stars jump to their final frames. The reel and Birb\'s Dance and Look up are motion as content behind explicit controls: they still play when pressed, with shots changing by 160 ms cross-fades instead of travelling.',
  performance: [
    'One WebGL canvas (the loupe), in a lazily imported chunk with three.js, mounted by StudioCanvas when near view and rendered on demand only while the glass or its light moves; an SVG poster of the same sheet paints first and is the no-WebGL fallback under the recipe\'s CSS glass.',
    'The lottie-web light player and the Rive runtime and WASM load lazily from the page\'s own origin; Birb and the rating mount only when they come within 500 px of the viewport, and Rive stops drawing offscreen.',
    'Every loop sleeps when settled: the lamp, card springs, wordmark lag, archive glide and cursor follower run only while something moves; the reel is one Web Animations timeline whose timecode is written to a text node per frame without React renders.',
    'Motion is transform and opacity, with paint-only shadows on a handful of visible lit elements; the shadow layers under cards are pre-blurred and translated, and the type shot animates one glyph\'s weight and width.',
  ],
};
