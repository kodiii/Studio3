---
type: regex
target: {source: file, path: signup.html}
match: contains
pattern: 'autocomplete\s*=\s*"(?:email|name|new-password)"'
---

Personal-data fields carry autocomplete tokens (WCAG 1.3.5).
