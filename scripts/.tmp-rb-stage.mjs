// Usage: node scripts/.tmp-rb-stage.mjs <id> <out.png> <width> [--dark] [--reduced] [--wait ms] [--params json]
import { chromium } from 'playwright';
const [id, out, w = '1280', ...flags] = process.argv.slice(2);
const wi = flags.indexOf('--wait');
const pi = flags.indexOf('--params');
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: +w, height: 900 }, reducedMotion: flags.includes('--reduced') ? 'reduce' : 'no-preference', colorScheme: flags.includes('--dark') ? 'dark' : 'light' });
const p = await ctx.newPage();
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await p.goto(`http://localhost:3333/effects/${id}`);
const stage = p.locator(`[data-effect-stage="${id}"]`);
await stage.waitFor();
if (pi >= 0) {
  const params = JSON.parse(flags[pi + 1]);
  for (const [k, v] of Object.entries(params)) {
    const el = p.locator(`#param-${k}`);
    const type = await el.evaluate((e) => (e.tagName === 'SELECT' ? 'select' : e.type));
    if (type === 'select') await el.selectOption(String(v));
    else if (type === 'checkbox') await el.setChecked(Boolean(v));
    else if (type === 'range') await el.evaluate((e, val) => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(e, String(val)); e.dispatchEvent(new Event('input', { bubbles: true })); }, v);
    else await el.fill(String(v));
  }
}
await p.waitForTimeout(wi >= 0 ? +flags[wi + 1] : 1500);
await stage.screenshot({ path: out });
const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log(JSON.stringify({ id, out, overflow, errors }));
await b.close();
