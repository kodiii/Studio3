// @ts-check
/**
 * Small JSON Schema validator — sufficient for the Maquettekit schemas, not a general
 * implementation. Supported keywords: type (string or array; "integer" included),
 * required, properties, additionalProperties (boolean or schema), items, enum, const,
 * minimum, maximum, minLength, maxLength, minItems, maxItems, pattern, and local
 * `$ref` ("#/$defs/name"). Unknown keywords are ignored.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCHEMA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'shared', 'schemas');
/** @param {'maquettekit.design' | 'brief' | 'experience' | 'experience-answers'} name */
export function loadSchema(name) {
  return JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, `${name}.schema.json`), 'utf8'));
}

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
const matchesType = (v, t) => (t === 'integer' ? typeof v === 'number' && Number.isInteger(v) : t === 'number' ? typeof v === 'number' && Number.isFinite(v) : typeOf(v) === t);

/**
 * @param {unknown} value @param {any} schema @param {any} [root]
 * @returns {{ valid: boolean, errors: { path: string, message: string }[] }}
 */
export function validateSchema(value, schema, root = schema) {
  /** @type {{ path: string, message: string }[]} */
  const errors = [];
  const visit = (v, s, p) => {
    if (s === true || s === undefined) return;
    if (s === false) { errors.push({ path: p, message: 'is not allowed' }); return; }
    if (s.$ref) {
      const m = /^#\/\$defs\/(.+)$/.exec(s.$ref);
      const target = m && root.$defs?.[m[1]];
      if (!target) { errors.push({ path: p, message: `unresolvable $ref ${s.$ref}` }); return; }
      visit(v, target, p);
      return;
    }
    if (s.type !== undefined) {
      const types = Array.isArray(s.type) ? s.type : [s.type];
      if (!types.some((t) => matchesType(v, t))) { errors.push({ path: p, message: `expected ${types.join(' | ')}, got ${typeOf(v)}` }); return; }
    }
    if ('const' in s && JSON.stringify(v) !== JSON.stringify(s.const)) errors.push({ path: p, message: `must equal ${JSON.stringify(s.const)}` });
    if (s.enum && !s.enum.some((e) => JSON.stringify(e) === JSON.stringify(v))) errors.push({ path: p, message: `must be one of ${s.enum.map((e) => JSON.stringify(e)).join(', ')} (got ${JSON.stringify(v)})` });
    if (typeof v === 'number') {
      if (s.minimum !== undefined && v < s.minimum) errors.push({ path: p, message: `must be ≥ ${s.minimum} (got ${v})` });
      if (s.maximum !== undefined && v > s.maximum) errors.push({ path: p, message: `must be ≤ ${s.maximum} (got ${v})` });
    }
    if (typeof v === 'string') {
      if (s.minLength !== undefined && v.length < s.minLength) errors.push({ path: p, message: `must have at least ${s.minLength} character(s)` });
      if (s.maxLength !== undefined && v.length > s.maxLength) errors.push({ path: p, message: `must have at most ${s.maxLength} character(s)` });
      if (s.pattern !== undefined && !new RegExp(s.pattern).test(v)) errors.push({ path: p, message: `must match /${s.pattern}/ (got ${JSON.stringify(v)})` });
    }
    if (Array.isArray(v)) {
      if (s.minItems !== undefined && v.length < s.minItems) errors.push({ path: p, message: `must have at least ${s.minItems} item(s)` });
      if (s.maxItems !== undefined && v.length > s.maxItems) errors.push({ path: p, message: `must have at most ${s.maxItems} item(s)` });
      if (s.items !== undefined) v.forEach((item, i) => visit(item, s.items, `${p}[${i}]`));
    }
    if (typeOf(v) === 'object') {
      const o = /** @type {Record<string, unknown>} */ (v);
      for (const k of s.required ?? []) if (!(k in o) || o[k] === undefined) errors.push({ path: p ? `${p}.${k}` : k, message: 'is required' });
      const props = s.properties ?? {};
      for (const [k, val] of Object.entries(o)) {
        const kp = p ? `${p}.${k}` : k;
        if (k in props) visit(val, props[k], kp);
        else if (s.additionalProperties === false) errors.push({ path: kp, message: 'is not an allowed property' });
        else if (s.additionalProperties && typeof s.additionalProperties === 'object') visit(val, s.additionalProperties, kp);
      }
    }
  };
  visit(value, schema, '');
  return { valid: errors.length === 0, errors };
}
