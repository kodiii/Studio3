---
type: regex
target: {source: file, path: index.html}
match: contains
pattern: 'id="nav-toggle"[^>]*aria-controls="site-nav"|aria-controls="site-nav"[^>]*id="nav-toggle"'
---

The mobile menu button is still wired to the nav.
