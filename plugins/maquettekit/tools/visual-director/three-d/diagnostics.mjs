// @ts-check
/** Stage 4 — 3D diagnostics driven from Node on top of three-d/instrument.mjs. */
import fs from 'node:fs';
import path from 'node:path';
import { gotoStable, newContext, launchBrowser } from '../../lib/browser.mjs';
import { attachWatchers, categorizeAsset, urlKey } from '../checks/assets.mjs';
import { frameStats } from '../checks/motion.mjs';
import { installPageHelpers } from '../page/helpers.mjs';
import { instrument3D, pageSnapshot3D } from './instrument.mjs';
import { median, round, routeSlug } from '../util.mjs';

/**
 * Splits `webglcontextlost` events recorded by instrument3D: `real` losses (the 3d-context-lost failure),
 * `intentional` ones the page requested through WEBGL_lose_context.loseContext() on an attached canvas
 * (three's renderer.forceContextLoss() on teardown) — reported as info — and `detached` ones on canvases never
 * attached to the document (capability probes that release their context) — ignored, listed in details only.
 * @param {any[]} events
 */
export function classifyContextLoss(events) {
  const lost = (events || []).filter((e) => e && e.type === 'webglcontextlost');
  return {
    real: lost.filter((e) => e.attached !== false && e.intentional !== true),
    intentional: lost.filter((e) => e.attached !== false && e.intentional === true),
    detached: lost.filter((e) => e.attached === false),
  };
}

export const THREE_D_CHECKS = ['3d-canvas-init', '3d-context-lost', '3d-assets', '3d-budgets', '3d-frame-time', '3d-render-loop', '3d-resize', '3d-interaction', '3d-cleanup', '3d-fallback', '3d-webgpu'];

/** Defaults only — projects should set their own with --budgets. */
export const DEFAULT_BUDGETS = { drawCallsPerFrame: 200, trianglesPerFrame: 500000, textureBytes: 128 * 1024 * 1024, geometryBytes: 64 * 1024 * 1024 };

const HEADLESS_NOTE = 'measured in headless Chromium with software (SwiftShader) rendering — not representative of user devices';
const ASSET_ERR = /GLTFLoader|gltf|\.glb|texture|KTX2|DRACO|Basis|EXRLoader|RGBELoader|HDR/i;

/** @param {number[][]} frames [t, calls, tris] */
function drawStats(frames) {
  const drawn = frames.filter((f) => f[1] > 0);
  return {
    framesObserved: frames.length, framesWithDraws: drawn.length,
    drawCalls: { median: median(drawn.map((f) => f[1])), max: drawn.reduce((m, f) => Math.max(m, f[1]), 0) },
    triangles: { median: median(drawn.map((f) => f[2])), max: drawn.reduce((m, f) => Math.max(m, f[2]), 0) },
  };
}

/** Mark every 3D check with one status (used for skipped / not-applicable). */
export function markAll3D(col, base, status, reason, except = []) {
  for (const id of THREE_D_CHECKS) if (!except.includes(id)) col.run(id, { ...base, status, ran: false, reason });
}

/** Runs in the page: fallback-content detection for the no-WebGL simulation. */
export function pageDetectFallback(containerSelectors) {
  const H = /** @type {any} */ (window).__S3VD__;
  const hasMedia = (el) => Array.from(el.querySelectorAll('img,picture,svg,video')).some((m) => H.visible(m));
  const explicit = Array.from(document.querySelectorAll('[data-maquettekit-fallback]')).filter((e) => H.visible(e) && (H.text(e, 5) || hasMedia(e) || ['img', 'picture', 'svg', 'video'].includes(e.localName)));
  if (explicit.length) return { found: true, matchedBy: '[data-maquettekit-fallback]', selector: H.sel(explicit[0]), text: H.text(explicit[0], 80), heuristic: false };
  const containers = new Set();
  document.querySelectorAll('canvas').forEach((c) => { if (c.parentElement) containers.add(c.parentElement); });
  for (const s of containerSelectors || []) { try { const e = document.querySelector(s); if (e) containers.add(e); } catch { /* ignore */ } }
  let bodyOnly = false;
  for (const c of containers) {
    if (c === document.body || c === document.documentElement) { bodyOnly = true; continue; }
    if (!H.visible(c)) continue;
    if (hasMedia(c)) return { found: true, matchedBy: 'visible image/media in the canvas container', selector: H.sel(c), text: '', heuristic: true };
    const t = H.text(c, 80);
    if (t) return { found: true, matchedBy: 'visible text in the canvas container', selector: H.sel(c), text: t, heuristic: true };
  }
  return { found: false, matchedBy: null, containersChecked: containers.size, canvasIsChildOfBody: bodyOnly && containers.size === 1, canvasCount: document.querySelectorAll('canvas').length, heuristic: true };
}

