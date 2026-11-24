// @ts-check
/**
 * Page-side probes for the Experience Lab. Every exported function is serialised by
 * Playwright (page.evaluate / addInitScript): it must not reference anything outside its
 * own body except `window.__S3VD__` (Visual Director helpers: sel, visible, text, deepActive,
 * clickTargets, INTERACTIVE, POPUP) and `window.__S3XL__` (installed by installExperienceProbes).
 */

/** Init script: performance observers, loading sampler, input-latency recorder and shared helpers. */
export function installExperienceProbes() {
  const w = /** @type {any} */ (window);
  if (w.__S3XL__) return;
  const S = {
    perf: { fcp: /** @type {number|null} */ (null), lcp: /** @type {number|null} */ (null), cls: 0, shifts: 0, longTasks: /** @type {any[]} */ ([]), events: /** @type {any[]} */ ([]) },
    loading: { samples: /** @type {any[]} */ ([]), dcl: /** @type {number|null} */ (null), load: /** @type {number|null} */ (null) },
    manual: /** @type {any[]} */ ([]), armed: false, form: /** @type {any} */ (null), h: /** @type {any} */ (null), stopSampling: () => {},
  };
  Object.defineProperty(w, '__S3XL__', { value: S, enumerable: false, configurable: false, writable: false });

  // ---- performance observers (lab) ----------------------------------------------
  const ob = (type, fn, extra) => { try { new PerformanceObserver((list) => { for (const e of list.getEntries()) { try { fn(e); } catch { /* ignore */ } } }).observe(Object.assign({ type, buffered: true }, extra || {})); } catch { /* unsupported */ } };
  ob('paint', (e) => { if (e.name === 'first-contentful-paint') S.perf.fcp = e.startTime; });
  ob('largest-contentful-paint', (e) => { S.perf.lcp = e.startTime; });
  let win = 0; let winStart = -1e9; let last = -1e9;
  ob('layout-shift', (e) => {
    if (e.hadRecentInput) return;
    if (e.startTime - last > 1000 || e.startTime - winStart > 5000) { win = 0; winStart = e.startTime; }
    win += e.value; last = e.startTime; S.perf.shifts++;
    if (win > S.perf.cls) S.perf.cls = win;
  });
  ob('longtask', (e) => { if (S.perf.longTasks.length < 400) S.perf.longTasks.push({ start: Math.round(e.startTime), duration: Math.round(e.duration) }); });
  ob('event', (e) => { if (S.armed && e.interactionId && S.perf.events.length < 200) S.perf.events.push({ name: e.name, duration: e.duration, start: e.startTime, id: e.interactionId }); }, { durationThreshold: 16 });

  // ---- manual input → next frame latency (only while armed) ------------------------
  const onInput = (e) => {
    if (!S.armed) return;
    const t0 = e.timeStamp; const type = e.type;
    try { requestAnimationFrame(() => { const ch = new MessageChannel(); ch.port1.onmessage = () => { S.manual.push({ type, ms: performance.now() - t0 }); }; ch.port2.postMessage(0); }); } catch { /* ignore */ }
  };
  for (const t of ['pointerdown', 'mousedown', 'click', 'keydown']) addEventListener(t, onInput, true);

  // ---- loading sampler: visible text length + loading indicators every 100 ms ------
  const QS = '[aria-busy="true"],[role="progressbar"],progress,[class*="skeleton" i],[class*="shimmer" i],[class*="spinner" i],[class*="loader" i],[class*="loading" i]';
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (typeof el.checkVisibility !== 'function' || el.checkVisibility({ visibilityProperty: true })); };
  const sample = () => {
    try {
      const b = document.body;
      let ind = 0; const kinds = new Set();
      if (b) {
        const list = b.querySelectorAll(QS);
        for (let i = 0; i < list.length && i < 40; i++) {
          const el = list[i];
          if (el.getAttribute('aria-busy') === 'true') { ind++; kinds.add('aria-busy'); continue; }
          if (!vis(el)) continue;
          ind++; kinds.add(el.matches('[role="progressbar"],progress') ? 'progress' : 'skeleton/spinner');
        }
      }
      S.loading.samples.push({ t: Math.round(performance.now()), text: b ? (b.innerText || '').length : 0, ind, kinds: Array.from(kinds) });
    } catch { /* ignore */ }
  };
  const timer = setInterval(() => { sample(); if (performance.now() > 6500 || S.loading.samples.length > 90) clearInterval(timer); }, 100);
  S.stopSampling = () => clearInterval(timer);
  document.addEventListener('DOMContentLoaded', () => { S.loading.dcl = performance.now(); sample(); }, { once: true });
  addEventListener('load', () => { S.loading.load = performance.now(); sample(); }, { once: true });

  // ---- shared helpers -----------------------------------------------------------
  let c2d = null; const cache = new Map();
  /** CSS colour (any syntax the browser supports, incl. oklch) → [r, g, b, a] in sRGB 0–255. */
  const rgba = (c) => {
    if (!c) return null;
    if (cache.has(c)) return cache.get(c);
    let out = null;
    const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(c);
    if (m) out = [Number(m[1]), Number(m[2]), Number(m[3]), m[4] == null ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : Number(m[4]))];
    else {
      try {
        c2d = c2d || document.createElement('canvas').getContext('2d', { willReadFrequently: true });
        c2d.clearRect(0, 0, 1, 1); c2d.fillStyle = '#000'; c2d.fillStyle = c; c2d.fillRect(0, 0, 1, 1);
        const d = c2d.getImageData(0, 0, 1, 1).data; out = [d[0], d[1], d[2], d[3] / 255];
      } catch { out = null; }
    }
    cache.set(c, out);
    return out;
  };
  const lum = (x) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(x[0]) + 0.7152 * f(x[1]) + 0.0722 * f(x[2]); };
  const contrast = (a, b) => { const la = lum(a); const lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  /** Accessible name: Chromium computedName when exposed, else an accname approximation. */
  const accName = (el) => {
    try { if (typeof el.computedName === 'string') return clean(el.computedName); } catch { /* fall through */ }
    const lb = el.getAttribute('aria-labelledby');
    if (lb) { const s = clean(lb.split(/\s+/).map((id) => document.getElementById(id)).filter(Boolean).map((x) => x.textContent).join(' ')); if (s) return s; }
    const al = clean(el.getAttribute('aria-label')); if (al) return al;
    if (el.labels && el.labels.length) { const s = clean(Array.from(el.labels).map((l) => /** @type {any} */ (l).textContent).join(' ')); if (s) return s; }
    if (el.localName === 'input' && ['submit', 'button', 'reset'].includes(el.type)) return clean(el.value) || (el.type === 'submit' ? 'Submit' : el.type === 'reset' ? 'Reset' : '');
    if (el.localName === 'input' && el.type === 'image') return clean(el.alt);
    if (!['input', 'select', 'textarea'].includes(el.localName)) {
      const inner = clean(el.innerText || el.textContent); if (inner) return inner;
      const img = el.querySelector && el.querySelector('img[alt]:not([alt=""]),[aria-label],svg title');
      if (img) { const s = clean(img.getAttribute('alt') || img.getAttribute('aria-label') || img.textContent); if (s) return s; }
    }
    return clean(el.getAttribute('title') || el.getAttribute('placeholder'));
  };
  /** Rendered with a usable size somewhere inside the document (not an off-screen skip link or sr-only box). */
  const onPage = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const top = r.top + scrollY; const left = r.left + scrollX;
    if (top + r.height <= 0 || left + r.width <= 0) return false;
    const de = document.documentElement;
    return left < Math.max(de.scrollWidth, de.clientWidth) && top < Math.max(de.scrollHeight, de.clientHeight) + 1;
  };
  const VIS = ['color', 'backgroundColor', 'backgroundImage', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor', 'borderTopWidth', 'borderBottomWidth', 'boxShadow', 'textDecorationLine', 'textDecorationColor', 'textDecorationThickness', 'outlineStyle', 'outlineWidth', 'outlineColor', 'transform', 'scale', 'translate', 'opacity', 'filter'];
  /** Visual style snapshot (+ ::before/::after) and transition declarations. */
  const snap = (el) => {
    const o = {}; const cs = getComputedStyle(el);
    for (const k of VIS) o[k] = cs[k];
    for (const p of ['::before', '::after']) {
      try {
        const ps = getComputedStyle(el, p);
        if (ps.content && ps.content !== 'none' && ps.content !== 'normal') { for (const k of ['opacity', 'transform', 'scale', 'backgroundColor', 'width', 'borderBottomColor', 'color']) o[p + ':' + k] = ps[k]; o[p + ':transitionDuration'] = ps.transitionDuration; }
      } catch { /* ignore */ }
    }
    return { style: o, transition: { duration: cs.transitionDuration, property: cs.transitionProperty } };
  };
  S.h = { rgba, lum, contrast, accName, onPage, snap, clean };
}

