# Improving by dimension

| Dimension | Typical fixes | Hand over to |
| - | - | - |
| Discoverability | visible labels over icon-only controls; affordances that look interactive; obvious primary action | specialty skill |
| Usability | fewer steps; sensible defaults; forgiving inputs; undo instead of confirm | specialty skill |
| Visual feedback | hover/focus/active/disabled/loading states for every control; immediate response (< 100 ms) to input | `studio-motion` (press/hover recipes) |
| Navigation consistency | the same nav items, order and placement on every route; current page marked (`aria-current`) | specialty skill |
| Touch interaction | targets ≥ 24 px (44 px for primary), spacing, no hover-only functions, gesture alternatives | specialty skill |
| Keyboard support | native elements, logical order, visible focus, Escape closes overlays, no traps | `studio-review` to verify |
| Motion usefulness | remove decorative loops; shorten durations to the profile; motion explains change or guides attention | `studio-motion` |
| Cognitive load | one primary action per view; fewer type sizes and colours; progressive disclosure | `studio-design-system` (tokens), specialty skill |
| Loading experience | skeletons that match the layout, no layout shift, progress only when it is real | `studio-motion` (loading recipes) |
| Perceived performance | optimistic UI, instant feedback, lazy-load below the fold, smaller hero media | specialty skill, `studio-asset-optimizer` for 3D |
| Interaction predictability | consistent component behaviour; no surprise navigation; state survives back/forward | specialty skill |
| Error handling | inline, specific messages tied to fields (`aria-describedby`), recoverable errors, `role="alert"` for urgent ones | specialty skill |
| Accessibility | see `${CLAUDE_PLUGIN_ROOT}/shared/accessibility.md` | `studio-review` |
| Spatial interaction clarity | instructions near the canvas, reset/escape controls, constrained cameras, DOM equivalents | `studio-3d` |

After changes, re-run `assess` with the same routes, profile and (updated) answers, and report the per-dimension
delta. A change that raises one dimension and lowers another (for example richer motion lowering perceived
performance) is a trade-off to present, not a win to claim.
