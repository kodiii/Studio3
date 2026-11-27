import type { DemoMeta } from '../../../types';

export const meta: DemoMeta = {
  id: 'physics-playground',
  name: 'Blockwerk Play Table',
  specialty: '3d',
  summary: 'Rigid-body physics with Rapier on a lit wooden workbench: lacquered blocks drop in, lift when you point at them, and can be picked up, thrown, stacked and tilted — with a full keyboard path through a body list and a render loop that goes idle once everything is asleep.',
  highlights: [
    'Thrown blocks are safe: every body mutation that starts in a pointer or button event is queued and applied in useBeforePhysicsStep, and every read checks that the body still exists (@react-three/rapier 2.2 never calls a ref with null when a body is removed — a stale handle used to panic Rapier as soon as a thrown block left the world).',
    'Real materials instead of flat toy colours: bevelled blocks and planks with procedural wood grain in object space (end grain on the ends, long grain on the sides), lacquer on the high profile, lit by one window light from the upper left plus a generated environment — no downloads.',
    'A motion language on springs from the motion tokens: blocks drop in lowest first and squash on landing (what they land on gives a little too), real landings squash by impact speed, the pointed-at block lifts and rim-lights while its shadow spreads, and a grabbed block rises before it follows the hand and keeps its velocity and spin when thrown.',
    'One light direction for the page: table shadows (shadow maps where the profile allows, two-layer contact shadows everywhere) and every DOM shadow fall down and to the right; the keycap controls press in, latch and spring back on a linear() curve sampled from a spring token.',
    'The Rapier chunk (WebAssembly included) is code-split with React.lazy; the workbench is drawn before it arrives. Fixed 1/60 s timestep on a clamped clock, sleeping bodies, a 40-body cap that recycles the oldest.',
  ],
  technology: ['r3f', 'three', 'rapier', 'glsl'],
  uses: [],
  adapts: ['press-depth-button'],
  has3d: true,
  accessibility: [
    'Every pointer action has a keyboard path: choose a body in the list (a native radio group), then Nudge left/right/away/toward, Lift, Drop or Remove.',
    'Body state (resting, moving, held) is text in the list; additions, removals and recycling are announced in a polite live region; the selected body also gets a ring on the table, not only a colour.',
    'Toy box, gravity and camera choices are native radios styled as keys; every key has hover, pressed, latched, disabled and focus-visible states and is at least 38 px tall.',
    'The drop-in never blocks input: the first press on the table or any control lands every block, and a Skip intro button is shown while it plays.',
    'Without WebGL a drawing of the starting arrangement is shown and the physics engine is never downloaded.',
  ],
  reducedMotion: 'No drop-in (blocks are simply placed), no landing squash, hover lift or spring release on the keys — states change at once. The simulation starts paused and only runs after an explicit “Run simulation” press (the motion is the content). Camera views cut instead of gliding.',
  performance: [
    'One draw call per body (one shared bevelled geometry per shape, one wood material per body so grain and rim light vary) plus the workbench; at most 40 bodies.',
    'Contact shadows for all bodies are one instanced draw call (a tight contact layer and a wide soft layer each); shadow maps and lacquer (clearcoat) only on profiles that allow them.',
    'Render on demand: Rapier requests frames only while a body is awake, the springs only while they move — a settled table draws nothing. Frame deltas are clamped to 50 ms so a resumed loop never fast-forwards.',
  ],
};
