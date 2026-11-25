// @ts-check
/**
 * `maquettekit check` — the verify step in one command. Runs design-file validation, the design-token lint, the
 * Visual Director review and the Experience Lab assessment, and merges their findings into one ranked fix list
 * (`check.md` as a checklist, `check.json` for tools). A step that cannot run (no browser, no design file, a
 * non-local URL for the Experience Lab) is reported as skipped or unavailable with the reason — never as passed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from '../lib/args.mjs';
import { log, UserError } from '../lib/log.mjs';
import { lintProject } from '../design-intelligence/lint.mjs';
import { validateDesign } from '../design-intelligence/validate.mjs';
import { guidanceFor } from '../visual-director/guidance.mjs';

export const help = `Maquettekit check — design validation, token lint, browser review and experience assessment in one run,
merged into one ranked fix list.

Usage: maquettekit check [--url <url> | --serve <dir>] [options]

  --url <url> | --serve <dir>   page(s) to review in a browser; without either, only the design file and the
                                token lint run (no browser)
  --routes /,/pricing           routes (default: the --url path, or every .html file for --serve)
  --dir <project>               source to lint and where maquettekit.design.json lives (default .)
  --profile essential|expressive|immersive   Experience Lab profile (default: from the design file, else expressive)
  --viewports desktop,mobile    review viewports (default desktop,tablet,mobile; experience uses mobile,desktop)
  --out <dir>                   where check.md / check.json go (default .maquettekit/check); the review keeps its
                                passes in .maquettekit/review so "review loop-status" still works
  --no-review --no-experience --no-lint --no-design --no-3d   skip a step (reported as skipped)
  --fail-on critical|major|minor|none   exit 1 when an item at or above this severity remains (default major)
  --json                        print the result JSON to stdout

Exit codes: 0 nothing at or above --fail-on, 1 items remain, 2 usage error.`;

const SEV = { critical: 0, major: 1, minor: 2, info: 3 };
const SOURCE_ORDER = { review: 0, experience: 1, design: 2, lint: 3 };

/**
 * @param {{ url?: string, serve?: string, routes?: string[], dir?: string, profile?: string, viewports?: string[], out?: string,
 *   reviewOut?: string, experienceOut?: string, review?: boolean, experience?: boolean, lint?: boolean, design?: boolean, threeD?: boolean,
 *   now?: string }} opts
 */
