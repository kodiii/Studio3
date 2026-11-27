// @ts-check
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { main, help } from '../../../plugins/maquettekit/tools/experience-lab/index.mjs';
import { scoreExperience } from '../../../plugins/maquettekit/tools/experience-lab/score.mjs';
import { buildRubric, parseAnswers } from '../../../plugins/maquettekit/tools/experience-lab/rubric.mjs';
import { SIGNALS, DIMENSIONS, PROFILES, PROFILE_IDS, GATES, normalise, resolveNormaliser } from '../../../plugins/maquettekit/tools/experience-lab/catalog.mjs';
import { navSimilarity, tabOrder, loadingFeedback, blockingTime } from '../../../plugins/maquettekit/tools/experience-lab/derive.mjs';
import { launchBrowser } from '../../../plugins/maquettekit/tools/lib/browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(here, '../../fixtures');
const GOOD = path.join(FIXTURES, 'xl-good');
const POOR = path.join(FIXTURES, 'xl-poor');
const CLI = path.resolve(here, '../../../plugins/maquettekit/tools/maquettekit.mjs');
const LONG = 300_000;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'maquettekit-xl-'));
afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

// ---- browser availability: browser tests skip visibly, with the reason ----
const browserProbe = await (async () => {
  if (process.env.MAQUETTEKIT_DISABLE_PLAYWRIGHT === '1') return { ok: false, reason: 'MAQUETTEKIT_DISABLE_PLAYWRIGHT=1' };
  try { const b = await launchBrowser(); await b.close(); return { ok: true, reason: '' }; }
  catch (err) { return { ok: false, reason: String(/** @type {any} */ (err).message).split('\n')[0] }; }
})();
const bit = browserProbe.ok ? it : (name, ..._rest) => it.skip(`${name} [SKIPPED: Chromium unavailable — ${browserProbe.reason}]`, () => {});
if (!browserProbe.ok) console.warn(`experience-lab browser tests skipped: ${browserProbe.reason}`);

/** Raw values that normalise to 1 under every profile. */
function perfectSignals() {
  return Object.fromEntries(SIGNALS.filter((s) => s.source !== 'agent').map((s) => {
    const n = s.normalise; let v;
    if (n.type === 'share') v = 1;
    else if (n.type === 'linear') v = n.good;
    else if (n.type === 'plateau') v = n.lo1;
    else { const b = PROFILE_IDS.map((p) => PROFILES[p].bands[n.band]); v = b[0].good < b[0].bad ? Math.min(...b.map((x) => x.good)) : Math.max(...b.map((x) => x.good)); }
    return [s.id, { value: v, status: s.source }];
  }));
}
const doc = (over = {}, context = { webgl: true }) => ({ context, signals: { ...perfectSignals(), ...over } });
const allAnswers = (over = {}) => ({ answers: { ...Object.fromEntries(SIGNALS.filter((s) => s.source === 'agent').map((s) => [s.id, s.normalise.type === 'scale' ? 5 : s.id === 'accessibility.flashing' ? 'no' : 'yes'])), ...over } });
const gate = (r, id) => r.gates.find((g) => g.id === id);
const row = (r, id) => r.signals.find((s) => s.id === id);

async function cli(argv) {
  const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
  try { const code = await main(argv); return { code, stdout: spy.mock.calls.map((c) => c.join(' ')).join('\n') }; }
  finally { spy.mockRestore(); }
}

