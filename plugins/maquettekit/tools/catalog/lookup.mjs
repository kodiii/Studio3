// @ts-check
/**
 * Catalogue id lookup. Effect ids are unique; demo ids are unique only within a specialty (e.g. `cinematic-landing`
 * exists under both `3d` and `cinematic`), so demos can also be addressed as `<specialty>/<id>`.
 */
import { UserError } from '../lib/log.mjs';

/** `<specialty>/<id>` for a demo. @param {{ specialty: string, id: string }} demo */
export const qualifiedId = (demo) => `${demo.specialty}/${demo.id}`;

/**
 * Find an effect or demo by id. Accepts a bare id or a qualified demo id (`<specialty>/<id>`).
 * Returns null when nothing matches; throws a UserError when a bare id matches more than one demo.
 * @param {any} cat catalogue
 * @param {string} id
 * @returns {{ kind: 'effect' | 'demo', item: any, id: string } | null}
 */
export function findItem(cat, id) {
  if (typeof id !== 'string' || !id) return null;
  if (id.includes('/')) {
    const demo = cat.demos.find((d) => qualifiedId(d) === id);
    return demo ? { kind: 'demo', item: demo, id: qualifiedId(demo) } : null;
  }
  const effect = cat.effects.find((e) => e.id === id);
  if (effect) return { kind: 'effect', item: effect, id: effect.id };
  const demos = cat.demos.filter((d) => d.id === id);
  if (demos.length > 1) {
    throw new UserError(`"${id}" matches ${demos.length} demos; use a qualified id: ${demos.map(qualifiedId).join(', ')}`);
  }
  return demos.length ? { kind: 'demo', item: demos[0], id: qualifiedId(demos[0]) } : null;
}
