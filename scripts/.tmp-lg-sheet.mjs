// Throwaway verification for pull-to-reveal-sheet: pointer + keyboard + remounts, one montage.
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
  await p.goto('http://localhost:3333/effects/pull-to-reveal-sheet');
  const stage = p.locator('[data-effect-stage="pull-to-reveal-sheet"]');
  await stage.getByRole('button', { name: 'Expand sheet' }).waitFor({ timeout: 60000 });
  await stage.scrollIntoViewIfNeeded();
  await p.waitForTimeout(400);
  return { ctx, p, stage };
};
const st = (p) => p.evaluate(() => {
  const root = document.querySelector('[data-effect-stage="pull-to-reveal-sheet"] section').parentElement;
  const sheet = root.querySelector('section');
  const m = new DOMMatrix(getComputedStyle(sheet).transform);
  const scrim = [...root.children].find((c) => c.style && c.style.opacity !== '' && c.tagName === 'DIV');
  const body = root.querySelector('[data-body]');
  return {
    y: Math.round(m.m42), expanded: root.querySelector('[aria-expanded]').getAttribute('aria-expanded'),
    scrim: scrim ? Number(scrim.style.opacity).toFixed(2) : null, bodyInert: body.inert,
    bodyFits: Math.round(body.getBoundingClientRect().bottom - root.getBoundingClientRect().bottom) <= 1,
    status: root.querySelector('[role=status]').textContent,
    focus: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim().slice(0, 24),
  };
});
const dragHeader = async (p, dy, { steps = 14, delay = 16, holdMs = 120, release = true } = {}) => {
  const h = await p.locator('[data-effect-stage="pull-to-reveal-sheet"] section > div').first().boundingBox();
  const x = h.x + h.width / 2, y = h.y + 10;
  await p.mouse.move(x, y); await p.mouse.down();
  for (let i = 1; i <= steps; i++) { await p.mouse.move(x, y + (dy * i) / steps); await p.waitForTimeout(delay); }
  await p.waitForTimeout(holdMs);
  if (release) { await p.mouse.up(); await p.waitForTimeout(900); }
};
{ // Pointer path
  const { ctx, p, stage } = await open();
  console.log('start (peek)', await st(p));
  await dragHeader(p, -250, { steps: 20, delay: 20, holdMs: 200 });
  console.log('slow drag up 250 → nearest snap', await st(p));
  await dragHeader(p, -60, { steps: 3, delay: 8, holdMs: 0 });
  console.log('short fast flick up → next snap (full)', await st(p));
  await dragHeader(p, -120, { steps: 10, delay: 16, holdMs: 100, release: false });
  console.log('pulling above full (rubber band, y<0 but < 120)', (await st(p)).y);
  await p.mouse.up(); await p.waitForTimeout(900);
  console.log('released → back to full', (await st(p)).y);
  await stage.screenshot({ path: `${S}/sheet-full-light.png` });
  const sb = await stage.locator('section').boundingBox();
  await p.mouse.click(sb.x + sb.width / 2, sb.y - 10);   // scrim strip above the sheet
  await p.waitForTimeout(900);
  console.log('scrim click → peek', await st(p));
  await dragHeader(p, 120, { steps: 10, release: false });
  console.log('pulling below peek (rubber band)', (await st(p)).y);
  await p.mouse.up(); await p.waitForTimeout(900);
  for (let i = 0; i < 3; i++) { await stage.getByRole('button', { name: 'Expand sheet' }).click(); await p.waitForTimeout(80); await p.locator('[data-replay]').click(); await p.waitForTimeout(300); }
  await stage.locator('section').waitFor();
  console.log('after remounts', await st(p), 'anims', await p.evaluate(() => document.getAnimations().length));
  await ctx.close();
}
{ // Keyboard path
  const { ctx, p, stage } = await open();
  await stage.locator('[aria-expanded]').focus();
  await p.keyboard.press('Enter'); await p.waitForTimeout(800);
  console.log('Enter on header', await st(p));
  await stage.screenshot({ path: `${S}/sheet-half-light.png` });
  await p.keyboard.press('ArrowUp'); await p.waitForTimeout(800);
  console.log('ArrowUp', await st(p));
  await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.keyboard.press('Space'); await p.waitForTimeout(200);
  console.log('Tab into list + Space (reminder)', await st(p), await stage.locator('[aria-pressed=true]').count());
  await p.keyboard.press('Escape'); await p.waitForTimeout(800);
  console.log('Escape from list → peek, focus header', await st(p));
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(300);
  console.log('ArrowDown at peek (stays)', (await st(p)).y);
  await p.keyboard.press('Home'); await p.waitForTimeout(800);
  console.log('Home → full', (await st(p)).y);
  await p.keyboard.press('End'); await p.waitForTimeout(800);
  console.log('End → peek', (await st(p)).y);
  await stage.getByRole('button', { name: 'Expand sheet' }).focus();
  for (let i = 0; i < 3; i++) { await p.keyboard.press('Enter'); await p.waitForTimeout(500); }
  console.log('Expand ×3 (focus kept at limit)', await st(p));
  await ctx.close();
}
{ const { ctx, p, stage } = await open({ dark: true }); await stage.getByRole('button', { name: 'Expand sheet' }).click(); await p.waitForTimeout(900); await stage.screenshot({ path: `${S}/sheet-dark.png` }); await ctx.close(); }
{ const { ctx, p, stage } = await open({ w: 390 }); await stage.screenshot({ path: `${S}/sheet-390.png` });
  console.log('390 overflow', await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)); await ctx.close(); }
console.log('errors', errors);
await b.close();
console.log(execFileSync('python3', [`${S}/montage.py`, `${S}/sheet-montage.png`, `${S}/sheet-half-light.png`, `${S}/sheet-full-light.png`, `${S}/sheet-dark.png`, `${S}/sheet-390.png`]).toString());
