// @ts-check
/** axe-core accessibility check (WCAG 2.x A/AA). Never reports "passed" unless axe actually ran. */
import fs from 'node:fs';
import path from 'node:path';
import { resolveDep } from '../../lib/resolve.mjs';

let cachedSource;
/** @returns {{ source: string | null, reason?: string }} */
export function loadAxeSource() {
  if (process.env.STUDIO3_DISABLE_AXE === '1') return { source: null, reason: 'axe-core disabled via STUDIO3_DISABLE_AXE=1' };
  if (cachedSource) return { source: cachedSource };
  let file = resolveDep('axe-core/axe.min.js');
  if (!file) {
    const main = resolveDep('axe-core');
    if (main) { const cand = path.join(path.dirname(main), 'axe.min.js'); if (fs.existsSync(cand)) file = cand; else file = main; }
  }
  if (!file) return { source: null, reason: 'axe-core could not be resolved (run "studio3 setup" or npm install -D axe-core)' };
  try { cachedSource = fs.readFileSync(file, 'utf8'); return { source: cachedSource }; }
  catch (err) { return { source: null, reason: `axe-core could not be read: ${/** @type {any} */ (err).message}` }; }
}

const IMPACT = { critical: 'critical', serious: 'major', moderate: 'minor', minor: 'minor' };
export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * @param {import('playwright').Page} page
 * @param {{ route: string, viewport: string, col: any, disabled?: boolean }} ctx
 */
export async function runAxe(page, ctx) {
  const { col, route, viewport } = ctx;
  const base = { route, viewport };
  if (ctx.disabled) { col.run('accessibility-axe', { ...base, status: 'skipped', ran: false, reason: 'disabled by --no-a11y' }); return; }
  const { source, reason } = loadAxeSource();
  if (!source) { col.run('accessibility-axe', { ...base, status: 'skipped', ran: false, reason }); return; }
  let results;
  try {
    await page.evaluate(source);
    results = await page.evaluate(async (tags) => {
      // target-size is covered by the responsive check on touch viewports (with measured sizes)
      // @ts-ignore
      return await window.axe.run(document, { runOnly: { type: 'tag', values: tags }, rules: { 'target-size': { enabled: false } }, resultTypes: ['violations'] });
    }, AXE_TAGS);
  } catch (err) {
    col.run('accessibility-axe', { ...base, status: 'skipped', ran: false, reason: `axe-core failed to execute: ${String(/** @type {any} */ (err).message).split('\n')[0]}` });
    return;
  }
  let count = 0;
  for (const v of results.violations) {
    const nodes = v.nodes.slice(0, 10);
    for (const n of nodes) {
      count++;
      const selector = Array.isArray(n.target) ? n.target.flat().join(' ') : String(n.target);
      col.issue({ ...base, check: 'accessibility-axe', severity: IMPACT[v.impact] ?? 'minor', selector, key: v.id,
        message: `${v.help} (${v.id}).`,
        evidence: { rule: v.id, impact: v.impact, helpUrl: v.helpUrl, wcag: v.tags.filter((t) => /^wcag\d/.test(t)), html: String(n.html ?? '').slice(0, 200), failureSummary: String(n.failureSummary ?? '').slice(0, 400), nodesInRule: v.nodes.length } });
    }
  }
  col.run('accessibility-axe', { ...base, status: count ? 'failed' : 'passed', details: { engine: `axe-core ${results.testEngine?.version ?? ''}`.trim(), tags: AXE_TAGS, violations: results.violations.length } });
}
