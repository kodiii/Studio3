// @ts-check
/**
 * Minimal, dependency-free argv parser shared by every Maquettekit tool.
 * Supports: --flag, --no-flag, --key value, --key=value, repeated keys (→ array), and positionals.
 * @param {string[]} argv
 * @param {{ boolean?: string[], array?: string[], alias?: Record<string,string> }} [spec]
 * @returns {{ _: string[], [key: string]: any }}
 */
export function parseArgs(argv, spec = {}) {
  const bools = new Set(spec.boolean ?? []);
  const arrays = new Set(spec.array ?? []);
  const alias = spec.alias ?? {};
  /** @type {{ _: string[], [key: string]: any }} */
  const out = { _: [] };
  const set = (k, v) => {
    k = alias[k] ?? k;
    if (arrays.has(k)) (out[k] ??= []).push(v);
    else out[k] = v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { out._.push(...argv.slice(i + 1)); break; }
    if (!a.startsWith('-') || a === '-') { out._.push(a); continue; }
    const body = a.replace(/^--?/, '');
    const eq = body.indexOf('=');
    if (eq !== -1) { set(body.slice(0, eq), body.slice(eq + 1)); continue; }
    if (body.startsWith('no-') && bools.has(alias[body.slice(3)] ?? body.slice(3))) { set(body.slice(3), false); continue; }
    if (bools.has(alias[body] ?? body)) { set(body, true); continue; }
    const next = argv[i + 1];
    if (next === undefined || (next.startsWith('--') && next.length > 2)) set(body, true);
    else { set(body, next); i++; }
  }
  return out;
}

/** @param {unknown} v @param {number} fallback */
export function toInt(v, fallback) {
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
}
