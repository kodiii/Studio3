import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'physics-playground',
  name: 'Blockwerk Play Table',
  specialty: '3d',
  summary: 'Rigid-body physics with Rapier: drag, throw and stack wooden blocks, tilt gravity, and watch the render loop go idle once everything is asleep — with a full keyboard path through a body list.',
  highlights: [
    'The Rapier chunk (WebAssembly included) is code-split with React.lazy and only fetched once the canvas starts; loading and failure states are shown.',
    'Fixed 1/60 s timestep on a clamped clock, sleeping bodies, a 40-body cap that recycles the oldest, and removal of anything that falls out of the world.',
    'Render on demand: Rapier requests frames only while a body is awake, so a settled table draws nothing — the page shows the frame counter stopping.',
    'Drag is kinematic: the grabbed block follows the pointer on a camera-facing plane and is thrown with the pointer’s recent velocity on release.',
  ],
  technology: ['r3f', 'three', 'rapier'],
  uses: [],
  has3d: true,
  accessibility: [
    'Every pointer action has a keyboard path: choose a body in the list (a native radio group), then Nudge left/right/away/toward, Lift, Drop or Remove.',
    'Body state (resting, moving, held) is text in the list; additions, removals and recycling are announced in a polite live region.',
    'Gravity direction is a radio group with names, strength a labelled slider with its value in m/s².',
    'Without WebGL a drawing of the starting arrangement is shown and the physics engine is never downloaded.',
  ],
  reducedMotion: 'The simulation starts paused and only runs after an explicit “Run simulation” press (the motion is the content). Camera views cut instead of gliding.',
  performance: [
    'One draw call per body (shared geometry per shape, one material per colour) plus the table; at most 40 bodies.',
    'Shadow maps only on profiles that allow them; otherwise one instanced quad per body draws contact shadows in a single call.',
    'The loop is idle whenever all bodies sleep or the simulation is paused; frame deltas are clamped to 50 ms so a resumed loop never fast-forwards.',
  ],
};
