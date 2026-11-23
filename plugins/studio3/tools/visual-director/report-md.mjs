// @ts-check
/** Human QA report (report.md). Measured results and subjective assessment are kept strictly apart. */
import { fmtBytes, routeSlug, SEVERITIES } from './util.mjs';

const ICON = { passed: 'passed', failed: 'FAILED', skipped: 'skipped', 'not-applicable': 'n/a', limited: 'limited', unavailable: 'unavailable' };
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const code = (s) => '`' + String(s ?? '').replace(/`/g, "'") + '`';

/** @param {any} v */
function evidenceLine(v) {
  const flat = {};
  for (const [k, val] of Object.entries(v ?? {})) {
    if (val == null) continue;
    if (typeof val === 'object') { const s = JSON.stringify(val); flat[k] = s.length > 160 ? s.slice(0, 157) + '…' : s; }
    else { const t = String(val).replace(/\s+/g, ' '); flat[k] = t.length > 160 ? t.slice(0, 157) + '…' : t; }
  }
  return Object.entries(flat).slice(0, 8).map(([k, val]) => `${k}=${val}`).join('; ');
}

/** @param {any} report */
export function renderReportMd(report) {
  const L = [];
  const s = report.summary;
  const cov = report.coverage;
  L.push(`# Studio³ Visual Director — QA report (pass ${report.pass})`, '');
  L.push(`- Target: ${report.target.mode === 'serve' ? `static directory ${code(report.target.dir)}` : code(report.target.url)}`);
  if (report.label) L.push(`- Label: ${report.label}`);
  L.push(`- Generated: ${report.generatedAt} · tool ${report.tool} v${report.version}`);
  L.push(`- Routes: ${cov.routes.map(code).join(', ')} · Viewports: ${cov.viewports.map((v) => `${v.name} (${v.width}×${v.height})`).join(', ')} · Motion modes: ${cov.motionModes.join(', ')}`);
  L.push('', '> Everything in **Part A** is measured by the tool in a real (headless) browser. **Part B** is a template for the agent\'s subjective visual assessment and contains no measurements.', '');

  // ---------------------------------------------------------------- Part A
  L.push('# Part A — Measured results', '');
  L.push('## Summary', '');
  L.push('| Severity | Count |', '|---|---|', ...SEVERITIES.map((k) => `| ${k} | ${s[k]} |`), '');
  L.push(s.critical ? `**Verdict: ${s.critical} critical issue(s) — not ready.**` : s.major ? `**Verdict: no critical issues; ${s.major} major issue(s) remain.**` : '**Verdict: no critical or major issues were measured.** (This says nothing about subjective design quality.)', '');
  L.push('| Check | Kind | Status | Issues | Note |', '|---|---|---|---|---|');
  for (const c of report.checks) L.push(`| ${esc(c.title)} | ${c.kind} | ${ICON[c.status] ?? c.status}${c.ran ? '' : ' (did not run)'} | ${c.issues} | ${esc(c.reason ?? '')} |`);
  L.push('', '_Status "passed" is only reported for checks that actually executed. "limited" = ran, but with reduced coverage or non-representative conditions._', '');

  L.push('## Viewport coverage', '');
  L.push(`| Route | ${cov.viewports.map((v) => v.name).join(' | ')} |`, `|---|${cov.viewports.map(() => '---').join('|')}|`);
  for (const r of cov.routes) {
    const cells = cov.viewports.map((v) => {
      const m = cov.matrix.find((x) => x.route === r && x.viewport === v.name);
      const ran = m ? m.checks.filter((c) => !['skipped', 'not-applicable'].includes(c.status)).length : 0;
      const failed = m ? m.checks.filter((c) => c.status === 'failed').length : 0;
      const issues = report.issues.filter((i) => i.route === r && i.viewport === v.name && i.severity !== 'info').length;
      return `${ran} checks, ${failed} failed, ${issues} issues · [normal](screenshots/${routeSlug(r)}/${v.name}-normal-full.png) / [reduced](screenshots/${routeSlug(r)}/${v.name}-reduced-full.png)`;
    });
    L.push(`| ${code(r)} | ${cells.join(' | ')} |`);
  }
  L.push('');
  const captured = cov.states.filter((x) => x.status === 'captured');
  L.push(`Screenshots: ${cov.screenshots.length} · interactive states captured: ${captured.length} of ${cov.states.length} attempted · animation frames: ${cov.frames.reduce((n, f) => n + f.frames.length, 0)} (offsets ${cov.frameOffsetsMs.join('/')} ms) · video: ${cov.video ? cov.video.status + (cov.video.reason ? ` — ${cov.video.reason}` : '') : 'not requested'}`, '');
  if (cov.states.length) {
    L.push('<details><summary>Interactive states</summary>', '', '| Route | Viewport | State | Kind | Result | File |', '|---|---|---|---|---|---|');
    for (const st of cov.states) L.push(`| ${code(st.route)} | ${st.viewport} | ${esc(st.name)} | ${esc(st.popupKind ?? st.kind)} | ${st.status}${st.note ? ` (${esc(st.note)})` : ''}${st.error ? ` (${esc(st.error)})` : ''} | ${st.file ? `[png](${st.file})` : ''} |`);
    L.push('', '</details>', '');
  }

  L.push('## Issues', '');
  if (!report.issues.length) L.push('No issues were measured.', '');
  for (const sev of SEVERITIES) {
    const list = report.issues.filter((i) => i.severity === sev);
    if (!list.length) continue;
    L.push(`### ${sev[0].toUpperCase()}${sev.slice(1)} (${list.length})`, '');
    // group identical findings across viewports
    const groups = new Map();
    for (const i of list) { const k = [i.check, i.route, i.selector ?? '', i.key ?? '', i.message].join('|'); if (!groups.has(k)) groups.set(k, { ...i, viewports: [] }); groups.get(k).viewports.push(i.viewport); }
    for (const g of groups.values()) {
      L.push(`- **[${g.check}]** ${g.message}`);
      L.push(`  - Where: route ${code(g.route)}, viewport(s) ${g.viewports.filter(Boolean).join(', ') || 'n/a'}${g.selector ? `, element ${code(g.selector)}` : ''} · id ${code(g.id)}`);
      const ev = evidenceLine(g.evidence);
      if (ev) L.push(`  - Evidence (measured): ${ev}`);
    }
    L.push('');
  }

  // motion
  const m = report.motion;
  L.push('## Motion behaviour', '');
  if (!m.perRoute.length) L.push('No motion data was collected.', '');
  else {
    const t = m.totals;
    L.push(`- Animations observed (normal motion): ${t.cssAnimations} CSS animation(s), ${t.cssTransitions} running CSS transition(s), ${t.waapi} Web Animations API animation(s); ${t.infinite} infinite; longest duration ${Math.round(t.longestDurationMs)} ms.`);
    L.push(`- Elements declaring a CSS transition: up to ${t.declaredTransitionElements} per page.`);
    L.push(`- Animated properties: ${t.properties.length ? t.properties.join(', ') : 'none observed'}.`);
    L.push(`- Layout-triggering properties animated/transitioned (performance hint): ${t.layoutTriggeringProperties.length ? t.layoutTriggeringProperties.join(', ') : 'none'}.`);
    L.push(`- Animations still running under prefers-reduced-motion: reduce (max per page): ${t.stillRunningUnderReducedMotion}.`);
    for (const r of m.rafCadence) L.push(`- requestAnimationFrame cadence on ${code(r.route)} @ ${r.viewport}: median ${r.medianMs} ms, p95 ${r.p95Ms} ms, max ${r.maxMs} ms over ${r.frames} frames — ${r.note}.`);
    L.push('', '| Route | Viewport | Running (normal) | Running (reduced) | Pixel change / 500ms (normal) | Pixel change / 500ms (reduced) |', '|---|---|---|---|---|---|');
    const pct = (x) => (x == null ? 'n/a' : `${Math.round(x * 10000) / 100}%`);
    for (const e of m.perRoute) L.push(`| ${code(e.route)} | ${e.viewport} | ${e.normal.runningCount} | ${e.reduced.runningCount} | ${pct(e.normal.pixelChangeRatio)} | ${pct(e.reduced.pixelChangeRatio)} |`);
    L.push('', '_Pixel change compares two above-the-fold screenshots taken 500 ms apart; canvas and video content may legitimately change even under reduced motion._', '');
  }

  // 3D
  L.push('## 3D diagnostics', '');
  const c3 = report.checks.filter((c) => c.category === '3d');
  if (!report.threeD) {
    const why = c3[0]?.reason ?? 'no 3D content detected';
    L.push(`Not reported: ${c3.every((c) => c.status === 'skipped') ? 'skipped' : 'not applicable'} — ${why}.`, '');
  } else {
    L.push(`Budgets (${report.threeD.budgetsSource}; project settings, not universal thresholds): draw calls/frame ≤ ${report.threeD.budgets.drawCallsPerFrame}, triangles/frame ≤ ${report.threeD.budgets.trianglesPerFrame}, textures ≤ ${fmtBytes(report.threeD.budgets.textureBytes)}, geometry ≤ ${fmtBytes(report.threeD.budgets.geometryBytes)}.`, '');
    for (const r of report.threeD.routes) {
      L.push(`### ${code(r.route)} @ ${r.viewport}`, '');
      L.push(`- Contexts: ${r.contexts.requested} requested, ${r.contexts.obtained} obtained (${r.contexts.types.join(', ') || 'none'})${r.contexts.failed ? `, ${r.contexts.failed} failed (${r.contexts.failedTypes.join(', ')})` : ''}.`);
      if (r.webgpu) L.push(`- WebGPU: ${r.webgpu.adapter ? 'adapter available' : `unavailable — ${r.webgpu.reason}`}${r.webgpu.requestedByPage ? ' (requested by the page)' : ''}.`);
      if (r.draw) {
        L.push(`- Draw calls per frame: median ${r.draw.drawCalls.median ?? 'n/a'}, max ${r.draw.drawCalls.max} (${r.draw.framesWithDraws} of ${r.draw.framesObserved} observed frames drew; ${r.draw.totalDrawCalls} calls total).`);
        L.push(`- Triangles per frame (estimate from draw-call arguments): median ${r.draw.triangles.median ?? 'n/a'}, max ${r.draw.triangles.max}.`);
        L.push(`- Textures: ${r.textures.count} live, ~${fmtBytes(r.textures.bytesEstimate)} (**estimate**). Geometry buffers: ${r.geometry.buffers} live, ${fmtBytes(r.geometry.bytes)}. Programs: ${r.programs}.`);
      }
      if (r.frameTime?.medianMs != null) L.push(`- Frame intervals: median ${r.frameTime.medianMs} ms, p95 ${r.frameTime.p95Ms} ms, max ${r.frameTime.maxMs} ms, ${r.frameTime.over50ms} over 50 ms — ${r.frameTime.note}.`);
      if (r.renderLoop) L.push(`- Render loop when idle: ${r.renderLoop.continuous ? 'continuous' : 'on demand / settled'} (${Math.round(r.renderLoop.idleDrawRatio * 100)}% of frames drew in the last second of a 2 s idle window)${r.renderLoop.declaredFrameloop ? `; page declares frameloop="${r.renderLoop.declaredFrameloop}"` : ''}. Hidden-tab behaviour: ${r.renderLoop.hiddenTabBehaviour}.`);
      if (r.resize) L.push(`- Resize ${r.resize.viewportBefore.width}×${r.resize.viewportBefore.height} → ${r.resize.viewportAfter.width}×${r.resize.viewportAfter.height}: CSS ${r.resize.before.css.join('×')} → ${r.resize.after.css.join('×')}, drawing buffer ${r.resize.before.buffer.join('×')} → ${r.resize.after.buffer.join('×')}, ${r.resize.drawCallsAfterResize} draw call(s) after resize.`);
      for (const [vp, i] of Object.entries(r.interaction ?? {})) L.push(`- Interaction @ ${vp} (${/** @type {any} */ (i).gestures.join(', ')}): ${/** @type {any} */ (i).newErrors.length} new error(s).`);
      if (r.contextEvents) L.push(`- Context events: ${r.contextEvents.lost} lost, ${r.contextEvents.restored} restored.`);
      if (r.cleanup) L.push(`- Cleanup (navigate away and back): re-initialised ${r.cleanup.reinitialisedAfterReturn ? 'yes' : 'NO'}; __STUDIO3_3D__.disposed at pagehide: ${r.cleanup.disposedAtPagehide ?? 'not exposed'}; GPU context release: ${r.cleanup.contextRelease}.`);
      if (r.assets) L.push(`- Assets: ${r.assets.failedModels.length} model(s) failed${r.assets.failedModels.length ? ` (${r.assets.failedModels.join(', ')})` : ''}, ${r.assets.failedTextures.length} texture(s) failed, ${r.assets.loaderErrors.length} loader error(s).`);
      if (r.fallback) L.push(`- No-WebGL fallback: ${r.fallback.fallback.found ? `found (${r.fallback.fallback.matchedBy}${r.fallback.fallback.heuristic ? ', heuristic' : ''})` : 'NOT found'}; uncaught errors: ${r.fallback.uncaughtErrors.length} · [screenshot](${r.fallback.screenshot}).`);
      if (r.hook) L.push(`- Cooperative hook ${code('window.__STUDIO3_3D__')}: ${JSON.stringify(r.hook)}.`);
      L.push('');
    }
    L.push('| 3D check | Status | Note |', '|---|---|---|');
    for (const c of c3) L.push(`| ${esc(c.title)} | ${ICON[c.status] ?? c.status} | ${esc(c.reason ?? '')} |`);
    L.push('');
  }

  L.push('## Limitations and unavailable tests', '');
  const notRun = report.checks.filter((c) => !c.ran || ['limited', 'unavailable'].includes(c.status));
  if (notRun.length) {
    L.push('| Check | Status | Reason |', '|---|---|---|');
    for (const c of notRun) L.push(`| ${esc(c.title)} | ${c.status} | ${esc(c.reason ?? '')} |`);
    L.push('');
  }
  for (const l of report.limitations) L.push(`- ${l}`);
  L.push('');

  // ---------------------------------------------------------------- Part B
  L.push('# Part B — Agent-led visual assessment (subjective — not measured)', '');
  L.push('> Fill this in after looking at the screenshots. Nothing below is produced by measurement; scores are judgement calls and must cite the screenshot they are based on.', '');
  L.push('| Criterion | Observations | Score (1–5) | Evidence screenshot |', '|---|---|---|---|');
  const first = cov.routes[0] ? `screenshots/${routeSlug(cov.routes[0])}/${cov.viewports[0]?.name ?? 'desktop'}-normal-fold.png` : '_path_';
  for (const [name, hint] of [
    ['Composition', 'balance, focal point, use of the grid, above-the-fold framing'],
    ['Typography', 'type scale, pairing, line length, rhythm, legibility'],
    ['Hierarchy', 'is the primary action obvious; reading order; emphasis'],
    ['Spacing', 'consistency of the spacing scale, density, alignment'],
    ['Originality', 'distinctive vs. template-like; fit with the brand intent'],
    ['Motion purpose', 'does each animation explain, guide or give feedback (see frames/)'],
  ]) L.push(`| ${name} | _TODO: ${hint}_ | _TODO_ | _TODO (e.g. ${first})_ |`);
  L.push('', '- Overall subjective impression: _TODO_', '- Top three subjective improvements (not covered by measured issues): _TODO_', '');
  return L.join('\n');
}
