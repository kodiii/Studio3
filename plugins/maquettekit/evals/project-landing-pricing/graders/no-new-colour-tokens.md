---
type: regex
target: {source: file, path: tokens.css}
match: count:8
pattern: '#[0-9a-fA-F]{6}\b'
---

tokens.css still holds exactly the 8 original colour values.
