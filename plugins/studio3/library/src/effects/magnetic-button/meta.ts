import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'magnetic-button',
  name: 'Magnetic Button',
  description: 'Call-to-action buttons that lean toward a nearby pointer and spring home when it leaves. The pull fades smoothly to zero at the edge of the field, the label floats a little further than the body for depth, and the physics is a hand-rolled token spring on one paused-when-idle rAF loop.',
  category: 'buttons',
  specialties: ['product', 'cinematic'],
  technology: ['css'],
  interaction: ['pointer', 'hover', 'press', 'keyboard'],
  complexity: 2,
  intensity: 'moderate',
  applications: ['hero call to action', 'contact or booking prompt', 'portfolio "view work" link', 'footer sign-off actions'],
  dependencies: [],
  params: [
    { key: 'strength', label: 'Pull strength', type: 'number', default: 0.3, min: 0.1, max: 0.6, step: 0.05 },
    { key: 'radius', label: 'Field radius', type: 'number', default: 72, min: 16, max: 160, step: 4, unit: 'px' },
    { key: 'depth', label: 'Label depth', type: 'number', default: 0.35, min: 0, max: 1, step: 0.05 },
    { key: 'spring', label: 'Release spring', type: 'select', default: 'release', options: ['press', 'settle', 'release', 'pop', 'glide'] },
    { key: 'field', label: 'Show field', type: 'boolean', default: false },
  ],
  accessibility: [
    'Real <button> elements: Enter and Space activate them and the result is announced through a polite status line.',
    'Keyboard focus gets the same engaged state as hover (arrow turns, surface shifts, field lights up when shown) plus a 2 px focus ring that travels with the button.',
    'Magnetism is decoration only: it never moves a button away from the pointer, and the hit area always stays under the cursor.',
    'Both buttons are at least 56 px; the icon-only button has an accessible name.',
  ],
  reducedMotion: 'No magnetism and no press squash: buttons stay put, and hover/focus only change colour and turn the arrow without animating.',
  performance: [
    'One useRafLoop drives every magnet; it starts on pointer movement inside the stage and stops itself once all springs are at rest, so an idle page runs no frames.',
    'Each frame reads the static anchor rects first, then writes transforms (no layout thrash; the moving element is never measured).',
    'Springs use the motion tokens with sub-stepped semi-implicit Euler integration, stable at any frame rate.',
    'Disabled entirely for coarse pointers (hover: none / pointer: coarse) and under reduced motion: no listeners do work.',
  ],
  preview: { height: 440 },
};
