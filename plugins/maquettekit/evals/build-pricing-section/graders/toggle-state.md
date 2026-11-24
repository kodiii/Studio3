---
type: regex
target: {source: file, path: pricing.html}
match: contains
pattern: 'aria-(?:pressed|checked|selected)|role\s*=\s*"(?:switch|radio|tab)"|type\s*=\s*"(?:checkbox|radio)"'
---

The billing toggle exposes its state to assistive tech (native checkbox/radio or ARIA state).
