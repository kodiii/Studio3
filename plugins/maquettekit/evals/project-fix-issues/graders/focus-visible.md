---
type: llm
focus: {source: file, path: styles.css}
---

PASS if buttons now show a visible keyboard focus indicator: the rule ".btn:focus { outline: none; }" has been removed, or it is paired with a :focus-visible (or :focus) rule that gives a visible outline or box-shadow. FAIL if outline: none on focus remains with no visible replacement.
