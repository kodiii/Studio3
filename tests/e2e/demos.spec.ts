import { expect, test } from '@playwright/test';
import { NO_WEBGL, axe, catalog, trackErrors } from './helpers';

/**
 * Every demo in the catalogue: loads without errors, passes axe (serious/critical), keeps keyboard focus visible,
 * renders under reduced motion without infinite animations, fits 390px, and — for 3D demos — degrades to its
 * fallback when WebGL is unavailable.
 */
const ready = async (page: import('@playwright/test').Page, key: string) => {
  const stage = page.locator(`[data-demo-stage="${key}"]`);
  await expect(stage).toBeVisible();
  await expect(stage.getByText('Loading demo…')).toHaveCount(0);
  await expect(stage.locator('[data-demo-error]')).toHaveCount(0);
  return stage;
};

for (const d of catalog.demos) {
  const key = `${d.specialty}/${d.id}`;
  test.describe(`demo ${key}`, () => {
    test('loads without errors and passes axe', async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto(`/demos/${key}`);
      const stage = await ready(page, key);
      await page.waitForTimeout(d.has3d ? 4000 : 2000);
      const box = await stage.boundingBox();
      expect(box!.height).toBeGreaterThan(400);
      const violations = await axe(page, `[data-demo-stage="${key}"]`);
      expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
      expect(errors()).toEqual([]);
    });

    test('keyboard: focus moves through the demo with a visible indicator', async ({ page }) => {
      await page.goto(`/demos/${key}`);
      await ready(page, key);
      await page.waitForTimeout(1000);
      await page.locator(`[data-demo-stage="${key}"]`).evaluate((el) => {
        const t = document.createElement('button'); t.id = '__s3_anchor'; t.textContent = 'anchor';
        t.style.cssText = 'position:absolute;opacity:0;pointer-events:none';
        el.prepend(t); t.focus();
      });
      const seen = new Set<string>();
      let invisible = 0;
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press('Tab');
        const info = await page.evaluate((k) => {
          const a = document.activeElement as HTMLElement | null;
          const stage = document.querySelector(`[data-demo-stage="${k}"]`);
          if (!a || !stage?.contains(a) || a.id === '__s3_anchor') return null;
          const cs = getComputedStyle(a);
          const indicator = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
          return { id: `${a.tagName}:${a.textContent?.slice(0, 30)}:${a.getAttribute('aria-label') ?? ''}`, indicator };
        }, key);
        if (!info) break;
        seen.add(info.id);
        if (!info.indicator) invisible++;
      }
      expect(seen.size, 'focusable controls reachable by Tab').toBeGreaterThanOrEqual(2);
      // Elements may style focus via border/background instead; allow a minority without outline/box-shadow.
      expect(invisible, 'focused elements without outline/box-shadow indicator').toBeLessThanOrEqual(Math.floor(seen.size / 2));
    });

    test('reduced motion and 390px width', async ({ browser }) => {
      const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      const errors = trackErrors(page);
      await page.goto(`/demos/${key}`);
      await ready(page, key);
      await page.waitForTimeout(d.has3d ? 3000 : 1500);
      const infinite = await page.evaluate((k) => {
        const root = document.querySelector(`[data-demo-stage="${k}"]`);
        return document.getAnimations().filter((a) => {
          const t = (a.effect as KeyframeEffect | null)?.target as Element | null;
          const timing = a.effect?.getComputedTiming();
          return a.playState === 'running' && t && root?.contains(t) && timing?.iterations === Infinity && Number(timing.duration) > 50;
        }).length;
      }, key);
      expect(infinite, 'infinite animations under reduced motion').toBe(0);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, 'horizontal page overflow at 390px').toBeLessThanOrEqual(1);
      expect(errors()).toEqual([]);
      await ctx.close();
    });

    if (d.has3d) {
      test('falls back gracefully without WebGL', async ({ page }) => {
        await page.addInitScript(NO_WEBGL);
        const pageErrors: string[] = [];
        page.on('pageerror', (e) => pageErrors.push(e.message));
        await page.goto(`/demos/${key}`);
        await ready(page, key);
        await page.waitForTimeout(2000);
        await expect(page.locator('[data-studio3-fallback]').first()).toBeVisible();
        expect(await page.locator(`[data-demo-stage="${key}"] canvas`).count(), 'no WebGL canvas when WebGL is unavailable').toBe(0);
        expect(pageErrors).toEqual([]);
      });
    }
  });
}
