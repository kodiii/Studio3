import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'cinematic-landing',
  name: 'Larkwell — Opus 31',
  specialty: 'cinematic',
  summary: 'A five-beat launch page for a fictional organ builder\'s new chamber organ: a typographic hook, the room that shaped it, a pinned zoom through an arched window into the case, a playable specification and a still invitation to the first recital.',
  highlights: [
    'Five beats with a colour script: paper → the dark oak case (beat 3) → paper. The arch is the recurring motif: hero window, zoom-through, closing outline.',
    'Beat 3 is a CSS-sticky pinned scene with one scrubbed GSAP timeline: the arch mask grows from a window to full screen (a full-screen transition into the case), the façade layers dolly in and then part, with rest zones before and after.',
    'Typographic full-bleed hook in condensed capitals that is painted at first paint; its lines leave through masks as it scrolls away, and the window beside it fills with light on load.',
    'Dynamic navigation hides while reading down, returns on any upward scroll or keyboard focus, and marks the current section with aria-current.',
    'SVG animation with meaning: sound rays draw across the hall section; pulling a stop raises its rank in a drawing to scale with a person.',
  ],
  technology: ['gsap', 'css', 'svg', 'waapi'],
  uses: ['split-line-reveal'],
  has3d: false,
  accessibility: [
    'The page is a static document in beat order; every animated layer is decorative and aria-hidden, and the headline is real text in one copy.',
    'Stops are toggle buttons (aria-pressed) with visible names; a polite live summary states which stops are drawn and how many pipes speak.',
    'A skip link passes the pinned sequence; navigation links and every control are reachable by keyboard and the hidden header reappears on focus.',
    'Text over the case interior sits on a solid panel; the call to action is a real link with its own focus ring.',
  ],
  reducedMotion: 'No pinning, mask growth, parallax or line exits: the case interior is shown as a still drawing with both captions in normal flow, the header never slides, sound rays are drawn from the start, stops change without easing and the room headline appears without its word reveal.',
  performance: [
    'Pinning is position: sticky; scroll work is a handful of scrubbed timelines animating transform, opacity and one mask size.',
    'The scene is five SVG layers of plain shapes (about 60 pipes) with one gradient per layer; no filters or blur.',
    'All tweens and triggers live in one useGSAP scope and are reverted on unmount; a ResizeObserver and fonts-ready listener refresh measurements.',
  ],
};
