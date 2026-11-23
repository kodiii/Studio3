import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage();
p.on('console', (m) => { if (m.type() === 'error') console.log(m.text().slice(0, 2500)); });
await p.goto('http://localhost:3333/demos/cinematic/cinematic-landing', { waitUntil: 'load' });
await p.waitForTimeout(2500);
await b.close();