/** Performance + loading report; stops the loading sampler. */
export function pagePerfReport() {
  const S = /** @type {any} */ (window).__S3XL__;
  if (!S) return null;
  S.stopSampling();
  return { fcp: S.perf.fcp, lcp: S.perf.lcp, cls: S.perf.cls, shifts: S.perf.shifts, longTasks: S.perf.longTasks.slice(), dcl: S.loading.dcl, load: S.loading.load, samples: S.loading.samples.slice(), now: performance.now() };
}

/**
 * One pass over the DOM collecting every structural signal for this page.
 * @param {{ touch: boolean, maxElements: number }} opts
 */
export function pageMeasure(opts) {
  const w = /** @type {any} */ (window);
  const H = w.__S3VD__; const X = w.__S3XL__.h;
  window.scrollTo(0, 0);
  const de = document.documentElement; const body = document.body;
  const vw = de.clientWidth; const vh = innerHeight;
  const all = body ? Array.from(body.querySelectorAll('*')).slice(0, opts.maxElements) : [];
  const SKIP_TAGS = ['script', 'style', 'noscript', 'template'];
  const ownText = (el) => { let s = ''; for (const n of Array.from(el.childNodes)) if (n.nodeType === 3) s += n.nodeValue; return s.replace(/\s+/g, ' ').trim(); };
  const hidden = (el) => !!el.closest('[inert],[aria-hidden="true"]');
  const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
  /** @type {any} */ const out = { viewport: { width: vw, height: vh }, url: location.href, path: location.pathname };

  // ---- interactive elements & accessible names --------------------------------------
  const WIDGET = new Set(['button', 'link', 'checkbox', 'radio', 'switch', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'slider', 'spinbutton', 'combobox', 'textbox', 'searchbox', 'treeitem', 'listbox']);
  const interactive = Array.from(document.querySelectorAll(H.INTERACTIVE)).filter((el) => !el.disabled && !hidden(el) && H.visible(el) && X.onPage(el)).slice(0, 400);
  const named = { total: 0, named: 0, unnamed: /** @type {any[]} */ ([]) };
  for (const el of interactive) {
    let role = '';
    try { role = typeof el.computedRole === 'string' ? el.computedRole : ''; } catch { /* ignore */ }
    const isWidget = role ? WIDGET.has(role) : el.matches('a[href],button,input,select,textarea,summary,[role]');
    if (!isWidget) continue;
    named.total++;
    const n = X.accName(el);
    if (n) named.named++;
    else if (named.unnamed.length < 12) named.unnamed.push({ selector: H.sel(el), tag: el.localName, role: role || el.getAttribute('role') || el.localName });
  }
  out.names = named;
  out.interactiveCount = interactive.length;

  // ---- clickable-looking elements without control semantics ------------------------
  const NATIVE = 'a[href],button,input,select,textarea,summary,label,option,[role="button"],[role="link"],[role="tab"],[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],[role="checkbox"],[role="radio"],[role="switch"],[role="option"],[role="slider"],[role="spinbutton"],[role="combobox"],[role="treeitem"],[role="gridcell"]';
  const fake = [];
  for (const el of all) {
    if (fake.length >= 20) break;
    if (['canvas', 'video', 'audio', 'svg', 'path', 'img', 'iframe', 'label', 'summary', 'option', 'g', 'use'].includes(el.localName)) continue;
    let why = null;
    if (el.hasAttribute('onclick')) why = 'onclick attribute';
    else if (H.clickTargets.has(el)) why = 'click listener';
    else {
      const cs = getComputedStyle(el);
      if (cs.cursor === 'pointer' && el.parentElement && getComputedStyle(el.parentElement).cursor !== 'pointer') why = 'cursor: pointer';
    }
    if (!why) continue;
    if (el.matches(NATIVE) || el.closest(NATIVE)) continue;
    if (el.querySelector('a[href],button,input,select,textarea,summary,[role="button"],[role="link"],[tabindex]:not([tabindex="-1"])')) continue;
    if (hidden(el) || !H.visible(el) || !X.onPage(el)) continue;
    fake.push({ selector: H.sel(el), text: H.text(el, 40), why, focusable: /** @type {any} */ (el).tabIndex >= 0 });
  }
  out.fakeControls = fake;

  // ---- inline links in running text --------------------------------------------------
  const inline = [];
  for (const a of Array.from(document.querySelectorAll('a[href]')).slice(0, 600)) {
    if (inline.length >= 120) break;
    if (hidden(a) || !H.visible(a) || !X.onPage(a)) continue;
    const cs = getComputedStyle(a);
    if (!cs.display.startsWith('inline') || a.closest('nav,[role="navigation"],header,footer,button,[role="button"],h1,h2,h3,h4,h5,h6')) continue;
    const p = a.parentElement; if (!p) continue;
    const aText = X.clean(/** @type {any} */ (a).innerText); const pText = X.clean(p.innerText);
    if (!aText || pText.length < aText.length + 15) continue;
    const ps = getComputedStyle(p);
    const underline = /underline/.test(cs.textDecorationLine) || /underline/.test(ps.textDecorationLine);
    const border = parseFloat(cs.borderBottomWidth) > 0 && cs.borderBottomStyle !== 'none';
    const bgA = X.rgba(cs.backgroundColor);
    const bg = !!bgA && bgA[3] > 0.1 && cs.backgroundColor !== ps.backgroundColor;
    const weight = Math.abs((parseInt(cs.fontWeight, 10) || 400) - (parseInt(ps.fontWeight, 10) || 400)) >= 300;
    const ca = X.rgba(cs.color); const cp = X.rgba(ps.color);
    const ratio = ca && cp ? X.contrast(ca, cp) : 1;
    inline.push({ selector: H.sel(a), text: aText.slice(0, 40), ok: underline || border || bg || weight || ratio >= 3, underline, contrastWithText: round(ratio, 2) });
  }
  out.inlineLinks = { total: inline.length, ok: inline.filter((l) => l.ok).length, failing: inline.filter((l) => !l.ok).slice(0, 10) };

  // ---- form fields ------------------------------------------------------------------
  const fields = Array.from(document.querySelectorAll('input,select,textarea')).filter((el) => !['hidden', 'submit', 'button', 'reset', 'image'].includes(/** @type {any} */ (el).type) && !hidden(el) && H.visible(el) && X.onPage(el));
  const labelled = (el) => {
    if (el.labels && Array.from(el.labels).some((l) => X.clean(/** @type {any} */ (l).textContent))) return true;
    const lb = el.getAttribute('aria-labelledby');
    if (lb && lb.split(/\s+/).some((id) => { const t = document.getElementById(id); return t && X.clean(t.textContent); })) return true;
    return !!(X.clean(el.getAttribute('aria-label')) || X.clean(el.getAttribute('title')));
  };
  const unlabelled = fields.filter((el) => !labelled(el));
  out.fields = { total: fields.length, labelled: fields.length - unlabelled.length, unlabelled: unlabelled.slice(0, 10).map((el) => ({ selector: H.sel(el), placeholder: el.getAttribute('placeholder') })) };

  // ---- text metrics: sizes, colours, body size ------------------------------------------
  const fontSet = new Set(); const colorSet = new Set(); const sized = [];
  for (const el of all) {
    if (SKIP_TAGS.includes(el.localName)) continue;
    const t = ownText(el);
    if (!t) continue;
    if (!H.visible(el)) continue;
    const cs = getComputedStyle(el);
    const fsz = parseFloat(cs.fontSize);
    fontSet.add(Math.round(fsz));
    const c = X.rgba(cs.color);
    if (c) colorSet.add(`${c[0] >> 3},${c[1] >> 3},${c[2] >> 3},${Math.round(c[3] * 10)}`);
    if (t.length >= 20) sized.push([fsz, t.length]);
  }
  sized.sort((a, b) => a[0] - b[0]);
  const totalChars = sized.reduce((s, x) => s + x[1], 0);
  let acc = 0; let bodyPx = null;
  for (const [px, n] of sized) { acc += n; if (acc >= totalChars / 2) { bodyPx = px; break; } }
  out.text = { fontSizes: Array.from(fontSet).sort((a, b) => a - b), colorCount: colorSet.size, bodyTextPx: bodyPx == null ? null : round(bodyPx, 1), textBlocks: sized.length };

  // ---- line length (paragraphs) ----------------------------------------------------------
  const lines = [];
  for (const p of Array.from(document.querySelectorAll('p')).slice(0, 200)) {
    if (!H.visible(p)) continue;
    const t = X.clean(p.innerText);
    if (t.length < 120) continue;
    const cs = getComputedStyle(p);
    if ((cs.webkitLineClamp && cs.webkitLineClamp !== 'none') || p.scrollHeight > p.clientHeight + 2) continue; // clamped/truncated: visible lines ≠ text
    const lh = cs.lineHeight === 'normal' ? parseFloat(cs.fontSize) * 1.2 : parseFloat(cs.lineHeight);
    const n = Math.round(p.getBoundingClientRect().height / (lh || 1));
    if (n >= 2) lines.push(Math.round(t.length / n));
  }
  lines.sort((a, b) => a - b);
  out.lineLength = { paragraphs: lines.length, medianChars: lines.length ? lines[Math.floor(lines.length / 2)] : null };

  // ---- overflow & viewport meta --------------------------------------------------------
  const sw = Math.max(de.scrollWidth, body ? body.scrollWidth : 0);
  out.overflowPx = Math.max(0, sw - de.clientWidth);
  const meta = document.querySelector('meta[name="viewport"]');
  const mc = meta ? meta.getAttribute('content') || '' : '';
  const maxScale = /maximum-scale\s*=\s*([\d.]+)/i.exec(mc);
  out.viewportMeta = { present: !!meta, content: mc || null, zoomDisabled: /user-scalable\s*=\s*(no|0)\b/i.test(mc) || (!!maxScale && parseFloat(maxScale[1]) < 2) };

  // ---- navigation -----------------------------------------------------------------------
  const navs = Array.from(document.querySelectorAll('nav,[role="navigation"]'));
  const outsideMain = navs.filter((n) => !n.closest('main,[role="main"]'));
  const useNavs = outsideMain.length ? outsideMain : navs;
  const norm = (href) => {
    try {
      const u = new URL(href, location.href);
      if (u.origin !== location.origin) return u.origin + u.pathname;
      if (u.hash && u.pathname === location.pathname) return u.hash;
      let p = u.pathname.replace(/\/index\.html?$/i, '/').replace(/\.html?$/i, '');
      if (p.length > 1) p = p.replace(/\/+$/, '');
      return p || '/';
    } catch { return String(href); }
  };
  const here = norm(location.href.split('#')[0]);
  const items = []; const seenKeys = new Set();
  for (const n of useNavs) for (const a of Array.from(n.querySelectorAll('a[href]'))) {
    const key = norm(/** @type {any} */ (a).href);
    if (seenKeys.has(key)) continue; seenKeys.add(key);
    const cur = a.getAttribute('aria-current');
    items.push({ key, label: X.clean(/** @type {any} */ (a).innerText || a.textContent).slice(0, 40), current: cur != null && cur !== 'false' });
  }
  const curItem = items.find((i) => i.key === here);
  out.nav = { landmarks: navs.length, items, currentLink: curItem ? { key: curItem.key, marked: curItem.current } : null, here };
  out.title = X.clean(document.title);

  // ---- headings -------------------------------------------------------------------------
  const hs = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]')).filter((h) => (typeof h.checkVisibility !== 'function' || h.checkVisibility()) && !h.closest('[aria-hidden="true"]'));
  const levels = hs.map((h) => (/^h[1-6]$/.test(h.localName) ? Number(h.localName[1]) : (parseInt(h.getAttribute('aria-level') || '2', 10) || 2)));
  let skips = 0; const skipExamples = [];
  for (let i = 1; i < levels.length; i++) if (levels[i] > levels[i - 1] + 1) { skips++; if (skipExamples.length < 3) skipExamples.push(`h${levels[i - 1]} → h${levels[i]} (${H.sel(hs[i])})`); }
  out.headings = { count: levels.length, h1: levels.filter((l) => l === 1).length, skips, skipExamples, outline: levels.slice(0, 30) };

  // ---- button-like controls: competing actions above the fold & style variants ------------
  const btnLike = (el) => {
    if (el.matches('button,[role="button"],input[type="submit"],input[type="button"],input[type="reset"]')) return true;
    if (el.localName !== 'a') return false;
    const cs = getComputedStyle(el); const bg = X.rgba(cs.backgroundColor);
    const filled = !!bg && bg[3] > 0.15;
    const bordered = parseFloat(cs.borderTopWidth) >= 1 && cs.borderTopStyle !== 'none' && parseFloat(cs.borderBottomWidth) >= 1 && parseFloat(cs.borderLeftWidth) >= 1;
    return (filled || bordered) && parseFloat(cs.paddingLeft) >= 8 && parseFloat(cs.paddingTop) >= 4;
  };
  const buttons = Array.from(document.querySelectorAll('a[href],button,[role="button"],input[type="submit"],input[type="button"],input[type="reset"]'))
    .filter((el) => !hidden(el) && H.visible(el) && X.onPage(el) && btnLike(el)).slice(0, 300);
  const effectiveBg = (el) => { for (let q = el; q; q = q.parentElement) { const c = X.rgba(getComputedStyle(q).backgroundColor); if (c && c[3] >= 0.5) return c; } return [255, 255, 255, 1]; };
  /** filled control whose fill stands out from what is behind it (a CTA, not a ghost/chip/text button) */
  const prominent = (el) => { const c = X.rgba(getComputedStyle(el).backgroundColor); if (!c || c[3] < 0.5) return false; const b = el.parentElement ? effectiveBg(el.parentElement) : [255, 255, 255, 1]; return Math.abs(c[0] - b[0]) + Math.abs(c[1] - b[1]) + Math.abs(c[2] - b[2]) > 60; };
  const fold = []; const ctas = []; const styles = new Map();
  for (const el of buttons) {
    const r = el.getBoundingClientRect();
    if (r.width * r.height >= 1200 && X.accName(el).length >= 2 && r.top < vh && r.bottom > 0) {
      fold.push({ selector: H.sel(el), text: H.text(el, 30) });
      if (r.width * r.height >= 2000 && prominent(el)) ctas.push({ selector: H.sel(el), text: H.text(el, 30) });
    }
    if (r.width < 24 || r.height < 16) continue;
    const cs = getComputedStyle(el); const bg = X.rgba(cs.backgroundColor);
    const key = [Math.round(parseFloat(cs.borderTopLeftRadius) / 2) * 2, Math.round(r.height / 4) * 4, cs.fontWeight, Math.round(parseFloat(cs.fontSize)), bg && bg[3] > 0.15 ? 'filled' : 'ghost', parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none' ? 'border' : 'no-border'].join('|');
    if (!styles.has(key)) styles.set(key, H.sel(el));
  }
  out.actionsAboveFold = { count: fold.length, examples: fold.slice(0, 10), prominent: ctas.length, prominentExamples: ctas.slice(0, 10) };
  out.buttonStyles = { count: styles.size, variants: Array.from(styles.entries()).slice(0, 12).map(([k, s]) => `${k} (${s})`) };

  // ---- words above the fold --------------------------------------------------------------
  let words = 0; let visited = 0;
  if (body) {
    const tw = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = tw.nextNode()) && visited++ < 6000) {
      const v = node.nodeValue;
      if (!v || !v.trim()) continue;
      const p = node.parentElement;
      if (!p || SKIP_TAGS.includes(p.localName)) continue;
      const range = document.createRange(); range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.top >= vh || r.bottom <= 0) continue;
      if (!H.visible(p)) continue;
      const frac = r.bottom > vh ? Math.max(0, Math.min(1, (vh - r.top) / r.height)) : 1;
      words += (v.match(/\S+/g) || []).length * frac;
    }
  }
  out.wordsAboveFold = Math.round(words);

  // ---- media with reserved space ----------------------------------------------------------
  const media = Array.from(document.querySelectorAll('img,video,iframe')).filter((m) => (m.localName !== 'img' || m.getAttribute('src') || m.getAttribute('srcset')) && !m.closest('template,[hidden]')).slice(0, 300);
  const unreserved = []; let reserved = 0; let mediaTotal = 0;
  for (const m of media) {
    const r = m.getBoundingClientRect();
    if (r.width > 0 && r.width <= 2 && r.height <= 2) continue; // tracking pixels
    mediaTotal++;
    const cs = getComputedStyle(m);
    const pcs = m.parentElement ? getComputedStyle(m.parentElement) : null;
    const ok = (cs.aspectRatio && cs.aspectRatio !== 'auto') || (cs.position === 'absolute' && !!pcs && (pcs.aspectRatio !== 'auto' || (m.parentElement.style.height !== ''))) || (/** @type {any} */ (m).style.width !== '' && /** @type {any} */ (m).style.height !== '');
    if (ok) reserved++; else if (unreserved.length < 8) unreserved.push(H.sel(m));
  }
  out.media = { total: mediaTotal, reserved, unreserved };

  // ---- live regions, link misuse, new-window links, motion controls, forms ---------------------
  out.liveRegions = document.querySelectorAll('[role="alert"],[role="status"],[role="log"],[aria-live]:not([aria-live="off"]),output').length;
  const misuse = [];
  for (const a of Array.from(document.querySelectorAll('a[href="#"],a[href^="javascript:" i],a:not([href])'))) {
    if (misuse.length >= 12) break;
    if (!a.hasAttribute('href') && !(a.hasAttribute('onclick') || H.clickTargets.has(a))) continue;
    if (hidden(a) || !H.visible(a)) continue;
    misuse.push({ selector: H.sel(a), href: a.getAttribute('href'), text: H.text(a, 30) });
  }
  out.linkMisuse = misuse;
  const NEWWIN = /new (tab|window)|opens in|external|↗|⧉/i;
  const blank = Array.from(document.querySelectorAll('a[target="_blank" i][href]')).filter((a) => !hidden(a) && H.visible(a));
  const blankBad = blank.filter((a) => {
    const desc = (a.getAttribute('aria-describedby') || '').split(/\s+/).map((id) => document.getElementById(id)).filter(Boolean).map((x) => x.textContent).join(' ');
    const icon = Array.from(a.querySelectorAll('svg,img')).map((x) => `${x.getAttribute('aria-label') || ''} ${x.getAttribute('alt') || ''} ${x.querySelector && x.querySelector('title') ? x.querySelector('title').textContent : ''}`).join(' ');
    return !NEWWIN.test(`${X.accName(a)} ${a.getAttribute('title') || ''} ${desc} ${icon}`);
  });
  out.newWindowLinks = { total: blank.length, announced: blank.length - blankBad.length, unannounced: blankBad.slice(0, 8).map((a) => H.sel(a)) };
  const PAUSE = /\b(pause|stop|play|resume|freeze|motion|animations?|autoplay|reduced? motion)\b/i;
  const controls = Array.from(document.querySelectorAll('button,[role="button"],[role="switch"],input[type="checkbox"],[aria-pressed]'))
    .filter((el) => (H.visible(el) || (el.localName === 'input' && /** @type {any} */ (el).labels && /** @type {any} */ (el).labels.length)) && PAUSE.test(X.accName(el)));
  out.motionControls = controls.slice(0, 6).map((el) => ({ selector: H.sel(el), name: X.accName(el).slice(0, 40) }));
  const TEXTLIKE = 'input:not([type]),input[type="text"],input[type="email"],input[type="tel"],input[type="url"],input[type="password"],input[type="number"],input[type="date"],textarea';
  out.forms = Array.from(document.forms).filter((f) => H.visible(f) && f.getAttribute('role') !== 'search' && !f.closest('[role="search"]') && f.querySelector(TEXTLIKE)).length;
  out.domSize = document.getElementsByTagName('*').length;

  // ---- touch targets (touch viewports only) ---------------------------------------------
  if (opts.touch) {
    const T = interactive.slice(0, 300);
    const R = T.map((el) => el.getBoundingClientRect());
    let exempt = 0; let checked = 0; let pass24 = 0; let big44 = 0; let spaced = 0;
    const failing = []; const small44 = [];
    for (let i = 0; i < T.length; i++) {
      const el = T[i]; const r = R[i];
      const ua = el.localName === 'input' && /^(checkbox|radio)$/.test(/** @type {any} */ (el).type);
      const inlineLink = el.localName === 'a' && getComputedStyle(el).display.startsWith('inline') && !!el.parentElement
        && X.clean(el.parentElement.textContent).length > X.clean(el.textContent).length + 1;
      if (ua || inlineLink) { exempt++; continue; }
      checked++;
      const cx = r.left + r.width / 2; const cy = r.top + r.height / 2;
      let crowded = null; let minGap = Infinity;
      for (let j = 0; j < T.length; j++) {
        if (j === i) continue;
        const o = T[j]; if (o.contains(el) || el.contains(o)) continue;
        const q = R[j];
        if (!crowded && cx - 12 < q.right && cx + 12 > q.left && cy - 12 < q.bottom && cy + 12 > q.top) crowded = H.sel(o);
        const dx = Math.max(0, q.left - r.right, r.left - q.right); const dy = Math.max(0, q.top - r.bottom, r.top - q.bottom);
        const gap = dx > 0 && dy > 0 ? Math.hypot(dx, dy) : Math.max(dx, dy);
        if (gap < minGap) minGap = gap;
      }
      const ok24 = (r.width >= 24 && r.height >= 24) || !crowded;
      if (ok24) pass24++; else if (failing.length < 15) failing.push({ selector: H.sel(el), width: round(r.width), height: round(r.height), crowdedBy: crowded, text: H.text(el, 30) });
      if (r.width >= 44 && r.height >= 44) big44++; else if (small44.length < 8) small44.push(`${H.sel(el)} (${round(r.width)}×${round(r.height)})`);
      if (minGap >= 8) spaced++;
    }
    out.targets = { checked, exempt, pass24, big44, spaced, failing, small44 };
  }
  return out;
}

