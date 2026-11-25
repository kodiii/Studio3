// @ts-check
/** `review run` — orchestrates capture, deterministic checks and 3D diagnostics. */
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser, newContext, gotoStable, VIEWPORTS } from '../lib/browser.mjs';
import { serveStatic } from '../lib/static-server.mjs';
import { log, UserError } from '../lib/log.mjs';
import { CHECKS, CHECK_BY_ID } from './guidance.mjs';
import { TOOL, toolVersion, fingerprint, issueId, summarize, writeJson, readJson, listPasses, listFiles, SEVERITIES } from './util.mjs';
import { installPageHelpers } from './page/helpers.mjs';
import { captureScreenshots, captureFrames, captureStates, captureVideo, scrollThrough, FRAME_OFFSETS_MS, SCROLL_THROUGH } from './capture.mjs';
import { runDomChecks } from './checks/dom.mjs';
import { attachWatchers, reportAssetsAndConsole } from './checks/assets.mjs';
import { runAxe } from './checks/a11y.mjs';
import { runKeyboard } from './checks/keyboard.mjs';
import { runInteractionChecks } from './checks/interaction.mjs';
import { collectMotion, reportMotion } from './checks/motion.mjs';
import { instrument3D, pageSnapshot3D } from './three-d/instrument.mjs';
import { run3DDiagnostics, runInteraction, markAll3D, noGpuBrowserFactory, DEFAULT_BUDGETS, THREE_D_CHECKS } from './three-d/diagnostics.mjs';
import { renderReportMd } from './report-md.mjs';

const STATUS_ORDER = ['failed', 'limited', 'passed', 'skipped', 'unavailable', 'not-applicable'];

/** Collects issues, per-scope check runs and limitations. */
export class Collector {
  constructor() {
    /** @type {any[]} */ this.issues = [];
    /** @type {any[]} */ this.runs = [];
    /** @type {Set<string>} */ this.limitations = new Set();
    /** @type {Set<string>} */ this._ids = new Set();
  }
  /** @param {any} i */
  issue(i) {
    const fp = fingerprint(i);
    if (this._ids.has(fp)) return;
    this._ids.add(fp);
    const { check, severity, route, viewport, message, selector, key, evidence } = i;
    this.issues.push({ id: issueId(fp), check, severity, route: route ?? null, viewport: viewport ?? null, message, ...(selector ? { selector } : {}), evidence: evidence ?? {}, measured: true, fingerprint: fp, ...(key ? { key } : {}) });
  }
  /** @param {string} check @param {any} r */
  run(check, r) {
    const ran = r.ran ?? !['skipped', 'not-applicable'].includes(r.status);
    this.runs.push({ check, route: r.route ?? null, viewport: r.viewport ?? null, status: r.status, ran, ...(r.reason ? { reason: r.reason } : {}), ...(r.details ? { details: r.details } : {}) });
  }
  /** @param {string} check @param {{route?:string, viewport?:string}} scope */
  hasRun(check, scope) { return this.runs.some((r) => r.check === check && r.route === (scope.route ?? null) && r.viewport === (scope.viewport ?? null)); }
  /** @param {string} text */
  limit(text) { this.limitations.add(text); }

  /** One record per catalogue check, aggregated over routes × viewports. */
  aggregate() {
    return CHECKS.map((c) => {
      const runs = this.runs.filter((r) => r.check === c.id);
      const issues = this.issues.filter((i) => i.check === c.id).length;
      if (!runs.length) return { id: c.id, title: c.title, category: c.category, kind: c.kind, status: 'skipped', ran: false, reason: 'not scheduled in this run', issues, runs: [] };
      const ran = runs.some((r) => r.ran);
      const st = new Set(runs.map((r) => r.status));
      /** @type {string} */ let status;
      if (st.has('failed')) status = 'failed';
      else if (st.has('passed')) status = st.has('limited') || st.has('skipped') || st.has('unavailable') ? 'limited' : 'passed';
      else status = STATUS_ORDER.find((s) => st.has(s)) ?? 'skipped';
      const reasons = [...new Set(runs.filter((r) => r.reason && (status !== 'passed')).filter((r) => r.status !== 'not-applicable' || status === 'not-applicable').map((r) => r.reason))];
      return { id: c.id, title: c.title, category: c.category, kind: c.kind, status, ran, ...(reasons.length ? { reason: reasons.slice(0, 3).join('; ') } : {}), issues, runs };
    });
  }
}

