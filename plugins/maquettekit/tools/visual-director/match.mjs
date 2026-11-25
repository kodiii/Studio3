// @ts-check
/**
 * `maquettekit review match` — compare a page with a reference image (mockup, screenshot, design export).
 * Captures the page at the reference's size (reduced motion, fonts loaded), pixel-diffs the two and reports an overall
 * similarity, where on a 3×3 grid the difference sits, and which reference colours the page lacks. Every run is
 * appended to a history so an improve → re-measure loop can see whether it is converging.
 */
import fs from 'node:fs';
import path from 'node:path';
import { UserError } from '../lib/log.mjs';
import { launchBrowser } from '../lib/browser.mjs';
import { serveStatic } from '../lib/static-server.mjs';
import { loadPngTools, diffPngBuffers } from './util.mjs';
import { deltaEOk, rgbToHex } from '../design-intelligence/color.mjs';

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
const ROWS = ['top', 'middle', 'bottom']; const COLS = ['left', 'centre', 'right'];

/** Most frequent colours (4-bit-per-channel buckets), merged when closer than ΔE 0.04. @param {{width:number,height:number,data:Buffer}} img */
export function palette(img, max = 6) {
  const counts = new Map();
  const step = Math.max(1, Math.floor((img.width * img.height) / 200_000)); // sample large images
  for (let i = 0; i < img.width * img.height; i += step) {
    const o = i * 4; if (img.data[o + 3] < 128) continue;
    const key = ((img.data[o] >> 4) << 8) | ((img.data[o + 1] >> 4) << 4) | (img.data[o + 2] >> 4);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1;
  const out = [];
  for (const [key, n] of [...counts].sort((a, b) => b[1] - a[1])) {
    const hex = rgbToHex({ r: (((key >> 8) & 15) * 17) / 255, g: (((key >> 4) & 15) * 17) / 255, b: ((key & 15) * 17) / 255 });
    const near = out.find((c) => deltaEOk(c.hex, hex) < 0.04);
    if (near) near.share += n / total; else out.push({ hex, share: n / total });
    if (out.length >= max * 3) break;
  }
  return out.sort((a, b) => b.share - a.share).slice(0, max).map((c) => ({ hex: c.hex, share: Math.round(c.share * 1000) / 1000 }));
}

/** Share of changed pixels per cell of a 3×3 grid, from a pixelmatch diff image (changed pixels are pure red). */
export function gridDiff(diff) {
  const cells = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const x0 = Math.floor((c * diff.width) / 3); const x1 = Math.floor(((c + 1) * diff.width) / 3);
      const y0 = Math.floor((r * diff.height) / 3); const y1 = Math.floor(((r + 1) * diff.height) / 3);
      let changed = 0; let n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const o = (y * diff.width + x) * 4; n++;
        if (diff.data[o] === 255 && diff.data[o + 1] === 0 && diff.data[o + 2] === 0) changed++;
      }
      cells.push({ region: `${ROWS[r]}-${COLS[c]}`, ratio: n ? Math.round((changed / n) * 1000) / 1000 : 0 });
    }
  }
  return cells;
}

/**
 * @param {{ url?: string, serve?: string, route?: string, reference: string, viewport?: string, scale?: number, threshold?: number, out?: string, now?: string }} opts
 */
