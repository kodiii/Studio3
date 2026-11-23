# The improve → retest loop

```
pass 1: run → read → assess → fix (local) → record
pass 2: run → compare(1→2) → fix remaining → record
pass 3: run → compare(2→3) → summary          (stop earlier when no critical issues remain)
```

## Per pass

1. `studio3 review loop-status --out .studio3/review` — read `fixList` (priority order: critical, then major,
   grouped across viewports) and `nextAction`.
2. Fix the top items. One logical change per issue group; touch the smallest scope that resolves it. If a fix needs a
   design decision (e.g. changing a brand colour), propose options and ask instead of improvising.
3. Append to `.studio3/review/changes.json`:
   ```json
   [{ "pass": 1, "file": "src/components/Nav.tsx", "change": "Menu button: added aria-label and 44px target", "issueIds": ["accessibility-axe:/:mobile:button.menu"] }]
   ```
   Use the issue `id` or `fingerprint` from `report.json`.
4. Rebuild/restart if the target is a production build, then `studio3 review run … --pass <n+1>` with the same
   routes, viewports and states as before (comparability matters more than coverage changes mid-loop).
5. `studio3 review compare --before .studio3/review/pass-<n> --after .studio3/review/pass-<n+1>` — check resolved,
   introduced and remaining issues and the per-screenshot changed-pixel ratios. Any introduced critical/major issue is
   fixed before anything else.

## Stop rules

- Stop when `loop-status` reports `criticalResolved: true` and the remaining majors are either fixed or explained.
- Stop at the pass budget (default 3) and report what remains.
- Stop and ask the user when the remaining issues require product or brand decisions.

## Visual regression in CI

Keep an approved pass as a baseline (commit it or store it as a CI artefact) and gate later builds:

```bash
studio3 review run --url http://localhost:3000 --routes / --out .studio3/ci --pass 1 --no-3d
studio3 review compare --baseline baseline/pass-1 --current .studio3/ci/pass-1 --max-diff-ratio 0.01
```

The command exits 1 when any screenshot differs by more than the ratio. Animated or time-dependent content needs
reduced motion or explicit states to be stable; fonts must be self-hosted for deterministic rendering.
