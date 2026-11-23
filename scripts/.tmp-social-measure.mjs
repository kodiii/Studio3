import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
await page.goto('http://localhost:3333' + process.argv[2]);
await page.waitForTimeout(1500);
console.log(JSON.stringify(await page.evaluate((sel) => {
  const el = document.querySelector(sel);
  const r = el.getBoundingClientRect();
  const anc = [];
  for (let p = el.parentElement; p; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.overflow !== 'visible' || cs.overflowX !== 'visible') anc.push(p.tagName + '.' + p.className.slice(0, 40) + ' ' + cs.overflow); }
  const main = el.nextElementSibling?.getBoundingClientRect();
  return { top: r.top, mainTop: main?.top, position: getComputedStyle(el).position, alignSelf: getComputedStyle(el).alignSelf, marginTop: getComputedStyle(el).marginTop, anc };
}, process.argv[3])));
await browser.close();
