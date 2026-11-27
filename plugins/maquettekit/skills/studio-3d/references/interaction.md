# Interaction and camera — viewers, configurators, showrooms

> **Quick card** — the must-dos from this file; read on for the reasons and the detail.
>
> - Clamp orbit, zoom and pan (off for single objects); give reset a DOM button and the `0`/`Home` key.
> - Give every scene interaction a DOM control: rotate, zoom, presets, parts, hotspots, explode, play/pause.
> - Announce selection in DOM text (`role="status"`) and mark list buttons `aria-pressed`; never rely on colour alone.
> - Let the page scroll past the canvas with wheel and touch; zoom only with focus or Ctrl/⌘.
> - Ignore clicks with `e.delta > 4` so an orbit never selects; filter hidden parts out of raycast hits.
> - Pass `role="group"` to an interactive `StudioCanvas` and show instructions near the viewer.
> - Keep auto-rotate off; if wanted, make it pausable and off under reduced motion.
> - Clone a material before swapping textures; never touch the cached original.

The user must always know three things: what they can do, what they are looking at, and how to get back.
Every interaction in the canvas has a DOM equivalent; the canvas is the fast path, never the only one.

## 1. Viewer contract

| Behaviour | Default | Why |
|---|---|---|
| Orbit | On, damped, polar angle kept above the ground plane | Inspection is the point; going under the floor shows nothing |
| Zoom | On, clamped so the subject never clips the near plane or shrinks to a speck | Unbounded zoom loses the subject |
| Pan | **Off** for single objects; on and clamped for rooms and maps | Panning a product off-centre is the most common "I'm lost" state |
| Auto-rotate | Off; if wanted, pausable and off under reduced motion | Moving content needs a pause control (WCAG 2.2.2) |
| Wheel | Zooms only when the viewer has focus or Ctrl/⌘ is held | The page must keep scrolling past the canvas |
| Touch | One-finger horizontal drag orbits; vertical swipes scroll the page | A canvas that traps touch scrolling breaks the page |
| Reset | Always available as a DOM button and the `0`/`Home` key | The escape hatch |
| Presets | Named stops ("three-quarter", "ports") as DOM buttons | Faster than orbiting, and reachable by keyboard and switch users |

## 2. `OrbitInspect` (orbit, zoom, pan)

Wraps three's `OrbitControls`, registers itself as R3F's default `controls` (which is how `CameraRig` finds the
orbit target), and invalidates only while the camera moves (including the damping tail).

| Prop | Default | Notes |
|---|---|---|
| `target` | `[0, 0, 0]` | Orbit centre; changing it saves a new home pose |
| `minDistance` / `maxDistance` | `0.5` / `50` | Derive from the subject: about 1.2× and 4× its bounding radius is a starting point to tune |
| `minPolarAngle` / `maxPolarAngle` | `0.1` / `π/2 − 0.02` | Keeps the camera above the ground; raise the max only if the underside matters |
| `minAzimuthAngle` / `maxAzimuthAngle` | `−∞` / `∞` | Clamp for front-only subjects (a wall-mounted product) |
| `enablePan`, `enableZoom`, `enabled` | `false`, `true`, `true` | |
| `damping` | `0.1` | Forced to 0 under reduced motion |
| `autoRotate`, `autoRotateSpeed` | `false`, `0.6` | Ignored under reduced motion |
| `wheel` | `'focus'` | `'always'` only for full-screen viewers; `'never'` to rely on buttons |
| `touchScroll` | `'pan-y'` | `'none'` gives the viewer every gesture: only in a full-screen or modal viewer |
| `keyboard`, `keyStep` | `true`, `π/18` | Arrows rotate, Shift+arrows pan (when enabled), `+`/`−` zoom, `0`/`Home` reset |
| `onStart` / `onChange` / `onEnd` | — | `onStart` is where you cancel autoplay or a tour |

Imperative handle (`ref`): `rotate(azimuth, polar?)`, `zoom(factor)` (`> 1` closer), `pan(dx, dy)`, `reset()`,
`saveHome()`, `controls`. Wire DOM buttons to it.

