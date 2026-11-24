// @ts-check
/** experience.md — headline, gates, dimension table, recommendations; measured evidence and agent judgement kept apart. */
import { DIMENSIONS } from './catalog.mjs';

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
const code = (s) => '`' + String(s ?? '').replace(/`/g, "'") + '`';
const fmt = (v) => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000);
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v);
};
const STATUS = { pass: 'PASS', fail: '**FAIL**', 'not-evaluated': 'not evaluated', 'not-applicable': 'n/a' };

/** @param {any} x experience result */
export function renderExperienceMd(x) {
  const L = [];
  const o = x.overall;
  const cov = x.coverage;
  L.push(`# Maquettekit Experience Lab — ${x.profileTitle} profile`, '');
  if (x.target) L.push(`- Target: ${x.target.mode === 'serve' ? `static directory ${code(x.target.dir)} served on ${code(x.target.baseUrl)}` : code(x.target.url)}`);
  if (cov) {
    L.push(`- Routes: ${cov.routes.map(code).join(', ')} · Viewports: ${cov.viewports.map((v) => `${v.name} (${v.width}×${v.height}${v.hasTouch ? ', touch' : ''})`).join(', ')} · Motion modes: ${cov.motionModes.join(', ')}`);
    L.push(`- Primary (pointer/keyboard) viewport: ${cov.primaryViewport}; touch viewports: ${cov.touchViewports.length ? cov.touchViewports.join(', ') : 'none (touch signals not measured)'}`);
  }
  L.push(`- Generated: ${x.generatedAt ?? 'n/a'} · ${x.tool} ${x.version ?? ''} · inputs: signals ${x.inputs?.signals ? code(x.inputs.signals) : 'none'}, answers ${x.inputs?.answers ? code(x.inputs.answers) : 'none'}`.trim());
  L.push('', `> Heuristic interaction-quality assessment for the **${x.profileTitle}** profile (${x.profileSummary}) — a score without its profile is meaningless.`,
    '> Part A is **measured** in headless Chromium (software rendering, loopback, no CPU/network throttling): timings are lab measurements, not field data. Part B is **agent judgement** from the rubric.',
    '> The selected profile never overrides accessibility or user control: a failed gate caps the score whatever the profile.', '');

  // ---------------------------------------------------------------- headline
  L.push('## Headline', '');
  if (o.score == null) L.push('**Not scored** — no measured signals or agent answers were supplied.', '');
  else {
    L.push(`**${o.score} / 100 — grade ${o.grade}** · ${x.profileTitle} · confidence ${o.confidence} (${o.confidenceLabel})`, '');
    if (o.capApplied) L.push(`Uncapped score ${o.rawScore} (grade ${o.uncappedGrade}) is **capped at ${o.cap}** because ${o.cappedBy.length} gate(s) failed: ${o.cappedBy.map(code).join(', ')}.`, '');
    else if (o.cappedBy.length) L.push(`${o.cappedBy.length} gate(s) failed (${o.cappedBy.map(code).join(', ')}); the cap (${o.cap}) is above the raw score, so the grade stands — but the failures must still be fixed.`, '');
  }
  L.push(`Gates: ${o.gates.passed} passed, ${o.gates.failed} failed, ${o.gates.notEvaluated.length} not evaluated${o.gates.notEvaluated.length ? ` (${o.gates.notEvaluated.map(code).join(', ')})` : ''}. Dimensions scored: ${o.dimensionsScored} of ${DIMENSIONS.length}${o.dimensionsNotScored.length ? ` — not scored: ${o.dimensionsNotScored.map((d) => `${d.id} (${d.status})`).join(', ')}` : ''}.`, '');
  if (x.agent.unanswered.length) L.push(`Agent questions answered: ${x.agent.answered} of ${x.agent.questions} (${x.agent.notApplicable} n/a). Unanswered questions lower confidence and are never assumed — see Part B.`, '');

  // ---------------------------------------------------------------- gates
  L.push('## Gates — accessibility and user control (no profile overrides these)', '');
  L.push('| Gate | Scope | Status | Standard | Evidence |', '|---|---|---|---|---|');
  for (const g of x.gates) L.push(`| ${esc(g.title)} (${code(g.id)}) | ${g.scope === 'profile' ? `${g.profile} requirement` : 'all profiles'} | ${STATUS[g.status] ?? g.status} | ${esc(g.standard)} | ${esc([g.message, ...(g.status === 'fail' ? g.evidence.slice(1, 4) : [])].filter(Boolean).join(' · '))} |`);
  L.push('');

  // ---------------------------------------------------------------- dimensions
  L.push('## Dimension scores', '');
  L.push('| Dimension | Weight | Score | Confidence | Evidence weight (measured / agent / missing) | Status |', '|---|---|---|---|---|---|');
  for (const d of Object.values(x.dimensions)) {
    const mix = d.status === 'not-applicable' ? '—' : `${fmt(d.evidenceMix.measuredWeight)} / ${fmt(d.evidenceMix.agentWeight)} / ${fmt(d.evidenceMix.missingWeight)}`;
    L.push(`| ${d.title} | ${d.weight}${d.status === 'scored' ? ` (${Math.round(d.normalisedWeight * 1000) / 10}%)` : ''} | ${d.score == null ? 'n/a' : `**${d.score}**`} | ${d.confidence == null ? '—' : d.confidence} | ${mix} | ${d.status}${d.reason && d.status !== 'scored' ? ` — ${esc(d.reason)}` : ''} |`);
  }
  L.push('', '_Weight = profile weight of the dimension (share of the overall after renormalisation in brackets). Confidence = share of the dimension\'s signal weight backed by evidence._', '');

  // ---------------------------------------------------------------- recommendations
  L.push('## Top recommendations', '');
  if (!x.recommendations.length) L.push('No recommendations: every signal with evidence scored ≥ 0.9.', '');
  for (const r of x.recommendations.slice(0, 10)) {
    const dim = x.dimensions[r.dimension]?.title ?? r.dimension ?? 'gate';
    L.push(`${r.rank}. **[${r.priority}] ${esc(r.what)}** — ${dim}${r.source === 'agent' ? ' (agent judgement)' : r.source === 'gate' ? ' (gate)' : ''}`);
    L.push(`   - Why: ${esc(r.why)}`);
    if (r.how) L.push(`   - How: ${esc(r.how)}`);
    if (r.evidence.length) L.push(`   - Evidence${r.source === 'agent' ? '' : ' (measured)'}: ${esc(r.evidence.slice(0, 6).join(' · '))}`);
    L.push(`   - Expected effect: ${esc(r.expectedEffect.note)}`);
  }
  if (x.recommendations.length > 10) L.push('', `_${x.recommendations.length - 10} more recommendation(s) in experience.json._`);
  L.push('');

  // ---------------------------------------------------------------- Part A
  L.push('# Part A — Measured evidence (headless Chromium, lab)', '');
  L.push('Raw values come from browser probes (`measured`) or from comparisons the tool computes across probes (`derived`). Nothing in Part A is a judgement.', '');
  for (const d of Object.values(x.dimensions)) {
    const list = x.signals.filter((s) => s.dimension === d.id && s.source !== 'agent');
    if (!list.length) continue;
    L.push(`## ${d.title}${d.score == null ? ' — not scored' : ` — ${d.score}`}`, '');
    if (d.status === 'not-applicable') { L.push(`Not applicable: ${esc(d.reason)}.`, ''); continue; }
    L.push('| Signal | Source | Raw | n | Weight | Normalisation | Result |', '|---|---|---|---|---|---|---|');
    for (const s of list) {
      const result = s.summary ?? (s.reason ? `${s.status}: ${s.reason}` : s.status);
      L.push(`| ${esc(s.title)} ${code(s.id)}${s.gate ? ` · gate ${code(s.gate)}` : ''} | ${s.source} | ${s.status === 'measured' || s.status === 'derived' ? esc(fmt(s.raw)) : s.status} | ${fmt(s.normalised)} | ${s.weight}${s.excluded ? ' (excluded)' : ''} | ${esc(s.normalisation.text)} | ${esc(result)} |`);
    }
    const ex = list.flatMap((s) => (s.normalised != null && s.normalised < 0.9 ? (s.evidence?.examples ?? []).slice(0, 4).map((e) => `${s.id}: ${e}`) : []));
    if (ex.length) L.push('', '<details><summary>Examples</summary>', '', ...ex.map((e) => `- ${esc(e)}`), '', '</details>');
    L.push('');
  }

  // ---------------------------------------------------------------- Part B
  L.push('# Part B — Agent judgement (rubric — not measured)', '');
  L.push('Answers come from the agent after inspecting screenshots and code (`maquettekit experience rubric`). They are judgement calls and are weighted separately from measured evidence.', '');
  const agent = x.signals.filter((s) => s.source === 'agent');
  L.push('| Question | Dimension | Answer | n | Weight | Note / evidence |', '|---|---|---|---|---|---|');
  for (const s of agent) {
    const ans = s.status === 'answered' ? fmt(s.raw) : s.status;
    L.push(`| ${esc(s.title)} ${code(s.id)}${s.gate ? ` · gate ${code(s.gate)}` : ''} | ${x.dimensions[s.dimension].title} | ${ans} | ${fmt(s.normalised)} | ${s.weight}${s.excluded ? ' (excluded)' : ''} | ${esc([s.note, ...(s.evidence?.files ?? [])].filter(Boolean).join(' · ') || (s.status === 'answered' ? '' : s.reason ?? ''))} |`);
  }
  L.push('');
  if (x.agent.unanswered.length) {
    L.push(`**${x.agent.unanswered.length} unanswered** (highest impact on confidence first): ${x.agent.unanswered.slice(0, 12).map((u) => code(u.id)).join(', ')}${x.agent.unanswered.length > 12 ? ', …' : ''}.`, '');
    L.push(`To answer: \`maquettekit experience rubric --profile ${x.profile} --json\` → fill \`answers.json\` from the screenshots${cov ? ' in `screenshots/`' : ''} and the code → \`maquettekit experience score --signals signals.json --answers answers.json --profile ${x.profile} --out <dir>\`.`, '');
  }

  // ---------------------------------------------------------------- motion summary (measured)
  if (x.coverage?.motion) {
    const m = x.coverage.motion;
    L.push('## Motion observed (measured)', '');
    L.push(`- Normal motion: ${m.animationsNormal} animation(s) seen, ${m.infinite} infinite, longest finite ${m.longestMs} ms, up to ${m.maxConcurrent} at once; layout properties animated: ${m.layoutProperties.length ? m.layoutProperties.join(', ') : 'none'}.`);
    L.push(`- Reduced motion: ${m.violations} violation(s)${m.violationExamples.length ? ` — ${esc(m.violationExamples.slice(0, 4).join('; '))}` : ''}.`);
    L.push(`- Auto-playing motion: ${m.autoMotion.length ? esc(m.autoMotion.slice(0, 4).join('; ')) : 'none observed'}; motion controls found: ${m.controls}.`, '');
  }

  // ---------------------------------------------------------------- scoring model
  const sm = x.scoring;
  L.push('## Scoring model', '');
  for (const [k, v] of Object.entries(sm.formula)) L.push(`- **${k}**: ${esc(v)}`);
  L.push('', `Profile weights (${sm.profile.title}): ${Object.entries(sm.profile.dimensionWeights).map(([k, v]) => `${k} ${v}`).join(', ')}.`, '');
  L.push(`Profile bands: ${Object.entries(sm.profile.bands).map(([k, b]) => `${k} ${b.bad} → 0 / ${b.good} → 1`).join('; ')}.${sm.profile.requirements.length ? ` Extra ${sm.profile.title} gates: ${sm.profile.requirements.map(code).join(', ')}.` : ''}`, '');
  for (const n of sm.profile.notes) L.push(`- ${n}`);
  L.push('');

  // ---------------------------------------------------------------- limitations
  L.push('## Limitations', '');
  for (const l of x.limitations) L.push(`- ${esc(l)}`);
  if (x.warnings?.length) { L.push('', '**Warnings**', ''); for (const w of x.warnings) L.push(`- ${esc(w)}`); }
  L.push('');
  return L.join('\n');
}

/** Short terminal summary for `score` without --json. @param {any} x */
export function renderSummaryText(x) {
  const L = [`Experience Lab — ${x.profileTitle}: ${x.overall.headline}`, ''];
  for (const g of x.gates) L.push(`  gate ${g.id.padEnd(15)} ${g.status.padEnd(14)} ${g.status === 'fail' ? g.message.slice(0, 140) : ''}`);
  L.push('');
  for (const d of Object.values(x.dimensions)) L.push(`  ${d.title.padEnd(28)} ${d.score == null ? 'n/a'.padStart(5) : String(d.score).padStart(5)}  conf ${d.confidence == null ? ' —  ' : d.confidence.toFixed(2)}  ${d.status === 'scored' ? '' : d.status}`);
  L.push('');
  for (const r of x.recommendations.slice(0, 5)) L.push(`  ${r.rank}. [${r.priority}] ${r.what} (${r.dimension ?? 'gate'})`);
  return L.join('\n');
}