/** @param {string} dir static dir → routes for every .html file (max depth 2, max 8) */
export function discoverStaticRoutes(dir) {
  const files = listFiles(dir, (f) => f.endsWith('.html') && f.split('/').length <= 2 && !f.split('/').some((p) => p.startsWith('.') || p === 'node_modules')).slice(0, 40);
  const routes = files.map((f) => (f === 'index.html' ? '/' : f.endsWith('/index.html') ? '/' + f.slice(0, -'index.html'.length) : '/' + f));
  routes.sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));
  return routes.slice(0, 8);
}

/** @param {any} v @param {string} what */
function loadJsonOption(v, what) {
  if (v == null || v === true) return null;
  const s = String(v).trim();
  try { return JSON.parse(s.startsWith('{') || s.startsWith('[') ? s : fs.readFileSync(path.resolve(s), 'utf8')); }
  catch (err) { throw new UserError(`Could not read ${what} from "${s}": ${/** @type {any} */ (err).message}`); }
}

/**
 * @typedef {object} RunOptions
 * @property {string} [url] @property {string} [serve] @property {string[]} [routes] @property {string} [out]
 * @property {number} [pass] @property {string[]} [viewports] @property {any} [states] @property {boolean} [video]
 * @property {boolean} [threeD] @property {boolean} [a11y] @property {string} [label] @property {any} [budgets]
 */

/**
 * Run a review pass. Returns the report object and where it was written.
 * @param {RunOptions} opts
 */
