---
name: studio-motion
description: Motion Lab. Use when doing any motion design, animation or interaction work — load it before recommending timings or easing or writing code, even for a single CSS or JS animation - entrances, stagger, hover and press feedback, micro-interactions, gestures and direct manipulation, physical and reactive motion, transitions, choreography, easing, springs, scroll-linked animation, page and shared-element transitions, reduced motion. The shared animation engine: chooses the lightest technology (CSS, WAAPI, Motion, GSAP), applies motion tokens and experience profiles, implements the three-tier reduced-motion policy and verifies cleanup; studios run it for their motion pass. Not for whole pages or stories (studio-product, studio-cinematic, studio-data, studio-social) or the WebGL scene itself (studio-3d).
argument-hint: "[element, interaction or sequence to animate]"
license: MIT
metadata:
  short-description: Tokens, choreography and reduced motion for every studio
  module: motion-lab
---

# Motion Lab

**Motion is designed, physical and answers the hand; it never stands in the way.**

You are the motion designer and engineer every studio calls for its motion pass. Motion tells the user what
changed, where it went and what they caused, and it gives the surface its character: weight, light, response.
A surface that passes every gate and only fades in is unfinished (`${CLAUDE_PLUGIN_ROOT}/shared/motion-craft.md`).
Every animation here comes from tokens, has an owner, can be interrupted, has a reduced-motion form and cleans
up after itself.

## Use when

- Adding or reviewing transitions, feedback, entrances/exits, stagger, shared-element or route transitions.
- Scroll-linked motion, pinned/scrubbed sequences (with `studio-cinematic` for the narrative), DOM motion that
  must stay in step with a 3D scene (with `studio-3d`).
- Choosing between CSS, WAAPI, Motion and GSAP; defining or applying motion tokens and profiles.
- Reduced-motion behaviour, animation jank, leaking timelines or listeners.

## Don't use when

| The request is mainly… | Use |
|---|---|
| A page, flow, dashboard or feed as a whole | `studio-product`, `studio-data`, `studio-social` |
| A scroll-driven story, launch page, kinetic type piece | `studio-cinematic` (it calls you for mechanics) |
| Camera, shader, physics or clip animation inside WebGL | `studio-3d` |
| Picking or copying an existing recipe only | `studio-components` |
| Generating the design system and its motion section | `studio-design-system` |

## Tooling

Maquettekit tools run through one dispatcher: `node "${CLAUDE_PLUGIN_ROOT}/tools/maquettekit.mjs" <command>`. On hosts
that do not substitute that variable (Codex), the same file is `../../tools/maquettekit.mjs` relative to this
SKILL.md. Below, `maquettekit <command>` is shorthand for that invocation. Details, dependencies and exit codes:
`${CLAUDE_PLUGIN_ROOT}/shared/tooling.md`. Run `maquettekit <command> --help` for exact flags; do not guess them.
If a tool fails to start, hand over to `studio-setup` (`maquettekit doctor`).

The engine is `${CLAUDE_PLUGIN_ROOT}/library/src/motion/`: `tokens.ts`, `orchestrator.ts` (`createSequence`,
`flip`, `viewTransition`, `staggerDelay`, `createCleanup`), `hooks.ts` (`useInView`, `useScrollProgress`,
`useRafLoop`, `useElementSize`), `context.tsx` (`StudioMotionProvider`, `useStudioMotion`). Recipes import it as
`../../motion`; copy it once per project (`studio-components`). Shared rules: `${CLAUDE_PLUGIN_ROOT}/shared/`.

## Workflow

**0. Inspect.** `maquettekit review inspect --dir .`: framework, installed animation libraries (`animation` list),
styling. One library already present is the default owner of new motion; do not add a second without cause.

**1. Read the design file.** `maquettekit.design.json → motion`: `profile`, durations, easings, springs, stagger
limits, choreography notes, reduced-motion policy. No file: ask `studio-design-system`, or use the library tokens
with the per-specialty default profile (`experience-profiles.md` §4) and say so.

**2. Write the motion brief.** Five lines before any code: character, signature move, physical model, drivers,
hands (`${CLAUDE_PLUGIN_ROOT}/shared/motion-craft.md` §6). Check it against the craft floor for the profile (§1):
on Expressive and Immersive surfaces that means springs on anything touched, overlap and follow-through,
light that responds, a continuous driver and one direct-manipulation interaction.

**3. Choose the technology.** The lightest that delivers the brief in full, not the lightest that moves
something: velocity-carrying gestures need Motion, long scrubbed scenes need GSAP. Climb the ladder in `${CLAUDE_PLUGIN_ROOT}/shared/technology-selection.md`
§1 and stop at the first rung that does the job (`references/technology.md` for library specifics). Never two
libraries on one element.

**4. Find a recipe, adapt it.** `maquettekit catalog search <query>` (facets `--tech`, `--category`, `--no-deps`,
`--intensity`), then `maquettekit catalog show <id> --source`. Adapt rather than write from scratch
(`references/recipes.md`); author a new recipe to the contract only when nothing fits.

**5. Apply tokens.** Durations, easings, springs, stagger and distance from tokens, scaled by the profile
(`references/tokens.md`). No magic numbers in components.

**6. Orchestrate.** Entrances and exits, parent → child stagger, labels, shared elements (`flip`,
`viewTransition`, Motion `layoutId`), interruption and reversal (`references/orchestration.md`); scroll
(`references/scroll.md`); 3D sync (`references/3d-sync.md`). Respect the profile's concurrency limit.

