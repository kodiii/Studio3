import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'spatial-data',
  name: 'Meridian Service Atlas',
  specialty: '3d',
  summary: 'A seeded, fictional map of 43 services in five clusters: instanced nodes and one line batch in 3D, a flat 2D layout for honest comparisons, and a sortable table that stays in sync with the scene.',
  highlights: [
    'Layout is a small, deterministic force relaxation written for the demo (repulsion, springs, cluster gravity) — the same atlas on every load.',
    'One draw call per node type (instanced spheres, cylinders, octahedra, cubes) and a single LineSegments for all 74 links.',
    'Selecting a node in the scene, the details panel or the table selects it everywhere: neighbours light up, the camera frames it, the row is highlighted.',
    'A 2D layout morphs in on demand, with copy on why the flat view is the accurate one for comparing sizes and distances.',
  ],
  technology: ['r3f', 'three'],
  uses: [],
  collaborates: ['data'],
  has3d: true,
  accessibility: [
    'The sortable table is the complete equivalent of the map: every service, its cluster, type, simulated figures and link count; header buttons expose aria-sort.',
    'Selecting a row selects the node in the scene; focusing a row previews it; selecting in the scene highlights and scrolls the row.',
    'Cluster is never encoded by colour alone: clusters are spatial neighbourhoods with on-canvas names, and the type of a node is its shape (with a text legend).',
    'Map controls: drag, wheel after focusing, or arrow / Shift+arrow / + / − keys on the focused map. Without WebGL an SVG flat map reflects the same filters and selection.',
  ],
  reducedMotion: 'Switching between the 3D and 2D layouts and focusing a node cut to the end state instead of animating. Nothing moves on its own.',
  performance: [
    'Render on demand: frames are drawn only while the camera or the layout morph is moving, or when the selection changes.',
    'Five draw calls for the whole graph; restyling rewrites instance colours/matrices and one vertex-colour buffer — no materials are created per node.',
    'Both layouts are computed once (≈ 420 iterations over 43 nodes, a few milliseconds) and the labels are projected after each rendered frame, without React re-renders.',
  ],
  dataNote: 'Simulated sample data: service names, dependencies and traffic figures are generated from a fixed seed and describe no real system.',
};
