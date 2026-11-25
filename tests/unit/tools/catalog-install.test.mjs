// @ts-check
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from '../../../plugins/maquettekit/tools/catalog/index.mjs';
import { installItems, importsOf, packageOf } from '../../../plugins/maquettekit/tools/catalog/install.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '../../..');
const cat = loadCatalog();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'maquettekit-install-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

function app(name, deps = { react: '^19.0.0', 'react-dom': '^19.0.0' }) {
  const dir = path.join(tmp, name);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name, dependencies: deps }));
  return dir;
}

describe('import scanning', () => {
  it('reads statement-level imports only and maps bare specifiers to packages', () => {
    const src = "import a, { b } from './a';\nimport type { T } from '../types';\nexport { x } from './x';\nimport './side.css';\nconst t = `text from 'nowhere'\nmore`;\nconst m = await import('three/examples/jsm/x.js');\n// import z from 'commented';";
    expect(importsOf(src, 'f.tsx').sort()).toEqual(['../types', './a', './side.css', './x', 'three/examples/jsm/x.js']);
    expect(packageOf('@react-three/fiber')).toBe('@react-three/fiber');
    expect(packageOf('gsap/ScrollTrigger')).toBe('gsap');
    expect(packageOf('node:fs')).toBeNull();
    expect(packageOf('path')).toBeNull();
  });
});

describe('catalog install', () => {
  it('every effect and demo resolves all of its relative imports inside the library', () => {
    const items = [...cat.effects, ...cat.demos];
    expect(items.length).toBeGreaterThanOrEqual(69);
    for (const it of items) {
      const r = installItems(cat, [it.id], { project: tmp, into: path.join(tmp, 'never-written') });
      expect(r.unresolved, it.id).toEqual([]);
      for (const d of r.dependencies) expect(d.name, `${it.id}: ${d.name}`).toMatch(/^(@[\w.-]+\/)?[\w.-]+$/);
      expect(r.files.some((f) => f.path.endsWith('index.tsx')), it.id).toBe(true);
    }
    expect(fs.existsSync(path.join(tmp, 'never-written'))).toBe(false);
  });

  it('copies the closure into src/maquettekit, mirroring the library, and records a manifest', () => {
    const dir = app('basic');
    const r = installItems(cat, ['magnetic-button', 'saas-landing'], { project: dir, apply: true });
    expect(r.into).toBe(path.join(dir, 'src', 'maquettekit'));
    const files = r.files.map((f) => f.path);
    expect(files).toEqual(expect.arrayContaining(['effects/magnetic-button/index.tsx', 'effects/magnetic-button/styles.module.css', 'effects/split-line-reveal/index.tsx', 'motion/index.ts', 'types.ts', 'global.d.ts', 'demos/product/saas-landing/index.tsx']));
    expect(files.some((f) => f.startsWith('three/')), 'no 3D kit for 2D items').toBe(false);
    for (const f of files) expect(fs.existsSync(path.join(r.into, f)), f).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(path.join(r.into, 'maquettekit.install.json'), 'utf8'));
    expect(Object.keys(manifest.items).sort()).toEqual(['magnetic-button', 'saas-landing']);
    expect(Object.keys(manifest.files)).toEqual(expect.arrayContaining(files));
    expect(r.installCommand).toBeNull(); // react is already in package.json
    expect(r.usage[0]).toMatchObject({ component: 'MagneticButton', snippet: "import { MagneticButton } from './src/maquettekit/effects/magnetic-button';" });
  });

  it('is idempotent, refuses to overwrite changed files without --force, and dry-run writes nothing', () => {
    const dir = app('conflict');
    installItems(cat, ['magnetic-button'], { project: dir, apply: true });
    const again = installItems(cat, ['magnetic-button'], { project: dir, apply: true });
    expect(again.counts).toMatchObject({ create: 0, identical: again.files.length });
    const edited = path.join(dir, 'src', 'maquettekit', 'effects', 'magnetic-button', 'styles.module.css');
    fs.writeFileSync(edited, '/* my changes */');
    expect(() => installItems(cat, ['magnetic-button'], { project: dir, apply: true })).toThrow(/already exist with different content/);
    expect(fs.readFileSync(edited, 'utf8')).toBe('/* my changes */');
    const forced = installItems(cat, ['magnetic-button'], { project: dir, apply: true, force: true });
    expect(forced.counts.overwrite).toBe(1);
    expect(fs.readFileSync(edited, 'utf8')).not.toBe('/* my changes */');
    const dry = installItems(cat, ['magnetic-button'], { project: app('dry'), into: 'lib/mk' });
    expect(dry.applied).toBe(false);
    expect(fs.existsSync(path.join(tmp, 'dry', 'lib'))).toBe(false);
    expect(() => installItems(cat, ['no-such-recipe'], { project: dir })).toThrow(/No effect or demo/);
  });

  it('reports missing npm packages with tested versions, @types for three/d3, and absolute asset URLs', () => {
    const dir = app('three-app');
    const r = installItems(cat, ['cinematic-landing'], { project: dir });
    const names = r.dependencies.filter((d) => !d.present).map((d) => d.name);
    expect(names).toEqual(expect.arrayContaining(['three', '@react-three/fiber', '@types/three']));
    expect(r.installCommand).toMatch(/^npm install .*three@\^0\.\d+/);
    expect(r.installCommand).toMatch(/npm install -D @types\/three@/);
    expect(r.assetUrls.some((u) => u.startsWith('/models/'))).toBe(true);
    expect(r.notes.join(' ')).toMatch(/absolute URLs/);
  });

  it('installed copies type-check in a project outside the monorepo', () => {
    const tsc = path.join(REPO, 'node_modules', '.bin', 'tsc');
    if (!fs.existsSync(tsc)) return;
    const pick = (tech) => cat.effects.find((e) => e.technology.includes(tech))?.id;
    const ids = ['magnetic-button', 'saas-landing', 'product-configurator', pick('d3'), pick('gsap'), pick('glsl')].filter(Boolean);
    const dir = app('typed');
    installItems(cat, /** @type {string[]} */ (ids), { project: dir, apply: true });
    const nm = path.join(REPO, 'node_modules');
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { target: 'ES2022', lib: ['ES2023', 'DOM', 'DOM.Iterable'], module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx', strict: true, noEmit: true,
        skipLibCheck: true, esModuleInterop: true, isolatedModules: true, allowImportingTsExtensions: true,
        paths: { '*': [`${nm}/@types/*`, `${nm}/*`] }, typeRoots: [`${nm}/@types`], types: ['react', 'react-dom'] },
      include: ['src/**/*.ts', 'src/**/*.tsx'],
    }));
    const r = spawnSync(tsc, ['-p', path.join(dir, 'tsconfig.json')], { encoding: 'utf8' });
    expect(r.status, `${ids.join(', ')}\n${r.stdout}${r.stderr}`).toBe(0);
  }, 120_000);
});
