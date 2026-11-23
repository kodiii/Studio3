# Lifecycle — canvas, renderer and GPU resources

A WebGL scene is a resource with a lifetime: a context is acquired, GPU memory is allocated, frames are drawn,
the context can be lost, and everything must be released. JavaScript garbage collection does none of this for
you. Imports below assume the kit was copied to `./three` and `./motion`; adjust the paths.

## 1. Who owns what

| Resource | Created by | Released by | Your job |
|---|---|---|---|
| Renderer, context, default scene and camera | `StudioCanvas` (R3F `Canvas`) | R3F on unmount | Nothing; never create a second renderer inside it |
| JSX objects: `<mesh>`, `<boxGeometry>`, `<meshStandardMaterial>` | R3F | R3F on unmount (unless `dispose={null}`) | Prefer JSX for anything R3F can own |
| `<primitive object={x}>` | You | **Nobody** — R3F never disposes primitives | Dispose `x` yourself or hand it to an owner (the model cache) |
| GLB loaded with `Model` / `useModel` | kit model cache | Cache, about 1 s after the last consumer unmounts (10 s if loaded but never mounted) | Do not dispose the clone: it shares geometry and materials with the cache |
| Material clones for overrides | `PartController` | `PartController` on unmount (originals restored) | Never mutate an original material |
| Generated environment (PMREM target) | `LightingRig` | `LightingRig` on preset change/unmount | Nothing |
| Anything you `new` in an effect: textures, geometries, render targets, composers | You | You, in the effect cleanup | `ResourceTracker` or `disposeObject` |
| Vanilla renderer and scene | `createVanillaScene` | `app.dispose()` | Call it exactly once |

Rule: dispose only what you own. `disposeObject(root)` disposes every geometry, material and texture it finds
under `root`, including textures in `ShaderMaterial` uniforms — run it on shared resources and you break every
other user of them.

## 2. React: `StudioCanvas`

`StudioCanvas` is the only way 3D enters a React page in Studio³. What it does, in order:

| Phase | Behaviour | `data-status` on the host |
|---|---|---|
| First render | Renders an `aria-hidden` placeholder; capabilities are detected in an effect | `pending` |
| No WebGL | Renders `fallback` plus "This device or browser cannot display interactive 3D." | `unsupported` |
| Not near the viewport (`lazy`, default true) | Waits; mounts the `Canvas` when the host is within 200 px of the viewport | `ready` |
| Mounted | `frameloop` is your value (`demand` by default) while visible; `never` while off-screen or the tab is hidden, or while `paused` | `ready` |
| Render error inside the tree | Error boundary shows `fallback` with "Try again"; `onSceneError(error)` | `error` |
| `webglcontextlost` on its canvas | `preventDefault()`, unmounts the canvas, shows `fallback` with "Try again" | `lost` |
| `disabled` | Shows `fallback` ("3D is turned off.") — use for a user "Turn off 3D" control and for tests | `disabled` |

"Try again" re-runs capability detection and remounts the scene, which rebuilds every GPU resource. Give the host a
size (the wrapper fills `100%` of its parent and has a 120 px minimum height).

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import type { Mesh } from 'three';
import { SceneFallback, StudioCanvas } from './three';

/** Declarative prop changes re-render by themselves; ref mutations must call invalidate(). */
function Turntable({ angle, highlight }: { angle: number; highlight: boolean }) {
  const mesh = useRef<Mesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (mesh.current) mesh.current.scale.setScalar(highlight ? 1.04 : 1);
    invalidate(); // mutated through a ref: request one frame
  }, [highlight, invalidate]);
  return (
    <mesh ref={mesh} rotation-y={angle}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#c9c2b4" roughness={0.6} />
    </mesh>
  );
}

