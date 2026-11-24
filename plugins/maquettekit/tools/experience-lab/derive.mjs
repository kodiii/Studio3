// @ts-check
/**
 * Raw probe records (route × viewport pages + site-level probes) → signals.json entries.
 * Pure and deterministic: no browser, no clock. Every signal gets a raw `value`, a `status`
 * (measured | derived | not-applicable | unavailable), a one-line `summary` and `evidence.examples`.
 */
import { SIGNAL_BY_ID } from './catalog.mjs';
import { LAYOUT_PROPS } from '../visual-director/checks/motion.mjs';

const SPATIAL = new Set([...LAYOUT_PROPS, 'transform', 'translate', 'rotate', 'scale', 'offsetDistance', 'offsetPath', 'backgroundPosition', 'backgroundPositionX', 'backgroundPositionY', 'perspective', 'clipPath', 'all']);
const LAYOUT_KEBAB = new Set(LAYOUT_PROPS.map((p) => p.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())));
const IMPACT = { critical: 3, serious: 2, moderate: 1, minor: 0.5 };
export const LARGE_MOTION_PX2 = 4000;

const at = (p) => `${p.route} @ ${p.viewport}`;
const pct = (x) => `${Math.round(x * 100)}%`;
const r3 = (x) => Math.round(x * 1000) / 1000;
const sum = (xs) => xs.reduce((s, x) => s + x, 0);
const maxBy = (xs, f) => xs.reduce((best, x) => (best == null || f(x) > f(best) ? x : best), null);
const uniq = (xs) => [...new Set(xs)];
const ok = (probe) => probe && probe.status === 'measured';

/** Nav similarity: Jaccard overlap of destinations × agreement of their relative order. */
export function navSimilarity(a, b) {
  if (!a.length && !b.length) return 1;
  if (!a.length || !b.length) return 0;
  const A = new Set(a); const B = new Set(b);
  const common = a.filter((x) => B.has(x));
  const jaccard = common.length / new Set([...a, ...b]).size;
  let pairs = 0; let concordant = 0;
  for (let i = 0; i < common.length; i++) for (let j = i + 1; j < common.length; j++) { pairs++; if (b.indexOf(common[i]) < b.indexOf(common[j])) concordant++; }
  void A;
  return jaccard * (pairs ? concordant / pairs : 1);
}

/** Share of consecutive tab stops moving forward in reading order (fixed elements and off-page stops ignored). */
export function tabOrder(stops) {
  const s = stops.filter((x) => !x.fixed && x.w > 0 && x.h > 0 && x.y + x.h > 0 && x.x + x.w > 0);
  let forward = 0; let n = 0; const backward = [];
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1]; const b = s[i]; n++;
    const below = b.y >= a.y + a.h * 0.5;
    const sameRow = b.y < a.y + a.h && b.y + b.h > a.y;
    if (below || (sameRow && b.x >= a.x - 4)) forward++;
    else if (backward.length < 5) backward.push(`${a.selector} → ${b.selector}`);
  }
  return { forward, transitions: n, backward };
}

/** Deferred-content detection from the loading samples of one page. */
export function loadingFeedback(perf) {
  const samples = perf?.samples ?? [];
  if (!samples.length) return null;
  const t0 = (perf.fcp ?? perf.dcl ?? 0) + 300;
  const early = samples.filter((s) => s.t <= t0);
  const base = early.length ? Math.max(...early.map((s) => s.text)) : samples[0].text;
  const final = Math.max(...samples.map((s) => s.text));
  const growth = final - base;
  const deferred = growth >= 80 && growth >= 0.15 * Math.max(base, 1);
  if (!deferred) return { deferred: false, base, final };
  const arrival = samples.find((s) => s.t > t0 && s.text >= base + growth * 0.5)?.t ?? null;
  const before = samples.filter((s) => s.t >= (perf.dcl ?? 0) && (arrival == null || s.t <= arrival));
  const kinds = uniq(before.flatMap((s) => s.kinds ?? []));
  return { deferred: true, base, final, arrivalMs: arrival, indicator: before.some((s) => s.ind > 0), kinds };
}

/** TBT estimate: Σ (duration − 50) of long tasks that start after First Contentful Paint. */
export function blockingTime(perf) {
  const fcp = perf?.fcp ?? 0;
  const tasks = (perf?.longTasks ?? []).filter((t) => t.start + t.duration > fcp && t.start >= fcp - 50);
  return { ms: Math.round(sum(tasks.map((t) => Math.max(0, t.duration - 50)))), tasks: tasks.length, longest: tasks.length ? Math.max(...tasks.map((t) => t.duration)) : 0 };
}

/** Unique animations of one motion mode (early + late samples). */
function animsOf(mode) {
  const list = [...(mode?.early?.animations ?? []), ...(mode?.late?.animations ?? [])];
  const m = new Map();
  for (const a of list) { const k = `${a.type}|${a.name}|${a.selector}|${a.pseudo ?? ''}`; if (!m.has(k) || a.playState === 'running') m.set(k, a); }
  return [...m.values()];
}
const isSpatial = (a) => !a.properties?.length || a.properties.some((p) => SPATIAL.has(p));
const runningVisible = (a) => a.visible && a.playState === 'running';

/** Reduced-motion violations of one page. */
export function reducedViolations(page) {
  const red = page.motion?.reduced;
  if (!red) return null;
  const v = [];
  for (const a of animsOf(red)) {
    if (!a.visible) continue;
    if (a.iterations === 'infinite' && a.playState !== 'idle' && a.playState !== 'paused') v.push({ key: `loop:${a.name}`, text: `infinite "${a.name}" (${a.properties.join('/') || 'unknown properties'}) on ${a.selector} keeps running` });
    else if (isSpatial(a) && a.durationMs >= 100 && ['running', 'finished'].includes(a.playState)) v.push({ key: `spatial:${a.name}`, text: `"${a.name}" (${a.durationMs} ms, ${a.properties.join('/') || 'unknown properties'}) on ${a.selector} plays` });
  }
  if (red.frames?.available && red.frames.continuous) v.push({ key: 'view', text: `the view keeps changing (${red.frames.diffs.map(pct).join(', ')} of pixels per 400 ms) — script, video or canvas motion` });
  if (red.frames?.available && red.frames.canvasContinuous) v.push({ key: 'canvas', text: `the 3D canvas keeps animating (${(red.frames.canvasDiffs ?? []).map(pct).join(', ')} per 400 ms)` });
  return v;
}

