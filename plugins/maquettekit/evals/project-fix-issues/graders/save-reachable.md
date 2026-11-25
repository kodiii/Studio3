---
type: llm
focus: {source: file, path: styles.css}
---

The card link's ::after pseudo-element is stretched over the whole card (position: absolute; inset: 0), so it sits on top of the Save button and takes its clicks. PASS if the stylesheet now lets the button receive clicks — for example the Save button gets position: relative with a z-index above the overlay, or the overlay no longer covers it (removed, limited or given pointer-events handling that lets the button through). FAIL if the stretched ::after still covers the button.
