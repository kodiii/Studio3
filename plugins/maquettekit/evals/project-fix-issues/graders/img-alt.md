---
type: regex
target: {source: file, path: index.html}
match: not_contains
pattern: '<img\b(?![^>]*\balt\s*=)[^>]*>'
flags: i
---

Every image has an alt attribute.
