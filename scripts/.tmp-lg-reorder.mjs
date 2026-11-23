// Throwaway verification for drag-reorder-list: pointer + keyboard + remounts, one montage.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
const S = '/tmp/claude-0/-home-user/77865dc0-1700-59d0-bb68-e0d68f61d45b/scratchpad/lg';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const open = async (opts = {}) => {
  const ctx = await b.newContext({ viewport: { width: opts.w ?? 1280, height: 1000 }, colorScheme: opts.dark ? 'dark' : 'light' });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  p.on('pageerror', (e) => errors.push('pageerror ' + e.message));
  await p.goto('http://localhost:3333/effects/drag-reorder-list');
  const stage = p.locator('[data-effect-stage="drag-reorder-list"]');
  await stage.getByRole('button', { name: /^Move Headlines/ }).waitFor();
  await stage.scrollIntoViewIfNeeded();
  await p.waitForTimeout(400);
  return { ctx, p, stage };
};
const state = (p) => p.evaluate(() => {
  const st = document.querySelector('[data-effect-stage="drag-reorder-list"]');
  const rows = [...st.querySelectorAll('ol > li')];
  return {
    order: rows.map((r) => r.querySelector('[class*=segTitle]').textContent.split(' ')[0]).join(','),
    times: rows.map((r) => r.querySelector('[class*=time]')?.textContent).join(' '),
    live: st.querySelector('[aria-live]').textContent,
    focus: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName,
    pressed: st.querySelector('[aria-pressed=true]')?.getAttribute('aria-label') ?? null,
    liTabStops: rows.filter((r) => r.hasAttribute('tabindex')).length,
  };
});
const drag = async (p, from, dy, steps = 16) => {
  const box = await from.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await p.mouse.move(x, y); await p.mouse.down();
  for (let i = 1; i <= steps; i++) { await p.mouse.move(x + 1, y + (dy * i) / steps); await p.waitForTimeout(16); }
  await p.waitForTimeout(150);
  await p.mouse.up();
  await p.waitForTimeout(700);
};
{ // Pointer path
  const { ctx, p, stage } = await open();
  console.log('start', await state(p));
  await drag(p, stage.getByRole('button', { name: /^Move Headlines/ }), 150);
  console.log('handle drag Headlines down ~2 rows', await state(p));
  await drag(p, stage.locator('li', { hasText: 'Sign-off' }).locator('[class*=segTitle]'), -200);
  console.log('drag on row text (handle mode, must NOT move)', (await state(p)).order);
  await p.getByLabel('Drag from').selectOption('row');
  await p.waitForTimeout(300);
  await drag(p, stage.locator('li', { hasText: 'Sign-off' }).locator('[class*=segTitle]'), -110);
  console.log('row mode: drag Sign-off up ~2 rows', (await state(p)).order);
  for (let i = 0; i < 3; i++) {   // remount mid-drag
    const h = await stage.getByRole('button', { name: /^Move Cold/ }).boundingBox();
    await p.mouse.move(h.x + 20, h.y + 20); await p.mouse.down(); await p.mouse.move(h.x + 20, h.y + 60, { steps: 4 });
    await p.locator('[data-replay]').click({ force: true }); await p.mouse.up(); await p.waitForTimeout(300);
  }
  console.log('after remounts', (await state(p)).order, 'anims', await p.evaluate(() => document.getAnimations().length));
  await ctx.close();
}
{ // Keyboard path
  const { ctx, p, stage } = await open();
  await stage.getByRole('button', { name: /^Move Cold open/ }).focus();
  await p.keyboard.press('Space');
  console.log('Space: picked up', await state(p));
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(80);
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(350);
  await stage.screenshot({ path: `${S}/reorder-light.png` });
  console.log('↓↓ while held', await state(p));
  await p.keyboard.press('Space'); await p.waitForTimeout(300);
  console.log('Space: dropped', await state(p));
  await p.keyboard.press('Enter'); await p.keyboard.press('End'); await p.waitForTimeout(250);
  console.log('Enter + End', await state(p));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  console.log('Escape restores', await state(p));
  await p.keyboard.press('Space'); await p.keyboard.press('ArrowUp'); await p.keyboard.press('Tab'); await p.waitForTimeout(300);
  console.log('Space ↑ then Tab (blur drops)', await state(p));
  await stage.getByRole('button', { name: /^Move Sign-off/ }).focus();
  await p.keyboard.press('Space'); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(200);
  console.log('bottom boundary', (await state(p)).live);
  await ctx.close();
}
{ const { ctx, stage } = await open({ dark: true }); await stage.screenshot({ path: `${S}/reorder-dark.png` }); await ctx.close(); }
{ const { ctx, p, stage } = await open({ w: 390 }); await stage.screenshot({ path: `${S}/reorder-390.png` });
  console.log('390 overflow', await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)); await ctx.close(); }
console.log('errors', errors);
await b.close();
console.log(execFileSync('python3', [`${S}/montage.py`, `${S}/reorder-montage.png`, `${S}/reorder-light.png`, `${S}/reorder-dark.png`, `${S}/reorder-390.png`]).toString());
