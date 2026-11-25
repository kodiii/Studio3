# Animation in 3D — clips, procedural motion, camera choreography, timelines

> **Quick card** — the must-dos from this file; read on for the reasons and the detail.
>
> - Clamp `dt`, damp with `MathUtils.damp`, allocate vectors once (never inside `useFrame`), and once settled snap to the target and stop invalidating.
> - Tween plain data, not scene objects React also sets; give every property one owner; interrupt, never queue.
> - In demand mode call `invalidate()` from each timeline's `onUpdate`, and revert or cancel every timeline on unmount.
> - Never disable controls during a transition; user input always wins.
> - Read reduced motion from `useStudioMotion().reduced`, never a one-off media query.
> - Under reduced motion, remove auto-rotate and ambient effects, cut camera moves in one frame, never autoplay clips, and replace scroll-scrubbed travel with step buttons.
> - Build clip controls in DOM: Play/Pause with `aria-pressed`, a scrub range with `aria-valuetext` in seconds.
> - Clone skinned models with `SkeletonUtils.clone`; a plain `clone()` shares bones.

Motion in a scene has the same jobs as motion in a page: explain a change, show how something works, or set a
mood. Each must be interruptible, cheap when idle, and correct under reduced motion. DOM choreography and tokens
belong to `studio-motion`; this file covers what happens inside the canvas.

## 1. Pick the mechanism

| Motion | Mechanism | Kit support |
|---|---|---|
| Authored animation in the model (a dial turning, a lid opening) | glTF clips through one `AnimationMixer` | `AnimationPlayer` |
| Settling, following, hover lift, sway | Procedural: damped values in `useFrame` | `CameraRig`/`PartController` use critically damped springs |
| Moving between named viewpoints | Camera rig with spherical interpolation | `CameraRig` |
| A path through a space | `CatmullRomCurve3` sampled by arc length | `scroll-camera-dolly` recipe |
| Many tracks in sync with DOM or scroll | GSAP timeline or `createSequence().seek()` driving plain objects | §4 |
| Exploding, isolating, re-assembling parts | Per-part offsets from extras | `PartController explode` |

## 2. Clips: `AnimationPlayer`

| Prop / method | Behaviour |
|---|---|
| `root`, `clips` | The loaded clone and its clips (`useModel()` / `<Model onLoaded>`) |
| `clip` | Active clip name (default: the first). Changing it while playing cross-fades for `crossFade` s (default 0.3); under reduced motion it switches |
| `autoPlay` | Ignored under reduced motion: motion that is the content starts from a control |
| `speed`, `loop` | `mixer.timeScale`; `LoopRepeat` or `LoopOnce` with `clampWhenFinished` |
| `onState`, `stateInterval` | `{ clip, time, duration, playing }` every 100 ms while playing and on every change: drive DOM transport controls without per-frame React state |
| `play()`, `pause()`, `toggle()`, `seek(seconds)`, `getState()` | Imperative transport; `seek` renders the pose whether playing or not |

The mixer ticks only while playing and each tick requests one more frame, so a paused clip costs nothing. On
unmount it calls `stopAllAction()` and `uncacheRoot(root)`. Build the transport in DOM: a Play/Pause button with
`aria-pressed`, a range input for scrubbing with `aria-valuetext` in seconds, speed and loop controls.

Vanilla equivalent:

```ts
import { AnimationMixer, LoopOnce, type AnimationClip, type Object3D } from 'three';

export function playOnce(root: Object3D, clip: AnimationClip, invalidate: () => void): { update(dt: number): boolean; dispose(): void } {
  const mixer = new AnimationMixer(root);
  const action = mixer.clipAction(clip);
  action.setLoop(LoopOnce, 1);
  action.clampWhenFinished = true; // hold the last pose
  action.play();
  let playing = true;
  mixer.addEventListener('finished', () => { playing = false; });
  return {
    update(dt) { if (playing) { mixer.update(Math.min(dt, 0.1)); invalidate(); } return playing; },
    dispose() { mixer.stopAllAction(); mixer.uncacheRoot(root); },
  };
}
```

Skeletal and morph notes:

