import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const route of ['/effects/expanding-card-detail', '/effects/flip-grid-reorder', '/effects/split-line-reveal']) {
  for (const cs of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 }, colorScheme: cs });
    const p = await ctx.newPage();
    const errors = [];
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 1500)); });
    await p.goto('http://localhost:3333' + route);
    await p.waitForTimeout(2000);
    console.log(route, cs, errors.length ? errors : 'clean');
    await ctx.close();
  }
}
await b.close();
