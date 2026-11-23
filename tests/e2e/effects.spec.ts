import { expect, test } from '@playwright/test';
import { axe, catalog, isWebGL, trackErrors } from './helpers';

/**
 * Every recipe in the catalogue: mounts, renders without errors, survives remounting (cleanup),
 * renders in reduced motion, and has no serious/critical axe violations inside its stage — in the light
 * and in the dark gallery theme.
 */
for (const e of catalog.effects) {
  test.describe(`effect ${e.id}`, () => {
    test('mounts without errors, survives replay, passes axe', async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto(`/effects/${e.id}`);
      const stage = page.locator(`[data-effect-stage="${e.id}"]`);
      await expect(stage).toBeVisible();
      await expect(stage.locator('[data-effect-error]')).toHaveCount(0);
      // wait until the lazy chunk replaced the loading label
      await expect(stage.getByText('Loading preview…')).toHaveCount(0);
      if (isWebGL(e.technology)) {
        await expect(stage.locator('canvas, [data-studio3-fallback]').first()).toBeVisible();
      }
      await page.waitForTimeout(600);
      const box = await stage.boundingBox();
      expect(box!.height).toBeGreaterThan(100);
      // Replay remounts the recipe: exercises unmount cleanup.
      for (let i = 0; i < 3; i++) { await page.locator('[data-replay]').click(); await page.waitForTimeout(250); }
      await expect(stage.locator('[data-effect-error]')).toHaveCount(0);
      // Let entrance animations settle: axe must judge the resting state, not a mid-fade frame.
      await page.waitForTimeout(1800);
      const violations = await axe(page, `[data-effect-stage="${e.id}"]`);
      expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
      expect(errors()).toEqual([]);
    });

    test('passes axe in the dark theme', async ({ browser }) => {
      // Nothing stored in a fresh context, so the gallery theme follows prefers-color-scheme.
      const ctx = await browser.newContext({ colorScheme: 'dark' });
      const page = await ctx.newPage();
      const errors = trackErrors(page);
      await page.goto(`/effects/${e.id}`);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      const stage = page.locator(`[data-effect-stage="${e.id}"]`);
      await expect(stage).toBeVisible();
      await expect(stage.locator('[data-effect-error]')).toHaveCount(0);
      await expect(stage.getByText('Loading preview…')).toHaveCount(0);
      if (isWebGL(e.technology)) {
        await expect(stage.locator('canvas, [data-studio3-fallback]').first()).toBeVisible();
      }
      // Same settle as the light test: axe must judge the resting state, not a mid-fade frame.
      await page.waitForTimeout(600 + 1800);
      const violations = await axe(page, `[data-effect-stage="${e.id}"]`);
      expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
      expect(errors()).toEqual([]);
      await ctx.close();
    });

    test('renders under prefers-reduced-motion', async ({ browser }) => {
      const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } });
      const page = await ctx.newPage();
      const errors = trackErrors(page);
      await page.goto(`/effects/${e.id}`);
      const stage = page.locator(`[data-effect-stage="${e.id}"]`);
      await expect(stage).toBeVisible();
      await expect(stage.getByText('Loading preview…')).toHaveCount(0);
      await page.waitForTimeout(500);
      await expect(stage.locator('[data-effect-error]')).toHaveCount(0);
      // No infinite CSS/WAAPI animations may keep running inside the stage when motion is reduced.
      const infinite = await page.evaluate((id) => {
        const root = document.querySelector(`[data-effect-stage="${id}"]`);
        return document.getAnimations().filter((a) => {
          const t = (a.effect as KeyframeEffect | null)?.target as Element | null;
          const timing = a.effect?.getComputedTiming();
          return a.playState === 'running' && t && root?.contains(t) && timing && timing.iterations === Infinity && Number(timing.duration) > 50;
        }).length;
      }, e.id);
      expect(infinite, 'infinite animations running under reduced motion').toBe(0);
      expect(errors()).toEqual([]);
      await ctx.close();
    });

    test('fits a 390px container without horizontal overflow', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const errors = trackErrors(page);
      await page.goto(`/effects/${e.id}`);
      const stage = page.locator(`[data-effect-stage="${e.id}"]`);
      await expect(stage).toBeVisible();
      await expect(stage.getByText('Loading preview…')).toHaveCount(0);
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, 'page scrolls horizontally').toBeLessThanOrEqual(1);
      expect(errors()).toEqual([]);
    });
  });
}
