---
name: studio-product
description: Product Studio. Designs and builds product interfaces people want to use - SaaS landing pages, marketing sites, pricing pages, onboarding and sign-up flows, forms with validation, settings, app shells, navigation, empty/loading/error states, product showcases and configurator pages. Use when the user wants a product UI designed or improved — "landing page", "pricing", "onboarding", "sign-up flow", "product page", "make this app look good", "redesign this UI". Not for scroll-driven storytelling or launch films (studio-cinematic), dashboards and charts (studio-data), feeds, stories or reactions (studio-social), or building the WebGL scene itself (studio-3d).
argument-hint: "[what to build or improve]"
license: MIT
metadata:
  short-description: Product UI and marketing pages people want to use
  specialty: product
---

# Product Studio

**Make people want to use it.**

You are the product designer and front-end engineer on this task. Desire comes from clarity, speed and
specificity: the visitor understands what this is within five seconds, sees the real product, and every control
responds the way they expect. Decoration does not create desire; a believable product does.

## Use when

- Marketing and landing pages for a product, feature pages, pricing pages, changelogs, waitlists.
- In-product UI: app shells, navigation, settings, forms, onboarding, checkout, account flows.
- State design: empty, loading, error, success, partial, offline.
- Product showcases and configurators (you lead; `studio-3d` builds any real-time scene).

## Don't use when

| The request is mainly… | Use |
|---|---|
| A scroll-driven narrative, launch film, kinetic typography piece | `studio-cinematic` |
| Dashboards, charts, tables of data, monitoring | `studio-data` |
| Feeds, stories, reactions, polls, creator tools | `studio-social` |
| A WebGL/R3F scene, physics, shaders | `studio-3d` |
| Only tokens/palette/fonts | `studio-design-system` |
| Only reviewing an existing page | `studio-review` |

## Tooling

Studio³ tools run through one dispatcher: `node "${CLAUDE_PLUGIN_ROOT}/tools/studio3.mjs" <command>`. On hosts
that do not substitute that variable (Codex), the same file is `../../tools/studio3.mjs` relative to this
SKILL.md. Below, `studio3 <command>` is shorthand for that invocation. Details, dependencies and exit codes:
`${CLAUDE_PLUGIN_ROOT}/shared/tooling.md`. Run `studio3 <command> --help` for exact flags; do not guess them.
If a tool fails to start, hand over to `studio-setup` (`studio3 doctor`).

Shared rules live in `${CLAUDE_PLUGIN_ROOT}/shared/` (fallback `../../shared/`): `design-principles.md`,
`accessibility.md`, `performance.md`, `experience-profiles.md`, `workflow.md`.

## Workflow

Execute end to end. Scale down for small tasks as described in the shared `workflow.md`.

**0. Inspect.** Run `studio3 review inspect --dir .`. Note framework, styling, component library, installed
animation libraries, scripts, and whether `studio3.design.json` exists. Respect the stack you find: no React-only
tooling in a non-React project, no second animation library without cause.

**1. Brief.** Infer from the repository and the request first. Ask at most three questions, only if the answer
changes the build and cannot be found:

| Ask if unknown | Infer or default |
|---|---|
| Who is the buyer/user, in their words | Product category from code, copy and package name |
| The one action the page or flow must produce | Tone from existing copy; otherwise plain, specific, confident |
| Hard brand constraints (colours, fonts, logo) | Experience profile: **Expressive**; Essential for settings, checkout, admin |
| | Real content: use what exists; write specific draft copy, mark it `Draft copy`; never invent customers, numbers or quotes |

If the user gave no detail, proceed with defaults and list your assumptions first.

**2. Design direction.** Delegate to `studio-design-system`. If `studio3.design.json` exists, reuse it so this
session matches earlier ones. Otherwise write a brief (`studio3 design init`), choose a direction
(`studio3 design directions`), and generate:
`studio3 design generate --brief brief.json --out studio3.design.json --css tokens.css`. Never skip tokens.
Then apply the taste code in `design-principles.md`: one sentence of direction, one point of boldness.

**3. Structure.** Before markup, write the information architecture: for a page, the ordered list of sections
with the single job of each; for a flow, the steps, the data each needs and every state. Load
`references/playbook.md`; add `references/patterns-conversion.md` for marketing pages or
`references/patterns-flows.md` for in-product flows.

**4. Build.** Search the library before writing an effect: `studio3 catalog search <query> --specialty product`,
then `studio3 catalog show <id>`. Adapt recipes through `studio-components`. Useful ids to confirm in the
catalogue: `morphing-nav-pill`, `command-menu-reveal`, `magnetic-button`, `press-depth-button`,
`morph-submit-button`, `skeleton-shimmer-handoff`, `expanding-card-detail`, `accordion-height-auto`,
`flip-grid-reorder`, `number-ticker`, `spotlight-border-card`. Build every component state in the matrix in the
playbook, not just the resting state.

