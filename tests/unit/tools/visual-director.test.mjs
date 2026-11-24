// @ts-check
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { main, help } from '../../../plugins/maquettekit/tools/visual-director/index.mjs';
import { runReview, Collector, discoverStaticRoutes } from '../../../plugins/maquettekit/tools/visual-director/run.mjs';
import { runCompare, diffIssues } from '../../../plugins/maquettekit/tools/visual-director/compare.mjs';
import { computeLoopStatus, loopStatus, writeSummary, buildFixList } from '../../../plugins/maquettekit/tools/visual-director/loop.mjs';
import { inspectProject } from '../../../plugins/maquettekit/tools/visual-director/inspect.mjs';
import { categorizeAsset } from '../../../plugins/maquettekit/tools/visual-director/checks/assets.mjs';
import { routeSlug, fingerprint, loadPngTools, diffPngBuffers } from '../../../plugins/maquettekit/tools/visual-director/util.mjs';
import { CHECKS, GUIDANCE } from '../../../plugins/maquettekit/tools/visual-director/guidance.mjs';
import { installPageHelpers } from '../../../plugins/maquettekit/tools/visual-director/page/helpers.mjs';
import { instrument3D, pageSnapshot3D } from '../../../plugins/maquettekit/tools/visual-director/three-d/instrument.mjs';
import { classifyContextLoss, pageDetectFallback } from '../../../plugins/maquettekit/tools/visual-director/three-d/diagnostics.mjs';
import { launchBrowser, newContext } from '../../../plugins/maquettekit/tools/lib/browser.mjs';
import { serveStatic } from '../../../plugins/maquettekit/tools/lib/static-server.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(here, '../../fixtures');
const GOOD = path.join(FIXTURES, 'vd-good');
const BROKEN = path.join(FIXTURES, 'vd-broken');
const LONG = 300_000;

// ---- can Chromium launch here? Browser tests skip (visibly, with the reason) when it cannot. ----
const browserProbe = await (async () => {
  try { const b = await launchBrowser(); await b.close(); return { ok: true, reason: '' }; }
  catch (err) { return { ok: false, reason: String(/** @type {any} */ (err).message).split('\n')[0] }; }
})();
const bit = browserProbe.ok ? it : (name, ..._rest) => it.skip(`${name} [SKIPPED: Chromium unavailable — ${browserProbe.reason}]`, () => {});
if (!browserProbe.ok) console.warn(`visual-director browser tests skipped: ${browserProbe.reason}`);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'maquettekit-vd-'));
afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

const byCheck = (report, check, pred = () => true) => report.issues.filter((i) => i.check === check && pred(i));
const checkOf = (report, id) => report.checks.find((c) => c.id === id);

/** Run main() capturing stdout. */
async function cli(argv) {
  const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
  try { const code = await main(argv); return { code, stdout: spy.mock.calls.map((c) => c.join(' ')).join('\n') }; }
  finally { spy.mockRestore(); }
}

