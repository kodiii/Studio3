---
type: regex
target: {source: file, path: package.json}
match: not_contains
pattern: '"(?:framer-motion|motion|gsap|animejs|aos|@react-spring/web|react-spring|react-intersection-observer|@formkit/auto-animate)"\s*:'
---

No animation or observer library added.
