import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'product-configurator',
  name: 'Hollin Drover Build Sheet',
  specialty: 'product',
  summary: 'A lightweight bike configurator with no WebGL: a parametric SVG side elevation that redraws from the frame geometry, native radio groups, a running price, URL-shareable state and a link to the 3D Studio for the case where 3D is worth it.',
  highlights: [
    'Choosing the cheaper technique on purpose: bikes are judged side-on, so a computed SVG elevation answers every question a 3D model would, with no download and no GPU budget.',
    'The drawing is generated from a geometry table (stack, reach, angles, tyre width): changing size tweens the frame itself and its live dimension lines instead of swapping pictures.',
    'Parts, paints and fitted extras change with cross-fades of layered SVG groups; paint is a colour transition on the tube strokes.',
    'Page-owned state serialised to the URL hash (replaceState), restored on load and on hashchange; one polite status line per change; build code and price recomputed in the same frame.',
    'An incompatibility handled in words: 45 mm tyres remove fenders with a visible notice and Undo, and the blocked option explains itself and offers a one-press fix.',
    'Price total rolls with an odometer (the number-ticker recipe’s digit-column technique, re-implemented to accept any value because the recipe only plays its own preset series).',
  ],
  technology: ['svg', 'css', 'waapi'],
  uses: [],
  collaborates: ['3d', 'motion-lab'],
  has3d: false,
  accessibility: [
    'Every option group is a fieldset with a legend; options are native radios (checkboxes for independent extras) whose labels carry the name, note and price, so colour is never the only signal.',
    'The drawing is role="img" with a title and a description of the current build and its key dimensions; the overlaid dimension labels are aria-hidden duplicates of a visible geometry table.',
    'Each change is announced once through a polite status line ("Paint: Marigold. Total $1,950."); the rolling price digits are aria-hidden with the plain value in text.',
    'The blocked fender option stays focusable (aria-disabled) and is described by the reason plus a button that resolves the conflict.',
    'Sticky drawing on narrow screens: option inputs carry scroll-margin so a focused control is never hidden under it.',
  ],
  reducedMotion: 'The geometry tween, part cross-fades and paint transitions are skipped (state applies instantly); the price swaps without rolling.',
  performance: [
    'No WebGL, no model or image downloads: the drawing is about two hundred SVG elements computed from a dozen numbers.',
    'The size tween re-renders the SVG for 360 ms through one requestAnimationFrame loop that is cancelled on retarget or unmount.',
    'Cross-fades animate opacity and transform only; spokes and dimension lines use non-scaling strokes so they stay crisp at every width.',
  ],
  dataNote: 'Hollin Cycles, the Drover, its geometry, prices and lead time are fictional sample data. The number of valid builds is computed from the option data.',
};
