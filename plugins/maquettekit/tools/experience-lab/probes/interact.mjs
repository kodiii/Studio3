// @ts-check
/**
 * Node-side probes that drive the page: motion sampling, keyboard walk, hover/press, input latency,
 * popups, empty-form submission, axe-core, 404 and no-WebGL fallback. Every probe returns data
 * (never throws for page quirks) with `status` and `reason` when it could not run.
 * Reuses Visual Director page functions and utilities read-only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { gotoStable, newContext } from '../../lib/browser.mjs';
import { loadPngTools } from '../../visual-director/util.mjs';
import { pageKeyboardPrep, pageKeyboardStop, pageKeyboardFinish } from '../../visual-director/checks/keyboard.mjs';
import { pageFindTriggers, pagePopupState } from '../../visual-director/capture.mjs';
import { pageDetectFallback } from '../../visual-director/three-d/diagnostics.mjs';
import { installPageHelpers } from '../../visual-director/page/helpers.mjs';
import { instrument3D } from '../../visual-director/three-d/instrument.mjs';
import { loadAxeSource, AXE_TAGS } from '../../visual-director/checks/a11y.mjs';
import { pageHoverCandidates, pageSnapHover, pageTabGeometry, pageLatencyCandidates, pageFormsList, pageFormArm, pageFormAfter, pageNotFound } from './page.mjs';

const msg = (err) => String(/** @type {any} */ (err)?.message ?? err).split('\n')[0];
export const PIXEL_THRESHOLD = 0.001; // share of pixels that must change between two frames to count as motion

/** @type {Promise<any> | null} */ let toolsP = null;
const pngTools = () => (toolsP ??= loadPngTools().catch(() => null));

/** Share of differing pixels between two decoded images, optionally inside a rect (viewport px). */
function imgDiff(tools, a, b, rect) {
  const W = Math.min(a.width, b.width); const Hh = Math.min(a.height, b.height);
  const x0 = Math.max(0, Math.floor(rect?.x ?? 0)); const y0 = Math.max(0, Math.floor(rect?.y ?? 0));
  const x1 = Math.min(W, Math.ceil(rect ? rect.x + rect.width : W)); const y1 = Math.min(Hh, Math.ceil(rect ? rect.y + rect.height : Hh));
  const w = x1 - x0; const h = y1 - y0;
  if (w < 4 || h < 4) return null;
  const ca = Buffer.alloc(w * h * 4); const cb = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    a.data.copy(ca, y * w * 4, ((y0 + y) * a.width + x0) * 4, ((y0 + y) * a.width + x1) * 4);
    b.data.copy(cb, y * w * 4, ((y0 + y) * b.width + x0) * 4, ((y0 + y) * b.width + x1) * 4);
  }
  return tools.pixelmatch(ca, cb, null, w, h, { threshold: 0.1 }) / (w * h);
}

/**
 * Take `n` viewport screenshots 400 ms apart (scroll 0) and diff consecutive frames, for the whole view and
 * for the 3D canvas when one is given (cropped from the frames, or clipped after scrolling it into view).
 * @param {import('playwright').Page} page @param {number} n @param {{x:number,y:number,width:number,height:number}|null} canvas document rect
 */
