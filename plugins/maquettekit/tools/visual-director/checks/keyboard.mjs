// @ts-check
/**
 * Keyboard interaction: Tab sequence, focus traps, unreachable interactive
 * elements, visible focus indicator.
 */
import { loadPngTools, diffPngBuffers } from '../util.mjs';

/** Runs in the page: reset focus, snapshot resting styles, list candidates. */
export function pageKeyboardPrep() {
  const H = /** @type {any} */ (window).__S3VD__;
  window.scrollTo(0, 0);
  const a = H.deepActive();
  if (a && a !== document.body && typeof a.blur === 'function') a.blur();
  const styleOf = (el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth, outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow, border: [cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor, cs.borderTopWidth, cs.borderBottomWidth, cs.borderTopStyle, cs.borderBottomStyle].join('|'),
      backgroundColor: cs.backgroundColor, backgroundImage: cs.backgroundImage, color: cs.color, textDecoration: cs.textDecorationLine + cs.textDecorationColor,
    };
  };
  const native = 'a[href],button,input:not([type="hidden"]),select,textarea,summary,[tabindex],[contenteditable=""],[contenteditable="true"],iframe,audio[controls],video[controls]';
  const focusable = []; const radios = new Set();
  // A radio group is one tab stop, and Tab lands on its checked radio (the first one only when none is checked).
  const radioKey = (el) => (el.form ? 'f' : '') + el.name;
  const checkedRadio = new Map();
  for (const r of /** @type {any[]} */ (Array.from(document.querySelectorAll('input[type="radio"][name]:checked')))) {
    if (H.visible(r) && !r.disabled && !r.closest('[inert]') && r.tabIndex >= 0) checkedRadio.set(radioKey(r), r);
  }
  for (const el of /** @type {any[]} */ (Array.from(document.querySelectorAll(native)))) {
    if (!H.visible(el) || el.disabled || el.closest('[inert]') || el.tabIndex < 0) continue;
    if (el.localName === 'input' && el.type === 'radio' && el.name) {
      const k = radioKey(el); const c = checkedRadio.get(k);
      if ((c && c !== el) || radios.has(k)) continue;
      radios.add(k);
    }
    if (el.localName === 'summary' && el.parentElement && el.parentElement.querySelector(':scope > summary') !== el) continue;
    focusable.push(el);
  }
  // interactive-looking elements that cannot receive keyboard focus
  const nonFocusable = [];
  const looksInteractive = '[role="button"],[role="link"],[role="tab"],[role="menuitem"],[role="checkbox"],[role="switch"],[onclick]';
  /** @type {Set<any>} */
  const cand = new Set(Array.from(document.querySelectorAll(looksInteractive)));
  for (const el of Array.from(document.body ? document.body.querySelectorAll('*') : []).slice(0, 4000)) {
    if (cand.has(el)) continue;
    if (H.clickTargets.has(el) && el !== document.body) cand.add(el);
    else if (getComputedStyle(el).cursor === 'pointer' && el.parentElement && getComputedStyle(el.parentElement).cursor !== 'pointer') cand.add(el);
  }
  for (const el of cand) {
    if (!H.visible(el) || el.disabled || el.getAttribute('aria-disabled') === 'true' || el.closest('[inert],[aria-hidden="true"]')) continue;
    if (el.getAttribute('tabindex') === '-1') continue; // explicitly removed from the tab order
    if (el.tabIndex >= 0) continue; // focusable
    if (el.closest('a[href],button,label,summary,select')) continue; // inside a native control
    if (el.querySelector('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')) continue; // wrapper around a real control
    if (el === document.body || el === document.documentElement || ['canvas', 'video', 'audio', 'label', 'html'].includes(el.localName)) continue;
    const why = el.hasAttribute('onclick') ? 'onclick attribute' : el.matches(looksInteractive) ? `role="${el.getAttribute('role')}"` : H.clickTargets.has(el) ? 'click listener' : 'cursor: pointer';
    nonFocusable.push({ selector: H.sel(el), text: H.text(el, 40), reason: why, heuristic: why === 'cursor: pointer' });
    if (nonFocusable.length >= 15) break;
  }
  const resting = new Map();
  for (const el of focusable) resting.set(el, styleOf(el));
  H.kb = { focusable, resting, seq: [], styleOf };
  return { focusableCount: focusable.length, nonFocusable };
}

/** Runs in the page after each Tab press. */
export function pageKeyboardStop() {
  const H = /** @type {any} */ (window).__S3VD__;
  const kb = H.kb;
  const a = H.deepActive();
  if (!a || a === document.body || a === document.documentElement) return { body: true };
  const prev = kb.seq[kb.seq.length - 1];
  const firstIndex = kb.seq.indexOf(a);
  kb.seq.push(a);
  const cs = getComputedStyle(a);
  const now = kb.styleOf(a);
  const rest = kb.resting.get(a);
  const transparent = (c) => c === 'transparent' || /rgba?\([^)]*,\s*0\)$/.test(c) || /\/\s*0\)$/.test(c);
  const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 && !transparent(cs.outlineColor);
  const changed = [];
  if (rest) for (const k of ['boxShadow', 'border', 'backgroundColor', 'backgroundImage', 'color', 'textDecoration']) if (rest[k] !== now[k]) changed.push(k);
  const r = a.getBoundingClientRect();
  return {
    body: false, index: kb.seq.length - 1, selector: H.sel(a), text: H.text(a, 30), tag: a.localName,
    sameAsPrev: prev === a, seenBeforeAt: firstIndex,
    indicator: { outline, outlineValue: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, changed, known: !!rest },
    rect: { x: r.left, y: r.top, width: r.width, height: r.height },
  };
}

