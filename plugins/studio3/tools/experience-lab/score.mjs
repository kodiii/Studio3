// @ts-check
/**
 * Pure scoring: signals (+ agent answers) + profile → experience result.
 * No browser, no I/O, no clock unless `now` is passed — the same inputs give the same output.
 *
 *   signal n_s        = normalise(raw)                                   (0–1, see catalog.mjs)
 *   dimension S_d     = 100 × Σ w_s·n_s / Σ w_s        over signals with evidence
 *   confidence C_d    = Σ w_s(with evidence) / Σ w_s(applicable)        (unanswered/unmeasured lower it)
 *   overall raw       = Σ W_d·S_d / Σ W_d              over scored dimensions (weights renormalised)
 *   overall score     = min(raw, cap)                  cap = 69 with one failed gate, 59 with two or more
 */
import {
  DIMENSIONS, SIGNALS, SIGNAL_BY_ID, PROFILES, PROFILE_IDS, GATES, GATE_CAPS, GRADES, CONFIDENCE_LABELS,
  resolveNormaliser, resolveWeight, normalise, describeNormaliser, gradeFor, confidenceLabel,
} from './catalog.mjs';
import { parseAnswers } from './rubric.mjs';
import { UserError } from '../lib/log.mjs';

export const TOOL = 'studio3-experience-lab';
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);
const EVIDENCE_STATUSES = new Set(['measured', 'derived']);

/**
 * Normalise a signals document (from `assess`, or hand-written) into a map keyed by signal id.
 * Accepts `{ signals: { id: {value, status, summary, evidence} | number | boolean | null } }` or a bare map.
 * @param {any} doc
 */
export function parseSignals(doc) {
  const warnings = [];
  /** @type {Record<string, any>} */ const out = {};
  const src = doc == null ? {} : (doc.signals && typeof doc.signals === 'object' ? doc.signals : doc);
  if (typeof src !== 'object' || Array.isArray(src)) throw new UserError('signals must be a JSON object: { "signals": { "<signal id>": { "value": … } } }');
  const META = new Set(['tool', 'kind', 'schemaVersion', 'version', 'generatedAt', 'target', 'coverage', 'context', 'limitations', '$schema']);
  for (const [id, raw] of Object.entries(src)) {
    if (doc?.signals === undefined && META.has(id)) continue;
    const def = SIGNAL_BY_ID[id];
    if (!def) { warnings.push(`signals: "${id}" is not a known signal (ignored)`); continue; }
    if (def.source === 'agent') { warnings.push(`signals: "${id}" is an agent question — put it in the answers file (ignored here)`); continue; }
    const rec = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : { value: raw };
    let status = rec.status ?? (rec.value === null || rec.value === undefined ? 'unavailable' : def.source);
    if (status === 'failed' || status === 'skipped') status = 'unavailable';
    if (!['measured', 'derived', 'not-applicable', 'unavailable'].includes(status)) { warnings.push(`signals: "${id}" has unknown status "${status}" (treated as unavailable)`); status = 'unavailable'; }
    if (EVIDENCE_STATUSES.has(status) && (rec.value === null || rec.value === undefined)) status = 'unavailable';
    out[id] = { ...rec, status };
  }
  return { signals: out, context: doc?.context ?? {}, warnings };
}

/**
 * @param {{ signals?: any, answers?: any, profile: string, now?: string, inputs?: any, meta?: any }} input
 */
