// @ts-check
/** `experience assess` — measure routes × viewports × motion modes, derive signals, score, write reports. */
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser, newContext, VIEWPORTS } from '../lib/browser.mjs';
import { serveStatic } from '../lib/static-server.mjs';
import { log, UserError } from '../lib/log.mjs';
import { installPageHelpers } from '../visual-director/page/helpers.mjs';
import { instrument3D } from '../visual-director/three-d/instrument.mjs';
import { noGpuBrowserFactory } from '../visual-director/three-d/diagnostics.mjs';
import { discoverStaticRoutes } from '../visual-director/run.mjs';
import { routeSlug, toolVersion, writeJson } from '../visual-director/util.mjs';
import { installExperienceProbes, pageAnimations, pageCanvasInfo, pageMeasure, pagePerfReport } from './probes/page.mjs';
import { motionFrames, probeAxe, probeFallback, probeForms, probeHover, probeKeyboard, probeLatency, probeLiveliness, probeNotFound, probePopups, NOT_FOUND_PATH } from './probes/interact.mjs';
import { deriveSignals } from './derive.mjs';
import { scoreExperience, TOOL } from './score.mjs';
import { parseAnswers } from './rubric.mjs';
import { PROFILE_IDS } from './catalog.mjs';
import { readJsonFile, writeExperience } from './index.mjs';

const LOOPBACK = (h) => h === 'localhost' || h.endsWith('.localhost') || /^127\./.test(h) || h === '[::1]' || h === '::1';
const sleepUntil = async (t0, ms) => { const d = ms - (Date.now() - t0); if (d > 0) await new Promise((r) => setTimeout(r, d)); };
const settle = (page) => page.evaluate(async () => { try { await document.fonts.ready; } catch { /* ignore */ } await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))); }).catch(() => {});

/** Profile from the flag, else the project's maquettekit.design.json, else expressive. */
function resolveProfile(flag, dirs) {
  if (flag) return { profile: flag, source: '--profile' };
  for (const d of dirs) {
    const f = path.join(d, 'maquettekit.design.json');
    try { const doc = JSON.parse(fs.readFileSync(f, 'utf8')); const p = String(doc.motion?.profile ?? doc.brief?.motionIntensity ?? '').toLowerCase(); if (PROFILE_IDS.includes(p)) return { profile: p, source: f }; } catch { /* next */ }
  }
  return { profile: 'expressive', source: 'default (no --profile, no maquettekit.design.json)' };
}

/** Init scripts shared by both motion modes. */
async function prepare(context) {
  await context.addInitScript(installPageHelpers);
  await context.addInitScript(instrument3D, { forceNoGL: false });
  await context.addInitScript(installExperienceProbes);
}

/**
 * @param {import('playwright').Browser} browser
 * @param {{ url: string, route: string, viewport: string, primary: boolean, outDir: string }} c
 */