// =====================================================================================
describe('experience-lab: catalogue', () => {
  it('defines 14 dimensions, each with measured and agent signals, and profile weights summing to 100', () => {
    expect(DIMENSIONS).toHaveLength(14);
    for (const d of DIMENSIONS) {
      const s = SIGNALS.filter((x) => x.dimension === d.id);
      expect(s.some((x) => x.source !== 'agent'), d.id).toBe(true);
      expect(s.some((x) => x.source === 'agent'), d.id).toBe(true);
    }
    for (const p of PROFILE_IDS) expect(Object.values(PROFILES[p].dimensionWeights).reduce((a, b) => a + b, 0)).toBe(100);
    for (const s of SIGNALS) { expect(['measured', 'derived', 'agent']).toContain(s.source); expect(s.why && s.what && s.how, s.id).toBeTruthy(); }
    expect(new Set(SIGNALS.map((s) => s.id)).size).toBe(SIGNALS.length);
    expect(help).toMatch(/assess/); expect(help).toMatch(/rubric/); expect(help).toMatch(/score/);
  });

  it('normalisers map raw values to 0–1 as documented', () => {
    expect(normalise({ type: 'linear', bad: 500, good: 200 }, 350)).toBeCloseTo(0.5);
    expect(normalise({ type: 'linear', bad: 500, good: 200 }, 100)).toBe(1);
    expect(normalise({ type: 'linear', bad: 0.5, good: 1 }, 0.25)).toBe(0);
    expect(normalise({ type: 'plateau', lo0: 25, lo1: 45, hi1: 80, hi0: 120 }, 100)).toBeCloseTo(0.5);
    expect(normalise({ type: 'scale', min: 1, max: 5 }, 4)).toBe(0.75);
    expect(normalise({ type: 'choice', map: { yes: 1, partial: 0.5, no: 0 } }, 'partial')).toBe(0.5);
    expect(normalise({ type: 'share' }, null)).toBeNull();
  });
});

