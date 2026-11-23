import { chromium } from 'playwright';
const b = await chromium.launch();
for (const w of [390, 1280]) {
  const p = await b.newPage({ viewport: { width: w, height: 1000 } });
  await p.goto('http://localhost:3333/effects/pull-to-reveal-sheet');
  await p.locator('[data-effect-stage] section').waitFor();
  await p.waitForTimeout(800);
  console.log(w, await p.evaluate(() => { const s = document.querySelector('[data-effect-stage] section'); const h = s.firstElementChild.getBoundingClientRect(); const r = s.parentElement.getBoundingClientRect(); return { headerBottomInside: Math.round(r.bottom - h.bottom) }; }));
  await p.close();
}
await b.close();
