// @ts-check
/** `review loop-status` and `review summary` — drive and document the Improve → Retest loop. */
import fs from 'node:fs';
import path from 'node:path';
import { UserError } from '../lib/log.mjs';
import { guidanceFor } from './guidance.mjs';
import { diffIssues } from './compare.mjs';
import { TOOL, toolVersion, listPasses, readJson, summarize, routeSlug } from './util.mjs';

/** @param {string} outRoot */
export function loadPasses(outRoot) {
  return listPasses(outRoot).map((n) => ({ pass: n, dir: path.join(outRoot, `pass-${n}`), report: readJson(path.join(outRoot, `pass-${n}`, 'report.json')) })).filter((p) => p.report);
}

/**
 * Prioritised fix list: critical first, then major; identical findings across viewports are merged.
 * @param {any[]} issues
 */
export function buildFixList(issues) {
  const groups = new Map();
  for (const i of issues) {
    if (i.severity !== 'critical' && i.severity !== 'major') continue;
    const k = [i.check, i.route, i.selector ?? '', i.key ?? ''].join('|');
    if (!groups.has(k)) groups.set(k, { severity: i.severity, check: i.check, route: i.route, selector: i.selector ?? null, message: i.message, viewports: [], issueIds: [], guidance: guidanceFor(i.check), evidence: i.evidence });
    const g = groups.get(k);
    if (i.severity === 'critical') g.severity = 'critical';
    if (i.viewport && !g.viewports.includes(i.viewport)) g.viewports.push(i.viewport);
    g.issueIds.push(i.id);
  }
  const rank = { critical: 0, major: 1 };
  return [...groups.values()].sort((a, b) => rank[a.severity] - rank[b.severity] || a.check.localeCompare(b.check)).map((g, n) => ({ priority: n + 1, ...g }));
}

/**
 * Pure iteration-state computation (exported for tests).
 * @param {{pass:number, report:any}[]} passes @param {number} maxPasses
 */
export function computeLoopStatus(passes, maxPasses) {
  const history = passes.map((p) => ({ pass: p.pass, label: p.report.label ?? null, generatedAt: p.report.generatedAt, summary: p.report.summary ?? summarize(p.report.issues ?? []) }));
  const latest = passes.at(-1);
  if (!latest) {
    return { tool: TOOL, passesDone: 0, maxPasses, latestPass: null, criticalRemaining: null, majorRemaining: null, stop: false, stopReason: null, criticalResolved: false, budgetExhausted: false,
      nextAction: 'No passes yet — run "studio3 review run" to create pass-1.', history, delta: null, fixList: [] };
  }
  const s = latest.report.summary ?? summarize(latest.report.issues ?? []);
  const criticalResolved = s.critical === 0;
  const budgetExhausted = passes.length >= maxPasses;
  const stop = criticalResolved || budgetExhausted;
  const prev = passes.at(-2);
  const d = prev ? diffIssues(prev.report, latest.report) : null;
  const fixList = buildFixList(latest.report.issues ?? []);
  let nextAction;
  if (criticalResolved) nextAction = s.major ? `Critical issues are resolved after ${passes.length} pass(es). ${s.major} major issue(s) remain — fix them if the pass budget allows (${Math.max(0, maxPasses - passes.length)} pass(es) left), then run "review summary".` : `No critical or major issues remain after ${passes.length} pass(es). Run "review summary".`;
  else if (budgetExhausted) nextAction = `Pass budget exhausted (${passes.length}/${maxPasses}) with ${s.critical} critical issue(s) remaining. Stop iterating, run "review summary" and report the remaining issues honestly.`;
  else nextAction = `Fix the items in fixList (critical first), record each change in changes.json, then run "review run --pass ${latest.pass + 1}".`;
  return {
    tool: TOOL, passesDone: passes.length, maxPasses, latestPass: latest.pass,
    criticalRemaining: s.critical, majorRemaining: s.major,
    stop, stopReason: criticalResolved ? 'criticalResolved' : budgetExhausted ? 'budgetExhausted' : null, criticalResolved, budgetExhausted,
    nextPass: stop ? null : latest.pass + 1, nextAction, history,
    delta: d ? { fromPass: prev?.pass, toPass: latest.pass, resolved: d.resolved.length, introduced: d.introduced.length, remaining: d.remaining.length } : null,
    fixList,
  };
}

/** @param {{ out: string, maxPasses?: number }} opts */
export function loopStatus(opts) {
  const outRoot = path.resolve(opts.out);
  const max = opts.maxPasses ?? 3;
  if (!Number.isInteger(max) || max < 1) throw new UserError('--max-passes must be a positive integer');
  return { ...computeLoopStatus(loadPasses(outRoot), max), out: outRoot };
}

