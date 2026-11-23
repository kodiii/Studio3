import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'scroll-narrative',
  name: 'The Long Bend — a river in five stages',
  specialty: 'cinematic',
  summary: 'An editorial scroll story about how a fictional river carves, widens and furnishes its valley: stepped text in normal flow beside a sticky survey drawing that is scrubbed from stage to stage.',
  highlights: [
    'Sticky-graphic scrollytelling: the step text stays in the normal document flow, so it is also the reduced-motion and no-script version of the story.',
    'The figure is a pure function of the stage t (0–4): meanders are a sine-generated curve whose angle grows, a neck cut-off leaves an oxbow lake, terraces and a channel scar appear — all redrawn from one scrubbed GSAP timeline with rest zones on every stage.',
    'One ScrollTrigger (window scroller) owns the timeline; React state changes only when the current stage changes. The trigger refreshes after web fonts load and whenever the demo frame changes width.',
    'A progress rail of named stage buttons (aria-current="step") jumps to each stage and moves focus to its heading; a skip link passes the whole sequence.',
    'At narrow widths the figure sticks above the text and the reading line moves below it.',
  ],
  technology: ['gsap', 'svg', 'css', 'waapi'],
  uses: ['split-line-reveal'],
  has3d: false,
  accessibility: [
    'Every stage is a section with its own heading in reading order; the drawing has one text description and a visible caption naming the current stage.',
    'Stage buttons have visible names that match their accessible names, carry aria-current and are at least 40 px tall; focus goes to the stage heading after a jump.',
    'Nothing is conveyed by motion alone: each stage has its text, a "look for" note and a caption.',
    'Text uses theme tokens; the water colour passes 4.5:1 on all three surfaces in both themes.',
  ],
  reducedMotion: 'No sticky figure and no scrubbing: each stage gets its own still drawing next to its text, the rail follows the stage in view, buttons jump without smooth scrolling and the closing title appears without its word reveal.',
  performance: [
    'Scroll work is one scrubbed timeline; per frame the painter rewrites about twenty path attributes, skipping unchanged values. No layout reads inside the loop.',
    'Geometry generation is O(n) apart from a small neck search (about 20k distance checks) and only runs while the stage changes.',
    'useGSAP with revertOnUpdate kills the trigger and timeline on unmount or reduced-motion change; the ResizeObserver and font listener are released with it.',
  ],
};
