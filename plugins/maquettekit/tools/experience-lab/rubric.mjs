// @ts-check
/**
 * Agent-led rubric: the questions that cannot be measured, their answer format, and
 * parsing/validation of answers.json. Unanswered questions are never assumed: they stay
 * "unanswered" and lower the confidence of their dimension.
 */
import { SIGNALS, DIMENSION_BY_ID, PROFILES, resolveWeight, describeNormaliser, GATE_BY_ID } from './catalog.mjs';
import { UserError } from '../lib/log.mjs';

export const NOT_APPLICABLE = ['na', 'n/a', 'not-applicable', 'not applicable'];
export const UNANSWERED = ['not-tested', 'not tested', 'unknown', 'skip', 'skipped', ''];

export const ANSWER_FORMAT = {
  file: 'answers.json',
  shape: '{ "profile"?: "<profile>", "answeredBy"?: "<who>", "answers": { "<question id>": <value> | { "value": <value>, "note"?: "<what you saw>", "evidence"?: ["<screenshot or file:line>"] } } }',
  values: {
    scale: 'a number from 1 to 5 (decimals allowed); see the anchors of each question',
    choice: 'one of the listed options, e.g. "yes" | "partial" | "no"',
    notApplicable: `"na" — the question does not apply (excluded from the score and from confidence)`,
    unanswered: `"not-tested" / null / omitted — counted as unanswered: the score does not assume anything and confidence drops`,
  },
  rules: [
    'Answer after inspecting the screenshots in <out>/screenshots and the code; put what you saw in "note" and the file you looked at in "evidence".',
    'Never guess: leave a question out or answer "not-tested" rather than inventing a value.',
    'Agent answers are reported separately from measured evidence in experience.md.',
  ],
};

/** Agent questions, optionally with profile-resolved weights. @param {string} [profile] */
export function agentQuestions(profile) {
  return SIGNALS.filter((s) => s.source === 'agent').map((s) => {
    const n = s.normalise;
    const answer = n.type === 'scale' ? { type: 'scale', min: n.min, max: n.max, anchors: s.anchors ?? null, alsoAccepted: ['na', 'not-tested'] } : { type: 'choice', options: Object.keys(n.map), alsoAccepted: ['na', 'not-tested'] };
    return {
      id: s.id, dimension: s.dimension, dimensionTitle: DIMENSION_BY_ID[s.dimension].title, title: s.title,
      prompt: s.prompt, inspect: s.inspect, answer, normalisation: describeNormaliser(n),
      ...(profile ? { weight: resolveWeight(s, profile) } : {}),
      ...(s.gate ? { gate: s.gate, gateTitle: GATE_BY_ID[s.gate]?.title } : {}),
      ...(s.dimension === 'spatialInteractionClarity' ? { appliesWhen: 'a WebGL/WebGPU canvas is present (otherwise the dimension is not applicable and the answer is ignored)' } : {}),
    };
  });
}

/** @param {string} profile */
export function buildRubric(profile) {
  const questions = agentQuestions(profile);
  return {
    tool: 'maquettekit-experience-lab', kind: 'experience-rubric', profile, profileTitle: PROFILES[profile].title,
    purpose: 'Criteria that cannot be measured reliably in a browser. Answer them after inspecting the screenshots and code, save answers.json, then run `maquettekit experience score --signals <out>/signals.json --answers answers.json --profile ' + profile + '` (or pass --answers to assess).',
    answerFormat: ANSWER_FORMAT,
    questions,
    template: { profile, answeredBy: 'agent', answers: Object.fromEntries(questions.map((q) => [q.id, { value: null, note: '', evidence: [] }])) },
  };
}

/**
 * Parse and validate an answers document.
 * @param {any} doc parsed answers.json (or null)
 * @returns {{ answers: Record<string, { status: 'answered'|'not-applicable'|'unanswered', value: any, note: string|null, evidence: string[] }>, warnings: string[], meta: any }}
 */