export function ProductStage({ angle }: { angle: number }) {
  const [paused, setPaused] = useState(false);
  return (
    <div style={{ position: 'relative', aspectRatio: '4 / 3' }}>
      <StudioCanvas
        label="Pulse speaker, three-quarter view"
        description="A compact speaker with a perforated metal grille and a knurled dial on top."
        paused={paused}
        camera={{ fov: 30, position: [3, 2, 4] }}
        fallback={<SceneFallback title="Pulse speaker" image="/models/pulse-speaker.webp" imageAlt="Static render of the speaker" />}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 2]} intensity={2} />
        <Turntable angle={angle} highlight={paused} />
      </StudioCanvas>
      <button type="button" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>Freeze view</button>
    </div>
  );
}
```

Props you will use most: `label` (required), `description`, `fallback`, `quality` (`'auto'` or a level),
`profiles` (from `createQualityProfiles`), `frameloop`, `paused`, `lazy`, `adaptive`, `disabled`,
`onQualityChange`, `onSceneError`, plus any R3F `Canvas` prop (`camera`, `flat`, `shadows`, `gl`). Passing `gl`
replaces the kit's renderer defaults (antialias and power preference from the profile): set them yourself.

## 3. StrictMode

In development, React 18+ mounts, cleans up and re-runs every effect of a newly mounted component. R3F bridges a
parent `<StrictMode>` into the canvas tree, and Next.js App Router enables Strict Mode in development by default.

- Create GPU resources inside the effect that disposes them, so the second run creates fresh ones.
- If an object is created in `useMemo` and disposed in an effect cleanup, the re-run receives the disposed object.
  Either make disposal reversible (`OrbitControls.dispose()` only disconnects; the connect effect re-runs) or move
  creation into the effect.
- Never rely on an effect running once (analytics, one-shot camera moves): guard with a ref or derive from state.
- Kit status: `Model`/`useModel` is built for it (reference counting plus a 1 s eviction delay). `PartController`
  creates its core in `useMemo` and disposes it in an effect cleanup, so a controller that mounts with a non-null
  `root` can be left inert in development. Use the gallery pattern: keep the loaded model in state from
  `<Model onLoaded>` and pass `root={loaded?.scene ?? null}`, so the core is created on an update. Verify overrides
  apply in `npm run dev`.
- The e2e suite serves a production build by default, where effects run once; StrictMode problems only show in
  `npm run dev` (or with `STUDIO3_E2E_DEV=1`).

## 4. Vanilla three.js: `createVanillaScene`

For non-React projects. It creates the renderer from a quality profile, sizes it with a `ResizeObserver`,
renders on demand, pauses its loop off-screen and in hidden tabs, and tears everything down in `dispose()`.
It does not detect capabilities or handle context loss: add both.

```ts
import { AmbientLight, BoxGeometry, DirectionalLight, Mesh, MeshStandardMaterial } from 'three';
import { createVanillaScene, defaultQualityProfiles, detectCapabilities, pickQualityLevel } from './three';

export function mountViewer(host: HTMLElement, fallback: HTMLElement): { dispose(): void; play(): void; pause(): void } {
  const caps = detectCapabilities();
  if (!caps.webgl2) { // three r163+ requires WebGL 2
    fallback.hidden = false;
    return { dispose() {}, play() {}, pause() {} };
  }
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  const app = createVanillaScene(host, defaultQualityProfiles[pickQualityLevel(caps, { saveData })], { fov: 30 });
  app.camera.position.set(3, 2, 4);
  app.camera.lookAt(0, 0, 0);
  const key = new DirectionalLight(0xffffff, 2);
  key.position.set(3, 5, 2);
  const box = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ color: '#c9c2b4' }));
  app.scene.add(new AmbientLight(0xffffff, 0.6), key, box);
  app.invalidate();

  const canvas = app.renderer.domElement;
  const lost = () => { canvas.hidden = true; fallback.hidden = false; }; // three already called preventDefault()
  const restored = () => { canvas.hidden = false; fallback.hidden = true; app.invalidate(); };
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);

  let stop: (() => void) | null = null;
  return {
    play() { stop ??= app.loop((dt) => { box.rotation.y += dt * 0.4; }); }, // started by a user control only
    pause() { stop?.(); stop = null; },
    dispose() {
      stop?.();
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
      app.dispose(); // disposes everything under app.scene, the renderer and the canvas element
    },
  };
}
```

After a restore, three re-uploads geometry and textures it still has data for, but GPU-only content is gone:
regenerate PMREM environments, render-target contents and baked textures, then `invalidate()`.

## 5. Disposal helpers (`dispose.ts`)

| Helper | Use for |
|---|---|
| `disposeObject(root)` | A subtree you created: geometries, materials, textures (incl. uniform textures), skeletons. Returns the count released |
| `disposeMaterial(material)` | One material and the textures it references |
| `new ResourceTracker()` → `track(x)` → `dispose()` | Everything an effect created; Object3Ds are disposed and removed from their parent |
| `disposeRenderer(renderer, { loseContext })` | Vanilla renderers you created yourself (stops `setAnimationLoop`, disposes, forces context loss by default, removes the canvas) |

```tsx
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, Points, PointsMaterial } from 'three';
import { ResourceTracker } from './three';