The keyboard path makes the `<canvas>` focusable with `role="application"`. `StudioCanvas` labels the R3F wrapper
`role="img"` by default, and an image's children are presentational in ARIA. For an interactive viewer pass
`role="group"` (the prop is forwarded to the wrapper and overrides the default).

## 3. Presets and focus transitions: `CameraRig`

Named poses (`{ position, target, fov? }`), critically damped transitions that orbit around the target in
spherical space (front → back swings round instead of dollying through the object), interruptible at any time.

| Prop / method | Behaviour |
|---|---|
| `presets`, `preset` | Controlled preset: the first value is a cut, later values animate |
| `smoothTime` | About the time to arrive, seconds (default `0.5`) |
| `referenceAspect` | Poses are authored for this aspect or wider (default `1.1`); narrower canvases pull the camera back so the subject is not cropped at phone widths |
| `onArrive(name)`, `onInterrupt()` | Announce arrival in DOM; user input on `OrbitInspect` cancels a move and fires `onInterrupt` |
| `goTo(nameOrPose, { immediate })` | Move to a preset or explicit pose; reduced motion turns every move into a cut |
| `fitToBounds(objectOrBox, { padding, direction, immediate })` | Frame a part or model for the current aspect ratio |
| `getPose()`, `stop()`, `moving` | Read the pose (to save "current view"), cancel a move |

Focus transition for a part: `rig.goTo` a pose authored for that part, or `fitToBounds(part.object, { padding: 1.4 })`,
then show the part's name and description in DOM. Keep FOV changes small; dolly instead of zooming the lens.

## 4. A complete viewer

```tsx
'use client';
import { Suspense, useCallback, useRef, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { Object3D } from 'three';
import {
  CameraRig, LightingRig, Model, ModelBoundary, OrbitInspect, PartController, SceneFallback, StudioCanvas,
  type CameraPose, type CameraRigHandle, type LoadedModel, type OrbitInspectHandle, type PartControllerCore, type PartInfo,
} from './three';

const PRESETS: Record<string, CameraPose> = {
  hero: { position: [0.42, 0.26, 0.6], target: [0, 0.07, 0] },
  top: { position: [0.01, 0.8, 0.2], target: [0, 0.07, 0] },
};
/** three's raycaster ignores `visible`: skip hits on hidden parts (or children of hidden parts). */
const rendered = (o: Object3D | null): boolean => { for (let n = o; n; n = n.parent) if (!n.visible) return false; return true; };

export function SpeakerViewer({ src }: { src: string }) {
  const orbit = useRef<OrbitInspectHandle>(null);
  const rig = useRef<CameraRigHandle>(null);
  const core = useRef<PartControllerCore | null>(null);
  const [model, setModel] = useState<LoadedModel | null>(null);
  const [parts, setParts] = useState<PartInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [explode, setExplode] = useState(0);

  const partAt = (e: ThreeEvent<MouseEvent | PointerEvent>) => {
    const hit = e.intersections.find((i) => rendered(i.object));
    return hit ? core.current?.partOf(hit.object) ?? null : null;
  };
  const onClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return; // the pointer travelled: that was an orbit drag, not a click
    e.stopPropagation();
    setSelected(partAt(e)?.name ?? null);
  }, []);
  const label = parts.find((p) => p.name === selected)?.label;

  return (
    <section aria-label="Speaker viewer">
      <div style={{ position: 'relative', aspectRatio: '4 / 3' }}>
        <StudioCanvas
          label="Interactive 3D view of the speaker" role="group"
          camera={{ fov: 30, near: 0.01, far: 20, position: PRESETS.hero.position }}
          fallback={<SceneFallback title="Pulse speaker" description="Static preview with the same options." />}
        >
          <LightingRig preset="studio-soft" shadowRadius={0.15} />
          <OrbitInspect ref={orbit} target={PRESETS.hero.target} minDistance={0.25} maxDistance={1.2} />
          <CameraRig ref={rig} presets={PRESETS} preset="hero" />
          <ModelBoundary resetKey={src}>
            <Suspense fallback={null}>
              <Model src={src} onLoaded={setModel} onClick={onClick}
                onPointerMove={(e) => setHover(partAt(e)?.name ?? null)} onPointerOut={() => setHover(null)} />
              <PartController ref={core} root={model?.scene ?? null} selected={selected} highlight={hover}
                explode={explode} onReady={(p) => setParts(p)} />
            </Suspense>
          </ModelBoundary>
        </StudioCanvas>
      </div>
      <div role="group" aria-label="Camera">
        <button type="button" aria-label="Rotate left" onClick={() => orbit.current?.rotate(Math.PI / 12)}>←</button>
        <button type="button" aria-label="Rotate right" onClick={() => orbit.current?.rotate(-Math.PI / 12)}>→</button>
        <button type="button" aria-label="Zoom in" onClick={() => orbit.current?.zoom(1.2)}>+</button>
        <button type="button" aria-label="Zoom out" onClick={() => orbit.current?.zoom(1 / 1.2)}>−</button>
        <button type="button" onClick={() => rig.current?.goTo('top')}>Top view</button>
        <button type="button" onClick={() => rig.current?.goTo('hero')}>Reset view</button>
      </div>
      <label>Explode <input type="range" min={0} max={1} step={0.05} value={explode} onChange={(e) => setExplode(Number(e.target.value))} /></label>
      <ul aria-label="Parts">
        {parts.map((p) => (
          <li key={p.name}><button type="button" aria-pressed={selected === p.name} onClick={() => setSelected(selected === p.name ? null : p.name)}>{p.label}</button></li>
        ))}
      </ul>
      <p role="status">{label ? `Selected: ${label}` : 'No part selected'}</p>
    </section>
  );
}
```