/** Runs in the page: which expected focusable elements were never reached. */
export function pageKeyboardFinish() {
  const H = /** @type {any} */ (window).__S3VD__;
  const kb = H.kb;
  const reached = new Set(kb.seq);
  const missed = kb.focusable.filter((el) => !reached.has(el) && H.visible(el)).slice(0, 15).map((el) => ({ selector: H.sel(el), text: H.text(el, 40) }));
  const a = H.deepActive(); if (a && a.blur) a.blur();
  return { missed };
}

/**
 * @param {import('playwright').Page} page
 * @param {{ route: string, viewport: string, col: any, maxStops?: number }} ctx
 */
export async function runKeyboard(page, ctx) {
  const { col, route, viewport } = ctx;
  const base = { route, viewport };
  const maxStops = ctx.maxStops ?? 40;
  const prep = await page.evaluate(pageKeyboardPrep);
  /** @type {any[]} */ const stops = [];
  let complete = false; let trap = null;
  for (let i = 0; i < maxStops + 1; i++) {
    await page.keyboard.press('Tab');
    const s = await page.evaluate(pageKeyboardStop);
    if (s.body) { if (stops.length || i > 0) { complete = true; break; } continue; }
    if (s.sameAsPrev) {
      // one extra press to confirm focus really cannot leave
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
  const fin = await page.evaluate(pageKeyboardFinish);
  const truncated = !complete && !trap;

  let navFail = false;
  if (trap) {
    navFail = true;
    col.issue({ ...base, check: 'keyboard-navigation', severity: 'critical', selector: trap.selector, key: 'trap',
      message: trap.type === 'stuck' ? `Keyboard focus trap: Tab does not move focus away from ${trap.selector}.` : `Keyboard focus cycles inside a subset of the page (returns to ${trap.selector} without reaching the remaining controls).`,
      evidence: { ...trap, sequence: stops.map((s) => s.selector) } });
  }
  for (const n of prep.nonFocusable) {
    navFail = true;
    col.issue({ ...base, check: 'keyboard-navigation', severity: 'major', selector: n.selector, key: 'unreachable',
      message: `Interactive element is not keyboard-focusable (${n.reason}, no tabindex): "${n.text}".`, evidence: { ...n, tabIndex: -1 } });
  }
  if (complete || trap) {
    for (const mEl of fin.missed) {
      navFail = true;
      col.issue({ ...base, check: 'keyboard-navigation', severity: 'major', selector: mEl.selector, key: 'not-in-sequence',
        message: `Focusable element was never reached while tabbing through the page: "${mEl.text}".`, evidence: { ...mEl, tabStops: stops.length, sequenceComplete: complete } });
    }
  }
  if (truncated) col.limit(`Keyboard check on ${route} stopped after ${maxStops} Tab stops; elements later in the order were not verified.`);
  col.run('keyboard-navigation', { ...base, status: navFail ? 'failed' : truncated ? 'limited' : 'passed', reason: truncated ? `tab sequence truncated at ${maxStops} stops` : undefined,
    details: { tabStops: stops.length, expectedFocusable: prep.focusableCount, sequenceComplete: complete, sequence: stops.map((s) => s.selector) } });

  // ---- focus indicator -------------------------------------------------------
  const suspects = stops.filter((s) => !s.indicator.outline && s.indicator.changed.length === 0).slice(0, 12);
  let focusFail = false; let viaScreenshot = 0;
  /** @type {any} */ let tools = null;
  for (const s of suspects) {
    let diffRatio = null;
    try {
      tools ??= await loadPngTools();
      const clip = await page.evaluate((i) => {
        const el = /** @type {any} */ (window).__S3VD__.kb.seq[i];
        el.scrollIntoView({ block: 'center', inline: 'center' });
        el.focus();
        const r = el.getBoundingClientRect(); const p = 6;
        const x = Math.max(0, r.left - p); const y = Math.max(0, r.top - p);
        return { x, y, width: Math.max(1, Math.min(window.innerWidth - x, r.width + 2 * p)), height: Math.max(1, Math.min(window.innerHeight - y, r.height + 2 * p)) };
      }, s.index);
      const focused = await page.screenshot({ clip, animations: 'disabled', caret: 'hide' });
      await page.evaluate((i) => /** @type {any} */ (window).__S3VD__.kb.seq[i].blur(), s.index);
      const blurred = await page.screenshot({ clip, animations: 'disabled', caret: 'hide' });
      const d = diffPngBuffers(tools, focused, blurred, 0.1);
      diffRatio = d.ratio;
      if (d.changedPixels > Math.max(4, d.width * d.height * 0.002)) { viaScreenshot++; continue; }
    } catch { /* fall through to computed-style verdict */ }
    focusFail = true;
    col.issue({ ...base, check: 'focus-visible', severity: 'major', selector: s.selector, key: 'no-indicator',
      message: `No visible focus indicator on ${s.selector} ("${s.text}").`,
      evidence: { outline: s.indicator.outlineValue, changedProperties: s.indicator.changed, screenshotDiffRatio: diffRatio } });
  }
  if (!stops.length) col.run('focus-visible', { ...base, status: 'not-applicable', ran: false, reason: 'no keyboard-focusable elements were reached' });
  else col.run('focus-visible', { ...base, status: focusFail ? 'failed' : 'passed', details: { stopsChecked: stops.length, confirmedByScreenshotDiff: viaScreenshot } });
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
}
