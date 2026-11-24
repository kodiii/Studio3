---
type: regex
target: {source: file, path: pricing.html}
match: not_contains
pattern: '(?:trusted by|loved by|used by|join)\s+(?:over\s+)?[\d,.]+\s*[kKmM+]*\s*(?:\+\s*)?(?:customers|teams|companies|developers|users|clinics)'
flags: i
---

No invented user counts.
