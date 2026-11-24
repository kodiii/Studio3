import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Page } from '@playwright/test';

export interface CatalogEffect { id: string; name: string; technology: string[]; category: string; interaction: string[]; preview?: { scroll?: boolean } }
export interface CatalogDemo { id: string; specialty: string; name: string; has3d: boolean }
export const catalog = JSON.parse(readFileSync(path.resolve('plugins/maquettekit/library/catalog.json'), 'utf8')) as { effects: CatalogEffect[]; demos: CatalogDemo[] };
export const isWebGL = (t: string[]) => t.some((x) => ['three', 'r3f', 'glsl', 'drei', 'rapier'].includes(x));

/** Messages that are environment noise, not application errors. */
const IGNORE = [
  /\[HMR\]|\[Fast Refresh\]|webpack-hmr|_next\/webpack-hmr|turbopack-hmr|WebSocket connection to/i,
  /GPU stall due to ReadPixels/i, // SwiftShader performance warning
  /Automatic fallback to software WebGL has been deprecated/i,
  /Download the React DevTools/i,
];

/** Collect console errors, uncaught exceptions and failed same-origin requests. */
export function trackErrors(page: Page): () => string[] {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.some((r) => r.test(m.text()))) errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => {
    const url = r.url();
    if (url.startsWith('data:') || /_next\/webpack-hmr|__nextjs/.test(url) || r.failure()?.errorText === 'net::ERR_ABORTED') return;
    errors.push(`requestfailed: ${url} ${r.failure()?.errorText ?? ''}`);
  });
  page.on('response', (res) => { if (res.status() >= 400 && new URL(res.url()).origin === new URL(page.url() || res.url()).origin) errors.push(`http ${res.status()}: ${res.url()}`); });
  return () => errors.slice();
}

const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

/** Run axe-core (WCAG 2.x A/AA rules) on a selector. Returns serious/critical violations. */
export async function axe(page: Page, include = 'body') {
  await page.addScriptTag({ content: axeSource });
  const res = await page.evaluate(async (sel) => {
    // @ts-expect-error injected global
    const r = await window.axe.run(sel, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] });
    return r.violations.map((v: { id: string; impact: string; help: string; nodes: { target: string[] }[] }) => ({ id: v.id, impact: v.impact, help: v.help, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
  }, include);
  return (res as { id: string; impact: string; help: string; targets: string[] }[]).filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

/** Read the StudioCanvas diagnostics hook. */
export const diagnostics = (page: Page) => page.evaluate(() => (window as unknown as { __MAQUETTEKIT_3D__?: Record<string, unknown> }).__MAQUETTEKIT_3D__ ?? null);

/** Init script that makes every WebGL/WebGPU context request fail (simulates an unsupported device). */
export const NO_WEBGL = () => {
  const orig = HTMLCanvasElement.prototype.getContext;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: any[]) {
    if (/webgl|webgpu/i.test(type)) return null;
    return orig.call(this, type as '2d', ...rest);
  } as typeof orig;
  try { Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true }); } catch { /* ignore */ }
};
