import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
await p.goto('http://localhost:3333/effects/dot-grid-pointer-field');
await p.waitForTimeout(3000);
console.log(await p.evaluate(() => { const s = document.querySelector('[data-effect-stage="dot-grid-pointer-field"]'); return s?.innerHTML.slice(0, 600); }));
await b.close();