export function scoreExperience(input) {
  const profile = String(input.profile ?? '').toLowerCase();
  if (!PROFILE_IDS.includes(profile)) throw new UserError(`--profile must be one of ${PROFILE_IDS.join(' | ')} (got "${input.profile}")`);
  const P = PROFILES[profile];
  const parsed = parseSignals(input.signals ?? null);
  const { answers, warnings: answerWarnings, meta: answerMeta } = parseAnswers(input.answers ?? null);
  const S = parsed.signals;
  const ctx = parsed.context ?? {};
  const warnings = [...parsed.warnings, ...answerWarnings];
  if (answerMeta?.profile && answerMeta.profile !== profile) warnings.push(`answers were written for the "${answerMeta.profile}" profile; scoring with "${profile}" (answers are profile-independent, weights differ)`);

  // --- spatial applicability -------------------------------------------------
  const spatialIds = SIGNALS.filter((s) => s.dimension === 'spatialInteractionClarity').map((s) => s.id);
  let spatialApplicable; let spatialReason;
  if (ctx.webgl === true) { spatialApplicable = true; spatialReason = `WebGL/WebGPU canvas detected on ${(ctx.routesWith3D ?? []).join(', ') || 'at least one route'}`; }
  else if (ctx.webgl === false) { spatialApplicable = false; spatialReason = 'no canvas requested a WebGL/WebGPU context on the assessed routes'; }
  else {
    spatialApplicable = spatialIds.some((id) => (EVIDENCE_STATUSES.has(S[id]?.status)) || answers[id]?.status === 'answered');
    spatialReason = spatialApplicable ? '3D evidence or answers supplied (no measured context)' : 'no 3D canvas evidence supplied';
  }
  if (!spatialApplicable) for (const id of spatialIds) if (answers[id]?.status === 'answered') warnings.push(`${id} was answered but no 3D canvas is present — ignored`);

  // --- signal rows -------------------------------------------------------------
  const rows = SIGNALS.map((def) => {
    const weight = resolveWeight(def, profile);
    const norm = resolveNormaliser(def, profile);
    /** @type {any} */ const row = {
      id: def.id, dimension: def.dimension, title: def.title, source: def.source, unit: def.unit ?? null,
      weight, normalisation: { ...norm, text: describeNormaliser(norm, def.unit) }, ...(def.gate ? { gate: def.gate } : {}),
    };
    if (def.dimension === 'spatialInteractionClarity' && !spatialApplicable) {
      Object.assign(row, { status: 'not-applicable', raw: null, normalised: null, reason: spatialReason });
    } else if (def.source === 'agent') {
      const a = answers[def.id];
      if (!a || a.status === 'unanswered') Object.assign(row, { status: 'unanswered', raw: null, normalised: null, reason: a?.note ?? 'not answered (run `studio3 experience rubric`)' });
      else if (a.status === 'not-applicable') Object.assign(row, { status: 'not-applicable', raw: null, normalised: null, reason: a.note ?? 'answered "na"' });
      else Object.assign(row, { status: 'answered', raw: a.value, normalised: normalise(norm, a.value), note: a.note, evidence: a.evidence?.length ? { files: a.evidence } : undefined });
    } else {
      const s = S[def.id];
      if (!s) Object.assign(row, { status: 'unavailable', raw: null, normalised: null, reason: 'not measured (absent from the signals file)' });
      else if (!EVIDENCE_STATUSES.has(s.status)) Object.assign(row, { status: s.status, raw: null, normalised: null, reason: s.reason ?? (s.status === 'not-applicable' ? 'nothing to measure' : 'not measured') });
      else {
        const n = normalise(norm, s.value);
        Object.assign(row, { status: n == null ? 'unavailable' : s.status, raw: s.value, normalised: n == null ? null : r3(n), summary: s.summary ?? null, evidence: s.evidence ?? undefined, ...(n == null ? { reason: `raw value ${JSON.stringify(s.value)} cannot be normalised` } : {}) });
      }
    }
    if (weight === 0 && row.status !== 'not-applicable') { row.reason = `weight 0 in the ${profile} profile`; row.excluded = true; }
    return row;
  });
  const hasEvidence = (r) => !r.excluded && r.normalised != null && ['measured', 'derived', 'answered'].includes(r.status);
  const counts = (r) => !r.excluded && r.status !== 'not-applicable';

  // --- dimensions ------------------------------------------------------------------
  /** @type {Record<string, any>} */ const dimensions = {};
  for (const d of DIMENSIONS) {
    const list = rows.filter((r) => r.dimension === d.id);
    const avail = list.filter(hasEvidence);
    const applicable = list.filter(counts);
    const wAvail = avail.reduce((s, r) => s + r.weight, 0);
    const wApplicable = applicable.reduce((s, r) => s + r.weight, 0);
    for (const r of list) r.contribution = hasEvidence(r) && wAvail > 0 ? r3((r.weight * r.normalised) / wAvail) : null;
    const W = P.dimensionWeights[d.id];
    let status; let score = null; let reason = null;
    if (d.id === 'spatialInteractionClarity' && !spatialApplicable) { status = 'not-applicable'; reason = spatialReason; }
    else if (!applicable.length) { status = 'not-applicable'; reason = 'no applicable signals on the assessed routes'; }
    else if (!avail.length) { status = 'not-assessed'; reason = `no evidence: ${applicable.map((r) => `${r.id} (${r.status})`).join(', ')}`; }
    else { status = 'scored'; score = r1((100 * avail.reduce((s, r) => s + r.weight * r.normalised, 0)) / wAvail); }
    const confidence = status === 'not-applicable' ? null : r3(wApplicable ? wAvail / wApplicable : 0);
    const measuredW = avail.filter((r) => r.source !== 'agent').reduce((s, r) => s + r.weight, 0);
    dimensions[d.id] = {
      id: d.id, title: d.title, question: d.question, weight: W, status, score, confidence, ...(reason ? { reason } : {}),
      evidenceMix: { measuredWeight: measuredW, agentWeight: wAvail - measuredW, missingWeight: wApplicable - wAvail },
      signals: list.map((r) => r.id),
      findings: buildFindings(list),
    };
  }

  // --- overall -----------------------------------------------------------------
  const scored = Object.values(dimensions).filter((d) => d.status === 'scored');
  const applicableDims = Object.values(dimensions).filter((d) => d.status !== 'not-applicable');
  const wScored = scored.reduce((s, d) => s + d.weight, 0);
  for (const d of Object.values(dimensions)) d.normalisedWeight = d.status === 'scored' && wScored ? r3(d.weight / wScored) : 0;
  const rawScore = scored.length ? r1(scored.reduce((s, d) => s + d.weight * d.score, 0) / wScored) : null;
  const wApp = applicableDims.reduce((s, d) => s + d.weight, 0);
  const confidence = wApp ? r3(applicableDims.reduce((s, d) => s + d.weight * (d.confidence ?? 0), 0) / wApp) : 0;

  // --- gates ---------------------------------------------------------------------
  const rowById = Object.fromEntries(rows.map((r) => [r.id, r]));
  const gates = GATES.filter((g) => g.scope === 'universal' || g.profile === profile).map((g) => evaluateGate(g, rowById, answers, spatialApplicable));
  const failed = gates.filter((g) => g.status === 'fail');
  const cap = failed.length === 0 ? null : failed.length === 1 ? GATE_CAPS.one : GATE_CAPS.twoOrMore;
  const score = rawScore == null ? null : cap != null ? Math.min(rawScore, cap) : rawScore;

  const overall = {
    score, rawScore, grade: score == null ? null : gradeFor(score), uncappedGrade: rawScore == null ? null : gradeFor(rawScore),
    cap, cappedBy: failed.map((g) => g.id), capApplied: cap != null && rawScore != null && rawScore > cap,
    confidence, confidenceLabel: confidenceLabel(confidence),
    dimensionsScored: scored.length,
    dimensionsNotScored: Object.values(dimensions).filter((d) => d.status !== 'scored').map((d) => ({ id: d.id, status: d.status, reason: d.reason })),
    gates: { passed: gates.filter((g) => g.status === 'pass').length, failed: failed.length, notEvaluated: gates.filter((g) => g.status === 'not-evaluated').map((g) => g.id) },
    headline: '',
  };
  overall.headline = headline(overall, profile);

  const recommendations = buildRecommendations(rows, dimensions, gates, wScored, cap, overall.capApplied);
  const agentRows = rows.filter((r) => r.source === 'agent');
  const unanswered = agentRows.filter((r) => r.status === 'unanswered').map((r) => ({ id: r.id, dimension: r.dimension, weight: r.weight, impact: r3(((dimensions[r.dimension]?.weight ?? 0) * r.weight) / 100) }))
    .sort((a, b) => b.impact - a.impact);

  return {
    tool: TOOL, kind: 'experience', version: input.meta?.version ?? null, ...(input.now ? { generatedAt: input.now } : {}),
    profile, profileTitle: P.title, profileSummary: P.summary,
    ...(input.meta?.target ? { target: input.meta.target } : {}),
    ...(input.meta?.coverage ? { coverage: input.meta.coverage } : {}),
    inputs: input.inputs ?? null,
    overall,
    gates,
    dimensions,
    signals: rows,
    recommendations,
    agent: {
      questions: agentRows.length, answered: agentRows.filter((r) => r.status === 'answered').length,
      notApplicable: agentRows.filter((r) => r.status === 'not-applicable').length, unanswered,
      answeredBy: answerMeta?.answeredBy ?? null,
    },
    warnings,
    limitations: [...(input.meta?.limitations ?? []), ...standardLimitations(rows)],
    scoring: scoringModel(profile),
  };
}

