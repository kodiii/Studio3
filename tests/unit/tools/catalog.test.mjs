import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { loadCatalog, searchEffects } from '../../../plugins/studio3/tools/catalog/index.mjs';

const CLI = path.resolve('plugins/studio3/tools/studio3.mjs');
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
