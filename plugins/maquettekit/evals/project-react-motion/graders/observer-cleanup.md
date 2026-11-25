---
type: llm
focus: {source: file, path: src/components/FeatureGrid.tsx}
---

PASS if every IntersectionObserver, event listener or timer the component creates inside an effect is cleaned up in that effect's cleanup function (disconnect, unobserve, removeEventListener or clearTimeout), or if the component creates none. FAIL if an observer, listener or timer is created without being cleaned up.
