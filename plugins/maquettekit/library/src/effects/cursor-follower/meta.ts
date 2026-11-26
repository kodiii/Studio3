import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'cursor-follower',
  name: 'Cursor Follower',
  description: 'A dot and a spring ring that trail the native cursor inside one container and read what is under it. The ring keeps its velocity, smears into an ellipse along its direction of travel and wobbles round when the pointer stops; over a magnetic button it wraps the button\'s own outline and pulls it gently toward the pointer, over a card it blooms into a filled "View" disc, and over a paragraph it narrows to a caret that lands between real letters.',
  category: 'cursor',
  specialties: ['cinematic', 'product'],
  technology: ['css', 'svg'],
  interaction: ['pointer', 'hover', 'press'],
  complexity: 3,
  intensity: 'bold',
  applications: [
    'portfolio and studio sites',
    '"View" labels on case-study cards',
    '"Drag" affordance on carousels and timelines',
    'magnetic calls to action in a hero',
    'editorial long-reads with a text caret',
  ],
  dependencies: [],
  params: [
    { key: 'follow', label: 'Follow spring', type: 'select', default: 'release', options: ['press', 'settle', 'release', 'pop', 'glide'] },
    { key: 'size', label: 'Ring size', type: 'number', default: 36, min: 20, max: 72, step: 2, unit: 'px' },
    { key: 'stretch', label: 'Squash and stretch', type: 'number', default: 0.55, min: 0, max: 1, step: 0.05 },
    { key: 'pull', label: 'Magnet pull', type: 'number', default: 0.3, min: 0, max: 0.6, step: 0.05 },
    { key: 'blend', label: 'Invert (difference blend)', type: 'boolean', default: false },
    { key: 'dot', label: 'Show dot', type: 'boolean', default: true },
  ],
  accessibility: [
    'The native cursor is never hidden. The follower is two aria-hidden, pointer-events: none layers, so clicks, hover states and text selection reach the page untouched.',
    'Fine pointers only, (hover: hover) and (pointer: fine): coarse devices render nothing, and a touch or pen event on a hybrid laptop hides the follower until the mouse moves again. The showcase works fully without it.',
    'Any non-modifier key hides the follower so it never sits over a focus ring; focus styles are left alone, and moving the mouse brings it back.',
    '"View" and "Drag" repeat what the content already says: each card is a named button, and the archive is a labelled, focusable region that scrolls with the arrow keys, by touch and by mouse drag.',
    'A magnet moves toward the pointer, never away, with its travel capped so the hit area stays under the cursor; it uses the CSS translate property, so the element\'s own transform, press state and focus ring keep working.',
  ],
  reducedMotion: 'The follower is decoration, so it is not rendered at all and magnets stay put. The native cursor, hover and focus states and the draggable archive work as usual; the archive stops where you let go, with no momentum or rubber band.',
  performance: [
    'One useRafLoop runs only while something moves and goes back to sleep once every spring is at rest; it also pauses offscreen and in hidden tabs.',
    'Target rects, the scope rect and the layer origin are cached when a target is entered and refreshed at the start of the next frame after scroll or resize; every frame reads before it writes, and nothing is measured after a write.',
    'Position, squash and stretch, press and presence are transforms and opacity. The outline morph writes the geometry of one SVG rect, only while a morph is moving, and identical values are never re-written.',
    'Listeners are passive and installed only on fine-pointer devices with motion allowed; unmount removes them and clears every translate written to a magnet.',
  ],
  preview: { height: 760 },
};
