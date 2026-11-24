# Spatial UI — depth, navigation, feedback and comfort

A 3D interface adds a dimension people navigate with a 2D pointer on a flat screen. Design for the hand and eye
first: what to look at, how to move, how to get back. The numbers in this file are starting points to test on
the target devices, not standards.

## 1. Depth hierarchy

Depth must say what matters. Rank every object: **subject** (what the user came for), **context** (floor,
room, neighbours), **decoration**.

| Lever | Pushes forward | Pushes back |
|---|---|---|
| Light | Key light and rim on the subject; specular highlights | Lower exposure, no rim, softer contrast |
| Colour | Saturation, the accent token | Desaturated, closer to the background token |
| Atmosphere | Clear | Fog or colour falloff with distance (cheap, no pass) |
| Detail | Full-resolution textures, crisp edges | Simplified geometry, lower texture resolution |
| Motion | Responds to input | Still (ambient motion competes with the subject) |

Prefer light and atmosphere to depth-of-field blur: blur costs a pass, hides detail the user may want, and reads
as a focus problem on small screens. Keep UI (labels, controls, prices) in screen space as DOM, above the scene.

## 2. Spatial navigation

- **Overview first.** Open on a framed view of the whole subject (`CameraRig.fitToBounds` or an authored
  `hero` preset), then let the user go closer.
- **Stations over free flight.** Named viewpoints in a DOM list ("Front", "Ports", "Underside"), reachable by
  buttons and keys. Free orbit is an addition; free flight (WASD, pointer lock) is for explicit exploration
  pieces only and never the only way to reach content.
- **Where am I.** Show the current station as text ("View 2 of 5: Ports") and mark it `aria-current` in the list.
- **Bounded space.** Clamp orbit, zoom and pan so the subject cannot be lost (`interaction.md` §2); in rooms, keep
  the camera inside walls and at eye height.
- **Escape.** Reset view, Back to overview, `Escape` to leave a focused state or full screen, and a "Turn off 3D"
  switch (`StudioCanvas disabled`) for people who prefer the static page.

## 3. Affordances

| Affordance | How |
|---|---|
| "This can be turned" | Visible instruction next to the viewer ("Drag to rotate · arrow keys when focused"), `cursor: grab`/`grabbing` on the canvas |
| "This part can be picked" | Hover lift in the scene and the same part as a button in a DOM list; pointer cursor only over pickable parts |
| "There is more here" | Numbered hotspot markers (`HotspotLayer`) mirrored in a list (`HotspotList`) |
| "This moves on scroll" | A progress cue (rail, step counter) and captions in DOM, not an empty tall section |

An instruction that disappears after the first successful interaction is fine; one that never appears is not.
Do not rely on discovery: a canvas with no visible cue reads as an image.

## 4. Feedback

- **Same frame.** Orbit, hover and press respond on the next rendered frame; never make input wait for an
  animation, a load or a React re-render chain.
- **Two channels.** Every selection or state change shows in the scene and in DOM text (`role="status"`, one
  line per change, not per frame).
- **Honest loading.** Bytes and decode state from `useModelProgress(url)`; a percentage only when the server sent a
  usable length; the poster stays visible meanwhile.
- **Errors in words.** `describeModelError(error)` sentences in the fallback, with a retry.

## 5. Comfortable camera motion

People get disoriented, and some get unwell, when the view moves in ways they did not cause or cannot predict.

Avoid:

- Motion the user did not initiate, especially on load; auto-rotate without a pause control.
- Field-of-view changes, camera roll, a tilting horizon, and sudden acceleration or overshoot.
- Large rotations completed quickly, and moving the whole field of view while the user reads.
- Scroll-driven camera travel that runs faster than the scroll, or continues after scrolling stops for longer than
  a short smoothing tail.

Prefer:

- User-driven movement with damping, critically damped transitions (no overshoot: `CameraRig`), constant speed
  along paths (`getPointAt` samples by arc length) with eased starts and stops.
- Durations from the motion tokens: `slow` to `cinematic` for a full preset change, scaled by the profile; longer
  only for scripted, skippable sequences.
- Dolly towards a subject rather than zooming the lens; keep the horizon level and the subject in frame.
- Cuts under reduced motion; a visible way to stop any automatic movement.

Test full screen on a phone held close: comfort problems hide on a desktop monitor.

## 6. In-scene text versus DOM overlays

| Content | Put it in | Why |
|---|---|---|
| Anything to read, compare, copy, translate or zoom: names, prices, specs, data values, instructions | DOM | Accessible, crisp, selectable, reflows at 320 px and 200 % zoom |
| Labels that must track a 3D point | DOM markers positioned from the scene (`HotspotAnchors`, or Drei `<Html>`) | Stays DOM; costs a projection per rendered frame |
| Signage that must foreshorten or be hidden by geometry | In-scene text (Drei `<Text>` with a self-hosted `font`) | Part of the world; duplicate the words in DOM |
| Decorative type in a scene | In-scene, `aria-hidden` equivalent in DOM if meaningful | Decoration only |

Drei `<Text>` without a `font` prop resolves fonts from a public CDN at runtime; always pass a self-hosted font.
DOM overlays over a moving scene must keep 4.5:1 text contrast at the worst point: put text on a solid or scrim
surface, never directly on the render.

## 7. Selection

- One selected item at a time unless the task is comparison; selection survives camera moves.
- Deselect by clicking empty space (R3F `onPointerMissed` on the canvas), by `Escape`, and by the list.
- Selected state uses more than colour: DOM text, `aria-pressed` in the list, and a scene cue such as framing
  or dimming the rest (`interaction.md` §5).

## 8. Checklist

- [ ] The subject is the brightest, clearest, most responsive thing in the scene.
- [ ] The opening view frames the whole subject; stations exist as DOM controls with a "where am I" line.
- [ ] Visible instructions; pickable things look pickable; hotspots mirrored in a list.
- [ ] No unrequested camera motion; no FOV jumps or roll; cuts under reduced motion.
- [ ] Readable content is DOM, on solid surfaces; in-scene text is duplicated and uses a local font.
- [ ] Reset, Back and Turn off 3D are always one action away.
