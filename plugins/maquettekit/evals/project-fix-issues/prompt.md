---
name: project-fix-issues
tags: [project, review]
runs: 2
max_turns: 40
timeout_seconds: 1200
allowed_tools: [Skill, Read, Glob, Grep, Write, Edit]
---

Customers say our product page (index.html, styles.css, app.js) is hard to use on phones, with the keyboard and with a screen reader, and that the Save button on the "You might also like" card does nothing when they click it. Find the causes and fix them in the code. Keep the design otherwise the same and don't ask me questions.
