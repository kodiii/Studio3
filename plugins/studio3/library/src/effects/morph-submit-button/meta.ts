import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'morph-submit-button',
  name: 'Morph Submit Button',
  description: 'A submit button that tells the whole story of a request: the pill collapses into a circle whose progress arc fills ever more slowly while waiting, then either completes and draws a check or shakes twice with an exclamation mark before reopening as "Try again". Every step starts from the current on-screen state, so resets and re-submits never jump.',
  category: 'buttons',
  specialties: ['product'],
  technology: ['waapi', 'svg', 'css'],
  interaction: ['press', 'keyboard', 'time'],
  complexity: 3,
  intensity: 'moderate',
  applications: ['waitlist or newsletter sign-up', 'checkout "Pay" button', 'settings "Save" with server round trip', 'contact form submit'],
  dependencies: [],
  params: [
    { key: 'outcome', label: 'Simulated outcome', type: 'select', default: 'alternate', options: ['alternate', 'success', 'error'] },
    { key: 'latency', label: 'Simulated latency', type: 'number', default: 1600, min: 400, max: 4000, step: 100, unit: 'ms' },
    { key: 'morph', label: 'Morph duration', type: 'number', default: 420, min: 200, max: 900, step: 20, unit: 'ms' },
    { key: 'shake', label: 'Shake on error', type: 'boolean', default: true },
    { key: 'label', label: 'Button label', type: 'text', default: 'Join waitlist', maxLength: 22 },
  ],
  accessibility: [
    'A real form with a labelled email field; the submit button keeps focus through every state and is aria-busy while the request runs.',
    'Busy and finished states use aria-disabled (not disabled), so focus is never dropped; the button name always matches its state ("Sending…", "On the list", "Try again").',
    'One polite live region announces sending, success and failure in words, with an icon as a second cue; colour is never the only signal.',
    'Validation marks the field aria-invalid and points to the message with aria-describedby; Reset demo works from the keyboard at any moment.',
  ],
  reducedMotion: 'The button keeps its pill shape: labels and colours change in place (no morph, arc, check drawing or shake) and the status text carries progress.',
  performance: [
    'The width morph runs on one button inside a fixed-width slot, so only that box is laid out per frame; ring, check and shake are stroke/transform/opacity animations.',
    'Each phase reads the current computed width, opacity or dash offset before animating, so interrupted runs continue from where they are instead of restarting.',
    'All animations and timers are tracked in one set and cancelled on reset, on resubmission and on unmount.',
  ],
  preview: { height: 440 },
};
