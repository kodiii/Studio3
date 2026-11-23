import { chromium } from 'playwright';
const only = process.argv[2];
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const run = async (id, fn) => {
  if (only && only !== id) return;
  const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await p.goto('http://localhost:3333/effects/' + id);
  const stage = p.locator(`[data-effect-stage="${id}"]`);
  await stage.locator('canvas').first().waitFor({ timeout: 30000 });
  await p.waitForTimeout(2500);
  const out = {};
  try { await fn(p, stage, out); } catch (e) { out.failure = String(e).slice(0, 300); }
  out.errors = errors;
  console.log(id, JSON.stringify(out));
  await p.close();
};
const tabTo = async (p, pred, max = 12) => {
  await p.locator('[data-replay]').focus();
  for (let i = 0; i < max; i++) { await p.keyboard.press('Tab'); if (await p.evaluate(pred)) return true; }
  return false;
};
const frames = (p) => p.evaluate(() => window.__STUDIO3_3D__?.frames ?? null);

await run('orbit-inspect-controls', async (p, s, o) => {
  const read = () => s.locator('p[aria-hidden="true"]').last().textContent();
  o.focused = await tabTo(p, () => document.activeElement?.getAttribute('aria-roledescription') === '3D viewer');
  const r0 = await read();
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(900);
  o.arrow = [r0, await read()];
  await p.keyboard.press('+'); await p.waitForTimeout(500);
  o.plus = await read();
  const vb = await s.locator('[role="application"]').boundingBox();
  await p.mouse.move(vb.x + vb.width / 2, vb.y + vb.height / 2);
  const y0 = await p.evaluate(() => scrollY);
  await p.mouse.wheel(0, -300); await p.waitForTimeout(500);
  o.wheelFocused = { zoom: await read(), scrolled: (await p.evaluate(() => scrollY)) - y0 };
  await p.keyboard.press('0'); await p.waitForTimeout(500);
  o.reset = await read();
  await s.getByRole('button', { name: 'Reset view' }).focus();
  const y1 = await p.evaluate(() => scrollY);
  await p.mouse.move(vb.x + vb.width / 2, vb.y + vb.height / 2 - 40);
  await p.mouse.wheel(0, 200); await p.waitForTimeout(500);
  o.wheelUnfocused = { zoom: await read(), scrolled: (await p.evaluate(() => scrollY)) - y1 };
  await p.evaluate(() => scrollTo(0, 0));
  await s.getByRole('button', { name: /Rotate right/ }).click(); await p.waitForTimeout(900);
  o.button = await read();
  o.live = await s.locator('[aria-live="polite"]').textContent();
  const f0 = await frames(p); await p.waitForTimeout(1500); o.framesAtRest = (await frames(p)) - f0;
});

await run('hotspot-annotations', async (p, s, o) => {
  o.backInert = await s.locator('[data-occluded]').evaluateAll((els) => els.map((e) => `${e.dataset.occluded}/${e.inert}`));
  o.focused = await tabTo(p, () => document.activeElement?.closest('ol') !== null && document.activeElement?.tagName === 'BUTTON', 16);
  await p.waitForTimeout(1500);
  o.afterFocus = { expanded: await s.locator('ol button[aria-expanded="true"]').count(), live: await s.locator('[aria-live="polite"]').textContent() };
  await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
  await p.waitForTimeout(1800);
  o.battery = { label: await p.evaluate(() => document.activeElement?.textContent), occluded: await s.locator('[data-occluded]').evaluateAll((els) => els.map((e) => e.dataset.occluded)) };
  await p.keyboard.press('Escape'); await p.waitForTimeout(1500);
  o.afterEsc = { expanded: await s.locator('ol button[aria-expanded="true"]').count(), occluded: await s.locator('[data-occluded]').evaluateAll((els) => els.map((e) => e.dataset.occluded)) };
  const f0 = await frames(p); await p.waitForTimeout(1500); o.framesAtRest = (await frames(p)) - f0;
});

await run('exploded-view', async (p, s, o) => {
  const slider = s.locator('input[type="range"]');
  await slider.focus(); await p.keyboard.press('End'); await p.waitForTimeout(800);
  o.end = await s.locator('output').textContent();
  await p.keyboard.press('Home'); await p.waitForTimeout(300);
  o.home = await s.locator('output').textContent();
  await p.keyboard.press('PageUp'); await p.waitForTimeout(600);
  o.pageUp = await s.locator('output').textContent();
  await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
  o.rowFocus = { focused: await p.evaluate(() => document.activeElement?.textContent), hot: await s.locator('[data-hot]').count(), tag: await s.locator('p[aria-hidden="true"]').first().textContent() };
  await p.keyboard.press('Enter');
  o.pinned = await s.locator('[aria-pressed="true"]').count();
  await p.keyboard.press('Tab');
  const vb = await s.locator('canvas').boundingBox();
  let hit = null;
  for (const [fx, fy] of [[0.5, 0.5], [0.45, 0.55], [0.55, 0.45], [0.6, 0.5], [0.4, 0.5]]) {
    await p.mouse.move(vb.x + vb.width * fx, vb.y + vb.height * fy); await p.waitForTimeout(250);
    hit = await s.locator('button[data-hot] span span').first().textContent().catch(() => null);
    if (hit) break;
  }
  o.pointerOverPartHighlightsRow = hit;
  await p.mouse.move(5, 5); await p.waitForTimeout(800);
  const f0 = await frames(p); await p.waitForTimeout(1500); o.framesAtRest = (await frames(p)) - f0;
});

await run('image-ripple-distortion', async (p, s, o) => {
  o.focused = await tabTo(p, () => document.activeElement?.textContent?.includes('Next poster'));
  const f0 = await frames(p);
  await p.keyboard.press('Enter'); await p.waitForTimeout(600);
  o.midFrames = (await frames(p)) - f0;
  o.caption = await s.locator('[aria-live="polite"]').innerText();
  await p.waitForTimeout(1500);
  const f1 = await frames(p); await p.waitForTimeout(1500); o.framesAtRest = (await frames(p)) - f1;
  await p.screenshot({ path: '/tmp/claude-0/-home-user/77865dc0-1700-59d0-bb68-e0d68f61d45b/scratchpad/spatial/ripple-mid.png', clip: await s.boundingBox() }).catch(() => {});
});

await run('particle-field-gpu', async (p, s, o) => {
  o.loop = await p.evaluate(() => window.__STUDIO3_3D__?.frameloop);
  o.focused = await tabTo(p, () => document.activeElement?.getAttribute('role') === 'application');
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('Shift+ArrowUp'); await p.keyboard.press('Escape');
  const btn = s.getByRole('button', { name: /Pause|Play/ });
  await btn.click(); await p.waitForTimeout(800);
  o.paused = { pressed: await btn.getAttribute('aria-pressed'), loop: await p.evaluate(() => window.__STUDIO3_3D__?.frameloop) };
  const f0 = await frames(p); await p.waitForTimeout(1500); o.framesAtRestPaused = (await frames(p)) - f0;
  o.count = await s.locator('p').last().textContent();
});
await b.close();
