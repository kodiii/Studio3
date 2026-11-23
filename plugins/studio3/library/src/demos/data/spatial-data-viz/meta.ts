import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'spatial-data-viz',
  name: 'Saddleback snow survey',
  specialty: 'data',
  summary: 'A fictional plateau’s 384 snow-depth sensors as instanced 3D bars where height is the reading, with an equivalent keyboard-navigable 2D heatmap and a table, a 30-day playback on request, and copy on when the flat view is the more accurate one.',
  highlights: [
    'Depth carries the data: 384 bars in one instanced draw call, heights interpolated between days (values, not pixels), rendered on demand only while something changes.',
    'The 2D map is not a lesser fallback but the accurate view: an ARIA grid with column letters and row numbers, values printed in each cell where they fit, and the same pinned sensor as the 3D scene.',
    'A toggle with plain copy on when 2D is more accurate (perspective, occlusion, exaggeration) and what 3D is for (seeing drifts as a landform); the vertical exaggeration is stated in the legend.',
    'One sequential hue, light-to-dark on light pages and dark-to-light on dark ones; offline sensors are hatched “no reading” cells and flat tiles, never zeros.',
    'Three-kit composition: StudioCanvas (quality, lazy mount, fallback to the 2D map), OrbitInspect for pointer and keyboard orbit, CameraRig for the overview, from-the-west and near-plan presets.',
  ],
  technology: ['r3f', 'three', 'd3', 'css'],
  uses: [],
  collaborates: ['3d'],
  has3d: true,
  accessibility: [
    'The 2D map is a role="grid" with row and column headers: arrow keys move, Home/End jump along a row, Enter pins a sensor; every cell’s name includes its value and grid reference.',
    'The 3D scene is keyboard-operable through OrbitInspect (arrows rotate, + / − zoom, 0 resets) and carries a computed description; the table lists all 384 values for the chosen day.',
    'Playback is off until requested, can be paused, and is announced once when it ends; manual day steps announce the day’s mean and deepest sensor.',
    'Without WebGL the scene falls back to the same 2D map, with a note saying why.',
  ],
  reducedMotion: 'Bar heights cut to the new day instead of rising or falling and camera presets cut instead of flying; playback still steps one day per 0.9 s when you press Play.',
  performance: [
    'One InstancedMesh (384 boxes) plus one ground plane and one outline: three draw calls; matrices and colours are rewritten only when the day, hover or theme changes.',
    'frameloop="demand": frames are requested only during a height tween or camera move; the canvas mounts lazily near the viewport.',
    'The 2D map is plain HTML (384 cells) with colours from a cached 341-step ramp.',
  ],
  dataNote: 'Simulated (seed 912): storm totals with settling, a fixed wind-redistribution field, late-month melt and noise on a 24 × 16 grid over 30 days; three sensors go offline for a while. The plateau, survey and readings are invented; dates in UTC.',
};
