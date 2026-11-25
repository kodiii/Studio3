---
name: studio-match
description: Match Studio. Use when the user gives a reference image — a mockup, a design export (Figma, Sketch, Penpot), a screenshot or a sketch photo — and wants a page or component built or adjusted to match it ("make it look like this", "build this design", "match the mockup", "pixel-perfect", "it doesn't look like the design"). Load it before building as well as before adjusting. Measures the page against the image with maquettekit review match and closes the gap region by region using the project's design tokens. Not for designing without a reference (the specialty studios) or general QA (studio-review).
argument-hint: "[reference image] [url or static dir]"
license: MIT
metadata:
  short-description: Build to a reference image and measure how close it is
  module: visual-director
---

# Match Studio

**Close the gap you can measure.** A reference image is a specification. Read it like one — grid, spacing, type
sizes, colours — build with the project's tokens, then let the pixel comparison show where the page still differs.

## Use when

- The user supplies a mockup, design export or screenshot and wants the page to match it.
- A built page "doesn't look like the design" and the difference needs locating.

Don't use when there is no reference (use the specialty studio for the kind of page) or the request is a review of
defects (`studio-review`).

## Tooling

Maquettekit tools run through one dispatcher: `node "${CLAUDE_PLUGIN_ROOT}/tools/maquettekit.mjs" <command>`. On hosts
that do not substitute that variable (Codex), the same file is `../../tools/maquettekit.mjs` relative to this
SKILL.md. Below, `maquettekit <command>` is shorthand for that invocation. `review match` needs Playwright and
Chromium (`studio-setup` if it exits with code 3).

## Workflow

1. **Check the rights and the intent.** A reference from the user's own design work is a specification. A screenshot
   of someone else's product is inspiration: match its structure and quality, never its logo, illustrations, photos,
   copy or brand colours, and never build something that could pass for the other company's site. If unclear, ask.
2. **Read the reference** (`references/reading-a-reference.md`): its pixel size and whether it is @2x; the column
   grid and margins; the vertical rhythm; type sizes, weights and line lengths; colours; components and their states.
   Note what the image cannot tell you (hover, focus, motion, other breakpoints, real content) and decide those with
   the specialty studio's rules.
3. **Map to tokens.** If `maquettekit.design.json` exists, express every measured value as a token, and add deliberate
   new values through its `overrides` (`studio-design-system`). If not, generate one whose palette and type follow
   the reference. No hard-coded colours or arbitrary spacing: `maquettekit design lint` must stay clean.
4. **Build** the page or component, reusing library recipes where they fit (`studio-components`).
5. **Measure**: `maquettekit review match --url <url> --reference <image> [--scale 2]` (or `--serve <dir>`). It
   captures the page at the image's size and reports pixel similarity, the 3×3 regions that differ most, reference
   colours missing from the page and the trend over earlier runs. Look at `diff.png` next to the two images.
6. **Close the largest gap first**, one region at a time: layout and size before colour, colour before detail. Re-run
   after each change. Stop at the agreed target (about 95 % for a pixel-faithful build of a full-fidelity mockup; 85 %
   is often right when content differs), after five rounds without progress, or when the remaining difference is
   content you were not given — and say which.
7. **Verify behaviour** the image cannot show: other breakpoints, states, keyboard, reduced motion —
   `maquettekit check --url <url>`.
8. **Report**: similarity per run, what was decided where the reference was silent, and anything left different on
   purpose (and why).

## Non-negotiables

- [ ] No third-party brand assets, copy or identity reproduced from a reference you do not own.
- [ ] Every colour, size and space comes from the design tokens; `maquettekit design lint --dir . --fail-on major` exits 0.
- [ ] The page works where the reference says nothing: 320 px width, keyboard, focus, reduced motion, real content
      lengths. Never trade accessibility for pixel similarity (contrast, target sizes, visible focus win).
- [ ] Similarity is reported as a measurement with its viewport and scale, never as "matches the design".

## Reference files

| File | Load when |
|---|---|
| `references/reading-a-reference.md` | Step 2 and 6: measuring a mockup, @2x exports, what similarity numbers mean, common sources of difference |
| `${CLAUDE_PLUGIN_ROOT}/shared/design-principles.md` | Deciding what the reference does not specify |
| `${CLAUDE_PLUGIN_ROOT}/shared/accessibility.md` | When the reference conflicts with accessibility |

## Expected deliverables

- The built or adjusted page using design tokens; `.maquettekit/match/` with the final `match.md`, `diff.png` and the run history.
- A short note: final similarity (viewport, scale), regions still different and why, decisions made where the reference was silent.

## Validation

1. `maquettekit review match` ran against the final build; its similarity and trend are quoted.
2. `maquettekit design lint --dir . --fail-on major` exits 0.
3. `maquettekit check --url <url>` ran and its critical items are fixed.

Never write that a check passed unless it ran in this session and you saw the output.