export async function runMatch(opts) {
  if (!opts.reference) throw new UserError('review match needs --reference <image> (PNG, JPEG, WebP or GIF)');
  const refFile = path.resolve(opts.reference);
  if (!fs.existsSync(refFile)) throw new UserError(`--reference: ${refFile} not found`);
  const mime = MIME[path.extname(refFile).toLowerCase()];
  if (!mime) throw new UserError('--reference must be a .png, .jpg, .jpeg, .webp or .gif file');
  if (!opts.url && !opts.serve) throw new UserError('review match needs a target: --url <url> or --serve <dir>');
  if (opts.url && opts.serve) throw new UserError('Use either --url or --serve, not both.');
  const scale = opts.scale ?? 1;
  if (!(scale > 0 && scale <= 4)) throw new UserError('--scale must be between 0 and 4 (2 for @2x exports)');
  const outDir = path.resolve(opts.out ?? '.maquettekit/match');
  fs.mkdirSync(outDir, { recursive: true });
  const tools = await loadPngTools();
  let server = null;
  let browser;
  try {
    let base;
    if (opts.serve) { server = await serveStatic(path.resolve(opts.serve)); base = server.url; } else base = String(opts.url);
    browser = await launchBrowser();
    // decode the reference in the browser (any format Chromium reads) into a PNG at its natural size
    const dec = await browser.newContext({ viewport: { width: 64, height: 64 }, deviceScaleFactor: 1 });
    const dp = await dec.newPage();
    await dp.setContent(`<html><body style="margin:0;background:#fff"><img id="r" src="data:${mime};base64,${fs.readFileSync(refFile).toString('base64')}"></body></html>`);
    const nat = await dp.evaluate(async () => { const i = /** @type {HTMLImageElement} */ (document.getElementById('r')); await i.decode().catch(() => {}); return { w: i.naturalWidth, h: i.naturalHeight }; });
    if (!nat.w || !nat.h) throw new UserError(`${refFile} could not be decoded as an image`);
    await dp.setViewportSize({ width: nat.w, height: nat.h });
    const refPng = await dp.locator('#r').screenshot({ type: 'png' });
    await dec.close();
    // capture the page at the reference's size
    const vp = opts.viewport ? /^(\d+)x(\d+)$/.exec(opts.viewport) : null;
    if (opts.viewport && !vp) throw new UserError('--viewport must look like 1440x900');
    const width = vp ? Number(vp[1]) : Math.round(nat.w / scale);
    const height = vp ? Number(vp[2]) : Math.round(nat.h / scale);
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    const route = opts.route ?? (opts.url ? '' : '/');
    const target = opts.url ? new URL(route || '', base).href : base.replace(/\/$/, '') + (route.startsWith('/') ? route : `/${route}`);
    const res = await page.goto(target, { waitUntil: 'load' });
    await page.evaluate(async () => { try { await document.fonts.ready; } catch { /* ignore */ } });
    await page.waitForTimeout(400);
    const pagePng = await page.screenshot({ type: 'png' });
    await ctx.close();
    const d = diffPngBuffers(tools, refPng, pagePng, opts.threshold ?? 0.1);
    const files = { reference: path.join(outDir, 'reference.png'), page: path.join(outDir, 'page.png'), diff: path.join(outDir, 'diff.png'), json: path.join(outDir, 'match.json'), md: path.join(outDir, 'match.md') };
    fs.writeFileSync(files.reference, refPng); fs.writeFileSync(files.page, pagePng); fs.writeFileSync(files.diff, tools.PNG.sync.write(d.diff));
    const refPal = palette(d.a); const pagePal = palette(d.b);
    const missing = refPal.filter((c) => c.share >= 0.02 && !pagePal.some((p) => deltaEOk(p.hex, c.hex) < 0.05));
    const grid = gridDiff(d.diff);
    let history = [];
    try { history = JSON.parse(fs.readFileSync(files.json, 'utf8')).history ?? []; } catch { /* first run */ }
    const similarity = Math.round((1 - d.ratio) * 10000) / 10000;
    history = [...history, { at: opts.now ?? new Date().toISOString(), similarity }].slice(-20);
    const result = {
      tool: 'maquettekit-review-match', target, status: res?.status() ?? null, reference: refFile,
      size: { reference: { width: nat.w, height: nat.h }, viewport: { width, height, scale } }, sizeMismatch: d.sizeChanged,
      similarity, changedPixels: d.changedPixels, grid: [...grid].sort((a, b) => b.ratio - a.ratio), palette: { reference: refPal, page: pagePal, missingFromPage: missing },
      history, previous: history.length > 1 ? history[history.length - 2].similarity : null, files,
    };
    fs.writeFileSync(files.json, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(files.md, renderMatchMd(result));
    return result;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) await server.close();
  }
}

/** @param {any} r */
export function renderMatchMd(r) {
  const pct = (x) => `${(x * 100).toFixed(1)} %`;
  const trend = r.previous == null ? '' : ` (previous run ${pct(r.previous)}, ${r.similarity >= r.previous ? '+' : ''}${((r.similarity - r.previous) * 100).toFixed(1)} points)`;
  return `${[
    '# Reference match', '',
    `Target: ${r.target} at ${r.size.viewport.width}×${r.size.viewport.height} @${r.size.viewport.scale}x · reference: \`${path.basename(r.reference)}\` (${r.size.reference.width}×${r.size.reference.height})`, '',
    `**Pixel similarity ${pct(r.similarity)}**${trend}.${r.sizeMismatch ? ' The capture and the reference differ in size; check --viewport/--scale.' : ''}`, '',
    '| Region | Pixels differing |', '| - | - |', ...r.grid.map((g) => `| ${g.region} | ${pct(g.ratio)} |`), '',
    `Reference palette: ${r.palette.reference.map((c) => `\`${c.hex}\` ${pct(c.share)}`).join(', ')}`,
    `Page palette: ${r.palette.page.map((c) => `\`${c.hex}\` ${pct(c.share)}`).join(', ')}`,
    r.palette.missingFromPage.length ? `Missing from the page: ${r.palette.missingFromPage.map((c) => `\`${c.hex}\``).join(', ')}` : 'Every main reference colour appears on the page.', '',
    'Fix the region with the largest difference first, then re-run. Pixel similarity rewards layout, colour and type size; it does not judge quality — finish with `maquettekit check`.',
  ].join('\n')}\n`;
}
