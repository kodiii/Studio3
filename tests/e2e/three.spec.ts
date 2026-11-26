import { expect, test, type Page } from '@playwright/test';
import { NO_WEBGL, diagnostics, trackErrors } from './helpers';

/**
 * The /3d gallery page: WebGL initialisation, manifest-driven model variants, the missing-asset fallback, camera and
 * material interaction, GPU resource disposal across navigations, and the no-WebGL fallback.
 * Runs on software WebGL (SwiftShader): the auto quality profile resolves to "low" there.
 */
const STAGE = '[data-viewer-stage]';
const HOST = `${STAGE} [data-maquettekit-canvas]`;

interface Diag { frames: number; disposed: number; frameloop: string; renderer: { triangles: number; calls: number } }
const diag = async (page: Page) => (await diagnostics(page)) as unknown as Diag | null;
const radio = (page: Page, name: string) => page.getByRole('radio', { name, exact: true });

async function modelReady(page: Page) {
  await expect(page.locator(`${STAGE} canvas`)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-stat="triangles"]')).not.toHaveText('—', { timeout: 60_000 });
}
/**
 * The stage names the preset the camera rests at once CameraRig reports arrival. Wait for this rather than for the
 * camera attribute to stop changing: on software WebGL a single frame can take longer than a polling interval, so a
 * quiet interval is not proof that a move finished (in CI that read y ≈ 3.95 on the way to the top preset's 5.6).
 */
const cameraAt = (page: Page, preset: string) => page.locator(`${STAGE}[data-camera-at="${preset}"]`);
/** Fraction of pixels whose RGB differs by more than 24 between two PNG screenshots (decoded in the page). */
function pixelDiff(page: Page, a: Buffer, b: Buffer): Promise<number> {
  return page.evaluate(async ([pa, pb]) => {
    const load = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const [ia, ib] = await Promise.all([load(`data:image/png;base64,${pa}`), load(`data:image/png;base64,${pb}`)]);
    const read = (img: HTMLImageElement) => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d')!;
      g.drawImage(img, 0, 0);
      return g.getImageData(0, 0, c.width, c.height).data;
    };
    const da = read(ia), db = read(ib);
    if (da.length !== db.length) return 1;
    let changed = 0;
    for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 24) changed++;
    return changed / (da.length / 4);
  }, [a.toString('base64'), b.toString('base64')] as const);
}

