import { chromium } from 'playwright';
const S = '/tmp/claude-0/-home-user/77865dc0-1700-59d0-bb68-e0d68f61d45b/scratchpad/rb';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1000, height: 1000 } })).newPage();
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
p.on('pageerror', (e) => errors.push('pageerror ' + e.message.slice(0, 160)));
for (let k = 0; k < 3; k++) { const r = await p.goto('http://localhost:3333/effects/story-progress-segments'); if (r.status() === 200) break; await p.waitForTimeout(1500); }
const stage = p.locator('[data-effect-stage="story-progress-segments"]');
const frame = stage.locator('section[aria-label^="Story"]');
await frame.waitFor();
const status = async () => (await stage.locator('p').filter({ hasText: /Slide \d/ }).innerText()).replace(/\n/g, ' ');
const segP = () => stage.evaluate((s) => { const a = s.querySelector('[data-state="current"] span')?.getAnimations()[0]; return a ? `${a.playState}@${Math.round(a.currentTime)}` : 'none'; });
await p.waitForTimeout(300);
await frame.screenshot({ path: `${S}/story-1.png` });
// shorten slide duration to 2000ms via the param slider
await p.locator('#param-duration').evaluate((e) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(e, '2000'); e.dispatchEvent(new Event('input', { bubbles: true })); });
await p.waitForTimeout(2300);
console.log('auto-advanced ->', await status());
// keyboard: focus region, Space pauses (progress frozen), Space resumes
await frame.focus();
await p.keyboard.press('Space');
const a1 = await segP(); await p.waitForTimeout(600); const a2 = await segP();
console.log('space pause', a1, a2, '|', await status());
await p.keyboard.press('ArrowRight'); console.log('→', await status());
await p.keyboard.press('ArrowLeft'); console.log('←', await status());
await p.keyboard.press('Space'); console.log('space resume', await segP(), '|', await status());
// hold-to-pause with the pointer (no navigation)
const box = await frame.boundingBox();
await p.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6);
await p.mouse.down(); await p.waitForTimeout(500);
console.log('holding', await segP(), '|', await status(), '| pill', await frame.getByText('Paused').count());
await p.mouse.up(); await p.waitForTimeout(50);
console.log('released', await segP(), '|', await status());
// tap right zone -> next, tap left zone -> previous
await p.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.6); console.log('tap right', await status());
await p.mouse.click(box.x + box.width * 0.1, box.y + box.height * 0.6); console.log('tap left', await status());
// visible buttons
await stage.getByRole('button', { name: 'Pause' }).click(); console.log('Pause btn', await status());
await stage.getByRole('button', { name: /Next/ }).click(); await stage.getByRole('button', { name: /Next/ }).click();
await frame.screenshot({ path: `${S}/story-2.png` });
for (let i = 0; i < 4; i++) await stage.getByRole('button', { name: /Next/ }).click();
console.log('after many next', await status(), '| replay btn', await stage.getByRole('button', { name: 'Replay' }).count());
console.log('errors', errors);
await b.close();
