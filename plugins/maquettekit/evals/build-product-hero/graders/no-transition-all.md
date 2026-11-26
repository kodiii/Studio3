---
type: regex
target: {source: file, path: hero.html}
match: not_contains
pattern: 'transition\s*:\s*all\b'
flags: i
---

Animate named properties, never `all`.
