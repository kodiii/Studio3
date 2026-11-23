import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('http://localhost:3333/effects/morph-submit-button');
const stage = p.locator('[data-effect-stage="morph-submit-button"]');
const btn = stage.locator('button[type=submit]');
const input = stage.locator('input[type=email]');
await btn.waitFor(); await p.waitForTimeout(500);
await input.focus(); await p.keyboard.press('Enter');
await p.waitForTimeout(3300);
console.log('phase', await btn.getAttribute('data-phase'));
await p.keyboard.press('Enter'); // input still focused
await p.waitForTimeout(150);
console.log('after Enter in input', await btn.getAttribute('data-phase'));
const t0 = Date.now();
await btn.click({ timeout: 4000 }).catch((e) => console.log('pw click error:', e.message.split('\n')[0]));
console.log('pw click took', Date.now() - t0, 'ms; phase', await btn.getAttribute('data-phase'), 'status', await stage.locator('[role=status]').textContent());
await b.close();
