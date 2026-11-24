---
name: trigger-negative-backend
tags: [trigger, negative]
runs: 3
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill, Read, Glob, Grep]
---

My Express route throws "TypeError: Cannot read properties of undefined (reading 'id')" when the session has expired. How do I fix it?