export async function runCheck(opts) {
  if (opts.url && opts.serve) throw new UserError('Use either --url or --serve, not both.');
  const dir = path.resolve(opts.dir ?? '.');
  if (!fs.existsSync(dir)) throw new UserError(`--dir: "${dir}" does not exist`);
  const outDir = path.resolve(opts.out ?? '.maquettekit/check');
  const target = opts.url ?? (opts.serve ? path.resolve(opts.serve) : null);
  /** @type {any[]} */ const items = [];
  /** @type {Record<string, any>} */ const steps = {};
  const designPath = path.join(dir, 'maquettekit.design.json');
  /** @type {any} */ let designDoc = null;

  // ---- design file -----------------------------------------------------------------------------------------
  if (opts.design === false) steps.design = { status: 'skipped', reason: 'disabled with --no-design' };
  else if (!fs.existsSync(designPath)) steps.design = { status: 'skipped', reason: `no maquettekit.design.json in ${dir} (create one with studio-design-system / "maquettekit design generate")` };
  else {
    try {
      designDoc = JSON.parse(fs.readFileSync(designPath, 'utf8'));
      const v = validateDesign(designDoc);
      steps.design = { status: v.valid ? 'passed' : 'failed', errors: v.errors.length };
      for (const e of v.errors) items.push({ source: 'design', severity: 'major', check: `design-${e.kind}`, title: `${e.path || '(root)'}: ${e.message}`, where: 'maquettekit.design.json', fix: 'Fix it through the design file\'s "overrides" (or regenerate with "maquettekit design generate --merge"), then re-export the tokens; never hand-edit generated sections.' });
    } catch (err) {
      steps.design = { status: 'failed', reason: `maquettekit.design.json is not valid JSON: ${/** @type {Error} */ (err).message}` };
      items.push({ source: 'design', severity: 'major', check: 'design-json', title: steps.design.reason, where: 'maquettekit.design.json', fix: 'Restore the file from version control or regenerate it.' });
    }
  }

  // ---- token lint ------------------------------------------------------------------------------------------
  if (opts.lint === false) steps.lint = { status: 'skipped', reason: 'disabled with --no-lint' };
  else {
    const r = lintProject({ dir });
    const judged = 5 - r.notJudged.length;
    steps.lint = { status: !judged ? 'not-applicable' : r.summary.major + r.summary.minor ? 'failed' : 'passed', summary: r.summary, notJudged: r.notJudged, tokenSources: r.tokenSources, filesScanned: r.filesScanned,
      ...(!judged ? { reason: 'no design tokens found in the design file or the project, so nothing could be judged' } : {}) };
    // one item per rule+value+file, listing the lines
    const groups = new Map();
    for (const f of r.findings) {
      if (f.severity === 'info') continue;
      const k = `${f.rule}|${f.file}|${f.value}`;
      if (!groups.has(k)) groups.set(k, { source: 'lint', severity: f.severity, check: f.rule, title: f.message, where: f.file, lines: [], fix: f.suggestion ? `Use var(${f.suggestion}) (or the matching utility) instead of the literal.` : 'Replace the literal with the matching token, or add a token for it to the design file\'s overrides if it is a deliberate new value.' });
      groups.get(k).lines.push(f.line);
    }
    for (const g of groups.values()) { g.where = `${g.where}:${g.lines.slice(0, 6).join(',')}${g.lines.length > 6 ? ',…' : ''}`; delete g.lines; items.push(g); }
  }

  // ---- browser review --------------------------------------------------------------------------------------
  const reviewOut = path.resolve(opts.reviewOut ?? '.maquettekit/review');
  if (!target) steps.review = { status: 'skipped', reason: 'no --url or --serve given' };
  else if (opts.review === false) steps.review = { status: 'skipped', reason: 'disabled with --no-review' };
  else {
    try {
      const { runReview } = await import('../visual-director/run.mjs');
      const { loopStatus } = await import('../visual-director/loop.mjs');
      const { report, outDir: passDir } = await runReview({ url: opts.url, serve: opts.serve, routes: opts.routes, out: reviewOut, viewports: opts.viewports, threeD: opts.threeD, label: 'check' });
      const loop = loopStatus({ out: reviewOut });
      steps.review = { status: report.summary.critical + report.summary.major ? 'failed' : 'passed', summary: report.summary, report: path.join(passDir, 'report.md'), pass: loop.latestPass, loop: { passesDone: loop.passesDone, maxPasses: loop.maxPasses, stop: loop.stop, nextAction: loop.nextAction } };
      const groups = new Map();
      for (const i of report.issues) {
        if (i.severity === 'info') continue;
        const k = [i.check, i.route, i.selector ?? '', i.key ?? ''].join('|');
        if (!groups.has(k)) groups.set(k, { source: 'review', severity: i.severity, check: i.check, title: i.message, route: i.route, selector: i.selector ?? null, viewports: [], fix: guidanceFor(i.check) });
        const g = groups.get(k);
        if (SEV[i.severity] < SEV[g.severity]) g.severity = i.severity;
        if (i.viewport && !g.viewports.includes(i.viewport)) g.viewports.push(i.viewport);
      }
      for (const g of groups.values()) { g.where = `${g.route}${g.viewports.length ? ` (${g.viewports.join(', ')})` : ''}${g.selector ? ` ${g.selector}` : ''}`; items.push(g); }
    } catch (err) {
      const e = /** @type {any} */ (err);
      if (e instanceof UserError && e.exitCode === 3) steps.review = { status: 'unavailable', reason: e.message.split('\n')[0], remedy: e.message.split('\n').slice(1).join(' ').trim() };
      else throw err;
    }
  }

  // ---- experience assessment -------------------------------------------------------------------------------
  const local = (u) => { try { return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(new URL(u).hostname); } catch { return false; } };
  if (!target) steps.experience = { status: 'skipped', reason: 'no --url or --serve given' };
  else if (opts.experience === false) steps.experience = { status: 'skipped', reason: 'disabled with --no-experience' };
  else if (opts.url && !local(opts.url)) steps.experience = { status: 'skipped', reason: 'Experience Lab only runs against a local server (it clicks controls and submits forms)' };
  else {
    try {
      const { runAssessment } = await import('../experience-lab/assess.mjs');
      const profile = opts.profile ?? designDoc?.motion?.profile ?? undefined;
      const res = await runAssessment({ url: opts.url, serve: opts.serve, routes: opts.routes, out: path.resolve(opts.experienceOut ?? '.maquettekit/experience'), profile });
      const o = res.result.overall;
      steps.experience = { status: o.gates.failed ? 'failed' : 'passed', profile: res.result.profile, headline: o.headline, score: o.score ?? null, grade: o.grade ?? null, gatesFailed: o.gates.failed, report: res.files.md };
      for (const rec of res.result.recommendations) {
        if (rec.priority !== 'P0' && rec.priority !== 'P1') continue;
        items.push({ source: 'experience', severity: rec.priority === 'P0' ? 'major' : 'minor', check: rec.signal ?? rec.id, title: rec.what, where: rec.dimension ?? 'site', fix: [rec.how, rec.expectedEffect?.note].filter(Boolean).join(' ') || rec.why || '' });
      }
    } catch (err) {
      const e = /** @type {any} */ (err);
      if (e instanceof UserError && e.exitCode === 3) steps.experience = { status: 'unavailable', reason: e.message.split('\n')[0], remedy: e.message.split('\n').slice(1).join(' ').trim() };
      else throw err;
    }
  }

  items.sort((a, b) => SEV[a.severity] - SEV[b.severity] || SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source] || String(a.where).localeCompare(String(b.where)));
  items.forEach((it, n) => { it.n = n + 1; });
  const summary = { critical: 0, major: 0, minor: 0 };
  for (const it of items) summary[it.severity]++;
  const result = { tool: 'maquettekit-check', generatedAt: opts.now ?? new Date().toISOString(), target: target ?? null, dir, steps, summary, items,
    ran: Object.entries(steps).filter(([, s]) => ['passed', 'failed'].includes(s.status)).map(([k]) => k),
    notRun: Object.entries(steps).filter(([, s]) => !['passed', 'failed'].includes(s.status)).map(([k, s]) => ({ step: k, status: s.status, reason: s.reason })) };
  fs.mkdirSync(outDir, { recursive: true });
  const files = { json: path.join(outDir, 'check.json'), md: path.join(outDir, 'check.md') };
  fs.writeFileSync(files.json, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(files.md, renderCheckMd(result));
  return { result, files };
}

