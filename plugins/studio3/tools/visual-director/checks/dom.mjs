// @ts-check
/**
 * DOM geometry checks: horizontal overflow, clipped content, broken-layout
 * heuristics, responsive regressions. One page.evaluate collects all measurements.
 */

/**
 * Runs in the page. Self-contained apart from the `window.__S3VD__` helper library.
 * @param {{ touch: boolean, maxElements: number, minFontPx: number, minTapPx: number }} opts
 */
export function pageDomMeasure(opts) {
  const H = /** @type {any} */ (window).__S3VD__;
  const de = document.documentElement;
  const body = document.body;
  const vw = de.clientWidth;
  const vh = window.innerHeight;
  const all = body ? Array.from(body.querySelectorAll('*')).slice(0, opts.maxElements) : [];
  const rectOf = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top + window.scrollY), width: Math.round(r.width), height: Math.round(r.height) }; };
  /** nearest ancestor that clips or scrolls horizontally */
  const xContainer = (el) => {
    for (let p = el.parentElement; p && p !== body && p !== de; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll') return 'scroll';
      if (ox === 'hidden' || ox === 'clip') return 'clip';
    }
    return null;
  };
  const isFixed = (el) => {
    for (let p = el; p && p !== de; p = p.parentElement) {
      const pos = getComputedStyle(p).position;
      if (pos === 'fixed' || pos === 'sticky') return true;
    }
    return false;
  };
  const ownText = (el) => Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join('').replace(/\s+/g, ' ').trim();
  const srOnly = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return (r.width <= 2 || r.height <= 2) || (cs.clip !== 'auto' && cs.position === 'absolute') || cs.clipPath !== 'none' && r.width <= 2;
  };

  /**
   * Content nobody can see clipped: decorative subtrees the author took out of the experience
   * (`aria-hidden="true"`, `inert` — live thumbnails, marquee clones, odometer reels) and screen-reader-only
   * content (absolute + degenerate `clip` rect, `clip-path: inset(50%)`, 1px boxes that hide their overflow).
   */
  const unseenCache = new Map();
  const unseenBox = (el) => {
    if (el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('inert')) return true;
    const cs = getComputedStyle(el);
    if ((cs.position === 'absolute' || cs.position === 'fixed') && cs.clip && cs.clip !== 'auto') {
      const v = (cs.clip.match(/-?[\d.]+px/g) || []).map(parseFloat); // rect(top, right, bottom, left)
      if (v.length === 4 && (v[1] - v[3] <= 1 || v[2] - v[0] <= 1)) return true;
    }
    const inset = /^inset\(\s*([\d.]+)%\s*\)$/.exec(cs.clipPath || '');
    if (inset && parseFloat(inset[1]) >= 50) return true;
    const r = el.getBoundingClientRect();
    return r.width <= 1 && r.height <= 1 && cs.overflowX !== 'visible' && cs.overflowY !== 'visible';
  };
  const unseen = (el) => {
    for (let p = el; p && p !== body && p !== de; p = p.parentElement) {
      let v = unseenCache.get(p);
      if (v === undefined) { v = unseenBox(p); unseenCache.set(p, v); }
      if (v) return true;
    }
    return false;
  };

  // ---- horizontal overflow ---------------------------------------------------
  const scrollWidth = Math.max(de.scrollWidth, body ? body.scrollWidth : 0);
  const overflow = { scrollWidth, clientWidth: vw, overflowPx: Math.max(0, scrollWidth - vw), offenders: /** @type {any[]} */ ([]) };
  if (scrollWidth > vw + 1) {
    const offending = new Set();
    for (const el of all) {
      if (!H.visible(el)) continue;
      const r = el.getBoundingClientRect();
      const boxOver = r.right > vw + 1;
      const contentOver = !boxOver && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'visible' && r.left + el.scrollWidth > vw + 1 && ownText(el).length > 0;
      if (!boxOver && !contentOver) continue;
      if (getComputedStyle(el).position === 'fixed') continue;
      if (xContainer(el)) continue;
      offending.add(el);
    }
    const hasOffendingChild = new Set();
    for (const el of offending) for (let p = el.parentElement; p; p = p.parentElement) if (offending.has(p)) hasOffendingChild.add(p);
    for (const el of offending) {
      if (hasOffendingChild.has(el)) continue;
      const r = el.getBoundingClientRect();
      overflow.offenders.push({ selector: H.sel(el), right: Math.round(Math.max(r.right, r.left + el.scrollWidth)), width: Math.round(Math.max(r.width, el.scrollWidth)), text: H.text(el, 40) });
      if (overflow.offenders.length >= 10) break;
    }
  }

  // ---- clipped text ----------------------------------------------------------
  const clipped = [];
  let hardClips = 0; let truncations = 0; let clipSkippedUnseen = 0;
  for (const el of all) {
    if (hardClips >= 15) break;
    const cs = getComputedStyle(el);
    const clipX = cs.overflowX === 'hidden' || cs.overflowX === 'clip';
    const clipY = cs.overflowY === 'hidden' || cs.overflowY === 'clip';
    if (!clipX && !clipY) continue;
    if (el.clientWidth <= 2 || el.clientHeight <= 2) continue; // visually-hidden pattern
    const overX = clipX && el.scrollWidth > el.clientWidth + 2;
    const overY = clipY && el.scrollHeight > el.clientHeight + 2;
    if (!overX && !overY) continue;
    if (!H.visible(el)) continue;
    if (unseen(el)) { clipSkippedUnseen++; continue; }
    const box = el.getBoundingClientRect();
    // is the overflow caused by text? look for a text rect that leaves the clip box
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let hit = null; let n = 0;
    while (!hit && walker.nextNode() && n++ < 60) {
      const node = walker.currentNode;
      if (!node.nodeValue || !node.nodeValue.trim()) continue;
      const parent = node.parentElement;
      if (!parent || !H.visible(parent) || unseen(parent)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of Array.from(range.getClientRects())) {
        if ((overX && (r.right > box.right + 2 || r.left < box.left - 2)) || (overY && (r.bottom > box.bottom + 2 || r.top < box.top - 2))) { hit = node.nodeValue.replace(/\s+/g, ' ').trim().slice(0, 60); break; }
      }
    }
    if (!hit) continue;
    // deliberate, visibly marked truncation: text-overflow: ellipsis (one line) or line-clamp (n lines)
    const clampValue = [cs.getPropertyValue('-webkit-line-clamp'), cs.getPropertyValue('line-clamp')].find((v) => v && v !== 'none');
    const lineClamp = clampValue ? (parseInt(clampValue, 10) || clampValue) : null;
    const ellipsis = (cs.textOverflow === 'ellipsis' && overX && !overY) || (!!lineClamp && overY && !overX);
    if (ellipsis) { if (++truncations > 5) continue; } else hardClips++;
    clipped.push({
      selector: H.sel(el), text: hit, ellipsis, ...(lineClamp && ellipsis ? { lineClamp } : {}),
      clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, clientHeight: el.clientHeight, scrollHeight: el.scrollHeight,
      hiddenPx: { x: overX ? el.scrollWidth - el.clientWidth : 0, y: overY ? el.scrollHeight - el.clientHeight : 0 },
    });
  }

  // ---- broken layout heuristics ---------------------------------------------
  const zeroMedia = [];
  for (const el of Array.from(document.querySelectorAll('img,video,canvas')).slice(0, 300)) {
    if (zeroMedia.length >= 10) break;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility !== 'visible') continue;
    if (el.closest('[hidden],template')) continue;
    if (el.parentElement && el.parentElement.closest('svg')) continue;
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility()) continue;
    if (el.localName === 'img' && !el.getAttribute('src') && !el.getAttribute('srcset')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) zeroMedia.push({ selector: H.sel(el), tag: el.localName, width: r.width, height: r.height, src: (el.getAttribute('src') || '').slice(0, 120) });
  }

  const interactive = Array.from(document.querySelectorAll(H.INTERACTIVE)).filter((el) => H.visible(el) && !el.disabled).slice(0, 200);
  const irects = interactive.map((el) => el.getBoundingClientRect());
  const overlaps = [];
  for (let i = 0; i < interactive.length && overlaps.length < 10; i++) {
    for (let j = i + 1; j < interactive.length && overlaps.length < 10; j++) {
      const a = interactive[i]; const b = interactive[j];
      if (a.contains(b) || b.contains(a)) continue;
      const ra = irects[i]; const rb = irects[j];
      const ix = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const iy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ix <= 1 || iy <= 1) continue;
      const ratio = (ix * iy) / Math.min(ra.width * ra.height, rb.width * rb.height);
      if (ratio < 0.25) continue;
      if (isFixed(a) || isFixed(b)) continue;
      const la = a.closest('label'); const lb = b.closest('label');
      if ((la && la.contains(b)) || (lb && lb.contains(a))) continue;
      overlaps.push({ selector: H.sel(a), other: H.sel(b), overlapRatio: Math.round(ratio * 100) / 100, overlapPx: { width: Math.round(ix), height: Math.round(iy) } });
    }
  }

  const offscreen = []; const flaggedOff = new Set();
  const smallText = [];
  for (const el of all) {
    const t = ownText(el);
    if (!t) continue;
    if (!H.visible(el)) continue;
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize);
    if (smallText.length < 10 && fs > 0 && fs < opts.minFontPx && !srOnly(el)) smallText.push({ selector: H.sel(el), fontSizePx: Math.round(fs * 100) / 100, text: t.slice(0, 40) });
    if (offscreen.length < 10) {
      const r = el.getBoundingClientRect();
      const off = r.right + window.scrollX < 0 || r.bottom + window.scrollY < 0;
      if (off && !srOnly(el) && !el.closest('[aria-hidden="true"],[inert]') && !/sr-only|visually-hidden|screen-reader|skip/i.test(String(/** @type {any} */ (el).className && /** @type {any} */ (el).className.baseVal !== undefined ? /** @type {any} */ (el).className.baseVal : /** @type {any} */ (el).className))
        && !(el.localName === 'a' && (el.getAttribute('href') || '').startsWith('#'))) {
        let dup = false;
        for (let p = el.parentElement; p; p = p.parentElement) if (flaggedOff.has(p)) { dup = true; break; }
        if (!dup) { flaggedOff.add(el); offscreen.push({ selector: H.sel(el), rect: rectOf(el), text: t.slice(0, 40) }); }
      }
    }
  }
  const bodyRect = body ? body.getBoundingClientRect() : { height: 0 };
  const bodyZero = !body || (bodyRect.height === 0 && de.scrollHeight <= vh && body.scrollHeight === 0) || (bodyRect.height === 0 && !Array.from(body.children).some((c) => H.visible(c)));

  // ---- broken images (DOM side) ---------------------------------------------
  const brokenImages = [];
  const domImageUrls = [];
  for (const img of Array.from(document.images).slice(0, 500)) {
    const src = img.currentSrc || img.src;
    if (src) domImageUrls.push(src);
    if (!img.getAttribute('src') && !img.getAttribute('srcset')) continue;
    if (img.complete && img.naturalWidth === 0) brokenImages.push({ selector: H.sel(img), url: src, alt: img.getAttribute('alt') });
  }

  // ---- responsive ------------------------------------------------------------
  const meta = document.querySelector('meta[name="viewport"]');
  const viewportMeta = { present: !!meta, content: meta ? meta.getAttribute('content') : null };
  const wide = []; const wideSet = new Set();
  for (const el of all) {
    if (!H.visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= vw + 1) continue;
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed') continue;
    if (xContainer(el) === 'scroll') continue;
    const meaningful = ['img', 'video', 'table', 'pre', 'input', 'textarea', 'select', 'iframe', 'canvas'].includes(el.localName) || H.text(el, 5).length > 0;
    if (!meaningful) continue;
    if (unseen(el)) continue; // decorative or screen-reader-only: horizontal-overflow still catches page scrolling
    wideSet.add(el);
  }
  const wideParents = new Set();
  for (const el of wideSet) for (let p = el.parentElement; p; p = p.parentElement) if (wideSet.has(p)) wideParents.add(p);
  for (const el of wideSet) {
    if (wideParents.has(el) || wide.length >= 10) continue;
    wide.push({ selector: H.sel(el), width: Math.round(el.getBoundingClientRect().width), viewportWidth: vw, clippedByAncestor: xContainer(el) === 'clip' });
  }

  const tapTargets = []; let tapChecked = 0; let tapSpacingExempt = 0;
  if (opts.touch) {
    for (let i = 0; i < interactive.length; i++) {
      const el = interactive[i]; const r = irects[i];
      tapChecked++;
      if (r.width >= opts.minTapPx && r.height >= opts.minTapPx) continue;
      if (el.localName === 'input' && /^(checkbox|radio)$/.test(el.type)) continue; // user-agent control exception
      if (el.localName === 'a' && getComputedStyle(el).display.startsWith('inline') && el.parentElement
        && el.parentElement.textContent.replace(/\s+/g, ' ').trim().length > el.textContent.replace(/\s+/g, ' ').trim().length + 1) continue; // inline exception
      // spacing exception: a 24px box centred on the target must not intersect another target
      const cx = r.left + r.width / 2; const cy = r.top + r.height / 2; const h = opts.minTapPx / 2;
      let crowdedBy = null;
      for (let j = 0; j < interactive.length; j++) {
        if (j === i) continue;
        const o = interactive[j]; if (o.contains(el) || el.contains(o)) continue;
        const ro = irects[j];
        if (cx - h < ro.right && cx + h > ro.left && cy - h < ro.bottom && cy + h > ro.top) { crowdedBy = H.sel(o); break; }
      }
      if (!crowdedBy) { tapSpacingExempt++; continue; }
      if (tapTargets.length < 15) tapTargets.push({ selector: H.sel(el), width: Math.round(r.width * 10) / 10, height: Math.round(r.height * 10) / 10, crowdedBy, text: H.text(el, 30) });
    }
  }

  return {
    viewport: { width: vw, height: vh, dpr: window.devicePixelRatio }, elementCount: all.length, truncated: body ? body.querySelectorAll('*').length > all.length : false,
    overflow, clipped, clipStats: { truncations, skippedDecorativeOrHidden: clipSkippedUnseen }, zeroMedia, overlaps, offscreen, smallText, bodyZero, brokenImages, domImageUrls,
    viewportMeta, wide, tapTargets, tapChecked, tapSpacingExempt,
    hasCanvas: !!document.querySelector('canvas'), hasVideo: !!document.querySelector('video'),
  };
}

