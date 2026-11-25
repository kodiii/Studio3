// @ts-check
/**
 * `maquettekit launch` — launch-readiness checks over HTTP, no browser: page metadata, social share images, icons,
 * crawler rules, not-found behaviour and page weight. Run it against the production build (a preview server or a
 * static export), not the dev server, which injects scripts and differs in headers and size.
 *
 * Only the target origin is fetched. Absolute URLs on another host (e.g. an og:image on the production domain while
 * checking localhost) are reported as "not checked here", never fetched.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from '../lib/args.mjs';
import { log, UserError } from '../lib/log.mjs';
import { serveStatic } from '../lib/static-server.mjs';

export const help = `maquettekit launch — launch-readiness checks (metadata, share images, icons, crawlers, 404, page weight)

Usage: maquettekit launch (--url <url> | --serve <dir>) [--routes /,/pricing] [--budget-kb 1500] [--allow-noindex]
                          [--out .maquettekit/launch] [--json]

Checks each route over HTTP (no browser): <title> and meta description (present, sensible length, not shared
between routes), <html lang>, viewport, canonical, one <h1>, Open Graph (og:title, og:description, og:image reachable
and at least 1200×630) and twitter:card, favicon and apple-touch icon, robots meta (noindex), robots.txt (blocks
everything?) and sitemap, a missing page answering 404 (not a "soft 404"), and page weight against --budget-kb (HTML +
same-origin CSS, JS and images it references). Use the production build. Exit codes: 0 no major findings, 1 major
findings, 2 usage error.`;

const SEV = { major: 0, minor: 1, info: 2 };

/** Pixel size of a PNG, JPEG, GIF or WebP from its bytes (null when unknown). @param {Buffer} b */
export function imageSize(b) {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { type: 'png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.length > 10 && b.toString('ascii', 0, 3) === 'GIF') return { type: 'gif', width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
  if (b.length > 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = b.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { type: 'webp', width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    if (chunk === 'VP8 ') return { type: 'webp', width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') { const bits = b.readUInt32LE(21); return { type: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }; }
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { type: 'jpeg', width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

/** Minimal head/body extraction with regexes (enough for meta tags; not a full HTML parser). @param {string} html */
export function parseHtml(html) {
  const attr = (tag, name) => new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag)?.slice(1).find((x) => x !== undefined) ?? null;
  const tags = (name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((m) => m[0]);
  const metas = tags('meta').map((t) => ({ name: (attr(t, 'name') ?? attr(t, 'property') ?? '').toLowerCase(), content: attr(t, 'content') }));
  const meta = (n) => metas.find((m) => m.name === n)?.content ?? null;
  const links = tags('link').map((t) => ({ rel: (attr(t, 'rel') ?? '').toLowerCase(), href: attr(t, 'href'), sizes: attr(t, 'sizes') }));
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1].replace(/\s+/g, ' ').trim() ?? null;
  const htmlTag = /<html\b[^>]*>/i.exec(html)?.[0] ?? '';
  return {
    title, lang: attr(htmlTag, 'lang'), meta, links,
    h1: (html.match(/<h1\b/gi) ?? []).length,
    scripts: tags('script').map((t) => attr(t, 'src')).filter(Boolean),
    stylesheets: links.filter((l) => l.rel.split(/\s+/).includes('stylesheet')).map((l) => l.href).filter(Boolean),
    images: tags('img').filter((t) => !/\bloading\s*=\s*["']?lazy/i.test(t)).map((t) => attr(t, 'src')).filter((s) => s && !s.startsWith('data:')),
  };
}

/**
 * @param {{ url?: string, serve?: string, routes?: string[], budgetKb?: number, allowNoindex?: boolean, out?: string, fetchImpl?: typeof fetch }} opts
 */
export async function runLaunch(opts) {
  if (!opts.url && !opts.serve) throw new UserError('launch needs a target: --url <url> or --serve <dir> (use the production build)');
  if (opts.url && opts.serve) throw new UserError('Use either --url or --serve, not both.');
  const doFetch = opts.fetchImpl ?? fetch;
  let server = null; let origin; let routes = opts.routes?.length ? opts.routes : null;
  if (opts.serve) {
    const dir = path.resolve(opts.serve);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new UserError(`--serve: "${dir}" is not a directory`);
    server = await serveStatic(dir);
    origin = server.url;
    routes ??= ['/'];
  } else {
    let u; try { u = new URL(String(opts.url)); } catch { throw new UserError(`--url: "${opts.url}" is not a valid URL`); }
    if (!/^https?:$/.test(u.protocol)) throw new UserError('--url must be http(s)');
    origin = u.origin; routes ??= [`${u.pathname}${u.search}` || '/'];
  }
  const budgetKb = opts.budgetKb ?? 1500;
  /** @type {any[]} */ const issues = [];
  /** @type {any[]} */ const pages = [];
  const add = (severity, check, route, message, evidence = {}) => issues.push({ severity, check, route, message, evidence });
  const sameOrigin = (u) => { try { return new URL(u, origin).origin === origin; } catch { return false; } };
  const get = async (u, method = 'GET') => {
    try {
      const r = await doFetch(new URL(u, origin), { method, redirect: 'follow', headers: { 'user-agent': 'maquettekit-launch-check' } });
      const body = method === 'HEAD' ? Buffer.alloc(0) : Buffer.from(await r.arrayBuffer());
      return { status: r.status, type: r.headers.get('content-type') ?? '', length: Number(r.headers.get('content-length') ?? body.length) || body.length, body };
    } catch (err) { return { status: 0, type: '', length: 0, body: Buffer.alloc(0), error: String(/** @type {any} */ (err).message) }; }
  };
  const sizeCache = new Map();
  const sizeOf = async (u) => { const k = new URL(u, origin).href; if (!sizeCache.has(k)) sizeCache.set(k, (await get(k)).length); return sizeCache.get(k); };

  try {
    for (const route of routes) {
      const res = await get(route);
      if (res.status !== 200) { add('major', 'page-status', route, `${route} answered HTTP ${res.status || 'error'}${res.error ? ` (${res.error})` : ''}.`); continue; }
      const html = res.body.toString('utf8');
      const p = parseHtml(html);
      const page = { route, title: p.title, description: p.meta('description'), weightKb: 0, og: {} };
      // metadata
      if (!p.title) add('major', 'title', route, 'No <title>.');
      else if (p.title.length < 10 || p.title.length > 65) add('minor', 'title', route, `<title> is ${p.title.length} characters ("${p.title.slice(0, 70)}"); 10–65 shows in full in search results and tabs.`);
      const desc = p.meta('description');
      if (!desc) add('major', 'meta-description', route, 'No <meta name="description">; search results and link previews will invent one.');
      else if (desc.length < 50 || desc.length > 170) add('minor', 'meta-description', route, `Meta description is ${desc.length} characters; aim for 50–170.`);
      if (!p.lang) add('major', 'lang', route, '<html> has no lang attribute (screen readers and translation guess the language).');
      const vp = p.meta('viewport');
      if (!vp || !/width\s*=\s*device-width/i.test(vp)) add('major', 'viewport', route, 'No <meta name="viewport" content="width=device-width, initial-scale=1">.');
      const canonical = p.links.find((l) => l.rel === 'canonical')?.href;
      if (!canonical) add('minor', 'canonical', route, 'No <link rel="canonical">; duplicate URLs (query strings, trailing slashes) split ranking.');
      else if (!/^https?:\/\//.test(canonical)) add('minor', 'canonical', route, `Canonical URL "${canonical}" is not absolute.`);
      if (p.h1 !== 1) add('minor', 'h1', route, `${p.h1} <h1> elements; use exactly one per page.`);
      const robots = p.meta('robots') ?? '';
      if (/noindex/i.test(robots) && !opts.allowNoindex) add('major', 'noindex', route, `<meta name="robots" content="${robots}"> keeps this page out of search results.`);
      // social
      for (const k of ['og:title', 'og:description', 'og:image']) page.og[k] = p.meta(k);
      if (!page.og['og:title']) add('minor', 'open-graph', route, 'No og:title (link previews fall back to <title>).');
      if (!page.og['og:description']) add('minor', 'open-graph', route, 'No og:description.');
      if (!p.meta('twitter:card')) add('minor', 'twitter-card', route, 'No twitter:card (use "summary_large_image" with a 1200×630 image).');
      const og = page.og['og:image'];
      if (!og) add('major', 'og-image', route, 'No og:image: shared links show no picture. Add a 1200×630 image (≤ 1 MB).');
      else if (!sameOrigin(og)) add('info', 'og-image', route, `og:image is on another host (${og}); not fetched here — check it after deploying.`, { url: og });
      else {
        const img = await get(og);
        const size = img.status === 200 ? imageSize(img.body) : null;
        page.og.image = { status: img.status, type: img.type, bytes: img.length, ...(size ?? {}) };
        if (img.status !== 200) add('major', 'og-image', route, `og:image ${og} answered HTTP ${img.status || 'error'}.`);
        else if (!/^image\//.test(img.type) && !size) add('major', 'og-image', route, `og:image ${og} is not an image (${img.type || 'unknown type'}).`);
        else {
          if (size && (size.width < 1200 || size.height < 630)) add('minor', 'og-image', route, `og:image is ${size.width}×${size.height}; 1200×630 or larger renders sharply everywhere.`, size);
          if (img.length > 1_000_000) add('minor', 'og-image', route, `og:image is ${Math.round(img.length / 1024)} KB; some platforms drop images over 1 MB (aim for ≤ 300 KB).`);
          if (!/^https?:\/\//.test(og)) add('minor', 'og-image', route, `og:image "${og}" is relative; crawlers need an absolute URL.`);
        }
      }
      // icons
      const icon = p.links.find((l) => /(^|\s)icon(\s|$)/.test(l.rel))?.href;
      const iconRes = await get(icon ?? '/favicon.ico', 'GET');
      if (iconRes.status !== 200) add('major', 'favicon', route, icon ? `Favicon ${icon} answered HTTP ${iconRes.status || 'error'}.` : 'No <link rel="icon"> and no /favicon.ico.');
      if (!p.links.some((l) => l.rel === 'apple-touch-icon')) add('minor', 'apple-touch-icon', route, 'No <link rel="apple-touch-icon"> (180×180) for home-screen bookmarks.');
      // page weight (same-origin resources the HTML references directly; lazy images excluded)
      let bytes = res.length; let jsBytes = 0;
      for (const s of p.scripts) if (sameOrigin(s)) { const n = await sizeOf(s); bytes += n; jsBytes += n; }
      for (const s of [...p.stylesheets, ...p.images]) if (sameOrigin(s)) bytes += await sizeOf(s);
      page.weightKb = Math.round(bytes / 1024); page.jsKb = Math.round(jsBytes / 1024);
      if (page.weightKb > budgetKb) add('minor', 'page-weight', route, `Initial page weight ${page.weightKb} KB (uncompressed: HTML, CSS, scripts, eager images) is over the ${budgetKb} KB budget.`, { weightKb: page.weightKb, jsKb: page.jsKb });
      if (page.jsKb > 500) add('minor', 'page-weight', route, `${page.jsKb} KB of JavaScript loads with the page (uncompressed); split or defer what the first view does not need.`, { jsKb: page.jsKb });
      pages.push(page);
    }
    // the same title or description on several routes is one site-wide string, not one written for each page
    for (const [key, check, label] of /** @type {const} */ ([['title', 'title', '<title>'], ['description', 'meta-description', 'meta description']])) {
      /** @type {Map<string, string[]>} */ const byText = new Map();
      for (const pg of pages) if (pg[key]) byText.set(pg[key], [...(byText.get(pg[key]) ?? []), pg.route]);
      for (const [text, shared] of byText) {
        if (shared.length > 1) add('minor', check, null, `${shared.length} routes share one ${label} (${shared.join(', ')}): "${text.slice(0, 80)}". Write one for each page; search results and link previews show it.`, { routes: shared });
      }
    }
    // site-wide
    const robotsTxt = await get('/robots.txt');
    const robotsText = robotsTxt.status === 200 ? robotsTxt.body.toString('utf8') : '';
    if (robotsTxt.status !== 200) add('minor', 'robots-txt', null, 'No /robots.txt.');
    else if (/^\s*user-agent:\s*\*\s*$[\s\S]*?^\s*disallow:\s*\/\s*$/im.test(robotsText) && !opts.allowNoindex) add('major', 'robots-txt', null, 'robots.txt disallows everything for all crawlers ("Disallow: /"). Fine for staging, wrong for launch.');
    const sitemapUrl = /^\s*sitemap:\s*(\S+)/im.exec(robotsText)?.[1] ?? '/sitemap.xml';
    const sitemap = sameOrigin(sitemapUrl) ? await get(sitemapUrl) : null;
    if (sitemap && sitemap.status !== 200) add('minor', 'sitemap', null, `No sitemap at ${sitemapUrl}.`);
    const probe = `/maquettekit-launch-check-${Date.now().toString(36)}`;
    const nf = await get(probe);
    if (nf.status === 200) add('major', 'not-found', null, `A page that does not exist (${probe}) answers HTTP 200: a "soft 404" that search engines index and users cannot recognise.`);
    else if (nf.status === 404 && !/<a\b[^>]*href\s*=\s*["']\/?["']/i.test(nf.body.toString('utf8'))) add('minor', 'not-found', null, 'The 404 page has no link back to the home page.');
  } finally {
    if (server) await server.close();
  }
  issues.sort((a, b) => SEV[a.severity] - SEV[b.severity] || String(a.route).localeCompare(String(b.route)));
  const summary = { major: 0, minor: 0, info: 0 };
  for (const i of issues) summary[i.severity]++;
  const result = { tool: 'maquettekit-launch', origin, routes, budgetKb, pages, summary, issues };
  const outDir = path.resolve(opts.out ?? '.maquettekit/launch');
  fs.mkdirSync(outDir, { recursive: true });
  const files = { json: path.join(outDir, 'launch.json'), md: path.join(outDir, 'launch.md') };
  fs.writeFileSync(files.json, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(files.md, renderLaunchMd(result));
  return { result, files };
}

/** @param {any} r */
export function renderLaunchMd(r) {
  const L = ['# Launch readiness', '', `Target: ${r.origin} · routes: ${r.routes.join(', ')} · page-weight budget: ${r.budgetKb} KB`, '',
    `**${r.summary.major} major, ${r.summary.minor} minor, ${r.summary.info} info.**`, ''];
  if (r.issues.length) {
    L.push('| Severity | Check | Route | Finding |', '| - | - | - | - |');
    for (const i of r.issues) L.push(`| ${i.severity} | \`${i.check}\` | ${i.route ?? 'site'} | ${i.message.replace(/\|/g, '\\|')} |`);
    L.push('');
  }
  L.push('| Route | Title | Weight | og:image |', '| - | - | - | - |');
  for (const p of r.pages) L.push(`| ${p.route} | ${(p.title ?? '—').replace(/\|/g, '\\|')} | ${p.weightKb} KB (${p.jsKb} KB JS) | ${p.og.image ? `${p.og.image.width ?? '?'}×${p.og.image.height ?? '?'}, ${Math.round(p.og.image.bytes / 1024)} KB` : p.og['og:image'] ? 'not fetched' : 'none'} |`);
  L.push('', 'Measured over HTTP without a browser: weights are uncompressed bytes of what the HTML references directly; run `maquettekit check` for rendering, accessibility and layout.');
  return `${L.join('\n')}\n`;
}

/** @param {string[]} argv */
export async function main(argv) {
  const a = parseArgs(argv, { boolean: ['json', 'allow-noindex', 'help'] });
  const list = (v) => (typeof v === 'string' ? v.split(',').map((x) => x.trim()).filter(Boolean) : undefined);
  const budget = a['budget-kb'] === undefined ? undefined : Number(a['budget-kb']);
  if (budget !== undefined && !(budget > 0)) throw new UserError('--budget-kb must be a positive number');
  const { result, files } = await runLaunch({ url: typeof a.url === 'string' ? a.url : undefined, serve: typeof a.serve === 'string' ? a.serve : undefined, routes: list(a.routes), budgetKb: budget, allowNoindex: !!a['allow-noindex'], out: typeof a.out === 'string' ? a.out : undefined });
  if (a.json) console.log(JSON.stringify(result, null, 2));
  for (const i of result.issues.slice(0, 30)) log.info(`  ${i.severity.padEnd(5)} ${String(i.route ?? 'site').padEnd(12)} ${i.message}`);
  log[result.summary.major ? 'warn' : 'ok'](`${result.summary.major} major, ${result.summary.minor} minor, ${result.summary.info} info → ${files.md}`);
  if (!a.json) console.log(files.md);
  return result.summary.major ? 1 : 0;
}