async function measurePage(browser, c) {
  const touch = !!VIEWPORTS[c.viewport].hasTouch;
  const slug = routeSlug(c.route);
  const shots = path.join(c.outDir, 'screenshots', slug);
  fs.mkdirSync(shots, { recursive: true });
  /** @type {any} */ const rec = { route: c.route, viewport: c.viewport, touch, primary: c.primary, screenshots: [] };
  const largest = (info) => (info?.canvases ?? []).slice().sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height)[0]?.rect ?? null;

  // ---------------- normal motion: structure, performance, interaction probes ----------------
  const context = await newContext(browser, /** @type {any} */ (c.viewport));
  await prepare(context);
  try {
    const page = await context.newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(String(e?.message ?? e).slice(0, 200)));
    const resp = await page.goto(c.url, { waitUntil: 'load', timeout: 30000 });
    const t0 = Date.now();
    rec.httpStatus = resp?.status() ?? null;
    const early = await page.evaluate(pageAnimations).catch(() => null);
    await settle(page);
    await sleepUntil(t0, 1600);
    rec.perf = await page.evaluate(pagePerfReport).catch(() => null);
    rec.dom = await page.evaluate(pageMeasure, { touch, maxElements: 5000 });
    rec.canvas = await page.evaluate(pageCanvasInfo).catch(() => null);
    rec.computedNames = await page.evaluate(() => 'computedName' in Element.prototype).catch(() => false);
    for (const [kind, full] of [['fold', false], ['full', true]]) {
      const rel = `screenshots/${slug}/${c.viewport}-${kind}.png`;
      await page.screenshot({ path: path.join(c.outDir, rel), fullPage: /** @type {boolean} */ (full) }).catch(() => {});
      rec.screenshots.push(rel);
    }
    const frames = await motionFrames(page, 3, largest(rec.canvas));
    const late = await page.evaluate(pageAnimations).catch(() => null);
    rec.motion = { normal: { early, late, frames } };
    if (c.primary) {
      rec.axe = await probeAxe(page);
      rec.keyboard = await probeKeyboard(page);
      rec.hover = touch ? { status: 'unavailable', reason: 'touch viewport: no hover' } : await probeHover(page, c.url);
      rec.liveliness = await probeLiveliness(page, { touch });
      rec.popups = await probePopups(page, c.url); // before latency: popups restore state, latency clicks may not
      rec.latency = await probeLatency(page, c.url);
      await sleepUntil(t0, 5200); // persistence check ≥ 5 s after load (WCAG 2.2.2 threshold)
      const persistent = await motionFrames(page, 2, largest(rec.canvas));
      rec.motion.normal.persistent = { ...persistent, atMs: Date.now() - t0 };
      rec.forms = await probeForms(page, c.url);
    }
    rec.pageErrors = errors.slice(0, 5);
  } finally { await context.close().catch(() => {}); }

  // ---------------- reduced motion: what keeps moving ----------------
  const rctx = await newContext(browser, /** @type {any} */ (c.viewport), { reducedMotion: true });
  await prepare(rctx);
  try {
    const page = await rctx.newPage();
    await page.goto(c.url, { waitUntil: 'load', timeout: 30000 });
    const t0 = Date.now();
    const early = await page.evaluate(pageAnimations).catch(() => null);
    await settle(page);
    await sleepUntil(t0, 1600);
    const info = await page.evaluate(pageCanvasInfo).catch(() => null);
    const frames = await motionFrames(page, 3, largest(info));
    const late = await page.evaluate(pageAnimations).catch(() => null);
    const rel = `screenshots/${slug}/${c.viewport}-reduced-fold.png`;
    await page.screenshot({ path: path.join(c.outDir, rel) }).catch(() => {});
    rec.screenshots.push(rel);
    rec.motion.reduced = { early, late, frames };
  } finally { await rctx.close().catch(() => {}); }
  return rec;
}

/**
 * @param {{ url?: string, serve?: string, routes?: string[], out?: string, viewports?: string[], profile?: string, answers?: string }} opts
 */
