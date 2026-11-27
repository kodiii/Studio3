import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { findItem, loadCatalog, searchEffects } from '../../../plugins/maquettekit/tools/catalog/index.mjs';

const CLI = path.resolve('plugins/maquettekit/tools/maquettekit.mjs');
const fx = (o) => ({ id: 'x', name: 'X', description: '', category: 'cards', technology: ['css'], specialties: ['product'], interaction: ['hover'], applications: [], dependencies: [], complexity: 1, intensity: 'subtle', ...o });

describe('catalog search', () => {
  const effects = [
    fx({ id: 'tilt-card', name: 'Tilt card', category: 'cards' }),
    fx({ id: 'scroll-pin', name: 'Scroll pin', category: 'scroll', technology: ['gsap'], dependencies: [{ name: 'gsap', version: '^3' }], complexity: 3, intensity: 'bold' }),
    fx({ id: 'card-flip', name: 'Flip', category: '3d-transforms', description: 'a card that flips', applications: ['pricing card'] }),
  ];
  it('ranks id/name matches above description matches', () => {
    // tilt-card: id 6 + name 5 + category 4 = 15; card-flip: id 6 + application 3 + description 2 = 11
    expect(searchEffects(effects, 'card').map((h) => h.effect.id)).toEqual(['tilt-card', 'card-flip']);
    expect(searchEffects(effects, 'flips').map((h) => h.effect.id)).toEqual(['card-flip']);
  });
  it('filters by facets', () => {
    expect(searchEffects(effects, '', { tech: 'gsap' }).map((h) => h.effect.id)).toEqual(['scroll-pin']);
    expect(searchEffects(effects, '', { noDeps: true }).map((h) => h.effect.id)).not.toContain('scroll-pin');
    expect(searchEffects(effects, '', { maxComplexity: 2 }).map((h) => h.effect.id)).not.toContain('scroll-pin');
    expect(searchEffects(effects, '', { intensity: 'bold' }).map((h) => h.effect.id)).toEqual(['scroll-pin']);
  });
  it('returns nothing for an unmatched query', () => {
    expect(searchEffects(effects, 'zzzz')).toEqual([]);
  });
  it('works on the real catalogue through the CLI', () => {
    expect(loadCatalog().effects.length).toBeGreaterThan(0);
    const r = spawnSync(process.execPath, [CLI, 'catalog', 'search', 'reveal', '--json'], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    const hits = JSON.parse(r.stdout);
    expect(hits.length).toBeGreaterThan(0);
    const show = spawnSync(process.execPath, [CLI, 'catalog', 'show', hits[0].id, '--json', '--source'], { encoding: 'utf8' });
    expect(JSON.parse(show.stdout).sources['index.tsx']).toContain('export default');
  });
});

describe('catalog id lookup', () => {
  const cat = loadCatalog();
  const run = (...a) => spawnSync(process.execPath, [CLI, 'catalog', ...a], { encoding: 'utf8' });

  it('resolves a qualified demo id to that specialty', () => {
    const f = findItem(cat, 'cinematic/cinematic-landing');
    expect(f).toMatchObject({ kind: 'demo', id: 'cinematic/cinematic-landing', item: { specialty: 'cinematic' } });
    expect(findItem(cat, '3d/cinematic-landing')?.item.specialty).toBe('3d');
    expect(findItem(cat, 'social/cinematic-landing')).toBeNull();
    const show = run('show', 'product/product-configurator', '--json');
    expect(show.status).toBe(0);
    const item = JSON.parse(show.stdout);
    expect(item).toMatchObject({ id: 'product-configurator', specialty: 'product', qualifiedId: 'product/product-configurator' });
    expect(item.directory).toMatch(/demos[\\/]product[\\/]product-configurator$/);
  });

  it('refuses an ambiguous bare id and lists the qualified ids', () => {
    expect(() => findItem(cat, 'cinematic-landing')).toThrow(/use a qualified id: 3d\/cinematic-landing, cinematic\/cinematic-landing/);
    const show = run('show', 'product-configurator');
    expect(show.status).not.toBe(0);
    expect(show.stderr + show.stdout).toMatch(/3d\/product-configurator, product\/product-configurator/);
    expect(run('install', 'cinematic-landing', '--dry-run').status).not.toBe(0);
  });

  it('still resolves a unique bare id, for demos and effects', () => {
    expect(findItem(cat, 'saas-landing')).toMatchObject({ kind: 'demo', id: 'product/saas-landing' });
    expect(findItem(cat, 'magnetic-button')).toMatchObject({ kind: 'effect', id: 'magnetic-button' });
    const show = run('show', 'saas-landing', '--json');
    expect(show.status).toBe(0);
    expect(JSON.parse(show.stdout).qualifiedId).toBe('product/saas-landing');
  });

  it('lists demos by qualified id', () => {
    const out = run('list', '--kind', 'demos').stdout;
    expect(out).toMatch(/^cinematic\/cinematic-landing\s/m);
    expect(out).toMatch(/^3d\/cinematic-landing\s/m);
  });
});
