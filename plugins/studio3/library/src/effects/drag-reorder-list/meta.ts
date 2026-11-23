import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'drag-reorder-list',
  name: 'Drag Reorder List',
  description: 'A running order you rearrange by its drag handles: the picked-up row lifts on a token spring, its neighbours make room with layout animation (Motion Reorder) and every start time is recalculated. The handle is also a full keyboard control (Space to pick up, arrows to move, Space to drop, Escape to cancel) with live announcements.',
  category: 'gestures',
  specialties: ['product', 'data'],
  technology: ['motion', 'css'],
  interaction: ['drag', 'keyboard', 'press'],
  complexity: 3,
  intensity: 'subtle',
  applications: ['playlist or agenda ordering', 'priority and backlog lists', 'form-builder field order', 'navigation or dashboard customisation'],
  dependencies: [{ name: 'motion', version: '^14.14.0' }],
  params: [
    { key: 'lift', label: 'Lift scale', type: 'number', default: 1.03, min: 1, max: 1.08, step: 0.01 },
    { key: 'spring', label: 'Spring token', type: 'select', default: 'settle', options: ['settle', 'press', 'release', 'glide'] },
    { key: 'dragFrom', label: 'Drag from', type: 'select', default: 'handle', options: ['handle', 'row'] },
    { key: 'times', label: 'Show start times', type: 'boolean', default: true },
    { key: 'density', label: 'Density', type: 'select', default: 'comfortable', options: ['comfortable', 'compact'] },
  ],
  accessibility: [
    'Each row has a real handle button (44 px) named "Move <segment>, position n of N" and described by the keyboard instructions; aria-pressed shows when it is picked up.',
    'Space or Enter picks up and drops, Up/Down move one place, Home/End jump to the ends, Escape restores the original order and leaving the handle drops the row.',
    'An assertive live region announces pick-up, every move (with the new start time), drops, cancels and the result of pointer drags.',
    'Focus stays on the moving handle throughout; the list is an ordered list, so position is also conveyed by the list semantics.',
  ],
  reducedMotion: 'Rows swap places instantly and the picked-up row is marked by its border and shadow instead of scaling; a pointer drag still follows the pointer because that movement is user-controlled.',
  performance: [
    'Motion Reorder moves rows with transforms (layout projection); only the dragged row follows the pointer and nothing animates layout properties.',
    'Start times are derived from the order in one pass per change; no timers or observers.',
    'Per-row drag controls start the gesture from the handle only, so text selection and scrolling elsewhere stay native.',
  ],
  preview: { height: 620 },
};
