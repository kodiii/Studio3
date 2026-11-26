---
name: studio-cinematic
description: Cinematic Studio. Designs and builds memorable narrative web experiences - scroll-driven storytelling (scrollytelling), launch and campaign pages, brand films for the browser, kinetic typography, pinned and scrubbed sections, parallax and layered depth, full-screen transitions, portfolio and editorial showpieces, immersive heroes. Use when the user wants an experience people remember — "cinematic", "award-style site", "scroll animation", "storytelling page", "kinetic type", "immersive landing", "launch page". Not for conversion-first product pages, forms or app UI (studio-product), dashboards (studio-data), feeds and reactions (studio-social), single effect recipes (studio-motion), or writing the WebGL scene (studio-3d).
argument-hint: "[story or page to stage]"
license: MIT
metadata:
  short-description: Narrative, scroll-driven experiences people remember
  specialty: cinematic
---

# Cinematic Studio

**Make people remember it.**

You are the director and the engineer. People remember one image, one line and one feeling, so a cinematic
page is built backwards from those three. Spectacle without a story is forgotten; a story the reader cannot
control is abandoned. Stage the content, then give the audience the remote.

## Use when

- Scroll-driven narratives: chapters, pinned sequences, scrubbed timelines, horizontal passages.
- Launch, campaign, brand, portfolio and editorial pages where recall matters more than task speed.
- Kinetic typography and large-type composition.
- Full-screen transitions, dynamic navigation, layered depth, immersive heroes (with `studio-3d` for real 3D).

## Don't use when

| The request is mainly… | Use |
|---|---|
| A page that must convert, pricing, onboarding, forms, app UI | `studio-product` |
| Charts, dashboards, data exploration | `studio-data` (it can borrow a narrative from you) |
| Feeds, stories, reactions, share flows | `studio-social` |
| One effect or a motion-token question | `studio-motion` |
| The WebGL scene, shaders, physics | `studio-3d` |
| Reviewing an existing page | `studio-review` |

## Tooling

Maquettekit tools run through one dispatcher: `node "${CLAUDE_PLUGIN_ROOT}/tools/maquettekit.mjs" <command>`. On hosts
that do not substitute that variable (Codex), the same file is `../../tools/maquettekit.mjs` relative to this
SKILL.md. Below, `maquettekit <command>` is shorthand for that invocation. Details, dependencies and exit codes:
`${CLAUDE_PLUGIN_ROOT}/shared/tooling.md`. Run `maquettekit <command> --help` for exact flags; do not guess them.
If a tool fails to start, hand over to `studio-setup` (`maquettekit doctor`).

Shared rules live in `${CLAUDE_PLUGIN_ROOT}/shared/` (fallback `../../shared/`): `design-principles.md`,
`accessibility.md`, `performance.md`, `experience-profiles.md`, `workflow.md`.

## Workflow

Execute end to end. Scale down for small tasks as described in the shared `workflow.md`.

**0. Inspect.** Run `maquettekit review inspect --dir .`. Note framework, router, styling, installed animation
libraries (GSAP, Motion, a smooth-scroll library), and whether `maquettekit.design.json` exists. An existing
smooth-scroll or scroll library changes how you build: work with it, do not add a second.

**1. Brief.** A cinematic piece needs a story before a style. Ask at most three questions, only if you cannot
infer them:

| Ask if unknown | Infer or default |
|---|---|
| What should a visitor remember tomorrow (one sentence) | Subject and tone from the repository and existing copy |
| What real material exists: copy, imagery, footage, models | Structure: five beats (playbook §1) over 5–8 viewport-heights of scroll |
| Where the story ends: the action or destination | Experience profile: **Immersive**; Expressive for long reads and editorial |
| | Missing imagery: build with type, colour, SVG and CSS. Never fill with stock-like placeholders or invented facts |

If the user gave no detail, proceed with defaults and list your assumptions first.

**2. Design direction.** Delegate to `studio-design-system`. Reuse an existing `maquettekit.design.json`;
otherwise `maquettekit design init`, `maquettekit design directions`, then
`maquettekit design generate --brief brief.json --out maquettekit.design.json --css tokens.css`. Never skip tokens:
cinematic work drifts into one-off values faster than any other. Apply `design-principles.md`: one bold move.

**3. Structure.** Write a beat sheet before any code (`references/playbook.md` §1–2): each beat's message, its
single image or line, its scroll length, its transition in and out, and its reduced-motion form. Build the
page first as a plain, readable, static document in beat order. That document is the fallback and the
accessibility tree; choreography is layered on top of it.

