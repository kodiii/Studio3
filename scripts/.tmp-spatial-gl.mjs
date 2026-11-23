// Usage: node scripts/.tmp-spatial-gl.mjs <effect-id> [--dark] [--wait ms] [--act js]
import { chromium } from 'playwright';
const id = process.argv[2];
const dark = process.argv.includes('--dark');
const wi = process.argv.indexOf('--wait');
const wait = wi > 0 ? +process.argv[wi + 1] : 4000;
const out = '/tmp/claude-0/-home-user/77865dc0-1700-59d0-bb68-e0d68f61d45b/scratchpad/spatial/';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const res = {};
{ // WebGL run
  const ctx = await b.newContext({ viewport: { width: 1100, height: 900 }, colorScheme: dark ? 'dark' : 'light' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await p.goto('http://localhost:3333/effects/' + id);
  const stage = p.locator(`[data-effect-stage="${id}"]`);
  await stage.waitFor();
  await p.waitForTimeout(wait);
  const box = await stage.boundingBox();
  await p.screenshot({ path: out + id + (dark ? '-dark' : '') + '.png', clip: box });
  const d1 = await p.evaluate(() => window.__STUDIO3_3D__ && JSON.parse(JSON.stringify(window.__STUDIO3_3D__)));
  await p.waitForTimeout(2000);
  const d2 = await p.evaluate(() => window.__STUDIO3_3D__?.frames);
  res.webgl = { status: await stage.locator('[data-studio3-canvas]').first().getAttribute('data-status'), diag: d1, framesAtRest2s: d1 ? d2 - d1.frames : null, errors };
  await ctx.close();
}
{ // no-WebGL run
  const ctx = await b.newContext({ viewport: { width: 1100, height: 900 }, colorScheme: dark ? 'dark' : 'light' });
  await ctx.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return /webgl/i.test(type) ? null : orig.call(this, type, ...rest); };
  });
  const p = await ctx.newPage();
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await p.goto('http://localhost:3333/effects/' + id);
  const stage = p.locator(`[data-effect-stage="${id}"]`);
  await stage.waitFor();
  await p.waitForTimeout(1500);
  const fb = stage.locator('[data-studio3-fallback]');
  const visible = await fb.isVisible().catch(() => false);
  await p.screenshot({ path: out + id + '-fallback.png', clip: await stage.boundingBox() });
  res.fallback = { visible, text: visible ? (await fb.innerText()).slice(0, 160).replace(/\s+/g, ' ') : null, errors };
  await ctx.close();
}
console.log(JSON.stringify(res, null, 1));
await b.close();
