---
type: regex
target: {source: file, path: index.html}
match: contains
pattern: '<label\b|aria-labelledby\s*=|aria-label\s*='
---

The restock email field has an accessible name (a placeholder is not a label).
