import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'saas-landing',
  name: 'Tarn Landing Page',
  specialty: 'product',
  summary: 'A conversion-focused landing page for a fictional webhook inbox: a split hero whose product view is a working, lit DOM inbox (scrub yesterday’s deliveries on a timeline, then replay the failed one and watch it travel to your endpoint), an interactive capture → inspect → replay walkthrough, a differentiator argued with a comparison table, honest pricing with an animated billing toggle, and an FAQ that answers the uncomfortable questions.',
  highlights: [
    'Signature move, the replay: the stored payload leaves its row along a path drawn as an arc (svg-path-draw technique), travels it to the endpoint chip (offset-path), and on arrival the 500 chips squash and spring back as 200 (morph-submit-button pattern) with one small burst; the path retracts and the history keeps the original 500.',
    'Hands on the product: yesterday is a strip you can scrub (brush-linked-range technique). Ticks sit at each delivery’s time of day (height = response time, colour = status); drag the playhead and the delivery under it is selected live, throw it and it keeps its velocity before settling on the nearest delivery. The list rows are its twin (the playhead glides to the row you pick, the row highlight slides with it) and the arrow keys step between deliveries.',
    'The hero window is a lit object: it leans toward the pointer (≤ 2.6°, one token spring per channel, eased off while a button is held), a highlight and a lit border ring follow the pointer, it lifts on hover over a two-layer shadow (tight contact + wide ambient, light from the top-left), and it drifts a little slower than the page as you scroll.',
    'One orchestrated entrance above the fold: the headline rises word by word (split-line-reveal), the window settles in as its shadow spreads, the timeline’s ticks grow and the playhead glides to the failed delivery. Everything is interactive from the first frame.',
    'Every CTA has depth (hover lifts, press compresses within a frame, release springs back on a springToLinear() curve); the hero CTA alone is magnetic on fine pointers.',
    'Claim, clarifier, product view, action: the headline passes the competitor test, sections are ordered by the visitor’s questions, pricing states the complete price, overage, trial and cancellation, and nothing is fabricated: no logos, testimonials or user counts; every URL uses the reserved .example domain and every figure is labelled sample.',
  ],
  technology: ['waapi', 'css', 'svg'],
  uses: ['split-line-reveal'],
  adapts: ['tilt-parallax-card', 'spotlight-border-card', 'magnetic-button', 'svg-path-draw', 'morph-submit-button', 'brush-linked-range', 'press-depth-button', 'number-ticker', 'accordion-height-auto'],
  collaborates: ['motion-lab'],
  has3d: false,
  accessibility: [
    'The timeline playhead is a role="slider" with the delivery as its value text (“14:41:07, invoice.paid, 500 error”); Arrow keys, Page Up/Down, Home and End step between deliveries, and the list buttons (aria-pressed) select the same deliveries.',
    'Sticky section nav with aria-current, a disclosure menu on narrow screens (Esc closes, focus returns), and in-page links that move focus to the target heading and keep the URL linkable.',
    'The walkthrough is an ARIA tablist with roving tabindex and arrow keys; the billing period is a labelled radio group; the FAQ uses headings with aria-expanded buttons, arrow keys between questions and regions labelled by their question.',
    'Status codes are text (200/500 plus “OK”/“error” for assistive technology), never colour alone; replay progress and its result are announced in a polite status line; the comparison table says “changed” and “same” in words.',
    'Production replays require a second, explicit confirmation announced as an alert (an irreversible action gets a review step).',
    'The rolling price digits, the travelling payload, the path and the burst are aria-hidden; one polite status line reports the new billing period and Team price.',
  ],
  reducedMotion: 'No lean, moving light, scroll drift, magnetic pull or entrance: the headline appears without the reveal; the replay swaps the status after a short wait without the path, payload or burst; the playhead and row highlight jump instead of gliding (dragging still moves the playhead under the pointer); prices swap without rolling; indicators jump and FAQ answers open instantly.',
  performance: [
    'No animation library: WAAPI for the headline, replay and price digits, CSS transitions for presses, indicators, reveals and the accordion (grid rows 0fr → 1fr).',
    'The hero light, the playhead and the magnet are springs on useRafLoop loops that start on input and sleep at rest; they write custom properties, transform or translate only, and pause offscreen.',
    'The replay path and payload use one SVG path (pathLength = 1, no measuring) and offset-path, created per replay and released on unmount; the indicator and row highlight are measured only when the selection or container size changes.',
    'Everything is the product’s own interface in DOM: nothing is downloaded beyond the page’s code, and the demo ships no dependencies.',
  ],
  dataNote: 'Tarn is fictional. Payloads, delivery logs, URLs (.example), plans and prices are sample data; replays and sign-ups are simulated and nothing leaves the page.',
};