/** Animations currently known to the document (+ declared transitions). */
export function pageAnimations() {
  const H = /** @type {any} */ (window).__S3VD__;
  let anims = [];
  try { anims = document.getAnimations(); } catch { /* unsupported */ }
  const vh = innerHeight; const vw = innerWidth;
  const list = [];
  for (const a of anims.slice(0, 300)) {
    /** @type {any} */ const an = a;
    const eff = an.effect; let timing = {}; let props = [];
    try { timing = eff ? eff.getComputedTiming() : {}; } catch { /* ignore */ }
    try { const set = new Set(); for (const k of (eff && eff.getKeyframes ? eff.getKeyframes() : [])) for (const p of Object.keys(k)) if (!['offset', 'computedOffset', 'easing', 'composite'].includes(p)) set.add(p); props = Array.from(set); } catch { /* ignore */ }
    const ctor = an.constructor && an.constructor.name;
    const type = ctor === 'CSSAnimation' ? 'css-animation' : ctor === 'CSSTransition' ? 'css-transition' : 'waapi';
    const target = eff && eff.target;
    let area = 0; let visible = false; let inView = false;
    if (target && target.nodeType === 1) {
      const r = target.getBoundingClientRect();
      area = Math.round(r.width * r.height);
      visible = r.width > 0 && r.height > 0 && (typeof target.checkVisibility !== 'function' || target.checkVisibility({ visibilityProperty: true }));
      inView = r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
    }
    // @ts-ignore
    const iterations = timing.iterations === Infinity ? 'infinite' : (timing.iterations == null ? 1 : timing.iterations);
    // @ts-ignore
    const durationMs = typeof timing.duration === 'number' ? Math.round(timing.duration) : 0;
    list.push({ type, name: String(an.animationName || an.transitionProperty || an.id || '(anonymous)'), playState: an.playState, durationMs, iterations, properties: props, selector: target && H ? H.sel(target) : '', pseudo: (eff && eff.pseudoElement) || null, area, visible, inView });
  }
  const LAYOUT = ['width', 'height', 'top', 'left', 'right', 'bottom', 'margin', 'margin-top', 'margin-left', 'margin-right', 'margin-bottom', 'padding', 'padding-top', 'padding-left', 'padding-right', 'padding-bottom', 'inset', 'font-size', 'line-height', 'border-width', 'max-height', 'max-width', 'min-height', 'min-width', 'grid-template-columns', 'grid-template-rows', 'flex-basis', 'gap'];
  const declared = new Set(); let declaredEls = 0;
  for (const el of Array.from(document.body ? document.body.querySelectorAll('*') : []).slice(0, 3000)) {
    const cs = getComputedStyle(el);
    const durs = cs.transitionDuration.split(',').map((s) => parseFloat(s) * (s.trim().endsWith('ms') ? 1 : 1000) || 0);
    if (Math.max(0, ...durs) <= 0) continue;
    declaredEls++;
    cs.transitionProperty.split(',').forEach((p, i) => { if ((durs[i % durs.length] || 0) > 0) declared.add(p.trim()); });
  }
  return { animations: list, declaredTransitionElements: declaredEls, declaredTransitionProperties: Array.from(declared).slice(0, 40), declaredLayoutTransitions: Array.from(declared).filter((p) => LAYOUT.includes(p)) };
}