describe('experience-lab: scoring math (pure)', () => {
  it('perfect evidence scores 100 / A; unanswered agent questions lower confidence but are never assumed', () => {
    const r = scoreExperience({ signals: doc(), profile: 'expressive' });
    expect(r.overall).toMatchObject({ score: 100, rawScore: 100, grade: 'A', cap: null });
    for (const d of Object.values(r.dimensions)) expect(d.score, d.id).toBe(100);
    // usability: measured weights 3+2+1+2 = 8 of 8 + agent 3+2 → 8/13
    expect(r.dimensions.usability.confidence).toBeCloseTo(8 / 13, 3);
    expect(r.overall.confidence).toBeLessThan(0.8);
    expect(gate(r, 'flashing').status).toBe('not-evaluated');
    expect(r.agent.unanswered.length).toBe(SIGNALS.filter((s) => s.source === 'agent').length);
    const answered = scoreExperience({ signals: doc(), answers: allAnswers(), profile: 'expressive' });
    expect(answered.overall.confidence).toBe(1);
    expect(gate(answered, 'flashing').status).toBe('pass');
    expect(JSON.stringify(scoreExperience({ signals: doc(), profile: 'expressive' }))).toBe(JSON.stringify(r)); // deterministic without `now`
  });

  it('renormalises over available signals; not-applicable signals leave the confidence denominator', () => {
    const r = scoreExperience({ profile: 'expressive', signals: doc({ 'usability.formLabels': { value: null, status: 'unavailable' }, 'usability.bodyTextSize': { value: null, status: 'unavailable' }, 'usability.lineLength': { value: 25 } }) });
    expect(r.dimensions.usability.score).toBeCloseTo((100 * (1 * 0 + 2 * 1)) / 3, 1);
    expect(r.dimensions.usability.confidence).toBeCloseTo(3 / 13, 3);
    const na = scoreExperience({ profile: 'expressive', signals: doc({ 'usability.formLabels': { value: null, status: 'not-applicable', reason: 'no forms' } }) });
    expect(na.dimensions.usability.confidence).toBeCloseTo(5 / 10, 3);
    expect(row(na, 'usability.formLabels')).toMatchObject({ status: 'not-applicable', contribution: null });
  });

  it('dimensions without evidence are n/a and excluded; dimension weights are renormalised', () => {
    const worstDisc = { 'discoverability.accessibleNames': { value: 0 }, 'discoverability.affordanceSemantics': { value: 9 }, 'discoverability.linkDistinguishable': { value: 0 }, 'discoverability.primaryActionVisible': { value: 0 } };
    const r = scoreExperience({ profile: 'expressive', signals: doc(worstDisc, { webgl: false }) });
    expect(r.dimensions.spatialInteractionClarity).toMatchObject({ status: 'not-applicable', score: null, confidence: null });
    expect(r.dimensions.discoverability.score).toBe(0);
    expect(r.overall.rawScore).toBeCloseTo((100 * (95 - 7)) / 95, 1); // spatial (5) excluded, discoverability (7) scores 0
    expect(Object.values(r.dimensions).reduce((s, d) => s + d.normalisedWeight, 0)).toBeCloseTo(1, 2);
    const empty = scoreExperience({ profile: 'expressive', signals: doc(Object.fromEntries(SIGNALS.filter((s) => s.dimension === 'usability' && s.source !== 'agent').map((s) => [s.id, { value: null, status: 'unavailable' }]))) });
    expect(empty.dimensions.usability).toMatchObject({ status: 'not-assessed', score: null, confidence: 0 });
    expect(empty.overall.dimensionsNotScored.map((d) => d.id)).toContain('usability');
  });

  it('a failed gate caps the score at 69, two or more at 59, whatever the profile', () => {
    for (const p of PROFILE_IDS) {
      const one = scoreExperience({ profile: p, signals: doc({ 'keyboardSupport.focusVisible': { value: 0.9 } }) });
      expect(gate(one, 'focusVisible').status).toBe('fail');
      expect(one.overall).toMatchObject({ score: 69, grade: 'D', uncappedGrade: 'A', cap: 69, cappedBy: ['focusVisible'], capApplied: true });
      expect(one.overall.rawScore).toBeGreaterThan(90);
      const two = scoreExperience({ profile: p, signals: doc({ 'keyboardSupport.focusVisible': { value: 0.9 }, 'touchInteraction.zoomAllowed': { value: 0 } }) });
      expect(two.overall).toMatchObject({ score: 59, grade: 'F', cap: 59 });
      expect(two.recommendations.slice(0, 2).every((x) => x.priority === 'P0')).toBe(true);
    }
    const unmeasured = scoreExperience({ profile: 'expressive', signals: doc({ 'touchInteraction.targetSize24': { value: null, status: 'unavailable', reason: 'no touch viewport' } }) });
    expect(gate(unmeasured, 'targetSize')).toMatchObject({ status: 'not-evaluated' });
    expect(unmeasured.overall.cap).toBeNull();
    const flash = scoreExperience({ profile: 'essential', signals: doc(), answers: allAnswers({ 'accessibility.flashing': { value: 'yes', note: 'hero strobe at 6 Hz' } }) });
    expect(gate(flash, 'flashing').status).toBe('fail');
    expect(flash.overall.score).toBeLessThanOrEqual(69);
  });

  it('profiles change dimension weights, motion bands and requirements — never the gates', () => {
    const loops = PROFILE_IDS.map((p) => row(scoreExperience({ profile: p, signals: doc({ 'motionUsefulness.infiniteLoops': { value: 2 } }) }), 'motionUsefulness.infiniteLoops').normalised);
    expect(loops[0]).toBe(0); expect(loops[1]).toBeCloseTo(0.667, 2); expect(loops[2]).toBe(1);
    const lat = PROFILE_IDS.map((p) => row(scoreExperience({ profile: p, signals: doc({ 'perceivedPerformance.inputLatency': { value: 250 } }) }), 'perceivedPerformance.inputLatency').normalised);
    expect(lat[0]).toBeCloseTo(0.25, 2); expect(lat[1]).toBeCloseTo(0.833, 2);
    expect(resolveNormaliser(SIGNALS.find((s) => s.id === 'motionUsefulness.longestAnimation'), 'immersive')).toMatchObject({ type: 'linear', good: 900, band: 'longestAnimationMs' });
    // essential gives "transitioned feedback" no weight; immersive doubles it
    const tr = PROFILE_IDS.map((p) => row(scoreExperience({ profile: p, signals: doc() }), 'visualFeedback.animatedFeedback'));
    expect(tr.map((x) => x.weight)).toEqual([0, 1, 2]);
    expect(tr[0].excluded).toBe(true);
    // same evidence, different overall per profile
    // (an inert surface costs nothing in Essential, more in Expressive, most in Immersive)
    const mixed = doc({ 'motionUsefulness.longestAnimation': { value: 800 }, 'cognitiveLoad.fontSizes': { value: 14 }, 'spatialInteractionClarity.instructions': { value: 0 }, 'motionUsefulness.pointerResponse': { value: 0 } });
    const scores = PROFILE_IDS.map((p) => scoreExperience({ profile: p, signals: mixed }));
    expect(new Set(scores.map((s) => s.overall.rawScore)).size).toBe(3);
    expect(row(scores[0], 'motionUsefulness.pointerResponse').excluded).toBe(true);
    expect(row(scores[2], 'motionUsefulness.pointerResponse').weight).toBeGreaterThan(row(scores[1], 'motionUsefulness.pointerResponse').weight);
    // Immersive requires spatial clarity: missing instructions fail its profile gate; other profiles have no such gate
    expect(gate(scores[2], 'spatialClarity')).toMatchObject({ status: 'fail', scope: 'profile' });
    expect(gate(scores[1], 'spatialClarity')).toBeUndefined();
    expect(scores[2].overall.score).toBeLessThanOrEqual(69);
    // universal gates are evaluated identically in every profile
    for (const s of scores) expect(s.gates.filter((g) => g.scope === 'universal').map((g) => `${g.id}:${g.status}`)).toEqual(scores[0].gates.filter((g) => g.scope === 'universal').map((g) => `${g.id}:${g.status}`));
    // Immersive motion controls: small loops with no control fail only Immersive
    const loopsNoControl = doc({ 'motionUsefulness.pauseControl': { value: 1, evidence: { largeAutoMotion: false, anyAutoMotion: true, controls: 0, autoMotion: ['/: infinite "pulse" on .dot'] } } });
    expect(gate(scoreExperience({ profile: 'immersive', signals: loopsNoControl }), 'motionControls').status).toBe('fail');
    expect(gate(scoreExperience({ profile: 'expressive', signals: loopsNoControl }), 'userControl').status).toBe('pass');
  });

  it('recommendations carry priority, what/why/how, evidence and a computed expected effect', () => {
    const r = scoreExperience({ profile: 'expressive', signals: doc({ 'discoverability.accessibleNames': { value: 0.75, summary: '3 of 12 controls are unnamed', evidence: { examples: ['/ @ desktop: button.icon'] } } }, { webgl: false }) });
    const rec = r.recommendations.find((x) => x.signal === 'discoverability.accessibleNames');
    // n = 0.5, measured weights in the dimension 3+2+2+1 = 8 → 100×3×0.5/8 = 18.75 dimension points; × 7/95 overall
    expect(rec).toMatchObject({ priority: 'P2', dimension: 'discoverability', source: 'measured' });
    expect(rec.expectedEffect.dimensionPoints).toBeCloseTo(18.8, 1);
    expect(rec.expectedEffect.overallPoints).toBeCloseTo(1.4, 1);
    expect(rec.evidence).toEqual(['3 of 12 controls are unnamed', '/ @ desktop: button.icon']);
    for (const k of ['what', 'why', 'how']) expect(rec[k].length).toBeGreaterThan(10);
    expect(r.scoring.formula.dimension).toMatch(/Σ\(w_s × n_s\)/);
    expect(r.scoring.profile.dimensionWeights).toEqual(PROFILES.expressive.dimensionWeights);
  });
});

