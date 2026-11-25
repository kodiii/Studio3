// @ts-check
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMatch, palette, gridDiff, renderMatchMd } from '../../../plugins/maquettekit/tools/visual-director/match.mjs';
import { launchBrowser } from '../../../plugins/maquettekit/tools/lib/browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const GOOD = path.resolve(here, '../../fixtures/vd-good');
const BROKEN = path.resolve(here, '../../fixtures/vd-broken');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'maquettekit-match-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const browserProbe = await (async () => {
  try { const b = await launchBrowser(); await b.close(); return { ok: true, reason: '' }; }
  catch (err) { return { ok: false, reason: String(/** @type {any} */ (err).message).split('\n')[0] }; }
})();
const bit = browserProbe.ok ? it : (name, ..._rest) => it.skip(`${name} [SKIPPED: Chromium unavailable — ${browserProbe.reason}]`, () => {});

/** Screenshot the good fixture as a reference image. */
async function reference(name, { scale = 1, type = 'png' } = {}) {
  const b = await launchBrowser();
  try {
    const ctx = await b.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: scale, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await p.goto(`file://${GOOD}/index.html`);
    await p.waitForTimeout(400);
    const file = path.join(tmp, `${name}.${type === 'jpeg' ? 'jpg' : 'png'}`);
    await p.screenshot({ path: file, type: /** @type {'png'|'jpeg'} */ (type), ...(type === 'jpeg' ? { quality: 90 } : {}) });
    return file;
  } finally { await b.close(); }
}

describe('match helpers', () => {
  it('palette merges near colours and orders by share; gridDiff locates red diff pixels', () => {
    const img = { width: 10, height: 10, data: Buffer.alloc(400) };
    for (let i = 0; i < 100; i++) { const o = i * 4; const red = i < 30; img.data[o] = red ? 220 : 250; img.data[o + 1] = red ? 30 : 250; img.data[o + 2] = red ? 30 : 250; img.data[o + 3] = 255; }
    const pal = palette(img);
    expect(pal[0].share).toBeCloseTo(0.7, 2);
    expect(pal[1].share).toBeCloseTo(0.3, 2);
    const diff = { width: 9, height: 9, data: Buffer.alloc(9 * 9 * 4) };
    for (let y = 0; y < 3; y++) for (let x = 6; x < 9; x++) { const o = (y * 9 + x) * 4; diff.data[o] = 255; diff.data[o + 3] = 255; }
    const g = gridDiff(diff);
    expect(g.find((c) => c.region === 'top-right').ratio).toBe(1);
    expect(g.filter((c) => c.ratio > 0)).toHaveLength(1);
  });
});

describe('review match', () => {
  bit('the same page scores ~100 % (PNG exactly, JPEG within compression noise); @2x exports use --scale 2', async () => {
    const png = await runMatch({ serve: GOOD, reference: await reference('ref'), out: path.join(tmp, 'same') });
    expect(png.similarity).toBe(1);
    expect(png.size).toMatchObject({ reference: { width: 800, height: 600 }, viewport: { width: 800, height: 600, scale: 1 } });
    expect(png.palette.missingFromPage).toEqual([]);
    const jpg = await runMatch({ serve: GOOD, reference: await reference('ref-jpeg', { type: 'jpeg' }), out: path.join(tmp, 'jpeg') });
    expect(jpg.similarity).toBeGreaterThan(0.98);
    const hi = await runMatch({ serve: GOOD, reference: await reference('ref-2x', { scale: 2 }), scale: 2, out: path.join(tmp, 'hidpi') });
    expect(hi.size.viewport).toMatchObject({ width: 800, height: 600, scale: 2 });
    expect(hi.similarity).toBeGreaterThan(0.99);
  }, 180_000);

  bit('a different page scores lower, names the worst region, and keeps a run history', async () => {
    const ref = await reference('ref-b');
    const out = path.join(tmp, 'diff');
    const first = await runMatch({ serve: BROKEN, reference: ref, out });
    expect(first.similarity).toBeLessThan(0.97);
    expect(first.grid[0].ratio).toBeGreaterThanOrEqual(first.grid[8].ratio);
    expect(first.previous).toBeNull();
    for (const f of ['reference', 'page', 'diff', 'json', 'md']) expect(fs.existsSync(first.files[f]), f).toBe(true);
    const second = await runMatch({ serve: GOOD, reference: ref, out });
    expect(second.history).toHaveLength(2);
    expect(second.previous).toBe(first.similarity);
    expect(renderMatchMd(second)).toMatch(/previous run .* \+\d/);
  }, 180_000);

  it('rejects bad usage before launching a browser', async () => {
    await expect(runMatch({ serve: GOOD, reference: path.join(tmp, 'missing.png') })).rejects.toThrow(/not found/);
    fs.writeFileSync(path.join(tmp, 'x.bmp'), 'x');
    await expect(runMatch({ serve: GOOD, reference: path.join(tmp, 'x.bmp') })).rejects.toThrow(/\.png, \.jpg/);
    fs.writeFileSync(path.join(tmp, 'x.png'), 'x');
    await expect(runMatch({ reference: path.join(tmp, 'x.png') })).rejects.toThrow(/needs a target/);
    await expect(runMatch({ serve: GOOD, reference: path.join(tmp, 'x.png'), scale: 9 })).rejects.toThrow(/--scale/);
  });
});