/**
 * Wait (bounded) for finite running animations and transitions to finish, so geometry and contrast are read
 * from a settled frame rather than mid-reveal — e.g. scroll reveals set off by the full-page screenshot's
 * temporary viewport resize. Infinite animations are ignored. Returns the time waited in ms.
 * @param {import('playwright').Page} page @param {number} [maxMs]
 */
export async function settleAnimations(page, maxMs = 2000) {
  return page.evaluate(async (max) => {
    const t0 = performance.now();
    for (let round = 0; round < 3; round++) {
      /** @type {Animation[]} */ let anims = [];
      try {
        anims = document.getAnimations().filter((a) => {
          if (a.playState !== 'running') return false;
          try { return Number.isFinite(/** @type {any} */ (a.effect).getComputedTiming().endTime); } catch { return false; }
        });
      } catch { break; }
      const left = max - (performance.now() - t0);
      if (!anims.length || left <= 0) break;
      await Promise.race([Promise.allSettled(anims.map((a) => a.finished)), new Promise((r) => setTimeout(r, left))]);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
    }
    return Math.round(performance.now() - t0);
  }, maxMs).catch(() => 0);
}

/**
 * @param {import('playwright').Page} page
 * @param {{ route: string, viewport: string, touch: boolean, emitViewportMeta: boolean, col: any }} ctx
 */