export async function motionFrames(page, n, canvas) {
  const tools = await pngTools();
  if (!tools) return { available: false, reason: 'pngjs/pixelmatch unavailable (pixel sampling skipped)' };
  try {
    await page.evaluate(() => window.scrollTo(0, 0));
    const vp = page.viewportSize() ?? { width: 1280, height: 720 };
    const frames = [];
    for (let k = 0; k < n; k++) { if (k) await page.waitForTimeout(400); frames.push(tools.PNG.sync.read(await page.screenshot({ caret: 'hide' }))); }
    const d = []; for (let k = 1; k < n; k++) d.push(imgDiff(tools, frames[k - 1], frames[k], null));
    let cd = null;
    if (canvas) {
      const visibleH = Math.min(vp.height, canvas.y + canvas.height) - Math.max(0, canvas.y);
      if (visibleH >= Math.min(100, canvas.height)) {
        const rect = { x: canvas.x, y: Math.max(0, canvas.y), width: canvas.width, height: visibleH };
        cd = []; for (let k = 1; k < n; k++) cd.push(imgDiff(tools, frames[k - 1], frames[k], rect));
      } else {
        await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 40)), canvas.y);
        await page.waitForTimeout(150);
        const sy = await page.evaluate(() => window.scrollY);
        const clip = { x: Math.max(0, canvas.x), y: Math.max(0, canvas.y - sy), width: Math.min(canvas.width, vp.width - Math.max(0, canvas.x)), height: Math.min(canvas.height, vp.height - Math.max(0, canvas.y - sy)) };
        const cf = [];
        for (let k = 0; k < n; k++) { if (k) await page.waitForTimeout(400); cf.push(tools.PNG.sync.read(await page.screenshot({ clip, caret: 'hide' }))); }
        cd = []; for (let k = 1; k < n; k++) cd.push(imgDiff(tools, cf[k - 1], cf[k], null));
        await page.evaluate(() => window.scrollTo(0, 0));
      }
    }
    const r5 = (x) => (x == null ? null : Math.round(x * 100000) / 100000);
    return { available: true, diffs: d.map(r5), continuous: d.every((x) => x != null && x > PIXEL_THRESHOLD), canvasDiffs: cd ? cd.map(r5) : null, canvasContinuous: cd ? cd.every((x) => x != null && x > PIXEL_THRESHOLD) : null };
  } catch (err) { return { available: false, reason: `pixel sampling failed: ${msg(err)}` }; }
}

/** Tab walk (≤ maxStops) using Visual Director's keyboard page functions, with screenshot-confirmed focus indicators. */
export async function probeKeyboard(page, { maxStops = 40 } = {}) {
  try {
    const urlBefore = page.url();
    const prep = await page.evaluate(pageKeyboardPrep);
    /** @type {any[]} */ const stops = []; let complete = false; /** @type {any} */ let trap = null;
    for (let i = 0; i < maxStops + 1; i++) {
      await page.keyboard.press('Tab');
      const s = await page.evaluate(pageKeyboardStop);
      if (s.body) { if (stops.length || i > 0) { complete = true; break; } continue; }
      if (s.sameAsPrev) {
        await page.keyboard.press('Tab');
        const again = await page.evaluate(pageKeyboardStop);
        if (!again.body && again.sameAsPrev) { if (prep.focusableCount > 1) trap = { type: 'stuck', selector: s.selector }; complete = prep.focusableCount <= 1; break; }
        if (again.body) { complete = true; break; }
        stops.push(again); continue;
      }
      if (s.seenBeforeAt === 0) { complete = true; break; }
      if (s.seenBeforeAt > 0) { trap = { type: 'cycle', selector: s.selector, cycleStartsAt: s.seenBeforeAt }; break; }
      stops.push(s);
    }
    const urlChanged = page.url() !== urlBefore;
    const fin = await page.evaluate(pageKeyboardFinish);
    // suspects: no computed-style change on focus → confirm with a focused-vs-blurred screenshot diff
    const tools = await pngTools();
    const noIndicator = []; let confirmedByPixels = 0;
    for (const s of stops.filter((x) => !x.indicator.outline && x.indicator.changed.length === 0)) {
      let visibleChange = false;
      if (tools) {
        try {
          const clip = await page.evaluate((i) => {
            const el = /** @type {any} */ (window).__S3VD__.kb.seq[i];
            el.scrollIntoView({ block: 'center', inline: 'center' }); el.focus();
            const r = el.getBoundingClientRect(); const p = 6; const x = Math.max(0, r.left - p); const y = Math.max(0, r.top - p);
            return { x, y, width: Math.max(1, Math.min(innerWidth - x, r.width + 2 * p)), height: Math.max(1, Math.min(innerHeight - y, r.height + 2 * p)) };
          }, s.index);
          const a = tools.PNG.sync.read(await page.screenshot({ clip, animations: 'disabled', caret: 'hide' }));
          await page.evaluate((i) => /** @type {any} */ (window).__S3VD__.kb.seq[i].blur(), s.index);
          const b = tools.PNG.sync.read(await page.screenshot({ clip, animations: 'disabled', caret: 'hide' }));
          const ratio = imgDiff(tools, a, b, null);
          visibleChange = ratio != null && ratio * a.width * a.height > Math.max(4, a.width * a.height * 0.002);
        } catch { /* fall back to the computed-style verdict */ }
      }
      if (visibleChange) confirmedByPixels++; else noIndicator.push(`${s.selector}${s.text ? ` ("${s.text}")` : ''}`);
    }
    const geo = await page.evaluate(pageTabGeometry);
    await page.evaluate(() => { const a = /** @type {any} */ (document.activeElement); if (a && a.blur) a.blur(); window.scrollTo(0, 0); }).catch(() => {});
    return {
      status: 'measured', stops: stops.length, expectedFocusable: prep.focusableCount, complete, truncated: !complete && !trap, trap,
      nonFocusable: prep.nonFocusable, missed: complete || trap ? fin.missed : [], noIndicator, confirmedByPixels, urlChanged,
      geometry: geo?.stops ?? [], skip: geo?.skip ?? null, firstStop: geo?.firstStop ?? null,
    };
  } catch (err) { return { status: 'unavailable', reason: `keyboard walk failed: ${msg(err)}` }; }
}

