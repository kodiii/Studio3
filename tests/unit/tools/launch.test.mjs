// @ts-check
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { imageSize, parseHtml, runLaunch, renderLaunchMd } from '../../../plugins/maquettekit/tools/launch/index.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'maquettekit-launch-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

/** A PNG whose IHDR says width × height (enough for size sniffing). */
function pngHeader(w, h) {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8); b.write('IHDR', 12, 'ascii'); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20);
  return b;
}
function site(name, files) {
  const dir = path.join(tmp, name);
  for (const [rel, body] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), body); }
  return dir;
}
const GOOD_HEAD = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Ebbline — tide tables your crew can trust</title>
<meta name="description" content="Ebbline turns harbour data into one shared schedule for launches, moorings and maintenance windows.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="https://ebbline.example/">
<meta property="og:title" content="Ebbline"><meta property="og:description" content="Tide tables your crew can trust.">
<meta property="og:image" content="/og.png"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/app.css"></head><body><h1>Tide tables</h1><script src="/app.js"></script></body></html>`;

describe('helpers', () => {
  it('reads image sizes from PNG, GIF, JPEG and WebP headers', () => {
    expect(imageSize(pngHeader(1200, 630))).toEqual({ type: 'png', width: 1200, height: 630 });
    const gif = Buffer.alloc(16); gif.write('GIF89a', 0, 'ascii'); gif.writeUInt16LE(64, 6); gif.writeUInt16LE(32, 8);
    expect(imageSize(gif)).toEqual({ type: 'gif', width: 64, height: 32 });
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x76, 0x04, 0xb0, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(imageSize(jpeg)).toEqual({ type: 'jpeg', width: 1200, height: 630 });
    const webp = Buffer.alloc(40); webp.write('RIFF', 0, 'ascii'); webp.write('WEBP', 8, 'ascii'); webp.write('VP8X', 12, 'ascii'); webp.writeUIntLE(1199, 24, 3); webp.writeUIntLE(629, 27, 3);
    expect(imageSize(webp)).toEqual({ type: 'webp', width: 1200, height: 630 });
    expect(imageSize(Buffer.from('not an image'))).toBeNull();
  });

  it('parses the head metadata it needs', () => {
    const p = parseHtml(GOOD_HEAD.replace('<img', '<img'));
    expect(p.title).toBe('Ebbline — tide tables your crew can trust');
    expect(p.lang).toBe('en');
    expect(p.meta('og:image')).toBe('/og.png');
    expect(p.h1).toBe(1);
    expect(p.scripts).toEqual(['/app.js']);
    // legacy polyfills that modern browsers skip are not page weight; a file merely named "nomodule" still counts
    const legacy = parseHtml('<script src="/polyfills.js" noModule=""></script><script nomodule src="/p2.js"></script><script src="/nomodule.js"></script><script type="module" src="/m.js"></script>');
    expect(legacy.scripts).toEqual(['/nomodule.js', '/m.js']);
    expect(p.stylesheets).toEqual(['/app.css']);
  });
});

