---
name: build-kpi-dashboard
tags: [build, data]
runs: 2
max_turns: 30
timeout_seconds: 900
allowed_tools: [Skill, Read, Glob, Grep, Write, Edit]
---

Create `dashboard.html`: a small analytics dashboard with four KPI cards (with change vs last period) and a line chart of daily signups for 30 days, drawn in inline SVG with generated sample data. One self-contained file (inline CSS and JS, no frameworks, no network requests). Don't ask me questions; make reasonable assumptions and state them at the end.
