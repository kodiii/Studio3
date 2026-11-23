import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1100 } });
await p.goto('http://localhost:3333/effects/expanding-card-detail');
const stage = p.locator('[data-effect-stage="expanding-card-detail"]');
await stage.getByRole('button', { name: 'Slow Machines' }).waitFor();
await p.getByLabel('Panel size').selectOption('centered');
await p.waitForTimeout(300);
await stage.getByRole('button', { name: 'Rooms That Listen' }).click();
for (const t of [50, 200, 400, 800, 1600, 2500]) {
  await p.waitForTimeout(t === 50 ? 50 : t / 2);
  console.log(t, await p.evaluate(() => {
    const d = document.querySelector('[role=dialog]');
    const sc = d.children[1];
    const media = sc.children[0];
    return { scrollTop: sc.scrollTop, scrollH: sc.scrollHeight, clientH: sc.clientHeight, mediaTransform: media.style.transform, panelT: d.style.transform };
  }));
}
await b.close();