describe('launch checks against a served site', () => {
  it('a launch-ready static site has no major findings', async () => {
    const dir = site('good', {
      'index.html': GOOD_HEAD, 'og.png': pngHeader(1200, 630), 'favicon.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>', 'apple-touch-icon.png': pngHeader(180, 180),
      'app.css': 'body{margin:0}', 'app.js': 'console.log(1)', 'robots.txt': 'User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n', 'sitemap.xml': '<urlset/>',
      '404.html': '<!doctype html><html lang="en"><title>Not found</title><h1>Not found</h1><a href="/">Home</a></html>',
    });
    const { result, files } = await runLaunch({ serve: dir, out: path.join(dir, '.out') });
    expect(result.summary.major, JSON.stringify(result.issues, null, 1)).toBe(0);
    expect(result.issues.map((i) => i.check)).toEqual(['og-image']); // the only nit: og:image should be an absolute URL
    expect(result.pages[0].og.image).toMatchObject({ status: 200, width: 1200, height: 630 });
    expect(fs.readFileSync(files.md, 'utf8')).toMatch(/0 major, 1 minor/);
  });

  it('flags missing metadata, a blocking robots.txt, noindex, a missing favicon and a small share image', async () => {
    const dir = site('bad', {
      'index.html': '<!doctype html><html><head><meta name="robots" content="noindex"><meta property="og:image" content="/og.png"></head><body><h1>A</h1><h1>B</h1></body></html>',
      'og.png': pngHeader(600, 315), 'robots.txt': 'User-agent: *\nDisallow: /\n',
    });
    const { result } = await runLaunch({ serve: dir, out: path.join(dir, '.out') });
    const majors = result.issues.filter((i) => i.severity === 'major').map((i) => i.check).sort();
    expect(majors).toEqual(['favicon', 'lang', 'meta-description', 'noindex', 'robots-txt', 'title', 'viewport']);
    expect(result.issues.find((i) => i.check === 'og-image' && i.severity === 'minor' && /600×315/.test(i.message))).toBeTruthy();
    expect(result.issues.find((i) => i.check === 'h1')?.message).toMatch(/2 <h1>/);
    expect(result.issues.find((i) => i.check === 'not-found' && /no link back/.test(i.message))).toBeTruthy();
    const allowed = await runLaunch({ serve: dir, out: path.join(dir, '.out2'), allowNoindex: true });
    expect(allowed.result.issues.some((i) => i.check === 'noindex' || i.check === 'robots-txt' && i.severity === 'major')).toBe(false);
  });

  it('flags a title or description shared between routes, once, naming the routes', async () => {
    const assets = { 'og.png': pngHeader(1200, 630), 'favicon.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>', 'apple-touch-icon.png': pngHeader(180, 180), 'app.css': '', 'app.js': '' };
    const pricing = GOOD_HEAD.replace('<title>Ebbline — tide tables your crew can trust</title>', '<title>Pricing — Ebbline plans for every crew</title>');
    const dir = site('shared', { ...assets, 'index.html': GOOD_HEAD, 'pricing.html': pricing, 'about.html': pricing.replace('Pricing — Ebbline plans', 'About — Ebbline people') });
    const { result } = await runLaunch({ serve: dir, routes: ['/', '/pricing.html', '/about.html'], out: path.join(dir, '.out') });
    const shared = result.issues.filter((i) => i.route === null && (i.check === 'meta-description' || i.check === 'title'));
    expect(shared).toHaveLength(1); // three distinct titles, one description on all three routes
    expect(shared[0]).toMatchObject({ severity: 'minor', check: 'meta-description', evidence: { routes: ['/', '/pricing.html', '/about.html'] } });
    expect(shared[0].message).toMatch(/3 routes share one meta description/);
  });

  it('reports a soft 404 and never fetches other hosts', async () => {
    const requested = [];
    const fetchImpl = /** @type {any} */ (async (u) => {
      requested.push(String(u));
      const body = String(u).endsWith('/og.png') ? pngHeader(1200, 630) : Buffer.from('<html lang="en"><title>Same page for every URL</title><h1>x</h1></html>');
      return new Response(body, { status: 200, headers: { 'content-type': String(u).endsWith('.png') ? 'image/png' : 'text/html' } });
    });
    const html = GOOD_HEAD.replace('content="/og.png"', 'content="https://cdn.elsewhere.example/og.png"');
    const fetchWithPage = /** @type {any} */ (async (u, init) => (new URL(String(u)).pathname === '/' ? new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }) : fetchImpl(u, init)));
    const { result } = await runLaunch({ url: 'http://localhost:9/', fetchImpl: fetchWithPage, out: path.join(tmp, 'soft') });
    expect(result.issues.find((i) => i.check === 'not-found')).toMatchObject({ severity: 'major' });
    expect(result.issues.find((i) => i.check === 'og-image')).toMatchObject({ severity: 'info' });
    expect(requested.every((u) => u.startsWith('http://localhost:9/'))).toBe(true);
    expect(renderLaunchMd(result)).toMatch(/soft 404/);
  });

  it('rejects bad usage', async () => {
    await expect(runLaunch({})).rejects.toThrow(/needs a target/);
    await expect(runLaunch({ url: 'ftp://x' })).rejects.toThrow(/http/);
  });
});