**5. Motion pass.** Delegate to `studio-motion`. Product motion has three jobs only: feedback (≤ 160 ms to
start), continuity between states (shared elements, layout changes), and one orchestrated entrance above the
fold. Use motion tokens; honour reduced motion.

**6. 3D, only if earned.** Real-time 3D is justified when **all** hold: the product is a physical or spatial
object; the user needs to inspect or configure it from angles a few images cannot cover; the configuration
space is too large to pre-render; and a static fallback plus the performance budget are in place. Then load
`references/product-3d.md` and hand the scene to `studio-3d` with the contract in that file. Otherwise use the
lightweight alternative it lists: image sequence, CSS 3D (`flip-card-3d`, `layered-depth-stack`), video, or a
static render.

**7. Verify.** Start the project's dev server or build. Run the Visual Director via `studio-review`:
`studio3 review run --url <url> --out .studio3/review --pass 1`; fix by severity; re-test. Maximum three
improve→retest passes, then `studio3 review summary`. Run the Experience Lab via `studio-experience`:
`studio3 experience assess --profile expressive` (or the profile you chose).

**8. Report.** Follow the reporting rules in `workflow.md`: built, assumptions, measured, subjective, not
tested.

## Non-negotiables

Each is a checkable statement. A build that fails one is not finished.

- [ ] A first-time visitor can say what the product is and who it is for from the first viewport alone.
- [ ] The first viewport shows the product itself (real UI, real object, real output), not an abstraction.
- [ ] Exactly one primary action per view; secondary actions are visibly secondary.
- [ ] Every interactive component implements rest, hover, focus-visible, active, disabled and, where async,
      loading, success and error.
- [ ] Every async surface has designed empty, loading, error and partial states.
- [ ] Forms: visible labels, errors on blur or submit (never while first typing), messages that say how to fix,
      no data lost on error.
- [ ] No dark patterns: no fake urgency or scarcity, no pre-ticked consent, no confirm-shaming, no hidden costs,
      cancel as easy as sign-up. Prices shown are complete.
- [ ] No fabricated proof: no invented metrics, testimonials, logos, ratings or user counts. Placeholders are
      labelled.
- [ ] Works at 320 px width without horizontal page scroll; primary touch targets ≥ 44 px, all targets ≥ 24 px.
- [ ] Keyboard-complete, visible focus, contrast per `accessibility.md`; reduced motion honoured.
- [ ] The largest above-the-fold element is visible without waiting for animation or JavaScript.
- [ ] None of the formulaic patterns in `design-principles.md` §6 is present without a stated reason.

## Reference files

| File | Load when |
|---|---|
| `references/playbook.md` | Always, at step 3: art direction, IA, layout, type and spacing, states matrix, navigation |
| `references/patterns-conversion.md` | Landing, pricing, feature and waitlist pages; CTA hierarchy; social proof |
| `references/patterns-flows.md` | Onboarding, forms and validation, empty/loading/error states, shared-element transitions, tours |
| `references/product-3d.md` | The request mentions 3D, a viewer, configurator, 360 or exploded view, or you are deciding at step 6 |
| `references/demos.md` | You want a worked composition to study: `saas-landing`, `animated-onboarding`, `product-configurator`, `product-showcase` |
| `${CLAUDE_PLUGIN_ROOT}/shared/design-principles.md` | Step 2 and before the final self-critique |
| `${CLAUDE_PLUGIN_ROOT}/shared/accessibility.md` | Building any interactive component; before verification |
| `${CLAUDE_PLUGIN_ROOT}/shared/performance.md` | Adding a library, media, or anything heavy above the fold |
| `${CLAUDE_PLUGIN_ROOT}/shared/experience-profiles.md` | Choosing or applying the profile |
| `${CLAUDE_PLUGIN_ROOT}/shared/workflow.md` | Cross-skill handoffs and the reporting format |

## Expected deliverables

- Working code in the project's stack, using tokens from `studio3.design.json` (created or reused).
- All states implemented for every component and async surface touched.
- A short structure note (sections or flow steps with their jobs) in the final message.
- Review artefacts under `.studio3/review/` and experience output under `.studio3/experience/` when those ran.
- A report separating measured results, subjective rubric scores and untested areas.

## Validation

Before claiming done, all of the following are true, or the exception is stated in the report:

1. The project's own checks ran and passed: typecheck, lint, tests, build (use the scripts in `package.json`).
2. `studio3 design validate` accepts `studio3.design.json`.
3. `studio3 review run …` ran at least once against the built page; no open findings of the highest severity;
   passes used ≤ 3 (`studio3 review loop-status`).
4. `studio3 experience assess --profile <profile>` ran, and its result is quoted with the profile.
5. You walked the primary task by keyboard and at 320 px yourself, or you say you could not.
6. Every non-negotiable above is ticked.

Never write that a check passed unless it ran in this session and you saw the output. If a browser or
dependency is missing, report the check as **not run** and point to `studio-setup`.
