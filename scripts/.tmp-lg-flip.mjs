// Throwaway interaction check for flip-grid-reorder (deleted when done).
import { chromium } from 'playwright';
const S = '/tmp/claude-0/-home-user/77865dc0-1700-59d0-bb68-e0d68f61d45b/scratchpad/lg';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
p.on('pageerror', (e) => errors.push('pageerror ' + e.message));
await p.goto('http://localhost:3333/effects/flip-grid-reorder');
const stage = p.locator('[data-effect-stage="flip-grid-reorder"]');
await stage.getByRole('button', { name: /^Paper/ }).waitFor();
await p.waitForTimeout(800);
const snap = () => p.evaluate(() => {
  const st = document.querySelector('[data-effect-stage="flip-grid-reorder"]');
  const tiles = [...st.querySelectorAll('[data-tile]')];
  return {
    inFlow: tiles.filter((t) => !t.hasAttribute('data-leaving')).map((t) => t.dataset.tile).join(','),
    ghosts: tiles.filter((t) => t.hasAttribute('data-leaving')).length,
    anims: document.getAnimations().filter((a) => st.contains(a.effect?.target)).length,
    status: st.querySelector('[role=status]').textContent,
    pressed: [...st.querySelectorAll('[aria-pressed=true]')].map((b) => b.textContent.trim()).join('|'),
  };
});
console.log('initial', await snap());
// Pointer path: filter to Paper.
await stage.getByRole('button', { name: /^Paper/ }).click();
await p.waitForTimeout(60);
console.log('paper +60ms', await snap());
await p.waitForTimeout(900);
console.log('paper settled', await snap());
// Sort by tone (mid-flight screenshot) after going back to all.
await stage.getByRole('button', { name: /^All/ }).click();
await p.waitForTimeout(900);
await stage.getByRole("button", { name: "Tone" }).click();
await p.waitForTimeout(170);
await stage.screenshot({ path: `${S}/flip-mid.png` });
await p.waitForTimeout(900);
console.log('tone settled', await snap());
await stage.screenshot({ path: `${S}/flip-tone.png` });
// Interrupt: Metal, then All 120ms later (ghosts must come back, nothing stuck).
await stage.getByRole('button', { name: /^Metal/ }).click();
await p.waitForTimeout(120);
await stage.getByRole('button', { name: /^All/ }).click();
await p.waitForTimeout(60);
console.log('interrupt +60ms', await snap());
await p.waitForTimeout(1200);
const settled = await snap();
console.log('interrupt settled', settled);
const stuck = await p.evaluate(() => [...document.querySelectorAll('[data-effect-stage] [data-tile]')].filter((t) => getComputedStyle(t).opacity !== '1' || getComputedStyle(t).transform !== 'none').length);
console.log('stuck tiles (opacity/transform not reset):', stuck);
// Keyboard path: Tab to the Textile chip, press Enter; then Space on "A–Z".
await stage.getByRole('button', { name: /^Textile/ }).focus();
await p.keyboard.press('Enter');
await p.waitForTimeout(900);
console.log('kbd textile', await snap());
await stage.getByRole("button", { name: "Name" }).focus();
await p.keyboard.press('Space');
await p.waitForTimeout(900);
console.log('kbd name', await snap());
await stage.getByRole('button', { name: 'Shuffle' }).focus();
await p.keyboard.press('Enter');
await p.waitForTimeout(900);
console.log('kbd shuffle', await snap());
// Remount a few times mid-transition, then check nothing leaks.
for (let i = 0; i < 4; i++) {
  await stage.getByRole('button', { name: /^Stone/ }).click();
  await p.waitForTimeout(40);
  await p.locator('[data-replay]').click();
  await p.waitForTimeout(250);
}
await p.waitForTimeout(400);
console.log('after remounts', await snap(), 'all anims on page:', await p.evaluate(() => document.getAnimations().length));
console.log('errors', errors);
await b.close();