/**
 * Full 3D diagnostics for one route on one viewport. Emits check runs + issues and returns the report section.
 * @param {import('playwright').BrowserContext} context a context that already has helpers + instrumentation init scripts
 * @param {string} url
 * @param {{ route: string, viewport: string, vp: {width:number,height:number,hasTouch?:boolean}, col: any, budgets: any, budgetsSource: string, outDir: string, getNoGpuBrowser: () => Promise<import('playwright').Browser> }} ctx
 */
export async function run3DDiagnostics(context, url, ctx) {
  const { col, route, viewport } = ctx;
  const base = { route, viewport };
  const page = await context.newPage();
  const watch = attachWatchers(page);
  /** @type {any} */ const out = { route, viewport, applicable: false };
  try {
    await gotoStable(page, url, { settleMs: 600 });
    let snap = await page.evaluate(pageSnapshot3D);
    if (!snap) { markAll3D(col, base, 'skipped', '3D instrumentation was not installed'); return out; }
    const requested = snap.contexts.length > 0;
    if (!requested) {
      out.domCanvasCount = snap.domCanvasCount;
      markAll3D(col, base, 'not-applicable', snap.domCanvasCount ? 'page has <canvas> elements but none requested a WebGL/WebGPU context' : 'no <canvas> with a WebGL/WebGPU context on this route');
      return out;
    }
    out.applicable = true;

    // ---- WebGPU availability (always honest) --------------------------------
    const gpuProbe = await page.evaluate(async () => {
      const gpu = /** @type {any} */ (navigator).gpu;
      if (!gpu) return { present: false, adapter: false, reason: 'navigator.gpu is not exposed by this browser build' };
      try { const a = await gpu.requestAdapter(); return a ? { present: true, adapter: true } : { present: true, adapter: false, reason: 'navigator.gpu.requestAdapter() resolved null (no usable adapter in this environment)' }; }
      catch (e) { return { present: true, adapter: false, reason: 'requestAdapter() rejected: ' + String(e) }; }
    }).catch((e) => ({ present: false, adapter: false, reason: String(e.message).split('\n')[0] }));
    const webgpuRequested = snap.contexts.some((c) => c.type === 'webgpu');
    out.webgpu = { ...gpuProbe, requestedByPage: webgpuRequested || snap.gpu.requested };
    if (gpuProbe.adapter) col.run('3d-webgpu', { ...base, status: 'passed', details: out.webgpu });
    else { col.run('3d-webgpu', { ...base, status: 'unavailable', ran: true, reason: gpuProbe.reason, details: out.webgpu }); col.limit(`WebGPU could not be tested: ${gpuProbe.reason}.`); }

    // ---- canvas initialisation ----------------------------------------------
    const okCtx = snap.contexts.filter((c) => c.ok);
    const failedCtx = snap.contexts.filter((c) => !c.ok);
    const creationErrors = snap.events.filter((e) => e.type === 'webglcontextcreationerror');
    out.contexts = { requested: snap.contexts.length, obtained: okCtx.length, failed: failedCtx.length, types: [...new Set(okCtx.map((c) => c.type))], failedTypes: [...new Set(failedCtx.map((c) => c.type))] };
    out.canvases = snap.canvases;
    const glFailed = failedCtx.filter((c) => c.type !== 'webgpu' || gpuProbe.adapter);
    if (!okCtx.length) {
      col.issue({ ...base, check: '3d-canvas-init', severity: 'critical', selector: 'canvas', key: 'no-context', message: `Canvas initialisation failed: ${snap.contexts.length} WebGL/WebGPU context request(s), none succeeded.`, evidence: { contexts: snap.contexts, creationErrors } });
      col.run('3d-canvas-init', { ...base, status: 'failed', details: out.contexts });
      markAll3D(col, base, 'skipped', 'no live WebGL/WebGPU context to measure', ['3d-canvas-init', '3d-webgpu', '3d-fallback', '3d-assets']);
    } else {
      if (glFailed.length) col.issue({ ...base, check: '3d-canvas-init', severity: 'info', key: 'partial', message: `Some context requests failed (${[...new Set(glFailed.map((c) => c.type))].join(', ')}) before a context was obtained (${out.contexts.types.join(', ')}).`, evidence: { contexts: snap.contexts } });
      col.run('3d-canvas-init', { ...base, status: 'passed', details: out.contexts });
    }

    if (okCtx.length) {
      // ---- idle sample window: 2s with no input -----------------------------
      const t0 = snap.t;
      await page.waitForTimeout(2000);
      snap = await page.evaluate(pageSnapshot3D);
      const windowFrames = snap.frames.filter((f) => f[0] >= t0);
      const lastSecond = windowFrames.filter((f) => f[0] >= snap.t - 1000);
      const idleDrawRatio = lastSecond.length ? lastSecond.filter((f) => f[1] > 0).length / lastSecond.length : 0;
      const all = drawStats(snap.frames);
      const hook = snap.hook;
      out.hook = hook;
      out.draw = { ...all, totalDrawCalls: snap.calls, source: 'WebGL call instrumentation (per requestAnimationFrame tick)' };
      out.textures = { count: snap.textures.live, created: snap.textures.created, uploads: snap.textures.uploads, bytesEstimate: Math.max(0, snap.textures.bytes), note: 'ESTIMATE: width × height × 4 bytes, ×1.33 when mipmapped; compressed uploads use the uploaded byte length' };
      out.geometry = { buffers: snap.buffers.live, bytes: Math.max(0, snap.buffers.bytes), note: 'sum of bufferData sizes for live buffers' };
      out.programs = snap.programs.live;

      // ---- budgets -----------------------------------------------------------
      const b = ctx.budgets; const src = ctx.budgetsSource;
      const measured = {
        drawCallsPerFrame: Math.max(all.drawCalls.max, hook?.renderer?.calls ?? 0),
        trianglesPerFrame: Math.max(all.triangles.max, hook?.renderer?.triangles ?? 0),
        textureBytes: out.textures.bytesEstimate, geometryBytes: out.geometry.bytes,
      };
      let budgetFail = false;
      for (const k of Object.keys(measured)) {
        if (typeof b[k] !== 'number' || measured[k] <= b[k]) continue;
        budgetFail = true;
        col.issue({ ...base, check: '3d-budgets', severity: 'minor', key: k, message: `${k} = ${measured[k]} exceeds configured budget of ${b[k]} (${src} budget${k.endsWith('Bytes') ? '; byte figures are estimates' : ''}).`, evidence: { metric: k, measured: measured[k], budget: b[k], budgetSource: src, estimate: k === 'textureBytes' } });
      }
      out.budgets = { configured: b, source: src, measured };
      if (snap.calls === 0) col.run('3d-budgets', { ...base, status: 'limited', reason: 'a context exists but no draw calls were observed on the main thread (rendering may happen in a worker, which is not instrumented)', details: measured });
      else col.run('3d-budgets', { ...base, status: budgetFail ? 'failed' : 'passed', details: { measured, budgets: b, budgetSource: src } });

      // ---- frame time --------------------------------------------------------
      const iv = []; for (let i = 1; i < windowFrames.length; i++) iv.push(windowFrames[i][0] - windowFrames[i - 1][0]);
      out.frameTime = { ...(frameStats(iv) ?? {}), note: HEADLESS_NOTE };
      col.run('3d-frame-time', { ...base, status: 'limited', reason: HEADLESS_NOTE, details: out.frameTime });

      // ---- render loop -------------------------------------------------------
      const continuous = idleDrawRatio > 0.5;
      out.renderLoop = { idleWindowMs: 2000, framesInLastSecond: lastSecond.length, idleDrawRatio: round(idleDrawRatio), continuous, declaredFrameloop: hook?.frameloop ?? null, hiddenTabBehaviour: 'not tested (document.hidden cannot be simulated reliably in headless automation)' };
      if (continuous) col.issue({ ...base, check: '3d-render-loop', severity: 'info', selector: snap.canvases[0]?.selector, key: 'continuous', message: `Continuous render loop: ${Math.round(idleDrawRatio * 100)}% of frames issued draw calls after 2s with no input; consider render-on-demand if the scene is static.`, evidence: out.renderLoop });
      col.run('3d-render-loop', { ...base, status: 'passed', details: out.renderLoop });
      col.limit('3D: behaviour while the tab is hidden (document.hidden) was not tested — it cannot be simulated reliably in headless automation.');

      // ---- context loss so far ----------------------------------------------
      // (final verdict after interaction + resize below)

      // ---- resize ------------------------------------------------------------
      await runResize(page, snap, ctx, out);

      // ---- pointer interaction ----------------------------------------------
      await runInteraction(page, watch, ctx, out, false);

      // ---- context loss ------------------------------------------------------
      snap = await page.evaluate(pageSnapshot3D);
      const loss = classifyContextLoss(snap.events);
      const lost = loss.real;
      const restored = snap.events.filter((e) => e.type === 'webglcontextrestored');
      out.contextEvents = { lost: lost.length, restored: restored.length, creationErrors: creationErrors.length, intentional: loss.intentional.length, detachedIgnored: loss.detached.length };
      if (lost.length) col.issue({ ...base, check: '3d-context-lost', severity: 'major', selector: snap.canvases[0]?.selector, key: 'lost', message: `WebGL context was lost ${lost.length} time(s) during the review (${restored.length} restored).`, evidence: { events: snap.events } });
      if (loss.intentional.length) col.issue({ ...base, check: '3d-context-lost', severity: 'info', selector: snap.canvases[0]?.selector, key: 'intentional', message: `The page released a WebGL context itself ${loss.intentional.length} time(s) (WEBGL_lose_context.loseContext(), e.g. renderer.forceContextLoss() on teardown) — not a failure.`, evidence: { events: loss.intentional } });
      col.run('3d-context-lost', { ...base, status: lost.length ? 'failed' : 'passed', details: out.contextEvents });

      // ---- cleanup -----------------------------------------------------------
      await runCleanup(page, url, watch, ctx, out);
    }

    // ---- assets (whole session on this page) --------------------------------
    const assetFails = [...new Map(watch.failed.map((f) => [f.url, f])).values()].map((f) => ({ ...f, category: categorizeAsset(f.url, f.resourceType) }))
      .filter((f) => f.category === 'model' || f.category === 'texture');
    const assetErrors = [...new Set([...watch.consoleErrors, ...watch.pageErrors].map((e) => e.text).filter((t) => ASSET_ERR.test(t) && !/^Failed to load resource/i.test(t)))];
    for (const f of assetFails) col.issue({ ...base, check: '3d-assets', severity: 'major', key: urlKey(f.url), message: `3D ${f.category} failed to load: ${urlKey(f.url)} (${f.status ? `HTTP ${f.status}` : f.failure}).`, evidence: { category: f.category, url: f.url, status: f.status ?? null, failure: f.failure ?? null } });
    for (const t of assetErrors.slice(0, 5)) col.issue({ ...base, check: '3d-assets', severity: 'major', key: 'err:' + t.slice(0, 80), message: `Loader error reported in console: ${t.slice(0, 200)}`, evidence: { text: t } });
    out.assets = { failedModels: assetFails.filter((f) => f.category === 'model').map((f) => urlKey(f.url)), failedTextures: assetFails.filter((f) => f.category === 'texture').map((f) => urlKey(f.url)), loaderErrors: assetErrors.slice(0, 5) };
    col.run('3d-assets', { ...base, status: assetFails.length || assetErrors.length ? 'failed' : 'passed', details: out.assets });
  } catch (err) {
    const msg = String(/** @type {any} */ (err).message).split('\n')[0];
    col.limit(`3D diagnostics on ${route} were interrupted: ${msg}`);
    for (const id of THREE_D_CHECKS) if (!col.hasRun(id, base)) col.run(id, { ...base, status: 'skipped', ran: false, reason: `diagnostics interrupted: ${msg}` });
  } finally {
    await page.close().catch(() => {});
  }

  // ---- unsupported-device fallback (separate no-GPU browser) -----------------
  if (out.applicable) await runFallback(url, ctx, out);
  return out;
}

