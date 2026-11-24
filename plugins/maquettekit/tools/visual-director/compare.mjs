// @ts-check
/** `review compare` — before/after pixel diff, issue delta, and the visual-regression primitive. */
import fs from 'node:fs';
import path from 'node:path';
import { UserError } from '../lib/log.mjs';
import { TOOL, toolVersion, loadPngTools, diffPngBuffers, listFiles, readJson, writeJson, round, fingerprint, summarize } from './util.mjs';

const fpOf = (i) => i.fingerprint ?? fingerprint(i);

/**
 * Issue delta between two reports, matched by stable fingerprint (check + route + viewport + selector [+ key]).
 * @param {any} before @param {any} after
 */
export function diffIssues(before, after) {
  const b = new Map((before?.issues ?? []).map((i) => [fpOf(i), i]));
  const a = new Map((after?.issues ?? []).map((i) => [fpOf(i), i]));
  const slim = (i) => ({ id: i.id, check: i.check, severity: i.severity, route: i.route, viewport: i.viewport, selector: i.selector ?? null, message: i.message });
  return {
    resolved: [...b].filter(([k]) => !a.has(k)).map(([, i]) => slim(i)),
    introduced: [...a].filter(([k]) => !b.has(k)).map(([, i]) => slim(i)),
    remaining: [...a].filter(([k]) => b.has(k)).map(([, i]) => slim(i)),
  };
}

/**
 * @param {{ before: string, after: string, out?: string, threshold?: number, maxDiffRatio?: number | null, baselineMode?: boolean }} opts
 */
export async function runCompare(opts) {
  const before = path.resolve(opts.before); const after = path.resolve(opts.after);
  for (const d of [before, after]) if (!fs.existsSync(d) || !fs.statSync(d).isDirectory()) throw new UserError(`compare: "${d}" is not a directory`);
  const out = path.resolve(opts.out ?? path.join(after, 'compare'));
  const threshold = opts.threshold ?? 0.1;
  const tools = await loadPngTools();
  const isShot = (f) => f.endsWith('.png') && !f.startsWith('compare/') && !/(^|\/)(diff|before-after)\//.test(f);
  const bFiles = listFiles(before, isShot).filter((f) => !path.resolve(before, f).startsWith(out + path.sep));
  const aFiles = listFiles(after, isShot).filter((f) => !path.resolve(after, f).startsWith(out + path.sep));
  const aSet = new Set(aFiles); const bSet = new Set(bFiles);
  fs.rmSync(path.join(out, 'diff'), { recursive: true, force: true });
  fs.rmSync(path.join(out, 'before-after'), { recursive: true, force: true });
  /** @type {any[]} */ const images = [];
  for (const f of bFiles.filter((x) => aSet.has(x))) {
    try {
      const d = diffPngBuffers(tools, fs.readFileSync(path.join(before, f)), fs.readFileSync(path.join(after, f)), threshold);
      const entry = { file: f, width: d.width, height: d.height, changedPixels: d.changedPixels, changedRatio: round(d.ratio, 6), sizeChanged: d.sizeChanged, sizes: { before: d.sizes.a, after: d.sizes.b }, diff: null, composite: null };
      if (d.changedPixels > 0 || d.sizeChanged) {
        const diffPath = path.join(out, 'diff', f);
        fs.mkdirSync(path.dirname(diffPath), { recursive: true });
        fs.writeFileSync(diffPath, tools.PNG.sync.write(d.diff));
        const gap = 16;
        const comp = new tools.PNG({ width: d.width * 2 + gap, height: d.height });
        comp.data.fill(255);
        for (let x = d.width; x < d.width + gap; x++) for (let y = 0; y < d.height; y++) { const o = (y * comp.width + x) * 4; comp.data[o] = 40; comp.data[o + 1] = 40; comp.data[o + 2] = 40; comp.data[o + 3] = 255; }
        tools.PNG.bitblt(d.a, comp, 0, 0, d.width, d.height, 0, 0);
        tools.PNG.bitblt(d.b, comp, 0, 0, d.width, d.height, d.width + gap, 0);
        const compPath = path.join(out, 'before-after', f);
        fs.mkdirSync(path.dirname(compPath), { recursive: true });
        fs.writeFileSync(compPath, tools.PNG.sync.write(comp));
        entry.diff = path.relative(out, diffPath).split(path.sep).join('/');
        entry.composite = path.relative(out, compPath).split(path.sep).join('/');
      }
      images.push(entry);
    } catch (err) {
      images.push({ file: f, error: String(/** @type {any} */ (err).message).split('\n')[0], changedRatio: null });
    }
  }
  const onlyBefore = bFiles.filter((f) => !aSet.has(f));
  const onlyAfter = aFiles.filter((f) => !bSet.has(f));
  const rb = readJson(path.join(before, 'report.json')); const ra = readJson(path.join(after, 'report.json'));
  const issues = rb && ra ? diffIssues(rb, ra) : null;
  const changed = images.filter((i) => i.changedPixels > 0 || i.sizeChanged);
  const maxRatio = images.reduce((m, i) => Math.max(m, i.changedRatio ?? 0), 0);
  const limit = opts.maxDiffRatio ?? null;
  const exceeding = limit == null ? [] : images.filter((i) => i.changedRatio == null || i.changedRatio > limit).map((i) => i.file);
  const missing = limit == null ? [] : onlyBefore;
  const regression = limit == null ? null : { maxDiffRatio: limit, exceeding, missingInCurrent: missing, passed: exceeding.length === 0 && missing.length === 0 && images.length > 0 };

  let verdict;
  if (regression) verdict = regression.passed ? `Visual regression check passed: ${images.length} image(s) within ${limit} changed-pixel ratio.` : images.length === 0 ? 'Visual regression check failed: no matching screenshots to compare.' : `Visual regression check FAILED: ${exceeding.length} image(s) exceed ${limit} changed-pixel ratio${missing.length ? `, ${missing.length} baseline image(s) missing in current` : ''}.`;
  else if (issues) {
    const sb = summarize(rb.issues); const sa = summarize(ra.issues);
    const dir = issues.resolved.length > issues.introduced.length ? 'Improved' : issues.introduced.length > issues.resolved.length ? 'Regressed' : issues.resolved.length ? 'Mixed' : 'Unchanged';
    verdict = `${dir}: ${issues.resolved.length} issue(s) resolved, ${issues.introduced.length} introduced, ${issues.remaining.length} remaining; critical ${sb.critical} → ${sa.critical}, major ${sb.major} → ${sa.major}; ${changed.length} of ${images.length} screenshot(s) changed.`;
  } else verdict = `${changed.length} of ${images.length} screenshot(s) changed (no report.json in both directories, so no issue delta).`;

  const result = {
    tool: TOOL, version: toolVersion(), generatedAt: new Date().toISOString(), before, after, out, threshold,
    images, onlyBefore, onlyAfter, maxChangedRatio: maxRatio, imagesChanged: changed.length,
    issues, summaryBefore: rb ? summarize(rb.issues) : null, summaryAfter: ra ? summarize(ra.issues) : null,
    regression, verdict,
  };
  writeJson(path.join(out, 'compare.json'), result);
  fs.writeFileSync(path.join(out, 'compare.md'), renderCompareMd(result));
  return result;
}

