// @ts-check
/**
 * Studio³ Visual Director — `studio3 review <subcommand>`.
 * Loopback only; nothing is uploaded; no telemetry.
 */
import path from 'node:path';
import { parseArgs, toInt } from '../lib/args.mjs';
import { log, UserError } from '../lib/log.mjs';
import { writeJson } from './util.mjs';

export const help = `Studio³ Visual Director — browser-based review (capture, deterministic checks, 3D diagnostics, compare, loop)

Usage: studio3 review <subcommand> [options]

  run          Capture + check a site in headless Chromium and write pass-<n>/report.{json,md}
      --url <url> | --serve <dir>   target: a running site, or a static directory served on 127.0.0.1
      --routes /,/pricing           routes to review (default: path of --url; every .html file for --serve)
      --out <dir>                   review directory (default .studio3/review)
      --pass <n>                    pass number (default: next free pass)
      --viewports desktop,tablet,mobile   presets: desktop, laptop, tablet, mobile
      --states <file.json|json>     explicit states [{name, route?, steps:[{action, selector?, value?}]}]
                                    actions: click hover focus press fill scroll wait
      --budgets <file.json|json>    3D budgets {drawCallsPerFrame, trianglesPerFrame, textureBytes, geometryBytes}
      --video                       record a short video per route (needs Playwright ffmpeg; reported if unavailable)
      --no-3d                       skip 3D diagnostics        --no-a11y   skip axe-core
      --label <text>                free-text label stored in the report
      --json                        print {report, summary} JSON to stdout
      exit code: 0 no critical issues · 1 critical issues · >=2 tool error

  compare      Pixel-diff two passes and diff their issues
      --before <dir> --after <dir> [--out <dir>] [--threshold 0.1] [--json]
      --baseline <dir> --current <dir> --max-diff-ratio 0.01    visual-regression mode (exit 1 when exceeded)

  loop-status  Iteration state for the Improve → Retest loop (JSON)
      --out <dir> [--max-passes 3]

  summary      Write <out>/SUMMARY.md across passes (reads optional <out>/changes.json)
      --out <dir> [--json]

  inspect      Static project inspection, no browser (framework, styling, motion/3D libs, routes, specialty heuristic)
      --dir <project> [--out <dir>]

Measured results and the agent's subjective assessment are kept separate in report.md.`;

const list = (v) => (v == null || v === true ? undefined : String(v).split(',').map((s) => s.trim()).filter(Boolean));
const str = (v, name) => { if (v == null) return undefined; if (v === true) throw new UserError(`--${name} needs a value`); return String(v); };

/** @param {string[]} argv */
export async function main(argv) {
  const [sub, ...rest] = argv;
  const args = parseArgs(rest, { boolean: ['json', 'video', '3d', 'a11y', 'help'] });
  switch (sub) {
    case 'run': {
      const { runReview } = await import('./run.mjs');
      const pass = args.pass != null ? toInt(args.pass, NaN) : undefined;
      if (pass !== undefined && !(pass >= 1)) throw new UserError('--pass must be a positive integer');
      const res = await runReview({
        url: str(args.url, 'url'), serve: str(args.serve, 'serve'), routes: list(args.routes), out: str(args.out, 'out'), pass,
        viewports: list(args.viewports), states: args.states, budgets: args.budgets, video: args.video === true,
        threeD: args['3d'] !== false, a11y: args.a11y !== false, label: str(args.label, 'label'),
      });
      const s = res.report.summary;
      log.ok(`Pass ${res.report.pass}: ${s.critical} critical, ${s.major} major, ${s.minor} minor, ${s.info} info → ${res.reportMdPath}`);
      const skipped = res.report.checks.filter((c) => !c.ran && c.status !== 'not-applicable');
      if (skipped.length) log.warn(`Checks that did not run: ${skipped.map((c) => `${c.id} (${c.status})`).join(', ')}`);
      if (args.json) console.log(JSON.stringify({ report: res.reportPath, reportMd: res.reportMdPath, pass: res.report.pass, summary: s, checksSkipped: res.report.coverage.checksSkipped }, null, 2));
      else console.log(res.reportPath);
      return s.critical > 0 ? 1 : 0;
    }
    case 'compare': {
      const { runCompare } = await import('./compare.mjs');
      const before = str(args.before ?? args.baseline, 'before'); const after = str(args.after ?? args.current, 'after');
      if (!before || !after) throw new UserError('compare needs --before <dir> --after <dir> (or --baseline <dir> --current <dir>)');
      const maxDiff = args['max-diff-ratio'] != null ? Number(args['max-diff-ratio']) : null;
      if (maxDiff != null && !(maxDiff >= 0)) throw new UserError('--max-diff-ratio must be a number >= 0');
      const threshold = args.threshold != null ? Number(args.threshold) : 0.1;
      if (!(threshold >= 0 && threshold <= 1)) throw new UserError('--threshold must be between 0 and 1');
      const r = await runCompare({ before, after, out: str(args.out, 'out'), threshold, maxDiffRatio: maxDiff });
      log.ok(r.verdict);
      if (args.json) console.log(JSON.stringify({ compare: path.join(r.out, 'compare.json'), verdict: r.verdict, imagesCompared: r.images.length, imagesChanged: r.imagesChanged, maxChangedRatio: r.maxChangedRatio, issues: r.issues ? { resolved: r.issues.resolved.length, introduced: r.issues.introduced.length, remaining: r.issues.remaining.length } : null, regression: r.regression }, null, 2));
      else console.log(path.join(r.out, 'compare.json'));
      return r.regression && !r.regression.passed ? 1 : 0;
    }
    case 'loop-status': {
      const { loopStatus } = await import('./loop.mjs');
      const st = loopStatus({ out: str(args.out, 'out') ?? '.studio3/review', maxPasses: args['max-passes'] != null ? toInt(args['max-passes'], NaN) : 3 });
      console.log(JSON.stringify(st, null, 2));
      return 0;
    }
    case 'summary': {
      const { writeSummary } = await import('./loop.mjs');
      const r = writeSummary({ out: str(args.out, 'out') ?? '.studio3/review' });
      log.ok(`Summary written → ${r.file}`);
      console.log(args.json ? JSON.stringify(r, null, 2) : r.file);
      return 0;
    }
    case 'inspect': {
      const { inspectProject } = await import('./inspect.mjs');
      const dir = str(args.dir, 'dir') ?? args._[0] ?? '.';
      const result = inspectProject(dir);
      const out = path.resolve(str(args.out, 'out') ?? path.join(dir, '.studio3', 'review'));
      writeJson(path.join(out, 'inspect.json'), result);
      log.ok(`Inspection written → ${path.join(out, 'inspect.json')}`);
      console.log(JSON.stringify(result, null, 2));
      return 0;
    }
    case undefined: case 'help':
      console.log(help);
      return 0;
    default:
      throw new UserError(`Unknown review subcommand "${sub}".\n\n${help}`);
  }
}