/** @param {any} o @param {string} profile */
function headline(o, profile) {
  if (o.score == null) return `Not scored (${profile}): no evidence was supplied.`;
  const gates = o.gates.failed ? `${o.gates.failed} gate(s) failed (${o.cappedBy.join(', ')})${o.capApplied ? `, score capped at ${o.cap}` : ''}` : 'all evaluated gates passed';
  return `${o.score}/100, grade ${o.grade} (${profile})${o.capApplied ? ` — uncapped ${o.rawScore} (${o.uncappedGrade})` : ''}; ${gates}; confidence ${o.confidence} (${o.confidenceLabel})${o.gates.notEvaluated.length ? `; not evaluated: ${o.gates.notEvaluated.join(', ')}` : ''}.`;
}

/** @param {any[]} list rows of one dimension */
function buildFindings(list) {
  const f = [];
  for (const r of list) {
    if (r.excluded) continue;
    if ((r.status === 'measured' || r.status === 'derived') && r.summary) f.push({ signal: r.id, source: r.source, kind: r.normalised < 0.9 ? 'issue' : 'ok', text: r.summary });
    else if (r.status === 'answered') f.push({ signal: r.id, source: 'agent', kind: r.normalised < 0.75 ? 'issue' : 'ok', text: `Agent: ${JSON.stringify(r.raw)}${r.note ? ` — ${r.note}` : ''}` });
    else if (r.status === 'unavailable') f.push({ signal: r.id, source: r.source, kind: 'gap', text: `Not measured: ${r.reason}` });
  }
  return f;
}

