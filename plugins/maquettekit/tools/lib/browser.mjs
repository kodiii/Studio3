// @ts-check
/**
 * Shared Playwright helpers for Visual Director and Experience Lab.
 * Playwright is an optional dependency resolved through lib/resolve.mjs.
 */
import { importDep } from './resolve.mjs';
import { UserError } from './log.mjs';

/** Viewport presets. Sizes are CSS pixels; `mobile`/`tablet` emulate touch. */
export const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  laptop: { width: 1280, height: 720, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  tablet: { width: 820, height: 1180, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  mobile: { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
};

/**
 * Launch Chromium. Software WebGL (SwiftShader) flags are added so 3D pages can
 * initialise on machines without a GPU; `gpu: false` simulates an environment
 * with no usable graphics stack (WebGL context creation fails).
 * @param {{ headless?: boolean, gpu?: boolean, args?: string[] }} [opts]
 */
export async function launchBrowser(opts = {}) {
  const pw = await importDep('playwright', 'browser automation');
  const chromium = pw.chromium ?? pw.default?.chromium;
  const args = opts.gpu === false
    ? ['--disable-gpu', '--disable-webgl', '--disable-webgl2', '--disable-3d-apis']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  try {
    return await chromium.launch({ headless: opts.headless ?? true, args: [...args, ...(opts.args ?? [])] });
  } catch (err) {
    throw new UserError(
      `Chromium could not be launched: ${String(err && /** @type {any} */ (err).message).split('\n')[0]}\n` +
      '  Install the browser with:  npx playwright install chromium', 3);
  }
}

/**
 * Create a context for a viewport preset.
 * @param {import('playwright').Browser} browser
 * @param {keyof typeof VIEWPORTS | { width: number, height: number, deviceScaleFactor?: number, isMobile?: boolean, hasTouch?: boolean }} viewport
 * @param {{ reducedMotion?: boolean, colorScheme?: 'light' | 'dark', recordVideoDir?: string }} [opts]
 */
export async function newContext(browser, viewport, opts = {}) {
  const vp = typeof viewport === 'string' ? VIEWPORTS[viewport] : viewport;
  if (!vp) throw new UserError(`Unknown viewport "${String(viewport)}". Known: ${Object.keys(VIEWPORTS).join(', ')}`);
  return browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.deviceScaleFactor ?? 1,
    isMobile: vp.isMobile ?? false,
    hasTouch: vp.hasTouch ?? false,
    reducedMotion: opts.reducedMotion ? 'reduce' : 'no-preference',
    colorScheme: opts.colorScheme ?? 'light',
    ...(opts.recordVideoDir ? { recordVideo: { dir: opts.recordVideoDir } } : {}),
  });
}

/**
 * Navigate and wait for the page to become visually stable: load event, fonts,
 * and two animation frames. Never throws on timeout of the settle phase.
 * @param {import('playwright').Page} page
 * @param {string} url
 * @param {{ timeout?: number, settleMs?: number }} [opts]
 */
export async function gotoStable(page, url, opts = {}) {
  const response = await page.goto(url, { waitUntil: 'load', timeout: opts.timeout ?? 30000 });
  await page.evaluate(async () => {
    try { await document.fonts.ready; } catch { /* ignore */ }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
  }).catch(() => {});
  if (opts.settleMs) await page.waitForTimeout(opts.settleMs);
  return response;
}