describe('experience-lab: rubric and answers', () => {
  it('rubric lists only agent questions with answer formats and a template', () => {
    const r = buildRubric('immersive');
    expect(r.questions.length).toBe(SIGNALS.filter((s) => s.source === 'agent').length);
    for (const q of r.questions) { expect(q.prompt && q.inspect).toBeTruthy(); expect(['scale', 'choice']).toContain(q.answer.type); expect(typeof q.weight).toBe('number'); }
    expect(r.questions.find((q) => q.id === 'motionUsefulness.skippable').weight).toBe(2);
    expect(Object.keys(r.template.answers)).toEqual(r.questions.map((q) => q.id));
  });

  it('parses answers strictly: na excluded, not-tested unanswered, invalid values rejected', () => {
    const { answers, warnings } = parseAnswers({ answers: { 'usability.taskFlow': { value: 4, note: 'three steps' }, 'touchInteraction.gestureAlternatives': 'na', 'accessibility.screenReader': 'not-tested', 'nope.question': 3 } });
    expect(answers['usability.taskFlow']).toMatchObject({ status: 'answered', value: 4, note: 'three steps' });
    expect(answers['touchInteraction.gestureAlternatives'].status).toBe('not-applicable');
    expect(answers['accessibility.screenReader'].status).toBe('unanswered');
    expect(warnings.join(' ')).toMatch(/nope\.question/);
    expect(() => parseAnswers({ answers: { 'usability.taskFlow': 9 } })).toThrow(/expected a number 1–5/);
    expect(() => parseAnswers({ answers: { 'accessibility.flashing': 'maybe' } })).toThrow(/expected one of no \| yes/);
    const r = scoreExperience({ profile: 'expressive', signals: doc(), answers: { answers: { 'motionUsefulness.purpose': { value: 1, note: 'decorative loops' } } } });
    const rec = r.recommendations.find((x) => x.signal === 'motionUsefulness.purpose');
    expect(rec).toMatchObject({ source: 'agent' });
    expect(rec.evidence[0]).toMatch(/Agent answer: 1 — decorative loops/);
  });
});

