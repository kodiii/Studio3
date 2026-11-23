import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1100 } });
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
await p.goto('http://localhost:3333/effects/expanding-card-detail');
const stage = p.locator('[data-effect-stage="expanding-card-detail"]');
await stage.getByRole('button', { name: 'Slow Machines' }).waitFor();
for (const mode of ['centered', 'fill']) {
  await p.getByLabel('Panel size').selectOption(mode);
  await p.waitForTimeout(300);
  await stage.getByRole('button', { name: 'Rooms That Listen' }).click();
  await p.waitForTimeout(1600);
  console.log(mode, await p.evaluate(() => {
    const d = document.querySelector('[role=dialog]');
    const sc = d.children[1], media = sc.children[0], body = sc.children[1];
    return { overlap: Math.round(media.getBoundingClientRect().bottom - body.getBoundingClientRect().top), scrollable: sc.scrollHeight > sc.clientHeight, focus: document.activeElement?.getAttribute('aria-label') };
  }));
  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
  // mid-close: the card focus ring (::after) must cover the whole card, not just the title
  console.log(' ring mid-close', await p.evaluate(() => {
    const btn = document.activeElement; const card = btn.closest('article');
    const after = getComputedStyle(btn, '::after');
    return { focus: btn.textContent, cardH: Math.round(card.getBoundingClientRect().height), containingBlockIsCard: btn.parentElement.style.transform === '' };
  }));
  await p.waitForTimeout(1400);
}
console.log('errors', errors);
await b.close();
