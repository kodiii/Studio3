---
type: regex
target: {source: file, path: cards.html}
match: not_contains
pattern: 'transition\s*:\s*all\b'
flags: i
---

Animate named properties, never `all`.
