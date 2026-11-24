---
type: regex
target: {source: file, path: dashboard.html}
match: contains
pattern: '<svg[^>]*(?:role\s*=\s*"img"[^>]*aria-label|aria-labelledby)|<title>'
flags: i
---

The chart has an accessible name.
