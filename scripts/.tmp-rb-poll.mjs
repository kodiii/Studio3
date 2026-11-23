import { chromium } from 'playwright';
const S = '/tmp/claude-0/-home-user/77865dc0-1700-59d0-bb68-e0d68f61d45b/scratchpad/rb';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1000, height: 900 } })).newPage();
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
p.on('pageerror', (e) => errors.push('pageerror ' + e.message.slice(0, 160)));
for (let k = 0; k < 2; k++) { const r = await p.goto('http://localhost:3333/effects/poll-result-bars'); if (r.status() === 200) break; await p.waitForTimeout(1500); }
const stage = p.locator('[data-effect-stage="poll-result-bars"]');
const radios = stage.locator('input[type=radio]');
await radios.first().waitFor();
await p.waitForTimeout(400);
// Enter with nothing chosen -> hint
await stage.getByRole('button', { name: 'Vote' }).focus();
await p.keyboard.press('Enter');
console.log('empty submit hint:', await stage.locator('[role=status]').first().textContent());
// keyboard: focus first radio (Space selects), ArrowDown moves choice, Enter submits
await radios.first().focus();
await p.keyboard.press('Space');
await p.keyboard.press('ArrowDown');
console.log('checked index', await radios.evaluateAll((els) => els.findIndex((e) => e.checked)));
await p.keyboard.press('Enter');
await p.waitForTimeout(330);
const counts = await stage.locator('li > span:last-child').allTextContents();
console.log('mid counts', counts.join(' '));
await stage.screenshot({ path: `${S}/poll-mid.png` });
await p.waitForTimeout(1500);
console.log('final', (await stage.locator('li').allInnerTexts()).map((t) => t.replace(/\n/g, ' ')).join(' | '));
console.log('focus', await p.evaluate(() => document.activeElement?.textContent));
console.log('live', await stage.locator('[role=status]').last().textContent());
await p.keyboard.press('Enter'); // Change vote
await p.waitForTimeout(100);
console.log('after change: focus checked?', await p.evaluate(() => (document.activeElement)?.checked), 'value', await p.evaluate(() => document.activeElement?.value));
await p.keyboard.press('ArrowDown');
await stage.getByRole('button', { name: 'Vote' }).focus();
await p.keyboard.press('Space');
await p.waitForTimeout(1600);
console.log('revote', (await stage.locator('li').allInnerTexts()).map((t) => t.replace(/\n/g, ' ')).join(' | '));
await stage.screenshot({ path: `${S}/poll-final.png` });
console.log('errors', errors);
await b.close();
