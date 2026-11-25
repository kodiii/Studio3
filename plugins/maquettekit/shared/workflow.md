# Maquettekit operating procedure

> **Quick card** — the must-dos from this file; read on for the reasons and the detail.
>
> - Run `maquettekit review inspect --dir .` first; check flags with `maquettekit <command> --help`, never guess.
> - Unless asked for a redesign, extend what is there; reuse any `maquettekit.design.json` and never build without tokens.
> - Ask only what changes the build and the repository cannot answer: at most three questions, in one message.
> - Scale the procedure to the task: a tweak needs only inspect, build, verify, report.
> - Run at most three review passes; after pass 3, stop and report what remains.
> - Never say a test, check or build passed unless you ran it in this session and saw the result.
> - Keep measured and subjective statements in separate lists.
> - Never write outside the project; never delete or overwrite a user's design file without saying so first.

One procedure for every specialty. Each specialty skill restates it briefly with its own defaults; this file is
the full version and the tie-breaker when skills disagree.

`maquettekit <command>` below is shorthand for the tool dispatcher described in each skill's Tooling section. Run
`maquettekit <command> --help` for exact flags instead of guessing.

## 1. The loop

```
0 inspect ─▶ 1 brief ─▶ 2 design system ─▶ 3 structure ─▶ 4 build ─▶ 5 motion ─▶ 6 3D? ─▶ 7 review loop (≤3) ─▶ 8 experience ─▶ 9 report
                                   ▲                                                         │
                                   └────────────── fix findings, re-test ◀───────────────────┘
```

| Step | Do | Owner skill | Output |
|---|---|---|---|
| 0. Inspect | Read the project: framework, styling, existing components, tokens, tests, scripts. Run `maquettekit review inspect --dir .` and look for an existing `maquettekit.design.json`. If tools fail, run `maquettekit doctor` | any (diagnostics: `studio-setup`) | Facts about the stack; what must be preserved |
| 1. Brief | Establish product, audience, goal, content, constraints, experience profile. Ask only what you cannot infer; state every assumption | specialty skill | Short written brief with assumptions listed |
| 2. Design system | Generate or reuse `maquettekit.design.json` and its tokens. Never build without tokens | `studio-design-system` | `maquettekit.design.json`, tokens CSS |
| 3. Structure | Information architecture, page/section list, component inventory, states | specialty skill | Outline the user can veto cheaply |
| 4. Build | Implement with the project's stack. Search the library before writing an effect: `maquettekit catalog search <query>` | specialty skill + `studio-components` | Working code |
| 5. Motion | One deliberate pass: tokens, choreography, reduced motion, interruption | `studio-motion` | Motion implemented and documented |
| 6. 3D (optional) | Only if the specialty's criteria are met. Otherwise the lightweight alternative | `studio-3d` (+ `studio-asset-optimizer`) | Scene with fallback, or a documented decision not to |
| 7. Review loop | Capture, analyse, fix, re-test. At most three passes | `studio-review` | `.maquettekit/review/…` reports |
| 8. Experience | Heuristic interaction-quality assessment against the chosen profile | `studio-experience` | `.maquettekit/experience/…` |
| 9. Report | What was built, what was measured, what is subjective, what was not tested | specialty skill | Final message to the user |

### Scaling the procedure to the task
Do not run nine steps to change a button.

| Task size | Steps |
|---|---|
| Tweak (one component, copy, spacing) | 0 (quick), 4, verify the changed view, 9 |
| Feature (a section, a flow, a chart) | 0, 1 (inferred), 2 (reuse), 4, 5, 7 (one pass), 9 |
| New surface or redesign | All steps |

### Step 0 details — what to look for
- Framework and router; TypeScript or not; styling approach; component library; animation libraries already
  installed; test runner; lint rules; the dev/build/test scripts in `package.json`.
- Existing design language: tokens, theme files, fonts. **Refinement preserves, redesign replaces**: unless the
  user asked for a redesign, extend what is there.
- `maquettekit.design.json`: if present, it is the source of truth for direction and tokens. Reuse it so separate
  sessions produce one coherent product. Regenerate only when the user asks for a new direction, and say so.
- Non-React projects: use CSS, the Web Animations API, vanilla GSAP or vanilla three.js. Never add React to
  host a recipe.

### Step 1 details — ask vs. infer
Ask (briefly, in one message, at most three questions) only when the answer changes the build and cannot be
found in the repository: who it is for, the single most important action, hard brand constraints. Infer
everything else, proceed, and list the assumptions at the top of your reply. If the user said "just build it",
ask nothing.

### Step 2 details — design system
Typical sequence (delegate to `studio-design-system` for the rules):

```
maquettekit design init                      # brief template
maquettekit design directions                # available visual directions
maquettekit design generate --brief brief.json --out maquettekit.design.json --css tokens.css
maquettekit design validate                  # check the result
maquettekit design explain                   # rationale for each decision
```

Apply the taste code in `design-principles.md` to the result: a generated system is a starting point you are
responsible for.

### Step 7 details — the review loop
```
maquettekit review run --url <url> --out .maquettekit/review --pass 1
# read the report → fix the highest-severity findings → re-run
maquettekit review run --url <url> --out .maquettekit/review --pass 2
maquettekit review compare        # what changed between passes
maquettekit review loop-status    # passes used, findings open
maquettekit review summary        # final summary for the report
```

- **Three passes maximum.** After pass 3, stop and report what remains. An endless polish loop is a failure
  mode, not diligence.
- Fix by severity: broken (errors, missing content, inaccessible controls) → measurable defects (contrast,
  overflow, target size) → subjective improvements (rubric in `design-principles.md`).
