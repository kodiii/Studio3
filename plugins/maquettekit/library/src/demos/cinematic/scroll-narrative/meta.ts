import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'scroll-narrative',
  name: 'The Long Bend — a river in five stages',
  specialty: 'cinematic',
  summary: 'An editorial scroll story about how a fictional river carves, widens and furnishes its valley: stepped text in normal flow beside a sticky survey drawing that is scrubbed from stage to stage.',
  highlights: [
    'Sticky-graphic scrollytelling: the step text stays in the normal document flow, so it is also the reduced-motion and no-script version of the story. The figure is a pure function of the stage t (0–4), redrawn from one scrubbed GSAP timeline with rest zones on every stage.',
    'Handle the figure: the section line A–A′ can be dragged (or the plan pressed to place it) and the inset redraws the valley\'s cross-section along it — the channel crossings (three across a loop at stage V), the oxbow lake as still water, the terraces. It follows the hand on a spring.press token, a flick keeps its velocity and glides to a soft stop, and the grip is a keyboard slider (arrows, Page Up/Down, Home/End).',
    'An orchestrated entrance with a recurring move: the surveyor inks the title hill from its summit outward (stagger.base) while the river draws itself under "Bend"; the headline is there from the first paint.',
    'Relief under a lamp: the pointer tilts the drawings like a relief model — every contour shifts by its own height (higher ground further, the river not at all); the plate casts a two-layer shadow from the upper-left light.',
    'The river runs while you read: pale flecks travel downstream along the channel at a speed set by the scroll velocity, and stop when the reader does.',
    'A progress rail of named stage buttons (aria-current="step") jumps to each stage and moves focus to its heading; a skip link passes the whole sequence. At narrow widths the figure sticks above the text and the reading line moves below it.',
  ],
  technology: ['gsap', 'svg', 'css', 'waapi'],
  uses: ['split-line-reveal'],
  adapts: ['svg-path-draw', 'parallax-depth-layers', 'press-depth-button'],
  has3d: false,
  accessibility: [
    'Every stage is a section with its own heading in reading order; the drawing has one text description and a visible caption naming the current stage.',
    'The section line\'s grip is a focusable slider (aria-valuenow 0–100) whose value text says what the line crosses ("crosses the river twice and the oxbow lake"); the inset label shows the same.',
    'On touch the plan keeps touch-action: pan-y, so vertical swipes scroll the page; only the 44 px grip drags, and a tap on the plan places the line.',
    'Stage buttons have visible names that match their accessible names, carry aria-current and are at least 40 px tall; focus goes to the stage heading after a jump. Nothing is conveyed by motion alone.',
    'Text uses theme tokens; the water colour passes 4.5:1 on all three surfaces in both themes.',
  ],
  reducedMotion: 'No sticky figure, scrubbing, entrance, relief or current: each stage gets its own still plate next to its text (its section line still moves, set directly by key or drag with no glide), the rail follows the stage in view, buttons jump without smooth scrolling and the closing title appears without its word reveal.',
  performance: [
    'Scroll work is one scrubbed timeline; per frame the painter rewrites about twenty path attributes, skipping unchanged values. Moving the section line recomputes only the cross-section (O(n) crossings on cached plan points) and rewrites eight attributes.',
    'The section spring and the current run on useRafLoop (asleep offscreen and in hidden tabs); the relief loop wakes on pointer movement and sleeps once settled; the entrance is one createSequence cancelled on unmount.',
    'useGSAP with revertOnUpdate kills the trigger and timeline on unmount or reduced-motion change; ResizeObservers and the font listener are released with it.',
  ],
};