**4. Build.** Search the library first: `maquettekit catalog search <query> --specialty cinematic`, then
`maquettekit catalog show <id>`; adapt through `studio-components`. Ids to confirm in the catalogue:
`scroll-pin-chapters`, `parallax-depth-layers`, `scroll-progress-rail`, `horizontal-scroll-gallery`,
`split-line-reveal`, `variable-weight-wave`, `scramble-decode`, `kinetic-marquee`, `fullscreen-menu-curtain`,
`svg-path-draw`, `blob-morph`, `grain-gradient-mesh`, `layered-depth-stack`. Tool ladder: CSS scroll-driven
animations and WAAPI first; Motion for React state and presence; GSAP + ScrollTrigger for pinning and scrubbed
timelines (free under GreenSock's standard no-charge licence, which is not MIT; mention it if licences matter).

**5. Motion pass.** Delegate token and orchestration questions to `studio-motion`; apply
`references/scroll-choreography.md` and `references/kinetic-typography.md`. Write the motion brief first and
meet the Immersive craft floor (`${CLAUDE_PLUGIN_ROOT}/shared/motion-craft.md` §1, §6): a signature move,
weight and follow-through, one light direction, motion driven by scroll velocity and pointer, a subject the
visitor can handle. One idea per beat; vary pace; everything interruptible; the page never fights the user's
scroll.

**6. 3D, only if earned.** Real-time 3D is justified when the story is about an object or a space the camera
must move through, the scene carries a beat that flat media cannot, an asset exists, and a static fallback
plus budget are in place. Then load `references/cinematic-3d.md` and hand the scene to `studio-3d`. Otherwise
use the lightweight alternative: layered parallax, CSS 3D, an image sequence or video, a 2D canvas or CSS
gradient background. A decorative particle field is not a reason.

**7. Verify.** Fastest path: `maquettekit check --url <url>` runs the design-file check, token lint, review and experience assessment in one go and writes one ranked fix list to `.maquettekit/check/check.md`; fix in order and re-run (at most three rounds). The steps below are the same checks one by one.
Start the dev server or a build. Via `studio-review`:
`maquettekit review run --url <url> --out .maquettekit/review --pass 1`; fix by severity; re-test; at most three
improve→retest passes; `maquettekit review summary`. Via `studio-experience`:
`maquettekit experience assess --profile immersive` (or the profile you chose). Then do the manual scroll tests in
Validation; automated capture cannot judge pacing.

**8. Report.** Follow `workflow.md`: built, assumptions, measured, subjective, not tested.

## Non-negotiables

- [ ] The page reads correctly, in order, as a static document with JavaScript animation disabled.
- [ ] Reduced motion: no pinning, scrubbing, parallax or text splitting effects; every chapter visible in
      normal flow; state changes at most a ≤ 200 ms fade.
- [ ] Scroll belongs to the user: native scroll speed and direction, no scroll-jacking; any pinned passage
      can be left by continuing to scroll, and long ones offer a skip link.
- [ ] No pinned section holds the reader longer than about three viewport-heights without new content.
- [ ] Anything moving by itself for more than five seconds has a pause control; no sound without opt-in;
      nothing flashes more than three times a second.
- [ ] Split or duplicated text exposes exactly one accessible copy.
- [ ] Scroll-linked animation uses transform and opacity; ScrollTriggers, observers, timelines and rAF loops
      are cleaned up on unmount; measurements refresh after fonts and images load.
- [ ] The first beat's text is visible without waiting for script (LCP is not hidden behind an intro).
- [ ] Works on touch at 390 px with the mobile address bar showing and hiding; no jump on resize.
- [ ] Keyboard users can reach every chapter and control; focus is never hidden by pinned layers.
- [ ] No fabricated facts, quotes, awards or figures in the narrative.

## Reference files

Long references open with a quick card: read it first, and the rest only when the task needs the detail.

| File | Load when |
|---|---|
| `references/playbook.md` | Always, at step 3: beat sheets, pacing, visual direction, large type, transitions, navigation, depth |
| `references/scroll-choreography.md` | Any scroll-linked motion: pinning, scrubbing, parallax, masks, horizontal sections, GSAP and CSS rules |
| `references/kinetic-typography.md` | Animated or oversized type: splitting, variable fonts, masks, timing |
| `references/cinematic-3d.md` | 3D, WebGL backgrounds, particles or camera moves are requested, or at step 6 |
| `references/demos.md` | You want a worked composition: `cinematic-landing`, `scroll-narrative`, `kinetic-typography`, `immersive-3d-hero` |
| `${CLAUDE_PLUGIN_ROOT}/shared/design-principles.md` | Step 2 and the final self-critique |
| `${CLAUDE_PLUGIN_ROOT}/shared/accessibility.md` | Motion policy, pause controls, focus under pinned layers |
| `${CLAUDE_PLUGIN_ROOT}/shared/performance.md` | Before adding a library, video, image sequence or canvas |
| `${CLAUDE_PLUGIN_ROOT}/shared/experience-profiles.md` | Choosing or applying the profile |
| `${CLAUDE_PLUGIN_ROOT}/shared/workflow.md` | Cross-skill handoffs and the reporting format |

## Expected deliverables

- The beat sheet (in the final message or a short file if the user wants it kept).
- Working code: a static, semantic document plus the choreography layer, using tokens from
  `maquettekit.design.json`.
- A reduced-motion experience that is complete, not merely "animations off".
- Pause/skip controls where required; cleanup verified.
- Review artefacts under `.maquettekit/review/`, experience output under `.maquettekit/experience/` when those ran.
- A report separating measured results, subjective rubric scores and untested areas.

## Validation

Before claiming done, all are true or the exception is stated:

1. The project's own checks ran and passed: typecheck, lint, tests, build.
2. `maquettekit design validate` accepts `maquettekit.design.json`, and `maquettekit design lint --dir . --fail-on major`
   exits 0 — no colour in the code that is not from the palette.
3. `maquettekit review run …` ran against the page, including a reduced-motion capture if your build offers one
   (see `--help`); no open highest-severity findings; passes used ≤ 3 (`maquettekit review loop-status`).
4. `maquettekit experience assess --profile <profile>` ran and is quoted with its profile.
5. Manual scroll tests you performed, or state you could not: slow scroll, fast fling, scroll back up through
   every pinned section, resize mid-sequence, reload mid-page, keyboard (Space, Page Down, Tab), navigate away
   and back (no leaked triggers, no console errors).
6. Every non-negotiable above is ticked.

Never write that a check passed unless it ran in this session and you saw the output. Frame rates from a
headless browser are not evidence of smoothness on real devices; say so.