/** Auto-playing motion of one page in normal mode. */
export function autoMotion(page) {
  const n = page.motion?.normal;
  if (!n) return null;
  const large = []; const any = []; const names = new Set();
  for (const a of animsOf(n)) {
    if (!runningVisible(a) || names.has(`${a.type}|${a.name}`)) continue; // selectors can shift after DOM inserts
    names.add(`${a.type}|${a.name}`);
    if (a.iterations === 'infinite') {
      any.push(`infinite "${a.name}" on ${a.selector}`);
      if (a.area >= LARGE_MOTION_PX2) large.push(`infinite "${a.name}" on ${a.selector} (${a.area} px²)`);
    } else if (a.durationMs > 5000) { any.push(`${a.durationMs} ms "${a.name}"`); large.push(`${a.durationMs} ms "${a.name}" on ${a.selector}`); }
  }
  const late = n.persistent;
  const secs = late?.atMs ? `${Math.round(late.atMs / 1000)} s` : 'several seconds';
  if (late?.available && late.continuous) { large.push(`the view is still changing ${secs} after load`); any.push('view still changing'); }
  if (late?.available && late.canvasContinuous) { large.push(`the 3D canvas is still animating ${secs} after load`); any.push('canvas still animating'); }
  return { large: uniq(large), any: uniq(any), controls: page.dom?.motionControls?.length ?? 0, controlNames: (page.dom?.motionControls ?? []).map((c) => c.name) };
}

/**
 * @param {any[]} pages route × viewport records from assess
 * @param {{ routes: string[], notFound?: any, fallback?: any[] }} site
 */
