// @ts-check
/** Motion summary + reduced-motion behaviour. */
import { loadPngTools, diffPngBuffers, round } from '../util.mjs';

export const LAYOUT_PROPS = ['width', 'height', 'top', 'left', 'right', 'bottom', 'margin', 'marginTop', 'marginLeft', 'marginRight', 'marginBottom', 'padding', 'paddingTop', 'paddingLeft', 'paddingRight', 'paddingBottom', 'inset', 'fontSize', 'lineHeight', 'borderWidth', 'maxHeight', 'maxWidth', 'minHeight', 'minWidth', 'gridTemplateColumns', 'gridTemplateRows', 'flexBasis', 'gap'];
const SPATIAL = new Set([...LAYOUT_PROPS, 'transform', 'translate', 'rotate', 'scale', 'offsetDistance', 'offsetPath', 'backgroundPosition', 'backgroundPositionX', 'backgroundPositionY', 'strokeDashoffset', 'scrollTop', 'perspective', 'clipPath', 'all']);
const kebabToCamel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/** Runs in the page. */
export function pageCollectAnimations() {
  const H = /** @type {any} */ (window).__S3VD__;
  const out = [];
  let anims = [];
  try { anims = document.getAnimations(); } catch { /* unsupported */ }
  for (const a of anims.slice(0, 200)) {
    /** @type {any} */ const an = a;
    const eff = an.effect;
    let timing = {}; let props = [];
    try { timing = eff ? eff.getComputedTiming() : {}; } catch { /* ignore */ }
    try { const set = new Set(); for (const k of (eff && eff.getKeyframes ? eff.getKeyframes() : [])) for (const p of Object.keys(k)) if (!['offset', 'computedOffset', 'easing', 'composite'].includes(p)) set.add(p); props = Array.from(set); } catch { /* ignore */ }
    const ctor = an.constructor && an.constructor.name;
    const type = ctor === 'CSSAnimation' ? 'css-animation' : ctor === 'CSSTransition' ? 'css-transition' : 'waapi';
    const target = eff && eff.target;
    out.push({
      type, name: an.animationName || an.transitionProperty || an.id || '(anonymous)', playState: an.playState,
      durationMs: typeof timing.duration === 'number' ? timing.duration : 0, delayMs: timing.delay || 0,
      iterations: timing.iterations === Infinity ? 'infinite' : (timing.iterations == null ? 1 : timing.iterations),
      properties: props, selector: target ? H.sel(target) : '', pseudo: (eff && eff.pseudoElement) || null,
    });
  }
  // declared transitions (they only show up in getAnimations() while running)
  let declaredTransitionElements = 0; const transitionProps = new Set();
  for (const el of Array.from(document.body ? document.body.querySelectorAll('*') : []).slice(0, 3000)) {
    const cs = getComputedStyle(el);
    const max = Math.max(0, ...cs.transitionDuration.split(',').map((s) => parseFloat(s) * (s.trim().endsWith('ms') ? 1 : 1000) || 0));
    if (max > 0) { declaredTransitionElements++; cs.transitionProperty.split(',').forEach((p) => transitionProps.add(p.trim())); }
  }
  return { animations: out, declaredTransitionElements, transitionProperties: Array.from(transitionProps).slice(0, 30), hasCanvas: !!document.querySelector('canvas'), hasVideo: !!document.querySelector('video') };
}

/** Runs in the page: sample requestAnimationFrame intervals for `ms`. */
export function pageSampleRaf(ms) {
  return new Promise((resolve) => {
    const ts = []; const start = performance.now();
    const tick = (t) => { ts.push(t); if (t - start < ms) requestAnimationFrame(tick); else { const iv = []; for (let i = 1; i < ts.length; i++) iv.push(ts[i] - ts[i - 1]); resolve(iv); } };
    requestAnimationFrame(tick);
    setTimeout(() => { const iv = []; for (let i = 1; i < ts.length; i++) iv.push(ts[i] - ts[i - 1]); resolve(iv); }, ms + 2000);
  });
}

/** @param {number[]} iv */
export function frameStats(iv) {
  if (!iv.length) return null;
  const s = [...iv].sort((a, b) => a - b);
  const at = (p) => s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))];
  return { frames: iv.length + 1, medianMs: round(at(0.5)), p95Ms: round(at(0.95)), maxMs: round(s[s.length - 1]), over50ms: iv.filter((x) => x > 50).length };
}

/** @param {any[]} animations */
function summarizeAnimations(animations) {
  const key = (a) => `${a.type}|${a.name}|${a.selector}|${a.pseudo ?? ''}`;
  const uniq = [...new Map(animations.map((a) => [key(a), a])).values()];
  const props = new Set(uniq.flatMap((a) => a.properties));
  const layoutProps = [...props].filter((p) => LAYOUT_PROPS.includes(p));
  return {
    animations: uniq,
    counts: { cssAnimations: uniq.filter((a) => a.type === 'css-animation').length, cssTransitions: uniq.filter((a) => a.type === 'css-transition').length, waapi: uniq.filter((a) => a.type === 'waapi').length, total: uniq.length },
    longestDurationMs: uniq.reduce((m, a) => Math.max(m, a.durationMs || 0), 0),
    infinite: uniq.filter((a) => a.iterations === 'infinite').length,
    properties: [...props], layoutTriggeringProperties: layoutProps,
  };
}

