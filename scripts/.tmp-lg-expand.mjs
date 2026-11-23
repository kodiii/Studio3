// Throwaway interaction check for expanding-card-detail (deleted when done).
import { chromium } from 'playwright';
const S = '/tmp/claude-0/-home-user/77865dc0-1700-59d0-bb68-e0d68f61d45b/scratchpad/lg';
const dark = process.argv.includes('--dark');
const width = Number(process.argv.find((a) => a.startsWith('--w='))?.slice(4) ?? 1280);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width, height: 1100 }, colorScheme: dark ? 'dark' : 'light' });
const p = await ctx.newPage();
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
p.on('pageerror', (e) => errors.push('pageerror ' + e.message));
await p.goto('http://localhost:3333/effects/expanding-card-detail');
const stage = p.locator('[data-effect-stage="expanding-card-detail"]');
await stage.getByRole('button', { name: 'Slow Machines' }).waitFor();
await stage.scrollIntoViewIfNeeded();
await p.waitForTimeout(700);
const tag = process.argv.find((a) => a.startsWith('--tag='))?.slice(6) ?? (dark ? 'dark' : 'light');
const state = () => p.evaluate(() => {
  const st = document.querySelector('[data-effect-stage="expanding-card-detail"]');
  const a = document.activeElement;
  return {
    dialog: !!st.querySelector('[role=dialog]'),
    gridInert: st.querySelector('ul')?.closest('[inert]') !== null,
    focus: a ? `${a.tagName.toLowerCase()}${a.getAttribute('aria-label') ? `[${a.getAttribute('aria-label')}]` : ''} "${(a.textContent || '').trim().slice(0, 30)}"` : null,
  };
});
// Pointer path: click the card surface (not the title) of "Slow Machines".
const card = stage.locator('article', { hasText: 'Slow Machines' });
const box = await card.boundingBox();
await p.mouse.click(box.x + box.width / 2, box.y + box.height * 0.35);
await p.waitForTimeout(140);
await stage.screenshot({ path: `${S}/expand-mid-${tag}.png` });
await p.waitForTimeout(1100);
console.log('opened by pointer', await state());
await stage.screenshot({ path: `${S}/expand-open-${tag}.png` });
// Toggle save inside the panel, then Escape.
await stage.getByRole('button', { name: 'Save to my list' }).click();
await p.keyboard.press('Escape');
await p.waitForTimeout(140);
await stage.screenshot({ path: `${S}/expand-closing-${tag}.png` });
await p.waitForTimeout(1100);
console.log('after Escape', await state());
await stage.screenshot({ path: `${S}/expand-closed-${tag}.png` });
// Keyboard path: Tab from the focused card to the next card, Enter to open, Tab cycles inside, Close button returns focus.
await p.keyboard.press('Tab');
console.log('tabbed to', (await state()).focus);
await p.keyboard.press('Enter');
await p.waitForTimeout(1000);
console.log('opened by Enter', await state());
const order = [];
for (let i = 0; i < 3; i++) { await p.keyboard.press('Tab'); order.push((await state()).focus); }
console.log('tab order inside panel', order);
await stage.locator('[role=dialog]:not([inert])').getByRole('button', { name: 'Close details' }).focus();
await p.keyboard.press('Enter');
await p.waitForTimeout(1000);
console.log('after Close via Enter', await state());
// Scrim click closes too.
await stage.getByRole('button', { name: 'Measuring Light' }).click();
await p.waitForTimeout(900);
const sb = await stage.boundingBox();
await p.mouse.click(sb.x + 3, sb.y + sb.height - 3);
await p.waitForTimeout(900);
console.log('after scrim click', await state());
// Remount while open, several times.
for (let i = 0; i < 4; i++) {
  await stage.getByRole('button', { name: 'Salt & Resin' }).click();
  await p.waitForTimeout(120);
  await p.locator('[data-replay]').click();
  await p.waitForTimeout(300);
}
console.log('after remounts', await state(), 'animations:', await p.evaluate(() => document.getAnimations().length));
// Centered mode.
await p.getByLabel('Panel size').selectOption('centered');
await p.waitForTimeout(300);
await stage.getByRole('button', { name: 'Rooms That Listen' }).click();
await p.waitForTimeout(1100);
await stage.screenshot({ path: `${S}/expand-centered-${tag}.png` });
console.log('centered', await state());
await p.keyboard.press('Escape');
await p.waitForTimeout(900);
console.log('errors', errors);
await b.close();
