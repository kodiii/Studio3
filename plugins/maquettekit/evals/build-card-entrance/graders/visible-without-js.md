---
type: llm
focus: {source: file, path: cards.html}
---

PASS if the cards are still visible when JavaScript does not run or the IntersectionObserver never fires: the hidden starting state is applied only through a class or attribute that JavaScript adds (or the animation starts from a visible state, or a <noscript> rule reveals them). FAIL if a CSS rule hides the cards unconditionally (opacity: 0, visibility: hidden, display: none, or an off-screen transform) so they depend on JavaScript to appear.