export async function runDomChecks(page, ctx) {
  const { route, viewport, col } = ctx;
  const base = { route, viewport };
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await settleAnimations(page);
  const m = await page.evaluate(pageDomMeasure, { touch: ctx.touch, maxElements: 6000, minFontPx: 11, minTapPx: 24 });
  if (m.truncated) col.limit(`DOM checks examined the first ${m.elementCount} elements of ${route} (page is larger).`);

  // horizontal overflow
  if (m.overflow.overflowPx > 1) {
    col.issue({ ...base, check: 'horizontal-overflow', severity: 'major', selector: m.overflow.offenders[0]?.selector,
      message: `Page scrolls horizontally: content is ${m.overflow.overflowPx}px wider than the ${m.overflow.clientWidth}px viewport.`,
      evidence: m.overflow });
  }
  col.run('horizontal-overflow', { ...base, status: m.overflow.overflowPx > 1 ? 'failed' : 'passed' });

  // clipped content
  let clipFail = false;
  for (const c of m.clipped) {
    if (!c.ellipsis) clipFail = true;
    col.issue({ ...base, check: 'clipped-content', severity: c.ellipsis ? 'info' : 'major', selector: c.selector,
      message: c.ellipsis ? (c.lineClamp ? `Text truncated with line-clamp (${c.lineClamp} lines) ("${c.text}"); keep the full text reachable.` : `Text truncated with ellipsis ("${c.text}").`) : `Text is clipped by an overflow-hidden box ("${c.text}"): ${c.hiddenPx.x}px hidden horizontally, ${c.hiddenPx.y}px vertically.`,
      evidence: c });
  }
  col.run('clipped-content', { ...base, status: clipFail ? 'failed' : 'passed', details: m.clipStats });

  // broken layout heuristics
  let layoutFail = false;
  if (m.bodyZero) { layoutFail = true; col.issue({ ...base, check: 'broken-layout', severity: 'critical', selector: 'body', key: 'body-zero', message: 'Document body has zero height / no visible content.', evidence: { heuristic: false } }); }
  for (const z of m.zeroMedia) { layoutFail = true; col.issue({ ...base, check: 'broken-layout', severity: 'major', selector: z.selector, key: 'zero-media', message: `<${z.tag}> is displayed but has zero size (${z.width}×${z.height}).`, evidence: { ...z, heuristic: true } }); }
  for (const o of m.overlaps) { layoutFail = true; col.issue({ ...base, check: 'broken-layout', severity: 'minor', selector: o.selector, key: 'overlap:' + o.other, message: `Interactive elements overlap: ${o.selector} and ${o.other} (${Math.round(o.overlapRatio * 100)}% of the smaller one).`, evidence: { ...o, heuristic: true } }); }
  for (const o of m.offscreen) { layoutFail = true; col.issue({ ...base, check: 'broken-layout', severity: 'minor', selector: o.selector, key: 'offscreen', message: `Visible text is positioned entirely outside the document ("${o.text}").`, evidence: { ...o, heuristic: true } }); }
  for (const s of m.smallText) { layoutFail = true; col.issue({ ...base, check: 'broken-layout', severity: 'minor', selector: s.selector, key: 'small-text', message: `Text rendered at ${s.fontSizePx}px (below 11px): "${s.text}".`, evidence: { ...s, thresholdPx: 11, heuristic: true } }); }
  col.run('broken-layout', { ...base, status: layoutFail ? 'failed' : 'passed' });

  // responsive
  let respFail = false;
  if (ctx.emitViewportMeta) {
    const content = m.viewportMeta.content ?? '';
    if (!m.viewportMeta.present) { respFail = true; col.issue({ ...base, check: 'responsive', severity: 'major', key: 'viewport-meta', message: 'No <meta name="viewport"> — mobile browsers will render at a ~980px desktop layout width.', evidence: m.viewportMeta }); }
    else if (!/width\s*=\s*device-width/i.test(content)) { respFail = true; col.issue({ ...base, check: 'responsive', severity: 'minor', key: 'viewport-meta', message: `Viewport meta does not set width=device-width (content="${content}").`, evidence: m.viewportMeta }); }
    else if (/user-scalable\s*=\s*(no|0)/i.test(content) || /maximum-scale\s*=\s*1(\.0*)?\b/i.test(content)) { respFail = true; col.issue({ ...base, check: 'responsive', severity: 'minor', key: 'viewport-zoom', message: `Viewport meta restricts zooming (content="${content}").`, evidence: m.viewportMeta }); }
  }
  for (const wd of m.wide) { respFail = true; col.issue({ ...base, check: 'responsive', severity: 'major', selector: wd.selector, key: 'wide', message: `Element is ${wd.width}px wide in a ${wd.viewportWidth}px viewport${wd.clippedByAncestor ? ' (clipped by an ancestor)' : ''}.`, evidence: wd }); }
  for (const t of m.tapTargets) { respFail = true; col.issue({ ...base, check: 'responsive', severity: 'major', selector: t.selector, key: 'tap-target', message: `Tap target is ${t.width}×${t.height} CSS px (minimum 24×24, WCAG 2.2 SC 2.5.8) and too close to ${t.crowdedBy}.`, evidence: { ...t, minimumPx: 24 } }); }
  col.run('responsive', { ...base, status: respFail ? 'failed' : 'passed', details: { tapTargetsChecked: ctx.touch ? m.tapChecked : 'not a touch viewport', tapTargetsExemptBySpacing: m.tapSpacingExempt } });

  return m;
}