/** Tag up to `max` controls for the hover/active probe (buttons first, then nav links, then links). */
export function pageHoverCandidates(max) {
  const H = /** @type {any} */ (window).__S3VD__; const X = /** @type {any} */ (window).__S3XL__.h;
  document.querySelectorAll('[data-s3xl-hover]').forEach((e) => e.removeAttribute('data-s3xl-hover'));
  const vh = innerHeight;
  const pool = Array.from(document.querySelectorAll('button,[role="button"],input[type="submit"],input[type="button"],a[href],summary,[role="tab"]'))
    .filter((el) => !/** @type {any} */ (el).disabled && !el.closest('[inert],[aria-hidden="true"]') && H.visible(el) && X.onPage(el));
  const kind = (el) => (el.localName === 'a' ? (el.closest('nav,[role="navigation"]') ? 'nav-link' : 'link') : 'button');
  /** @type {Record<string, Element[]>} */ const buckets = { button: [], 'nav-link': [], link: [] };
  for (const el of pool) {
    const r = el.getBoundingClientRect();
    if (r.top + scrollY > vh * 1.6 || r.width < 8 || r.height < 8) continue;
    buckets[kind(el)].push(el);
  }
  const picked = [];
  while (picked.length < max && (buckets.button.length || buckets['nav-link'].length || buckets.link.length)) {
    for (const k of ['button', 'nav-link', 'link']) { const el = buckets[k].shift(); if (el && picked.length < max) picked.push(el); }
  }
  return picked.map((el, i) => { el.setAttribute('data-s3xl-hover', String(i)); return { i, selector: H.sel(el), kind: kind(el), text: H.text(el, 30) }; });
}

