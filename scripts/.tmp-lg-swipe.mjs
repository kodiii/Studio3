// Throwaway verification for swipe-card-stack: pointer + keyboard + buttons + remounts, one montage.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
const S = '/tmp/claude-0/-home-user/77865dc0-1700-59d0-bb68-e0d68f61d45b/scratchpad/lg';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const open = async (opts = {}) => {
  const ctx = await b.newContext({ viewport: { width: opts.w ?? 1280, height: 1000 }, colorScheme: opts.dark ? 'dark' : 'light', reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  p.on('pageerror', (e) => errors.push('pageerror ' + e.message));
  await p.goto('http://localhost:3333/effects/swipe-card-stack');
  const stage = p.locator('[data-effect-stage="swipe-card-stack"]');
  await stage.getByRole('button', { name: 'Save' }).waitFor();
  await stage.scrollIntoViewIfNeeded();
  await p.waitForTimeout(500);
  return { ctx, p, stage };
};
const state = (p) => p.evaluate(() => {
  const st = document.querySelector('[data-effect-stage="swipe-card-stack"]');
  const top = st.querySelector('article[tabindex="0"]');
  return { top: top?.getAttribute('aria-label') ?? null, saved: st.querySelector('aside ul')?.children.length ?? 0, status: st.querySelector('[role=status]').textContent, focus: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim().slice(0, 20) };
});
const dragTop = async (p, dx, { steps = 12, hold = 0 } = {}) => {
  const box = await p.locator('[data-effect-stage="swipe-card-stack"] article[tabindex="0"]').boundingBox();
  const x0 = box.x + box.width / 2, y0 = box.y + box.height / 2;
  await p.mouse.move(x0, y0);
  await p.mouse.down();
  for (let i = 1; i <= steps; i++) await p.mouse.move(x0 + (dx * i) / steps, y0 + i * 0.5);
  if (hold) await p.waitForTimeout(hold);
  return async () => { await p.mouse.up(); };
};

// ── Pointer path ────────────────────────────────────────────────────────
{
  const { ctx, p, stage } = await open();
  console.log('start', await state(p));
  let up = await dragTop(p, 60, { steps: 10, hold: 300 });       // short, slow: must snap back
  await up(); await p.waitForTimeout(700);
  console.log('short drag (snap back)', await state(p));
  up = await dragTop(p, 190, { steps: 14, hold: 250 });          // past threshold: save
  await stage.screenshot({ path: `${S}/swipe-mid.png` });
  const rise = await p.evaluate(() => [...document.querySelectorAll('[data-effect-stage] article')].map((a) => a.style.transform).filter(Boolean));
  console.log('next card while dragging (rise transforms)', rise.slice(0, 2));
  await up(); await p.waitForTimeout(800);
  console.log('drag right 190 (save)', await state(p));
  up = await dragTop(p, -70, { steps: 3 });                       // short but fast flick left: skip
  await up(); await p.waitForTimeout(800);
  console.log('fast flick left (skip)', await state(p));
  // Buttons
  await stage.getByRole('button', { name: 'Save' }).click(); await p.waitForTimeout(400);
  await stage.getByRole('button', { name: 'Undo' }).click(); await p.waitForTimeout(700);
  console.log('button save + undo', await state(p));
  // Remount several times mid-drag / mid-exit
  for (let i = 0; i < 3; i++) {
    await stage.getByRole('button', { name: 'Skip' }).click();
    await p.waitForTimeout(60);
    await p.locator('[data-replay]').click();
    await p.waitForTimeout(300);
  }
  console.log('after remounts', await state(p), 'anims', await p.evaluate(() => document.getAnimations().length));
  await ctx.close();
}
// ── Keyboard path ───────────────────────────────────────────────────────
{
  const { ctx, p, stage } = await open();
  await stage.locator('article[tabindex="0"]').focus();
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(250);
  console.log('kbd → (save), focus follows', await state(p));
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(250);
  await p.keyboard.press('z'); await p.waitForTimeout(600);
  console.log('kbd ← then z (undo)', await state(p));
  for (let i = 0; i < 8; i++) { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(120); }
  await p.waitForTimeout(700);
  console.log('kbd through the whole deck', await state(p));
  await p.keyboard.press('Enter'); await p.waitForTimeout(600);  // Start over is focused
  console.log('start over via Enter', await state(p));
  await stage.screenshot({ path: `${S}/swipe-light.png` });
  await ctx.close();
}
// ── Dark + 390 + reduced ────────────────────────────────────────────────
{
  const { ctx, p, stage } = await open({ dark: true });
  await stage.getByRole('button', { name: 'Save' }).click(); await p.waitForTimeout(900);
  await stage.screenshot({ path: `${S}/swipe-dark.png` });
  await ctx.close();
}
{
  const { ctx, p, stage } = await open({ w: 390 });
  await stage.screenshot({ path: `${S}/swipe-390.png` });
  console.log('390 overflow', await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
  await ctx.close();
}
{
  const { ctx, p, stage } = await open({ reduced: true });
  await stage.getByRole('button', { name: 'Save' }).click(); await p.waitForTimeout(30);
  console.log('reduced: exit anim props', await p.evaluate(() => document.getAnimations().map((a) => a.effect?.getKeyframes().flatMap((k) => Object.keys(k)).filter((k) => !['offset', 'easing', 'composite', 'computedOffset'].includes(k)).join('+'))));
  await ctx.close();
}
console.log('errors', errors);
await b.close();
console.log(execFileSync('python3', [`${S}/montage.py`, `${S}/swipe-montage.png`, `${S}/swipe-mid.png`, `${S}/swipe-dark.png`, `${S}/swipe-390.png`]).toString());
