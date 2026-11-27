// @ts-check
/**
 * `maquettekit catalog export <id…> --format web-component` — package effect recipes as Web Components for projects
 * that do not use React (Vue, Svelte, Astro, plain HTML). Every recipe has client behaviour (hooks, pointer and scroll
 * handlers, reduced-motion logic), so a static HTML/CSS export would look right and do nothing; instead the real
 * component is bundled with React into one ES module that registers `<mk-<id>>`, plus its CSS.
 *
 * Attributes map to the recipe's params (kebab-case; numbers clamped, booleans "true"/"false"). The element renders the
 * recipe's sample content: use it to prototype and to ship effects whose content is generic; port the logic for
 * content-specific production use (studio-components). Needs Vite and React, resolved like every optional
 * dependency (project, Maquettekit deps dir — "maquettekit setup --only export").
 */
import fs from 'node:fs';
import path from 'node:path';
import { importDep, resolveDep } from '../lib/resolve.mjs';
import { UserError } from '../lib/log.mjs';
import { installItems } from './install.mjs';

const kebab = (k) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** The wrapper module for one effect. @param {string} id @param {string} rel path of the effect dir inside src/ */
function entrySource(id, rel) {
  return `import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import Component from './src/${rel}/index';
import { meta } from './src/${rel}/meta';
import { resolveParams } from './src/types';

const attrOf = (key) => key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

class MaquettekitElement extends HTMLElement {
  static get observedAttributes() { return meta.params.map((s) => attrOf(s.key)); }
  root = null;
  connectedCallback() { if (!this.root) this.root = createRoot(this); this.render(); }
  disconnectedCallback() { this.root?.unmount(); this.root = null; }
  attributeChangedCallback() { if (this.root) this.render(); }
  render() {
    const overrides = {};
    for (const s of meta.params) {
      const v = this.getAttribute(attrOf(s.key));
      if (v === null) continue;
      overrides[s.key] = s.type === 'number' ? Number(v) : s.type === 'boolean' ? v !== 'false' : v;
    }
    this.root.render(createElement(Component, { params: resolveParams(meta.params, overrides) }));
  }
}

if (!customElements.get('mk-${id}')) customElements.define('mk-${id}', MaquettekitElement);
`;
}

/** @param {any} effect catalogue entry */
function demoPage(effect) {
  const attrs = (effect.params ?? []).map((p) => ` ${kebab(p.key)}="${String(p.default).replace(/"/g, '&quot;')}"`).join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${effect.name} — Maquettekit Web Component</title>
  <link rel="stylesheet" href="mk-${effect.id}.css">
  <script type="module" src="mk-${effect.id}.js"></script>
  <style>body { margin: 0; padding: 32px; font-family: system-ui, sans-serif; } mk-${effect.id} { display: block; }</style>
</head>
<body>
  <!-- Attributes map to the recipe's params; change them at runtime with setAttribute(). -->
  <mk-${effect.id}${attrs}></mk-${effect.id}>
</body>
</html>
`;
}

/**
 * @param {any} cat catalogue
 * @param {string[]} ids effect ids
 * @param {{ out?: string, minify?: boolean }} opts
 */
export async function exportWebComponents(cat, ids, opts = {}) {
  if (!ids.length) throw new UserError('catalog export needs at least one effect id');
  const effects = ids.map((id) => {
    const e = cat.effects.find((x) => x.id === id);
    if (!e) throw new UserError(cat.demos.some((d) => d.id === id || `${d.specialty}/${d.id}` === id) ? `"${id}" is a demo (a full composition); install it into a React project with "catalog install ${id}" instead.` : `No effect with id "${id}". Try: maquettekit catalog search ${id}`);
    return e;
  });
  const vite = await importDep('vite', 'bundling recipes as Web Components');
  const react = resolveDep('react'); const reactDom = resolveDep('react-dom/client');
  if (!react || !reactDom) throw new UserError('Missing dependency "react" / "react-dom" (needed to bundle recipes as Web Components).\n  Install them with:  maquettekit setup --only export', 3);
  // build inside the folder whose node_modules holds React, so the bundler resolves it (and the recipe's packages)
  const marker = `${path.sep}node_modules${path.sep}`;
  const buildRoot = react.slice(0, react.lastIndexOf(marker));
  const outDir = path.resolve(opts.out ?? 'maquettekit-elements');
  fs.mkdirSync(path.join(buildRoot, '.maquettekit'), { recursive: true });
  const work = fs.mkdtempSync(path.join(buildRoot, '.maquettekit', 'export-'));
  const built = [];
  try {
    const plan = installItems(cat, ids, { project: work, into: 'src', apply: true });
    const missing = plan.dependencies.filter((d) => !d.dev && !fs.existsSync(path.join(buildRoot, 'node_modules', d.name, 'package.json')));
    if (missing.length) throw new UserError(`These recipes import ${missing.map((d) => d.name).join(', ')}, which are not installed where the bundler can find them.\n  Install them in the project (${plan.installCommand}) and run the export from there.`, 3);
    fs.mkdirSync(outDir, { recursive: true });
    for (const e of effects) {
      const rel = String(e.path).replace(/^library\/src\//, '');
      const entry = path.join(work, `entry-${e.id}.tsx`);
      fs.writeFileSync(entry, entrySource(e.id, rel));
      await vite.build({
        configFile: false, root: work, logLevel: 'silent', publicDir: false, mode: 'production',
        define: { 'process.env.NODE_ENV': JSON.stringify('production') },
        css: { modules: { generateScopedName: `mk-${e.id}__[local]` } },
        oxc: { jsx: { runtime: 'automatic', development: false } }, // production JSX even when the caller runs with NODE_ENV=test/development
        build: { outDir, emptyOutDir: false, copyPublicDir: false, minify: opts.minify !== false, reportCompressedSize: false,
          lib: { entry, formats: ['es'], fileName: () => `mk-${e.id}.js`, cssFileName: `mk-${e.id}` } },
      });
      const html = path.join(outDir, `mk-${e.id}.html`);
      fs.writeFileSync(html, demoPage(e));
      const js = path.join(outDir, `mk-${e.id}.js`); const css = path.join(outDir, `mk-${e.id}.css`);
      built.push({ id: e.id, element: `mk-${e.id}`, js, css: fs.existsSync(css) ? css : null, demo: html, jsKb: Math.round(fs.statSync(js).size / 1024),
        attributes: (e.params ?? []).map((p) => ({ name: kebab(p.key), type: p.type, default: p.default, ...(p.options ? { options: p.options } : {}) })) });
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
    try { fs.rmdirSync(path.join(buildRoot, '.maquettekit')); } catch { /* not empty: it holds other Maquettekit output */ }
  }
  return {
    tool: 'maquettekit-catalog-export', format: 'web-component', out: outDir, elements: built,
    notes: [
      'Each module bundles React (about 60 KB gzip); load several elements from one page and the browser downloads React once per module — for many elements, prefer a React island or port the recipe.',
      'Elements render the recipe\'s sample content with params from attributes; for content-specific use, port the logic (studio-components → references/adapting.md).',
      'Recipes read --mk-* custom properties with built-in fallbacks: define them (maquettekit design tokens) to theme the elements.',
    ],
  };
}