export async function runAssessment(opts) {
  if (!opts.url && !opts.serve) throw new UserError('experience assess needs a target: --url <url> or --serve <dir>');
  if (opts.url && opts.serve) throw new UserError('Use either --url or --serve, not both.');
  const viewports = opts.viewports?.length ? opts.viewports : ['mobile', 'desktop'];
  for (const v of viewports) if (!VIEWPORTS[v]) throw new UserError(`Unknown viewport "${v}". Known: ${Object.keys(VIEWPORTS).join(', ')}`);
  /** @type {URL | null} */ let target = null;
  if (opts.url) {
    try { target = new URL(opts.url); } catch { throw new UserError(`--url: "${opts.url}" is not a valid URL`); }
    if (!/^https?:$/.test(target.protocol)) throw new UserError('--url must be http(s)');
    if (!LOOPBACK(target.hostname)) throw new UserError(`--url must point at a local server (localhost / 127.0.0.1); got "${target.hostname}". Experience Lab clicks controls and submits forms (with non-GET requests blocked), so it only runs against loopback targets.`);
  }
  const serveDir = opts.serve ? path.resolve(opts.serve) : null;
  if (serveDir && (!fs.existsSync(serveDir) || !fs.statSync(serveDir).isDirectory())) throw new UserError(`--serve: "${serveDir}" is not a directory`);
  const answersDoc = opts.answers ? readJsonFile(opts.answers, 'Answers file') : null;
  parseAnswers(answersDoc); // fail fast on invalid answers (exit 2) before launching a browser
  const { profile, source: profileSource } = resolveProfile(opts.profile, [process.cwd(), ...(serveDir ? [serveDir] : [])]);
  if (process.env.MAQUETTEKIT_DISABLE_PLAYWRIGHT === '1') {
    throw new UserError('Playwright is disabled (MAQUETTEKIT_DISABLE_PLAYWRIGHT=1), so `experience assess` cannot measure anything.\n'
      + '  Browser-free path: `maquettekit experience rubric --profile ' + profile + ' --json` → answers.json → `maquettekit experience score --answers answers.json --profile ' + profile + '`\n'
      + '  (or re-score an existing signals.json with --signals). Unset the variable (and run `maquettekit setup`) to measure.', 3);
  }
  const outDir = path.resolve(opts.out ?? '.maquettekit/experience');
  fs.mkdirSync(outDir, { recursive: true });
  fs.rmSync(path.join(outDir, 'screenshots'), { recursive: true, force: true });

  /** @type {{ close: () => Promise<void>, url: string } | null} */ let server = null;
  let baseUrl; let routes = opts.routes?.length ? opts.routes : null;
  if (serveDir) {
    server = await serveStatic(serveDir);
    baseUrl = server.url;
    routes ??= discoverStaticRoutes(serveDir).filter((r) => !/^\/404(\.html?)?\/?$/i.test(r));
    if (!routes.length) routes = ['/'];
  } else {
    const u = /** @type {URL} */ (target);
    routes ??= [(u.pathname || '/') + u.search];
    baseUrl = u.origin;
  }
  routes = routes.map((r) => (r.startsWith('/') ? r : '/' + r));
  const primaryVp = viewports.includes('desktop') ? 'desktop' : (viewports.find((v) => !VIEWPORTS[v].hasTouch) ?? viewports[0]);
  const touchVps = viewports.filter((v) => VIEWPORTS[v].hasTouch);

  /** @type {any[]} */ const pages = []; /** @type {any} */ let notFound = null; /** @type {any[]} */ const fallback = [];
  const noGpu = noGpuBrowserFactory();
  let browser = null;
  try {
    browser = await launchBrowser({ args: ['--enable-blink-features=ComputedAccessibilityInfo'] });
    for (const route of routes) {
      for (const viewport of viewports) {
        log.step(`${route} @ ${viewport}${viewport === primaryVp ? ' (keyboard, pointer, forms, axe)' : ''}`);
        pages.push(await measurePage(browser, { url: baseUrl + route, route, viewport, primary: viewport === primaryVp, outDir }));
      }
    }
    log.step('404 behaviour and no-WebGL fallback');
    const ctx = await newContext(browser, /** @type {any} */ (primaryVp));
    try { notFound = await probeNotFound(ctx, baseUrl, serveDir); } finally { await ctx.close().catch(() => {}); }
    for (const p of pages.filter((x) => x.primary && (x.canvas?.requested ?? 0) > 0)) {
      const rel = `screenshots/${routeSlug(p.route)}/${primaryVp}-no-webgl.png`;
      const containers = (p.canvas?.canvases ?? []).map((cv) => cv.container).filter(Boolean);
      fallback.push({ route: p.route, screenshot: rel, ...(await probeFallback(noGpu.get, baseUrl + p.route, primaryVp, containers, path.join(outDir, rel))) });
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    await noGpu.close();
    if (server) await server.close();
  }

  // ---------------- signals (profile-independent) ----------------
  const { signals, context, motion } = deriveSignals(pages, { routes, notFound, fallback });
  const version = toolVersion();
  const now = new Date().toISOString();
  const coverage = {
    routes, viewports: viewports.map((v) => ({ name: v, ...VIEWPORTS[v] })), primaryViewport: primaryVp, touchViewports: touchVps, motionModes: ['normal', 'reduced'],
    pages: pages.map((p) => ({ route: p.route, viewport: p.viewport, httpStatus: p.httpStatus, primary: p.primary })),
    screenshots: [...pages.flatMap((p) => p.screenshots), ...fallback.filter((f) => f.status === 'measured').map((f) => f.screenshot)],
    notFoundProbe: NOT_FOUND_PATH,
  };
  const limitations = [
    'Timings (FCP, LCP, CLS, long tasks, input latency) are lab measurements in headless Chromium with software rendering on loopback, without CPU or network throttling — not field data and not representative of user devices.',
    `Pointer, keyboard, popup, latency, form and axe-core probes ran on the "${primaryVp}" viewport only; touch-target checks ran on ${touchVps.length ? touchVps.join(', ') : 'no viewport (no touch viewport requested)'}.`,
    'Forms were submitted empty with non-GET requests blocked and navigation prevented; server-side validation and success paths were not exercised.',
    'Motion detection reads document.getAnimations() at load and after ~2 s, and diffs viewport screenshots 400 ms apart; canvas and video motion is included on purpose (it must respect reduced motion too). Response to the pointer and to scrolling is probed on the primary (desktop) view only: a four-point pointer sweep and three scroll steps.',
    'Interaction samples are small (≤ 8 hovered controls, ≤ 3 popup triggers, ≤ 2 forms, ≤ 40 tab stops per page); untested controls may behave differently.',
  ];
  if (pages.some((p) => !p.computedNames)) limitations.push('Chromium computedName was unavailable; accessible names were approximated.');
  if (pages.some((p) => p.motion?.normal?.frames && !p.motion.normal.frames.available)) limitations.push(`Pixel sampling was unavailable (${pages.find((p) => !p.motion.normal.frames.available)?.motion.normal.frames.reason}); continuous script/canvas motion could not be detected.`);
  if (notFound?.emulated404Html) limitations.push('404 behaviour: in --serve mode the root 404.html was served for the unknown route, emulating common static hosts.');
  for (const p of pages.filter((x) => x.keyboard?.truncated)) limitations.push(`Keyboard walk on ${p.route} stopped after 40 tab stops; later controls were not verified.`);
  for (const p of pages.filter((x) => x.httpStatus >= 400)) limitations.push(`${p.route} @ ${p.viewport} answered HTTP ${p.httpStatus}; signals were measured on the error page.`);
  for (const p of pages.filter((x) => x.pageErrors?.length)) limitations.push(`${p.route} @ ${p.viewport} threw: ${p.pageErrors[0]}`);
  const targetInfo = serveDir ? { mode: 'serve', dir: serveDir, baseUrl } : { mode: 'url', url: String(opts.url), baseUrl };
  const signalsDoc = { tool: TOOL, kind: 'experience-signals', schemaVersion: 1, version, generatedAt: now, target: targetInfo, coverage: { ...coverage, motion }, context, signals, limitations };
  const signalsPath = path.join(outDir, 'signals.json');
  writeJson(signalsPath, signalsDoc);
  writeJson(path.join(outDir, 'measurements.json'), { tool: TOOL, kind: 'experience-measurements', note: 'Raw probe output (debugging aid); signals.json is the scoring input.', pages, notFound, fallback });

  const result = scoreExperience({
    signals: signalsDoc, answers: answersDoc, profile, now,
    inputs: { signals: signalsPath, answers: opts.answers ? path.resolve(opts.answers) : null, profileSource },
    meta: { version, target: targetInfo, coverage: { ...coverage, motion }, limitations },
  });
  for (const w of result.warnings) log.warn(w);
  const files = writeExperience(outDir, result);
  return { result, files: { ...files, signals: signalsPath }, profileSource, outDir };
}