const isAvail = (r) => r && !r.excluded && r.normalised != null && ['measured', 'derived', 'answered'].includes(r.status);

/**
 * @param {any} g gate definition @param {Record<string, any>} R rows by id
 * @param {Record<string, any>} answers @param {boolean} spatialApplicable
 */
export function evaluateGate(g, R, answers, spatialApplicable) {
  const base = { id: g.id, title: g.title, scope: g.scope, ...(g.profile ? { profile: g.profile } : {}), standard: g.standard, signals: g.signals };
  const res = (status, message, failingSignals = [], evidence = []) => ({ ...base, status, message, failingSignals, evidence: evidence.filter(Boolean).slice(0, 8) });
  const ex = (r) => [r?.summary, ...((r?.evidence?.examples ?? []).slice(0, 5))];
  const one = (id, failWhen, okMsg) => {
    const r = R[id];
    if (!isAvail(r)) return res('not-evaluated', `${id}: ${r?.reason ?? 'not measured'}`);
    return failWhen(r) ? res('fail', r.summary ?? `${id} = ${JSON.stringify(r.raw)}`, [id], ex(r)) : res('pass', okMsg(r), [], [r.summary]);
  };
  switch (g.id) {
    case 'reducedMotion': return one('motionUsefulness.reducedMotion', (r) => Number(r.raw) > 0, () => 'No animation or continuous motion kept running under prefers-reduced-motion: reduce.');
    case 'userControl': return one('motionUsefulness.pauseControl', (r) => r.normalised < 1, (r) => (r.evidence?.largeAutoMotion ? 'Auto-playing motion found; a pause/stop control is present.' : 'No large auto-playing motion lasting > 5 s was observed.'));
    case 'focusVisible': return one('keyboardSupport.focusVisible', (r) => Number(r.raw) < 1, () => 'Every reached tab stop showed a visible focus change.');
    case 'contrast': return one('accessibility.textContrast', (r) => Number(r.raw) < 1, () => 'axe-core found no text below the contrast minimum.');
    case 'targetSize': return one('touchInteraction.targetSize24', (r) => Number(r.raw) < 1, () => 'All non-exempt touch targets are ≥ 24×24 CSS px or spaced.');
    case 'zoom': return one('touchInteraction.zoomAllowed', (r) => Number(r.raw) < 1, () => 'Zoom is allowed on every route.');
    case 'keyboard': {
      const reach = R['keyboardSupport.reachable']; const trap = R['keyboardSupport.noTrap'];
      if (!isAvail(reach) && !isAvail(trap)) return res('not-evaluated', `keyboard walk did not run: ${reach?.reason ?? 'not measured'}`);
      const failing = [];
      if (isAvail(trap) && Number(trap.normalised) < 1) failing.push('keyboardSupport.noTrap');
      if (isAvail(reach) && Number(reach.raw) < 1) failing.push('keyboardSupport.reachable');
      if (failing.length) return res('fail', failing.map((id) => R[id].summary ?? id).join(' '), failing, failing.flatMap((id) => ex(R[id])));
      return res('pass', 'Every interactive element was reachable and Tab never got stuck.', [], [reach?.summary]);
    }
    case 'flashing': {
      const a = answers['accessibility.flashing'];
      if (!a || a.status !== 'answered') return res('not-evaluated', 'Agent question accessibility.flashing is unanswered (flashing is not measured automatically).');
      return a.value === 'yes' ? res('fail', `Agent reports flashing content${a.note ? `: ${a.note}` : ''}.`, ['accessibility.flashing'], [a.note]) : res('pass', `Agent checked: no flashing above 3 per second${a.note ? ` (${a.note})` : ''}.`);
    }
    case 'spatialClarity': {
      if (!spatialApplicable) return res('not-applicable', 'No 3D canvas on the assessed routes.');
      /** @type {[string, (r: any) => boolean][]} */
      const checks = [['spatialInteractionClarity.instructions', (r) => r.normalised < 1], ['spatialInteractionClarity.keyboardAlternatives', (r) => r.normalised < 0.5], ['spatialInteractionClarity.fallback', (r) => r.normalised < 1]];
      const failing = checks.filter(([id, bad]) => isAvail(R[id]) && bad(R[id])).map(([id]) => id);
      if (failing.length) return res('fail', `Immersive requires instructions, DOM controls and a no-WebGL fallback for every 3D view; failing: ${failing.map((id) => String(id).split('.')[1]).join(', ')}.`, failing, failing.flatMap((id) => ex(R[id])));
      const missing = checks.filter(([id]) => !isAvail(R[id])).map(([id]) => id);
      if (missing.length) return res('not-evaluated', `not measured: ${missing.join(', ')}`);
      return res('pass', '3D views have instructions, DOM controls and a fallback.');
    }
    case 'motionControls': {
      const r = R['motionUsefulness.pauseControl'];
      if (!isAvail(r)) return res('not-evaluated', `motionUsefulness.pauseControl: ${r?.reason ?? 'not measured'}`);
      const ev = r.evidence ?? {};
      const fails = typeof ev.anyAutoMotion === 'boolean' ? ev.anyAutoMotion && !(ev.controls > 0) : r.normalised < 1;
      return fails
        ? res('fail', `Something plays by itself (${(ev.autoMotion ?? []).slice(0, 3).join('; ') || 'auto-playing motion'}) and no visible pause / reduce-motion control was found.`, ['motionUsefulness.pauseControl'], (ev.autoMotion ?? []).slice(0, 5))
        : res('pass', ev.anyAutoMotion ? 'Auto-playing motion has a visible motion control.' : 'Nothing plays by itself.');
    }
    default: return res('not-evaluated', 'unknown gate');
  }
}

