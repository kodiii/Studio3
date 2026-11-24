// @ts-check
/** Transparent art-direction selection: a weighted score of the brief against every direction. */
import { DIRECTIONS, getDirection } from './directions.mjs';
import { canonicalCategory } from './brief.mjs';
import { round } from './util.mjs';
import { UserError } from '../lib/log.mjs';

export const SELECTION_WEIGHTS = { category: 0.22, aesthetic: 0.26, personality: 0.12, audience: 0.08, specialty: 0.1, motion: 0.08, complexity: 0.06, constraints: 0.08 };

const STOP = new Set(['and', 'the', 'a', 'an', 'with', 'of', 'for', 'to', 'in', 'but', 'not', 'very', 'feel', 'feels', 'look', 'looks', 'style', 'vibe', 'yet', 'or', 'who', 'that', 'at', 'on', 'our', 'is', 'are', 'slightly', 'more', 'less', 'like', 'design', 'aesthetic', 'users', 'people', 'size', 'mid', 'firms']);
const stem = (w) => (w.length > 5 ? w.replace(/(ness|ally|ity|ism|ist|ious|ous|ful|ic|al|ed|ly|es|s)$/, '') : w);
/** @param {string} s */
export function tokens(s) {
  return [...new Set(String(s).toLowerCase().split(/[^a-z0-9-]+/).filter((w) => w.length > 1 && !STOP.has(w)))];
}
const hit = (tok, words) => {
  const st = stem(tok);
  return words.some((k) => k === tok || stem(k) === st || (st.length >= 5 && (k.startsWith(st) || st.startsWith(stem(k)) && stem(k).length >= 5)));
};
/** Share of tokens found in the vocabulary; `empty` when there is nothing to compare. */
function overlap(toks, words, empty) {
  if (!toks.length) return { score: empty, matched: [] };
  const matched = toks.filter((t) => hit(t, words));
  return { score: matched.length / toks.length, matched };
}

/**
 * @param {any} brief normalised brief
 * @param {() => number} rand seeded PRNG stream (tie-break jitter only)
 * @param {string} [forcedId]
 */
export function selectDirection(brief, rand, forcedId) {
  const cat = canonicalCategory(brief.productCategory);
  const aTok = tokens(brief.preferredAesthetic);
  const pTok = tokens(brief.brand.personality.join(' '));
  const uTok = tokens(brief.audience);
  const needs = brief.accessibility.needs.join(' ');
  const named = DIRECTIONS.find((d) => brief.preferredAesthetic.toLowerCase().includes(d.id) || brief.preferredAesthetic.toLowerCase().includes(d.name.toLowerCase()));
  if (forcedId && !getDirection(forcedId)) throw new UserError(`Unknown direction "${forcedId}". Run "maquettekit design directions" for the list.`);

  const scored = DIRECTIONS.map((d) => {
    const aes = overlap(aTok, d.fit.keywords, 0.5);
    const per = overlap(pTok, d.fit.keywords, 0.5);
    const aud = overlap(uTok, d.fit.audience, 0.5);
    /** @type {string[]} */
    const notes = [];
    let constraints = 1;
    if (brief.accessibility.level === 'AAA' && d.fit.lowContrastRisk) { constraints *= 0.6; notes.push('AAA requested; this direction leans on low-contrast tints'); }
    if (/vestibular|motion|epilep|seizure/.test(needs) && d.motion.energy > 0.6) { constraints *= 0.6; notes.push('motion-sensitivity need vs. energetic motion temperament'); }
    if (brief.performance.lowEndDevices && d.fit.heavy) { constraints *= 0.4; notes.push('low-end devices vs. media/3D-heavy direction'); }
    if (brief.performance.budget === 'tight' && d.fit.heavy) { constraints *= 0.6; notes.push('tight performance budget vs. media/3D-heavy direction'); }
    if (brief.targetDevices.length && brief.targetDevices.every((x) => /mobile|phone/.test(x)) && d.density === 'compact') { constraints *= 0.8; notes.push('mobile-only vs. compact density'); }
    const parts = {
      category: cat ? d.fit.categories[cat] ?? 0.4 : 0.5,
      aesthetic: named ? (named.id === d.id ? 1 : 0) : aes.score,
      personality: per.score,
      audience: aud.matched.length ? 0.5 + 0.5 * aud.score : 0.5,
      specialty: d.fit.specialty[brief.specialty] ?? 0.5,
      motion: d.fit.motion[brief.motionIntensity] ?? 0.5,
      complexity: d.fit.complexity[brief.interactionComplexity] ?? 0.5,
      constraints,
    };
    const jitter = (rand() - 0.5) * 0.01;
    const score = Object.entries(SELECTION_WEIGHTS).reduce((s, [k, w]) => s + w * parts[k], 0) + jitter;
    return {
      id: d.id,
      score: round(score, 4),
      breakdown: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, { value: round(v, 3), weight: SELECTION_WEIGHTS[k], contribution: round(v * SELECTION_WEIGHTS[k], 4) }])),
      jitter: round(jitter, 4),
      matched: { aesthetic: aes.matched, personality: per.matched, audience: aud.matched },
      notes,
    };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const chosen = forcedId ? scored.find((s) => s.id === forcedId) : scored[0];
  const runnerUp = scored.find((s) => s.id !== chosen.id);
  return {
    direction: /** @type {import('./directions.mjs').Direction} */ (getDirection(chosen.id)),
    selection: {
      method: 'score = Σ weight × component (each component 0–1) + seeded tie-break jitter (±0.005). Highest score wins unless a direction is forced.',
      weights: SELECTION_WEIGHTS,
      category: cat ?? 'unrecognised (neutral 0.5 for every direction)',
      forced: Boolean(forcedId),
      chosen,
      runnerUp,
      ranking: scored.map((s) => ({ id: s.id, score: s.score })),
    },
  };
}
