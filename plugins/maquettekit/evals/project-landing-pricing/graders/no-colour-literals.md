---
type: regex
target: {source: file, path: styles.css}
match: not_contains
pattern: '#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\('
flags: i
---

Every colour in styles.css comes from a token.