/**
 * @param {any[]} rows @param {Record<string, any>} dims @param {any[]} gates @param {number} wScored @param {number|null} cap
 */
function buildRecommendations(rows, dims, gates, wScored, cap, binding) {
  const capText = (id) => `Required to pass the "${id}" gate${binding ? ` (failed gates currently cap the score at ${cap})` : ` (failed gates cap the score at ${cap}; the raw score is already below that)`}.`;
  const failedBySignal = new Map();
  for (const g of gates) if (g.status === 'fail') for (const id of g.failingSignals) failedBySignal.set(id, g);
  const recs = [];
  for (const d of Object.values(dims)) {
    if (d.status !== 'scored') continue;
    const list = rows.filter((r) => r.dimension === d.id && isAvail(r));
    const wAvail = list.reduce((s, r) => s + r.weight, 0);
    for (const r of list) {
      const gate = failedBySignal.get(r.id);
      if (r.normalised >= 0.9 && !gate) continue;
      if (r.source === 'agent' && r.normalised >= 0.75 && !gate) continue;
      const def = SIGNAL_BY_ID[r.id];
      const dimPoints = (100 * r.weight * (1 - r.normalised)) / wAvail;
      const overallPoints = wScored ? (d.weight / wScored) * dimPoints : 0;
      const priority = gate ? 'P0' : overallPoints >= 2 ? 'P1' : overallPoints >= 0.75 ? 'P2' : 'P3';
      const evidence = r.source === 'agent'
        ? [`Agent answer: ${JSON.stringify(r.raw)}${r.note ? ` — ${r.note}` : ''}`, ...((r.evidence?.files ?? []).map((f) => `see ${f}`))]
        : [r.summary, ...((r.evidence?.examples ?? []).slice(0, 5))].filter(Boolean);
      recs.push({
        id: `rec:${r.id}`, priority, dimension: d.id, signal: r.id, source: r.source,
        what: def.what, why: def.why, how: def.how, evidence,
        expectedEffect: {
          overallPoints: r1(overallPoints), dimensionPoints: r1(dimPoints),
          ...(gate ? { gate: gate.id, liftsCap: cap } : {}),
          note: `${gate ? `${capText(gate.id)} ` : ''}Estimated if fully resolved with everything else unchanged: +${r1(dimPoints)} on ${d.title}, +${r1(overallPoints)} overall before caps.`,
        },
      });
    }
  }
  // gates that failed without a signal recommendation (e.g. Immersive motion controls when only small loops exist)
  for (const g of gates) {
    if (g.status !== 'fail') continue;
    if (recs.some((x) => x.expectedEffect.gate === g.id)) continue;
    const def = SIGNAL_BY_ID[g.failingSignals[0] ?? g.signals[0]];
    recs.push({
      id: `rec:gate:${g.id}`, priority: 'P0', dimension: def?.dimension ?? null, signal: def?.id ?? null, source: 'gate',
      what: g.id === 'motionControls' ? 'Add a visible "Pause animations" control for everything that plays by itself' : def?.what ?? g.title,
      why: `${g.title} (${g.standard}). ${def?.why ?? ''}`.trim(), how: def?.how ?? '', evidence: [g.message, ...g.evidence].filter(Boolean),
      expectedEffect: { overallPoints: null, dimensionPoints: null, gate: g.id, liftsCap: cap, note: capText(g.id) },
    });
  }
  const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
  recs.sort((a, b) => order[a.priority] - order[b.priority] || (b.expectedEffect.overallPoints ?? 99) - (a.expectedEffect.overallPoints ?? 99) || a.id.localeCompare(b.id));
  recs.forEach((x, i) => { x.rank = i + 1; });
  return recs;
}

