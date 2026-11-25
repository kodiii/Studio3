---
type: regex
target: {source: file, path: src/components/FeatureGrid.module.css}
match: not_contains
pattern: '@keyframes[^}]*\{[^}]*\b(?:top|left|right|bottom|width|height|margin(?:-\w+)?)\s*:'
flags: i
---
