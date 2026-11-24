import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'press-depth-button',
  name: 'Press Depth Button',
  description: 'Keycap buttons with real layered depth: the face sits on a visible side band over a soft contact shadow. Pressing drives the face down along Z while the shadow collapses; letting go springs it back on a CSS linear() curve sampled from a motion-token spring. Busy keys stay half-pressed, disabled keys sink flush and rise when they unlock.',
  category: 'buttons',
  specialties: ['product'],
  technology: ['css'],
  interaction: ['press', 'keyboard'],
  complexity: 2,
  intensity: 'moderate',
  applications: ['primary action on a device-like control panel', 'checkout or "print / export" key', 'game or kiosk interfaces', 'onboarding call to action'],
  dependencies: [],
  params: [
    { key: 'depth', label: 'Key depth', type: 'number', default: 8, min: 2, max: 14, step: 1, unit: 'px' },
    { key: 'travel', label: 'Press travel', type: 'number', default: 85, min: 40, max: 100, step: 5, unit: '%' },
    { key: 'spring', label: 'Release spring', type: 'select', default: 'pop', options: ['press', 'settle', 'release', 'pop', 'glide'] },
    { key: 'tone', label: 'Primary tone', type: 'select', default: 'signal', options: ['signal', 'ink', 'paper'] },
    { key: 'loadTime', label: 'Print time', type: 'number', default: 1800, min: 600, max: 4000, step: 100, unit: 'ms' },
  ],
  accessibility: [
    'Native buttons: Space presses on keydown and activates on keyup, Enter activates once (auto-repeat is ignored); the pressed look follows the key, the pointer and blur alike.',
    'Busy and locked keys use aria-disabled instead of disabled, so they stay focusable; the locked key explains itself through aria-describedby.',
    'The panel display is a polite live region that announces printing and completion; the print counter is plain text.',
    'Focus ring wraps the whole key including its depth band; every key is at least 56 px tall.',
    'Label text keeps 4.5:1 or better against every key face in both themes.',
  ],
  reducedMotion: 'Press, release and unlock happen instantly with no spring or shadow animation, and the progress bar is replaced by the display text.',
  performance: [
    'Press and release are CSS transform/opacity transitions; the spring is precomputed once with springToLinear(), so no JavaScript runs per frame.',
    'The progress bar is a single scaleX transition; label swaps share one grid cell, so busy states never change the key width.',
    'Timers are cleared on unmount and on every new print.',
  ],
  preview: { height: 460 },
};