/** @param {any} r */
export function renderCompareMd(r) {
  const L = ['# Maquettekit Visual Director — comparison', '', `- Before: \`${r.before}\``, `- After: \`${r.after}\``, `- Pixel threshold: ${r.threshold}`, '', `**${r.verdict}**`, ''];
  if (r.issues) {
    L.push('## Issues (measured)', '', '| | Count |', '|---|---|', `| Resolved | ${r.issues.resolved.length} |`, `| Introduced | ${r.issues.introduced.length} |`, `| Remaining | ${r.issues.remaining.length} |`, '');
    for (const [title, list] of [['Resolved', r.issues.resolved], ['Introduced', r.issues.introduced], ['Remaining', r.issues.remaining]]) {
      if (!list.length) continue;
      L.push(`### ${title}`, '');
      for (const i of list.slice(0, 60)) L.push(`- [${i.severity}] **${i.check}** ${i.route ?? ''} @ ${i.viewport ?? 'n/a'}${i.selector ? ` \`${i.selector}\`` : ''} — ${i.message}`);
      if (list.length > 60) L.push(`- … ${list.length - 60} more (see compare.json)`);
      L.push('');
    }
  }
  L.push('## Screenshots', '', '| Screenshot | Changed pixels | Size changed | Before / after | Diff |', '|---|---|---|---|---|');
  for (const i of r.images) L.push(`| ${i.file} | ${i.error ? `error: ${i.error}` : `${Math.round(i.changedRatio * 10000) / 100}%`} | ${i.sizeChanged ? `yes (${i.sizes.before.width}×${i.sizes.before.height} → ${i.sizes.after.width}×${i.sizes.after.height})` : 'no'} | ${i.composite ? `[composite](${i.composite})` : ''} | ${i.diff ? `[diff](${i.diff})` : ''} |`);
  L.push('');
  if (r.onlyBefore.length) L.push(`Only in before: ${r.onlyBefore.join(', ')}`, '');
  if (r.onlyAfter.length) L.push(`Only in after: ${r.onlyAfter.join(', ')}`, '');
  L.push('_Images of different sizes are padded with white to the larger size before diffing. Changed-pixel ratios are measured; whether a change is an improvement is a judgement for the reviewer._', '');
  return L.join('\n');
}