async function runResize(page, snap, ctx, out) {
  const { col, route, viewport } = ctx; const base = { route, viewport };
  const measure = () => page.evaluate(pageSnapshot3D);
  const pick = (s) => s.canvases.filter((c) => c.connected && c.visible).sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
  const before = pick(snap);
  if (!before) { col.run('3d-resize', { ...base, status: 'skipped', ran: false, reason: 'no visible on-screen canvas with a 3D context' }); return; }
  const orig = page.viewportSize() ?? { width: ctx.vp.width, height: ctx.vp.height };
  const target = { width: Math.round(orig.width * 0.7), height: Math.round(orig.height * 0.8) };
  const callsBefore = snap.calls;
  await page.setViewportSize(target);
  await page.waitForTimeout(500);
  const s2 = await measure();
  const after = s2.canvases.find((c) => c.selector === before.selector) ?? pick(s2);
  await page.setViewportSize(orig);
  await page.waitForTimeout(350);
  if (!after) { col.run('3d-resize', { ...base, status: 'limited', reason: 'canvas disappeared after resize' }); return; }
  const aspectErr = (c) => (c.clientWidth && c.clientHeight && c.width && c.height ? Math.abs((c.width / c.height) / (c.clientWidth / c.clientHeight) - 1) : 0);
  const cssChanged = Math.abs(after.clientWidth - before.clientWidth) > 1 || Math.abs(after.clientHeight - before.clientHeight) > 1;
  const bufferChanged = after.width !== before.width || after.height !== before.height;
  const ev = {
    canvas: before.selector, dpr: snap.dpr, viewportBefore: orig, viewportAfter: target,
    before: { css: [before.clientWidth, before.clientHeight], buffer: [before.width, before.height], aspectError: round(aspectErr(before), 3) },
    after: { css: [after.clientWidth, after.clientHeight], buffer: [after.width, after.height], aspectError: round(aspectErr(after), 3) },
    cssSizeFollowedViewport: cssChanged, drawingBufferUpdated: bufferChanged, drawCallsAfterResize: s2.calls - callsBefore,
  };
  out.resize = ev;
  let fail = false;
  if (aspectErr(before) > 0.03 || aspectErr(after) > 0.03) {
    fail = true;
    const worst = aspectErr(after) > aspectErr(before) ? ev.after : ev.before;
    col.issue({ ...base, check: '3d-resize', severity: 'major', selector: before.selector, key: 'stretched', message: `Canvas is stretched: drawing buffer ${worst.buffer.join('×')} is displayed at ${worst.css.join('×')} CSS px (aspect ratio differs by ${Math.round(worst.aspectError * 100)}%).`, evidence: ev });
  } else if (cssChanged && !bufferChanged) {
    fail = true;
    col.issue({ ...base, check: '3d-resize', severity: 'minor', selector: before.selector, key: 'buffer-stale', message: `Canvas CSS size changed on resize (${ev.before.css.join('×')} → ${ev.after.css.join('×')}) but the drawing buffer stayed ${ev.after.buffer.join('×')}.`, evidence: ev });
  }
  if (after.clientWidth > target.width + 1) {
    fail = true;
    col.issue({ ...base, check: '3d-resize', severity: 'major', selector: before.selector, key: 'overflow', message: `Canvas is ${after.clientWidth}px wide in a ${target.width}px viewport after resize.`, evidence: ev });
  }
  if (bufferChanged && ev.drawCallsAfterResize === 0) {
    fail = true;
    col.issue({ ...base, check: '3d-resize', severity: 'major', selector: before.selector, key: 'no-redraw', message: 'Drawing buffer was resized (which clears it) but no draw call followed — the canvas is likely blank after resize.', evidence: ev });
  }
  col.run('3d-resize', { ...base, status: fail ? 'failed' : 'passed', details: ev });
}

