import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
for (const reduce of [true, false]) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: reduce ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push('pageerror ' + e.message));
  await p.goto('http://localhost:3333/effects/flip-grid-reorder');
  const stage = p.locator('[data-effect-stage="flip-grid-reorder"]');
  await stage.getByRole('button', { name: /^Paper/ }).waitFor();
  await p.waitForTimeout(600);
  const info = () => p.evaluate(() => {
    const st = document.querySelector('[data-effect-stage="flip-grid-reorder"]');
    const anims = document.getAnimations().filter((a) => st.contains(a.effect?.target));
    return { inFlow: [...st.querySelectorAll('[data-tile]:not([data-leaving])')].length, ghosts: st.querySelectorAll('[data-leaving]').length,
      props: [...new Set(anims.flatMap((a) => a.effect.getKeyframes().flatMap((k) => Object.keys(k).filter((x) => !['offset', 'easing', 'composite', 'computedOffset'].includes(x)))))].join(','),
      maxDur: Math.max(0, ...anims.map((a) => a.effect.getTiming().duration)) };
  });
  if (reduce) {
    await stage.getByRole('button', { name: /^Paper/ }).click();
    await p.waitForTimeout(20);
    console.log('reduced paper', await info());
    await stage.getByRole('button', { name: /^All/ }).click();
    await p.waitForTimeout(20);
    console.log('reduced all (entering fade only)', await info());
  } else {
    await p.getByLabel('Filter mode').selectOption('multiple');
    await p.waitForTimeout(300);
    await stage.getByRole('button', { name: /^Paper/ }).click();
    await p.waitForTimeout(700);
    await stage.getByRole('button', { name: /^Stone/ }).click();
    await p.waitForTimeout(700);
    console.log('multiple: paper+stone', await info(), await stage.locator('[role=status]').textContent());
    console.log('pressed', await stage.locator('[aria-pressed=true]').allTextContents());
  }
  await ctx.close();
}
console.log('errors', errors);
await b.close();