The root is passed from `onLoaded` state on purpose (see `lifecycle.md` §3).

## 5. Selection and highlighting without colour-only cues

`PartController` lifts emissive towards `highlightColor` (default `#ffb347`, intensity `0.35`; hover uses 60 % of
it). That is a visual hint, never the only signal (WCAG 1.4.1):

- Name the selected part in DOM text (`role="status"`, one line per change) and mark the list button `aria-pressed`.
- Offer a second non-colour cue in the scene where it helps: dim the other parts (`opacity` override), isolate
  (`hidden`), frame it with `fitToBounds`, or place a hotspot marker.
- Choose `highlightColor` from the design tokens and check it against the material colours you ship; an orange lift
  on an orange part is invisible.
- Parts are the named nodes of the model (authored `label`/`explodeDirection` extras win; otherwise every named
  node). In optimised variants the mesh sits in an unnamed child of the part node: select by name, then traverse.

## 6. Materials, colours and textures

- `overrides` replaces all overrides at once: `{ 'material:ShellMatte': { color: '#33402f' }, 'part:Knob':
  { roughness: 0.2 } }`. Later entries win; a slot that loses its override returns to the original.
- Switchable fields: `color`, `roughness`, `metalness`, `emissive`, `emissiveIntensity`, `clearcoat`,
  `clearcoatRoughness`, `sheen`, `sheenRoughness`, `sheenColor`, `envMapIntensity`, `opacity` (below 1 makes the
  material transparent). Textures stay as authored.
- Colours are CSS colour strings in sRGB; three converts them to its linear working space. Judge them after tone
  mapping, under the lighting preset you ship.
- Texture swaps are your own code. Clone the material first (never touch the cached original), then:

```ts
import { SRGBColorSpace, TextureLoader, type MeshStandardMaterial, type Texture } from 'three';

/** `material` must be a clone you own. Returns the new texture so the caller can dispose it later. */
export async function swapBaseColour(material: MeshStandardMaterial, url: string, owned?: Texture): Promise<Texture> {
  const texture = await new TextureLoader().loadAsync(url);
  texture.colorSpace = SRGBColorSpace; // colour data; normal/roughness/AO maps stay linear
  texture.flipY = false;               // glTF UV convention (TextureLoader defaults to true)
  const hadMap = material.map !== null;
  material.map = texture;
  if (!hadMap) material.needsUpdate = true; // adding a map changes the shader; replacing one does not
  owned?.dispose();                         // only a texture you created earlier
  return texture;
}
```

A configurator's option model, price and URL state belong to the page (studio-product `product-3d.md` §4).

## 7. Exploded views

