// @ts-check
/**
 * Maquettekit Experience Lab — `maquettekit experience <command>`.
 * Loopback only; nothing is uploaded; no telemetry. `rubric` and `score` need no dependencies.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from '../lib/args.mjs';
import { log, UserError } from '../lib/log.mjs';
import { PROFILE_IDS } from './catalog.mjs';
import { buildRubric, renderRubricText } from './rubric.mjs';
import { scoreExperience } from './score.mjs';
import { renderExperienceMd, renderSummaryText } from './report-md.mjs';
import { toolVersion } from '../visual-director/util.mjs';

export { scoreExperience, parseSignals, evaluateGate, scoringModel } from './score.mjs';
export { buildRubric, parseAnswers, agentQuestions } from './rubric.mjs';
export { DIMENSIONS, SIGNALS, PROFILES, GATES, GATE_CAPS, GRADES } from './catalog.mjs';
export { renderExperienceMd } from './report-md.mjs';

export const help = `Maquettekit Experience Lab — transparent, heuristic interaction-quality assessment across 14 dimensions

Usage: maquettekit experience <command> [options]

  assess     Measure a site in headless Chromium, combine with agent answers, write experience.{json,md}
      --url <url> | --serve <dir>     a running local site (loopback hosts only), or a static directory served on 127.0.0.1
      --routes /,/pricing             routes to assess (default: path of --url; every .html file for --serve, 404.html excluded)
      --profile essential|expressive|immersive
                                      default: motion.profile from ./maquettekit.design.json, else expressive
      --viewports mobile,desktop      presets: desktop, laptop, tablet, mobile (default mobile,desktop)
      --out <dir>                     output directory (default .maquettekit/experience)
      --answers <file.json>           agent rubric answers to include in the score
      --json                          print a JSON summary (paths, score, gates) to stdout
      writes signals.json (raw, profile-independent), experience.json, experience.md, measurements.json, screenshots/
      exit code: 0 no gate failed · 1 at least one gate failed · 2 usage error · 3 Playwright/Chromium unavailable

  rubric     The agent-led questions for criteria that cannot be measured, with the answers.json format
      [--profile <p>] [--json]        --json includes a fill-in "template"

  score      Pure scoring without a browser: signals (+ answers) + profile → result
      --signals <signals.json> [--answers <answers.json>] --profile <p> [--out <dir>] [--json]
      --signals may be omitted when --answers is given (rubric-only scoring; confidence will be low)
      --out writes experience.json + experience.md; --json prints the full result
      exit code: 0 no gate failed · 1 at least one gate failed · 2 usage error

Scores are heuristics, not an accessibility audit. Timings are lab measurements in headless Chromium
(software rendering, no throttling), not field data. The profile never overrides accessibility or user control:
a failed gate caps the score at 69 (two or more: 59) whatever the profile.`;

const list = (v) => (v == null || v === true ? undefined : String(v).split(',').map((s) => s.trim()).filter(Boolean));
const str = (v, name) => { if (v == null) return undefined; if (v === true) throw new UserError(`--${name} needs a value`); return String(v); };

/** @param {string} file @param {string} what */
export function readJsonFile(file, what) {
  const p = path.resolve(file);
  if (!fs.existsSync(p)) throw new UserError(`${what} not found: ${p}`);
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { throw new UserError(`${what} is not valid JSON (${p}): ${/** @type {Error} */ (e).message}`); }
}

/** @param {unknown} v @param {boolean} required */
function profileArg(v, required) {
  if (v == null) { if (required) throw new UserError(`--profile is required: ${PROFILE_IDS.join(' | ')} (a score without its profile is meaningless)`); return undefined; }
  const p = str(v, 'profile')?.toLowerCase();
  if (!p || !PROFILE_IDS.includes(p)) throw new UserError(`--profile must be one of ${PROFILE_IDS.join(' | ')} (got "${v}")`);
  return p;
}

/** @param {string} dir @param {any} result */
export function writeExperience(dir, result) {
  fs.mkdirSync(dir, { recursive: true });
  const json = path.join(dir, 'experience.json');
  const md = path.join(dir, 'experience.md');
  fs.writeFileSync(json, JSON.stringify(result, null, 2) + '\n');
  fs.writeFileSync(md, renderExperienceMd(result));
  return { json, md };
}

/** @param {string[]} argv */
export async function main(argv) {
  const [sub, ...rest] = argv;
  const args = parseArgs(rest, { boolean: ['json', 'help'] });
  switch (sub) {
    case 'assess': {
      const { runAssessment } = await import('./assess.mjs');
      const res = await runAssessment({
        url: str(args.url, 'url'), serve: str(args.serve, 'serve'), routes: list(args.routes), out: str(args.out, 'out'),
        viewports: list(args.viewports), profile: profileArg(args.profile, false), answers: str(args.answers, 'answers'),
      });
      const o = res.result.overall;
      log.ok(`${res.result.profileTitle}: ${o.headline}`);
      log.info(`  report: ${res.files.md}`);
      if (args.json) console.log(JSON.stringify({ experience: res.files.json, experienceMd: res.files.md, signals: res.files.signals, profile: res.result.profile, profileSource: res.profileSource, overall: o, gates: res.result.gates.map((g) => ({ id: g.id, status: g.status, message: g.message })), topRecommendations: res.result.recommendations.slice(0, 5).map((r) => ({ priority: r.priority, dimension: r.dimension, what: r.what })) }, null, 2));
      else console.log(res.files.json);
      return o.gates.failed > 0 ? 1 : 0;
    }
    case 'rubric': {
      const profile = profileArg(args.profile, false) ?? 'expressive';
      const rubric = buildRubric(profile);
      console.log(args.json ? JSON.stringify(rubric, null, 2) : renderRubricText(rubric));
      return 0;
    }
    case 'score': {
      const profile = profileArg(args.profile, true);
      const signalsPath = str(args.signals, 'signals');
      const answersPath = str(args.answers, 'answers');
      if (!signalsPath && !answersPath) throw new UserError('score needs --signals <signals.json> (from `experience assess`) and/or --answers <answers.json>');
      const signalsDoc = signalsPath ? readJsonFile(signalsPath, 'Signals file') : null;
      const answersDoc = answersPath ? readJsonFile(answersPath, 'Answers file') : null;
      const result = scoreExperience({
        signals: signalsDoc, answers: answersDoc, profile: /** @type {string} */ (profile), now: new Date().toISOString(),
        inputs: { signals: signalsPath ? path.resolve(signalsPath) : null, answers: answersPath ? path.resolve(answersPath) : null },
        meta: { version: toolVersion(), target: signalsDoc?.target, coverage: signalsDoc?.coverage, limitations: signalsDoc?.limitations ?? (signalsDoc ? [] : ['No signals file: nothing was measured; the score rests on agent judgement only.']) },
      });
      for (const w of result.warnings) log.warn(w);
      const out = str(args.out, 'out');
      if (out) { const f = writeExperience(path.resolve(out), result); log.ok(`Written ${f.json} and ${f.md}`); }
      console.log(args.json ? JSON.stringify(result, null, 2) : renderSummaryText(result));
      return result.overall.gates.failed > 0 ? 1 : 0;
    }
    case undefined: case 'help':
      console.log(help);
      return 0;
    default:
      throw new UserError(`Unknown experience subcommand "${sub}".\n\n${help}`);
  }
}
