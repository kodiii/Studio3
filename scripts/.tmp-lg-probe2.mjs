import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 500)); });
p.on('pageerror', (e) => errors.push('pageerror ' + e.message.slice(0, 500)));
await p.goto('http://localhost:3333/effects/pull-to-reveal-sheet');
const stage = p.locator('[data-effect-stage="pull-to-reveal-sheet"]');
await stage.getByRole('button', { name: 'Expand sheet' }).waitFor();
for (let i = 0; i < 3; i++) {
  await stage.getByRole('button', { name: 'Expand sheet' }).click(); await p.waitForTimeout(80);
  await p.locator('[data-replay]').click(); await p.waitForTimeout(300);
  console.log(i, await p.evaluate(() => { const s = document.querySelector('[data-effect-stage="pull-to-reveal-sheet"]'); return { section: !!s.querySelector('section'), err: s.querySelector('[data-effect-error]')?.textContent ?? null, text: s.innerText.slice(0, 60) }; }));
}
console.log(await stage.innerText().then((t) => t.slice(0, 200)));
console.log(errors);
await b.close();