/**
 * Collect the motion profile of the current page (one motion mode).
 * @param {import('playwright').Page} page
 * @param {{ sampleRaf?: boolean }} [opts]
 */
export async function collectMotion(page, opts = {}) {
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  const first = await page.evaluate(pageCollectAnimations);
  /** @type {number | null} */ let pixelChangeRatio = null; let pixelNote;
  try {
    const tools = await loadPngTools();
    const a = await page.screenshot();
    await page.waitForTimeout(500);
    const b = await page.screenshot();
    pixelChangeRatio = round(diffPngBuffers(tools, a, b, 0.1).ratio, 5);
  } catch (err) { pixelNote = `pixel sampling unavailable: ${String(/** @type {any} */ (err).message).split('\n')[0]}`; await page.waitForTimeout(500); }
  const second = await page.evaluate(pageCollectAnimations);
  const sum = summarizeAnimations([...first.animations, ...second.animations]);
  const running = second.animations.filter((a) => a.playState === 'running' && (a.durationMs > 200 || a.iterations === 'infinite'));
  let raf = null;
  if (opts.sampleRaf) raf = frameStats(/** @type {number[]} */ (await page.evaluate(pageSampleRaf, 1500).catch(() => [])));
  return {
    ...sum, running, runningCount: running.length, pixelChangeRatio, pixelNote,
    declaredTransitionElements: second.declaredTransitionElements,
    declaredTransitionProperties: second.transitionProperties,
    declaredLayoutTransitions: second.transitionProperties.map(kebabToCamel).filter((p) => LAYOUT_PROPS.includes(p)),
    hasCanvas: second.hasCanvas, hasVideo: second.hasVideo, raf,
  };
}

/**
 * Compare normal vs reduced motion and emit issues.
 * @param {any} normal @param {any} reduced
 * @param {{ route: string, viewport: string, col: any }} ctx
 */
export function reportMotion(normal, reduced, ctx) {
  const { col, route, viewport } = ctx;
  const base = { route, viewport };
  // --- motion summary (info-level hints only) ---
  const layoutProps = [...new Set([...normal.layoutTriggeringProperties, ...normal.declaredLayoutTransitions])];
  if (layoutProps.length) {
    col.issue({ ...base, check: 'motion-summary', severity: 'info', key: 'layout-props',
      message: `Animations/transitions touch layout-triggering properties (${layoutProps.join(', ')}); prefer transform/opacity.`,
      evidence: { properties: layoutProps, animated: normal.layoutTriggeringProperties, declaredTransitions: normal.declaredLayoutTransitions, hint: 'performance' } });
  }
  col.run('motion-summary', { ...base, status: 'passed', details: { ...normal.counts, infinite: normal.infinite, longestDurationMs: normal.longestDurationMs } });

  // --- reduced motion ---
  let fail = false;
  for (const a of reduced.running.slice(0, 8)) {
    const spatial = a.properties.length === 0 || a.properties.some((p) => SPATIAL.has(p));
    const severity = spatial ? 'major' : a.iterations === 'infinite' ? 'minor' : 'info';
    if (severity !== 'info') fail = true;
    col.issue({ ...base, check: 'reduced-motion', severity, selector: a.selector, key: a.name,
      message: `Animation "${a.name}" (${a.type}, ${a.iterations === 'infinite' ? 'infinite' : Math.round(a.durationMs) + 'ms'}, ${a.properties.join('/') || 'unknown properties'}) keeps running with prefers-reduced-motion: reduce.`,
      evidence: { animation: a, runningReduced: reduced.runningCount, runningNormal: normal.runningCount, spatial } });
  }
  const ratio = reduced.pixelChangeRatio;
  if (ratio != null && ratio > 0.001 && reduced.runningCount === 0) {
    const media = reduced.hasCanvas || reduced.hasVideo;
    if (!media) fail = true;
    col.issue({ ...base, check: 'reduced-motion', severity: media ? 'info' : 'minor', key: 'pixel-change',
      message: `${round(ratio * 100, 2)}% of above-the-fold pixels changed within 500ms under prefers-reduced-motion: reduce${media ? ' (page contains canvas/video, which may legitimately change)' : ' with no CSS/WAAPI animation running — possibly script-driven motion'}.`,
      evidence: { pixelChangeRatioReduced: ratio, pixelChangeRatioNormal: normal.pixelChangeRatio, hasCanvas: reduced.hasCanvas, hasVideo: reduced.hasVideo } });
  }
  col.run('reduced-motion', { ...base, status: fail ? 'failed' : 'passed',
    details: { runningNormal: normal.runningCount, runningReduced: reduced.runningCount, pixelChangeRatioNormal: normal.pixelChangeRatio, pixelChangeRatioReduced: reduced.pixelChangeRatio } });
}