describe('experience-lab: derivation helpers (pure)', () => {
  it('nav similarity, tab order, deferred loading and blocking time', () => {
    expect(navSimilarity(['/', '/a', '/b'], ['/', '/a', '/b'])).toBe(1);
    expect(navSimilarity(['/', '/a', '/b'], ['/b', '/a', '/'])).toBe(0);
    expect(navSimilarity(['/', '/a'], [])).toBe(0);
    expect(navSimilarity(['/', '/a', '/b'], ['/', '/a', '/c'])).toBeCloseTo(0.5, 3);
    const s = (selector, x, y) => ({ selector, x, y, w: 80, h: 40, fixed: false });
    expect(tabOrder([s('a', 0, 0), s('b', 100, 0), s('c', 0, 100)])).toMatchObject({ forward: 2, transitions: 2 });
    expect(tabOrder([s('footer', 0, 900), s('a', 0, 0), s('b', 0, 100)]).backward).toEqual(['footer → a']);
    const samples = [{ t: 50, text: 300, ind: 1, kinds: ['aria-busy'] }, { t: 400, text: 300, ind: 1, kinds: ['aria-busy'] }, { t: 800, text: 520, ind: 0, kinds: [] }];
    expect(loadingFeedback({ fcp: 40, dcl: 20, samples })).toMatchObject({ deferred: true, indicator: true, arrivalMs: 800 });
    expect(loadingFeedback({ fcp: 40, dcl: 20, samples: samples.map((x) => ({ ...x, ind: 0, kinds: [] })) })).toMatchObject({ deferred: true, indicator: false });
    expect(loadingFeedback({ fcp: 40, samples: [{ t: 50, text: 300, ind: 0 }, { t: 900, text: 310, ind: 0 }] })).toMatchObject({ deferred: false });
    expect(blockingTime({ fcp: 100, longTasks: [{ start: 10, duration: 300 }, { start: 700, duration: 260 }, { start: 1000, duration: 120 }] })).toMatchObject({ ms: 280, tasks: 2 });
  });
});

