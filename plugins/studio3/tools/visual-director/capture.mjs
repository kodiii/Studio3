// @ts-check
/** Screenshot, animation-frame, interactive-state and video capture. */
import fs from 'node:fs';
import path from 'node:path';
import { gotoStable, newContext } from '../lib/browser.mjs';
import { nameSlug, routeSlug } from './util.mjs';

export const FRAME_OFFSETS_MS = [0, 150, 400, 900];
export const SCROLL_THROUGH = { maxSteps: 40, pauseMs: 120, maxMs: 8000 };

/**
 * Scroll-through pass, run before the DOM and axe checks: scroll the document, and the page's main scroller
 * (an inner overflow-auto/scroll element covering ≥ 40% of the viewport) if it has one, to the bottom in
 * ~0.8-viewport steps with a short pause per step, so IntersectionObserver, scroll-event and ScrollTrigger
 * reveals fire; then return to the top. Bounded by `maxSteps` and `maxMs` (shared by all scrollers). Skipped
 * when nothing is taller than its viewport.
 * @param {import('playwright').Page} page
 * @param {{ maxSteps?: number, pauseMs?: number, maxMs?: number }} [opts]
 * @returns {Promise<{ ran: boolean, reason?: string, scrollers: string[], steps: number, scrolledPx: number, reachedBottom: boolean, ms: number }>}
 */
export async function scrollThrough(page, opts = {}) {
  const o = { ...SCROLL_THROUGH, ...opts };
  return page.evaluate(async (o) => {
    const H = /** @type {any} */ (window).__S3VD__;
    const de = document.documentElement; const body = document.body;
    const t0 = performance.now();
    const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));
    const sleep = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));
    const docRange = () => Math.max(de.scrollHeight, body ? body.scrollHeight : 0) - window.innerHeight;
    /** @type {{ label: string, el: any, range: () => number, view: number }[]} */ const scrollers = [];
    if (docRange() > 1) scrollers.push({ label: 'document', el: null, range: docRange, view: window.innerHeight });
    let main = null; let mainArea = 0;
    for (const el of /** @type {any[]} */ (Array.from(body ? body.querySelectorAll('*') : []).slice(0, 4000))) {
      if (el.scrollHeight <= el.clientHeight + 1) continue;
      const oy = getComputedStyle(el).overflowY;
      if (oy !== 'auto' && oy !== 'scroll') continue;
      const area = el.clientWidth * el.clientHeight;
      if (area > mainArea) { main = el; mainArea = area; }
    }
    if (main && mainArea >= 0.4 * window.innerWidth * window.innerHeight) {
      const m = main;
      scrollers.push({ label: H ? H.sel(m) : m.localName, el: m, range: () => m.scrollHeight - m.clientHeight, view: m.clientHeight });
    }
    if (!scrollers.length) return { ran: false, reason: 'page is not taller than the viewport', scrollers: [], steps: 0, scrolledPx: 0, reachedBottom: true, ms: 0 };
    const to = (/** @type {any} */ s, /** @type {number} */ y) => { if (s.el) s.el.scrollTop = y; else window.scrollTo({ top: y, left: 0, behavior: 'instant' }); };
    let steps = 0; let scrolledPx = 0; let reachedBottom = true;
    for (const s of scrollers) {
      let range = s.range();
      let step = Math.max(1, Math.round(s.view * 0.8));
      if (range / step > o.maxSteps) step = Math.min(s.view, Math.ceil(range / o.maxSteps)); // never skip past a viewport
      let y = 0; let done = false;
      while (steps < o.maxSteps && performance.now() - t0 < o.maxMs) {
        y = Math.min(range, y + step);
        to(s, y); steps++;
        await frame(); await sleep(o.pauseMs);
        range = Math.max(range, s.range()); // lazy sections can grow the page while it is scrolled
        if (y >= range) { done = true; break; }
      }
      scrolledPx += Math.round(y);
      if (!done) reachedBottom = false;
      to(s, 0);
    }
    await frame(); await frame();
    return { ran: true, scrollers: scrollers.map((s) => s.label), steps, scrolledPx, reachedBottom, ms: Math.round(performance.now() - t0) };
  }, o).catch((err) => ({ ran: false, reason: `scroll-through failed: ${String(err && err.message).split('\n')[0]}`, scrollers: [], steps: 0, scrolledPx: 0, reachedBottom: false, ms: 0 }));
}

