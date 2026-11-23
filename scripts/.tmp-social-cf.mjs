import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto('http://localhost:3333/demos/social/creator-feed');
await page.waitForSelector('[role=feed] article');
const art = page.locator('[role=feed] article').first();
const like = art.getByRole('button', { name: /^Like,/ });
const out = {};
await like.click();
out.likedNow = await like.getAttribute('aria-pressed');
out.likeName = await like.textContent();
await page.waitForTimeout(1300);
out.likeAfterServer = await like.getAttribute('aria-pressed');
// failure + rollback
await page.getByRole('switch', { name: /Simulate failed requests/ }).click();
const save = art.getByRole('button', { name: 'Save' });
await save.click();
out.saveOptimistic = await save.getAttribute('aria-pressed');
await page.waitForTimeout(1400);
out.saveRolledBack = await save.getAttribute('aria-pressed');
out.errorText = await art.locator('text=Couldn’t save').count();
out.status = await page.locator('[role=status]').last().textContent();
await page.getByRole('switch', { name: /Simulate failed requests/ }).click();
// comments
const cbtn = art.getByRole('button', { name: /^Comments,/ });
await cbtn.click();
const dlg = page.getByRole('dialog');
out.dialog = await dlg.count();
out.focusInDialog = await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'));
await dlg.getByLabel('Add a comment').fill('Lovely blue — what paper weight?');
await dlg.getByRole('button', { name: 'Post comment' }).click();
await page.waitForTimeout(150);
out.sending = await dlg.locator('text=Sending…').count();
await page.waitForTimeout(1200);
out.posted = await dlg.locator('text=· Posted').count();
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
out.dialogClosed = await page.getByRole('dialog').count();
out.focusReturned = await page.evaluate(() => document.activeElement?.tagName + ":" + document.activeElement?.textContent?.slice(0,40));
// share fallback
await art.getByRole('button', { name: 'Share' }).click();
await page.waitForTimeout(300);
out.shareDialog = await page.getByRole('dialog').getAttribute('aria-labelledby').then(() => page.getByRole('dialog').locator('h2').textContent()).catch(() => null);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
// tabs
await page.getByRole('tab', { name: 'Field notes' }).focus();
await page.keyboard.press('ArrowRight');
out.tab = await page.getByRole('tab', { selected: true }).textContent();
out.hash = await page.evaluate(() => location.hash);
await page.keyboard.press('ArrowLeft');
// dblclick media on note 10
const moon = page.locator('#note-10');
await moon.locator('figure').dblclick();
await page.waitForTimeout(200);
out.dblLiked = await moon.getByRole('button', { name: /^Like,/ }).getAttribute('aria-pressed');
// PageDown between articles
await art.focus();
await page.keyboard.press('PageDown');
out.pageDown = await page.evaluate(() => document.activeElement?.id);
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
await browser.close();
