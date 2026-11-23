import { chromium } from 'playwright';
const S = '/tmp/claude-0/-home-user/77865dc0-1700-59d0-bb68-e0d68f61d45b/scratchpad/rb';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
p.on('pageerror', (e) => errors.push('pageerror ' + e.message));
await p.goto('http://localhost:3333/effects/press-depth-button');
const stage = p.locator('[data-effect-stage="press-depth-button"]');
const keys = stage.locator('button');
await keys.first().waitFor();
await p.waitForTimeout(600);
const face = (i) => keys.nth(i).locator('span').nth(2);
const ty = (i) => face(i).evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42.toFixed(2));
console.log('rest Y', await ty(0), 'reprint locked Y', await ty(2), 'aria', await keys.nth(2).getAttribute('aria-disabled'), 'desc', await keys.nth(2).getAttribute('aria-describedby'));
// pointer press & hold
const bx = await keys.first().boundingBox();
await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
await p.mouse.down();
await p.waitForTimeout(200);
console.log('held Y', await ty(0), 'pressed attr', await keys.first().getAttribute('data-pressed'));
await stage.screenshot({ path: `${S}/press-held.png` });
// drag off and release outside: no activation
await p.mouse.move(bx.x + bx.width / 2, bx.y - 120);
await p.mouse.up();
await p.waitForTimeout(60);
console.log('after drag-off release, status:', await stage.locator('[role=status]').textContent(), 'Y', await ty(0));
await p.waitForTimeout(900);
console.log('settled Y', await ty(0));
// real click -> busy
await keys.first().click();
await p.waitForTimeout(400);
console.log('busy: status', await stage.locator('[role=status]').textContent(), 'aria-disabled', await keys.first().getAttribute('aria-disabled'), 'Y', await ty(0));
await stage.screenshot({ path: `${S}/press-busy.png` });
// clicking while busy does nothing
await keys.first().click();
await p.waitForTimeout(1800);
console.log('done: status', await stage.locator('[role=status]').textContent(), '| count', await stage.locator('p').nth(1).textContent(), '| reprint locked?', await keys.nth(2).getAttribute('data-locked'));
await p.waitForTimeout(600);
// keyboard: focus Reprint, Space down -> pressed, up -> busy
await keys.nth(2).focus();
await p.keyboard.down('Space');
await p.waitForTimeout(150);
console.log('space held: pressed', await keys.nth(2).getAttribute('data-pressed'), 'Y', await ty(2));
await p.keyboard.up('Space');
await p.waitForTimeout(100);
console.log('space up: status', await stage.locator('[role=status]').textContent());
await p.waitForTimeout(2000);
// Enter with auto-repeat on Preview: one activation only
await keys.nth(1).focus();
await p.keyboard.down('Enter');
await p.keyboard.down('Enter'); // repeat
await p.keyboard.down('Enter');
await p.keyboard.up('Enter');
console.log('enter: status', await stage.locator('[role=status]').textContent(), 'focus-visible', await keys.nth(1).evaluate((el) => el.matches(':focus-visible')));
await stage.screenshot({ path: `${S}/press-after.png` });
console.log('errors', errors);
await b.close();
