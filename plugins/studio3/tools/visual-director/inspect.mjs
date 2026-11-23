// @ts-check
/** `review inspect` (Stage 1) — static project inspection, no browser. */
import fs from 'node:fs';
import path from 'node:path';
import { UserError } from '../lib/log.mjs';
import { TOOL, toolVersion, readJson, listFiles } from './util.mjs';

const exists = (dir, ...names) => names.find((n) => fs.existsSync(path.join(dir, n))) ?? null;
const SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'out', '.studio3', '.svelte-kit', '.nuxt', '.astro', 'coverage', '.turbo', '.vercel']);

/** @param {string} dir @param {number} depth @param {(rel:string)=>boolean} filter @param {number} cap */
function walk(dir, depth, filter, cap = 400) {
  /** @type {string[]} */ const out = [];
  const rec = (d, rel, lvl) => {
    if (out.length >= cap || lvl > depth) return;
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (SKIP.has(e.name) || e.name.startsWith('.')) continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) rec(path.join(d, e.name), r, lvl + 1);
      else if (filter(r) && out.length < cap) out.push(r);
    }
  };
  rec(dir, '', 0);
  return out.sort();
}

/** @param {string} dir */
export function inspectProject(dir) {
  const root = path.resolve(dir);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new UserError(`inspect: "${root}" is not a directory`);
  const pkg = readJson(path.join(root, 'package.json'));
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}), ...(pkg?.peerDependencies ?? {}) };
  const has = (n) => Object.prototype.hasOwnProperty.call(deps, n);
  const ver = (n) => (has(n) ? String(deps[n]) : null);
  const major = (v) => { const m = /(\d+)/.exec(v ?? ''); return m ? Number(m[1]) : null; };
  /** @type {string[]} */ const notes = [];
  if (!pkg) notes.push('No package.json found — treating the directory as a plain static site.');

  // ---- framework -------------------------------------------------------------
  /** @type {{ name: string, version: string | null, evidence: string[] }} */
  let framework = { name: 'unknown', version: null, evidence: [] };
  const cfg = (...n) => exists(root, ...n);
  const fw = [
    ['next', () => has('next') || cfg('next.config.js', 'next.config.mjs', 'next.config.ts'), 'next'],
    ['remix', () => has('@remix-run/react') || has('@remix-run/dev') || cfg('remix.config.js'), '@remix-run/react'],
    ['astro', () => has('astro') || cfg('astro.config.mjs', 'astro.config.ts', 'astro.config.js'), 'astro'],
    ['nuxt', () => has('nuxt') || cfg('nuxt.config.ts', 'nuxt.config.js'), 'nuxt'],
    ['sveltekit', () => has('@sveltejs/kit') || cfg('svelte.config.js'), '@sveltejs/kit'],
    ['vite', () => has('vite') || cfg('vite.config.js', 'vite.config.ts', 'vite.config.mjs'), 'vite'],
  ];
  for (const [name, test, dep] of /** @type {[string, () => any, string][]} */ (fw)) {
    const hit = test();
    if (hit) { framework = { name, version: ver(dep), evidence: [has(dep) ? `dependency ${dep}` : `config file ${hit}`] }; break; }
  }
  const htmlFiles = walk(root, 2, (r) => r.endsWith('.html'), 60);
  if (framework.name === 'unknown' && htmlFiles.length) framework = { name: 'plain-html', version: null, evidence: [`${htmlFiles.length} .html file(s)`] };
  const ui = has('react') ? 'react' : has('vue') ? 'vue' : has('svelte') ? 'svelte' : has('solid-js') ? 'solid' : has('preact') ? 'preact' : null;

  // ---- styling ---------------------------------------------------------------
  const cssFiles = walk(root, 4, (r) => /\.(css|scss|sass|less)$/.test(r), 300);
  /** @type {any[]} */ const styling = [];
  if (has('tailwindcss') || cfg('tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.mjs', 'tailwind.config.cjs')) {
    let v = major(ver('tailwindcss'));
    if (v == null) v = has('@tailwindcss/vite') || has('@tailwindcss/postcss') ? 4 : cfg('tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.mjs', 'tailwind.config.cjs') ? 3 : null;
    styling.push({ name: 'tailwind', version: ver('tailwindcss'), major: v });
  }
  if (cssFiles.some((f) => /\.module\.(css|scss|sass|less)$/.test(f))) styling.push({ name: 'css-modules' });
  for (const [dep, name] of [['styled-components', 'styled-components'], ['@emotion/react', 'emotion'], ['@emotion/styled', 'emotion'], ['@vanilla-extract/css', 'vanilla-extract'], ['@stitches/react', 'stitches'], ['sass', 'sass'], ['less', 'less'], ['@pandacss/dev', 'panda-css'], ['unocss', 'unocss']]) {
    if (has(dep) && !styling.some((s) => s.name === name)) styling.push({ name, version: ver(dep) });
  }
  if (!styling.length && cssFiles.length) styling.push({ name: 'plain-css', files: cssFiles.length });

  // ---- animation / 3D --------------------------------------------------------
  const pick = (list) => list.filter(([d]) => has(d)).map(([d, name]) => ({ name, package: d, version: ver(d) }));
  const animation = pick([['motion', 'motion'], ['framer-motion', 'framer-motion'], ['gsap', 'gsap'], ['@gsap/react', 'gsap-react'], ['lottie-web', 'lottie'], ['lottie-react', 'lottie'], ['@lottiefiles/dotlottie-react', 'lottie'], ['@lottiefiles/dotlottie-web', 'lottie'], ['animejs', 'animejs'], ['@react-spring/web', 'react-spring'], ['lenis', 'lenis'], ['@studio-freight/lenis', 'lenis'], ['@rive-app/react-canvas', 'rive']]);
  const threeD = pick([['three', 'three'], ['@react-three/fiber', 'react-three-fiber'], ['@react-three/drei', 'drei'], ['@react-three/rapier', 'rapier'], ['@dimforge/rapier3d-compat', 'rapier'], ['@react-three/postprocessing', 'postprocessing'], ['@splinetool/react-spline', 'spline'], ['@splinetool/runtime', 'spline'], ['@babylonjs/core', 'babylon'], ['ogl', 'ogl'], ['@threlte/core', 'threlte']]);
  const modelFiles = walk(root, 4, (r) => /\.(glb|gltf|usdz|ktx2|hdr|exr)$/i.test(r), 60);

  // ---- routes ----------------------------------------------------------------
  /** @type {{ route: string, file: string }[]} */ const routes = [];
  /** @type {string | null} */ let routeSource = null;
  const pageExt = /\.(tsx|jsx|ts|js|mdx|astro|vue|svelte)$/;
  const cleanSeg = (segs) => segs.filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith('@'));
  for (const base of ['app', 'src/app']) {
    if (framework.name !== 'next' || !fs.existsSync(path.join(root, base))) continue;
    routeSource ??= `${base}/ (Next.js App Router)`;
    for (const f of walk(path.join(root, base), 6, (r) => /(^|\/)page\.(tsx|jsx|ts|js|mdx)$/.test(r))) {
      const segs = cleanSeg(f.split('/').slice(0, -1));
      routes.push({ route: '/' + segs.join('/'), file: `${base}/${f}` });
    }
  }
  for (const base of ['pages', 'src/pages']) {
    if (!['next', 'astro', 'nuxt'].includes(framework.name) || !fs.existsSync(path.join(root, base))) continue;
    routeSource ??= `${base}/ (file-based pages)`;
    for (const f of walk(path.join(root, base), 5, (r) => pageExt.test(r) && !/(^|\/)(_app|_document|_error|api\/)/.test(r) && !r.startsWith('api/'))) {
      let r = f.replace(pageExt, '').replace(/(^|\/)index$/, '');
      routes.push({ route: '/' + r, file: `${base}/${f}` });
    }
  }
  if (framework.name === 'sveltekit' && fs.existsSync(path.join(root, 'src/routes'))) {
    routeSource = 'src/routes/ (SvelteKit)';
    for (const f of walk(path.join(root, 'src/routes'), 6, (r) => /(^|\/)\+page\.svelte$/.test(r))) routes.push({ route: '/' + cleanSeg(f.split('/').slice(0, -1)).join('/'), file: `src/routes/${f}` });
  }
  if (framework.name === 'remix' && fs.existsSync(path.join(root, 'app/routes'))) {
    routeSource = 'app/routes/ (Remix)';
    for (const f of walk(path.join(root, 'app/routes'), 3, (r) => pageExt.test(r))) { const n = f.replace(pageExt, '').replace(/\./g, '/').replace(/(^|\/)_index$/, ''); routes.push({ route: '/' + n, file: `app/routes/${f}` }); }
  }
  if (!routes.length && htmlFiles.length) {
    routeSource = 'static .html files';
    for (const f of htmlFiles) routes.push({ route: f === 'index.html' ? '/' : f.endsWith('/index.html') ? '/' + f.slice(0, -'index.html'.length) : '/' + f, file: f });
  }
  const dynamicRoutes = routes.filter((r) => /\[|\$|:/.test(r.route)).length;
  routes.sort((a, b) => a.route.localeCompare(b.route));

  // ---- scripts ---------------------------------------------------------------
  const scripts = pkg?.scripts ?? {};
  const scriptPick = Object.fromEntries(['dev', 'start', 'build', 'preview', 'serve', 'test', 'lint', 'typecheck'].filter((k) => scripts[k]).map((k) => [k, scripts[k]]));
  const pm = exists(root, 'pnpm-lock.yaml') ? 'pnpm' : exists(root, 'yarn.lock') ? 'yarn' : exists(root, 'bun.lockb', 'bun.lock') ? 'bun' : exists(root, 'package-lock.json') ? 'npm' : pkg ? 'npm' : null;
  const runCmd = (s) => (pm === 'npm' ? `npm run ${s}` : `${pm} ${s}`);
  const devCommand = scripts.dev ? runCmd('dev') : scripts.start ? runCmd('start') : null;
  const reviewHint = devCommand ? `Start the app (${devCommand}) and run: studio3 review run --url http://localhost:<port> --routes ${routes.filter((r) => !/\[|\$|:/.test(r.route)).slice(0, 4).map((r) => r.route).join(',') || '/'}`
    : framework.name === 'plain-html' ? `studio3 review run --serve ${path.relative(process.cwd(), root) || '.'}` : null;

  // ---- design file -----------------------------------------------------------
  const designPath = path.join(root, 'studio3.design.json');
  const designRaw = fs.existsSync(designPath) ? readJson(designPath, undefined) : null;
  const design = { present: fs.existsSync(designPath), path: fs.existsSync(designPath) ? 'studio3.design.json' : null, valid: designRaw === null ? null : designRaw !== undefined, specialty: designRaw?.specialty ?? designRaw?.meta?.specialty ?? null };

  // ---- specialty heuristic ---------------------------------------------------
  const kwText = [pkg?.name, pkg?.description, ...(pkg?.keywords ?? []), ...Object.keys(deps)].filter(Boolean).join(' ').toLowerCase();
  /** @type {Record<string, { score: number, signals: string[] }>} */
  const sc = { product: { score: 0, signals: [] }, cinematic: { score: 0, signals: [] }, data: { score: 0, signals: [] }, social: { score: 0, signals: [] }, '3d': { score: 0, signals: [] } };
  const add = (k, n, why) => { sc[k].score += n; sc[k].signals.push(why); };
  if (threeD.length) add('3d', 3 + Math.min(2, threeD.length - 1), `3D libraries: ${threeD.map((t) => t.name).join(', ')}`);
  if (modelFiles.length) add('3d', 2, `${modelFiles.length} model/texture asset(s)`);
  if (animation.some((a) => /gsap|lenis|lottie|rive/.test(a.name))) add('cinematic', 2, `scroll/timeline animation libraries: ${animation.filter((a) => /gsap|lenis|lottie|rive/.test(a.name)).map((a) => a.name).join(', ')}`);
  if (/\b(landing|campaign|story|portfolio|showcase|cinematic|launch)\b/.test(kwText)) add('cinematic', 2, 'keywords suggest a landing/story site');
  for (const d of ['recharts', 'd3', 'chart.js', '@visx/visx', '@nivo/core', 'echarts', 'victory', '@tanstack/react-table', 'ag-grid-react', 'plotly.js', '@observablehq/plot']) if (has(d)) add('data', 2, `dependency ${d}`);
  if (/\b(dashboard|analytics|admin|metrics|chart|report)\b/.test(kwText)) add('data', 2, 'keywords suggest dashboards/analytics');
  for (const d of ['stripe', '@stripe/stripe-js', '@clerk/nextjs', 'next-auth', '@auth/core', '@supabase/supabase-js', '@radix-ui/react-dialog', 'react-hook-form', '@tanstack/react-query', 'zod']) if (has(d)) add('product', 1, `dependency ${d}`);
  if (/\b(saas|app|product|pricing|checkout|ecommerce|shop|store)\b/.test(kwText)) add('product', 2, 'keywords suggest a product/app UI');
  for (const d of ['remotion', '@remotion/cli', 'satori', '@vercel/og', 'html-to-image', 'html2canvas']) if (has(d)) add('social', 2, `dependency ${d}`);
  if (/\b(social|og-image|opengraph|story|reel|post|banner|thumbnail)\b/.test(kwText)) add('social', 1, 'keywords suggest social/shareable assets');
  const ranked = Object.entries(sc).sort((a, b) => b[1].score - a[1].score);
  const [top, second] = ranked;
  const specialty = {
    heuristic: true, note: 'Heuristic guess from dependencies and keywords — confirm with the user or studio3.design.json.',
    likely: design.specialty ?? (top[1].score > 0 ? top[0] : 'product'),
    confidence: design.specialty ? 'declared' : top[1].score === 0 ? 'low' : top[1].score - second[1].score >= 3 ? 'high' : top[1].score - second[1].score >= 1 ? 'medium' : 'low',
    scores: Object.fromEntries(ranked.map(([k, v]) => [k, v])),
  };
  if (!design.specialty && top[1].score === 0) notes.push('No specialty signals found; defaulting to "product" with low confidence.');
  if (dynamicRoutes) notes.push(`${dynamicRoutes} dynamic route(s) need concrete parameters before they can be reviewed.`);

  return {
    tool: TOOL, version: toolVersion(), stage: 'inspect', generatedAt: new Date().toISOString(), dir: root,
    package: pkg ? { name: pkg.name ?? null, version: pkg.version ?? null, packageManager: pm, type: pkg.type ?? null } : null,
    framework: { ...framework, ui, typescript: has('typescript') || !!cfg('tsconfig.json') },
    styling, animation, threeD: { libraries: threeD, assets: modelFiles.slice(0, 30), assetCount: modelFiles.length },
    routes: { source: routeSource, count: routes.length, dynamic: dynamicRoutes, list: routes.slice(0, 100) },
    design, specialty, scripts: scriptPick, devCommand, reviewHint, notes,
  };
}
