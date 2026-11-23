import { chromium } from 'playwright';
const S = '/tmp/claude-0/-home-user/77865dc0-1700-59d0-bb68-e0d68f61d45b/scratchpad/rb';
const dark = process.argv.includes('--dark');
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: dark ? 'dark' : 'light' });
const p = await ctx.newPage();
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
p.on('pageerror', (e) => errors.push('pageerror ' + e.message.slice(0, 200)));
await p.goto('http://localhost:3333/effects/morph-submit-button');
const stage = p.locator('[data-effect-stage="morph-submit-button"]');
const btn = stage.locator('button[type=submit]');
const input = stage.locator('input[type=email]');
const status = stage.locator('[role=status]');
await btn.waitFor();
await p.waitForTimeout(700);
const info = async (tag) => console.log(tag, JSON.stringify(await btn.evaluate((el) => ({ phase: el.dataset.phase, w: Math.round(el.getBoundingClientRect().width), busy: el.getAttribute('aria-busy'), dis: el.getAttribute('aria-disabled'), name: el.textContent.trim() }))), '|', (await status.textContent()).trim());
const shot = (n) => stage.screenshot({ path: `${S}/morph-${n}${dark ? '-dark' : ''}.png` });
await info('idle');
// keyboard: Enter in the input submits the form
await input.focus();
await p.keyboard.press('Enter');
await p.waitForTimeout(700);
await info('sending@700');
await shot('sending');
await p.waitForTimeout(1050);
await info('success@1750');
await shot('success');
await p.waitForTimeout(1500);
await info('done');
await shot('done');
console.log('focus on', await p.evaluate(() => document.activeElement?.tagName + ' ' + (document.activeElement?.textContent ?? '').trim()));
// resubmit while done: ignored (DOM click; Playwright's click() waits on aria-disabled)
const tc = Date.now();
await btn.evaluate((el) => el.click());
console.log('dom click took', Date.now() - tc);
await p.waitForTimeout(200);
await info('click-while-done');
// reset demo via keyboard
await stage.getByRole('button', { name: 'Reset demo' }).focus();
await p.keyboard.press('Enter');
await p.waitForTimeout(100);
await info('after reset');
// second submit -> error (alternate). Use Tab to reach the button, press Space.
await input.focus();
await p.keyboard.press('Tab');
console.log('tab focus ->', await p.evaluate(() => document.activeElement?.textContent?.trim()), 'focus-visible', await btn.evaluate((el) => el.matches(':focus-visible')));
await p.keyboard.press('Space');
await p.waitForTimeout(1750);
await info('failed@1750');
// sample the shake
const xs = [];
for (let i = 0; i < 8; i++) { xs.push(await btn.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41.toFixed(1))); await p.waitForTimeout(45); }
console.log('shake x samples', xs.join(' '));
await shot('failed');
await p.waitForTimeout(1600);
await info('retry');
await shot('retry');
// interruption: submit then reset mid-collapse, then resubmit immediately
await btn.click();
await p.waitForTimeout(150);
await info('mid-collapse');
await stage.getByRole('button', { name: 'Reset demo' }).click();
await p.waitForTimeout(50);
await info('reset mid-collapse');
await btn.click();
await p.waitForTimeout(80);
await info('resubmit');
await p.waitForTimeout(3600);
await info('end');
// validation path
await stage.getByRole('button', { name: 'Reset demo' }).click();
await input.fill('not-an-email');
await btn.click();
await p.waitForTimeout(100);
console.log('invalid:', await input.getAttribute('aria-invalid'), '|', (await status.textContent()).trim(), '| phase', await btn.getAttribute('data-phase'));
await shot('invalid');
console.log('errors', errors);
await b.close();
