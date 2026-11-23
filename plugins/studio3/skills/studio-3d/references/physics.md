# Physics — only when collisions are the content

A physics engine is a second simulation running next to the renderer: a WASM download, a fixed-rate loop, memory
per body, and behaviour you cannot script exactly. Most "physical-feeling" motion is a damped spring.

## 1. Is physics justified?

| The user should see… | Use | Why |
|---|---|---|
| An object springing back, settling, following the pointer | `MathUtils.damp`, critically damped springs (`CameraRig`'s approach), Motion springs | Exact, cheap, interruptible |
| A fall with one bounce, a scripted tumble | Keyframes or an easing curve (`overshoot`, `springToLinear`) | Repeatable, art-directable |
| Parallax, sway, float | Maths in `useFrame` or a shader | No bodies needed |
| Things stacking, toppling, colliding in ways nobody scripted | **Physics** | The outcome depends on the user |
| Chains, hinges, ragdolls, ropes, springs between bodies | **Physics** (joints) | Constraint solving |
| Throwing an object that must land and come to rest anywhere | **Physics** (+ CCD) | Contact resolution |

If the first three rows describe the request, do not add `@react-three/rapier`. Record the decision in the
technology report (`technology-selection.md` §4).

## 2. `@react-three/rapier` 2.2 — verified facts

| Item | Installed behaviour |
|---|---|
| Engine | `@dimforge/rapier3d-compat` 0.19 (Apache-2.0): WASM inlined as base64 in a JS module (about 2.2 MB on disk, before compression; measure your bundle) |
| Loading | `<Physics>` dynamically imports the engine and suspends until `init()` resolves: wrap it in `<Suspense>`; bundlers split it into its own chunk |
| `timeStep` | `1/60` fixed step with an accumulator (frame delta clamped to 0.5 s); `"vary"` steps with the frame delta |
| `interpolate` | `true`: bodies are drawn between the last two steps (no effect with `"vary"`) |
| `updateLoop` | `"follow"` (default): stepped inside R3F's `useFrame`. `"independent"`: its own `requestAnimationFrame` loop that calls `invalidate()` while any body is awake |
| `paused` | Skips stepping; the independent rAF keeps ticking cheaply |
| `gravity` | `[0, -9.81, 0]` (metres, seconds) |
| `colliders` | Automatic collider per mesh, default `"cuboid"`; also `"ball"`, `"hull"`, `"trimesh"`, `false` |
| Bodies | `type`: `"dynamic"`, `"fixed"`, `"kinematicPosition"`, `"kinematicVelocity"`; `canSleep` default `true`; `ccd` default `false`; `softCcdPrediction` default `0`; damping, `gravityScale`, `lockRotations`, `enabledRotations`; events `onCollisionEnter/Exit`, `onIntersectionEnter/Exit`, `onContactForce`, `onSleep`, `onWake` |
| Colliders | `CuboidCollider`, `BallCollider`, `CapsuleCollider`, `CylinderCollider`, `ConeCollider`, `RoundCuboidCollider`, `ConvexHullCollider`, `TrimeshCollider`, `HeightfieldCollider`, `MeshCollider` |
| Joints | `useFixedJoint`, `useSphericalJoint`, `useRevoluteJoint`, `usePrismaticJoint`, `useRopeJoint`, `useSpringJoint` — each `(bodyRefA, bodyRefB, params)` |
| Hooks | `useRapier()` (`rapier`, `world`, `step(dt)`, `isPaused`), `useBeforePhysicsStep`, `useAfterPhysicsStep` |
| Many bodies | `InstancedRigidBodies` (one instanced mesh, one body each) |
| Cleanup | Unmounting `<Physics>` frees the world; unmounting a `RigidBody` removes its body and colliders |

Check these against the installed version before relying on a detail; the API has changed between majors.

## 3. Render loop: physics inside `StudioCanvas`

`StudioCanvas` renders on demand. With the default `updateLoop="follow"`, the world only steps on frames something
else requested, so the simulation stalls. Use `updateLoop="independent"`: the world steps on its own and requests a
frame only while bodies move, so a settled stack costs no rendering. Pause it when the canvas is off-screen and
when the user pauses.

```tsx
'use client';
import { Suspense, useRef, useState, type RefObject } from 'react';
import { CuboidCollider, Physics, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import { useInView, useStudioMotion } from './motion';
import { SceneFallback, StudioCanvas, useQuality } from './three';

function Blocks({ bodies }: { bodies: RefObject<(RapierRigidBody | null)[]> }) {
  const { density } = useQuality();
  const count = Math.max(3, Math.round(12 * density)); // body cap from the quality profile
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <RigidBody key={i} ref={(b) => { bodies.current[i] = b; }} position={[((i % 3) - 1) * 0.6, 0.3 + Math.floor(i / 3) * 0.55, 0]} colliders="cuboid">
          <mesh castShadow><boxGeometry args={[0.5, 0.5, 0.5]} /><meshStandardMaterial color="#c9c2b4" /></mesh>
        </RigidBody>
      ))}
    </>
  );
}

export function StackPlayground() {
  const { reduced } = useStudioMotion();
  const host = useRef<HTMLDivElement>(null);
  const inView = useInView(host, { once: false, amount: 0 });
  const [running, setRunning] = useState(false); // nothing moves until the user acts
  const [generation, setGeneration] = useState(0); // remounting <Physics> is the reset
  const bodies = useRef<(RapierRigidBody | null)[]>([]);
  const push = (dir: 1 | -1) => {
    for (const b of bodies.current) b?.applyImpulse({ x: 0.4 * dir, y: 0.3, z: 0 }, true);
    setRunning(true);
  };
  return (
    <div>
      <div ref={host} style={{ position: 'relative', height: 420 }}>
        <StudioCanvas
          label="Stack of wooden blocks on a table" role="group"
          description="Wooden blocks stacked in rows of three. Push them with the buttons below or drag one."
          camera={{ position: [0, 2.5, 6], fov: 40 }}
          fallback={<SceneFallback title="Block stack" description="A still image of the stacked blocks." />}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 6, 2]} intensity={2} castShadow />
          <Suspense fallback={null}>
            <Physics key={generation} paused={!running || !inView} updateLoop="independent">
              <Blocks bodies={bodies} />
              <RigidBody type="fixed" colliders={false}>
                <CuboidCollider args={[4, 0.1, 4]} position={[0, -0.1, 0]} />
                <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[8, 8]} /><meshStandardMaterial color="#e8e3d8" /></mesh>
              </RigidBody>
            </Physics>
          </Suspense>
        </StudioCanvas>
      </div>
      <div role="group" aria-label="Simulation">
        <button type="button" aria-pressed={!running} onClick={() => setRunning((r) => !r)}>{running ? 'Pause' : 'Play'}</button>
        <button type="button" onClick={() => push(-1)}>Push left</button>
        <button type="button" onClick={() => push(1)}>Push right</button>
        <button type="button" onClick={() => { bodies.current = []; setGeneration((g) => g + 1); setRunning(false); }}>Reset</button>
      </div>
      <p>{reduced ? 'Reduced motion: blocks move only when you push them.' : 'Drag a block, or use the buttons.'}</p>
    </div>
  );
}
```

Alternatives: keep `<Physics paused>` and drive it yourself with
`useFrame((_, dt) => step(Math.min(dt, 1 / 20)))` from `useRapier()` — `step()` invalidates while any body is awake,
so the loop idles once everything sleeps, and the clamp stops a resumed tab fast-forwarding (the
`physics-playground` demo does this); or switch `StudioCanvas` to `frameloop="always"` only while `running` (simple,
but renders when nothing moves).

## 4. Fixed timestep and sleeping

- Keep the fixed `timeStep`. `"vary"` ties results to frame rate and destabilises stacks on slow frames.
- Sleeping (`canSleep`, default on) is what makes `"independent"` cheap: resting bodies stop invalidating. Wake bodies
  you move from code (`applyImpulse(v, true)`, `setTranslation(v, true)`: the last argument wakes them).
- `onSleep`/`onWake` are good places to update DOM status ("Stack settled").
- Skipping to rest (for reduced motion or a "Settle" button): `useRapier().step(1 / 60)` in a loop of a few hundred
  iterations, then `invalidate()`. Measure the cost; it blocks the main thread while it runs.

## 5. Colliders

| Shape | Cost | Use |
|---|---|---|
| Cuboid, ball, capsule, cylinder, cone | Cheapest, most stable | Almost everything; approximate visual meshes |
| Convex hull | Moderate | Irregular convex props (rocks, bottles) |
| Trimesh | Expensive, fragile for dynamic bodies | Fixed level geometry only |
| Heightfield | Cheap for terrain | Ground with relief |

For a GLB, set `colliders={false}` on the body and add a few primitive colliders that match the silhouette; an
automatic collider per mesh of a detailed model is slow and lumpy.

## 6. Kinematic dragging and throwing

Switch the body to kinematic while held, move it with `setNextKinematicTranslation` along a drag plane, and hand the
pointer's velocity back on release. Disable orbit controls during the drag: their DOM listener sees the same
pointer.

```tsx
'use client';
import { useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { RigidBody, useRapier, type RapierRigidBody } from '@react-three/rapier';
import { Plane, Vector3 } from 'three';

export function DraggableCrate({ position }: { position: [number, number, number] }) {
  const { rapier } = useRapier();
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;
  const body = useRef<RapierRigidBody>(null);
  const drag = useRef<{ plane: Plane; hit: Vector3; prev: Vector3; t: number; vel: Vector3 } | null>(null);

  const down = (e: ThreeEvent<PointerEvent>) => {
    const b = body.current;
    if (!b) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    if (controls) controls.enabled = false;
    const at = new Vector3().copy(b.translation());
    drag.current = { plane: new Plane(new Vector3(0, 1, 0), -at.y), hit: new Vector3(), prev: at, t: performance.now(), vel: new Vector3() };
    b.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
  };
  const move = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    const b = body.current;
    if (!d || !b || !e.ray.intersectPlane(d.plane, d.hit)) return;
    const now = performance.now();
    d.vel.subVectors(d.hit, d.prev).divideScalar(Math.max(1, now - d.t) / 1000);
    d.prev.copy(d.hit);
    d.t = now;
    b.setNextKinematicTranslation(d.hit);
  };
  const up = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    const b = body.current;
    drag.current = null;
    if (controls) controls.enabled = true;
    (e.target as Element).releasePointerCapture(e.pointerId);
    if (!d || !b) return;
    b.setBodyType(rapier.RigidBodyType.Dynamic, true);
    b.setLinvel(d.vel.clampLength(0, 8), true); // cap the throw speed
  };
  return (
    <RigidBody ref={body} position={position} colliders="cuboid" ccd>
      <mesh castShadow onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#b98a35" />
      </mesh>
    </RigidBody>
  );
}
```

Dragging needs a single-pointer, non-drag alternative (WCAG 2.5.7): buttons that push, drop or move the selected
body, and arrow keys on a focused DOM control that call `applyImpulse`.

## 7. CCD, caps and stability

- `ccd` on small fast bodies (thrown objects, projectiles) stops tunnelling through thin walls; it costs substeps.
  `softCcdPrediction` is a cheaper predictive alternative for slow-but-thin cases.
- Cap dynamic bodies from the quality profile (`density` × a number you measured) and enforce it in the UI:
  disable "Add" at the cap or recycle the oldest body. Unbounded spawning is the usual way playgrounds die on phones.
- Keep sizes near 0.1–10 units and masses within a few orders of magnitude of each other; extreme ratios jitter.
- Limit solver work before raising it: fewer bodies and simpler colliders beat higher `numSolverIterations`.

## 8. Determinism caveats

- Same build, same timestep, same inputs, same creation order (React render order) reproduces a run on one device.
  Across browsers and CPUs, do not promise identical results; Rapier documents a separate cross-platform
  deterministic build upstream, which is not the package installed here.
- `"vary"` timesteps, wall-clock inputs and `Math.random()` positions make runs unrepeatable — and screenshot
  comparisons in the review loop noisy. Seed initial positions.

## 9. Accessibility and reduced motion

- Physics output is visual only: describe the state in DOM ("4 blocks standing, 8 on the floor") with
  `role="status"`, updated on settle, not on every step.
- Motion that is the content (a playground) is tier 3: nothing falls or tumbles on load; the user starts it; Pause
  and Reset are always visible. Decorative physics (blocks tumbling in a hero) is tier 1: remove it under reduced
  motion and show the settled state.
- Essential actions never depend on the simulation.

## 10. Checklist

- [ ] §1 table says physics is needed; the reason is in the report.
- [ ] `<Physics>` is in `<Suspense>`, loaded only for the scene that needs it; `updateLoop` matches the frame loop.
- [ ] Paused off-screen and on user request; settled scenes render nothing.
- [ ] Primitive colliders; body cap enforced; CCD only where tunnelling was seen.
- [ ] Drag has button/keyboard alternatives; state is announced in text; reduced motion starts still.
