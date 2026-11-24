// @ts-check
/** Network / console watchers and the failed-assets + console-errors checks. */

/** @param {string} url @param {string} resourceType */
export function categorizeAsset(url, resourceType) {
  let pathname = url;
  try { pathname = new URL(url).pathname; } catch { /* keep */ }
  const ext = (/\.([a-z0-9]+)$/i.exec(pathname)?.[1] ?? '').toLowerCase();
  if (['glb', 'gltf', 'bin', 'drc', 'fbx', 'obj', 'usdz'].includes(ext)) return 'model';
  if (['ktx2', 'ktx', 'basis', 'hdr', 'exr', 'dds'].includes(ext)) return 'texture';
  if (resourceType === 'font' || ['woff', 'woff2', 'ttf', 'otf'].includes(ext)) return 'font';
  if (resourceType === 'script' || ['js', 'mjs'].includes(ext)) return 'script';
  if (resourceType === 'stylesheet' || ext === 'css') return 'stylesheet';
  if (resourceType === 'image' || ['webp', 'png', 'jpg', 'jpeg', 'avif', 'gif', 'svg'].includes(ext)) {
    return resourceType === 'fetch' || resourceType === 'xhr' ? 'texture' : 'image';
  }
  if (resourceType === 'document') return 'document';
  if (resourceType === 'media') return 'media';
  return 'other';
}

const ASSET_SEVERITY = { document: 'critical', script: 'critical', stylesheet: 'major', image: 'major', model: 'major', texture: 'major', media: 'major', font: 'minor', other: 'minor' };

/**
 * Attach listeners to a page. Returns live arrays plus `mark()`/`since()` for delta queries.
 * @param {import('playwright').Page} page
 */
export function attachWatchers(page) {
  /** @type {{seq:number, text:string, location?:string}[]} */ const consoleErrors = [];
  /** @type {{seq:number, text:string, stack?:string}[]} */ const pageErrors = [];
  /** @type {{seq:number, url:string, resourceType:string, status?:number, failure?:string, method:string}[]} */ const failed = [];
  let seq = 0;
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const loc = msg.location();
    consoleErrors.push({ seq: ++seq, text: msg.text().slice(0, 500), location: loc?.url ? `${loc.url}:${loc.lineNumber}` : undefined });
  });
  page.on('pageerror', (err) => { pageErrors.push({ seq: ++seq, text: String(err?.message ?? err).slice(0, 500), stack: String(err?.stack ?? '').split('\n').slice(0, 4).join('\n') }); });
  page.on('requestfailed', (req) => {
    const failure = req.failure()?.errorText ?? 'failed';
    if (/ERR_ABORTED/.test(failure)) return; // navigation / media cancellation, not an asset failure
    failed.push({ seq: ++seq, url: req.url(), resourceType: req.resourceType(), failure, method: req.method() });
  });
  page.on('response', (res) => {
    if (res.status() < 400) return;
    const req = res.request();
    failed.push({ seq: ++seq, url: res.url(), resourceType: req.resourceType(), status: res.status(), method: req.method() });
  });
  return {
    consoleErrors, pageErrors, failed,
    mark: () => seq,
    /** @param {number} m */
    since: (m) => ({
      consoleErrors: consoleErrors.filter((e) => e.seq > m && !/^Failed to load resource/i.test(e.text)),
      pageErrors: pageErrors.filter((e) => e.seq > m),
      failed: failed.filter((e) => e.seq > m),
    }),
  };
}

/** Path part of a URL for stable keys. @param {string} url */
export function urlKey(url) {
  try { const u = new URL(url); return u.pathname + u.search; } catch { return url; }
}

/**
 * @param {ReturnType<typeof attachWatchers>} watch
 * @param {{ brokenImages: any[], domImageUrls: string[], hasCanvas: boolean }} dom
 * @param {{ route: string, viewport: string, col: any }} ctx
 */
export function reportAssetsAndConsole(watch, dom, ctx) {
  const { col, route, viewport } = ctx;
  const base = { route, viewport };
  const failedByUrl = new Map();
  for (const f of watch.failed) if (!failedByUrl.has(f.url)) failedByUrl.set(f.url, f);
  const reported = new Set();
  let fail = false;

  for (const img of dom.brokenImages) {
    const net = failedByUrl.get(img.url);
    if (/\.svg([?#]|$)/i.test(img.url) && !net) continue; // SVG without intrinsic size reports naturalWidth 0
    reported.add(img.url); fail = true;
    col.issue({ ...base, check: 'failed-assets', severity: 'major', selector: img.selector, key: urlKey(img.url),
      message: `Image failed to load: ${urlKey(img.url)}${net?.status ? ` (HTTP ${net.status})` : ''}.`,
      evidence: { category: 'image', url: img.url, naturalWidth: 0, status: net?.status ?? null, failure: net?.failure ?? null } });
  }
  const domImgs = new Set(dom.domImageUrls);
  for (const f of failedByUrl.values()) {
    if (reported.has(f.url)) continue;
    let category = categorizeAsset(f.url, f.resourceType);
    if (category === 'image' && dom.hasCanvas && !domImgs.has(f.url)) category = 'texture';
    const isFavicon = /\/favicon\.ico$/.test(urlKey(f.url));
    const severity = isFavicon ? 'info' : ASSET_SEVERITY[category] ?? 'minor';
    if (!isFavicon) fail = true;
    col.issue({ ...base, check: 'failed-assets', severity, key: urlKey(f.url),
      message: `${category[0].toUpperCase()}${category.slice(1)} request failed: ${urlKey(f.url)} (${f.status ? `HTTP ${f.status}` : f.failure}).`,
      evidence: { category, url: f.url, resourceType: f.resourceType, status: f.status ?? null, failure: f.failure ?? null, method: f.method } });
  }
  col.run('failed-assets', { ...base, status: fail ? 'failed' : 'passed' });

  let cfail = false;
  const seen = new Set();
  for (const e of watch.pageErrors) {
    if (seen.has('p' + e.text)) continue; seen.add('p' + e.text); cfail = true;
    col.issue({ ...base, check: 'console-errors', severity: 'critical', key: 'pageerror:' + e.text.slice(0, 120), message: `Uncaught exception: ${e.text}`, evidence: { type: 'pageerror', text: e.text, stack: e.stack } });
  }
  for (const e of watch.consoleErrors) {
    if (/^Failed to load resource/i.test(e.text)) continue; // reported by failed-assets with the URL
    if (seen.has('c' + e.text)) continue; seen.add('c' + e.text); cfail = true;
    col.issue({ ...base, check: 'console-errors', severity: 'major', key: 'console:' + e.text.slice(0, 120), message: `Console error: ${e.text}`, evidence: { type: 'console.error', text: e.text, location: e.location ?? null } });
  }
  col.run('console-errors', { ...base, status: cfail ? 'failed' : 'passed' });
}
