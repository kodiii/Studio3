---
type: llm
focus: {source: file, path: signup.html}
---

PASS if validation errors are first shown on blur or on submit — not on every keystroke while the user is still typing into a field for the first time. Re-validating as the user types after an error is already showing is fine. FAIL only if the code shows an error on the "input" event before the field has been blurred or the form submitted.