/** Style snapshot of a tagged hover candidate. @param {number} i */
export function pageSnapHover(i) {
  const el = document.querySelector(`[data-s3xl-hover="${i}"]`);
  return el ? /** @type {any} */ (window).__S3XL__.h.snap(el) : null;
}

/** Document geometry of the keyboard sequence recorded by Visual Director's keyboard page functions, plus skip link. */
export function pageTabGeometry() {
  const H = /** @type {any} */ (window).__S3VD__;
  const kb = H && H.kb;
  if (!kb) return null;
  window.scrollTo(0, 0);
  const isFixed = (el) => { for (let p = el; p && p !== document.documentElement; p = p.parentElement) if (getComputedStyle(p).position === 'fixed') return true; return false; };
  const seen = new Set(); const stops = [];
  for (const el of kb.seq) {
    if (seen.has(el)) continue; seen.add(el);
    const r = el.getBoundingClientRect();
    stops.push({ selector: H.sel(el), x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height), fixed: isFixed(el) });
  }
  let skip = null;
  const first = kb.seq[0];
  if (first && first.localName === 'a') {
    const href = first.getAttribute('href') || '';
    if (href.startsWith('#') && href.length > 1) {
      const id = decodeURIComponent(href.slice(1));
      skip = { selector: H.sel(first), href, text: H.text(first, 40), targetExists: !!(document.getElementById(id) || document.getElementsByName(id)[0]) };
    }
  }
  return { stops, skip, firstStop: first ? H.sel(first) : null };
}

