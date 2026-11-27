---
name: studio-social
description: Social Studio. Designs and builds interfaces that make people participate - social feeds, stories and vertical video, creator profiles and creation tools, comments, reactions and likes, polls, messaging and chat, communities and groups, events, social commerce, share flows, interactive campaigns and 3D or AR-ready posts. Use when the request mentions a feed, stories, reels, a like or reaction animation, a poll, comments, creators, a community, chat, sharing, swipe cards or a social campaign. Not for conversion-first landing pages (studio-product), scroll-driven narratives (studio-cinematic), dashboards and charts (studio-data), or building the WebGL scene (studio-3d).
argument-hint: "[social surface or interaction to build]"
license: MIT
metadata:
  short-description: Feeds, stories, reactions and communities people choose to join
  specialty: social
---

# Social Studio

**Make people participate.**

You are the product designer and the front-end engineer on this task. Participation comes from low effort,
instant feedback and a reason to come back that the person would endorse. A like that answers in the same
frame, a composer that never loses a draft and a feed that ends are worth more than any engagement trick.
Participation must be chosen: no design here manipulates, fakes or traps.

## Use when

- Feeds, stories, reels and vertical video; carousels; explore and discovery grids.
- Participation controls: likes, saves, reactions, polls, comments, shares, follows.
- Creator surfaces: profiles, composers, media upload, scheduling, creator tools.
- Communities, groups, messaging and chat, events and RSVPs, social commerce.
- Interactive campaigns and shareable pieces, including 3D posts and AR-ready previews (with `studio-3d`).

## Don't use when

| The request is mainly… | Use |
|---|---|
| A landing, pricing or sign-up page that must convert | `studio-product` |
| A scroll-driven story or launch film for a campaign | `studio-cinematic` (you supply the participation pieces) |
| Analytics for creators or moderators | `studio-data` |
| The WebGL scene, AR asset or shader | `studio-3d` (and `studio-asset-optimizer` for models) |
| One reusable effect or motion-token question | `studio-motion` |
| Only reviewing an existing social surface | `studio-review` |

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

**0. Inspect.** Run `maquettekit review inspect --dir .`. Note the framework, router, styling, gesture and
animation libraries (Motion, a gesture library, GSAP), media handling, data fetching and real-time transport,
and whether `maquettekit.design.json` exists. Work with the installed gesture and animation stack.

**1. Brief.** Infer first. Ask at most three questions, only if the answer changes the build:

| Ask if unknown | Infer or default |
|---|---|
| Who participates, and the core loop (consume → react → create → share → return) | Experience profile: **Expressive**; Essential for moderation and messaging utilities; Immersive for campaigns |
| Whether the audience may include minors | High-privacy defaults throughout (`references/ethics.md` §7) |
| Real content and counts: is there a backend, or sample content | Sample posts, people and counts are invented, fictional and labelled `Sample content` |

**2. Design direction.** Delegate to `studio-design-system`. Reuse an existing `maquettekit.design.json`;
otherwise `maquettekit design init`, `maquettekit design directions`, then
`maquettekit design generate --brief brief.json --out maquettekit.design.json --css tokens.css --specialty social`.
User content is the hero: keep chrome quiet so media, names and words carry the colour.

**3. Structure.** Map the participation loop and each surface's job (`references/playbook.md` §1). For every
surface list its states: empty, first use, loading, error, offline, optimistic-pending, rolled back, and the
moderation states (pending review, removed with reason, reported, blocked). Run the ethics checklist in
`references/ethics.md` §9 against the plan now, before anything is built.

**4. Build.** Search the library first: `maquettekit catalog search <query> --specialty social` (or
`--category social`, `--category gestures`), then `maquettekit catalog show <id>`; adapt through
`studio-components`. Ids to confirm in the catalogue: `reaction-burst`, `like-heart-morph`,
`poll-result-bars`, `story-progress-segments`, `swipe-card-stack`, `pull-to-reveal-sheet`,
`expanding-card-detail`, `skeleton-shimmer-handoff`, `number-ticker`, `morph-submit-button`. Every gesture gets
its button and keyboard twin as you build it, not afterwards (`references/interaction-patterns.md`).

**5. Motion pass.** Delegate tokens to `studio-motion`; meet the craft floor in
`${CLAUDE_PLUGIN_ROOT}/shared/motion-craft.md` §1. Feedback paints in the next frame; springs carry
gesture velocity; celebration is brief and reserved for the person's own action. Content already moves in a
feed, so ambient motion stays low.

**6. 3D when it earns its place.** Real-time 3D fits when the object or the avatar is what people came to
inspect, play with or share, the post works as a poster without it, and the feed keeps one canvas. Load
`references/social-3d.md` and hand the scene to `studio-3d`. Otherwise use the poster, video or CSS
alternative it lists.

**7. Verify.** Fastest path: `maquettekit check --url <url>` runs the design-file check, token lint, review and experience assessment in one go and writes one ranked fix list to `.maquettekit/check/check.md`; fix in order and re-run (at most three rounds). The steps below are the same checks one by one.
Start the dev server or a build. Via `studio-review`:
`maquettekit review run --url <url> --out .maquettekit/review --pass 1`; fix by severity; re-test; at most three
improve→retest passes; `maquettekit review summary`. Via `studio-experience`:
`maquettekit experience assess --profile expressive` (or the profile you chose). Then the manual checks in
Validation.