/** Imperative points cloud owned by this component. Prefer JSX when R3F can own it. */
export function Dust({ count }: { count: number }) {
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const tracker = new ResourceTracker();
    const geometry = new BufferGeometry();
    const positions = Float32Array.from({ length: count * 3 }, (_, i) => Math.sin(i * 12.9898) * 2);
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    scene.add(tracker.track(new Points(geometry, new PointsMaterial({ size: 0.02 }))));
    invalidate();
    return () => { tracker.dispose(); invalidate(); };
  }, [count, scene, invalidate]);
  return null;
}
```

Not covered by the helpers: render targets (`target.dispose()`), `EffectComposer` (`composer.dispose()`), PMREM
generators, controls, `AnimationMixer` caches (`stopAllAction()` + `uncacheRoot()`), `ImageBitmap` images
(`bitmap.close()`; `texture.dispose()` does not release them), workers and event listeners.

Verify release: when a child component remounts inside the same canvas, `window.__STUDIO3_3D__.renderer.geometries`
and `.textures` (or `useCanvasDiagnostics()`) return to their earlier values; a remounted `StudioCanvas` starts a
new renderer from zero. The gallery's Replay button and the Visual Director's `3d-cleanup`
check (navigate away and back) exercise this; the latter reports `limited` when only re-initialisation, not
release, could be observed.

## 6. Render on demand

`frameloop="demand"` draws a frame only when something calls `invalidate()`. R3F calls it for you when a
declarative prop of an R3F object changes, when the canvas resizes and when its store changes. You call it after
mutating through a ref, after loading something imperatively, and on every frame of an animation until it settles:

```tsx
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { MathUtils, type Group } from 'three';

export function SettleToAngle({ target }: { target: number }) {
  const group = useRef<Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => { invalidate(); }, [target, invalidate]); // no R3F prop changed: start the frames yourself
  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    g.rotation.y = MathUtils.damp(g.rotation.y, target, 6, Math.min(dt, 1 / 30));
    if (Math.abs(g.rotation.y - target) > 1e-4) state.invalidate(); // keep going until settled
    else g.rotation.y = target;
  });
  return <group ref={group}><mesh><boxGeometry /><meshStandardMaterial /></mesh></group>;
}
```

`useFrame` callbacks only run on rendered frames, so the first `invalidate()` must come from the change itself: a
React prop that no R3F object receives does not request a frame, hence the effect above. Clamp `dt`: the first
frame after a long idle period has a huge delta.

A continuous loop (`frameloop="always"`) is legitimate only while something changes every frame without input: a
time-driven shader, an awake physics simulation, a playing clip, particles, a video texture. Switch the prop back
to `demand` when it stops (`shader-aurora-plane` does this under reduced motion). The kit's `AnimationPlayer`,
`CameraRig`, `OrbitInspect` (damping tail, auto-rotate) and `PartController` (explode) already invalidate frame by
frame in demand mode. Invalidations made while `StudioCanvas` is paused or off-screen (`frameloop` `never`) are
dropped; switching back renders one frame, and animations continue from there.

## 7. Resize and pixel ratio

- R3F measures the canvas wrapper and resizes renderer and camera itself. `createVanillaScene` uses a
  `ResizeObserver` on the container, clamps the pixel ratio to the profile's `dpr` range and calls
  `setSize(w, h, false)` (CSS size stays under your stylesheet's control).
- `StudioCanvas` passes the profile's `dpr: [min, max]` to R3F. With `frameloop="always"` and `adaptive` (default)
  it lowers DPR in steps of 0.125 (down to half) when the median frame time stays above target, and raises it
  again when frames are fast. It does not change the quality level by itself: `createAdaptiveQuality` reports
  `degrade`, which nothing consumes; wire it yourself if a level step is needed.
- The Visual Director's `3d-resize` check fails a canvas whose drawing buffer does not follow its CSS size, that
  stretches, or that is not redrawn after a resize.

## 8. Checklist

- [ ] One renderer per view; no `new WebGLRenderer` inside `StudioCanvas`.
- [ ] Every imperatively created GPU resource has an owner that disposes it; primitives are owned explicitly.
- [ ] Scene renders on demand; any continuous loop is justified, stops when idle and pauses off-screen.
- [ ] Context loss shows the fallback, never a blank box; vanilla scenes listen for loss and restore.
- [ ] Remount (Replay, route change, StrictMode in dev) leaves `renderer.info.memory` where it was.
- [ ] Resizing the window keeps the image sharp and unstretched.