test.describe('3D gallery (/3d)', () => {
  test('initialises the canvas: frames rendered and triangles counted by renderer.info', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/3d');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await modelReady(page);
    await expect.poll(async () => (await diag(page))?.renderer.triangles ?? 0, { timeout: 20_000 }).toBeGreaterThan(0);
    const d = await diag(page);
    expect(d?.frames).toBeGreaterThan(0);
    expect(d?.frameloop, 'the viewer renders on demand').toBe('demand');
    expect(errors()).toEqual([]);
  });

  test('loads the manifest variant for each quality level; stats match the manifest', async ({ page }) => {
    const manifest = (await (await page.request.get('/models/pulse-speaker.manifest.json')).json()).assets[0] as { variants: { profile: string; triangles: number; bytes: number }[] };
    await page.goto('/3d');
    await modelReady(page);
    for (const [label, profile] of [['Low', 'low-power'], ['Medium', 'mobile'], ['High', 'desktop']] as const) {
      await radio(page, label).check({ force: true });
      const v = manifest.variants.find((x) => x.profile === profile)!;
      await expect(page.locator(`${STAGE} [data-variant="${profile}"]`)).toBeVisible({ timeout: 30_000 });
      // counted from the loaded geometry, so it only matches once that variant is decoded
      await expect(page.locator('[data-stat="triangles"]')).toHaveText(v.triangles.toLocaleString('en-US'), { timeout: 60_000 });
      await expect(page.locator(`${STAGE} [data-variant="${profile}"]`)).toContainText(`${(v.bytes / 1e6).toFixed(2)} MB`);
    }
  });

  test('missing model file: the error fallback replaces the scene without uncaught errors', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.route('**/*.glb', (route) => route.abort());
    await page.goto('/3d');
    const fallback = page.locator(`${STAGE} [data-scene-fallback]`);
    await expect(fallback).toBeVisible({ timeout: 30_000 });
    await expect(fallback.getByRole('alert')).toContainText(/could not be (downloaded|found)/);
    await expect(fallback.locator('img')).toHaveAttribute('src', /pulse-speaker\.webp$/);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('camera presets and keyboard orbit move the camera; a colourway change repaints the model', async ({ page }) => {
    await page.goto('/3d');
    await modelReady(page);
    await expect(cameraAt(page, 'hero')).toBeAttached();
    await radio(page, 'Top').check({ force: true });
    await expect(cameraAt(page, 'hero')).not.toBeAttached();
    await expect(cameraAt(page, 'top')).toBeAttached({ timeout: 30_000 });
    const top = await page.locator(HOST).getAttribute('data-camera');
    const [, y] = (top ?? '0,0,0').split(',').map(Number);
    expect(y, 'the top preset looks down from above').toBeGreaterThan(4);

    // The camera has arrived and no clip plays (no autoPlay), so only the colourway can change these pixels.
    const canvas = page.locator(`${STAGE} canvas`);
    const before = await canvas.screenshot();
    await radio(page, 'Bone / Cobalt').check({ force: true });
    await expect.poll(async () => pixelDiff(page, before, await canvas.screenshot()), { timeout: 20_000, message: 'share of canvas pixels changed by the colourway' }).toBeGreaterThan(0.02);

    await canvas.focus();
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => page.locator(HOST).getAttribute('data-camera'), { timeout: 10_000 }).not.toBe(top);
    await expect(cameraAt(page, 'top'), 'orbiting leaves the preset').not.toBeAttached();
  });

  test('disposes GPU resources when leaving the page (3 round trips, no context warnings)', async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', (m) => { if (/too many active webgl contexts/i.test(m.text())) warnings.push(m.text()); });
    await page.goto('/3d');
    await modelReady(page);
    const first = (await diag(page))!.disposed;
    for (let i = 0; i < 3; i++) {
      await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'System' }).click();
      await page.waitForURL('**/system');
      await expect(page.locator(`${STAGE} canvas`)).toHaveCount(0);
      // Remember the diagnostics object of the canvas being left: after navigating back, wait for the NEW canvas to
      // register its own object and render, otherwise the stale object (frames > 0) would satisfy the wait and the
      // next navigation could leave before the new renderer even mounted.
      await page.evaluate(() => { (window as unknown as { __s3PrevDiag?: unknown }).__s3PrevDiag = (window as unknown as { __MAQUETTEKIT_3D__?: unknown }).__MAQUETTEKIT_3D__; });
      await page.goBack();
      await page.waitForURL('**/3d');
      await expect(page.locator(`${STAGE} canvas`)).toBeVisible({ timeout: 30_000 });
      await expect.poll(() => page.evaluate(() => {
        const w = window as unknown as { __MAQUETTEKIT_3D__?: { frames: number }; __s3PrevDiag?: unknown };
        return !!w.__MAQUETTEKIT_3D__ && w.__MAQUETTEKIT_3D__ !== w.__s3PrevDiag && w.__MAQUETTEKIT_3D__.frames > 0;
      }), { timeout: 30_000 }).toBe(true);
    }
    const d = await diag(page);
    expect(d!.disposed, '__MAQUETTEKIT_3D__.disposed counts each canvas teardown').toBeGreaterThanOrEqual(first + 3);
    expect(warnings).toEqual([]);
  });

  test('without WebGL: static preview with facts, and no canvas', async ({ page }) => {
    await page.addInitScript(NO_WEBGL);
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.goto('/3d');
    const fallback = page.locator(`${STAGE} [data-maquettekit-fallback]`);
    await expect(fallback).toBeVisible({ timeout: 20_000 });
    await expect(fallback.locator('img')).toHaveAttribute('src', /pulse-speaker\.webp$/);
    await expect(fallback.locator('dl')).toContainText('Colourway');
    expect(await page.locator(`${STAGE} canvas`).count()).toBe(0);
    expect(pageErrors).toEqual([]);
  });

  test('"Interactive 3D" off shows the same static preview', async ({ page }) => {
    await page.goto('/3d');
    await modelReady(page);
    await page.getByRole('checkbox', { name: 'Interactive 3D' }).uncheck();
    await expect(page.locator(`${STAGE} [data-maquettekit-fallback]`)).toBeVisible();
    await expect(page.locator(`${STAGE} canvas`)).toHaveCount(0);
  });

  test('fullscreen toggle (feature-detected)', async ({ page }) => {
    await page.goto('/3d');
    await modelReady(page);
    const supported = await page.evaluate(() => document.fullscreenEnabled);
    test.skip(!supported, 'The Fullscreen API is not enabled in this browser; the viewer hides the button, which is the tested behaviour elsewhere.');
    await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
    const entered = await page.waitForFunction(() => !!document.fullscreenElement, null, { timeout: 5_000 }).then(() => true, () => false);
    test.skip(!entered, 'Headless Chromium refused requestFullscreen (no real display / window manager), so entering fullscreen cannot be verified here.');
    await expect(page.getByRole('button', { name: 'Exit fullscreen' })).toBeVisible();
    expect(await page.evaluate(() => document.fullscreenElement?.hasAttribute('data-viewer-stage'))).toBe(true);
    await page.getByRole('button', { name: 'Exit fullscreen' }).click();
    await page.waitForFunction(() => !document.fullscreenElement);
    await expect(page.getByRole('button', { name: 'Fullscreen', exact: true })).toBeVisible();
    test.info().annotations.push({ type: 'not verified headless', description: 'Esc leaves fullscreen through the browser itself; synthetic key events from Playwright cannot trigger that exit, so only the button path is asserted.' });
  });
});