/** @param {{ out: string }} opts */
export function writeSummary(opts) {
  const outRoot = path.resolve(opts.out);
  const passes = loadPasses(outRoot);
  if (!passes.length) throw new UserError(`summary: no pass-N/report.json found in ${outRoot}`);
  const first = passes[0]; const last = /** @type {any} */ (passes.at(-1));
  const changesFile = path.join(outRoot, 'changes.json');
  const changesRaw = readJson(changesFile);
  const changes = Array.isArray(changesRaw) ? changesRaw : null;
  const d = passes.length > 1 ? diffIssues(first.report, last.report) : null;
  const L = ['# Studio³ Visual Director — review summary', ''];
  const t = last.report.target;
  L.push(`- Target: ${t.mode === 'serve' ? `static directory \`${t.dir}\`` : `\`${t.url}\``}`, `- Passes: ${passes.length} (pass ${first.pass} → pass ${last.pass})`, `- Generated: ${new Date().toISOString()} · ${TOOL} v${toolVersion()}`, '');
  const s = last.report.summary;
  L.push(s.critical ? `**Result: ${s.critical} critical issue(s) remain after ${passes.length} pass(es).**` : s.major ? `**Result: critical issues resolved; ${s.major} major issue(s) remain.**` : '**Result: no critical or major measured issues remain.**', '');
  L.push('## Measured issues per pass', '', '| Pass | Label | Critical | Major | Minor | Info |', '|---|---|---|---|---|---|');
  for (const p of passes) { const x = p.report.summary; L.push(`| ${p.pass} | ${p.report.label ?? ''} | ${x.critical} | ${x.major} | ${x.minor} | ${x.info} |`); }
  L.push('');
  if (d) L.push(`Between pass ${first.pass} and pass ${last.pass}: **${d.resolved.length} resolved**, **${d.introduced.length} introduced**, **${d.remaining.length} remaining** (matched by check + route + viewport + selector).`, '');

  L.push('## Before / after screenshots', '');
  if (passes.length < 2) L.push('Only one pass exists — nothing to compare yet.', '');
  else {
    L.push(`| Route | Viewport | Before (pass ${first.pass}) | After (pass ${last.pass}) |`, '|---|---|---|---|');
    for (const r of last.report.coverage.routes) for (const v of last.report.coverage.viewports) {
      const rel = `screenshots/${routeSlug(r)}/${v.name}-normal-fold.png`;
      const b = fs.existsSync(path.join(first.dir, rel)) ? `![before](pass-${first.pass}/${rel})` : '_not captured_';
      const a = fs.existsSync(path.join(last.dir, rel)) ? `![after](pass-${last.pass}/${rel})` : '_not captured_';
      L.push(`| \`${r}\` | ${v.name} | ${b} | ${a} |`);
    }
    L.push('');
  }

  L.push('## Changes applied', '');
  if (!changes) L.push(`_No changes log found (${fs.existsSync(changesFile) ? 'changes.json is not a JSON array' : 'optional file `changes.json` is absent'}). The agent should maintain it as \`[{ "pass": 1, "file": "…", "change": "…", "issueIds": ["vd-…"] }]\`._`, '');
  else if (!changes.length) L.push('_changes.json is empty._', '');
  else {
    L.push('| After pass | File | Change | Issues addressed |', '|---|---|---|---|');
    for (const c of changes) L.push(`| ${c.pass ?? ''} | \`${c.file ?? ''}\` | ${String(c.change ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')} | ${(c.issueIds ?? []).map((i) => `\`${i}\``).join(', ')} |`);
    L.push('', '_Changes are self-reported by the agent; resolution is verified only by the measured issue delta above._', '');
  }

  if (d && d.resolved.length) {
    L.push('## Resolved issues', '');
    for (const i of d.resolved.slice(0, 80)) L.push(`- [${i.severity}] **${i.check}** \`${i.route}\` @ ${i.viewport ?? 'n/a'}${i.selector ? ` \`${i.selector}\`` : ''} — ${i.message}`);
    L.push('');
  }
  L.push('## Remaining issues (latest pass)', '');
  const remaining = (last.report.issues ?? []).filter((i) => i.severity !== 'info');
  if (!remaining.length) L.push('None measured.', '');
  else { for (const i of remaining.slice(0, 120)) L.push(`- [${i.severity}] **${i.check}** \`${i.route}\` @ ${i.viewport ?? 'n/a'}${i.selector ? ` \`${i.selector}\`` : ''} — ${i.message}`); L.push(''); }

  L.push('## Checks not run / limited (latest pass)', '');
  const nr = last.report.checks.filter((c) => !c.ran || ['limited', 'unavailable'].includes(c.status));
  if (nr.length) { L.push('| Check | Status | Reason |', '|---|---|---|'); for (const c of nr) L.push(`| ${c.title} | ${c.status} | ${String(c.reason ?? '').replace(/\|/g, '\\|')} |`); L.push(''); }
  L.push('## Limitations', '');
  for (const l of new Set(passes.flatMap((p) => p.report.limitations ?? []))) L.push(`- ${l}`);
  L.push('', '_All figures above are measured by the tool. Subjective design quality is assessed separately in each pass\'s report.md (Part B)._', '');
  const file = path.join(outRoot, 'SUMMARY.md');
  fs.writeFileSync(file, L.join('\n'));
  return { file, passes: passes.map((p) => p.pass), summary: s, delta: d ? { resolved: d.resolved.length, introduced: d.introduced.length, remaining: d.remaining.length } : null, changes: changes?.length ?? null };
}
