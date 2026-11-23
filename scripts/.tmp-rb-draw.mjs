import { chromium } from 'playwright';
const S = '/tmp/claude-0/-home-user/77865dc0-1700-59d0-bb68-e0d68f61d45b/scratchpad/rb';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1000, height: 900 } })).newPage();
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
p.on('pageerror', (e) => errors.push('pageerror ' + e.message.slice(0, 160)));
for (let k = 0; k < 3; k++) { const r = await p.goto('http://localhost:3333/effects/svg-path-draw'); if (r.status() === 200) break; await p.waitForTimeout(1500); }
const stage = p.locator('[data-effect-stage="svg-path-draw"]');
const slider = stage.locator('input[type=range]');
await slider.waitFor();
const off = () => stage.evaluate((s) => ['body', 'strings', 'bodyFill'].map((k) => { const el = s.querySelector(`[data-part="${k}"]`); const cs = getComputedStyle(el); return `${k}:${(+parseFloat(cs.strokeDashoffset)).toFixed(2)}/${(+cs.fillOpacity).toFixed(2)}`; }).join(' '));
await p.waitForTimeout(900);
console.log('t≈0.9s', await off(), '| slider', await slider.inputValue(), await slider.getAttribute('aria-valuetext'));
await stage.screenshot({ path: `${S}/draw-mid.png` });
await p.waitForTimeout(2900);
console.log('end', await off(), '| slider', await slider.inputValue());
// keyboard scrub: focus the slider, Home -> 0%, then PageUp x3
await slider.focus();
await p.keyboard.press('Home');
await p.waitForTimeout(50);
console.log('Home', await off(), '|', await slider.getAttribute('aria-valuetext'));
for (let i = 0; i < 4; i++) await p.keyboard.press('PageUp');
await p.waitForTimeout(50);
console.log('PageUp×4', await off(), '|', await slider.getAttribute('aria-valuetext'));
// replay via keyboard
await stage.getByRole('button', { name: 'Replay' }).focus();
await p.keyboard.press('Enter');
await p.waitForTimeout(300);
console.log('replay@300', await off(), '|', await slider.getAttribute('aria-valuetext'));
await p.waitForTimeout(3600);
await stage.screenshot({ path: `${S}/draw-end.png` });
console.log('img name', await stage.getByRole('img', { name: /Lute/ }).count(), 'errors', errors);
await b.close();