/** @param {any} r */
export function renderCheckMd(r) {
  const stepLine = (name, s) => {
    let detail = s.reason ?? '';
    if (name === 'design' && s.status !== 'skipped' && !s.reason) detail = s.errors ? `${s.errors} validation error(s)` : 'valid';
    if (name === 'lint' && s.summary) detail = `${s.summary.major} major, ${s.summary.minor} minor in ${s.filesScanned} files${s.notJudged?.length ? `; not judged: ${s.notJudged.join(', ')}` : ''}`;
    if (name === 'review' && s.summary) detail = `pass ${s.pass} of ${s.loop.maxPasses}: ${s.summary.critical} critical, ${s.summary.major} major, ${s.summary.minor} minor${s.loop.stop && s.loop.passesDone >= s.loop.maxPasses ? ' — review budget used up: report what remains instead of another round' : ''} (${path.basename(path.dirname(s.report))}/report.md)`;
    if (name === 'experience' && s.headline) detail = `${s.profile}: ${s.headline}`;
    return `| ${name} | ${s.status} | ${String(detail).replace(/\|/g, '\\|')} |`;
  };
  const L = [`# Maquettekit check`, '', `${r.generatedAt} · target: ${r.target ?? 'source only (no browser)'} · project: \`${r.dir}\``, '',
    '| Step | Status | Result |', '| - | - | - |', ...Object.entries(r.steps).map(([k, s]) => stepLine(k, s)), '',
    `**${r.summary.critical} critical, ${r.summary.major} major, ${r.summary.minor} minor.** Fix in this order, then run \`maquettekit check\` again (at most three rounds; the review keeps its passes).`, ''];
  for (const sev of ['critical', 'major', 'minor']) {
    const list = r.items.filter((i) => i.severity === sev);
    if (!list.length) continue;
    L.push(`## ${sev[0].toUpperCase()}${sev.slice(1)}`, '');
    for (const i of list) L.push(`- [ ] **${i.n}.** ${i.source} · \`${i.check}\` · ${i.where} — ${i.title}`, `  Fix: ${i.fix}`);
    L.push('');
  }
  if (r.notRun.length) { L.push('## Not run', ''); for (const s of r.notRun) L.push(`- ${s.step}: ${s.status}${s.reason ? ` — ${s.reason}` : ''}`); L.push(''); }
  L.push('Measured results only. Subjective quality (composition, typography, hierarchy) is not judged here; use the review report\'s agent-led section.');
  return `${L.join('\n')}\n`;
}