/**
 * Pointer (and touch) input over the largest canvas; checks for new errors.
 * @param {import('playwright').Page} page @param {any} watch @param {any} ctx @param {any} out @param {boolean} touchOnly
 */
export async function runInteraction(page, watch, ctx, out, touchOnly) {
  const { col, route, viewport } = ctx; const base = { route, viewport };
  const snap = await page.evaluate(pageSnapshot3D);
  const cv = snap?.canvases.filter((c) => c.connected && c.visible).sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
  if (!cv) { col.run('3d-interaction', { ...base, status: 'skipped', ran: false, reason: 'no visible on-screen canvas with a 3D context' }); return; }
  await page.evaluate((s) => { const el = document.querySelector(s); if (el) el.scrollIntoView({ block: 'center' }); }, cv.selector).catch(() => {});
  await page.waitForTimeout(100);
  const box = await page.locator(cv.selector).first().boundingBox().catch(() => null);
  if (!box) { col.run('3d-interaction', { ...base, status: 'skipped', ran: false, reason: 'canvas has no bounding box' }); return; }
  const vp = page.viewportSize() ?? { width: 1280, height: 720 };
  const cx = Math.min(vp.width - 2, Math.max(1, box.x + box.width / 2)); const cy = Math.min(vp.height - 2, Math.max(1, box.y + box.height / 2));
  const mark = watch.mark();
  const gestures = [];
  try {
    if (!touchOnly) {
      await page.mouse.move(cx, cy);
      await page.mouse.move(cx + 20, cy + 10, { steps: 4 });
      await page.mouse.down();
      await page.mouse.move(cx + 80, cy + 40, { steps: 6 });
      await page.mouse.up();
      await page.mouse.wheel(0, 120);
      await page.mouse.wheel(0, -120);
      gestures.push('pointer move', 'drag', 'wheel');
    }
    if (ctx.vp.hasTouch) {
      await page.touchscreen.tap(cx, cy);
      const cdp = await page.context().newCDPSession(page);
      const pt = (x, y) => [{ x: Math.round(x), y: Math.round(y), id: 1 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(cx, cy) });
      for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(cx + i * 10, cy + i * 6) });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach().catch(() => {});
      gestures.push('tap', 'touch drag');
    }
  } catch (err) { gestures.push(`(input dispatch error: ${String(/** @type {any} */ (err).message).split('\n')[0]})`); }
  await page.waitForTimeout(350);
  const errs = watch.since(mark);
  const texts = [...errs.pageErrors.map((e) => `Uncaught: ${e.text}`), ...errs.consoleErrors.map((e) => `console.error: ${e.text}`)];
  const ev = { canvas: cv.selector, gestures, newErrors: texts.slice(0, 5) };
  (out.interaction ??= {})[viewport] = ev;
  if (texts.length) col.issue({ ...base, check: '3d-interaction', severity: 'major', selector: cv.selector, key: texts[0].slice(0, 80), message: `Input over the canvas (${gestures.join(', ')}) raised ${texts.length} error(s): ${texts[0].slice(0, 160)}`, evidence: ev });
  col.run('3d-interaction', { ...base, status: texts.length ? 'failed' : 'passed', details: ev });
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
}

