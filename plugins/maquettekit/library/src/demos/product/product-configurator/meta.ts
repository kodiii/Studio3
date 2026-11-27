import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'product-configurator',
  name: 'Hollin Drover Build Sheet',
  specialty: 'product',
  summary: 'A lightweight bike configurator with no WebGL: a parametric SVG side elevation you can handle (spin the cranks and wheels, touch a part to configure it) that redraws from the frame geometry, native radio groups, a running price, URL-shareable state and a link to the 3D Studio for the case where 3D is worth it.',
  highlights: [
    'Choosing the cheaper technique on purpose: bikes are judged side-on, so a computed SVG elevation answers every question a 3D model would, with no download and no GPU budget.',
    'Hands on the drawing: drag the cranks round and the chain drives the rear wheel through a freehub (the wheel may overrun; turning it backwards drags the cranks), drag either wheel to spin it, and every part keeps the velocity it was let go with before bearing friction stops it (well within five seconds). The front hub is a dynamo: with lights fitted, the beam and tail light glow with the front wheel’s speed. “Hold to pedal” and “Spin front wheel” are the button and keyboard twins.',
    'Parts light up and lift under the pointer (signal outline, lift, soft shadow) with a caption naming them; pressing a part opens and focuses the option group that changes it, and hovering or focusing an option group lights the same part, so the drawing and the form point at each other.',
    'Every choice has a designed change on the drawing: a new paint flows down the tubes from the head tube, handlebars and fitted extras drop in on a spring while the old ones lift away, and size or tyre changes reshape the frame on a spring that carries its velocity into a quick second pick.',
    'Pen-and-ink entrance: outlines and rims draw themselves, then the paint and dimensions wash in; option cards lift with a two-layer shadow, press in and sit down when chosen.',
    'Page-owned state serialised to the URL hash (replaceState); one polite status line per change; an incompatibility handled in words (45 mm tyres remove fenders with Undo); the price rolls with the number-ticker digit-column technique.',
  ],
  technology: ['svg', 'css', 'waapi'],
  uses: [],
  adapts: ['number-ticker', 'svg-path-draw', 'press-depth-button'],
  collaborates: ['3d', 'motion-lab'],
  has3d: false,
  accessibility: [
    'Every option group is a fieldset with a legend; options are native radios (checkboxes for independent extras) whose labels carry the name, note and price, so colour is never the only signal.',
    'The drawing is role="img" with a title and a description of the current build and its key dimensions; dragging it is an enhancement: “Hold to pedal” (pointer, Space or Enter held) and “Spin front wheel” do the same from the keyboard, and every part it links to is an option group in the form.',
    'Each change is announced once through a polite status line ("Paint: Marigold. Total $1,950."); the rolling price digits and the part caption are aria-hidden duplicates of visible text.',
    'The blocked fender option stays focusable (aria-disabled) and is described by the reason plus a button that resolves the conflict.',
    'Sticky drawing on narrow screens: option inputs carry scroll-margin so a focused control is never hidden under it.',
  ],
  reducedMotion: 'No entrance, lift, drop, paint flow or geometry spring: state applies instantly and the price swaps without rolling. The wheels and cranks still turn while you drag them or hold “Pedal” (motion under your control) but stop the moment you let go; “Spin front wheel” turns it a quarter turn.',
  performance: [
    'No WebGL, no model or image downloads: the drawing is about two hundred SVG elements computed from a dozen numbers.',
    'Wheel, crank and pedal angles are written straight to rotation groups (and the chain’s dash offset) from one useRafLoop that sleeps when everything stands still; React never re-renders while they spin.',
    'The geometry spring re-renders the SVG only until the numbers settle; the paint flow is one dash-offset animation per tube on a createSequence timeline; hover lifts are transform and filter on one group.',
  ],
  dataNote: 'Hollin Cycles, the Drover, its geometry, prices and lead time are fictional sample data. The number of valid builds is computed from the option data.',
};
