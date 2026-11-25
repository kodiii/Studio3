---
type: llm
focus: {source: file, path: styles.css}
---

PASS if the .promo banner can no longer be wider than a 390 px phone screen: its fixed "width: 720px" was removed or replaced with a fluid value, or max-width: 100% (or similar) was added. FAIL if width: 720px remains with nothing preventing horizontal overflow.
