#!/usr/bin/env node
// Dev helper: screenshot a gallery route. Usage: node scripts/shot.mjs <path> <out.png> [width] [height] [--reduced] [--full] [--wait ms]
import { chromium } from 'playwright';
const [route, out, w = '1280', h = '800', ...flags] = process.argv.slice(2);
const waitIdx = flags.indexOf('--wait');
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, reducedMotion: flags.includes('--reduced') ? 'reduce' : 'no-preference', colorScheme: flags.includes('--dark') ? 'dark' : 'light' });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
await page.goto((process.env.BASE ?? 'http://localhost:3333') + route, { waitUntil: 'load' });
await page.waitForTimeout(waitIdx >= 0 ? +flags[waitIdx + 1] : 1500);
await page.screenshot({ path: out, fullPage: flags.includes('--full') });
console.log(JSON.stringify({ route, out, errors: errors.slice(0, 8), diag: await page.evaluate(() => window.__MAQUETTEKIT_3D__ ?? null) }));
await browser.close();