async function runCleanup(page, url, watch, ctx, out) {
  const { col, route, viewport } = ctx; const base = { route, viewport };
  // register last, so the page's own pagehide handlers have already run when we read the hook
  await page.evaluate(() => {
    window.addEventListener('pagehide', () => {
      try { const h = /** @type {any} */ (window).__MAQUETTEKIT_3D__; sessionStorage.setItem('__s3vd_pagehide__', JSON.stringify({ disposed: h && typeof h.disposed === 'number' ? h.disposed : null, hook: !!h })); } catch { /* ignore */ }
    });
  });
  const before = await page.evaluate(pageSnapshot3D);
  await page.goto('about:blank').catch(() => {});
  const mark = watch.mark();
  await gotoStable(page, url, { settleMs: 600 });
  const after = await page.evaluate(pageSnapshot3D);
  const stored = await page.evaluate(() => { try { const v = sessionStorage.getItem('__s3vd_pagehide__'); sessionStorage.removeItem('__s3vd_pagehide__'); return v ? JSON.parse(v) : null; } catch { return null; } });
  const errs = watch.since(mark);
  const reinit = !!after && after.contexts.some((c) => c.ok);
  const ev = {
    disposedBeforeLeave: before?.hook?.disposed ?? null, disposedAtPagehide: stored?.disposed ?? null, hookPresent: !!before?.hook,
    reinitialisedAfterReturn: reinit, errorsAfterReturn: [...errs.pageErrors.map((e) => e.text), ...errs.consoleErrors.map((e) => e.text)].slice(0, 5),
    contextRelease: 'not observable passively (the browser does not report GPU context release on navigation)',
  };
  out.cleanup = ev;
  let fail = false;
  if (!reinit) { fail = true; col.issue({ ...base, check: '3d-cleanup', severity: 'major', key: 'reinit', message: 'After navigating away and back, the page did not obtain a WebGL/WebGPU context again.', evidence: ev }); }
  if (ev.errorsAfterReturn.length) { fail = true; col.issue({ ...base, check: '3d-cleanup', severity: 'major', key: 'errors', message: `Errors after navigating away and back: ${ev.errorsAfterReturn[0].slice(0, 160)}`, evidence: ev }); }
  const disposedObserved = typeof ev.disposedAtPagehide === 'number';
  if (fail) col.run('3d-cleanup', { ...base, status: 'failed', details: ev });
  else if (disposedObserved && ev.disposedAtPagehide > (ev.disposedBeforeLeave ?? 0)) col.run('3d-cleanup', { ...base, status: 'passed', details: ev });
  else {
    const reason = disposedObserved ? 'window.__MAQUETTEKIT_3D__.disposed did not increase on pagehide; GPU resource release is not observable passively' : 'page does not expose window.__MAQUETTEKIT_3D__.disposed; GPU resource release is not observable passively — only re-initialisation after navigation was verified';
    col.run('3d-cleanup', { ...base, status: 'limited', reason, details: ev });
    col.limit(`3D cleanup on ${route}: ${reason}.`);
  }
}