export function parseAnswers(doc) {
  /** @type {Record<string, any>} */ const out = {};
  const warnings = [];
  if (doc == null) return { answers: out, warnings, meta: null };
  if (typeof doc !== 'object' || Array.isArray(doc)) throw new UserError('answers must be a JSON object: { "answers": { "<question id>": <value> } }');
  const META = new Set(['$schema', 'profile', 'answeredBy', 'answeredAt', 'notes', 'tool', 'kind']);
  const map = doc.answers && typeof doc.answers === 'object' && !Array.isArray(doc.answers) ? doc.answers : Object.fromEntries(Object.entries(doc).filter(([k]) => !META.has(k)));
  const byId = Object.fromEntries(SIGNALS.filter((s) => s.source === 'agent').map((s) => [s.id, s]));
  const errors = [];
  for (const [id, raw] of Object.entries(map)) {
    const q = byId[id];
    if (!q) { warnings.push(`answers: "${id}" is not a rubric question (ignored)${SIGNALS.some((s) => s.id === id) ? ' — it is a measured signal; put measured values in the signals file' : ''}`); continue; }
    const obj = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : { value: raw };
    const note = obj.note == null || obj.note === '' ? null : String(obj.note);
    const evidence = Array.isArray(obj.evidence) ? obj.evidence.map(String) : obj.evidence ? [String(obj.evidence)] : [];
    let v = obj.value ?? obj.answer ?? obj.score;
    if (typeof v === 'string') v = v.trim();
    const lower = typeof v === 'string' ? v.toLowerCase() : v;
    if (v === undefined || v === null || UNANSWERED.includes(lower)) { out[id] = { status: 'unanswered', value: null, note, evidence }; continue; }
    if (NOT_APPLICABLE.includes(lower)) { out[id] = { status: 'not-applicable', value: null, note, evidence }; continue; }
    const n = q.normalise;
    if (n.type === 'scale') {
      const x = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(x) || x < n.min || x > n.max) { errors.push(`${id}: expected a number ${n.min}–${n.max}, "na" or "not-tested" (got ${JSON.stringify(v)})`); continue; }
      out[id] = { status: 'answered', value: x, note, evidence };
    } else {
      if (typeof lower !== 'string' || !(lower in n.map)) { errors.push(`${id}: expected one of ${Object.keys(n.map).join(' | ')}, "na" or "not-tested" (got ${JSON.stringify(v)})`); continue; }
      out[id] = { status: 'answered', value: lower, note, evidence };
    }
  }
  if (errors.length) throw new UserError(`Invalid answers:\n  ${errors.join('\n  ')}`);
  return { answers: out, warnings, meta: { profile: doc.profile ?? null, answeredBy: doc.answeredBy ?? null } };
}

/** Plain-text rendering of the rubric for `rubric` without --json. @param {ReturnType<typeof buildRubric>} r */
export function renderRubricText(r) {
  const L = [`Maquettekit Experience Lab — agent rubric (${r.profileTitle} profile)`, '', r.purpose, '', `Answer format (${r.answerFormat.file}): ${r.answerFormat.shape}`];
  for (const [k, v] of Object.entries(r.answerFormat.values)) L.push(`  ${k.padEnd(13)} ${v}`);
  for (const rule of r.answerFormat.rules) L.push(`  - ${rule}`);
  let dim = '';
  for (const q of r.questions) {
    if (q.dimension !== dim) { dim = q.dimension; L.push('', `## ${q.dimensionTitle}`); }
    const ans = q.answer.type === 'scale' ? `1–5${q.answer.anchors ? ` (${Object.entries(q.answer.anchors).map(([k, v]) => `${k} = ${v}`).join('; ')})` : ''}` : q.answer.options.join(' | ');
    L.push(`- ${q.id}  [weight ${q.weight}${q.gate ? `, gate: ${q.gate}` : ''}]`, `    Q: ${q.prompt}`, `    How: ${q.inspect}`, `    Answer: ${ans}, or na / not-tested`);
    if (q.appliesWhen) L.push(`    Applies when: ${q.appliesWhen}`);
  }
  L.push('', 'Template: run with --json and copy "template" into answers.json.');
  return L.join('\n');
}
