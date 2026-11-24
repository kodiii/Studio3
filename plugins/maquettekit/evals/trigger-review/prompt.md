---
name: trigger-review
tags: [trigger]
runs: 3
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill, Read, Glob, Grep]
---

Check http://localhost:3000 on mobile and desktop: layout bugs, accessibility problems, broken states. Give me a prioritised list.
