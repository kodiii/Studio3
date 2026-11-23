// @ts-check
import { createHash } from 'node:crypto';

/** Deterministic JSON: object keys sorted recursively. @param {unknown} v @returns {string} */
export function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const o = /** @type {Record<string, unknown>} */ (v);
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`;
}
/** Short sha256 of the stable JSON form. @param {unknown} v */
export function hashOf(v) { return createHash('sha256').update(stableStringify(v)).digest('hex').slice(0, 16); }

/** 32-bit FNV-1a string hash. @param {string} s */
export function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/**
 * mulberry32 seeded PRNG. Each named stream is independent, so adding a new
 * consumer never shifts the values other consumers receive.
 * @param {number | string} seed @returns {(stream: string) => () => number}
 */
export function createRng(seed) {
  const base = fnv1a(String(seed));
  return (stream) => {
    let a = (base ^ fnv1a(stream)) >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
}

export const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
/** Deep merge `over` on top of `base` (arrays and scalars replace). Returns a new value. */
export function deepMerge(base, over) {
  if (!isPlainObject(base) || !isPlainObject(over)) return over === undefined ? base : structuredClone(over);
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = k in base ? deepMerge(base[k], v) : structuredClone(v);
  return out;
}
/** Leaf paths of a nested object, dot-joined. */
export function leafPaths(obj, prefix = '') {
  if (!isPlainObject(obj)) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => leafPaths(v, prefix ? `${prefix}.${k}` : k));
}
/** @param {any} obj @param {string} p dot path */
export function getPath(obj, p) {
  let cur = obj;
  for (const k of p.split('.')) { if (cur == null || typeof cur !== 'object') return undefined; cur = cur[k]; }
  return cur;
}
export const round = (x, d = 3) => Number(Number(x).toFixed(d));
export const kebab = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
