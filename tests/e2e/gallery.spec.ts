import { expect, test } from '@playwright/test';
import { axe, catalog, trackErrors } from './helpers';

/** Gallery application behaviour: navigation, catalogue search/filters, playground controls, code viewer, settings. */

test.describe('gallery shell', () => {
  for (const route of ['/', '/effects', '/studios', '/studios/product', '/studios/3d', '/system']) {
    test(`${route} renders without errors and passes axe`, async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      await page.waitForTimeout(1200);
      const v = await axe(page, 'body');
      expect(v, JSON.stringify(v, null, 2)).toEqual([]);
      expect(errors()).toEqual([]);
    });
  }

  test('skip link is the first focusable element and moves focus to main', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  });

  test('theme and reduced-motion toggles apply and persist', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    const dark = page.getByRole('banner').getByRole('button', { name: 'Dark', exact: true });
    const was = await html.getAttribute('data-theme');
    await dark.click();
    await expect(html).toHaveAttribute('data-theme', was === 'dark' ? 'light' : 'dark');
    await page.getByRole('banner').getByRole('button', { name: 'Reduce motion', exact: true }).click();
    await expect(html).toHaveAttribute('data-reduced', 'true');
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', was === 'dark' ? 'light' : 'dark');
    await expect(html).toHaveAttribute('data-reduced', 'true');
  });

  test('mobile menu opens, closes with Escape, and navigates', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const toggle = page.locator('button[aria-controls="site-menu"]');
    await expect(toggle).toHaveText('Menu');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle).toHaveText('Close');
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await page.getByRole('navigation', { name: 'Mobile' }).getByRole('link', { name: 'Effects' }).click();
    await expect(page).toHaveURL(/\/effects$/);
  });
});

test.describe('effect catalogue', () => {
  test('lists every recipe and filters by search and facets', async ({ page }) => {
    await page.goto('/effects');
    const count = page.locator('[data-result-count]');
    await expect(count).toHaveAttribute('data-result-count', String(catalog.effects.length));
    await expect(page.locator('[data-effect-card]')).toHaveCount(catalog.effects.length);

    await page.locator('[data-effect-search]').fill('chart');
    const searchHits = Number(await count.getAttribute('data-result-count'));
    expect(searchHits).toBeGreaterThan(0);
    expect(searchHits).toBeLessThan(catalog.effects.length);
    await page.locator('[data-effect-search]').fill('');

    const cat = catalog.effects[0].category;
    const expected = catalog.effects.filter((e) => e.category === cat).length;
    await page.getByRole('group', { name: 'Category' }).getByRole('button', { name: cat, exact: true }).click();
    await expect(count).toHaveAttribute('data-result-count', String(expected));
    await page.getByRole('button', { name: 'Clear all' }).click();
    await expect(count).toHaveAttribute('data-result-count', String(catalog.effects.length));

    await page.locator('[data-effect-search]').fill('zzzz-no-such-recipe');
    await expect(page.getByText('No recipe matches.')).toBeVisible();
  });

  test('a card opens its playground', async ({ page }) => {
    const first = catalog.effects[0];
    await page.goto('/effects');
    await page.locator(`[data-effect-card="${first.id}"]`).getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`/effects/${first.id}$`));
    await expect(page.locator('h1')).toHaveText(first.name);
  });
});

test.describe('effect playground', () => {
  test('parameters drive the live preview', async ({ page }) => {
    await page.goto('/effects/split-line-reveal');
    const heading = page.locator('[data-effect-stage="split-line-reveal"] h2');
    await expect(heading).toHaveAttribute('aria-label', 'Motion that means something');
    await page.getByLabel('Text', { exact: true }).fill('Parameters are live');
    await expect(heading).toHaveAttribute('aria-label', 'Parameters are live');
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(heading).toHaveAttribute('aria-label', 'Motion that means something');
  });

  test('device width preview and reduced motion toggle', async ({ page }) => {
    await page.goto('/effects/split-line-reveal');
    await page.getByRole('radio', { name: 'Mobile 390' }).check({ force: true });
    await expect(page.locator('[data-preview-frame]')).toHaveAttribute('data-preview-frame', 'mobile');
    const stage = page.locator('[data-effect-stage="split-line-reveal"]');
    await expect.poll(async () => Math.round((await stage.boundingBox())!.width)).toBeLessThanOrEqual(390);
    await page.getByRole('button', { name: 'Reduced motion', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-reduced', 'true');
  });

  test('code viewer shows source files and copies code', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-specific here');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/effects/split-line-reveal');
    const viewer = page.locator('[data-code-viewer]');
    await expect(viewer.getByRole('tab', { name: 'index.tsx' })).toHaveAttribute('aria-selected', 'true');
    await expect(viewer.getByRole('tabpanel')).toContainText('export default function');
    await viewer.getByRole('tab', { name: 'meta.ts' }).click();
    await expect(viewer.getByRole('tabpanel')).toContainText("id: 'split-line-reveal'");
    await viewer.locator('[data-copy-code]').click();
    await expect(viewer.locator('[data-copy-code]')).toContainText('Copied');
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain("id: 'split-line-reveal'");
  });
});

test.describe('shader recipes animate', () => {
  // Regression: R3F 9 copies <shaderMaterial uniforms> on apply, so time must be written via the material instance.
  test('shader-aurora-plane advances its time uniform (rendered pixels change)', async ({ page }) => {
    await page.goto('/effects/shader-aurora-plane');
    const canvas = page.locator('[data-effect-stage="shader-aurora-plane"] canvas');
    await expect(canvas).toBeVisible();
    await page.waitForTimeout(1500);
    const a = await canvas.screenshot();
    await page.waitForTimeout(1500);
    const b = await canvas.screenshot();
    expect(a.equals(b), 'two frames 1.5 s apart are identical — the shader is frozen').toBe(false);
  });
});

test.describe('visual regression', () => {
  test.use({ reducedMotion: 'reduce', colorScheme: 'light' });
  test('system page', async ({ page }) => {
    await page.goto('/system');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('system.png', { fullPage: true });
  });
  test('studios index', async ({ page }) => {
    await page.goto('/studios');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('studios.png', { fullPage: true });
  });
  test('split-line-reveal end state', async ({ page }) => {
    await page.goto('/effects/split-line-reveal');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800);
    await expect(page.locator('[data-effect-stage="split-line-reveal"]')).toHaveScreenshot('split-line-reveal.png');
  });
});