// =====================================================================================
describe('visual-director: pure logic (no browser)', () => {
  it('exports help and a check catalogue with guidance for every check', () => {
    expect(help).toMatch(/review <subcommand>/);
    for (const c of CHECKS) expect(GUIDANCE[c.id], `guidance for ${c.id}`).toBeTruthy();
  });

  it('slugs routes and fingerprints issues stably', () => {
    expect(routeSlug('/')).toBe('root');
    expect(routeSlug('/scene.html')).toBe('scene-html');
    expect(routeSlug('/a/b?x=1')).toBe('a-b');
    expect(fingerprint({ check: 'c', route: '/', viewport: 'mobile', selector: '#a' })).toBe('c|/|mobile|#a|');
  });

  it('categorises failed assets', () => {
    expect(categorizeAsset('http://x/model.glb', 'fetch')).toBe('model');
    expect(categorizeAsset('http://x/scene.gltf', 'xhr')).toBe('model');
    expect(categorizeAsset('http://x/tex.ktx2', 'fetch')).toBe('texture');
    expect(categorizeAsset('http://x/tex.png', 'fetch')).toBe('texture');
    expect(categorizeAsset('http://x/hero.png', 'image')).toBe('image');
    expect(categorizeAsset('http://x/a.woff2', 'font')).toBe('font');
    expect(categorizeAsset('http://x/app.js', 'script')).toBe('script');
    expect(categorizeAsset('http://x/api/data', 'fetch')).toBe('other');
  });

  it('discovers static routes', () => {
    expect(discoverStaticRoutes(GOOD)).toEqual(['/', '/scene.html']);
  });

  it('Collector never aggregates a check to "passed" unless it ran', () => {
    const col = new Collector();
    col.run('accessibility-axe', { route: '/', viewport: 'desktop', status: 'skipped', ran: false, reason: 'axe missing' });
    col.run('horizontal-overflow', { route: '/', viewport: 'desktop', status: 'passed' });
    col.run('3d-fallback', { route: '/', viewport: 'desktop', status: 'not-applicable', ran: false, reason: 'no canvas' });
    col.run('3d-fallback', { route: '/s', viewport: 'desktop', status: 'passed' });
    col.run('responsive', { route: '/', viewport: 'desktop', status: 'passed' });
    col.run('responsive', { route: '/', viewport: 'mobile', status: 'skipped', ran: false, reason: 'x' });
    const agg = Object.fromEntries(col.aggregate().map((c) => [c.id, c]));
    expect(agg['accessibility-axe']).toMatchObject({ status: 'skipped', ran: false, reason: 'axe missing' });
    expect(agg['horizontal-overflow']).toMatchObject({ status: 'passed', ran: true });
    expect(agg['3d-fallback']).toMatchObject({ status: 'passed', ran: true });
    expect(agg.responsive.status).toBe('limited');
    // a check that was never scheduled is not passed either
    expect(agg['clipped-content']).toMatchObject({ status: 'skipped', ran: false });
    for (const c of Object.values(agg)) if (c.status === 'passed') expect(c.ran).toBe(true);
  });

  it('Collector de-duplicates issues by fingerprint and marks them measured', () => {
    const col = new Collector();
    const i = { check: 'failed-assets', severity: 'major', route: '/', viewport: 'desktop', message: 'm', key: '/a.png' };
    col.issue(i); col.issue(i);
    expect(col.issues).toHaveLength(1);
    expect(col.issues[0]).toMatchObject({ measured: true, id: expect.stringMatching(/^vd-[0-9a-f]{10}$/) });
  });

  const mk = (pass, issues, label = null) => ({ pass, report: { pass, label, generatedAt: 't', issues, summary: { critical: issues.filter((i) => i.severity === 'critical').length, major: issues.filter((i) => i.severity === 'major').length, minor: 0, info: 0 } } });
  const crit = { id: 'vd-1', check: 'console-errors', severity: 'critical', route: '/', viewport: 'desktop', message: 'boom', fingerprint: 'console-errors|/|desktop||boom' };
  const majA = { id: 'vd-2', check: 'horizontal-overflow', severity: 'major', route: '/', viewport: 'mobile', selector: '.wide', message: 'wide', fingerprint: 'horizontal-overflow|/|mobile|.wide|' };
  const majB = { id: 'vd-3', check: 'horizontal-overflow', severity: 'major', route: '/', viewport: 'tablet', selector: '.wide', message: 'wide', fingerprint: 'horizontal-overflow|/|tablet|.wide|' };

  it('loop-status: no passes yet', () => {
    const st = computeLoopStatus([], 3);
    expect(st).toMatchObject({ passesDone: 0, stop: false, stopReason: null, fixList: [] });
  });

  it('loop-status: continue while critical issues remain and budget is left', () => {
    const st = computeLoopStatus([mk(1, [majA, crit, majB])], 3);
    expect(st).toMatchObject({ passesDone: 1, criticalRemaining: 1, majorRemaining: 2, stop: false, stopReason: null, nextPass: 2 });
    expect(st.fixList.map((f) => f.severity)).toEqual(['critical', 'major']); // critical first, viewports merged
    expect(st.fixList[1].viewports.sort()).toEqual(['mobile', 'tablet']);
    expect(st.fixList[0].guidance).toBe(GUIDANCE['console-errors']);
  });

  it('loop-status: stops with criticalResolved or budgetExhausted', () => {
    const resolved = computeLoopStatus([mk(1, [crit, majA]), mk(2, [majA])], 3);
    expect(resolved).toMatchObject({ stop: true, stopReason: 'criticalResolved', criticalRemaining: 0, majorRemaining: 1 });
    expect(resolved.delta).toMatchObject({ resolved: 1, introduced: 0, remaining: 1 });
    const exhausted = computeLoopStatus([mk(1, [crit]), mk(2, [crit]), mk(3, [crit])], 3);
    expect(exhausted).toMatchObject({ stop: true, stopReason: 'budgetExhausted', criticalRemaining: 1, nextPass: null });
  });

  it('diffIssues matches by fingerprint', () => {
    const d = diffIssues({ issues: [crit, majA] }, { issues: [majA, majB] });
    expect(d.resolved.map((i) => i.id)).toEqual(['vd-1']);
    expect(d.introduced.map((i) => i.id)).toEqual(['vd-3']);
    expect(d.remaining.map((i) => i.id)).toEqual(['vd-2']);
    expect(buildFixList([majA, majB])).toHaveLength(1);
  });

  it('pixel diff pads images of different heights', async () => {
    const tools = await loadPngTools();
    const a = new tools.PNG({ width: 10, height: 10 }); a.data.fill(255);
    const b = new tools.PNG({ width: 10, height: 20 }); b.data.fill(255);
    for (let i = 0; i < 10 * 4; i += 4) { b.data[15 * 40 + i] = 0; b.data[15 * 40 + i + 1] = 0; b.data[15 * 40 + i + 2] = 0; }
    const d = diffPngBuffers(tools, tools.PNG.sync.write(a), tools.PNG.sync.write(b));
    expect(d).toMatchObject({ width: 10, height: 20, sizeChanged: true, changedPixels: 10 });
    expect(d.ratio).toBeCloseTo(0.05);
  });

  it('inspect: detects framework, styling, motion, 3D, routes and specialty from a fake project', async () => {
    const dir = path.join(tmp, 'proj');
    fs.mkdirSync(path.join(dir, 'app/pricing'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'app/(marketing)/about'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'app/blog/[slug]'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'public/models'), { recursive: true });
    for (const p of ['app/page.tsx', 'app/pricing/page.tsx', 'app/(marketing)/about/page.tsx', 'app/blog/[slug]/page.tsx', 'app/card.module.css', 'public/models/hero.glb']) fs.writeFileSync(path.join(dir, p), '');
    fs.writeFileSync(path.join(dir, 'maquettekit.design.json'), '{"name":"x"}');
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
      name: 'fake-scene', scripts: { dev: 'next dev', build: 'next build', start: 'next start' },
      dependencies: { next: '15.1.0', react: '19.0.0', three: '^0.170.0', '@react-three/fiber': '^9.0.0', '@react-three/drei': '^10.0.0', '@react-three/rapier': '^2.0.0', motion: '^12.0.0', gsap: '^3.12.0', 'styled-components': '^6.0.0' },
      devDependencies: { tailwindcss: '^4.0.0', typescript: '^5.0.0' },
    }));
    const r = inspectProject(dir);
    expect(r.framework).toMatchObject({ name: 'next', version: '15.1.0', ui: 'react', typescript: true });
    expect(r.styling.map((s) => s.name)).toEqual(expect.arrayContaining(['tailwind', 'css-modules', 'styled-components']));
    expect(r.styling.find((s) => s.name === 'tailwind').major).toBe(4);
    expect(r.animation.map((a) => a.name)).toEqual(expect.arrayContaining(['motion', 'gsap']));
    expect(r.threeD.libraries.map((a) => a.name)).toEqual(expect.arrayContaining(['three', 'react-three-fiber', 'drei', 'rapier']));
    expect(r.threeD.assets).toContain('public/models/hero.glb');
    expect(r.routes.list.map((x) => x.route).sort()).toEqual(['/', '/about', '/blog/[slug]', '/pricing']);
    expect(r.routes.dynamic).toBe(1);
    expect(r.design).toMatchObject({ present: true, valid: true });
    expect(r.specialty).toMatchObject({ heuristic: true, likely: '3d' });
    expect(['high', 'medium', 'low']).toContain(r.specialty.confidence);
    expect(r.scripts).toMatchObject({ dev: 'next dev', start: 'next start' });
    expect(r.devCommand).toBe('npm run dev');

    // CLI: prints JSON to stdout and writes <out>/inspect.json
    const out = path.join(tmp, 'inspect-out');
    const { code, stdout } = await cli(['inspect', '--dir', dir, '--out', out]);
    expect(code).toBe(0);
    expect(JSON.parse(stdout).framework.name).toBe('next');
    expect(JSON.parse(fs.readFileSync(path.join(out, 'inspect.json'), 'utf8')).tool).toBe('maquettekit-visual-director');
  });

  it('inspect: plain html site', () => {
    const r = inspectProject(GOOD);
    expect(r.framework.name).toBe('plain-html');
    expect(r.routes.list.map((x) => x.route)).toEqual(['/', '/scene.html']);
    expect(r.specialty.heuristic).toBe(true);
  });

  it('rejects bad usage with a UserError (exit code >= 2)', async () => {
    await expect(main(['run'])).rejects.toMatchObject({ name: 'UserError', exitCode: 2 });
    await expect(main(['nope'])).rejects.toMatchObject({ name: 'UserError' });
    await expect(main(['compare', '--before', '/nonexistent-a'])).rejects.toMatchObject({ name: 'UserError' });
  });
});