describe('experience-lab: CLI without a browser', () => {
  it('rubric --json and score with signals + answers; --profile is required for score; exit 1 when a gate fails', async () => {
    const rb = await cli(['rubric', '--profile', 'essential', '--json']);
    expect(rb.code).toBe(0);
    expect(JSON.parse(rb.stdout)).toMatchObject({ kind: 'experience-rubric', profile: 'essential' });
    const sig = path.join(tmp, 'signals.json'); fs.writeFileSync(sig, JSON.stringify(doc()));
    const ans = path.join(tmp, 'answers.json'); fs.writeFileSync(ans, JSON.stringify(allAnswers()));
    const out = path.join(tmp, 'score-out');
    const ok = await cli(['score', '--signals', sig, '--answers', ans, '--profile', 'immersive', '--out', out, '--json']);
    expect(ok.code).toBe(0);
    expect(JSON.parse(ok.stdout).overall).toMatchObject({ score: 100, grade: 'A', confidence: 1 });
    expect(fs.readFileSync(path.join(out, 'experience.md'), 'utf8')).toMatch(/# Part B — Agent judgement/);
    fs.writeFileSync(sig, JSON.stringify(doc({ 'touchInteraction.zoomAllowed': 0 })));
    expect((await cli(['score', '--signals', sig, '--profile', 'expressive'])).code).toBe(1);
    await expect(main(['score', '--signals', sig])).rejects.toMatchObject({ name: 'UserError', exitCode: 2 });
    await expect(main(['score', '--profile', 'nope', '--signals', sig])).rejects.toMatchObject({ exitCode: 2 });
    await expect(main(['assess'])).rejects.toMatchObject({ exitCode: 2 });
    await expect(main(['assess', '--url', 'https://example.com/'])).rejects.toThrow(/local server/);
  });

  it('MAQUETTEKIT_DISABLE_PLAYWRIGHT=1: assess exits 3 with a clear message; score still works', async () => {
    process.env.MAQUETTEKIT_DISABLE_PLAYWRIGHT = '1';
    try { await expect(main(['assess', '--serve', GOOD, '--out', path.join(tmp, 'nopw')])).rejects.toMatchObject({ name: 'UserError', exitCode: 3 }); }
    finally { delete process.env.MAQUETTEKIT_DISABLE_PLAYWRIGHT; }
    const env = { ...process.env, MAQUETTEKIT_DISABLE_PLAYWRIGHT: '1' };
    const r = spawnSync(process.execPath, [CLI, 'experience', 'assess', '--serve', GOOD, '--out', path.join(tmp, 'nopw')], { env, encoding: 'utf8' });
    expect(r.status).toBe(3);
    expect(r.stderr).toMatch(/Playwright is disabled \(MAQUETTEKIT_DISABLE_PLAYWRIGHT=1\)/);
    expect(r.stderr).toMatch(/experience score/);
    const ans = path.join(tmp, 'answers-only.json'); fs.writeFileSync(ans, JSON.stringify(allAnswers()));
    const s = spawnSync(process.execPath, [CLI, 'experience', 'score', '--answers', ans, '--profile', 'expressive', '--json'], { env, encoding: 'utf8' });
    expect(s.status).toBe(0);
    const res = JSON.parse(s.stdout);
    expect(res.overall.score).toBe(100);
    expect(res.overall.confidence).toBeLessThan(0.5); // rubric-only: nothing measured
    expect(res.limitations.join(' ')).toMatch(/nothing was measured/);
  });
});

// =====================================================================================
describe('experience-lab: measured runs on the xl fixtures', () => {
  /** @type {any} */ let good; /** @type {any} */ let poor;
  const goodOut = path.join(tmp, 'good'); const poorOut = path.join(tmp, 'poor');
  beforeAll(async () => {
    if (!browserProbe.ok) return;
    const { runAssessment } = await import('../../../plugins/maquettekit/tools/experience-lab/assess.mjs');
    const [g, p] = await Promise.all([runAssessment({ serve: GOOD, out: goodOut, profile: 'expressive' }), runAssessment({ serve: POOR, out: poorOut, profile: 'expressive' })]);
    good = g.result; poor = p.result;
  }, LONG);
  const dim = (r, id) => r.dimensions[id].score;
  const raw = (r, id) => row(r, id).raw;

  bit('good scores far higher than poor; gates pass on good and trip on poor', () => {
    expect(good.coverage.routes).toEqual(['/', '/form.html', '/scene.html']);
    expect(good.overall.grade).toMatch(/^[AB]$/);
    expect(good.overall.cappedBy).toEqual([]);
    expect(good.gates.filter((g) => g.status === 'fail')).toEqual([]);
    expect(poor.overall.score).toBeLessThanOrEqual(59);
    expect(poor.overall.grade).toBe('F');
    expect(good.overall.score - poor.overall.score).toBeGreaterThan(30);
    for (const id of ['reducedMotion', 'userControl', 'keyboard', 'focusVisible', 'contrast', 'targetSize', 'zoom']) expect(gate(poor, id).status, id).toBe('fail');
    expect(gate(poor, 'flashing').status).toBe('not-evaluated'); // agent-only, unanswered
  });

  bit('planted dimensions differ in the expected direction', () => {
    for (const id of ['visualFeedback', 'navigationConsistency', 'touchInteraction', 'keyboardSupport', 'motionUsefulness', 'loadingExperience', 'errorHandling', 'accessibility', 'spatialInteractionClarity', 'interactionPredictability', 'usability']) {
      expect(dim(good, id) - dim(poor, id), id).toBeGreaterThan(20);
    }
    expect(dim(good, 'perceivedPerformance')).toBeGreaterThan(dim(poor, 'perceivedPerformance'));
    expect(raw(good, 'errorHandling.formValidation')).toBe(1);
    expect(raw(poor, 'errorHandling.formValidation')).toBeCloseTo(0.2, 2);
    expect(raw(good, 'loadingExperience.loadingFeedback')).toBe(1);
    expect(raw(poor, 'loadingExperience.loadingFeedback')).toBe(0);
    expect(raw(good, 'interactionPredictability.expandedState')).toBe(1);
    expect(raw(poor, 'interactionPredictability.expandedState')).toBe(0);
    expect(raw(good, 'spatialInteractionClarity.fallback')).toBe(1);
    expect(raw(poor, 'spatialInteractionClarity.fallback')).toBe(0);
    expect(raw(good, 'errorHandling.notFound')).toBe(1);
    expect(raw(poor, 'errorHandling.notFound')).toBeCloseTo(0.7, 2);
    expect(raw(good, 'navigationConsistency.navConsistency')).toBe(1);
    expect(raw(poor, 'navigationConsistency.navConsistency')).toBeLessThan(0.5);
    expect(raw(poor, 'perceivedPerformance.inputLatency')).toBeGreaterThan(300);
    expect(raw(good, 'perceivedPerformance.inputLatency')).toBeLessThan(150);
    expect(raw(poor, 'motionUsefulness.reducedMotion')).toBeGreaterThan(0);
    expect(raw(good, 'motionUsefulness.reducedMotion')).toBe(0);
    expect(raw(poor, 'keyboardSupport.popupKeyboard')).toBeLessThan(1); // fake menu opens on click only
    // liveliness: the good home page's band follows the pointer and the scroll; the poor site answers neither
    expect(raw(good, 'motionUsefulness.pointerResponse')).toBeCloseTo(1 / 3, 2); // home only; form and scene need not
    expect(raw(poor, 'motionUsefulness.pointerResponse')).toBe(0);
    expect(raw(good, 'motionUsefulness.scrollResponse')).toBe(1);
    expect(row(poor, 'motionUsefulness.scrollResponse').raw ?? 0).toBe(0);
    expect(row(good, 'motionUsefulness.pointerResponse').normalised).toBeGreaterThan(row(poor, 'motionUsefulness.pointerResponse').normalised);
  });

  bit('writes signals.json, experience.json/md and screenshots; Part A (measured) precedes Part B (agent)', () => {
    for (const f of ['signals.json', 'experience.json', 'experience.md', 'measurements.json']) expect(fs.existsSync(path.join(goodOut, f)), f).toBe(true);
    for (const s of good.coverage.screenshots) expect(fs.existsSync(path.join(goodOut, s)), s).toBe(true);
    expect(good.coverage.screenshots).toContain('screenshots/scene-html/desktop-no-webgl.png');
    const md = fs.readFileSync(path.join(poorOut, 'experience.md'), 'utf8');
    expect(md.indexOf('# Part A — Measured evidence')).toBeGreaterThan(0);
    expect(md.indexOf('# Part A')).toBeLessThan(md.indexOf('# Part B — Agent judgement'));
    expect(md).toMatch(/7 gate\(s\) failed/); // raw 38.5 is already below the 59 cap, so the report says the cap does not bite
    expect(md).toMatch(/lab measurements, not field data/);
    const sig = JSON.parse(fs.readFileSync(path.join(goodOut, 'signals.json'), 'utf8'));
    expect(sig).toMatchObject({ kind: 'experience-signals', context: { webgl: true } });
    expect(Object.keys(sig.signals).length).toBe(SIGNALS.filter((s) => s.source !== 'agent').length);
    for (const g of GATES.filter((x) => x.scope === 'universal')) expect(good.gates.map((x) => x.id)).toContain(g.id);
  });

  bit('rubric answers integrate when re-scoring measured signals (and the profile can change)', async () => {
    const ans = path.join(tmp, 'poor-answers.json');
    fs.writeFileSync(ans, JSON.stringify(allAnswers({ 'motionUsefulness.purpose': { value: 1, note: 'spinning orb and sliding banner are decorative', evidence: ['screenshots/root/desktop-fold.png'] } })));
    const { code, stdout } = await cli(['score', '--signals', path.join(poorOut, 'signals.json'), '--answers', ans, '--profile', 'immersive', '--json']);
    expect(code).toBe(1);
    const r = JSON.parse(stdout);
    expect(r.overall.confidence).toBeGreaterThan(poor.overall.confidence);
    expect(gate(r, 'flashing').status).toBe('pass');
    expect(gate(r, 'spatialClarity').status).toBe('fail');
    expect(r.recommendations.some((x) => x.signal === 'motionUsefulness.purpose' && x.evidence[0].includes('decorative'))).toBe(true);
    expect(r.dimensions.motionUsefulness.evidenceMix.agentWeight).toBeGreaterThan(0);
  });
});

describe('experience-lab: liveliness probe tells continuous response from hover states and one-shot reveals', () => {
  const page = (body, script = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>t</title><style>
    body { margin: 0; font: 16px system-ui; } main { padding: 40px; min-height: 260vh; }
    .card { width: 240px; height: 160px; margin: 24px; background: #dbeafe; display: inline-block; transition: transform 150ms; }
    .card:hover { transform: scale(1.05); } .reveal { opacity: 0; transition: opacity 200ms; } .reveal.in { opacity: 1; }
  </style></head><body><main>${body}</main><script>${script}</script></body></html>`;
  const write = (name, html) => { const f = path.join(tmp, name); fs.writeFileSync(f, html); return 'file://' + f; };
  const tracking = write('lively-tracking.html', page(
    '<div class="card" id="hoverable"></div><div class="card" id="tracker"></div><div class="card" id="depth"></div>' + '<p>text</p>'.repeat(40),
    `const t = document.getElementById('tracker'); const d = document.getElementById('depth');
     addEventListener('pointermove', (e) => { t.style.transform = 'translate(' + (e.clientX / 40).toFixed(1) + 'px,' + (e.clientY / 40).toFixed(1) + 'px)'; });
     addEventListener('scroll', () => { d.style.transform = 'translateY(' + (scrollY * 0.3).toFixed(1) + 'px)'; }, { passive: true });`));
  const inert = write('lively-inert.html', page(
    '<div class="card" id="a"></div><div class="card" id="b"></div><div class="card" id="c"></div>' + '<p class="reveal">reveal</p>' + '<p>text</p>'.repeat(40),
    `const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } })); document.querySelectorAll('.reveal').forEach((el) => io.observe(el));`));

  /** @type {any} */ let lively; /** @type {any} */ let flat;
  beforeAll(async () => {
    if (!browserProbe.ok) return;
    const { probeLiveliness } = await import('../../../plugins/maquettekit/tools/experience-lab/probes/interact.mjs');
    const { installPageHelpers } = await import('../../../plugins/maquettekit/tools/visual-director/page/helpers.mjs');
    const { newContext } = await import('../../../plugins/maquettekit/tools/lib/browser.mjs');
    const browser = await launchBrowser();
    try {
      for (const [url, set] of /** @type {const} */ ([[tracking, (r) => { lively = r; }], [inert, (r) => { flat = r; }]])) {
        const ctx = await newContext(browser, 'laptop');
        await ctx.addInitScript(installPageHelpers);
        const p = await ctx.newPage();
        await p.goto(url);
        await p.waitForTimeout(300);
        set(await probeLiveliness(p));
        await ctx.close();
      }
    } finally { await browser.close(); }
  }, LONG);

  bit('a pointer-tracking element and a parallax layer respond; hover states and a reveal do not', () => {
    expect(lively.pointer).toMatchObject({ status: 'measured', responds: true });
    expect(lively.pointer.elements.join(' ')).toContain('tracker');
    expect(lively.pointer.elements.join(' ')).not.toContain('hoverable');
    expect(lively.scroll).toMatchObject({ status: 'measured', responds: true });
    expect(lively.scroll.elements.join(' ')).toContain('depth');
    expect(flat.pointer).toMatchObject({ status: 'measured', responds: false });
    expect(flat.scroll).toMatchObject({ status: 'measured', responds: false });
  });
});