export async function runReview(opts) {
  if (!opts.url && !opts.serve) throw new UserError('review run needs a target: --url <url> or --serve <dir>');
  if (opts.url && opts.serve) throw new UserError('Use either --url or --serve, not both.');
  const outRoot = path.resolve(opts.out ?? '.maquettekit/review');
  const passNo = opts.pass ?? ((listPasses(outRoot).at(-1) ?? 0) + 1);
  if (!Number.isInteger(passNo) || passNo < 1) throw new UserError('--pass must be a positive integer');
  const outDir = path.join(outRoot, `pass-${passNo}`);
  const viewports = opts.viewports?.length ? opts.viewports : ['desktop', 'tablet', 'mobile'];
  for (const v of viewports) if (!VIEWPORTS[v]) throw new UserError(`Unknown viewport "${v}". Known: ${Object.keys(VIEWPORTS).join(', ')}`);
  const explicitStates = loadJsonOption(opts.states, '--states') ?? [];
  if (!Array.isArray(explicitStates)) throw new UserError('--states must be a JSON array of {name, route?, steps[]}');
  const userBudgets = loadJsonOption(opts.budgets, '--budgets');
  const budgets = { ...DEFAULT_BUDGETS, ...(userBudgets ?? {}) };
  const budgetsSource = userBudgets ? 'user-configured' : 'default';
  const do3D = opts.threeD !== false;

  /** @type {{ close: () => Promise<void>, url: string } | null} */ let server = null;
  let baseUrl; let routes = opts.routes?.length ? opts.routes : null;
  if (opts.serve) {
    const dir = path.resolve(opts.serve);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new UserError(`--serve: "${dir}" is not a directory`);
    server = await serveStatic(dir);
    baseUrl = server.url;
    routes ??= discoverStaticRoutes(dir);
    if (!routes.length) routes = ['/'];
  } else {
    let u;
    try { u = new URL(String(opts.url)); } catch { throw new UserError(`--url: "${opts.url}" is not a valid URL`); }
    if (!routes) { routes = [(u.pathname || '/') + u.search]; }
    baseUrl = u.origin;
  }
  routes = routes.map((r) => (r.startsWith('/') ? r : '/' + r));
  const urlFor = (route) => baseUrl + route;

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const col = new Collector();
  /** @type {any[]} */ const motionRoutes = [];
  /** @type {any[]} */ const threeDRoutes = [];
  /** @type {any[]} */ const stateLog = [];
  /** @type {any[]} */ const frameLog = [];
  /** @type {string[]} */ const screenshots = [];
  /** @type {any[]} */ const scrollLog = [];
  /** @type {any} */ let video = null;
  const noGpu = noGpuBrowserFactory();
  const primaryVp = viewports.find((v) => !VIEWPORTS[v].hasTouch) ?? viewports[0];
  const firstTouchVp = viewports.find((v) => VIEWPORTS[v].hasTouch) ?? null;
  const frameVp = viewports.includes('desktop') ? 'desktop' : primaryVp;

  const browser = await launchBrowser();
  try {
    for (const route of routes) {
      const url = urlFor(route);
      /** @type {any} */ let threeDEntry = null;
      for (const viewport of viewports) {
        const vp = VIEWPORTS[viewport];
        const base = { route, viewport };
        log.step(`${route} @ ${viewport}`);
        // ================= normal motion =================
        const context = await newContext(browser, /** @type {any} */ (viewport));
        await context.addInitScript(installPageHelpers);
        if (do3D) await context.addInitScript(instrument3D, { forceNoGL: false });
        /** @type {any} */ let normalMotion = null;
        try {
          const page = await context.newPage();
          const watch = attachWatchers(page);
          let response;
          if (viewport === frameVp) {
            const f = await captureFrames(page, url, { outDir, route, viewport });
            response = f.response; frameLog.push({ route, viewport, frames: f.frames });
            await page.evaluate(async () => { try { await document.fonts.ready; } catch { /* ignore */ } }).catch(() => {});
          } else {
            response = await gotoStable(page, url);
          }
          await page.waitForTimeout(300);
          if (response && response.status() >= 400) col.limit(`${route} responded with HTTP ${response.status()}; checks ran against the error page.`);
          screenshots.push(...await captureScreenshots(page, { outDir, route, viewport, mode: 'normal' }));
          // scroll-linked reveals fire before geometry and contrast are measured (runDomChecks then settles)
          scrollLog.push({ route, viewport, ...await scrollThrough(page) });
          const dom = await runDomChecks(page, { route, viewport, touch: !!vp.hasTouch, emitViewportMeta: firstTouchVp ? viewport === firstTouchVp : viewport === viewports[0], col });
          await runAxe(page, { route, viewport, col, disabled: opts.a11y === false });
          normalMotion = await collectMotion(page, { sampleRaf: viewport === primaryVp });
          await runInteractionChecks(page, { route, viewport, touch: !!vp.hasTouch, col });
          if (viewport === primaryVp) await runKeyboard(page, { route, viewport, col });
          const explicit = explicitStates.filter((s) => !s.route || s.route === route);
          const states = await captureStates(page, url, { outDir, route, viewport, touch: !!vp.hasTouch, col, explicit, watch });
          stateLog.push(...states.map((s) => ({ route, viewport, ...s })));
          reportAssetsAndConsole(watch, dom, { route, viewport, col });

          // ---- 3D ----
          if (!do3D) { if (viewport === primaryVp) markAll3D(col, base, 'skipped', 'disabled by --no-3d'); }
          else if (viewport === primaryVp) {
            await page.close().catch(() => {}); // keep the measured page alone in the context
            threeDEntry = await run3DDiagnostics(context, url, { route, viewport, vp, col, budgets, budgetsSource, outDir, getNoGpuBrowser: noGpu.get });
            if (threeDEntry.fallback?.screenshot) screenshots.push(threeDEntry.fallback.screenshot);
          } else if (viewport === firstTouchVp && threeDEntry?.applicable && threeDEntry.contexts?.obtained) {
            await gotoStable(page, url, { settleMs: 400 });
            if (await page.evaluate(pageSnapshot3D)) await runInteraction(page, watch, { col, route, viewport, vp }, threeDEntry, true);
          }
        } finally {
          await context.close().catch(() => {});
        }
        // ================= reduced motion =================
        const rctx = await newContext(browser, /** @type {any} */ (viewport), { reducedMotion: true });
        await rctx.addInitScript(installPageHelpers);
        try {
          const page = await rctx.newPage();
          await gotoStable(page, url, { settleMs: 300 });
          screenshots.push(...await captureScreenshots(page, { outDir, route, viewport, mode: 'reduced' }));
          const reducedMotion = await collectMotion(page);
          if (normalMotion) {
            reportMotion(normalMotion, reducedMotion, { route, viewport, col });
            motionRoutes.push({ route, viewport, normal: strip(normalMotion), reduced: strip(reducedMotion), raf: normalMotion.raf });
          }
        } finally {
          await rctx.close().catch(() => {});
        }
      }
      if (threeDEntry?.applicable) threeDRoutes.push(threeDEntry);
    }
    if (opts.video) video = await captureVideo(browser, { outDir, viewport: primaryVp, routes: routes.map((r) => ({ route: r, url: urlFor(r) })), col });
    else col.run('video-capture', { status: 'skipped', ran: false, reason: 'not requested (pass --video)' });
  } finally {
    await browser.close().catch(() => {});
    await noGpu.close();
    if (server) await server.close();
  }

  // ---- standing limitations ---------------------------------------------------
  col.limit('Timing figures (rAF cadence, frame intervals) are measured in headless Chromium with software rendering and are not representative of user devices.');
  col.limit('Pixel-change sampling compares two above-the-fold screenshots 500ms apart; canvas and video content may legitimately change under reduced motion.');
  col.limit('CSS transitions are only observable while running; the transition count reflects those active at load plus elements that declare a transition.');
  col.limit(`Before the DOM and axe checks each page was scrolled to the bottom in ~0.8-viewport steps and back to the top (at most ${SCROLL_THROUGH.maxSteps} steps / ${SCROLL_THROUGH.maxMs / 1000} s; document plus main inner scroller). Scroll-linked (scrubbed) states are measured at the position reached — the top — not at every position, and reveals that reverse when they leave the viewport are measured hidden.`);
  col.limit('Subjective visual quality (composition, typography, hierarchy, spacing, originality, motion purpose) is not measured by this tool — see the agent-led assessment section of report.md.');
  if (viewports.length > 1) col.limit(`Keyboard, focus-indicator and full 3D diagnostics ran on the "${primaryVp}" viewport only; touch viewports get layout, accessibility, responsive, state and (for 3D) touch-interaction checks.`);
  if (do3D && threeDRoutes.length) col.limit('3D counters come from main-thread WebGL call instrumentation; rendering inside Web Workers / OffscreenCanvas workers and WebGPU draw calls are not counted. Texture and geometry byte figures are estimates.');

  const checks = col.aggregate();
  const order = Object.fromEntries(SEVERITIES.map((s, i) => [s, i]));
  const issues = col.issues.sort((a, b) => order[a.severity] - order[b.severity] || String(a.route).localeCompare(String(b.route)) || a.check.localeCompare(b.check));
  const motion = buildMotionSummary(motionRoutes);
  const report = {
    tool: TOOL, version: toolVersion(), generatedAt: new Date().toISOString(), label: opts.label ?? null,
    target: opts.serve ? { mode: 'serve', dir: path.resolve(opts.serve), baseUrl } : { mode: 'url', url: String(opts.url), baseUrl },
    pass: passNo,
    coverage: {
      routes, viewports: viewports.map((v) => ({ name: v, ...VIEWPORTS[v] })), motionModes: ['normal', 'reduced'],
      states: stateLog, frames: frameLog, frameOffsetsMs: FRAME_OFFSETS_MS, screenshots, video, scrollThrough: scrollLog,
      checksRun: checks.filter((c) => c.ran).map((c) => c.id), checksSkipped: checks.filter((c) => !c.ran).map((c) => ({ id: c.id, status: c.status, reason: c.reason ?? null })),
      matrix: routes.flatMap((r) => viewports.map((v) => ({ route: r, viewport: v, checks: col.runs.filter((x) => x.route === r && x.viewport === v).map((x) => ({ check: x.check, status: x.status })) }))),
    },
    checks, issues, motion,
    threeD: do3D && threeDRoutes.length ? { budgets, budgetsSource, note: 'Budgets are project settings (defaults unless --budgets is given), not universal thresholds.', routes: threeDRoutes } : null,
    limitations: [...col.limitations],
    summary: summarize(issues),
  };
  const reportPath = path.join(outDir, 'report.json');
  writeJson(reportPath, report);
  fs.writeFileSync(path.join(outDir, 'report.md'), renderReportMd(report));
  return { report, outDir, reportPath, reportMdPath: path.join(outDir, 'report.md') };
}