async function runFallback(url, ctx, out) {
  const { col, route, viewport } = ctx; const base = { route, viewport };
  /** @type {import('playwright').BrowserContext | null} */ let context = null;
  try {
    const browser = await ctx.getNoGpuBrowser();
    context = await newContext(browser, /** @type {any} */ (ctx.vp));
    await context.addInitScript(installPageHelpers);
    await context.addInitScript(instrument3D, { forceNoGL: true });
    const page = await context.newPage();
    const watch = attachWatchers(page);
    await gotoStable(page, url, { settleMs: 900 });
    const snap = await page.evaluate(pageSnapshot3D);
    const containers = (out.canvases ?? []).map((c) => c.container).filter(Boolean);
    const fb = await page.evaluate(pageDetectFallback, containers);
    const rel = `screenshots/${routeSlug(route)}/${viewport}-fallback-no-webgl.png`;
    fs.mkdirSync(path.dirname(path.join(ctx.outDir, rel)), { recursive: true });
    await page.screenshot({ path: path.join(ctx.outDir, rel) });
    const uncaught = watch.pageErrors.map((e) => e.text);
    const consoleErrs = watch.consoleErrors.map((e) => e.text).filter((t) => !/^Failed to load resource/i.test(t));
    const ev = {
      simulation: 'second Chromium launched with GPU/WebGL disabled; getContext("webgl*"|"webgpu") forced to return null',
      contextRequests: snap?.contexts.length ?? 0, contextsObtained: snap?.contexts.filter((c) => c.ok).length ?? 0,
      fallback: fb, uncaughtErrors: uncaught.slice(0, 5), consoleErrors: consoleErrs.slice(0, 5), screenshot: rel,
    };
    out.fallback = ev;
    let fail = false;
    if (uncaught.length) { fail = true; col.issue({ ...base, check: '3d-fallback', severity: 'major', key: 'throws', message: `Page throws when WebGL is unavailable: ${uncaught[0].slice(0, 160)}`, evidence: ev }); }
    if (!fb.found) {
      fail = true;
      col.issue({ ...base, check: '3d-fallback', severity: 'major', selector: out.canvases?.[0]?.selector, key: 'no-fallback',
        message: fb.canvasIsChildOfBody ? 'No fallback content detected when WebGL is unavailable (canvas is a direct child of <body>; mark fallback content with [data-maquettekit-fallback]).' : 'No fallback content is shown when WebGL is unavailable (no [data-maquettekit-fallback], image or text in the canvas container).', evidence: ev });
    }
    col.run('3d-fallback', { ...base, status: fail ? 'failed' : 'passed', details: ev });
  } catch (err) {
    const msg = String(/** @type {any} */ (err).message).split('\n')[0];
    col.run('3d-fallback', { ...base, status: 'skipped', ran: false, reason: `no-WebGL browser could not be used: ${msg}` });
    col.limit(`3D fallback check skipped on ${route}: ${msg}`);
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

/** Lazily launched browser with the graphics stack disabled. */
export function noGpuBrowserFactory() {
  /** @type {Promise<import('playwright').Browser> | null} */ let p = null;
  return { get: () => (p ??= launchBrowser({ gpu: false })), close: async () => { if (p) await p.then((b) => b.close()).catch(() => {}); } };
}
