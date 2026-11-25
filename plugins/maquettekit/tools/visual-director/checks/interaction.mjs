// @ts-check
/**
 * Interaction reachability. An element that handles pointer input (native listeners, inline handlers, React or
 * Solid handlers) or has its own :hover styles only works if the pointer can reach it. When another element is
 * stacked above it — a stretched link's ::after overlay, a transparent positioned layer, a sibling placed on
 * top — the browser sends every pointer event to the covering element: click and hover handlers never run and
 * hover styles never show. Nothing looks wrong in a screenshot, which is why this is measured by hit-testing.
 */

/**
 * Runs in the page. Self-contained apart from the `window.__S3VD__` helper library.
 * Each candidate is scrolled to the middle of the viewport (so sticky headers and bottom bars do not count as
 * covers) and hit-tested at up to five points with elementFromPoint, descending into shadow roots. It is reported
 * only when no point reaches it and the topmost element is neither inside it nor one of its ancestors (an
 * ancestor on top means the candidate is clipped there or ignores pointer events, which is not an overlay).
 * @param {{ maxCandidates: number, maxIssues: number, minSizePx: number, includeHover: boolean }} opts
 */
export function pageInteractionMeasure(opts) {
  const H = /** @type {any} */ (window).__S3VD__;
  const de = document.documentElement;
  const body = document.body;
  if (!H || !body) return { candidates: 0, handlerElements: 0, hoverSubjects: 0, tested: 0, occluded: [], truncated: false, hoverRulesUnreadable: 0 };

  // ---- elements with their own :hover styles (rules whose last compound selector carries :hover) ----------
  const hoverSubjects = new Set();
  let hoverRulesUnreadable = 0;
  /** split a selector list on top-level commas */
  const splitList = (text) => { const out = []; let depth = 0; let cur = ''; for (const ch of text) { if (ch === '(' || ch === '[') depth++; else if (ch === ')' || ch === ']') depth--; if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map((x) => x.trim()).filter(Boolean); };
  /** index where the last compound selector starts (after the last top-level combinator) */
  const lastCompoundStart = (sel) => { let depth = 0; let idx = 0; for (let i = 0; i < sel.length; i++) { const ch = sel[i]; if (ch === '(' || ch === '[') depth++; else if (ch === ')' || ch === ']') depth--; else if (depth === 0 && (ch === ' ' || ch === '>' || ch === '+' || ch === '~')) idx = i + 1; } return idx; };
  const visitRules = (rules) => {
    for (const rule of Array.from(rules || [])) {
      const r = /** @type {any} */ (rule);
      if (r.cssRules && !r.selectorText) { visitRules(r.cssRules); continue; }
      if (!r.selectorText || r.selectorText.indexOf(':hover') === -1) continue;
      for (const sel of splitList(r.selectorText)) {
        const start = lastCompoundStart(sel);
        const last = sel.slice(start);
        if (last.indexOf(':hover') === -1 || /:not\([^)]*:hover/.test(last)) continue;
        const subject = (sel.slice(0, start) + (last.replace(/:hover/g, '') || '*')).trim();
        try { for (const el of Array.from(document.querySelectorAll(subject)).slice(0, 200)) hoverSubjects.add(el); } catch { /* unsupported selector */ }
      }
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try { visitRules(sheet.cssRules); } catch { hoverRulesUnreadable++; } // cross-origin sheets cannot be read
  }

  // ---- candidates ------------------------------------------------------------------------------------------
  const decorative = (el) => { for (let p = el; p && p !== body; p = p.parentElement) { if (p.hasAttribute('inert') || p.getAttribute('aria-hidden') === 'true') return true; } return false; };
  const all = Array.from(body.querySelectorAll('*'));
  /** @type {{ el: Element, types: string[], hover: boolean }[]} */
  const candidates = [];
  let handlerElements = 0; let hoverCount = 0;
  for (const el of all) {
    const types = H.handlerTypes(el);
    const hover = opts.includeHover && hoverSubjects.has(el);
    if (!types.length && !hover) continue;
    if (types.length) handlerElements++; else hoverCount++;
    if (!H.visible(el) || decorative(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.pointerEvents === 'none') continue; // the author opted it out of hit-testing
    const r = el.getBoundingClientRect();
    if (r.width < opts.minSizePx || r.height < opts.minSizePx) continue;
    if (r.width * r.height >= de.clientWidth * window.innerHeight * 0.9) continue; // page-level wrappers: children are expected on top
    candidates.push({ el, types, hover });
  }
  // handler elements first: they are the defects that break behaviour, hover-only ones break styling
  candidates.sort((a, b) => (b.types.length ? 1 : 0) - (a.types.length ? 1 : 0));
  const truncated = candidates.length > opts.maxCandidates;
  const tested = candidates.slice(0, opts.maxCandidates);

  // ---- hit-testing -----------------------------------------------------------------------------------------
  const deepHit = (x, y) => {
    let el = document.elementFromPoint(x, y);
    for (let i = 0; el && el.shadowRoot && i < 8; i++) { const inner = el.shadowRoot.elementFromPoint(x, y); if (!inner || inner === el) break; el = inner; }
    return el;
  };
  /** is `node` the element or inside it (crossing shadow boundaries)? */
  const within = (node, el) => { for (let n = node; n; n = /** @type {any} */ (n).parentNode || /** @type {any} */ (n).host) if (n === el) return true; return false; };
  const pseudoOverlay = (cover, x, y) => {
    const r = cover.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return null; // the element's own box
    for (const pe of ['::after', '::before']) {
      const ps = getComputedStyle(cover, pe);
      if (ps.content && ps.content !== 'none' && ps.content !== 'normal' && (ps.position === 'absolute' || ps.position === 'fixed')) return pe;
    }
    return 'overflow';
  };
  const prevBehavior = de.style.scrollBehavior;
  de.style.scrollBehavior = 'auto';
  const startX = window.scrollX; const startY = window.scrollY;
  const vw = de.clientWidth; const vh = window.innerHeight;
  const maxScroll = Math.max(0, de.scrollHeight - vh);
  /** @type {any[]} */ const occludedRaw = [];
  for (const c of tested) {
    let r = c.el.getBoundingClientRect();
    const target = Math.min(maxScroll, Math.max(0, window.scrollY + r.top + r.height / 2 - vh / 2));
    if (Math.abs(target - window.scrollY) > 1) { window.scrollTo(window.scrollX, target); r = c.el.getBoundingClientRect(); }
    const pts = [[0.5, 0.5]];
    if (r.width >= 24 && r.height >= 24) pts.push([0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]);
    let inView = 0; let reached = false; let ancestorOnTop = false; /** @type {any} */ let cover = null; let at = null;
    for (const [fx, fy] of pts) {
      const x = r.left + r.width * fx; const y = r.top + r.height * fy;
      if (x < 0 || y < 0 || x >= vw || y >= vh) continue;
      inView++;
      const hit = deepHit(x, y);
      if (!hit) continue;
      if (within(hit, c.el)) { reached = true; break; }
      if (within(c.el, hit)) { ancestorOnTop = true; continue; }
      if (!cover) { cover = hit; at = [x, y]; }
    }
    if (!inView || reached || ancestorOnTop || !cover) continue;
    occludedRaw.push({ el: c.el, cover, types: c.types, hover: c.hover, via: pseudoOverlay(cover, at[0], at[1]) });
  }
  window.scrollTo(startX, startY);
  de.style.scrollBehavior = prevBehavior;

  // report the outermost element of a covered group once
  const occludedEls = new Set(occludedRaw.map((o) => o.el));
  const occluded = occludedRaw.filter((o) => { for (let p = o.el.parentElement; p; p = p.parentElement) if (occludedEls.has(p)) return false; return true; })
    .slice(0, opts.maxIssues)
    .map((o) => ({
      selector: H.sel(o.el), tag: o.el.localName, text: H.text(o.el, 40), types: o.types, hoverOnly: !o.types.length, hoverStyles: o.hover,
      cover: H.sel(o.cover), coverTag: o.cover.localName, coverText: H.text(o.cover, 40), via: o.via,
      framework: Object.keys(o.el).some((k) => k.startsWith('__reactProps$')) ? 'react' : undefined,
    }));
  return { candidates: candidates.length, handlerElements, hoverSubjects: hoverCount, tested: tested.length, occluded, truncated, hoverRulesUnreadable };
}

/**
 * @param {import('playwright').Page} page
 * @param {{ route: string, viewport: string, touch: boolean, col: any }} ctx
 */
export async function runInteractionChecks(page, ctx) {
  const { route, viewport, col } = ctx;
  const base = { route, viewport };
  let m;
  try {
    m = await page.evaluate(pageInteractionMeasure, { maxCandidates: 400, maxIssues: 15, minSizePx: 8, includeHover: !ctx.touch }); // touch has no hover
  } catch (err) {
    col.run('interaction-reachability', { ...base, status: 'unavailable', ran: false, reason: `measurement failed: ${String(/** @type {any} */ (err).message).split('\n')[0]}` });
    return null;
  }
  if (m.truncated) col.limit(`Interaction reachability hit-tested the first ${m.tested} of ${m.candidates} elements with pointer handlers or :hover styles on ${route}.`);
  if (m.hoverRulesUnreadable) col.limit(`${m.hoverRulesUnreadable} cross-origin stylesheet(s) on ${route} could not be read, so their :hover rules were not considered.`);
  for (const o of m.occluded) {
    const by = `${o.cover}${o.via === '::after' || o.via === '::before' ? ` (its ${o.via} overlay)` : ''}`;
    col.issue({
      ...base, check: 'interaction-reachability', severity: o.hoverOnly ? 'minor' : 'major', selector: o.selector, key: o.hoverOnly ? 'hover-unreachable' : 'handler-covered',
      message: o.hoverOnly
        ? `${o.selector} has :hover styles but is covered by ${by}; the pointer never reaches it, so its hover state can never show.`
        : `${o.selector} handles ${o.types.join('/')} but is covered by ${by}; pointer events go to the covering element, so these handlers never run.`,
      evidence: o,
    });
  }
  col.run('interaction-reachability', { ...base, status: m.occluded.length ? 'failed' : 'passed', details: { candidates: m.candidates, handlerElements: m.handlerElements, hoverOnlyElements: m.hoverSubjects, hitTested: m.tested, covered: m.occluded.length } });
  return m;
}
