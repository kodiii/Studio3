import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'saas-landing',
  name: 'Tarn Landing Page',
  specialty: 'product',
  summary: 'A conversion-focused landing page for a fictional webhook inbox: a split hero whose product view is a working DOM inbox (replay the failed delivery), an interactive capture → inspect → replay walkthrough, a differentiator argued with a comparison table, honest pricing with an animated billing toggle, and an FAQ that answers the uncomfortable questions.',
  highlights: [
    'Claim, clarifier, product view, action: “Replay yesterday’s webhooks against today’s code.” passes the competitor test; the clarifier names the category and audience; the hero product is real DOM UI that bleeds off the edge and can be used (Replay turns the 500 into a simulated 200).',
    'Headline entrance composed from the split-line-reveal recipe (the one orchestrated motion above the fold); everything else responds to input.',
    'Sections ordered by the visitor’s questions: demonstration → differentiator (a semantic table of what a provider re-send changes versus a replay) → ranked supporting capabilities as text, not cards → pricing → objections → the same first step again.',
    'One morphing indicator, measured and moved with a CSS transform, drives the scroll-spy nav, the walkthrough tabs and the billing toggle; prices roll with the number-ticker digit-column technique and the change is announced once.',
    'Pricing states the complete price, the unit, overage terms, trial behaviour and cancellation; one plan is recommended with a reason in words, and the saving (“2 months free”) is computed from the plan prices.',
    'No fabricated proof: no logos, testimonials or user counts; every URL uses the reserved .example domain and every figure is labelled sample.',
  ],
  technology: ['waapi', 'css', 'svg'],
  uses: ['split-line-reveal'],
  collaborates: ['motion-lab'],
  has3d: false,
  accessibility: [
    'Sticky section nav with aria-current, a disclosure menu on narrow screens (Esc closes, focus returns), and in-page links that move focus to the target heading and keep the URL linkable.',
    'The walkthrough is an ARIA tablist with roving tabindex and arrow keys; the billing period is a labelled radio group; the FAQ uses headings with aria-expanded buttons, arrow keys between questions and regions labelled by their question.',
    'Status codes are text (200/500 plus “OK”/“error” for assistive technology), never colour alone; the comparison table says “changed” and “same” in words.',
    'Production replays require a second, explicit confirmation announced as an alert (an irreversible action gets a review step).',
    'The rolling price digits are aria-hidden; one polite status line reports the new billing period and Team price.',
  ],
  reducedMotion: 'The headline appears without the line reveal, sections are visible immediately, indicators jump instead of sliding, prices swap without rolling and FAQ answers open instantly.',
  performance: [
    'No animation library: WAAPI for the headline and price digits, CSS transitions for indicators, reveals and the accordion (grid rows 0fr → 1fr, no height measuring).',
    'The indicator is measured only when the selection or its container size changes (ResizeObserver), then moved with a transform.',
    'All imagery is the product’s own interface in DOM; nothing is downloaded beyond the page’s code.',
  ],
  dataNote: 'Tarn is fictional. Payloads, delivery logs, URLs (.example), plans and prices are sample data; replays and sign-ups are simulated and nothing leaves the page.',
};