- Clone skinned models with `SkeletonUtils.clone` (the kit's `useModel` does); a plain `clone()` shares bones.
- A skinned mesh animated far from its bind pose can be culled while visible: recompute its bounds after posing or
  set `frustumCulled = false` on that mesh.
- Morph targets: animate `mesh.morphTargetInfluences[i]` with damped values, or play the clip that targets them.
- The asset pipeline does not simplify skinned or morph meshes unless asked (`--allow-skinned-simplify`).
- `KHR_animation_pointer` (animating material properties) is not supported by the pipeline; animate emissive or
  colour procedurally instead (the sample `LightPulse` clip animates scale for this reason).

## 3. Procedural motion

- Use `dt` clamped (`Math.min(dt, 1 / 30)`) and frame-rate-independent damping (`MathUtils.damp(current, target,
  lambda, dt)`); a fixed `lerp(…, 0.1)` per frame runs twice as fast at 120 Hz.
- Allocate vectors once (`useMemo`/`useRef`), never inside `useFrame`.
- Keep animating only while not settled; then snap to the target and stop invalidating (`lifecycle.md` §6).
- Seeded, deterministic variation; time from accumulated `dt`, not `Date.now()`.

## 4. Timelines driving the scene (GSAP or Motion Lab)

Rules:

1. **Tween plain data, not scene objects React also sets.** A `{ px, py, pz }` object, a uniform's `value`, a
   progress number. The scene copies the data onto three objects in `useFrame`.
2. **One owner per property.** If `CameraRig` moves the camera, a timeline must not also tween
   `camera.position`; switch the rig off (`stop()`) or drive the rig.
3. **Request frames.** In demand mode call `invalidate()` from the timeline's `onUpdate`. R3F exports a global
   `invalidate` usable outside the canvas.
4. **Clean up.** `useGSAP({ scope })` reverts on unmount; elsewhere `gsap.context()` + `revert()`, or
   `sequence.cancel()` for `createSequence`.
5. **Interrupt, never queue.** Retarget from the current value (`overwrite: 'auto'`, `gsap.quickTo`, or kill and
   recreate).

ScrollTrigger scrub → timeline → camera, with CSS sticky instead of GSAP pinning:

```tsx
'use client';
import { useRef, type RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { invalidate, useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useStudioMotion } from './motion';
import { StudioCanvas } from './three';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger, useGSAP);

type Shot = { px: number; py: number; pz: number; tx: number; ty: number; tz: number };
const SHOTS: Shot[] = [
  { px: 0, py: 1.4, pz: 6, tx: 0, ty: 1, tz: 0 },
  { px: 3, py: 2, pz: 3.5, tx: 0, ty: 0.8, tz: 0 },
  { px: -2, py: 1.2, pz: 2.5, tx: 0, ty: 1.1, tz: 0 },
];

/** Reads the shared shot every rendered frame. GSAP writes it; nothing re-renders React. */
function CameraFromShot({ shot }: { shot: RefObject<Shot> }) {
  const camera = useThree((s) => s.camera);
  const look = useRef(new Vector3());
  useFrame(() => {
    const s = shot.current;
    camera.position.set(s.px, s.py, s.pz);
    camera.lookAt(look.current.set(s.tx, s.ty, s.tz));
  });
  return null;
}

export function ScrollShot({ children }: { children: React.ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const shot = useRef<Shot>({ ...SHOTS[0] });
  const { reduced } = useStudioMotion();
  useGSAP(() => {
    if (reduced) return; // reduced motion: no scrub; the buttons below cut between shots
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: section.current, start: 'top top', end: 'bottom bottom', scrub: 0.6 },
      onUpdate: () => invalidate(),
    });
    tl.to(shot.current, { ...SHOTS[1] }, 0).to(shot.current, { ...SHOTS[2] }, 1);
  }, { scope: section, dependencies: [reduced], revertOnUpdate: true });

  const cut = (i: number) => { Object.assign(shot.current, SHOTS[i]); invalidate(); };
  return (
    <section ref={section} style={{ height: reduced ? 'auto' : '300vh' }}>
      <div style={{ position: reduced ? 'relative' : 'sticky', top: 0, height: reduced ? '70vh' : '100vh' }}>
        <StudioCanvas label="Camera move around the speaker" camera={{ fov: 35, position: [0, 1.4, 6] }}>
          <CameraFromShot shot={shot} />
          {children}
        </StudioCanvas>
      </div>
      {reduced ? (
        <div role="group" aria-label="Viewpoints">
          {SHOTS.map((_, i) => <button key={i} type="button" onClick={() => cut(i)}>View {i + 1}</button>)}
        </div>
      ) : null}
    </section>
  );
}
```

Without GSAP, use plain maths on a progress value instead (`useScrollProgress` → ref → `invalidate()`, §5);
`createSequence` animates DOM elements, not scene data. Reach for GSAP when tracks multiply.
Scroll mechanics, pinning and smoothing: `studio-motion` `references/scroll.md`; DOM ↔ scene contracts:
`studio-motion` `references/3d-sync.md`.

## 5. Scroll-to-3D mapping without a timeline

`scroll-camera-dolly` is the house example: `useScrollProgress(track, apply, { mode: 'contain' })` writes progress
into a ref and calls `invalidate()`; the scene eases its own copy towards it
(`eased += (goal − eased) × (1 − e^(−7·dt))`) and samples a `CatmullRomCurve3` with `getPointAt` (arc length, so
speed is even), looking a little ahead along the path. Captions are DOM, faded from the same progress.

Mapping rules:

- Split progress into named segments; give each a shot and a caption. Ease within segments (smoothstep), not
  across the whole scroll.
- Keep direction consistent inside a segment: no camera reversals while the user scrolls forward.
- Leave a rest zone at each shot so a stopped scroll frames something meaningful.
- Reduced motion: no scrubbed travel; the section stops being scroll-driven and step buttons cut between
  viewpoints (the dolly recipe does exactly this).

## 6. Interaction states

- Hover, selected, pressed: store target values in refs, damp in `useFrame` (scale 1 → 1.03, emissive lift,
  slight lift on Y). React state changes only when the state changes, not per frame.
- Timing follows the motion tokens (`fast` for hover, `base` for selection); convert with `sec()` when a library
  wants seconds.
- Under reduced motion apply the end state in one frame; keep the non-motion cue (colour, outline, DOM text).

## 7. Interruption

| Animation | How it is interrupted |
|---|---|
| `CameraRig.goTo` | A new `goTo` retargets keeping velocity; user input on `OrbitInspect` stops it and fires `onInterrupt` |
| `PartController explode` | New target values retarget the damped approach |
| `AnimationPlayer` clip change | Cross-fade from the current pose |
| GSAP tween | `overwrite: 'auto'`, `quickTo`, or `kill()` then a new tween from the current value |
| `createSequence` | `cancel()` or `seek()`; `play()` restarts |

Never disable controls during a transition, and never queue transitions behind each other.

## 8. Reduced motion in 3D

| Motion | Tier | Under reduced motion |
|---|---|---|
| Auto-rotate, ambient particles, background shaders, idle camera drift | 1 Remove | Off; resting frame shown |
| Camera moves between presets, explode/assemble, focus on a part | 2 Replace | Cut in one frame (`CameraRig`, `PartController` do this); optional opacity cross-fade of the DOM overlay ≤ 200 ms |
| A product demonstration clip, a turntable the user asked for | 3 Keep behind control | Never autoplays; Play button; pausable; scrubbable |
| Scroll-scrubbed camera travel | 1 or 3 | Not scroll-driven; step buttons cut between viewpoints |

Read the preference from `useStudioMotion().reduced` (OS setting plus in-app toggle), never from a one-off media
query in a scene component.

## 9. Checklist

- [ ] Each animation has one owner and one source of truth (clip, damped value or timeline).
- [ ] Idle scenes render nothing: mixers, rigs and timelines stop invalidating when done.
- [ ] Every timeline is reverted or cancelled on unmount; React StrictMode in dev leaves no duplicates.
- [ ] All transitions are interruptible; user input always wins.
- [ ] Reduced motion behaviour matches §8 and was checked with the in-app toggle and the OS setting.