- A pass with no measurable change is wasted: if a fix did not alter the report, find out why before
  spending another pass.
- The Visual Director needs a URL, so a dev server or static build must be running. If you cannot start one or
  no browser is installed (`maquettekit doctor --browser`; `maquettekit setup --only review --browsers` installs the
  optional dependency with the user's agreement), say the review **did not run**.

## 2. Collaboration matrix

Rows call columns. Delegate by naming the skill; do not restate its content.

| Caller ↓ / Callee → | design-system | components | motion | 3d | asset-optimizer | review | experience |
|---|---|---|---|---|---|---|---|
| **studio-product** | always | always | transitions, feedback, onboarding | configurators, viewers, exploded views | when models are used | always | always |
| **studio-cinematic** | always | always | scroll choreography, kinetic type | immersive storytelling, scroll-driven scenes, WebGL backgrounds | when models are used | always | always |
| **studio-data** | always | charts recipes | transitions between data states | spatial data (networks, 3D scatter) only when justified | rarely | always | always |
| **studio-social** | always | social/gesture recipes | reactions, gestures, media transitions | 3D posts, spatial showcases, avatars | when models are used | always | always |
| **studio-3d** | reuse tokens | 3D recipes | camera/DOM choreography | n/a | always for external assets | always (3D diagnostics) | always |

Typical cross-studio projects:

| Project | Lead | Supporting |
|---|---|---|
| Product page with configurator | studio-product | studio-3d, studio-asset-optimizer, studio-motion |
| Launch story with scroll-driven scene | studio-cinematic | studio-3d, studio-motion |
| Dashboard with a network graph | studio-data | studio-3d only if 2D fails the criteria in its `spatial-data.md` |
| Campaign page with shareable 3D post | studio-social | studio-3d, studio-cinematic for the landing narrative |
| Marketing site + app shell | studio-product | studio-cinematic for the hero narrative only |

When two specialties could lead, the one that owns the **primary user goal** leads: converting or using →
product; remembering → cinematic; understanding data → data; participating → social; manipulating an object in
space → 3D.

## 3. Project files Maquettekit writes

| Path | Written by | Purpose | Commit it? |
|---|---|---|---|
| `maquettekit.design.json` | `maquettekit design generate` | Direction, tokens, type, motion profile; reused across sessions | Yes |
| tokens CSS (path you pass to `--css`) | `maquettekit design generate` / `design tokens` | CSS custom properties for the system | Yes |
| `brief.json` (name of your choice) | `maquettekit design init` + you | The brief the system was generated from | Yes, useful history |
| `.maquettekit/review/…` | `maquettekit review run` | Screenshots, findings, per-pass reports, comparisons | Usually no; ask before adding to `.gitignore` |
| `.maquettekit/experience/…` | `maquettekit experience` | Assessment, rubric, scores | Usually no |
| Asset outputs (path you choose) | `maquettekit assets …` | Optimised models, variants, manifest, thumbnails | Yes for shipped assets |

Never write outside the project directory. Never delete or overwrite a user's existing design file without
saying so first. Maquettekit tools send no telemetry and download nothing except through an explicit `maquettekit setup`.

## 4. Reporting rules

The final message is part of the deliverable. Structure:

1. **What was built**: files created/changed, the direction in one sentence, the experience profile.
2. **Assumptions** made in place of questions.
3. **Measured results**: only numbers produced by a tool in this session, each with tool, conditions and pass
   number (for example "Visual Director pass 2, 390 px and 1440 px: 0 contrast failures on solid backgrounds").
4. **Subjective assessment**: rubric scores from `design-principles.md`, labelled as your judgement.
5. **Not tested / limitations**: everything you could not run or verify (no browser, no real device, no screen
   reader, software-rendered WebGL, simulated data).
6. **Next steps** the user may want, at most three.

Hard rules:

- Never state that a test, check or build passed unless you ran it in this session and saw the result.
- "Not run" is a valid, honest status. "Should pass" is not a status.
- Keep measured and subjective statements in separate lists.
- Do not claim standards conformance ("WCAG compliant", "Core Web Vitals passing") from lab or automated
  checks; state what was checked.
- Simulated or sample data is labelled in the UI and mentioned in the report.
- If you stopped after three review passes with open findings, list them.

## 5. Extending Maquettekit with a new specialty

Specialties are additive: nothing existing is rewritten.

1. **Skill folder**: `skills/studio-<name>/SKILL.md` with frontmatter (`name` equal to the folder name,
   single-line `description` with trigger conditions and the sibling skills to use instead, `argument-hint`,
   `license`, `metadata.short-description`, `metadata.specialty`). Follow the body shape of the existing
   specialty skills: philosophy, use when / do not use when, tooling, the numbered workflow, non-negotiables,
   reference table, deliverables, validation.
2. **Playbook**: `skills/studio-<name>/references/playbook.md` plus focused references. Reference the shared
   documents in this folder instead of repeating them.
3. **Demos folder**: `library/src/demos/<specialty-id>/<demo-id>/` with `meta.ts` and `index.tsx` following the
   library contract; add a `references/demos.md` describing what each demonstrates.
4. **Specialty id**: add the id to the library's specialty type and list, and tag relevant effect recipes with
   it so `maquettekit catalog search --specialty <id>` finds them. Rebuild the catalogue.
5. **Profiles and matrix**: add a row to the per-specialty defaults in `experience-profiles.md` and to the
   collaboration matrix above.
6. **Verify**: the new skill's own demos must pass the same review loop as everything else.

A new specialty needs no change to the tools: the Design Intelligence Engine, Visual Director and Experience
Lab operate on briefs, URLs and profiles, not on specialty-specific code.