/** Tag up to `max` safe controls for the input-latency probe (disclosure toggles first). @param {number} max */
export function pageLatencyCandidates(max) {
  const H = /** @type {any} */ (window).__S3VD__; const X = /** @type {any} */ (window).__S3XL__.h;
  document.querySelectorAll('[data-s3xl-latency]').forEach((e) => e.removeAttribute('data-s3xl-latency'));
  const DANGER = /delete|remove|destroy|buy|pay|purchase|checkout|order|submit|send|sign ?(out|in|up)|log ?(out|in)|unsubscribe|reset|clear|pause|stop|play|motion|animation/i;
  const ok = (el) => !el.disabled && !el.form && !el.closest('a[href],[inert],[aria-hidden="true"]') && H.visible(el) && X.onPage(el) && !DANGER.test(X.accName(el) || '');
  const cands = [...new Set([
    ...Array.from(document.querySelectorAll('button[aria-expanded],[role="button"][aria-expanded],summary')),
    ...Array.from(document.querySelectorAll('button[type="button"],[role="button"]:not(a)')),
  ])].filter(ok).slice(0, max);
  return cands.map((el, i) => { el.setAttribute('data-s3xl-latency', String(i)); return { i, selector: H.sel(el), text: H.text(el, 30), kind: el.getAttribute('aria-expanded') != null ? 'disclosure' : el.localName === 'summary' ? 'summary' : 'button' }; });
}