const kebab = (k) => k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
/** Properties whose computed value differs. */
function changedKeys(a, b) { return a && b ? Object.keys(b).filter((k) => !k.endsWith(':transitionDuration') && a[k] !== b[k]) : []; }
/** Is at least one changed property covered by a transition with duration > 0? */
function transitioned(changed, snap) {
  const props = snap.transition.property.split(',').map((x) => x.trim());
  const durs = snap.transition.duration.split(',').map((x) => parseFloat(x) * (x.trim().endsWith('ms') ? 1 : 1000) || 0);
  return changed.some((k) => {
    if (k.startsWith('::')) return (parseFloat(snap.style[`${k.split(':').slice(0, 3).join(':')}:transitionDuration`] ?? '0') || 0) > 0;
    const kb = kebab(k);
    return props.some((p, i) => (durs[i % durs.length] || 0) > 0 && (p === 'all' || p === kb || kb.startsWith(p + '-')));
  });
}

/** Hover each candidate with the mouse; for buttons also hold the button down (released elsewhere, so nothing is clicked). */
export async function probeHover(page, url, { max = 8 } = {}) {
  try {
    const cands = await page.evaluate(pageHoverCandidates, max);
    const vp = page.viewportSize() ?? { width: 1280, height: 720 };
    const results = [];
    for (const c of cands) {
      try {
        const loc = page.locator(`[data-s3xl-hover="${c.i}"]`).first();
        await loc.scrollIntoViewIfNeeded({ timeout: 1500 });
        const box = await loc.boundingBox();
        if (!box) continue;
        const rest = box.y < vp.height / 2 ? { x: vp.width - 3, y: vp.height - 3 } : { x: 3, y: 3 };
        await page.mouse.move(rest.x, rest.y); await page.waitForTimeout(60);
        const s0 = await page.evaluate(pageSnapHover, c.i);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 2 }); await page.waitForTimeout(200);
        const s1 = await page.evaluate(pageSnapHover, c.i);
        let s2 = null;
        if (c.kind === 'button') {
          await page.mouse.down(); await page.waitForTimeout(70);
          s2 = await page.evaluate(pageSnapHover, c.i);
          await page.mouse.move(rest.x, rest.y, { steps: 2 }); await page.mouse.up();
        } else await page.mouse.move(rest.x, rest.y);
        await page.evaluate(() => { const a = /** @type {any} */ (document.activeElement); if (a && a !== document.body && a.blur) a.blur(); getSelection()?.removeAllRanges(); });
        if (page.url() !== url) { await gotoStable(page, url, { settleMs: 200 }); break; }
        const hoverChanged = changedKeys(s0?.style, s1?.style);
        results.push({ selector: c.selector, kind: c.kind, text: c.text, hoverChanged, transitioned: hoverChanged.length && s1 ? transitioned(hoverChanged, s1) : null, activeChanged: s2 ? changedKeys(s1?.style, s2.style) : null });
      } catch (err) { results.push({ selector: c.selector, kind: c.kind, error: msg(err) }); }
    }
    return { status: 'measured', sampled: results.filter((r) => !r.error).length, results };
  } catch (err) { return { status: 'unavailable', reason: `hover probe failed: ${msg(err)}` }; }
}

