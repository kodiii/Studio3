# Spatial data — when depth informs, and when it distorts

Load for networks, 3D scatter, volumes, terrain or any request for "3D data". You decide whether depth adds
information and what the view must do; `studio-3d` builds the scene. The default answer is 2D: it is more
accurate for almost every comparison task.

## 1. The decision

People judge position along a common scale far more accurately than length, angle, area or depth
(Cleveland and McGill's ranking of perceptual tasks). A third spatial axis spends the weakest channel and
adds occlusion and perspective distortion. Use it only when it carries the answer.

Real-time 3D needs **every** "must" and at least one "value" row.

| | Criterion | How to check |
|---|---|---|
| Must | The data has a genuine spatial dimension (positions in x, y, z; elevation; a physical layout), or the structure only separates in 3D | Ask what the z-axis means; "it looks cool" is not a meaning |
| Must | An accurate 2D view and an equivalent table ship with it | Projections, small multiples, the table in §6 |
| Must | The task is spatial: where, which is above, behind or inside, how a shape is formed | Write the question; if it is "which is bigger", use 2D |
| Must | The budget holds: one canvas, lazy, poster first (shared `performance.md` §6) | Point counts measured, not guessed |
| Value | Users must navigate a large structure (fly through a building, a network neighbourhood) | Navigation is the task |
| Value | Internal structure matters and slicing reveals it (volumes, medical or scientific scans) | Slices are part of the view |
| Value | Rotation resolves clusters that overlap in every 2D projection | Verified on the real data, not assumed |
| Value | The physical form is the data (terrain, molecules, point clouds, factory floors) | The geometry comes from measurements |

## 2. When 2D is more accurate

| Task | 3D temptation | Better 2D form |
|---|---|---|
| Compare magnitudes | 3D bars, 3D columns on a map | Sorted bars; 2D choropleth or proportional symbols |
| Read exact values | Hover labels in a rotating scene | Table, or a 2D chart with a crosshair |
| Three numeric variables | 3D scatter | 2D scatter with size or colour; scatterplot matrix; linked 2D projections |
| Change over time | Ribbons in depth | Lines, small multiples |
| Small or medium networks | 3D force graph | 2D node-link with filtering; adjacency matrix for dense graphs |
| Regions without height | Extruded map | 2D map with an appropriate projection |
| Part-to-whole | 3D pie | Stacked bar |

Perspective makes near marks larger and far marks smaller, so sizes cannot be compared; occlusion hides
data; and the reading changes with the viewpoint, so two people looking at the "same" chart see different
things. Say this in one sentence when you decline a 3D request, and offer the 2D form.

## 3. Network graphs

| Size and density | Form | Notes |
|---|---|---|
| Up to about 100 nodes, sparse | 2D node-link (`d3-force`), SVG | Labels on nodes; hover and focus highlight neighbours |
| About 100–1,000 nodes | 2D node-link on canvas, with filtering, aggregation and search | Edge bundling or transparency for crossings |
| Dense (edges ≫ nodes) or more than about 1,000 nodes | Adjacency matrix, community aggregation, or a WebGL renderer | A matrix shows density and clusters a hairball hides |
| Exploration of a very large graph | 3D only if the user navigates it and rotation demonstrably resolves overlaps | Still with search, neighbour lists and the tables |

- **Deterministic layouts.** Seed the simulation (`simulation.randomSource(randomLcg(42))` in D3) so the same
  data produces the same picture across sessions.
- **Stable updates.** When data changes, start from the previous positions with a low alpha
  (`simulation.alpha(0.3).restart()`) so the graph adjusts instead of exploding.
- **Do not animate forever.** The simulation stops itself when alpha falls below `alphaMin`; never keep
  reheating it for ambience. Under reduced motion, compute the layout off-screen (`simulation.stop()` then
  `simulation.tick(300)`) and render the settled result once.
- **Equivalents.** A node table (degree, group, attributes) and an edge table; selecting a node lists its
  neighbours as links; a path finder if paths matter.

## 4. 3D scatter, point clouds and volumes

| Concern | Do |
|---|---|
| Projection | Orthographic camera for measurement (no size distortion); perspective only for exploration, with the choice exposed |
| Orientation | View presets aligned to the axes (XY, XZ, YZ) that turn the scene into exact 2D projections; "Reset view" |
| Axes | A labelled axis box with ticks; grid planes; labels in DOM or as SDF text kept readable at all angles |
| Depth cues | Size attenuation (perspective only), fog, slow rotation started by the user (motion parallax reveals structure) |
| Occlusion | Filtering, highlighting with others faded, slicing planes; transparency only with care, because blended colours misstate values |
| Picking | Raycasting with `raycaster.params.Points.threshold` for modest counts; GPU colour picking for large ones |
| Selection | Brush in the linked 2D projections, not in 3D; the selection highlights in the scene and the table |
| Volumes | Axis-aligned slicing planes with 2D slice views; isosurfaces with labelled thresholds; a perceptually ordered colour scale with a legend |
| Rendering | `THREE.Points` or instanced meshes; one draw call per layer; counts scaled by `useQuality().density` |

Continuous rotation is motion that is the content (tier 3): it starts only on request, has a pause control,
and is off under reduced motion.

## 5. Geospatial

- 2D maps first. Use 3D terrain or extrusions only when elevation or height is the data.
- Projections distort: Web Mercator inflates area at high latitudes, so area comparisons need an equal-area
  projection (for example `geoEqualEarth` in D3).
- Choropleths show rates, not raw counts (`chart-selection.md` §3).
- If the project already uses a map library, work inside it; do not add a second map renderer.
- Keyboard: a list of regions or places that moves the map, plus zoom and pan buttons; the map itself is not
  the only way in.

## 6. Always an equivalent table

Every spatial view ships with a table of the same records:

- The same rows and fields the scene encodes (x, y, z, colour field, size field, label), sortable and
  filterable.
- Selection synchronised both ways: selecting a row highlights and frames the item; selecting in the scene
  focuses the row.
- A generated text summary of the structure ("3 clusters; the largest holds 1,204 points around …"),
  computed from the data and never written by hand.
- With WebGL unavailable, the 2D projections and the table are the complete experience.

## 7. Handoff contract to studio-3d

You own the data, the scales and the questions; `studio-3d` owns rendering. Fill this in; blanks become
assumptions they must report.

| Field | You provide |
|---|---|
| Question | The spatial task from §1 and the "value" row that justifies 3D |
| Data in | Typed arrays (positions, values, ids), record count, update rate |
| Encodings | Scales computed with `d3-scale` (position, colour, size) passed as arrays or functions; legend content |
| Camera | Projection (orthographic or perspective), axis-aligned presets, limits, reset |
| Interaction | Events out: hover id, select id, camera preset reached; events in: highlight ids, filter mask |
| Linked views | Which 2D projections and table stay synchronised, and through which store |
| Look | Tokens from `maquettekit.design.json`, the categorical or sequential palette, background |
| Budget | Target devices, point and instance counts, `frameloop="demand"` expectation, DPR cap |
| Fallback | The 2D projections and table shown without WebGL, after context loss, or by choice |
| Accessibility | Canvas label and description; DOM controls for every camera move; table and summary |
| Diagnostics | Review-run numbers (draw calls, points, context loss) with the headless-rendering caveat |

## 8. Do / do not

| Do | Do not |
|---|---|
| Start from the question and prove depth answers it | Add a z-axis to make a chart look advanced |
| Ship 2D projections and a table with every scene | Make the canvas the only way to read the data |
| Use orthographic views for measurement | Compare sizes under perspective |
| Seed layouts and keep them stable across updates | Let a force graph jiggle forever |
| Brush in 2D, highlight in 3D | Ask users to lasso points in a rotating scene |
| Scale counts with the quality profile | Render a million points on a phone because a desktop coped |

## 9. Checklist

- [ ] Every "must" in §1 holds; the "value" row is named, or the 2D form was chosen and the reason given.
- [ ] 2D projections, the table and a generated summary ship and stay synchronised with the scene.
- [ ] Layouts deterministic; simulations stop; rotation only on request and off under reduced motion.
- [ ] Projection choice exposed; axis presets and reset available as DOM buttons.
- [ ] Handoff table completed; budget and fallback verified with WebGL disabled.
