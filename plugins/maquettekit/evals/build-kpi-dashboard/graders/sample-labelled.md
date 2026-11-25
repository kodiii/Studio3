---
type: regex
target: {source: file, path: dashboard.html}
match: contains
pattern: '\b(?:sample|simulated|demo|example|generated|mock|synthetic|illustrative)\s+data\b'
flags: i
---

Generated data is labelled as such on the page.