function strip(m) {
  const { raf, ...rest } = m;
  return { ...rest, animations: rest.animations.slice(0, 40), running: rest.running.slice(0, 20) };
}

/** @param {any[]} entries */
function buildMotionSummary(entries) {
  const anims = new Map();
  for (const e of entries) for (const a of e.normal.animations) anims.set(`${e.route}|${a.type}|${a.name}|${a.selector}`, a);
  const all = [...anims.values()];
  const rafs = entries.filter((e) => e.raf);
  return {
    totals: {
      cssAnimations: all.filter((a) => a.type === 'css-animation').length, cssTransitions: all.filter((a) => a.type === 'css-transition').length, waapi: all.filter((a) => a.type === 'waapi').length,
      longestDurationMs: all.reduce((m, a) => Math.max(m, a.durationMs || 0), 0), infinite: all.filter((a) => a.iterations === 'infinite').length,
      properties: [...new Set(all.flatMap((a) => a.properties))],
      layoutTriggeringProperties: [...new Set(entries.flatMap((e) => [...e.normal.layoutTriggeringProperties, ...e.normal.declaredLayoutTransitions]))],
      declaredTransitionElements: entries.reduce((m, e) => Math.max(m, e.normal.declaredTransitionElements), 0),
      stillRunningUnderReducedMotion: entries.reduce((m, e) => Math.max(m, e.reduced.runningCount), 0),
    },
    rafCadence: rafs.map((e) => ({ route: e.route, viewport: e.viewport, ...e.raf, note: 'headless software rendering — not representative of user devices' })),
    perRoute: entries,
  };
}

/** Find the latest pass report in a review dir. @param {string} outRoot */
export function latestReport(outRoot) {
  const n = listPasses(outRoot).at(-1);
  return n ? readJson(path.join(outRoot, `pass-${n}`, 'report.json')) : null;
}
export { THREE_D_CHECKS, CHECK_BY_ID };
