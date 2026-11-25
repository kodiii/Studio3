// @ts-check
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadCatalog } from '../../../plugins/maquettekit/tools/catalog/index.mjs';
import { exportWebComponents } from '../../../plugins/maquettekit/tools/catalog/export.mjs';
import { launchBrowser } from '../../../plugins/maquettekit/tools/lib/browser.mjs';
import { serveStatic } from '../../../plugins/maquettekit/tools/lib/static-server.mjs';
import { resolveDep } from '../../../plugins/maquettekit/tools/lib/resolve.mjs';

const cat = loadCatalog();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'maquettekit-export-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
const canBuild = !!resolveDep('vite') && !!resolveDep('react');
const browserProbe = await (async () => {
  try { const b = await launchBrowser(); await b.close(); return true; } catch { return false; }
})();
const bit = canBuild && browserProbe ? it : (name, ..._rest) => it.skip(`${name} [SKIPPED: needs vite, react and Chromium]`, () => {});

describe('catalog export --format web-component', () => {
  bit('builds working custom elements: render, behaviour, attributes, no console errors', async () => {
    const out = path.join(tmp, 'elements');
    const r = await exportWebComponents(cat, ['magnetic-button', 'accordion-height-auto'], { out });
    expect(r.elements.map((e) => e.element)).toEqual(['mk-magnetic-button', 'mk-accordion-height-auto']);
    for (const e of r.elements) {
      for (const f of [e.js, e.css, e.demo]) expect(fs.existsSync(/** @type {string} */ (f)), f).toBe(true);
      expect(e.jsKb).toBeLessThan(600);
    }
    expect(r.elements[1].attributes.map((a) => a.name)).toContain('default-open');
    const server = await serveStatic(out);
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto(`${server.url}/mk-magnetic-button.html`);
      await page.waitForFunction(() => (document.querySelector('mk-magnetic-button')?.children.length ?? 0) > 0);
      expect(await page.locator('mk-magnetic-button button, mk-magnetic-button a').count()).toBeGreaterThan(0);
      await page.goto(`${server.url}/mk-accordion-height-auto.html`);
      const triggers = page.locator('mk-accordion-height-auto [aria-expanded]');
      await triggers.first().waitFor();
      const before = await triggers.first().getAttribute('aria-expanded');
      await triggers.first().click();
      await expect.poll(() => triggers.first().getAttribute('aria-expanded')).not.toBe(before);
      // attributes are params: switching the icon re-renders without errors
      await page.evaluate(() => document.querySelector('mk-accordion-height-auto')?.setAttribute('icon', 'plus'));
      await page.waitForTimeout(200);
      expect(await triggers.count()).toBeGreaterThan(0);
      expect(errors).toEqual([]);
    } finally { await browser.close(); await server.close(); }
  }, 180_000);

  it('refuses demos and unknown ids with guidance', async () => {
    await expect(exportWebComponents(cat, ['saas-landing'])).rejects.toThrow(/is a demo.*catalog install/);
    await expect(exportWebComponents(cat, ['no-such-effect'])).rejects.toThrow(/No effect with id/);
    await expect(exportWebComponents(cat, [])).rejects.toThrow(/at least one/);
  });
});
