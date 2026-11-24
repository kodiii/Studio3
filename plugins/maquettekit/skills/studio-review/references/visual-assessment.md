# Agent-led visual assessment

Part B of `report.md` is your judgement. It is valuable precisely because it is clearly separated from the measured
Part A. Write it after you have looked at the screenshots — not from the code.

## How to look

1. Open `screenshots/<route>/desktop-normal-fold.png` first: the first impression. Then `full`, then `tablet` and
   `mobile`. Compare `normal` with `reduced` — the reduced version must still communicate everything.
2. Squint test: blur your attention — what is the first, second and third thing you notice? That is the actual
   hierarchy. Compare it with the intended one.
3. Check rhythm: are vertical gaps drawn from one scale? Do edges align to a grid? Are there orphaned elements?
4. Read the type: line length (45–75 characters for body copy), leading, contrast between levels, consistent
   numerals in data, no widows in display type.
5. Look at the frames (`frames/…-0000ms` → `0900ms`): does motion lead the eye to the right thing, in the right
   order, and finish quickly?
6. States: hover/focus/open screenshots — is feedback visible, consistent and calm?

## Scoring (1–5 per criterion)

Use the rubric descriptors in `${CLAUDE_PLUGIN_ROOT}/shared/design-principles.md`. For each criterion write:
observation (specific, located: "pricing cards at mobile: three equal-weight CTAs compete"), score, and the evidence
screenshot path. Scores without observations are worthless; observations without locations are not actionable.

| Criterion | Ask |
| - | - |
| Composition | Is there a clear structure and focal point at every breakpoint? |
| Typography | Is the scale purposeful, the measure comfortable, the pairing intentional? |
| Hierarchy | Does the squint order match the intended priority? |
| Spacing | One rhythm, consistent alignment, breathing room proportional to importance? |
| Originality | Would this be mistaken for a template? Is anything here specific to this brand? |
| Motion purpose | Does each animation explain a change, guide attention or give feedback — or is it decoration? |

## Turning judgement into action

Subjective issues become fixes only when you can name the principle and the change ("reduce the hero heading from
three weights to one; the secondary line competes with the CTA"). Mark them as design changes in `changes.json`
and re-capture, so the before/after screenshots document the decision. Never present a subjective score as a test
result.