// =====================================================================================
describe('visual-director: browser runs', () => {
  const loopDir = path.join(tmp, 'loop');     // pass-1 = broken site, pass-2 = good site (stand-ins for before/after)
  /** @type {any} */ let good; /** @type {any} */ let broken; let goodDir = ''; let brokenDir = '';

  beforeAll(async () => {
    if (!browserProbe.ok) return;
    const [b, g] = await Promise.all([
      runReview({ serve: BROKEN, out: loopDir, pass: 1, label: 'before' }),
      runReview({ serve: GOOD, out: loopDir, pass: 2, label: 'after' }),
    ]);
    broken = b.report; brokenDir = b.outDir; good = g.report; goodDir = g.outDir;
  }, LONG);

  bit('vd-good: no critical or major issues, report files written', () => {
    expect(good.tool).toBe('maquettekit-visual-director');
    expect(good.summary.critical, JSON.stringify(good.issues.filter((i) => i.severity === 'critical'), null, 1)).toBe(0);
    expect(good.summary.major, JSON.stringify(good.issues.filter((i) => i.severity === 'major'), null, 1)).toBe(0);
    expect(good.coverage.routes).toEqual(['/', '/scene.html']);
    expect(fs.existsSync(path.join(goodDir, 'report.json'))).toBe(true);
    const md = fs.readFileSync(path.join(goodDir, 'report.md'), 'utf8');
    expect(md).toMatch(/# Part A — Measured results/);
    expect(md).toMatch(/Agent-led visual assessment \(subjective — not measured\)/);
    for (const k of ['Composition', 'Typography', 'Hierarchy', 'Spacing', 'Originality', 'Motion purpose']) expect(md).toContain(`| ${k} |`);
    expect(md.indexOf('Part A')).toBeLessThan(md.indexOf('Part B'));
    for (const i of good.issues) expect(i).toMatchObject({ measured: true, id: expect.any(String), check: expect.any(String) });
  });

  bit('vd-good: deliberate patterns are not defects (aria-hidden clone, sr-only table, line-clamp, checked radio, settling reveal)', () => {
    const clip = byCheck(good, 'clipped-content');
    expect(clip.filter((i) => i.severity !== 'info'), JSON.stringify(clip, null, 1)).toEqual([]);
    const clamp = clip.filter((i) => i.route === '/' && /\.clamp/.test(i.selector));
    expect(clamp.map((i) => i.viewport).sort()).toEqual(['desktop', 'mobile', 'tablet']);
    for (const i of clamp) expect(i).toMatchObject({ severity: 'info', evidence: { ellipsis: true, lineClamp: 2 } });
    expect(byCheck(good, 'responsive', (i) => i.key === 'wide')).toEqual([]);
    expect(byCheck(good, 'keyboard-navigation')).toEqual([]);
    const run = checkOf(good, 'clipped-content').runs.find((r) => r.route === '/' && r.viewport === 'mobile');
    expect(run.details.skippedDecorativeOrHidden).toBeGreaterThanOrEqual(1);
    // a correct reveal-on-scroll below the fold: the scroll-through reaches it, the settle waits for it, axe stays clean
    const st = good.coverage.scrollThrough.filter((s) => s.route === '/');
    expect(st.map((s) => [s.viewport, s.ran, s.reachedBottom])).toEqual([['desktop', true, true], ['tablet', true, true], ['mobile', true, true]]);
    expect(byCheck(good, 'accessibility-axe')).toEqual([]);
    expect(fs.readFileSync(path.join(goodDir, 'report.md'), 'utf8')).toMatch(/Scroll-through before DOM\/axe checks: `\/` \(desktop, tablet, mobile\)/);
  });

  bit('vd-good: expected checks ran and passed; unavailable ones are labelled honestly', () => {
    for (const id of ['horizontal-overflow', 'clipped-content', 'broken-layout', 'failed-assets', 'console-errors', 'accessibility-axe', 'keyboard-navigation', 'focus-visible', 'dialog-focus', 'responsive', 'reduced-motion', 'motion-summary',
      '3d-canvas-init', '3d-context-lost', '3d-assets', '3d-budgets', '3d-render-loop', '3d-resize', '3d-interaction', '3d-fallback']) {
      expect(checkOf(good, id), id).toMatchObject({ status: 'passed', ran: true });
      expect(good.coverage.checksRun).toContain(id);
    }
    expect(checkOf(good, '3d-frame-time')).toMatchObject({ status: 'limited', ran: true });
    expect(checkOf(good, 'video-capture')).toMatchObject({ status: 'skipped', ran: false });
    expect(['passed', 'unavailable']).toContain(checkOf(good, '3d-webgpu').status);
    if (checkOf(good, '3d-webgpu').status === 'unavailable') expect(checkOf(good, '3d-webgpu').reason).toBeTruthy();
    for (const c of good.checks) if (c.status === 'passed') expect(c.ran, c.id).toBe(true);
    expect(good.limitations.length).toBeGreaterThan(3);
  });

  bit('vd-good: screenshots exist for 3 viewports × 2 motion modes, plus frames and states', () => {
    for (const slug of ['root', 'scene-html']) for (const vp of ['desktop', 'tablet', 'mobile']) for (const mode of ['normal', 'reduced']) for (const kind of ['full', 'fold']) {
      const f = path.join(goodDir, 'screenshots', slug, `${vp}-${mode}-${kind}.png`);
      expect(fs.existsSync(f), f).toBe(true);
      expect(fs.statSync(f).size).toBeGreaterThan(500);
    }
    for (const ms of ['0000', '0150', '0400', '0900']) expect(fs.existsSync(path.join(goodDir, 'frames', 'root', `desktop-${ms}ms.png`))).toBe(true);
    const states = good.coverage.states.filter((s) => s.route === '/' && s.viewport === 'desktop' && s.status === 'captured');
    expect(states.map((s) => s.popupKind).filter(Boolean).sort()).toEqual(['dialog', 'menu']);
    expect(states.some((s) => s.kind === 'hover')).toBe(true);
    for (const s of states) expect(fs.existsSync(path.join(goodDir, s.file)), s.file).toBe(true);
    const dlg = states.find((s) => s.popupKind === 'dialog');
    expect(dlg.focus).toMatchObject({ movedInside: true, escapeCloses: true, focusReturned: true });
    expect(good.coverage.viewports.map((v) => v.name)).toEqual(['desktop', 'tablet', 'mobile']);
    expect(good.coverage.motionModes).toEqual(['normal', 'reduced']);
  });

  bit('vd-good: motion summary and reduced-motion measurements', () => {
    expect(good.motion.totals.cssAnimations).toBeGreaterThanOrEqual(2);
    expect(good.motion.totals.infinite).toBeGreaterThanOrEqual(1);
    expect(good.motion.totals.stillRunningUnderReducedMotion).toBe(0);
    expect(good.motion.totals.layoutTriggeringProperties).toEqual([]);
    expect(good.motion.rafCadence[0]).toMatchObject({ medianMs: expect.any(Number), p95Ms: expect.any(Number) });
    expect(good.motion.rafCadence[0].note).toMatch(/not representative/);
    const idx = good.motion.perRoute.find((e) => e.route === '/' && e.viewport === 'desktop');
    expect(idx.normal.runningCount).toBeGreaterThan(idx.reduced.runningCount);
    expect(idx.reduced.pixelChangeRatio).toBe(0);
  });

  bit('vd-good: 3D diagnostics detect the canvas, draw calls, hook, resize, cleanup and fallback', () => {
    expect(good.threeD.routes).toHaveLength(1);
    const s = good.threeD.routes[0];
    expect(s.route).toBe('/scene.html');
    expect(s.contexts.obtained).toBeGreaterThanOrEqual(1);
    expect(s.canvases[0].selector).toBe('#scene');
    expect(s.draw.totalDrawCalls).toBeGreaterThan(0);
    expect(s.draw.drawCalls.max).toBeGreaterThan(0);
    expect(s.draw.triangles.max).toBeGreaterThan(0);
    expect(s.geometry.bytes).toBe(60);
    expect(s.textures.note).toMatch(/ESTIMATE/);
    expect(s.renderLoop).toMatchObject({ continuous: false, declaredFrameloop: 'demand' });
    expect(s.hook).toMatchObject({ frameloop: 'demand', quality: 'high', renderer: { calls: 1, triangles: 1 } });
    expect(s.resize).toMatchObject({ drawingBufferUpdated: true });
    expect(s.resize.after.aspectError).toBeLessThan(0.03);
    expect(s.resize.drawCallsAfterResize).toBeGreaterThan(0);
    expect(s.cleanup).toMatchObject({ reinitialisedAfterReturn: true, disposedAtPagehide: 1 });
    expect(s.interaction.desktop.newErrors).toEqual([]);
    expect(Object.keys(s.interaction)).toEqual(expect.arrayContaining(['desktop', 'tablet']));
    expect(s.fallback.fallback).toMatchObject({ found: true, matchedBy: '[data-maquettekit-fallback]' });
    expect(s.fallback.contextsObtained).toBe(0);
    expect(fs.existsSync(path.join(goodDir, s.fallback.screenshot))).toBe(true);
    expect(good.threeD.budgetsSource).toBe('default');
    expect(s.frameTime.note).toMatch(/not representative/);
    // the index route has no canvas → not-applicable there, never "passed"
    const idxRun = checkOf(good, '3d-canvas-init').runs.find((r) => r.route === '/');
    expect(idxRun).toMatchObject({ status: 'not-applicable', ran: false });
  });

  bit('vd-broken: every planted defect is detected by the right check', () => {
    expect(broken.summary.critical).toBeGreaterThan(0);
    // horizontal overflow at mobile only
    const ov = byCheck(broken, 'horizontal-overflow');
    expect(ov.map((i) => i.viewport)).toEqual(['mobile']);
    expect(ov[0].selector).toMatch(/\.wide/);
    expect(ov[0].evidence.overflowPx).toBeGreaterThan(300);
    // clipped text (an aria-hidden icon inside the clipping box does not exempt the visible text beside it)
    expect(byCheck(broken, 'clipped-content', (i) => /\.clip/.test(i.selector) && i.severity === 'major').length).toBe(6);
    expect(byCheck(broken, 'clipped-content', (i) => /\.clip-icon/.test(i.selector) && i.severity === 'major').length).toBe(3);
    // broken image
    expect(byCheck(broken, 'failed-assets', (i) => i.evidence.category === 'image' && /missing\.png/.test(i.evidence.url) && i.evidence.status === 404).length).toBe(3);
    // console error (not an uncaught exception on the index page)
    expect(byCheck(broken, 'console-errors', (i) => i.route === '/' && i.evidence.type === 'console.error' && /analytics failed/.test(i.message)).length).toBe(3);
    // 404 fetch for model.glb → failed-assets (model) + 3d-assets
    expect(byCheck(broken, 'failed-assets', (i) => i.route === '/scene.html' && i.evidence.category === 'model' && i.evidence.status === 404).length).toBe(3);
    expect(byCheck(broken, '3d-assets', (i) => /model\.glb/.test(i.message)).length).toBe(1);
    // axe: alt, label, contrast, lang
    const rules = new Set(byCheck(broken, 'accessibility-axe').map((i) => i.evidence.rule));
    for (const r of ['image-alt', 'label', 'color-contrast', 'html-has-lang']) expect(rules.has(r), r).toBe(true);
    // faint text below the fold, revealed only by scrolling: measured thanks to the scroll-through pass (axe skipped it at opacity 0 before)
    expect(broken.coverage.scrollThrough.filter((s) => s.route === '/' && s.ran && s.scrollers.includes('document')).map((s) => s.viewport)).toEqual(['desktop', 'tablet', 'mobile']);
    const late = byCheck(broken, 'accessibility-axe', (i) => i.evidence.rule === 'color-contrast' && /late-note/.test(i.selector));
    expect(late.map((i) => i.viewport).sort()).toEqual(['desktop', 'mobile', 'tablet']);
    expect(byCheck(broken, 'accessibility-axe', (i) => i.evidence.rule === 'image-alt')[0].severity).toBe('critical');
    // tiny tap targets on touch viewports only
    const taps = byCheck(broken, 'responsive', (i) => i.key === 'tap-target');
    expect(taps.length).toBe(6);
    expect(new Set(taps.map((i) => i.viewport))).toEqual(new Set(['tablet', 'mobile']));
    expect(taps[0].evidence).toMatchObject({ width: 12, height: 12, minimumPx: 24 });
    // fixed width wider than the viewport
    expect(byCheck(broken, 'responsive', (i) => i.key === 'wide' && i.viewport === 'mobile').length).toBe(1);
    // animation ignoring reduced motion
    const rm = byCheck(broken, 'reduced-motion', (i) => i.key === 'spin');
    expect(rm.length).toBe(3);
    expect(rm[0]).toMatchObject({ severity: 'major' });
    expect(rm[0].evidence.animation).toMatchObject({ iterations: 'infinite', properties: ['transform'] });
    // unreachable div-button
    const unreachable = byCheck(broken, 'keyboard-navigation', (i) => i.key === 'unreachable');
    expect(unreachable).toHaveLength(1);
    expect(unreachable[0].selector).toMatch(/fake-btn/);
    // missing focus indicator
    expect(byCheck(broken, 'focus-visible', (i) => i.selector === '#options').length).toBe(1);
    // menu without focus management
    expect(byCheck(broken, 'dialog-focus', (i) => i.key === 'focus-not-moved' && i.viewport === 'desktop').length).toBe(1);
    expect(byCheck(broken, 'dialog-focus', (i) => i.key === 'escape' && i.viewport === 'desktop').length).toBe(1);
    // small text heuristic
    expect(byCheck(broken, 'broken-layout', (i) => i.key === 'small-text' && i.evidence.fontSizePx === 9).length).toBe(3);
    // 3D: stretched canvas, continuous loop (info), no fallback + throws without WebGL
    expect(byCheck(broken, '3d-resize', (i) => i.key === 'stretched')).toHaveLength(1);
    expect(byCheck(broken, '3d-render-loop', (i) => i.key === 'continuous' && i.severity === 'info')).toHaveLength(1);
    expect(byCheck(broken, '3d-fallback', (i) => i.key === 'no-fallback')).toHaveLength(1);
    expect(byCheck(broken, '3d-fallback', (i) => i.key === 'throws' && /createShader/.test(i.message))).toHaveLength(1);
    const s = broken.threeD.routes[0];
    expect(s.renderLoop.continuous).toBe(true);
    expect(s.draw.totalDrawCalls).toBeGreaterThan(50);
    expect(checkOf(broken, '3d-cleanup').status).toBe('limited');
    for (const id of ['horizontal-overflow', 'clipped-content', 'failed-assets', 'console-errors', 'accessibility-axe', 'keyboard-navigation', 'focus-visible', 'dialog-focus', 'responsive', 'reduced-motion', '3d-assets', '3d-resize', '3d-fallback']) expect(checkOf(broken, id).status, id).toBe('failed');
    // every issue is well-formed
    for (const i of broken.issues) {
      expect(['critical', 'major', 'minor', 'info']).toContain(i.severity);
      expect(i).toMatchObject({ measured: true, message: expect.any(String), evidence: expect.any(Object) });
    }
    expect(new Set(broken.issues.map((i) => i.id)).size).toBe(broken.issues.length);
  });

  bit('compare: detects pixel differences and resolved issues between two passes', async () => {
    const out = path.join(tmp, 'cmp');
    const r = await runCompare({ before: brokenDir, after: goodDir, out });
    expect(r.images.length).toBeGreaterThanOrEqual(24);
    expect(r.imagesChanged).toBeGreaterThan(0);
    const shot = r.images.find((i) => i.file === 'screenshots/root/desktop-normal-fold.png');
    expect(shot.changedRatio).toBeGreaterThan(0.01);
    expect(fs.existsSync(path.join(out, shot.diff))).toBe(true);
    expect(fs.existsSync(path.join(out, shot.composite))).toBe(true);
    const full = r.images.find((i) => i.file === 'screenshots/root/mobile-normal-full.png');
    expect(full.sizeChanged).toBe(true); // different page heights are padded, not rejected
    expect(r.issues.resolved.length).toBeGreaterThan(20);
    expect(r.issues.resolved.some((i) => i.check === 'horizontal-overflow')).toBe(true);
    expect(r.issues.remaining.length + r.issues.introduced.length).toBe(good.issues.length);
    expect(r.verdict).toMatch(/^Improved: \d+ issue\(s\) resolved/);
    expect(JSON.parse(fs.readFileSync(path.join(out, 'compare.json'), 'utf8')).verdict).toBe(r.verdict);
    expect(fs.readFileSync(path.join(out, 'compare.md'), 'utf8')).toMatch(/## Screenshots/);
  }, LONG);

  bit('compare: visual-regression mode exits 1 over the ratio and 0 for identical directories', async () => {
    const same = await cli(['compare', '--baseline', goodDir, '--current', goodDir, '--max-diff-ratio', '0.01', '--out', path.join(tmp, 'reg-same'), '--json']);
    expect(same.code).toBe(0);
    expect(JSON.parse(same.stdout).regression).toMatchObject({ passed: true, exceeding: [] });
    const diff = await cli(['compare', '--baseline', brokenDir, '--current', goodDir, '--max-diff-ratio', '0.01', '--out', path.join(tmp, 'reg-diff'), '--json']);
    expect(diff.code).toBe(1);
    expect(JSON.parse(diff.stdout).regression.exceeding.length).toBeGreaterThan(0);
  }, LONG);

  bit('loop-status and summary read the pass directories', async () => {
    const st = loopStatus({ out: loopDir, maxPasses: 3 });
    expect(st).toMatchObject({ passesDone: 2, latestPass: 2, criticalRemaining: 0, stop: true, stopReason: 'criticalResolved' });
    expect(st.delta.resolved).toBeGreaterThan(20);
    // only the broken pass → keep iterating, fix list is critical-first with guidance
    const only1 = path.join(tmp, 'loop1');
    fs.mkdirSync(only1, { recursive: true });
    fs.cpSync(brokenDir, path.join(only1, 'pass-1'), { recursive: true });
    const { code, stdout } = await cli(['loop-status', '--out', only1, '--max-passes', '3']);
    expect(code).toBe(0);
    const st1 = JSON.parse(stdout);
    expect(st1).toMatchObject({ passesDone: 1, stop: false, stopReason: null, nextPass: 2 });
    expect(st1.fixList[0].severity).toBe('critical');
    expect(st1.fixList.every((f) => typeof f.guidance === 'string' && f.guidance.length > 20)).toBe(true);
    const sevs = st1.fixList.map((f) => f.severity);
    expect(sevs.lastIndexOf('critical')).toBeLessThan(sevs.indexOf('major'));
    expect(JSON.parse((await cli(['loop-status', '--out', only1, '--max-passes', '1'])).stdout)).toMatchObject({ stop: true, stopReason: 'budgetExhausted' });

    fs.writeFileSync(path.join(loopDir, 'changes.json'), JSON.stringify([{ pass: 1, file: 'index.html', change: 'Removed fixed 700px width', issueIds: ['vd-abc'] }]));
    const sum = writeSummary({ out: loopDir });
    const md = fs.readFileSync(sum.file, 'utf8');
    expect(path.basename(sum.file)).toBe('SUMMARY.md');
    expect(md).toMatch(/## Before \/ after screenshots/);
    expect(md).toContain('pass-1/screenshots/root/desktop-normal-fold.png');
    expect(md).toContain('Removed fixed 700px width');
    expect(md).toMatch(/## Remaining issues/);
    expect(md).toMatch(/## Limitations/);
  });

  bit('skipped checks are reported as skipped, never passed (axe disabled, --no-3d, --no-a11y); exit codes', async () => {
    const out = path.join(tmp, 'skips');
    process.env.MAQUETTEKIT_DISABLE_AXE = '1';
    let res;
    try { res = await cli(['run', '--serve', GOOD, '--routes', '/', '--viewports', 'desktop', '--no-3d', '--out', out, '--label', 'axe off', '--json']); }
    finally { delete process.env.MAQUETTEKIT_DISABLE_AXE; }
    expect(res.code).toBe(0);
    const printed = JSON.parse(res.stdout);
    expect(printed.summary).toMatchObject({ critical: 0 });
    const report = JSON.parse(fs.readFileSync(printed.report, 'utf8'));
    expect(report.label).toBe('axe off');
    expect(report.pass).toBe(1);
    expect(checkOf(report, 'accessibility-axe')).toMatchObject({ status: 'skipped', ran: false });
    expect(checkOf(report, 'accessibility-axe').reason).toMatch(/MAQUETTEKIT_DISABLE_AXE/);
    expect(report.coverage.checksRun).not.toContain('accessibility-axe');
    expect(report.coverage.checksSkipped.map((c) => c.id)).toEqual(expect.arrayContaining(['accessibility-axe', '3d-fallback', '3d-canvas-init']));
    expect(checkOf(report, '3d-fallback')).toMatchObject({ status: 'skipped', ran: false, reason: 'disabled by --no-3d' });
    expect(report.threeD).toBeNull();
    const md = fs.readFileSync(printed.reportMd, 'utf8');
    expect(md).toMatch(/Accessibility \(axe-core, WCAG 2\.x A\/AA\) \| measured \| skipped \(did not run\)/);

    // broken site, explicit states, --no-a11y, auto-incremented pass → exit 1 (uncaught/critical issues? none without axe → use states + console)
    const statesFile = path.join(tmp, 'states.json');
    fs.writeFileSync(statesFile, JSON.stringify([
      { name: 'Options open', route: '/', steps: [{ action: 'click', selector: '#options' }, { action: 'wait', value: 100 }] },
      { name: 'Missing thing', route: '/', steps: [{ action: 'click', selector: '#does-not-exist' }] },
    ]));
    const res2 = await cli(['run', '--serve', BROKEN, '--routes', '/', '--viewports', 'mobile', '--no-a11y', '--no-3d', '--states', statesFile, '--out', out, '--json']);
    const p2 = JSON.parse(res2.stdout);
    expect(p2.pass).toBe(2); // next free pass
    const r2 = JSON.parse(fs.readFileSync(p2.report, 'utf8'));
    expect(res2.code).toBe(r2.summary.critical > 0 ? 1 : 0);
    expect(checkOf(r2, 'accessibility-axe')).toMatchObject({ status: 'skipped', ran: false, reason: 'disabled by --no-a11y' });
    const explicit = r2.coverage.states.filter((s) => s.kind === 'explicit');
    expect(explicit.map((s) => s.status)).toEqual(['captured', 'failed']);
    expect(fs.existsSync(path.join(path.dirname(p2.report), explicit[0].file))).toBe(true);
    expect(byCheck(r2, 'state-capture', (i) => /Missing thing/.test(i.message))).toHaveLength(1);
    expect(byCheck(r2, 'horizontal-overflow')).toHaveLength(1);
  }, LONG);

  bit('exit code is 1 when critical issues exist; --video is captured or reported unavailable', async () => {
    const out = path.join(tmp, 'exit');
    const res = await cli(['run', '--serve', BROKEN, '--routes', '/', '--viewports', 'desktop', '--no-3d', '--video', '--out', out, '--json']);
    expect(res.code).toBe(1);
    const report = JSON.parse(fs.readFileSync(JSON.parse(res.stdout).report, 'utf8'));
    expect(report.summary.critical).toBeGreaterThan(0);
    const v = checkOf(report, 'video-capture');
    expect(['passed', 'unavailable']).toContain(v.status);
    if (v.status === 'unavailable') { expect(v.ran).toBe(false); expect(v.reason).toBeTruthy(); expect(report.limitations.join(' ')).toMatch(/Video capture unavailable/); }
    else expect(fs.existsSync(path.join(out, 'pass-1', report.coverage.video.files[0].file))).toBe(true);
  }, LONG);

  bit('a no-WebGL launch yields the fallback verdicts', async () => {
    const server = await serveStatic(FIXTURES);
    const browser = await launchBrowser({ gpu: false });
    try {
      const verdict = async (site, force) => {
        const context = await newContext(browser, 'desktop');
        await context.addInitScript(installPageHelpers);
        await context.addInitScript(instrument3D, { forceNoGL: force });
        const page = await context.newPage();
        /** @type {string[]} */ const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(`${server.url}/${site}/scene.html`, { waitUntil: 'load' });
        await page.waitForTimeout(400);
        const snap = await page.evaluate(pageSnapshot3D);
        const fb = await page.evaluate(pageDetectFallback, ['#stage', '.stage']);
        await context.close();
        return { fb, errors, snap };
      };
      const g = await verdict('vd-good', true);
      expect(g.snap.contexts.length).toBeGreaterThan(0);
      expect(g.snap.contexts.every((c) => !c.ok && c.forced)).toBe(true);
      expect(g.fb).toMatchObject({ found: true, matchedBy: '[data-maquettekit-fallback]' });
      expect(g.fb.text).toMatch(/3D preview unavailable/);
      expect(g.errors).toEqual([]);
      const b = await verdict('vd-broken', true);
      expect(b.fb.found).toBe(false);
      expect(b.errors.join(' ')).toMatch(/createShader/);
      // without forcing getContext: the --disable-gpu/--disable-webgl launch alone must also deny WebGL
      const real = await verdict('vd-good', false);
      expect(real.snap.contexts.some((c) => c.ok), 'launchBrowser({gpu:false}) should not hand out WebGL contexts').toBe(false);
      expect(real.fb.found).toBe(true);
    } finally {
      await browser.close();
      await server.close();
    }
  }, LONG);
});

describe('visual-director: intentional WebGL context loss is not a 3d-context-lost failure', () => {
  it('classifies lost events: real vs intentional (loseContext on an attached canvas) vs never-attached probe', () => {
    const ev = (o) => ({ type: 'webglcontextlost', t: 0, message: '', ...o });
    const r = classifyContextLoss([ev({ intentional: true, attached: false }), ev({ intentional: true, attached: true }), ev({ intentional: false, attached: true }), ev({}), { type: 'webglcontextrestored' }]);
    expect([r.real.length, r.intentional.length, r.detached.length]).toEqual([2, 1, 1]); // untagged (older snapshots) stay real
  });
  bit('a capability probe and a forceContextLoss()-style teardown are tagged; a real loss still counts', async () => {
    const dir = fs.mkdtempSync(path.join(tmp, 'ctx-'));
    fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html><html><body>
      <canvas id="stage" width="64" height="64"></canvas><canvas id="other" width="64" height="64"></canvas>
      <script>
        const ctx = (c) => c.getContext('webgl2') || c.getContext('webgl');
        const probe = document.createElement('canvas'); // capabilities.ts: detached probe, released at once
        ctx(probe)?.getExtension('WEBGL_lose_context')?.loseContext();
        const gl = ctx(document.getElementById('stage'));
        const other = document.getElementById('other'); ctx(other);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          gl?.getExtension('WEBGL_lose_context')?.loseContext(); // three: renderer.forceContextLoss() on teardown
          other.dispatchEvent(new Event('webglcontextlost')); // stands in for a real GPU reset
          setTimeout(() => { window.__done = true; }, 200);
        }));
      </script></body></html>`);
    const server = await serveStatic(dir);
    const browser = await launchBrowser();
    try {
      const context = await newContext(browser, 'desktop');
      await context.addInitScript(installPageHelpers);
      await context.addInitScript(instrument3D, {});
      const page = await context.newPage();
      await page.goto(`${server.url}/index.html`, { waitUntil: 'load' });
      await page.waitForFunction(() => /** @type {any} */ (window).__done === true, null, { timeout: 15_000 });
      const snap = await page.evaluate(pageSnapshot3D);
      await context.close();
      expect(snap.contexts.filter((c) => c.ok).length, 'WebGL contexts available').toBeGreaterThanOrEqual(3);
      const loss = classifyContextLoss(snap.events);
      expect(loss.detached).toHaveLength(1);
      expect(loss.detached[0]).toMatchObject({ intentional: true, attached: false });
      expect(loss.intentional).toHaveLength(1);
      expect(loss.real).toHaveLength(1);
      expect(loss.real[0]).toMatchObject({ intentional: false, attached: true });
    } finally {
      await browser.close();
      await server.close();
    }
  }, LONG);
});