/** Testable forms: a visible form with a text-like field that is not a search form. */
export function pageFormsList() {
  const H = /** @type {any} */ (window).__S3VD__;
  const TEXTLIKE = 'input:not([type]),input[type="text"],input[type="email"],input[type="tel"],input[type="url"],input[type="password"],input[type="number"],input[type="date"],textarea';
  return Array.from(document.forms).map((f, index) => ({ f, index }))
    .filter(({ f }) => H.visible(f) && f.getAttribute('role') !== 'search' && !f.closest('[role="search"]') && f.querySelector(TEXTLIKE))
    .map(({ f, index }) => ({ index, selector: H.sel(f) }));
}

/** Arm the empty-submission probe on form #index: listeners record validation; navigation is prevented. @param {number} index */
export function pageFormArm(index) {
  const H = /** @type {any} */ (window).__S3VD__; const S = /** @type {any} */ (window).__S3XL__;
  const f = document.forms[index];
  if (!f) return null;
  f.setAttribute('data-s3xl-form', '1');
  const live = () => Array.from(document.querySelectorAll('[role="alert"],[role="status"],[aria-live]:not([aria-live="off"]),output')).map((e) => (e.textContent || '').trim()).join(' ').trim();
  const fields = Array.from(f.elements).filter((el) => el.matches && el.matches('input,select,textarea') && !['hidden', 'submit', 'button', 'reset', 'image'].includes(/** @type {any} */ (el).type));
  const rec = S.form = { submitFired: false, prevented: null, invalid: [], liveBefore: live(), requiredBefore: fields.filter((el) => /** @type {any} */ (el).required || el.getAttribute('aria-required') === 'true').length };
  addEventListener('submit', (e) => { if (e.target === f) rec.submitFired = true; }, true);
  // registered after the page's own listeners: runs last in the bubble phase, sees their preventDefault()
  addEventListener('submit', (e) => { if (e.target !== f) return; rec.prevented = e.defaultPrevented; e.preventDefault(); }, false);
  f.addEventListener('invalid', (e) => { if (rec.invalid.length < 20) rec.invalid.push(H.sel(e.target)); }, true);
  const submit = f.querySelector('button:not([type]),button[type="submit"],input[type="submit"],input[type="image"]') || (f.id ? document.querySelector(`[form="${CSS.escape(f.id)}"][type="submit"]`) : null);
  if (submit) submit.setAttribute('data-s3xl-submit', '1');
  return { selector: H.sel(f), hasSubmit: !!submit, fields: fields.length, noValidate: f.noValidate };
}