/**
 * Full-page + above-the-fold screenshots.
 * @param {import('playwright').Page} page
 * @param {{ outDir: string, route: string, viewport: string, mode: 'normal' | 'reduced' }} ctx
 * @returns {Promise<string[]>} relative paths
 */
export async function captureScreenshots(page, ctx) {
  const dir = path.join(ctx.outDir, 'screenshots', routeSlug(ctx.route));
  fs.mkdirSync(dir, { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  const rel = (kind) => `screenshots/${routeSlug(ctx.route)}/${ctx.viewport}-${ctx.mode}-${kind}.png`;
  await page.screenshot({ path: path.join(ctx.outDir, rel('fold')) });
  await page.screenshot({ path: path.join(ctx.outDir, rel('full')), fullPage: true });
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  return [rel('fold'), rel('full')];
}

/**
 * Navigate and capture frames at fixed offsets after the load event.
 * @param {import('playwright').Page} page @param {string} url
 * @param {{ outDir: string, route: string, viewport: string }} ctx
 */
export async function captureFrames(page, url, ctx) {
  const dir = path.join(ctx.outDir, 'frames', routeSlug(ctx.route));
  fs.mkdirSync(dir, { recursive: true });
  const response = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  const t0 = Date.now();
  /** @type {{ file: string, offsetMs: number, actualMs: number }[]} */ const frames = [];
  for (const off of FRAME_OFFSETS_MS) {
    const wait = off - (Date.now() - t0);
    if (wait > 0) await page.waitForTimeout(wait);
    const actualMs = Date.now() - t0;
    const rel = `frames/${routeSlug(ctx.route)}/${ctx.viewport}-${String(off).padStart(4, '0')}ms.png`;
    await page.screenshot({ path: path.join(ctx.outDir, rel) });
    frames.push({ file: rel, offsetMs: off, actualMs });
  }
  return { response, frames };
}

/** Runs in the page: candidate triggers for auto-discovered states. */
export function pageFindTriggers(max) {
  const H = /** @type {any} */ (window).__S3VD__;
  const seen = new Set(); const out = [];
  const add = (el, kind) => {
    if (out.length >= max || seen.has(el) || !H.visible(el) || el.disabled) return;
    if (el.localName === 'a' && el.getAttribute('href') && !el.getAttribute('href').startsWith('#')) return; // would navigate
    seen.add(el); out.push({ selector: H.sel(el), kind, text: H.text(el, 30), haspopup: el.getAttribute('aria-haspopup'), controls: el.getAttribute('aria-controls') });
  };
  document.querySelectorAll('[aria-haspopup]:not([aria-haspopup="false"])').forEach((el) => add(el, 'haspopup'));
  document.querySelectorAll('[aria-expanded="false"]').forEach((el) => add(el, 'expandable'));
  document.querySelectorAll('button[popovertarget],button[commandfor]').forEach((el) => add(el, 'popover'));
  if (document.querySelector('dialog:not([open]),[role="dialog"],[role="alertdialog"]')) {
    document.querySelectorAll('button,[role="button"]').forEach((/** @type {any} */ el) => {
      const hay = [el.id, el.className && el.className.baseVal === undefined ? el.className : '', el.getAttribute('aria-controls'), el.getAttribute('onclick'), ...Array.from(el.attributes).filter((a) => a.name.startsWith('data-')).map((a) => a.name + '=' + a.value)].join(' ');
      if (/dialog|modal|drawer|popup|sheet/i.test(hay)) add(el, 'dialog-button');
    });
  }
  const primary = [];
  for (const el of /** @type {any[]} */ (Array.from(document.querySelectorAll('button,[role="button"],a[class*="btn"],a[class*="button"],a[class*="cta"],input[type="submit"]')))) {
    if (primary.length >= 2) break;
    if (!H.visible(el) || el.disabled) continue;
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) continue;
    primary.push({ selector: H.sel(el), text: H.text(el, 30) });
  }
  return { triggers: out, primary };
}

/** Runs in the page: visible popups + focus location. */
export function pagePopupState(arg) {
  const H = /** @type {any} */ (window).__S3VD__;
  const trigger = arg.trigger ? document.querySelector(arg.trigger) : null;
  const popups = Array.from(document.querySelectorAll(H.POPUP)).filter((el) => H.visible(el) && (!el.hasAttribute('popover') || el.matches(':popover-open') || el.matches('dialog[open],[role]')));
  const controlled = trigger && trigger.getAttribute('aria-controls') ? document.getElementById(trigger.getAttribute('aria-controls')) : null;
  const a = H.deepActive();
  const kindOf = (el) => el.localName === 'dialog' ? 'dialog' : (el.getAttribute('role') || (el.getAttribute('aria-modal') === 'true' ? 'dialog' : el.hasAttribute('popover') ? 'popover' : 'region'));
  return {
    popups: popups.map((el) => ({ selector: H.sel(el), kind: kindOf(el), containsFocus: !!a && el.contains(a) })),
    controlledVisible: controlled ? H.visible(controlled) : null,
    controlledSelector: controlled ? H.sel(controlled) : null,
    controlledContainsFocus: controlled && a ? controlled.contains(a) : null,
    expanded: trigger ? trigger.getAttribute('aria-expanded') : null,
    activeSelector: a && a !== document.body ? H.sel(a) : 'body',
    focusOnTrigger: !!trigger && a === trigger,
    url: location.href,
  };
}

const FOCUS_KINDS = new Set(['dialog', 'alertdialog', 'menu', 'listbox']);

/**
 * Auto-discovered + explicit interactive states, with dialog/menu focus checks.
 * @param {import('playwright').Page} page @param {string} url
 * @param {{ outDir: string, route: string, viewport: string, touch: boolean, col: any, explicit: any[], maxAuto?: number, watch: any }} ctx
 */
export async function captureStates(page, url, ctx) {
  const { col, route, viewport } = ctx;
  const base = { route, viewport };
  const slug = routeSlug(route);
  const dir = path.join(ctx.outDir, 'states', slug);
  fs.mkdirSync(dir, { recursive: true });
  /** @type {any[]} */ const states = [];
  const shot = async (name, clip) => {
    const rel = `states/${slug}/${viewport}-${nameSlug(name)}.png`;
    await page.screenshot({ path: path.join(ctx.outDir, rel), ...(clip ? { clip } : {}) });
    return rel;
  };
  const reload = async () => { await gotoStable(page, url, { settleMs: 150 }).catch(() => {}); };
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  const found = await page.evaluate(pageFindTriggers, ctx.maxAuto ?? 4);

  // ---- hover / focus of primary buttons -------------------------------------
  for (const [i, p] of found.primary.entries()) {
    try {
      const loc = page.locator(p.selector).first();
      const box = await loc.boundingBox();
      if (!box) continue;
      const vp = page.viewportSize() ?? { width: 1280, height: 720 };
      const x = Math.max(0, box.x - 24); const y = Math.max(0, box.y - 24);
      const clip = { x, y, width: Math.max(1, Math.min(vp.width - x, box.width + 48)), height: Math.max(1, Math.min(vp.height - y, box.height + 48)) };
      if (!ctx.touch) {
        await loc.hover({ timeout: 2000 });
        await page.waitForTimeout(250);
        states.push({ name: `primary-${i + 1}-hover`, kind: 'hover', auto: true, selector: p.selector, status: 'captured', file: await shot(`primary-${i + 1}-hover`, clip) });
        await page.mouse.move(0, 0);
      }
      await loc.focus({ timeout: 2000 });
      await page.waitForTimeout(150);
      states.push({ name: `primary-${i + 1}-focus`, kind: 'focus', auto: true, selector: p.selector, status: 'captured', file: await shot(`primary-${i + 1}-focus`, clip) });
      await page.evaluate(() => { const a = /** @type {any} */ (document.activeElement); if (a && a.blur) a.blur(); });
    } catch (err) {
      states.push({ name: `primary-${i + 1}`, kind: 'hover/focus', auto: true, selector: p.selector, status: 'failed', error: String(/** @type {any} */ (err).message).split('\n')[0] });
    }
  }

  // ---- popups: menus, dialogs, disclosures ----------------------------------
  let focusTested = 0; let focusFail = false;
  for (const [i, t] of found.triggers.entries()) {
    const name = `open-${i + 1}-${nameSlug(t.text || t.kind)}`;
    try {
      const before = await page.evaluate(pagePopupState, { trigger: t.selector });
      const loc = page.locator(t.selector).first();
      await loc.scrollIntoViewIfNeeded({ timeout: 2000 });
      await loc.focus({ timeout: 2000 }).catch(() => {});
      await loc.click({ timeout: 3000 });
      await page.waitForTimeout(350);
      const after = await page.evaluate(pagePopupState, { trigger: t.selector });
      if (after.url !== before.url) { states.push({ name, kind: t.kind, auto: true, selector: t.selector, status: 'skipped', note: 'click navigated away' }); await reload(); continue; }
      const beforeSel = new Set(before.popups.map((p) => p.selector));
      const opened = after.popups.filter((p) => !beforeSel.has(p.selector));
      const controlledOpened = after.controlledVisible === true && before.controlledVisible !== true;
      const expandedNow = after.expanded === 'true' && before.expanded !== 'true';
      if (!opened.length && !controlledOpened && !expandedNow) { states.push({ name, kind: t.kind, auto: true, selector: t.selector, status: 'no-change', note: 'click did not open a popup' }); continue; }
      const file = await shot(name);
      const popup = opened[0] ?? (controlledOpened ? { selector: after.controlledSelector, kind: 'region', containsFocus: !!after.controlledContainsFocus } : null);
      const kind = popup?.kind ?? 'region';
      /** @type {any} */ const st = { name, kind: t.kind, popupKind: kind, popup: popup?.selector ?? null, auto: true, selector: t.selector, status: 'captured', file };
      if (popup && FOCUS_KINDS.has(kind)) {
        focusTested++;
        const focusInside = popup.containsFocus;
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        const closed = await page.evaluate(pagePopupState, { trigger: t.selector });
        const stillOpen = closed.popups.some((p) => p.selector === popup.selector);
        st.focus = { movedInside: focusInside, escapeCloses: !stillOpen, focusReturned: !stillOpen ? closed.focusOnTrigger : null, activeAfterOpen: after.activeSelector, activeAfterEscape: closed.activeSelector };
        if (!focusInside) { focusFail = true; col.issue({ ...base, check: 'dialog-focus', severity: 'major', selector: t.selector, key: 'focus-not-moved', message: `Opening the ${kind} from ${t.selector} does not move focus into it (focus stayed on ${after.activeSelector}).`, evidence: { popup: popup.selector, kind, activeElement: after.activeSelector } }); }
        if (stillOpen) { focusFail = true; col.issue({ ...base, check: 'dialog-focus', severity: 'major', selector: t.selector, key: 'escape', message: `Escape does not close the ${kind} opened from ${t.selector}.`, evidence: { popup: popup.selector, kind } }); }
        else if (!closed.focusOnTrigger) { focusFail = true; col.issue({ ...base, check: 'dialog-focus', severity: 'minor', selector: t.selector, key: 'focus-return', message: `Focus does not return to ${t.selector} after closing the ${kind} (focus is on ${closed.activeSelector}).`, evidence: { popup: popup.selector, kind, activeElement: closed.activeSelector } }); }
        if (stillOpen) await reload();
      } else {
        // disclosure / generic region: try to close again, reload if that fails
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
        const closed = await page.evaluate(pagePopupState, { trigger: t.selector });
        if (closed.expanded === 'true' || closed.controlledVisible) { await loc.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(150); }
      }
      states.push(st);
    } catch (err) {
      states.push({ name, kind: t.kind, auto: true, selector: t.selector, status: 'failed', error: String(/** @type {any} */ (err).message).split('\n')[0] });
      await reload();
    }
  }
  if (focusTested) col.run('dialog-focus', { ...base, status: focusFail ? 'failed' : 'passed', details: { popupsTested: focusTested } });
  else col.run('dialog-focus', { ...base, status: 'not-applicable', ran: false, reason: 'no dialog, menu or listbox could be opened from auto-discovered triggers' });

  // ---- explicit states -------------------------------------------------------
  let explicitFail = false;
  for (const s of ctx.explicit) {
    const name = `explicit-${nameSlug(s.name)}`;
    const mark = ctx.watch.mark();
    try {
      await reload();
      for (const step of s.steps ?? []) await runStep(page, step);
      await page.waitForTimeout(250);
      const errs = ctx.watch.since(mark);
      states.push({ name: s.name, kind: 'explicit', auto: false, status: 'captured', file: await shot(name), steps: (s.steps ?? []).length, newErrors: errs.consoleErrors.length + errs.pageErrors.length });
    } catch (err) {
      explicitFail = true;
      const msg = String(/** @type {any} */ (err).message).split('\n')[0];
      states.push({ name: s.name, kind: 'explicit', auto: false, status: 'failed', error: msg });
      col.issue({ ...base, check: 'state-capture', severity: 'minor', key: s.name, message: `Explicit state "${s.name}" could not be captured: ${msg}`, evidence: { state: s.name, error: msg } });
    }
  }
  if (ctx.explicit.length) await reload();
  col.run('state-capture', { ...base, status: explicitFail ? 'failed' : 'passed', details: { captured: states.filter((s) => s.status === 'captured').length, attempted: states.length } });
  return states;
}

/** @param {import('playwright').Page} page @param {{action:string, selector?:string, value?:any}} step */
async function runStep(page, step) {
  const t = { timeout: 5000 };
  const need = () => { if (!step.selector) throw new Error(`step "${step.action}" requires a selector`); return page.locator(step.selector).first(); };
  switch (step.action) {
    case 'click': await need().click(t); break;
    case 'hover': await need().hover(t); break;
    case 'focus': await need().focus(t); break;
    case 'fill': await need().fill(String(step.value ?? ''), t); break;
    case 'press': if (step.selector) await need().press(String(step.value ?? 'Enter'), t); else await page.keyboard.press(String(step.value ?? 'Enter')); break;
    case 'scroll':
      if (step.selector) await need().scrollIntoViewIfNeeded(t);
      else await page.evaluate((y) => window.scrollTo(0, Number(y) || 0), step.value ?? 0);
      break;
    case 'wait': if (step.selector) await need().waitFor({ state: 'visible', ...t }); else await page.waitForTimeout(Math.min(10000, Number(step.value) || 300)); break;
    default: throw new Error(`unknown step action "${step.action}"`);
  }
  await page.waitForTimeout(120);
}

/**
 * Optional video capture (Playwright recordVideo). Never throws: reports unavailability.
 * @param {import('playwright').Browser} browser
 * @param {{ outDir: string, viewport: string, routes: {route: string, url: string}[], col: any }} ctx
 */
export async function captureVideo(browser, ctx) {
  const dir = path.join(ctx.outDir, 'video');
  /** @type {{route: string, file: string}[]} */ const files = [];
  try {
    fs.mkdirSync(dir, { recursive: true });
    for (const r of ctx.routes) {
      const context = await newContext(browser, /** @type {any} */ (ctx.viewport), { recordVideoDir: dir });
      const page = await context.newPage();
      await gotoStable(page, r.url).catch(() => {});
      await page.waitForTimeout(2000);
      const video = page.video();
      await context.close();
      if (video) {
        const target = path.join(dir, `${routeSlug(r.route)}-${ctx.viewport}.webm`);
        await video.saveAs(target).catch(async () => { const p = await video.path(); fs.renameSync(p, target); });
        await video.delete().catch(() => {});
        files.push({ route: r.route, file: `video/${routeSlug(r.route)}-${ctx.viewport}.webm` });
      }
    }
    if (!files.length) throw new Error('no video file was produced');
    ctx.col.run('video-capture', { status: 'passed', details: { files } });
    return { status: 'captured', files };
  } catch (err) {
    const first = String(/** @type {any} */ (err).message).split('\n')[0];
    const reason = /ffmpeg|Executable doesn't exist/i.test(String(/** @type {any} */ (err).message)) ? `Playwright ffmpeg is not installed (${first}). Install with: npx playwright install ffmpeg` : first;
    ctx.col.run('video-capture', { status: 'unavailable', ran: false, reason });
    ctx.col.limit(`Video capture unavailable: ${reason}`);
    return { status: 'unavailable', reason, files };
  }
}
