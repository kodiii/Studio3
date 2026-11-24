---
type: regex
target: {source: file, path: cards.html}
match: not_contains
pattern: '@keyframes[^}]*\{[^}]*\b(?:top|left|right|bottom|width|height|margin(?:-\w+)?)\s*:'
flags: i
---

Entrances animate transform and opacity, not layout properties.
