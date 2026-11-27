import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'cinematic-landing',
  name: 'Larkwell — Opus 31',
  specialty: 'cinematic',
  summary: 'A five-beat launch page for a fictional organ builder\'s new chamber organ: a typographic hook, the room that shaped it, a pinned zoom through an arched window into the case, a playable specification and a still invitation to the first recital.',
  highlights: [
    'Five beats with a colour script: paper → the dark oak case (beat 3) → paper. The arch is the recurring motif: hero window, zoom-through, closing outline.',
    'Light through the arch: the pointer is where the west window\'s light comes from. The warm glow leans toward it, light shafts between the ranks turn with it, each pipe\'s specular band slides across its cylinder (SVG gradientTransform), and the façade layers part in depth. Scroll speed is wind: the glow swells and the shafts brighten, then breathe out.',
    'Pull a stop: drag a drawknob out against growing resistance until it clicks over its detent (the stop is drawn the moment it crosses), push it back the same way; release settles it on a spring.press token with the hand\'s velocity. A tap, Enter or Space still toggles it.',
    'The drawn rank rises pipe by pipe, tallest first, landing with a spring.pop overshoot; it retires faster, in reverse order.',
    'Beat 3 is a CSS-sticky pinned scene with one scrubbed GSAP timeline: the arch mask grows from a window to full screen, the façade layers dolly in and then part, with rest zones before and after. Pointer parallax uses the CSS translate property, so it composes with GSAP\'s transforms instead of fighting them.',
    'One light direction for the DOM too: knob faces are domed from the upper left, and every control (knobs, links, the call to action) has a contact shadow and a soft shadow falling lower right that lift on hover, collapse when pressed and spring back on release.',
  ],
  technology: ['gsap', 'css', 'svg', 'waapi'],
  uses: ['split-line-reveal'],
  adapts: ['parallax-depth-layers', 'press-depth-button'],
  has3d: false,
  accessibility: [
    'The page is a static document in beat order; every animated layer is decorative and aria-hidden, and the headline is real text in one copy.',
    'Stops are toggle buttons (aria-pressed) with visible names; dragging is an extra way in, never the only one: tap, Enter and Space toggle, and a polite live summary states which stops are drawn and how many pipes speak.',
    'Stop rows keep touch-action: pan-y, so vertical swipes scroll the page and only a sideways drag pulls a knob; pointer light listens to mouse and pen only.',
    'A skip link passes the pinned sequence; navigation links and every control are reachable by keyboard and the hidden header reappears on focus.',
    'Text over the case interior sits on a solid panel; the call to action is a real link with its own focus ring.',
  ],
  reducedMotion: 'No pinning, mask growth, parallax, pointer light, wind or line exits: the case interior is a still drawing lit from the upper left with both captions in normal flow, the header never slides, sound rays are drawn from the start, stops change and ranks appear without easing, and controls press without springs.',
  performance: [
    'Pinning is position: sticky; scroll work is a handful of scrubbed timelines animating transform, opacity and one mask size.',
    'Pointer light and wind share one rAF loop that wakes on pointer or scroll input and sleeps once values settle; per frame it writes three custom properties per scene and six gradient transforms, skipping unchanged values.',
    'The scene is SVG layers of plain shapes (about 60 pipes) with one gradient per layer; the shafts are one CSS gradient layer; no filters or blur.',
    'Knob springs run in rAF only while a released knob settles; all tweens and triggers live in one useGSAP scope, and listeners, loops, a ResizeObserver and the fonts-ready listener are released on unmount.',
  ],
};