/** State of the armed form after the empty submission. */
export function pageFormAfter() {
  const H = /** @type {any} */ (window).__S3VD__; const S = /** @type {any} */ (window).__S3XL__;
  const f = /** @type {HTMLFormElement | null} */ (document.querySelector('[data-s3xl-form]'));
  const rec = S.form;
  if (!f || !rec) return null;
  const live = () => Array.from(document.querySelectorAll('[role="alert"],[role="status"],[aria-live]:not([aria-live="off"]),output')).map((e) => (e.textContent || '').trim()).join(' ').trim();
  const textOf = (ids) => (ids || '').split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)).filter((el) => el && (el.textContent || '').trim() && (H.visible(el) || el.closest('[role="alert"],[aria-live]'))).map((el) => /** @type {any} */ (el).textContent.trim()).join(' ');
  const fields = Array.from(f.elements).filter((el) => el.matches && el.matches('input,select,textarea') && !['hidden', 'submit', 'button', 'reset', 'image'].includes(/** @type {any} */ (el).type));
  const info = fields.map((el) => {
    let nativeInvalid = false; try { nativeInvalid = el.matches(':invalid'); } catch { /* ignore */ }
    return { selector: H.sel(el), ariaInvalid: el.getAttribute('aria-invalid') === 'true', nativeInvalid, described: `${textOf(el.getAttribute('aria-describedby'))} ${textOf(el.getAttribute('aria-errormessage'))}`.trim().slice(0, 120) };
  });
  const a = H.deepActive();
  const ai = fields.indexOf(a);
  const activeInvalid = ai >= 0 && (info[ai].ariaInvalid || info[ai].nativeInvalid);
  const activeAlert = !!(a && a.closest && a.closest('[role="alert"],[role="alertdialog"]')) || !!(a && a !== document.body && a.getAttribute && a.getAttribute('tabindex') === '-1' && /error|problem|invalid|required|fix/i.test(a.textContent || ''));
  const visibleErrorText = Array.from(f.querySelectorAll('*')).filter((el) => /error|invalid|required/i.test(`${typeof el.className === 'string' ? el.className : ''} ${el.id}`) && H.visible(el) && (el.textContent || '').trim()).length;
  return { submitFired: rec.submitFired, prevented: rec.prevented, invalidEvents: rec.invalid.length, invalidFields: rec.invalid.slice(0, 5), fields: info.slice(0, 12), activeInvalid, activeAlert, active: a && a !== document.body ? H.sel(a) : 'body', liveBefore: rec.liveBefore, liveAfter: live(), requiredBefore: rec.requiredBefore, visibleErrorText };
}

/** What a not-found page offers. */
export function pageNotFound() {
  const text = (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').trim();
  const links = Array.from(document.querySelectorAll('a[href]')).filter((a) => { try { return new URL(/** @type {any} */ (a).href).origin === location.origin; } catch { return false; } });
  const home = links.some((a) => { const p = new URL(/** @type {any} */ (a).href).pathname; return p === '/' || /^\/index\.html?$/i.test(p); });
  return {
    title: document.title, textLength: text.length, excerpt: text.slice(0, 160),
    explains: /not found|404|doesn.?t exist|does not exist|no longer|can.?t find|cannot be found|could not be found|nothing here|missing/i.test(text),
    links: links.length, homeLink: home, nav: !!document.querySelector('nav,[role="navigation"]'),
  };
}

/** 3D canvases (from Visual Director's WebGL instrumentation): name, instructions, DOM controls, rect. */
export function pageCanvasInfo() {
  const w = /** @type {any} */ (window);
  const S = w.__S3VD_3D__; const H = w.__S3VD__; const X = w.__S3XL__.h;
  if (!S) return { instrumented: false, requested: 0, obtained: 0, canvases: [] };
  const requested = S.contexts.length;
  const glCanvases = S.canvases.filter((c) => !c.offscreen && c.canvas && c.canvas.isConnected).map((c) => c.canvas);
  const list = glCanvases.length ? glCanvases : (requested ? Array.from(document.querySelectorAll('canvas')) : []);
  const INSTR = /\b(drag|rotate|orbit|zoom|pan|pinch|swipe|scroll|tap|click|arrow keys?|keyboard|keys|press)\b/i;
  const LANDMARK = 'nav,[role="navigation"],header,footer,[role="banner"],[role="contentinfo"]';
  const FOCUSABLE = 'button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
  window.scrollTo(0, 0);
  const canvases = [];
  for (const cv of list) {
    if (!H.visible(cv)) continue;
    const r = cv.getBoundingClientRect();
    if (r.width < 50 || r.height < 50) continue;
    const near = new Set();
    const addSibs = (el) => { if (!el) return; let p = el.previousElementSibling; for (let i = 0; p && i < 2; i++, p = p.previousElementSibling) near.add(p); let n = el.nextElementSibling; for (let i = 0; n && i < 2; i++, n = n.nextElementSibling) near.add(n); };
    addSibs(cv);
    let stage = cv.parentElement;
    for (let i = 0; stage && i < 2 && stage !== document.body && !stage.matches('main,[role="main"]'); i++, stage = stage.parentElement) { near.add(stage); addSibs(stage); }
    const scope = Array.from(near).filter((el) => !el.matches(LANDMARK) && !el.closest(LANDMARK));
    const describedBy = (cv.getAttribute('aria-describedby') || '').split(/\s+/).map((id) => document.getElementById(id)).filter(Boolean);
    const text = [...scope, ...describedBy].filter((el) => H.visible(el)).map((el) => X.clean(el.innerText)).join(' ');
    const m = INSTR.exec(text);
    const ctrls = new Set();
    for (const el of scope) for (const c of [el, ...Array.from(el.querySelectorAll(FOCUSABLE))]) if (c !== cv && c.matches && c.matches(FOCUSABLE) && H.visible(c) && !c.closest(LANDMARK)) ctrls.add(c);
    if (cv.id) document.querySelectorAll(`[aria-controls~="${CSS.escape(cv.id)}"]`).forEach((c) => ctrls.add(c));
    let containerNamed = false;
    for (let p = cv.parentElement, i = 0; p && i < 2 && p !== document.body; p = p.parentElement, i++) if (p.matches('[role="img"],[role="group"],[role="region"],[role="application"],figure') && X.accName(p)) containerNamed = true;
    canvases.push({
      selector: H.sel(cv), container: cv.parentElement ? H.sel(cv.parentElement) : null,
      rect: { x: Math.round(r.left), y: Math.round(r.top + scrollY), width: Math.round(r.width), height: Math.round(r.height) },
      name: X.accName(cv).slice(0, 80), containerNamed, fallbackText: X.clean(cv.textContent).length,
      instructions: !!m, instructionExcerpt: m ? text.slice(Math.max(0, m.index - 40), m.index + 60) : null,
      controls: ctrls.size, controlSelectors: Array.from(ctrls).slice(0, 6).map((c) => H.sel(c)), canvasFocusable: cv.tabIndex >= 0,
    });
  }
  return { instrumented: true, requested, obtained: glCanvases.length, contextTypes: Array.from(new Set(S.contexts.map((c) => c.type))), canvases };
}
