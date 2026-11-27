# Reading the scores

## Structure

- **Signals** are the atoms: each has an id, a source (`measured` in the browser, `agent` answered from the rubric,
  or `derived` from other signals), a raw value, a normalisation rule to 0–1 and a weight.
- **Dimension score** = weighted mean of the available normalised signals × 100. Signals that could not be obtained
  are excluded and the remaining weights renormalised; a dimension with no available signal is `n/a` (for example
  spatial interaction clarity on a page without a 3D canvas).
- **Confidence** = the share of the dimension's weight backed by evidence (measured or answered). Low confidence
  means "we do not know", not "it is bad".
- **Profile weights** shift the importance of dimensions and the target bands for motion: Essential rewards fast,
  minimal feedback and penalises long or infinite animation; Immersive expects rich feedback and requires spatial
  clarity and motion controls.
- **Gates** (reduced motion honoured, keyboard support, pause/stop controls for moving content, contrast, target
  size) are evaluated independently of the profile. A failed gate caps the overall grade.

The exact formula, weights and thresholds are printed in every report — quote them rather than paraphrasing.

## Interpreting

| Pattern | Likely meaning |
| - | - |
| High score, low confidence | Few signals measured; answer the rubric before trusting it |
| Low perceived performance, good loading experience | Slow, but communicates well — work on actual speed |
| Low visual feedback, high usability | Works, but feels dead; add state feedback, not decoration |
| Low cognitive load score with many CTAs/fonts/colours above the fold | Competing priorities; simplify hierarchy |
| Motion usefulness low under Essential, fine under Expressive | Motion is decorative for a task-focused product — scale it down |
| `pointerResponse` / `scrollResponse` at 0 under Expressive or Immersive | The surface is inert for its profile: only entrances and hover states. Add a continuous driver (craft floor, `shared/motion-craft.md` §1) |
| Any failed gate | Fix before any other recommendation |

## What it is not

Heuristic scoring approximates expert review. It cannot tell you whether users understand the product, want it,
or trust it. Recommend lightweight user testing for decisions that depend on those.
