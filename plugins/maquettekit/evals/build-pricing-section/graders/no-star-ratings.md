---
type: regex
target: {source: file, path: pricing.html}
match: not_contains
pattern: '(?:★{4,}|\b4\.\d\s*/\s*5\b|\b\d\.\d stars?\b)'
flags: i
---

No invented ratings.
