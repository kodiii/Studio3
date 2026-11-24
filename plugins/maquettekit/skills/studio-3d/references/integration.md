# Integration — how the other studios call 3D Studio

The calling studio owns the page, the copy, the state and the primary action; 3D Studio owns the scene. The
boundary is a component with props in, events out, a fallback and a budget. Nothing essential crosses into pixels.

## 1. The handoff contract (any studio)

The caller fills this in; blanks become assumptions you report. Product's version with examples is
studio-product `references/product-3d.md` §5.

| Field | Caller provides | 3D Studio returns |
|---|---|---|
| Purpose | The pattern and the criterion that justifies real-time 3D | Confirmation, or the lighter alternative and why |
| Asset | Model path, licence/source, pipeline status | Optimised variants + manifest (via `studio-asset-optimizer`) |
| Container | DOM element, aspect ratio, min/max height, 320 px behaviour | A component that fills it, poster first, no layout shift |
| Props in | State the scene renders (configuration, preset, progress, selection, paused) | A typed props interface |
| Events out | What the page needs to know | `onReady`, `onError`, selection, preset reached, quality chosen |
| Camera | Named viewpoints with intent; limits | Presets, clamps, reset |
| Look | Tokens (background, accent, focus); one-sentence lighting mood | Lighting preset or custom, tone mapping choice |
| Profile | Experience profile; what may move by itself | Behaviour per profile and under reduced motion |
| Fallback | Poster and the DOM content that stands in | `fallback` wired; tested without WebGL |
| Accessibility | Label and description text; the DOM controls the page shows | Keyboard path, role, focus ring, status messages |
| Budget | Target devices; weight budget for the 3D chunk and assets | Measured counts and sizes per level, with conditions |
| Loading | Trigger (in view, intent, click), progress expectations | Lazy chunk, `preloadModel` on intent, honest progress |

```ts
/** A typical scene component boundary. The page owns the state; the scene renders it and reports back. */
export interface SceneProps<Config> {
  config: Config;                       // e.g. the configurator selection, from the URL
  preset?: string;                      // controlled camera preset
  progress?: number;                    // 0..1 for scroll-driven scenes; mutate a ref instead if it changes per frame
  selected?: string | null;             // part or node id, shared with DOM lists
  paused?: boolean;                     // user pause control
  quality?: 'auto' | 'high' | 'medium' | 'low';
  onReady?: () => void;
  onError?: (error: Error) => void;     // the page shows the poster and keeps every control working
  onSelect?: (id: string | null) => void;
  onPresetReached?: (preset: string | null) => void;
  onQualityChange?: (level: 'high' | 'medium' | 'low') => void;
}
```

Rules at the boundary:

- **State lives in the page.** The scene is a view of it. No price, option or data value is computed inside the
  canvas; selection made in the scene is reported out and rendered in DOM.
- **High-frequency values do not go through React props.** Scroll progress or pointer position per frame is
  written into a ref the scene reads in `useFrame`, plus an `invalidate()` (`studio-motion` `references/3d-sync.md`).
- **One canvas per view.** A grid of products uses images; the viewer opens one at a time.
- **The fallback is the page's content**, not an error box: the same facts and actions.

## 2. Product Studio

Viewers, configurators, exploded views, showcases. The page owns option model, price, URL state, summary and
CTA (`product-3d.md` §4). Map options to `PartController` overrides (`material:Name` / `part:Name`), presets to
`CameraRig`, explode to a slider, hotspots to `HotspotList` in the page. Return `ready`/`error`, the selected part
and the preset reached. Reference: `product-configurator` demo and the gallery `/3d` viewer.

## 3. Cinematic Studio

Scroll-driven scenes, launch heroes, WebGL backgrounds. Cinematic owns the beat sheet, copy, pinning and the
reduced-motion document; the scene receives progress (a ref) or the active chapter (a prop) and holds a meaningful
pose at every rest point. Opening sequences are skippable and stop on the first scroll; ambient light or shader
motion has a Pause control. Recipes: `scroll-camera-dolly`, `shader-aurora-plane`, `camera-preset-rig`.
Reference: `cinematic-landing` demo.

## 4. Data Studio

Spatial data only when 2D fails studio-data's criteria. Data owns the dataset, the table equivalent, filters and
the explanation of what depth encodes. The scene takes nodes/points and the current selection and filters; it
emits selection and hover. Instancing per mark type, one line batch for links, labels projected in DOM, a flat 2D
layout for comparison, and an SVG fallback. Reference: `spatial-data` demo.

## 5. Social Studio

3D posts, product drops, avatars, reactions. Never one canvas per feed item: the feed shows posters; tapping a
post opens one viewer (sheet or full screen) with the scene, then disposes it on close. Ambient motion stays low
because the feed already moves; sound is opt-in. Social owns sharing and the post's text alternative.

## 6. Motion Lab

`studio-motion` owns DOM choreography and timelines that drive the scene; 3D Studio owns what happens in the
canvas. Agree on the shared value (progress, a shot object, uniforms), who writes it and who reads it, and who
calls `invalidate()`. One owner per property.

## 7. What you hand back

```
3D handoff — <component path>
- Props / events: <interface>
- Technology: <template from technology-selection.md §4>
- Assets: <variants, bytes, triangles per variant (from the manifest)>
- Budget: <source>; measured at <level/viewport>: draw calls …, triangles …, texture bytes (estimate) …
- Review: maquettekit review run pass <n>: <3d-* statuses>; no-WebGL fallback <passed/failed>
- Reduced motion: <what changes>; pause controls: <where>
- Not tested: <real devices, screen readers, WebGPU …>
```

Measured values come only from tools run in this session; say "headless software WebGL" next to them.
