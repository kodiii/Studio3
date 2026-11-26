import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'rive-state-machine',
  name: 'Rive State Machine',
  description: 'Two Rive files driven by plain DOM controls. Birb idles on a lit stage, looks up when the pointer passes above its head and dances on a real toggle button; a native five-star radio group previews and commits values into a second state machine. The runtime loads lazily from your own origin, sizes itself to the element and stops drawing offscreen.',
  category: 'vector-animation',
  specialties: ['product', 'social'],
  technology: ['rive', 'css'],
  interaction: ['pointer', 'hover', 'press', 'keyboard', 'data'],
  complexity: 3,
  intensity: 'bold',
  applications: [
    'mascot or onboarding character that reacts to the user',
    'animated rating, feedback or survey control',
    'empty, success and error states with a character',
    'interactive product illustration in a hero',
  ],
  dependencies: [{ name: '@rive-app/canvas-lite', version: '^2.55.1' }],
  params: [
    { key: 'scene', label: 'Scene', type: 'select', default: 'both', options: ['both', 'character', 'rating'] },
    { key: 'pointer', label: 'Pointer reactions', type: 'boolean', default: true },
    { key: 'backdrop', label: 'Stage backdrop', type: 'select', default: 'spotlight', options: ['spotlight', 'grid', 'none'] },
    { key: 'tint', label: 'Rating colour', type: 'select', default: 'artwork', options: ['artwork', 'accent'] },
  ],
  accessibility: [
    'The canvases are aria-hidden; meaning lives in the DOM: the stage is a labelled image whose name follows the state machine (idle, looking up, dancing) and every input has a native control.',
    'Dance is a toggle button with aria-pressed, Look up is a plain button, so keyboard users get every reaction the pointer gets; a polite status line announces the look-up and pause changes the canvas cannot speak.',
    'The rating is a native fieldset of five radio buttons laid over the drawn stars: arrow keys move and commit, hover and focus preview, the committed value is announced politely, and a double focus ring stays visible on the gradient.',
    'The idle loop runs longer than five seconds, so the stage has a visible Pause/Play button (WCAG 2.2.2).',
    'If the runtime or a file cannot load, the controls keep working: the rating falls back to drawn DOM stars and the stage says what is missing.',
  ],
  reducedMotion: 'Nothing plays on its own: Birb holds a still idle frame and pointer reactions are off. Dance, Look up and Play are explicit controls, so they still animate and Birb settles back to a still frame afterwards. Rating changes jump straight to the final frame of each state (state machine stopped, the matching animation scrubbed to its end) with a 160 ms cross-fade.',
  performance: [
    'The Rive runtime is a dynamic import inside an effect, so other pages never download it; its WASM (about 374 KB gzipped) and the .riv files are fetched once per page from your own origin, never from a CDN.',
    'Each canvas sizes its drawing buffer from a ResizeObserver with the device pixel ratio capped at 2, and redraws on DPR changes.',
    'Rendering stops while a canvas is offscreen or the tab is hidden, and the rating state machine settles: once its stars have landed no frames are drawn until the input changes.',
    'Every Rive instance is released with cleanup() on unmount; loads that finish after unmount are dropped, so StrictMode double mounts and Replay leave nothing behind.',
  ],
  preview: { height: 620 },
};
