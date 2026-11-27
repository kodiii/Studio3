import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'product-configurator',
  name: 'Pulse Configurator',
  specialty: '3d',
  summary: 'A product configurator for a fictional portable speaker in a soft-box studio: colourways and finishes laid on by a sweeping seam, a turntable with real inertia, camera presets, exploded view, annotations and a price summary that all work with or without the canvas.',
  highlights: [
    'The finish sweep: every option change is laid down by a lit seam that crosses the speaker, the old finish ahead of it and the new one behind (colour and roughness, patched into the PartController’s material clones; originals untouched). Reduced motion turns it into a short, even cross-fade.',
    'Real inertia: the view follows the hand 1:1, then keeps the release velocity and eases out with friction (a flick coasts, a slow drag stops where you let go); ←/→ on the focused view give the same push.',
    'One light for page and canvas: the studio (key upper right, fill, rim strip, floor bounce, generated environment reflections) turns with the camera like a turntable under fixed lights, so highlights glide over the finish as you orbit, and every control is lit from the same upper right. Neutral tone mapping keeps the swatches true.',
    'A contact shadow rendered from the real geometry (depth from below, blurred into a tight contact layer and a wide soft one), re-rendered only when the geometry moves, so it follows the exploded parts; a key-light shadow map on profiles that allow it.',
    'Alive at rest: left alone for a few seconds the view sways gently and the status ring breathes, until anything touches it; Pause motion stops both. The total counts between prices instead of swapping.',
    'One GLB, three optimised builds chosen from the quality profile with the real size shown; every option is a native radio/range/button mirrored in a text summary, so the configuration is complete without WebGL.',
  ],
  technology: ['r3f', 'three', 'glsl', 'css'],
  uses: [],
  adapts: ['orbit-inspect-controls', 'press-depth-button', 'number-ticker'],
  has3d: true,
  accessibility: [
    'Colourways and finishes are radio groups with text names; colour is never the only signal. Every control has hover, focus-visible and pressed states with depth.',
    'Camera: pointer drag or flick, toolbar buttons, and on the focused view ←/→ (spin with inertia), ↑/↓ (tilt), + / − and 0. Wheel zoom only when the view has focus; vertical touch swipes scroll the page.',
    'The idle sway and the breathing ring have a Pause motion button (WCAG 2.2.2) and never run under reduced motion.',
    'Parts can be selected from a list as well as by clicking the model; the selected part is announced as text. Annotations are real buttons over the canvas plus a mirrored list; the total is announced once, at its final value.',
    'Without WebGL the static render and the same controls and summary are shown.',
  ],
  reducedMotion: 'No inertia after release, no idle sway, no breathing ring: drags still follow the hand but stop where you let go, ←/→ step the view, presets and the exploded view cut, the finish change is a 160 ms cross-fade, the total changes without counting, and the dial clip only runs from its Play button.',
  performance: [
    'Render on demand: the scene draws only while the camera, a coast, the sweep, the explode amount or a clip is changing; with motion paused (or under reduced motion) an idle scene draws nothing. The model sits in a BVH (drei `Bvh`), so hotspot occlusion rays and pointer picking stay cheap on every frame of a coast or the idle sway.',
    'The contact shadow costs one depth render of the model and six 512 × 304 blur passes, only on frames where the geometry changed (load, explode, strap); four small render targets, disposed on unmount.',
    'Low-power devices load the 1.0 MB build (131k triangles) and skip the shadow map; material clones are created once (the swept and breathing materials are always owned) and disposed with the controller.',
  ],
  dataNote: 'Product, brand, specifications and prices are fictional.',
};