/** @param {any[]} rows */
function standardLimitations(rows) {
  const L = [
    'Scores are transparent heuristics, not a usability study and not an accessibility audit; do not cite them as conformance.',
  ];
  const unanswered = rows.filter((r) => r.source === 'agent' && r.status === 'unanswered').length;
  if (unanswered) L.push(`${unanswered} agent question(s) are unanswered; their weight lowers confidence and nothing was assumed for them.`);
  const unavailable = rows.filter((r) => r.source !== 'agent' && r.status === 'unavailable').length;
  if (unavailable) L.push(`${unavailable} measured signal(s) were unavailable and lower confidence (see the signal table).`);
  return L;
}

/** The complete scoring model for a profile (copied into every result). @param {string} profile */
export function scoringModel(profile) {
  const P = PROFILES[profile];
  return {
    formula: {
      signal: 'n = normalise(raw) ∈ [0, 1] — per-signal normaliser listed with each signal (bands depend on the profile)',
      dimension: 'score_d = 100 × Σ(w_s × n_s) / Σ(w_s) over signals with evidence (measured, derived or answered); weights of missing signals are renormalised away',
      confidence: 'confidence_d = Σ w_s(with evidence) / Σ w_s(applicable); unanswered agent questions and unmeasured signals count as missing; not-applicable signals are excluded',
      overall: 'raw = Σ(W_d × score_d) / Σ W_d over scored dimensions (n/a and not-assessed dimensions excluded, weights renormalised)',
      overallConfidence: 'Σ(W_d × confidence_d) / Σ W_d over applicable dimensions',
      gates: `score = min(raw, cap); ${GATE_CAPS.rule}`,
      grade: GRADES.map((g) => `${g.grade} ≥ ${g.min}`).join(', '),
      recommendations: 'expected effect = (W_d / ΣW_scored) × (w_s / Σw_available) × (1 − n_s) × 100 overall points; P0 = signal behind a failed gate, P1 ≥ 2 points, P2 ≥ 0.75, P3 otherwise (signals with n < 0.9; agent answers < 0.75)',
    },
    profile: { id: profile, title: P.title, summary: P.summary, notes: P.notes, dimensionWeights: P.dimensionWeights, bands: P.bands, requirements: P.requirements },
    gateCaps: GATE_CAPS, grades: GRADES, confidenceLabels: CONFIDENCE_LABELS,
  };
}
