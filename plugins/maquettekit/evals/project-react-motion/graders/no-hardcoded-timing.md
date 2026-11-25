---
type: regex
target: {source: file, path: src/components/FeatureGrid.module.css}
match: not_contains
pattern: '(?:transition|animation)(?:-duration|-delay)?\s*:[^;]*\b(?!0m?s\b)\d+(?:\.\d+)?m?s\b'
flags: i
---

No raw durations or delays next to the tokens.
