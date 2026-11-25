---
type: regex
target: {source: file, path: styles.css}
match: not_contains
pattern: 'font(?:-family)?\s*:[^;{}]*["'']'
---

No font family named directly; fonts come from tokens.