`PartController` reads glTF node extras: `explodeDirection: [x, y, z]` (in the part's parent space) and
`explodeDistance` (scene units). `explode` (0–1) animates with a critically damped approach (`explodeTime`, default
0.6 s), farthest parts leaving first; under reduced motion it jumps. Without authored extras nothing moves: ask for
them in the asset, or compute directions from part centres minus the model centre.

- DOM control: a range input plus "Assemble"/"Explode" buttons (keyboard and single-pointer operable, WCAG 2.5.7).
- Widen the camera when exploded (`rig.goTo(explodedPose)`); restore it on assemble.
- Pair with the parts list so each separated part can be selected and described.

## 8. Hotspots

Three pieces share one store (`useHotspotStore()`):

| Piece | Where | Does |
|---|---|---|
| `HotspotAnchors` | Inside the canvas | Projects each anchor (a named node's bounding-box centre plus optional offset, or a fixed point) on every rendered frame and writes transform/opacity to the markers; one raycast per hotspot tests occlusion |
| `HotspotLayer` | DOM sibling of `StudioCanvas` inside the same `position: relative` box | Numbered marker buttons (30 px) and the open annotation card; `Escape` closes |
| `HotspotList` | Anywhere in DOM, also shown in the fallback | The same annotations as an ordered list of buttons (44 px rows): the stable keyboard and screen-reader path |

Occluded markers fade to 0.28 opacity and turn inert (the list stays the stable path); markers behind the camera
hide. Keep the count small: each costs a raycast per rendered frame. For a heavy model in a scene that moves
continuously (inertia, idle sway, a playing clip), wrap the model in drei's `<Bvh>` inside its `<Suspense>` so the
rays (and pointer picking) are cheap, or throttle the tests with `occludeInterval` (ms); `occlude={false}` turns it
off. Selecting a hotspot may move the camera; announce the destination in text.

## 9. Showrooms and multi-object scenes

- Navigation by **stations**: a list of named viewpoints (CameraRig presets), each reachable by a DOM button and the
  arrow keys of that list. Free flight (WASD, pointer lock) is an optional extra, never the only way to move.
- Keep the camera at eye height, clamped inside the room; no FOV jumps; cut between stations under reduced motion.
- Load objects per station (lazy), show progress per object, and keep the station list usable while loading.

## 10. Input plumbing

- **Pointer capture** for custom drags in R3F: `(e.target as Element).setPointerCapture(e.pointerId)` on
  `onPointerDown` (R3F's event `target` implements it and routes later events to that object), release on
  `onPointerUp` and handle `onLostPointerCapture` and `pointercancel`.
- **Click versus drag**: R3F's `e.delta` is the pointer distance in pixels since `pointerdown`; ignore clicks with
  `delta > 4` so an orbit never selects.
- **`touch-action`**: set by `OrbitInspect` (`pan-y` keeps page scroll). OrbitControls sets `none` when it
  connects; the kit overrides it afterwards.
- **Wheel**: never `preventDefault()` an unfocused canvas's wheel events. Provide zoom buttons.
- **Hover**: on touch there is none. Anything shown on hover is also reachable by tap and focus (WCAG 1.4.13).

## 11. Raycasting cost

R3F raycasts every object that has a pointer handler, recursively, on every pointer move (hover) and click.

- Put handlers on the one group that needs them, not on every mesh.
- Exclude decorative meshes inside that group with `raycast={() => null}`.
- For dense meshes use a low-poly invisible proxy as the hit target, or Drei's `<Bvh>` (three-mesh-bvh, MIT).
- Hidden objects are still hit (three's raycaster checks layers, not `visible`): filter as in §4, or move hidden
  parts to another layer.
- Do not set React state for every pointer move unless the value changed; React bails out on equal primitives.

## 12. Checklist

- [ ] Orbit, zoom and (if any) pan are clamped; reset exists as a button and a key.
- [ ] Every scene interaction has a DOM control: rotate, zoom, presets, parts, hotspots, explode, play/pause.
- [ ] Selection is announced as text; colour is never the only cue.
- [ ] The page scrolls past the canvas with wheel and touch; zoom needs focus or a modifier.
- [ ] Clicks after an orbit drag do not select; hidden parts cannot be clicked.
- [ ] Interactive canvas wrapper uses `role="group"`; instructions are visible near the viewer.
