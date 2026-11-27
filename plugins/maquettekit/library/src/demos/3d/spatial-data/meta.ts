import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'spatial-data',
  name: 'Meridian Service Atlas',
  specialty: '3d',
  summary: 'A seeded, fictional map of 43 services in five clusters, lit like objects on a map table: glazed instanced nodes, weighted curved links, fog and contact shadows for depth, a flat 2D layout for honest comparisons, and a sortable table that stays in sync with the scene.',
  highlights: [
    'Layout is a small, deterministic force relaxation written for the demo (repulsion, springs, cluster gravity) — the same atlas on every load; node size, link direction and every figure mean exactly what they did before the visual pass.',
    'Depth cues without postprocessing: fog that fades distant nodes into the paper, contact shadows projected along the key light (pooled on a floor under the 3D graph, true drop shadows on the paper behind the 2D map), glazed env-lit nodes with a fresnel rim, and a key light that stays at the upper left of the view like every DOM shadow on the page.',
    'Links with weight: one instanced tube bent along a quadratic curve in the vertex shader (arcs in 3D, a sideways bow in 2D), fading from caller to callee; incident links thicken on hover and selection.',
    'Selection answers physically: the node pops on a spring, a halo settles round it, two pulses run along each incident link from caller to callee and the node at the far end bumps when one arrives — then the scene is still again in about 2.5 s.',
    'The scene keeps answering the pointer: the graph turns a few degrees towards it and the key light drifts with it (3D only). Selecting in the scene, the details card or the table selects everywhere.',
  ],
  technology: ['r3f', 'three', 'glsl'],
  uses: [],
  collaborates: ['data'],
  has3d: true,
  accessibility: [
    'The sortable table is the complete equivalent of the map: every service, its cluster, type, simulated figures and link count; header buttons expose aria-sort.',
    'Selecting a row selects the node in the scene; focusing a row previews it; selecting in the scene highlights and scrolls the row. The details card keeps one height whatever it shows, so the table never moves under the pointer.',
    'Cluster is never encoded by colour alone: clusters are spatial neighbourhoods with on-canvas names, the type of a node is its shape (with a text legend), and the selected node gets a halo ring and an inverted label.',
    'Map controls: drag, wheel after focusing, or arrow / Shift+arrow / + / − keys on the focused map. Buttons, layout switch and neighbour chips have hover, pressed and focus-visible states. Without WebGL an SVG flat map reflects the same filters and selection.',
  ],
  reducedMotion: 'Switching between the 3D and 2D layouts and focusing a node cut to the end state. No parallax, no pointer-following light, no selection pulses, pops or bumps: sizes and the halo change at once. Nothing moves on its own.',
  performance: [
    'Render on demand: frames are drawn only while the camera, the layout morph, a selection spring or the pointer parallax is moving — a resting map draws nothing (the scene is memoised so the page’s diagnostics poll cannot wake it).',
    'Seven draw calls at most: one instanced mesh per node shape, one for all 74 links, one for the contact shadows, one for the selection halo; restyling rewrites instance attributes, never materials.',
    'Both layouts are computed once (≈ 420 iterations over 43 nodes, a few milliseconds); labels are projected after each rendered frame without React re-renders; clearcoat only on the high quality profile.',
  ],
  dataNote: 'Simulated sample data: service names, dependencies and traffic figures are generated from a fixed seed and describe no real system. Link thickness and pulse speed carry no data.',
};
