---
name: build-signup-form
tags: [build, product]
runs: 2
max_turns: 30
timeout_seconds: 900
allowed_tools: [Skill, Read, Glob, Grep, Write, Edit]
---

Create `signup.html`: a sign-up page for a note-taking app with name, email, password and a terms checkbox, validated in the browser before submit. One self-contained file (inline CSS and JS, no frameworks, no network requests). Don't ask me questions; make reasonable assumptions and state them at the end.
