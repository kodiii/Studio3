# 3D sync — DOM motion and WebGL scenes in step

When page motion and a scene must move together (scroll drives a camera, a button opens a panel while the model
turns, captions follow a camera path), agree on one shared value, one writer, one reader and who requests frames.
Camera choreography, clips and scene-side easing are in `studio-3d` `references/animation.md`; this file is the
DOM side of the contract.

## 1. The contract

| Decide | Rule |
|---|---|
| Shared value | A number (progress 0–1), a small plain object (a camera shot), or uniforms. Never a three.js object React also renders |
| Writer | Exactly one: a scroll hook, a GSAP timeline, a Motion value, a `createSequence` `call()` |
| Reader | The scene, inside `useFrame`, copying the value onto three objects |
| Transport | A ref (`useRef`) shared by both sides. Not React state: a re-render per frame costs more than the frame |
| Frames | The writer calls `invalidate()` after each write (demand rendering). R3F exports a global `invalidate` usable outside the canvas |
| Reduced motion | One source (`useStudioMotion().reduced`) for both sides: DOM and scene cut together |

## 2. Scroll → scene

Without a library: `useScrollProgress(track, (p) => { progress.current = p; invalidate(); }, { mode: 'contain',
enabled: !reduced })`; the scene eases its own copy towards the goal and keeps invalidating until it settles. The
`scroll-camera-dolly` recipe is the reference implementation, including DOM captions faded from the same
progress and step buttons under reduced motion.

With GSAP (many tracks, snapping, labels): a scrubbed timeline tweens a plain "shot" object; `onUpdate` calls
`invalidate()`; the scene copies the shot onto the camera (full example in `studio-3d` `animation.md` §4).

With Motion (the project already uses it):

```tsx
'use client';
import { useRef, type RefObject } from 'react';
import { useMotionValueEvent, useScroll } from 'motion/react';
import { invalidate, useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { useStudioMotion } from './motion';
import { StudioCanvas } from './three';

function Turn({ progress }: { progress: RefObject<number> }) {
  const group = useRef<Group>(null);
  useFrame(() => { if (group.current) group.current.rotation.y = progress.current * Math.PI; });
  return <group ref={group}><mesh><torusKnotGeometry args={[0.6, 0.2, 128, 16]} /><meshStandardMaterial color="#c9c2b4" /></mesh></group>;
}

export function ScrollTurn() {
  const section = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const { reduced } = useStudioMotion();
  const { scrollYProgress } = useScroll({ target: section, offset: ['start end', 'end start'] });
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (reduced) return;    // decorative coupling: removed under reduced motion
    progress.current = v;
    invalidate();           // demand rendering: one frame per change
  });
  return (
    <section ref={section} style={{ minHeight: '150vh' }}>
      <div style={{ position: 'sticky', top: 0, height: '80vh' }}>
        <StudioCanvas label="A knotted form turning as you scroll" camera={{ position: [0, 0, 3] }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[2, 3, 2]} intensity={2} />
          <Turn progress={progress} />
        </StudioCanvas>
      </div>
    </section>
  );
}
```

## 3. DOM sequence ↔ scene

- **Start together**: a `createSequence` step's `call(() => { target.current = 'open'; invalidate(); }, 'panel')`
  hands the scene a new target at a label; the scene animates with its own damping and duration tokens converted
  with `sec()`.
- **Scrub together**: when one progress value drives both, call `sequence.seek(p)` for the DOM and write `p` to
  the scene's ref in the same callback.
- **Finish together**: the scene reports arrival (`CameraRig onArrive`), and the DOM reveals the next caption from
  that event, not from a guessed timeout.

## 4. Libraries and frame loops

- Do not drive R3F from `gsap.ticker` or another rAF loop. Write values in the library's update callback and let
  R3F render the requested frame in its own loop; both run inside the browser's animation frame.
- Only a scene with `frameloop="never"` is rendered by hand (`advance(timestamp)` from R3F); `StudioCanvas` does
  not need this.
- Motion's `motion/three` entry (`threeEffect`, in the installed 14.14) binds motion values to three.js objects and
  uniforms; it writes values but does not request R3F frames, so a demand-rendered canvas still needs
  `invalidate()`. The Maquettekit kit does not use it: verify its behaviour before adopting it.
- Never let a DOM library tween a three.js object's properties that a kit component also writes (`CameraRig` owns
  the camera while a preset transition runs).

## 5. Timing and tokens

- Use the same tokens on both sides: the DOM panel opens over `moderate`, the camera's `smoothTime` is about
  `sec(duration.moderate)`; under the Immersive profile both scale by `scale.duration`.
- Let the user's input lead: a click updates the DOM state in the same frame and starts the scene move; neither
  waits for the other.
- Captions and labels are DOM; position them from scene values after a rendered frame (the kit's hotspots and the
  spatial-data demo project labels this way) rather than rendering text in the canvas.

## 6. Checklist

- [ ] One writer, one reader, one shared ref per value; no React state per frame.
- [ ] Every write in a demand-rendered scene is followed by `invalidate()`.
- [ ] DOM and scene read reduced motion from the same source and cut together.
- [ ] Both sides use the same tokens; arrivals are events, not timeouts.
- [ ] Timelines and subscriptions die with their component (`cleanup.md`).