export function deriveSignals(pages, site) {
  /** @type {Record<string, any>} */ const S = {};
  const put = (id, value, summary, examples = [], extra = {}) => { S[id] = { value, status: SIGNAL_BY_ID[id].source === 'derived' ? 'derived' : 'measured', summary, evidence: { examples: examples.slice(0, 12), ...extra } }; };
  const na = (id, reason) => { S[id] = { value: null, status: 'not-applicable', reason }; };
  const un = (id, reason) => { S[id] = { value: null, status: 'unavailable', reason }; };
  const primary = pages.filter((p) => p.primary);
  const touch = pages.filter((p) => p.touch && p.dom?.targets);
  const pointer = primary.filter((p) => !p.touch);

  // ---- discoverability ------------------------------------------------------------
  { const t = sum(pages.map((p) => p.dom.names.total)); const n = sum(pages.map((p) => p.dom.names.named));
    if (!t) na('discoverability.accessibleNames', 'no interactive elements on the assessed pages');
    else put('discoverability.accessibleNames', r3(n / t), t === n ? `All ${t} interactive elements have an accessible name.` : `${t - n} of ${t} interactive elements have no accessible name.`, pages.flatMap((p) => p.dom.names.unnamed.map((u) => `${at(p)}: ${u.selector} (${u.role})`)), { total: t, named: n }); }
  { const worst = maxBy(pages, (p) => p.dom.fakeControls.length); const c = worst?.dom.fakeControls.length ?? 0;
    put('discoverability.affordanceSemantics', c, c ? `${c} clickable-looking element(s) without control semantics on ${at(worst)} (worst page).` : 'No clickable-looking elements without control semantics.', pages.flatMap((p) => p.dom.fakeControls.map((f) => `${at(p)}: ${f.selector} "${f.text}" (${f.why}${f.focusable ? ', focusable' : ''})`))); }
  { const t = sum(primary.map((p) => p.dom.inlineLinks.total)); const o = sum(primary.map((p) => p.dom.inlineLinks.ok));
    if (!t) na('discoverability.linkDistinguishable', 'no links inside running text');
    else put('discoverability.linkDistinguishable', r3(o / t), o === t ? `All ${t} inline links are distinguishable from the surrounding text.` : `${t - o} of ${t} inline links rely on colour alone (contrast with the text < 3:1, no underline).`, primary.flatMap((p) => p.dom.inlineLinks.failing.map((l) => `${p.route}: ${l.selector} "${l.text}" (${l.contrastWithText}:1 vs text)`))); }
  { const withAction = pages.filter((p) => p.dom.actionsAboveFold.count >= 1);
    put('discoverability.primaryActionVisible', r3(withAction.length / pages.length), `${withAction.length} of ${pages.length} pages show a button-like action in the first viewport.`, pages.filter((p) => !p.dom.actionsAboveFold.count).map((p) => `${at(p)}: no action above the fold`)); }

  // ---- usability ----------------------------------------------------------------------
  { const t = sum(primary.map((p) => p.dom.fields.total)); const l = sum(primary.map((p) => p.dom.fields.labelled));
    if (!t) na('usability.formLabels', 'no form fields');
    else put('usability.formLabels', r3(l / t), l === t ? `All ${t} form fields have a programmatic label.` : `${t - l} of ${t} form fields have no label (placeholder-only or unlabelled).`, primary.flatMap((p) => p.dom.fields.unlabelled.map((f) => `${p.route}: ${f.selector}${f.placeholder ? ` (placeholder "${f.placeholder}")` : ''}`))); }
  { const vals = pages.filter((p) => p.dom.text.bodyTextPx != null);
    if (!vals.length) na('usability.bodyTextSize', 'no text blocks of 20+ characters');
    else { const w = maxBy(vals, (p) => -p.dom.text.bodyTextPx); put('usability.bodyTextSize', w.dom.text.bodyTextPx, `Body text is ${w.dom.text.bodyTextPx}px on ${at(w)} (smallest page; character-weighted median).`, vals.map((p) => `${at(p)}: ${p.dom.text.bodyTextPx}px`)); } }
  { const vals = primary.filter((p) => p.dom.lineLength.medianChars != null).map((p) => p.dom.lineLength.medianChars).sort((a, b) => a - b);
    if (!vals.length) na('usability.lineLength', 'no multi-line paragraphs of 120+ characters');
    else { const mid = vals.length / 2; const m = Math.round(vals.length % 2 ? vals[Math.floor(mid)] : (vals[mid - 1] + vals[mid]) / 2); put('usability.lineLength', m, `Paragraphs run about ${m} characters per line (median over routes).`, primary.filter((p) => p.dom.lineLength.medianChars != null).map((p) => `${p.route}: ${p.dom.lineLength.medianChars} chars/line over ${p.dom.lineLength.paragraphs} paragraph(s)`)); } }
  { const over = pages.filter((p) => p.dom.overflowPx > 1);
    put('usability.noHorizontalScroll', r3(1 - over.length / pages.length), over.length ? `${over.length} of ${pages.length} pages scroll horizontally.` : `No page scrolls horizontally (${pages.length} checked).`, over.map((p) => `${at(p)}: ${p.dom.overflowPx}px wider than the viewport`)); }

  // ---- visual feedback ----------------------------------------------------------------
  const hov = pointer.filter((p) => ok(p.hover)).flatMap((p) => p.hover.results.filter((r) => !r.error).map((r) => ({ ...r, route: p.route })));
  if (!pointer.length) for (const id of ['visualFeedback.hoverStates', 'visualFeedback.activeStates', 'visualFeedback.animatedFeedback']) un(id, 'no pointer (non-touch) viewport in --viewports');
  else if (!pointer.some((p) => ok(p.hover))) for (const id of ['visualFeedback.hoverStates', 'visualFeedback.activeStates', 'visualFeedback.animatedFeedback']) un(id, pointer.find((p) => p.hover)?.hover?.reason ?? 'hover probe did not run');
  else if (!hov.length) for (const id of ['visualFeedback.hoverStates', 'visualFeedback.activeStates', 'visualFeedback.animatedFeedback']) na(id, 'no hoverable controls near the top of the pages');
  else {
    const changed = hov.filter((r) => r.hoverChanged.length);
    put('visualFeedback.hoverStates', r3(changed.length / hov.length), `${changed.length} of ${hov.length} sampled controls change visibly on hover.`, hov.filter((r) => !r.hoverChanged.length).map((r) => `${r.route}: ${r.selector} "${r.text}" — no hover change`));
    const btn = hov.filter((r) => r.activeChanged);
    if (!btn.length) na('visualFeedback.activeStates', 'no buttons among the sampled controls');
    else { const a = btn.filter((r) => r.activeChanged.length); put('visualFeedback.activeStates', r3(a.length / btn.length), `${a.length} of ${btn.length} sampled buttons show a pressed state.`, btn.filter((r) => !r.activeChanged.length).map((r) => `${r.route}: ${r.selector} "${r.text}" — no :active change`)); }
    if (!changed.length) na('visualFeedback.animatedFeedback', 'no hover changes to inspect');
    else { const t = changed.filter((r) => r.transitioned); put('visualFeedback.animatedFeedback', r3(t.length / changed.length), `${t.length} of ${changed.length} hover changes are transitioned.`, changed.filter((r) => !r.transitioned).map((r) => `${r.route}: ${r.selector} changes ${r.hoverChanged.slice(0, 3).join(', ')} instantly`)); }
  }

  // ---- navigation -------------------------------------------------------------------
  { const withNav = primary.filter((p) => p.dom.nav.landmarks > 0 && p.dom.nav.items.length >= 2);
    put('navigationConsistency.navLandmark', r3(withNav.length / primary.length), `${withNav.length} of ${primary.length} routes have a navigation landmark with links.`, primary.filter((p) => !withNav.includes(p)).map((p) => `${p.route}: ${p.dom.nav.landmarks ? 'nav landmark with < 2 links' : 'no <nav> landmark'}`)); }
  if (primary.length < 2) na('navigationConsistency.navConsistency', 'needs at least two routes');
  else if (primary.every((p) => !p.dom.nav.items.length)) na('navigationConsistency.navConsistency', 'no route has navigation links in a landmark (see navLandmark)');
  else {
    const sims = []; const ex = [];
    for (let i = 0; i < primary.length; i++) for (let j = i + 1; j < primary.length; j++) {
      const a = primary[i].dom.nav.items.map((x) => x.key); const b = primary[j].dom.nav.items.map((x) => x.key);
      const s = navSimilarity(a, b); sims.push(s);
      if (s < 1) { const onlyA = a.filter((x) => !b.includes(x)); const onlyB = b.filter((x) => !a.includes(x)); ex.push(`${primary[i].route} vs ${primary[j].route}: similarity ${r3(s)}${onlyA.length ? `; only on ${primary[i].route}: ${onlyA.join(', ')}` : ''}${onlyB.length ? `; only on ${primary[j].route}: ${onlyB.join(', ')}` : ''}${!onlyA.length && !onlyB.length ? '; same items, different order' : ''}`); }
    }
    const v = r3(sum(sims) / sims.length);
    put('navigationConsistency.navConsistency', v, v === 1 ? `Navigation has the same items in the same order on all ${primary.length} routes.` : `Navigation differs between routes (mean similarity ${v}).`, ex, { lists: Object.fromEntries(primary.map((p) => [p.route, p.dom.nav.items.map((x) => x.key)])) });
  }
  { const withCur = primary.filter((p) => p.dom.nav.currentLink);
    if (!withCur.length) na('navigationConsistency.currentPage', 'no navigation link points at an assessed route');
    else { const m = withCur.filter((p) => p.dom.nav.currentLink.marked); put('navigationConsistency.currentPage', r3(m.length / withCur.length), `${m.length} of ${withCur.length} routes mark their own navigation link with aria-current.`, withCur.filter((p) => !p.dom.nav.currentLink.marked).map((p) => `${p.route}: link to ${p.dom.nav.currentLink.key} has no aria-current`)); } }
  { const titles = primary.map((p) => p.dom.title.toLowerCase());
    const good = primary.filter((p, i) => titles[i] && titles.filter((t) => t === titles[i]).length === 1);
    put('navigationConsistency.pageTitles', r3(good.length / primary.length), good.length === primary.length ? `Every route has a unique title.` : `${primary.length - good.length} of ${primary.length} routes have an empty or duplicated <title>.`, primary.filter((p) => !good.includes(p)).map((p) => `${p.route}: "${p.dom.title || '(empty)'}"`)); }

  // ---- touch ----------------------------------------------------------------------------
  if (!touch.length) for (const id of ['touchInteraction.targetSize24', 'touchInteraction.targetSize44', 'touchInteraction.targetSpacing']) un(id, 'no touch viewport in --viewports (add mobile or tablet)');
  else {
    const c = sum(touch.map((p) => p.dom.targets.checked));
    if (!c) for (const id of ['touchInteraction.targetSize24', 'touchInteraction.targetSize44', 'touchInteraction.targetSpacing']) na(id, 'no non-exempt touch targets');
    else {
      const p24 = sum(touch.map((p) => p.dom.targets.pass24)); const b44 = sum(touch.map((p) => p.dom.targets.big44)); const sp = sum(touch.map((p) => p.dom.targets.spaced));
      put('touchInteraction.targetSize24', r3(p24 / c), p24 === c ? `All ${c} touch targets are ≥ 24×24 CSS px or spaced.` : `${c - p24} of ${c} touch targets are smaller than 24×24 CSS px and crowded.`, touch.flatMap((p) => p.dom.targets.failing.map((f) => `${at(p)}: ${f.selector} ${f.width}×${f.height}${f.crowdedBy ? ` next to ${f.crowdedBy}` : ''}`)), { checked: c, exempt: sum(touch.map((p) => p.dom.targets.exempt)) });
      put('touchInteraction.targetSize44', r3(b44 / c), `${b44} of ${c} touch targets are ≥ 44×44 CSS px.`, touch.flatMap((p) => p.dom.targets.small44.map((s) => `${at(p)}: ${s}`)));
      put('touchInteraction.targetSpacing', r3(sp / c), `${sp} of ${c} touch targets have ≥ 8px to their nearest neighbour.`);
    }
  }
  { const zoomOff = primary.filter((p) => p.dom.viewportMeta.zoomDisabled);
    put('touchInteraction.zoomAllowed', r3(1 - zoomOff.length / primary.length), zoomOff.length ? `${zoomOff.length} of ${primary.length} routes disable zoom in the viewport meta.` : 'No route disables zoom.', zoomOff.map((p) => `${p.route}: content="${p.dom.viewportMeta.content}"`)); }

  // ---- keyboard -----------------------------------------------------------------------
  const kb = primary.filter((p) => ok(p.keyboard));
  if (!kb.length) for (const id of ['keyboardSupport.reachable', 'keyboardSupport.noTrap', 'keyboardSupport.focusVisible', 'keyboardSupport.tabOrder', 'keyboardSupport.skipLink', 'interactionPredictability.focusNoContextChange']) un(id, primary.find((p) => p.keyboard)?.keyboard?.reason ?? 'keyboard walk did not run');
  else {
    const strict = (p) => p.keyboard.nonFocusable.filter((n) => !n.heuristic);
    const unreachable = sum(kb.map((p) => strict(p).length + p.keyboard.missed.length));
    const expected = sum(kb.map((p) => p.keyboard.expectedFocusable + strict(p).length));
    put('keyboardSupport.reachable', expected ? r3(1 - unreachable / expected) : 1, unreachable ? `${unreachable} interactive element(s) cannot be reached with Tab (of ${expected}).` : `Every interactive element was reachable with Tab (${expected} expected${kb.some((p) => p.keyboard.truncated) ? '; walk truncated at 40 stops on some routes' : ''}).`,
      kb.flatMap((p) => [...strict(p).map((n) => `${p.route}: ${n.selector} "${n.text}" (${n.reason}, not focusable)`), ...p.keyboard.missed.map((m) => `${p.route}: ${m.selector} "${m.text}" never reached`)]), { truncatedRoutes: kb.filter((p) => p.keyboard.truncated).map((p) => p.route) });
    const traps = kb.filter((p) => p.keyboard.trap);
    put('keyboardSupport.noTrap', r3(1 - traps.length / kb.length), traps.length ? `Keyboard trap on ${traps.map((p) => p.route).join(', ')}.` : 'Tab never got stuck.', traps.map((p) => `${p.route}: ${p.keyboard.trap.type} at ${p.keyboard.trap.selector}`));
    const stops = sum(kb.map((p) => p.keyboard.stops)); const bad = sum(kb.map((p) => p.keyboard.noIndicator.length));
    if (!stops) na('keyboardSupport.focusVisible', 'no keyboard-focusable elements were reached');
    else put('keyboardSupport.focusVisible', r3((stops - bad) / stops), bad ? `${bad} of ${stops} tab stops show no visible focus indicator.` : `All ${stops} tab stops show a visible focus indicator.`, kb.flatMap((p) => p.keyboard.noIndicator.map((s) => `${p.route}: ${s}`)), { confirmedByPixels: sum(kb.map((p) => p.keyboard.confirmedByPixels)) });
    const orders = kb.map((p) => ({ p, o: tabOrder(p.keyboard.geometry) }));
    const tr = sum(orders.map((x) => x.o.transitions));
    if (tr < 2) na('keyboardSupport.tabOrder', 'fewer than three tab stops');
    else { const f = sum(orders.map((x) => x.o.forward)); put('keyboardSupport.tabOrder', r3(f / tr), f === tr ? 'Tab order follows the visual reading order.' : `${tr - f} of ${tr} tab transitions jump backwards against the reading order.`, orders.flatMap((x) => x.o.backward.map((b) => `${x.p.route}: ${b}`))); }
    const skip = kb.filter((p) => p.keyboard.skip?.targetExists);
    put('keyboardSupport.skipLink', r3(skip.length / kb.length), `${skip.length} of ${kb.length} routes start with a working skip link.`, kb.filter((p) => !skip.includes(p)).map((p) => `${p.route}: first tab stop is ${p.keyboard.firstStop ?? 'nothing'}`));
    const moved = kb.filter((p) => p.keyboard.urlChanged);
    put('interactionPredictability.focusNoContextChange', r3(1 - moved.length / kb.length), moved.length ? `Tabbing changed the URL on ${moved.map((p) => p.route).join(', ')}.` : 'Tabbing never changed the URL.', moved.map((p) => `${p.route}: URL changed during the Tab walk`));
  }
  { const pops = primary.filter((p) => ok(p.popups)).flatMap((p) => p.popups.results.filter((r) => r.result === 'opened').map((r) => ({ ...r, route: p.route })));
    if (!primary.some((p) => ok(p.popups))) un('keyboardSupport.popupKeyboard', 'popup probe did not run');
    else if (!pops.length) na('keyboardSupport.popupKeyboard', 'no menu, dialog or disclosure trigger opened anything');
    else put('keyboardSupport.popupKeyboard', r3(sum(pops.map((r) => r.score)) / pops.length), `${pops.length} trigger(s) tested: ${pops.filter((r) => r.score === 1).length} fully keyboard operable.`, pops.filter((r) => r.score < 1).map((r) => `${r.route}: ${r.selector} (${r.popupKind ?? 'region'}) — ${Object.entries(r.checks).filter(([, v]) => !v).map(([k]) => ({ enter: 'does not open with Enter', focusInside: 'focus not moved inside', escapeCloses: 'Escape does not close', focusReturned: 'focus not returned' })[k]).join(', ')}`));
    const exp = pops.filter((r) => r.expandedState);
    if (!primary.some((p) => ok(p.popups))) un('interactionPredictability.expandedState', 'popup probe did not run');
    else if (!exp.length) na('interactionPredictability.expandedState', 'no aria-expanded trigger opened anything');
    else { const good = exp.filter((r) => r.expandedState.ok); put('interactionPredictability.expandedState', r3(good.length / exp.length), `${good.length} of ${exp.length} aria-expanded triggers report the state they show.`, exp.filter((r) => !r.expandedState.ok).map((r) => `${r.route}: ${r.selector} aria-expanded="${r.expandedState.after}" while the region is ${r.expandedState.controlledVisible ? 'visible' : 'hidden'}`)); } }

  // ---- motion --------------------------------------------------------------------------
  const motionPages = pages.filter((p) => p.motion?.normal);
  const viol = []; const seenV = new Set();
  for (const p of pages) for (const v of reducedViolations(p) ?? []) { const k = `${p.route}|${v.key}`; if (seenV.has(k)) continue; seenV.add(k); viol.push(`${at(p)}: ${v.text}`); }
  if (!pages.some((p) => p.motion?.reduced)) un('motionUsefulness.reducedMotion', 'reduced-motion pass did not run');
  else put('motionUsefulness.reducedMotion', viol.length, viol.length ? `${viol.length} motion violation(s) under prefers-reduced-motion: reduce.` : 'Nothing kept moving under prefers-reduced-motion: reduce.', viol, { pixelSampling: pages.some((p) => p.motion?.reduced?.frames?.available) });
  const autos = motionPages.map((p) => ({ p, a: autoMotion(p) }));
  { const largePages = autos.filter((x) => x.a.large.length); const anyPages = autos.filter((x) => x.a.any.length);
    const without = largePages.filter((x) => !x.a.controls);
    const ctrls = anyPages.length ? Math.min(...anyPages.map((x) => x.a.controls)) : Math.max(0, ...autos.map((x) => x.a.controls));
    const value = largePages.length ? r3(1 - without.length / largePages.length) : 1;
    put('motionUsefulness.pauseControl', value, !largePages.length ? `No large auto-playing motion lasting > 5 s${anyPages.length ? ' (small loops only)' : ''}.` : without.length ? `Auto-playing motion without a pause control on ${uniq(without.map((x) => x.p.route)).join(', ')}.` : 'Auto-playing motion has a pause/stop control.',
      [...without.flatMap((x) => x.a.large.map((l) => `${at(x.p)}: ${l}`)), ...autos.filter((x) => x.a.controls).map((x) => `${at(x.p)}: control ${x.a.controlNames.join(', ')}`)],
      { largeAutoMotion: largePages.length > 0, anyAutoMotion: anyPages.length > 0, controls: ctrls, autoMotion: uniq(autos.flatMap((x) => x.a.any.map((l) => `${x.p.route}: ${l}`))).slice(0, 10) }); }
  const normalAnims = motionPages.map((p) => ({ p, list: animsOf(p.motion.normal).filter((a) => a.visible) }));
  { const per = normalAnims.map((x) => ({ ...x, loops: uniq(x.list.filter((a) => a.iterations === 'infinite' && a.playState === 'running').map((a) => a.name)) }));
    const w = maxBy(per, (x) => x.loops.length); const c = w?.loops.length ?? 0;
    if (!motionPages.length) un('motionUsefulness.infiniteLoops', 'motion sampling did not run');
    else put('motionUsefulness.infiniteLoops', c, c ? `${c} infinite animation loop(s) on ${at(w.p)} (worst page).` : 'No infinite animation loops.', per.filter((x) => x.loops.length).map((x) => `${at(x.p)}: ${x.loops.join(', ')}`)); }
  { const fin = normalAnims.flatMap((x) => x.list.filter((a) => a.iterations !== 'infinite' && a.durationMs > 0).map((a) => ({ ...a, page: x.p })));
    const w = maxBy(fin, (a) => a.durationMs);
    if (!motionPages.length) un('motionUsefulness.longestAnimation', 'motion sampling did not run');
    else put('motionUsefulness.longestAnimation', w ? w.durationMs : 0, w ? `Longest animation: "${w.name}" ${w.durationMs} ms on ${at(w.page)}.` : 'No finite animations were observed.', fin.sort((a, b) => b.durationMs - a.durationMs).slice(0, 6).map((a) => `${at(a.page)}: "${a.name}" ${a.durationMs} ms (${a.properties.join('/') || 'unknown'}) on ${a.selector}`)); }
  { const per = motionPages.map((p) => ({ p, n: Math.max(...['early', 'late'].map((k) => uniq((p.motion.normal[k]?.animations ?? []).filter(runningVisible).map((a) => `${a.type}|${a.name}`)).length)) }));
    const w = maxBy(per, (x) => x.n);
    if (!motionPages.length) un('motionUsefulness.concurrency', 'motion sampling did not run');
    else put('motionUsefulness.concurrency', w?.n ?? 0, `Up to ${w?.n ?? 0} distinct animation(s) run at once (${w ? at(w.p) : 'n/a'}).`, per.filter((x) => x.n > 1).map((x) => `${at(x.p)}: ${x.n} at once`)); }
  { const props = new Set();
    for (const x of normalAnims) for (const a of x.list) for (const pr of a.properties) if (LAYOUT_PROPS.includes(pr)) props.add(pr.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()));
    for (const p of motionPages) for (const pr of p.motion.normal.late?.declaredLayoutTransitions ?? []) if (LAYOUT_KEBAB.has(pr)) props.add(pr);
    put('perceivedPerformance.layoutAnimations', props.size, props.size ? `Layout-triggering properties animated or transitioned: ${[...props].join(', ')}.` : 'Only compositor-friendly properties are animated.', [...props]); }

  // ---- cognitive load ------------------------------------------------------------------
  { const w = maxBy(primary, (p) => p.dom.text.fontSizes.length); put('cognitiveLoad.fontSizes', w.dom.text.fontSizes.length, `${w.dom.text.fontSizes.length} distinct font sizes on ${w.route} (${w.dom.text.fontSizes.join(', ')} px).`, primary.map((p) => `${p.route}: ${p.dom.text.fontSizes.length} sizes`)); }
  { const w = maxBy(primary, (p) => p.dom.text.colorCount); put('cognitiveLoad.textColors', w.dom.text.colorCount, `${w.dom.text.colorCount} distinct text colours on ${w.route}.`, primary.map((p) => `${p.route}: ${p.dom.text.colorCount} colours`)); }
  { const w = maxBy(pages, (p) => p.dom.actionsAboveFold.prominent); put('cognitiveLoad.competingActions', w.dom.actionsAboveFold.prominent, `${w.dom.actionsAboveFold.prominent} prominent (filled) action(s) compete in the first viewport of ${at(w)}.`, w.dom.actionsAboveFold.prominentExamples.map((e) => `${at(w)}: ${e.selector} "${e.text}"`)); }
  { const w = maxBy(pages, (p) => p.dom.wordsAboveFold); put('cognitiveLoad.wordsAboveFold', w.dom.wordsAboveFold, `${w.dom.wordsAboveFold} words above the fold on ${at(w)} (worst page).`, pages.map((p) => `${at(p)}: ${p.dom.wordsAboveFold} words`)); }
  { const sc = primary.map((p) => (p.dom.headings.h1 === 1 ? 0.5 : 0) + (p.dom.headings.skips === 0 ? 0.5 : 0));
    const bad = primary.filter((p, i) => sc[i] < 1);
    put('cognitiveLoad.headingStructure', r3(sum(sc) / sc.length), bad.length ? `${bad.length} of ${primary.length} routes have heading-structure problems.` : 'Every route has one h1 and no skipped heading levels.', bad.map((p) => `${p.route}: ${p.dom.headings.h1} h1${p.dom.headings.skips ? `, skipped levels: ${p.dom.headings.skipExamples.join('; ')}` : ''}`)); }

  // ---- loading & performance ---------------------------------------------------------------
  for (const [id, key, label] of [['loadingExperience.fcp', 'fcp', 'FCP'], ['loadingExperience.lcp', 'lcp', 'LCP']]) {
    const vals = pages.filter((p) => typeof p.perf?.[key] === 'number');
    if (!vals.length) un(id, `${label} was not reported by the browser`);
    else { const w = maxBy(vals, (p) => p.perf[key]); put(id, Math.round(w.perf[key]), `Lab ${label} up to ${Math.round(w.perf[key])} ms (${at(w)}; headless, loopback, unthrottled).`, vals.map((p) => `${at(p)}: ${Math.round(p.perf[key])} ms`)); }
  }
  { const lf = pages.map((p) => ({ p, l: loadingFeedback(p.perf) })).filter((x) => x.l?.deferred);
    if (!lf.length) na('loadingExperience.loadingFeedback', 'no content arrived after first paint (nothing deferred to cover)');
    else { const g = lf.filter((x) => x.l.indicator); put('loadingExperience.loadingFeedback', r3(g.length / lf.length), `${g.length} of ${lf.length} page(s) with deferred content showed a loading indicator first.`, lf.map((x) => `${at(x.p)}: +${x.l.final - x.l.base} characters at ~${x.l.arrivalMs} ms — ${x.l.indicator ? `indicator: ${x.l.kinds.join(', ')}` : 'blank until it arrived'}`)); } }
  { const t = sum(primary.map((p) => p.dom.media.total)); const r = sum(primary.map((p) => p.dom.media.reserved));
    if (!t) na('loadingExperience.mediaReserved', 'no images, videos or iframes');
    else put('loadingExperience.mediaReserved', r3(r / t), `${r} of ${t} media elements reserve their space.`, primary.flatMap((p) => p.dom.media.unreserved.map((s) => `${p.route}: ${s} has no width/height or aspect-ratio`))); }
  { const lat = primary.filter((p) => ok(p.latency));
    if (!lat.length) (primary.some((p) => p.latency?.status === 'not-applicable') ? na : un)('perceivedPerformance.inputLatency', primary.map((p) => p.latency?.reason).find(Boolean) ?? 'latency probe did not run');
    else { const w = maxBy(lat, (p) => p.latency.latencyMs); put('perceivedPerformance.inputLatency', w.latency.latencyMs, `Clicking ${w.latency.selector} ("${w.latency.text}") took ${w.latency.latencyMs} ms to the next paint on ${w.route} (lab; ${w.latency.method}; worst of ${w.latency.samples?.length ?? 1} sampled control(s)).`, lat.flatMap((p) => (p.latency.samples ?? []).filter((x) => x.status === 'measured').map((x) => `${p.route}: ${x.selector} "${x.text}" ${x.latencyMs} ms`))); } }
  { const vals = pages.filter((p) => p.perf).map((p) => ({ p, b: blockingTime(p.perf) }));
    if (!vals.length) un('perceivedPerformance.blockingTime', 'long-task data unavailable');
    else { const w = maxBy(vals, (x) => x.b.ms); put('perceivedPerformance.blockingTime', w.b.ms, w.b.ms ? `About ${w.b.ms} ms of main-thread blocking after first paint on ${at(w.p)} (${w.b.tasks} long task(s), longest ${w.b.longest} ms; lab).` : 'No long tasks after first paint.', vals.filter((x) => x.b.tasks).map((x) => `${at(x.p)}: ${x.b.tasks} long task(s), ~${x.b.ms} ms blocking`)); } }
  { const vals = pages.filter((p) => typeof p.perf?.cls === 'number');
    if (!vals.length) un('perceivedPerformance.layoutShift', 'layout-shift data unavailable');
    else { const w = maxBy(vals, (p) => p.perf.cls); put('perceivedPerformance.layoutShift', r3(w.perf.cls), `CLS up to ${r3(w.perf.cls)} (${at(w)}; lab, load + ~1.5 s).`, vals.filter((p) => p.perf.cls > 0.01).map((p) => `${at(p)}: CLS ${r3(p.perf.cls)} over ${p.perf.shifts} shift(s)`)); } }
  { const w = maxBy(primary, (p) => p.dom.domSize); put('perceivedPerformance.domSize', w.dom.domSize, `${w.dom.domSize} DOM elements on ${w.route} (largest).`, primary.map((p) => `${p.route}: ${p.dom.domSize}`)); }

  // ---- predictability ----------------------------------------------------------------------
  { const w = maxBy(pages, (p) => p.dom.linkMisuse.length); const c = w?.dom.linkMisuse.length ?? 0;
    put('interactionPredictability.linkSemantics', c, c ? `${c} link(s) used as buttons on ${at(w)}.` : 'No links are used as buttons.', pages.flatMap((p) => p.dom.linkMisuse.map((l) => `${at(p)}: ${l.selector} href=${JSON.stringify(l.href)} "${l.text}"`))); }
  { const t = sum(primary.map((p) => p.dom.newWindowLinks.total)); const a = sum(primary.map((p) => p.dom.newWindowLinks.announced));
    if (!t) na('interactionPredictability.newWindowWarning', 'no target="_blank" links');
    else put('interactionPredictability.newWindowWarning', r3(a / t), `${a} of ${t} new-tab links say so.`, primary.flatMap((p) => p.dom.newWindowLinks.unannounced.map((s) => `${p.route}: ${s}`))); }
  { const w = maxBy(primary, (p) => p.dom.buttonStyles.count); put('interactionPredictability.buttonStyles', w.dom.buttonStyles.count, `${w.dom.buttonStyles.count} distinct button style(s) on ${w.route}.`, w.dom.buttonStyles.variants.map((v) => `${w.route}: ${v}`)); }

  // ---- errors ---------------------------------------------------------------------------------
  { const withForms = primary.filter((p) => p.dom.forms > 0);
    const tested = primary.flatMap((p) => (p.forms?.tested ?? []).filter((t) => !t.error).map((t) => ({ ...t, route: p.route })));
    if (!withForms.length) na('errorHandling.formValidation', 'no form with a text field on the assessed routes');
    else if (!tested.length) un('errorHandling.formValidation', primary.map((p) => p.forms?.reason).find(Boolean) ?? 'forms could not be submitted');
    else {
      const crit = { blocked: 'submission not handled', identified: 'no aria-invalid', described: 'no associated error message', focus: 'focus not moved to the error', required: 'required fields not marked' };
      put('errorHandling.formValidation', r3(sum(tested.map((t) => t.score)) / tested.length), `${tested.length} form(s) submitted empty: mean validation score ${r3(sum(tested.map((t) => t.score)) / tested.length)}.`, tested.map((t) => `${t.route}: ${t.selector} — ${t.score === 1 ? 'all criteria met' : Object.entries(t.criteria).filter(([, v]) => v < 1).map(([k, v]) => `${crit[k]}${v > 0 ? ' (partial)' : ''}`).join(', ')}`));
    } }
  { const need = primary.filter((p) => p.dom.forms > 0 || loadingFeedback(p.perf)?.deferred);
    if (!need.length) na('errorHandling.liveRegions', 'no forms or deferred content');
    else { const g = need.filter((p) => p.dom.liveRegions > 0); put('errorHandling.liveRegions', r3(g.length / need.length), `${g.length} of ${need.length} route(s) with forms or deferred content have a live region at load.`, need.filter((p) => !g.includes(p)).map((p) => `${p.route}: no role=status/alert or aria-live region`)); } }
  { const nf = site.notFound;
    if (!ok(nf)) un('errorHandling.notFound', nf?.reason ?? '404 probe did not run');
    else put('errorHandling.notFound', nf.score, `Unknown route answered HTTP ${nf.httpStatus}${nf.emulated404Html ? ' with the site\'s 404.html' : ''}; ${nf.explains ? 'explains the problem' : 'no explanation'}; ${nf.parts.wayBack ? 'offers a way back' : 'no link home or navigation'}.`, [`${nf.url}: "${nf.excerpt.slice(0, 100)}"`]); }

  // ---- accessibility ---------------------------------------------------------------------------
  const ax = primary.filter((p) => ok(p.axe));
  if (!ax.length) for (const id of ['accessibility.axeViolations', 'accessibility.textContrast']) un(id, primary.map((p) => p.axe?.reason).find(Boolean) ?? 'axe-core did not run');
  else {
    const rules = new Map();
    for (const p of ax) for (const v of p.axe.violations) { const r = rules.get(v.id) ?? { ...v, routes: [] }; r.routes.push(p.route); if ((IMPACT[v.impact] ?? 0.5) > (IMPACT[r.impact] ?? 0.5)) r.impact = v.impact; rules.set(v.id, r); }
    const weighted = sum([...rules.values()].map((r) => IMPACT[r.impact] ?? 0.5));
    put('accessibility.axeViolations', weighted, rules.size ? `${rules.size} axe-core rule(s) violated (impact-weighted ${weighted}): ${[...rules.keys()].join(', ')}.` : 'axe-core found no violations (contrast and target size scored separately).', [...rules.values()].map((r) => `${r.id} (${r.impact}) on ${r.routes.join(', ')}: ${r.help} — e.g. ${r.targets[0] ?? ''}`), { engine: ax[0].axe.engine });
    const pass = sum(ax.map((p) => p.axe.contrast.pass)); const fail = sum(ax.map((p) => p.axe.contrast.fail)); const inc = sum(ax.map((p) => p.axe.contrast.incomplete));
    if (!pass && !fail) na('accessibility.textContrast', 'axe-core could not decide any text contrast');
    else put('accessibility.textContrast', r3(pass / (pass + fail)), fail ? `${fail} of ${pass + fail} text elements fail the contrast minimum (${inc} undecidable).` : `All ${pass} decidable text elements meet the contrast minimum (${inc} undecidable, e.g. over images).`, ax.flatMap((p) => p.axe.contrast.failures.map((f) => `${p.route}: ${f.target} — ${f.summary}`)));
  }

  // ---- spatial (3D) ------------------------------------------------------------------------------
  const cv = primary.flatMap((p) => (p.canvas?.canvases ?? []).map((c) => ({ ...c, route: p.route })));
  const webglRoutes = uniq(pages.filter((p) => (p.canvas?.requested ?? 0) > 0).map((p) => p.route));
  if (!webglRoutes.length) for (const id of ['spatialInteractionClarity.instructions', 'spatialInteractionClarity.keyboardAlternatives', 'spatialInteractionClarity.accessibleName', 'spatialInteractionClarity.fallback']) na(id, 'no canvas requested a WebGL/WebGPU context');
  else {
    if (!cv.length) for (const id of ['spatialInteractionClarity.instructions', 'spatialInteractionClarity.keyboardAlternatives', 'spatialInteractionClarity.accessibleName']) na(id, 'WebGL was requested but no visible canvas ≥ 50×50 was found');
    else {
      const ins = cv.filter((c) => c.instructions);
      put('spatialInteractionClarity.instructions', r3(ins.length / cv.length), `${ins.length} of ${cv.length} 3D canvas(es) have interaction instructions nearby.`, cv.map((c) => `${c.route}: ${c.selector} — ${c.instructions ? `"…${c.instructionExcerpt}…"` : 'no instructions found near the canvas'}`));
      const alt = cv.map((c) => (c.controls >= 2 ? 1 : c.controls === 1 ? 0.5 : c.canvasFocusable && /arrow|key/i.test(c.instructionExcerpt ?? '') ? 0.5 : 0));
      put('spatialInteractionClarity.keyboardAlternatives', r3(sum(alt) / alt.length), `${cv.filter((c) => c.controls >= 2).length} of ${cv.length} 3D canvas(es) have two or more DOM controls next to them.`, cv.map((c) => `${c.route}: ${c.selector} — ${c.controls} control(s)${c.controlSelectors.length ? `: ${c.controlSelectors.join(', ')}` : ''}`));
      const named = cv.filter((c) => c.name || c.containerNamed || c.fallbackText > 0);
      put('spatialInteractionClarity.accessibleName', r3(named.length / cv.length), `${named.length} of ${cv.length} 3D canvas(es) have an accessible name or description.`, cv.filter((c) => !named.includes(c)).map((c) => `${c.route}: ${c.selector} has no name`));
    }
    const fb = (site.fallback ?? []).filter((f) => ok(f));
    if (!fb.length) un('spatialInteractionClarity.fallback', (site.fallback ?? []).map((f) => f.reason).find(Boolean) ?? 'no-WebGL check did not run');
    else put('spatialInteractionClarity.fallback', r3(sum(fb.map((f) => f.score)) / fb.length), `${fb.filter((f) => f.score === 1).length} of ${fb.length} 3D route(s) show fallback content without errors when WebGL is unavailable.`, fb.map((f) => `${f.route}: ${f.fallback.found ? `fallback found (${f.fallback.matchedBy})` : 'no fallback content'}${f.uncaughtErrors.length ? `; throws: ${f.uncaughtErrors[0]}` : ''}`));
  }

  // ---- context + motion summary for the report ------------------------------------------------
  const allNormal = normalAnims.flatMap((x) => x.list);
  const fin = allNormal.filter((a) => a.iterations !== 'infinite');
  const motion = {
    animationsNormal: uniq(allNormal.map((a) => `${a.type}|${a.name}|${a.selector}`)).length,
    infinite: uniq(allNormal.filter((a) => a.iterations === 'infinite').map((a) => a.name)).length,
    longestMs: fin.reduce((m, a) => Math.max(m, a.durationMs), 0),
    maxConcurrent: S['motionUsefulness.concurrency']?.value ?? 0,
    layoutProperties: S['perceivedPerformance.layoutAnimations']?.evidence?.examples ?? [],
    violations: viol.length, violationExamples: viol.slice(0, 6),
    autoMotion: S['motionUsefulness.pauseControl']?.evidence?.autoMotion ?? [], controls: S['motionUsefulness.pauseControl']?.evidence?.controls ?? 0,
  };
  return { signals: S, context: { webgl: webglRoutes.length > 0, routesWith3D: webglRoutes }, motion };
}
