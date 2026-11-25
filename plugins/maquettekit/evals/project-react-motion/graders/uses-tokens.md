---
type: regex
target: {source: file, path: src/components/FeatureGrid.module.css}
match: contains
pattern: 'var\(--(?:duration|ease|stagger)'
---

Timing comes from the motion tokens.
