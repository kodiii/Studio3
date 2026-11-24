import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'swipe-card-stack',
  name: 'Swipe Card Stack',
  description: 'A shortlist deck you sort by flinging cards: the top card follows the pointer, tilts with the drag and is dismissed by distance or by release velocity, while the card beneath rises in step with the drag. Skip, Save and Undo buttons and the arrow keys do everything a swipe does.',
  category: 'gestures',
  specialties: ['social', 'product'],
  technology: ['motion', 'css'],
  interaction: ['drag', 'press', 'keyboard'],
  complexity: 3,
  intensity: 'bold',
  applications: ['shortlist or wish-list triage', 'onboarding preference picker', 'moderation or review queue', 'flashcards'],
  dependencies: [{ name: 'motion', version: '^14.14.0' }],
  params: [
    { key: 'depth', label: 'Cards behind', type: 'number', default: 2, min: 1, max: 4, step: 1 },
    { key: 'threshold', label: 'Distance to dismiss', type: 'number', default: 110, min: 60, max: 200, step: 5, unit: 'px' },
    { key: 'velocity', label: 'Flick velocity', type: 'number', default: 600, min: 200, max: 1500, step: 50, unit: 'px/s' },
    { key: 'rotation', label: 'Max tilt', type: 'number', default: 12, min: 0, max: 25, step: 1, unit: '°' },
    { key: 'spring', label: 'Spring token', type: 'select', default: 'release', options: ['release', 'settle', 'glide', 'pop'] },
  ],
  accessibility: [
    'Every swipe has a single-pointer, non-dragging equivalent (WCAG 2.5.1 / 2.5.7): visible Skip, Save and Undo buttons of at least 44 px.',
    'Left and Right arrows skip and save, Backspace or Z undoes, whenever focus is inside the deck; the top card is focusable and described by those instructions.',
    'A polite live region announces each decision and how many cards remain; when a focused card leaves, focus moves to the next card (or to Start over).',
    'Save and Skip are shown as words on the card and in the buttons, not by colour or direction alone; the stamps are decorative.',
  ],
  reducedMotion: 'Cards no longer fly, tilt or rise: a decided card fades out in 160 ms and the next one is simply there. Dragging still moves the card under the finger because that movement is directly user-controlled.',
  performance: [
    'Drag, tilt, stamp opacity and the rise of the next card are motion values derived from one x value, so dragging causes no React renders.',
    'Only the top card is draggable and only the visible slice of the deck is mounted.',
    'Exit animations are springs seeded with the release velocity, so a flick carries its speed.',
  ],
  preview: { height: 600 },
};
