---
name: build-pricing-section
tags: [build, product]
runs: 2
max_turns: 30
timeout_seconds: 900
allowed_tools: [Skill, Read, Glob, Grep, Write, Edit]
---

Create `pricing.html`: a pricing section for a scheduling API with three tiers (one recommended), monthly/yearly toggle, and a sign-up button per tier. One self-contained file (inline CSS and JS, no frameworks, no network requests). Don't ask me questions; make reasonable assumptions and state them at the end.
