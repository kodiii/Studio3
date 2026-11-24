import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: '3d-social-post',
  name: '3D Social Post',
  specialty: 'social',
  summary: 'An astronomy club’s feed where one post holds a brass token you can turn in 3D: photo first, a single canvas mounted only on “Interact in 3D”, every gesture mirrored by buttons, and the scene released when you close it or scroll away.',
  highlights: [
    'Poster first: the post is complete as a photo with facts, caption, reactions and a “Download model (GLB)” link; the model (size shown on the button) loads only on request.',
    'One StudioCanvas for the whole feed, built from the three-kit: Model (orbit-token GLB), OrbitInspect, LightingRig and AnimationPlayer driving the model’s own Spin clip.',
    'The photo stays until the model reports loaded, then cross-fades; download progress is real bytes from the response stream.',
    'Close 3D, or scrolling a screen away, unmounts the canvas — the renderer is disposed and the cached model is evicted a second later.',
    'Other posts stay flat: a drawn meteor log and an event with an RSVP whose audience is stated and a real .ics calendar file.',
  ],
  technology: ['r3f', 'three', 'svg', 'waapi', 'css'],
  uses: [],
  collaborates: ['3d'],
  has3d: true,
  accessibility: [
    'Turn left/right, zoom in/out, reset, spin (aria-pressed) and Close 3D are 44 px buttons; the focused view also takes arrow keys, + / − and 0. Focus moves to the controls on open and back to Interact on close.',
    'Vertical swipes keep scrolling the feed (touch-action: pan-y on the canvas); the wheel only zooms while the view has focus.',
    'The canvas has a name and a written description; the token’s size, studs and finish are DOM facts, so nothing is only in pixels.',
    'Without WebGL there is no Interact button: the photo is the fallback and says so, and the model download still works.',
    'Feed pattern with labelled articles; reactions are toggle buttons with text counts; the RSVP is a native radio group with a neutral “Not this time”.',
  ],
  reducedMotion: 'The token never spins on its own: the Spin button is the only way to start it, and the orbit has no damping tail (moves are direct). Reaction pops are removed; the poster cross-fade is near-instant.',
  performance: [
    'Nothing 3D loads while scrolling: only the 2 kB manifest is fetched up front (for the honest file size and triangle count).',
    'frameloop="demand": frames render only while the camera moves or the Spin clip plays.',
    'The model is the 113 kB meshopt desktop build (5,280 triangles, no textures) — the only variant that exists for this asset.',
    'Headless verification uses software WebGL (SwiftShader); timings there say nothing about a real phone.',
  ],
  dataNote: 'Sample content: the Saltmarsh Sky Club, Holm Marsh, the session log and every reaction or RSVP count are fictional. Token dimensions come from the orbit-token model itself (63 × 63 × 13.7 mm).',
};