/** @param {string[]} argv */
export async function main(argv) {
  const a = parseArgs(argv, { boolean: ['json', 'review', 'experience', 'lint', 'design', '3d', 'help'] });
  const list = (v) => (typeof v === 'string' ? v.split(',').map((x) => x.trim()).filter(Boolean) : undefined);
  const str = (v, name) => { if (v === undefined) return undefined; if (typeof v !== 'string') throw new UserError(`--${name} needs a value`); return v; };
  const failOn = str(a['fail-on'], 'fail-on') ?? 'major';
  if (!['critical', 'major', 'minor', 'none'].includes(failOn)) throw new UserError('--fail-on must be critical, major, minor or none');
  const profile = str(a.profile, 'profile');
  if (profile && !['essential', 'expressive', 'immersive'].includes(profile)) throw new UserError('--profile must be essential, expressive or immersive');
  const { result, files } = await runCheck({
    url: str(a.url, 'url'), serve: str(a.serve, 'serve'), routes: list(a.routes), dir: str(a.dir, 'dir'), profile, viewports: list(a.viewports), out: str(a.out, 'out'),
    review: a.review, experience: a.experience, lint: a.lint, design: a.design, threeD: a['3d'],
  });
  if (a.json) console.log(JSON.stringify(result, null, 2));
  for (const [k, s] of Object.entries(result.steps)) log[s.status === 'failed' ? 'warn' : 'info'](`  ${k.padEnd(10)} ${s.status}${s.reason ? ` — ${s.reason}` : ''}`);
  for (const i of result.items.slice(0, 12)) log.info(`  ${String(i.n).padStart(2)}. ${i.severity.padEnd(8)} ${i.source.padEnd(10)} ${i.where} — ${i.title}`);
  if (result.items.length > 12) log.info(`  … ${result.items.length - 12} more in ${files.md}`);
  log.ok(`${result.summary.critical} critical, ${result.summary.major} major, ${result.summary.minor} minor → ${files.md}`);
  if (!a.json) console.log(files.md);
  const limit = failOn === 'none' ? -1 : SEV[failOn];
  return result.items.some((i) => SEV[i.severity] <= limit) ? 1 : 0;
}
