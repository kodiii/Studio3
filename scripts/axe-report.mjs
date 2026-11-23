#!/usr/bin/env node
// Dev helper: axe-core (WCAG 2.x A/AA) report for gallery routes in light and dark themes, with measured values.
// Usage: node scripts/axe-report.mjs <effect-id | /route> [...] [--all-impacts]
// Base URL: $STUDIO3_BASE_URL or http://localhost:3333. Effect ids are scanned inside their preview stage.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const axe = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const base = process.env.STUDIO3_BASE_URL ?? 'http://localhost:3333';
const all = process.argv.includes('--all-impacts');
const targets = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let failed = 0;
for (const t of targets) {
  const route = t.startsWith('/') ? t : `/effects/${t}`;
  const scope = t.startsWith('/') ? 'body' : `[data-effect-stage="${t}"]`;
  for (const scheme of ['light', 'dark']) {
    const p = await b.newPage({ colorScheme: scheme, viewport: { width: 1280, height: 800 } });
    await p.addInitScript((s) => { try { localStorage.setItem('s3-theme', s); } catch { /* */ } }, scheme);
    await p.goto(base + route);
    await p.waitForTimeout(2500);
    await p.addScriptTag({ content: axe });
    const v = await p.evaluate(async ([sel, everything]) => (await window.axe.run(sel, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations
      .filter((x) => everything || ['serious', 'critical'].includes(x.impact))
      .map((x) => ({ id: x.id, impact: x.impact, nodes: x.nodes.slice(0, 5).map((n) => ({ target: n.target.join(' ').replace(/styles-module__\w+__/g, '.'), html: n.html.slice(0, 120), detail: (n.any[0] || n.all[0] || n.none[0])?.message?.slice(0, 200) })) })), [scope, all]);
    failed += v.length;
    console.log(`\n## ${route} [${scheme}] ${v.length ? '' : '— clean'}`);
    for (const x of v) { console.log(`- ${x.id} (${x.impact})`); for (const n of x.nodes) console.log(`    ${n.target}\n      ${n.html}\n      ${n.detail ?? ''}`); }
    await p.close();
  }
}
await b.close();
process.exit(failed ? 1 : 0);
