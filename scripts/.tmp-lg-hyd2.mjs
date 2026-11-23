import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto('http://localhost:3333' + process.argv[2]);
await p.waitForTimeout(2500);
for (const e of errors) console.log(e.split('\n').filter((l) => /^\s*[+-]/.test(l) || /mismatch/.test(l)).join('\n'));
await b.close();