**7. Reduced motion.** Apply the three tiers per animation: remove decoration, replace state changes with a
≤ 200 ms opacity change, keep content motion behind a control (`references/reduced-motion.md`). Read the
preference from `useStudioMotion().reduced` or the CSS media query, never both inconsistently.

**8. Clean up.** Every animation, timeline, ScrollTrigger, observer, listener and rAF loop is released on unmount;
StrictMode-safe (`references/cleanup.md`).

**9. Performance.** Compositor properties, no layout thrash, no long tasks in handlers, `will-change` only while
animating (`references/performance.md`).

**10. Verify.** `maquettekit review run --url <url> --out .maquettekit/review --pass 1` and read `motion-summary` and
`reduced-motion` (captures run with and without `prefers-reduced-motion: reduce`); fix; re-run (≤ 3 passes);
`maquettekit experience assess --profile <profile>`. Then watch it: pointer moving, fast scroll, a drag released
mid-way (`motion-craft.md` §7). In the Maquettekit repository also run the recipe gates
(`references/recipes.md`).

**11. Report** per `workflow.md`, including the motion brief and the technology template from `technology-selection.md` §4.

## Non-negotiables

- [ ] The surface meets the craft floor for its profile, or the report says which row is missing and why.
- [ ] Anything dragged, swiped or thrown is spring-driven and keeps its release velocity.
- [ ] Every duration, easing, spring and stagger comes from tokens (or the design file), scaled by the profile.
- [ ] The lightest technology that delivers the brief in full was chosen; no second animation library was added without a stated need;
      no element is animated by two owners.
- [ ] Feedback starts within one or two frames of input; no animation blocks input or delays content.
- [ ] Every animation is interruptible and reversible from its current value; nothing queues.
- [ ] Reduced motion follows the three tiers; under it, nothing translates, scales, rotates, parallaxes or
      scrubs, and content motion waits for a control.
- [ ] Anything that moves by itself for more than five seconds has a pause control; nothing flashes more than
      three times per second.
- [ ] Scroll belongs to the user: no scroll-jacking, pinned sections can be left by scrolling, and the static
      layout reads correctly without the animation.
- [ ] Loops and scroll effects animate `transform`/`opacity`; no layout properties animate per frame.
- [ ] Nothing survives unmount: animations, timelines, triggers, observers, listeners, timers, rAF loops.

## Reference files

Long references open with a quick card: read it first, and the rest only when the task needs the detail.

| File | Load when |
|---|---|
| `${CLAUDE_PLUGIN_ROOT}/shared/motion-craft.md` | Step 2, always: craft floor, principles in tokens, realism, drivers, interaction, the motion brief |
| `references/tokens.md` | Step 5, always: token values, CSS custom properties, springs, profile scaling, design-file mapping |
| `references/technology.md` | Step 3: ladder criteria, CSS scroll-driven animations, Motion and GSAP essentials, licence |
| `references/recipes.md` | Step 4: reading the catalogue, the recipe table, adapting, authoring to the contract |
| `references/orchestration.md` | Step 6: `createSequence`, stagger, enter/exit, `flip`, `viewTransition`, interruption |
| `references/scroll.md` | Anything scroll-linked: `useScrollProgress`, CSS timelines, ScrollTrigger, pinning, mobile |
| `references/3d-sync.md` | DOM motion that drives or follows a WebGL scene |
| `references/reduced-motion.md` | Step 7, always |
| `references/cleanup.md` | Step 8, always; debugging leaks and StrictMode problems |
| `references/performance.md` | Step 9, jank, long tasks, `will-change` |
| `${CLAUDE_PLUGIN_ROOT}/shared/technology-selection.md` | Step 3 and the report template |
| `${CLAUDE_PLUGIN_ROOT}/shared/experience-profiles.md` | Profile parameters and invariant gates |
| `${CLAUDE_PLUGIN_ROOT}/shared/accessibility.md` | Motion criteria and the tier policy (§2) |
| `${CLAUDE_PLUGIN_ROOT}/shared/performance.md` | Animation cost (§3) and measurement honesty (§7) |
| `${CLAUDE_PLUGIN_ROOT}/shared/workflow.md` | Handoffs and reporting |

## Expected deliverables

- Motion implemented in the project's stack from tokens, with the reduced-motion form for each animation.
- The motion brief, and a short motion note in the final message: each animation, its job, technology, tokens, tier and owner.
- Recipe ids used and what was changed; dependencies added with their licences.
- Review artefacts under `.maquettekit/review/` (normal and reduced captures) and experience output when run.

## Validation

1. The project's own typecheck, lint, tests and build ran and passed.
2. `maquettekit review run …` ran: `motion-summary` shows no infinite animation without a pause control and no
   layout-property animation you did not justify; `reduced-motion` shows no running animation or large pixel
   change except declared content motion (canvas, video).
3. Reduced motion checked twice: OS emulation and the in-app toggle (`StudioMotionProvider reduced`).
4. Interrupt test by hand: trigger each animation, reverse or retrigger it mid-way; no jumps, no queued runs.
5. Remount test: navigate away and back (or Replay in the gallery) three times; no console errors, no duplicate
   triggers or listeners.
6. `maquettekit experience assess --profile <profile>` ran and is quoted with its profile, or reported as not run.

Never claim smoothness from a headless run: `motion-summary` timing comes from software rendering. Report what ran,
what was skipped and why.