**8. Report.** Follow `workflow.md`: built, assumptions, measured, subjective, not tested. Include the result
of the ethics checklist, item by item.

## Non-negotiables

Each is a checkable statement. A build that fails one is not finished.

- [ ] The ethics checklist in `references/ethics.md` §9 passes: no deceptive patterns, forced engagement,
      confirmshaming, fake urgency or fake scarcity.
- [ ] Every count, presence dot, "typing…" indicator and notification comes from real data, or is sample
      content labelled as such; nothing ticks or looks live without a real source.
- [ ] Every gesture (swipe, drag, long-press, double-tap, pinch, pull) has a visible single-pointer
      alternative and a keyboard path (2.5.1, 2.5.7, 2.1.1).
- [ ] Craft floor (Expressive, `shared/motion-craft.md` §1): at least one gesture is physical (follows the finger,
      keeps its release velocity, resists at the ends); reactions and controls press in with depth and lit
      shadows; something answers the pointer or the scroll continuously.
- [ ] Auto-advancing or autoplaying content (stories, video, carousels) can be paused, does not advance under
      reduced motion, and never plays sound without opt-in.
- [ ] Feeds reach a natural end or "You're up to date" marker; autoplay-next is controllable; the footer is
      reachable.
- [ ] Reactions and likes respond in the next frame; optimistic updates reconcile with the server, roll back
      visibly with a reason on failure, and cannot double-submit.
- [ ] Privacy-protective defaults: the audience is visible before posting; location, contact upload and
      discoverability are opt-in; uploaded photos have location metadata stripped; notification permission is
      asked in context, never on first launch.
- [ ] Toggle controls use `aria-pressed` and keep counts as text; media has alt text or prompts for it;
      video has captions or a captions slot.
- [ ] User content renders safely: escaped text (no raw HTML), `dir="auto"` on user-written text, long names
      and links handled; user links carry `rel="ugc noopener"`.
- [ ] Primary actions sit within thumb reach on phones; touch targets ≥ 44 px; works at 320 px.
- [ ] At most one WebGL canvas per view; feed items show posters until a person activates one.
- [ ] Reduced motion honoured; celebratory bursts removed; state changes stay visible as fill, text and count.

## Reference files

Long references open with a quick card: read it first, and the rest only when the task needs the detail.

| File | Load when |
|---|---|
| `references/playbook.md` | Always, at step 3: participation loop, feeds, stories, carousels, profiles, creation, sharing, discovery, community, messaging, thumb zones, vertical media, optimistic UI, density |
| `references/interaction-patterns.md` | Reactions, like and save morphs, polls, comments, swipe and gestures, stories mechanics, media-to-detail transitions, sheets, springs |
| `references/ethics.md` | Always: the anti-manipulation rules and the checklist that must pass, at step 3 and before the report |
| `references/social-3d.md` | 3D posts, product showcases in feeds, avatars, AR-ready previews, campaign effects |
| `references/demos.md` | A worked composition: `creator-feed`, `stories`, `interactive-poll`, `campaign-landing`, `3d-social-post` |
| `${CLAUDE_PLUGIN_ROOT}/shared/accessibility.md` | Gestures, pause controls, live regions, focus management |
| `${CLAUDE_PLUGIN_ROOT}/shared/performance.md` | Media, feeds, anything heavy in a scrolling list |
| `${CLAUDE_PLUGIN_ROOT}/shared/design-principles.md` | Step 2 and the final self-critique |
| `${CLAUDE_PLUGIN_ROOT}/shared/experience-profiles.md` | Choosing or applying the profile |
| `${CLAUDE_PLUGIN_ROOT}/shared/workflow.md` | Cross-skill handoffs and the reporting format |

## Expected deliverables

- Working code in the project's stack, using tokens from `maquettekit.design.json` (created or reused).
- A short participation-loop note: surfaces, the job of each, and their states, in the final message.
- Every gesture with its button and keyboard alternative; every async action with pending, success, rollback
  and error states.
- The ethics checklist result, item by item, in the report.
- Review artefacts under `.maquettekit/review/` and experience output under `.maquettekit/experience/` when those ran.
- A report separating measured results, subjective rubric scores and untested areas.

## Validation

Before claiming done, all of the following are true, or the exception is stated in the report:

1. The project's own checks ran and passed: typecheck, lint, tests, build.
2. `maquettekit design validate` accepts `maquettekit.design.json`, and `maquettekit design lint --dir . --fail-on major`
   exits 0 — no colour in the code that is not from the palette.
3. `maquettekit review run …` ran at least once; no open findings of the highest severity; passes used ≤ 3
   (`maquettekit review loop-status`).
4. `maquettekit experience assess --profile <profile>` ran, and its result is quoted with the profile.
5. Manual checks you performed, or state you could not: every gesture operated with single clicks and with the
   keyboard; stories paused by button, hold and `Space`; a forced network failure rolls back an optimistic
   like with a message; rapid toggling ends in the right state; reduced motion; 320 px and 390 px with the
   on-screen keyboard open in the composer.
6. The ethics checklist in `references/ethics.md` §9 was walked item by item against the built surfaces.
7. Every non-negotiable above is ticked.

Never write that a check passed unless it ran in this session and you saw the output. If a browser or
dependency is missing, report the check as **not run** and point to `studio-setup`.
