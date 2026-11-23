import { chromium } from 'playwright';
const S = '/tmp/claude-0/-home-user/77865dc0-1700-59d0-bb68-e0d68f61d45b/scratchpad/rb';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
p.on('pageerror', (e) => errors.push('pageerror ' + e.message));
await p.goto('http://localhost:3333/effects/magnetic-button');
const stage = p.locator('[data-effect-stage="magnetic-button"]');
await stage.locator('button').first().waitFor();
await p.waitForTimeout(800);
// enable field param to see it
await p.locator('#param-field').check();
const btn = stage.locator('button').first();
const box = await btn.boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
// approach from the right edge, inside the field
await p.mouse.move(cx + box.width / 2 + 200, cy + 40);
await p.mouse.move(cx + box.width / 2 + 30, cy + 20, { steps: 8 });
await p.waitForTimeout(700);
const t1 = await btn.evaluate((el) => el.style.transform);
const l1 = await btn.locator('span > span').first().evaluate((el) => el.style.transform);
console.log('near-right transform', t1, 'label', l1);
await p.screenshot({ path: `${S}/mag-engaged.png`, clip: { x: box.x - 200, y: box.y - 200, width: 700, height: 420 } });
// pointer over the button
await p.mouse.move(cx + 40, cy - 10, { steps: 6 });
await p.waitForTimeout(600);
console.log('over transform', await btn.evaluate((el) => el.style.transform));
// leave the field entirely
await p.mouse.move(cx, cy + 400, { steps: 4 });
await p.waitForTimeout(150);
console.log('mid-release', await btn.evaluate((el) => el.style.transform));
await p.waitForTimeout(1500);
console.log('after release', JSON.stringify(await btn.evaluate((el) => el.style.transform)));
// count running rAF-driven changes: transform should stay stable/empty
// keyboard path
await p.mouse.move(5, 5);
await btn.focus();
await p.keyboard.press('Shift+Tab');
await p.keyboard.press('Tab');
const focused = await p.evaluate(() => document.activeElement?.textContent);
const outline = await btn.evaluate((el) => getComputedStyle(el).outlineStyle + ' ' + getComputedStyle(el).outlineWidth);
console.log('focused', focused, 'outline', outline, 'focus-visible', await btn.evaluate((el) => el.matches(':focus-visible')));
await p.keyboard.press('Enter');
await p.waitForTimeout(100);
console.log('status after Enter:', await stage.locator('[role=status]').textContent());
await p.keyboard.press('Tab');
console.log('focused2', await p.evaluate(() => document.activeElement?.getAttribute('aria-label')));
await p.keyboard.press('Space');
await p.waitForTimeout(300);
console.log('status after Space:', await stage.locator('[role=status]').textContent());
await p.screenshot({ path: `${S}/mag-focus.png`, clip: { x: box.x - 100, y: box.y - 120, width: 700, height: 340 } });
console.log('errors', errors);
await b.close();