/** Click up to `max` safe controls twice each; report the slowest interaction (INP-style worst case). */
export async function probeLatency(page, url, { max = 2 } = {}) {
  try {
    const cands = await page.evaluate(pageLatencyCandidates, max);
    if (!cands.length) return { status: 'not-applicable', reason: 'no safe sample control (disclosure toggle or type="button" outside forms) on this page' };
    const samples = [];
    for (const cand of cands) {
      await page.evaluate(() => { const S = /** @type {any} */ (window).__S3XL__; S.manual.length = 0; S.perf.events.length = 0; S.armed = true; });
      for (let k = 0; k < 2; k++) {
        await page.locator(`[data-s3xl-latency="${cand.i}"]`).first().click({ timeout: 3000 });
        await page.waitForTimeout(450);
        if (page.url() !== url) break;
      }
      if (page.url() !== url) { await gotoStable(page, url, { settleMs: 200 }); samples.push({ ...cand, status: 'unavailable', reason: 'navigated away' }); break; }
      const data = await page.evaluate(() => { const S = /** @type {any} */ (window).__S3XL__; S.armed = false; return { manual: S.manual.slice(), events: S.perf.events.slice() }; });
      const et = data.events.filter((e) => ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click'].includes(e.name));
      const man = data.manual.filter((m) => ['pointerdown', 'mousedown', 'click'].includes(m.type));
      const etMax = et.length ? Math.max(...et.map((e) => e.duration)) : null;
      const manMax = man.length ? Math.round(Math.max(...man.map((m) => m.ms))) : null;
      if (etMax == null && manMax == null) { samples.push({ ...cand, status: 'unavailable', reason: 'no input timing recorded' }); continue; }
      samples.push({ ...cand, status: 'measured', latencyMs: Math.round(Math.max(etMax ?? 0, manMax ?? 0)), eventTimingMaxMs: etMax, nextFrameMaxMs: manMax, method: etMax != null ? 'Event Timing (interaction ≥ 16 ms)' : 'pointer → next frame probe' });
    }
    const got = samples.filter((x) => x.status === 'measured');
    if (!got.length) return { status: 'unavailable', reason: samples[0]?.reason ?? 'no input timing recorded', samples };
    const worst = got.reduce((w, x) => (x.latencyMs > w.latencyMs ? x : w));
    return { status: 'measured', selector: worst.selector, text: worst.text, kind: worst.kind, latencyMs: worst.latencyMs, method: worst.method, samples };
  } catch (err) { return { status: 'unavailable', reason: `latency probe failed: ${msg(err)}` }; }
}

const FOCUS_KINDS = new Set(['dialog', 'alertdialog', 'menu', 'listbox']);
/** Open auto-discovered triggers with Enter (click only to tell "not a trigger" from "not keyboard operable"). */
export async function probePopups(page, url, { max = 3 } = {}) {
  try {
    const found = await page.evaluate(pageFindTriggers, max);
    const results = [];
    const state = (sel) => page.evaluate(pagePopupState, { trigger: sel });
    const opened = (a, b) => {
      const before = new Set(b.popups.map((p) => p.selector));
      const fresh = a.popups.filter((p) => !before.has(p.selector));
      return { fresh, any: fresh.length > 0 || (a.controlledVisible === true && b.controlledVisible !== true) || (a.expanded === 'true' && b.expanded !== 'true') };
    };
    for (const t of found.triggers.slice(0, max)) {
      try {
        const loc = page.locator(t.selector).first();
        const before = await state(t.selector);
        await loc.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {});
        await loc.focus({ timeout: 1500 }).catch(() => {});
        await page.keyboard.press('Enter'); await page.waitForTimeout(350);
        let after = await state(t.selector);
        if (after.url !== before.url) { results.push({ selector: t.selector, kind: t.kind, result: 'navigated' }); await gotoStable(page, url, { settleMs: 200 }); continue; }
        let o = opened(after, before); let via = 'keyboard';
        if (!o.any) {
          await loc.click({ timeout: 2500 }); await page.waitForTimeout(350);
          const ac = await state(t.selector);
          if (ac.url !== before.url) { results.push({ selector: t.selector, kind: t.kind, result: 'navigated' }); await gotoStable(page, url, { settleMs: 200 }); continue; }
          const oc = opened(ac, before);
          if (!oc.any) { results.push({ selector: t.selector, kind: t.kind, result: 'no-change' }); continue; }
          via = 'click-only'; after = ac; o = oc;
        }
        const popup = o.fresh[0] ?? (after.controlledVisible ? { selector: after.controlledSelector, kind: 'region', containsFocus: !!after.controlledContainsFocus } : null);
        /** @type {any} */ const rec = { selector: t.selector, kind: t.kind, text: t.text, result: 'opened', openedBy: via, popup: popup?.selector ?? null, popupKind: popup?.kind ?? null, checks: { enter: via === 'keyboard' } };
        if (before.expanded !== null) {
          const shown = o.fresh.length > 0 || after.controlledVisible === true;
          rec.expandedState = { before: before.expanded, after: after.expanded, controlledVisible: after.controlledVisible, ok: after.expanded === 'true' ? after.controlledVisible !== false : !shown };
        }
        if (popup && FOCUS_KINDS.has(popup.kind)) {
          rec.checks.focusInside = !!popup.containsFocus;
          await page.keyboard.press('Escape'); await page.waitForTimeout(300);
          const closed = await state(t.selector);
          const stillOpen = closed.popups.some((p) => p.selector === popup.selector);
          rec.checks.escapeCloses = !stillOpen;
          rec.checks.focusReturned = !stillOpen && closed.focusOnTrigger;
          if (stillOpen) await gotoStable(page, url, { settleMs: 200 });
        } else {
          if (via === 'keyboard') { await loc.focus({ timeout: 1000 }).catch(() => {}); await page.keyboard.press('Enter'); } else await loc.click({ timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(250);
          const closed = await state(t.selector);
          if (closed.expanded === 'true' || closed.controlledVisible) await gotoStable(page, url, { settleMs: 200 });
        }
        const vals = Object.values(rec.checks).map((v) => (v ? 1 : 0));
        rec.score = vals.reduce((s, v) => s + v, 0) / vals.length;
        results.push(rec);
      } catch (err) { results.push({ selector: t.selector, kind: t.kind, result: 'failed', error: msg(err) }); await gotoStable(page, url, { settleMs: 200 }).catch(() => {}); }
    }
    return { status: 'measured', triggers: found.triggers.length, results };
  } catch (err) { return { status: 'unavailable', reason: `popup probe failed: ${msg(err)}` }; }
}

/** Submit each testable form empty (non-GET requests blocked, navigation prevented) and score the validation. */
export async function probeForms(page, url, { max = 2 } = {}) {
  const forms = await page.evaluate(pageFormsList).catch(() => []);
  if (!forms.length) return { status: 'not-applicable', reason: 'no form with a text field (search forms excluded)', tested: [] };
  const block = (route) => { const m = route.request().method(); return m === 'GET' || m === 'HEAD' ? route.continue() : route.abort('blockedbyclient'); };
  await page.route('**/*', block);
  const tested = [];
  try {
    for (const f of forms.slice(0, max)) {
      try {
        await gotoStable(page, url, { settleMs: 250 });
        const arm = await page.evaluate(pageFormArm, f.index);
        if (!arm) continue;
        const urlBefore = page.url();
        if (arm.hasSubmit) await page.locator('[data-s3xl-submit]').first().click({ timeout: 3000 });
        else await page.evaluate(() => /** @type {any} */ (document.querySelector('[data-s3xl-form]')).requestSubmit());
        await page.waitForTimeout(500);
        const navigated = page.url() !== urlBefore;
        const after = navigated ? null : await page.evaluate(pageFormAfter);
        /** @type {any} */ const c = {};
        if (!after) Object.assign(c, { blocked: 0, identified: 0, described: 0, focus: 0, required: 0 });
        else {
          const invalid = after.fields.filter((x) => x.ariaInvalid || x.nativeInvalid);
          c.blocked = after.submitFired && after.prevented === false ? 0 : 1;
          c.identified = after.fields.some((x) => x.ariaInvalid) ? 1 : after.invalidEvents > 0 ? 0.5 : 0;
          c.described = invalid.some((x) => x.described) ? 1 : after.liveAfter.length > after.liveBefore.length ? 0.5 : 0;
          c.focus = after.activeInvalid || after.activeAlert ? 1 : 0;
          c.required = after.requiredBefore > 0 ? 1 : 0;
        }
        const score = Object.values(c).reduce((s, v) => s + v, 0) / 5;
        tested.push({ selector: arm.selector, fields: arm.fields, noValidate: arm.noValidate, navigated, criteria: c, score, details: after ? { submitFired: after.submitFired, pagePrevented: after.prevented, nativeInvalidEvents: after.invalidEvents, ariaInvalid: after.fields.filter((x) => x.ariaInvalid).length, describedErrors: after.fields.filter((x) => x.described).length, focusAfter: after.active, visibleErrorText: after.visibleErrorText } : null });
      } catch (err) { tested.push({ selector: f.selector, error: msg(err) }); }
    }
  } finally {
    await page.unroute('**/*', block).catch(() => {});
  }
  return { status: tested.some((t) => !t.error) ? 'measured' : 'unavailable', reason: tested.every((t) => t.error) ? tested[0]?.error : undefined, tested };
}

/** axe-core: WCAG A/AA violations (contrast and target size excluded) + a separate color-contrast pass/fail count. */
export async function probeAxe(page) {
  const { source, reason } = loadAxeSource();
  if (!source) return { status: 'unavailable', reason };
  try {
    await page.evaluate(source);
    const res = await page.evaluate(async (tags) => {
      const ax = /** @type {any} */ (window).axe;
      const main = await ax.run(document, { runOnly: { type: 'tag', values: tags }, rules: { 'color-contrast': { enabled: false }, 'target-size': { enabled: false } }, resultTypes: ['violations'] });
      const cc = await ax.run(document, { runOnly: { type: 'rule', values: ['color-contrast'] }, resultTypes: ['violations', 'passes', 'incomplete'] });
      const pick = (v) => ({ id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl, nodes: v.nodes.length, targets: v.nodes.slice(0, 4).map((n) => [].concat(n.target).join(' ')) });
      const ccv = cc.violations[0];
      return {
        engine: main.testEngine ? main.testEngine.version : null, violations: main.violations.map(pick),
        contrast: {
          pass: cc.passes.reduce((s, r) => s + r.nodes.length, 0), fail: ccv ? ccv.nodes.length : 0, incomplete: cc.incomplete.reduce((s, r) => s + r.nodes.length, 0),
          failures: ccv ? ccv.nodes.slice(0, 8).map((n) => ({ target: [].concat(n.target).join(' '), summary: String(n.failureSummary || '').split('\n').slice(1, 2).join(' ').trim().slice(0, 170) })) : [],
        },
      };
    }, AXE_TAGS);
    return { status: 'measured', ...res };
  } catch (err) { return { status: 'unavailable', reason: `axe-core failed to execute: ${msg(err)}` }; }
}

export const NOT_FOUND_PATH = '/maquettekit-experience-lab-404-probe';
/** Request a route that does not exist. In --serve mode a root 404.html is served like static hosts do. */
export async function probeNotFound(context, baseUrl, serveDir) {
  const page = await context.newPage();
  try {
    const url = baseUrl + NOT_FOUND_PATH;
    const custom = serveDir ? path.join(serveDir, '404.html') : null;
    const emulate = !!custom && fs.existsSync(custom);
    if (emulate) await page.route(url, async (route) => { const res = await route.fetch(); return res.status() === 404 ? route.fulfill({ status: 404, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(/** @type {string} */ (custom)) }) : route.fulfill({ response: res }); });
    const resp = await page.goto(url, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(300);
    const info = await page.evaluate(pageNotFound);
    const status = resp?.status() ?? null;
    const parts = { status404: status === 404 || status === 410 ? 0.4 : 0, explains: info.explains ? 0.3 : 0, wayBack: info.homeLink || (info.nav && info.links >= 2) ? 0.3 : 0 };
    return { status: 'measured', url: NOT_FOUND_PATH, httpStatus: status, emulated404Html: emulate, ...info, parts, score: Math.round((parts.status404 + parts.explains + parts.wayBack) * 100) / 100 };
  } catch (err) { return { status: 'unavailable', reason: `404 probe failed: ${msg(err)}` }; }
  finally { await page.close().catch(() => {}); }
}

/** Reload a 3D route in a no-GPU browser with getContext forced to null; detect fallback content and errors. */
export async function probeFallback(getBrowser, url, viewport, containers, shotFile) {
  /** @type {any} */ let context = null;
  try {
    const browser = await getBrowser();
    context = await newContext(browser, viewport);
    await context.addInitScript(installPageHelpers);
    await context.addInitScript(instrument3D, { forceNoGL: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e?.message ?? e).slice(0, 200)));
    await gotoStable(page, url, { settleMs: 800 });
    const fb = await page.evaluate(pageDetectFallback, containers);
    fs.mkdirSync(path.dirname(shotFile), { recursive: true });
    await page.screenshot({ path: shotFile });
    return { status: 'measured', fallback: fb, uncaughtErrors: errors.slice(0, 5), score: fb.found ? (errors.length ? 0.5 : 1) : 0 };
  } catch (err) { return { status: 'unavailable', reason: `no-WebGL browser could not be used: ${msg(err)}` }; }
  finally { if (context) await context.close().catch(() => {}); }
}
