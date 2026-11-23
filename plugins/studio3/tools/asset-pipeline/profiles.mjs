// @ts-check
/**
 * Delivery profiles for the 3D Asset Pipeline.
 *
 * IMPORTANT: the built-in profiles are DEFAULTS — documented starting points,
 * not universal limits. Appropriate triangle/texture budgets depend on the
 * product, the scene around the model and the target devices. Override them
 * with a profile file (`--profile my.json`), a budgets file (`--budgets`) or flags.
 */
import fs from 'node:fs';
import path from 'node:path';
import { UserError } from '../lib/log.mjs';

/**
 * @typedef {{ maxSize?: number, quality?: number, format?: 'webp' | 'keep' | 'ktx2', lossless?: boolean }} TextureRule
 * @typedef {{
 *   description?: string,
 *   compress?: 'meshopt' | 'draco' | 'none',
 *   meshoptLevel?: 'medium' | 'high',
 *   quantize?: false | { position?: number, normal?: number, texcoord?: number, color?: number, weight?: number, generic?: number },
 *   simplify?: null | false | { ratio: number, error?: number },
 *   textures?: TextureRule & { slots?: Record<string, TextureRule> },
 *   budgets?: { maxBytes?: number, maxTriangles?: number, maxVertices?: number, maxTextureSize?: number, maxGpuTextureBytesEstimate?: number, maxDrawCallsEstimate?: number },
 * }} Profile
 */

/** Default per-slot texture rules shared by the built-in profiles (labelled defaults). */
const DEFAULT_SLOT_RULES = {
  // Normal maps carry direction data: lossy artefacts show up as shading noise,
  // so they default to a higher quality and are only resized down to their own maxSize.
  normalTexture: { quality: 92 },
  metallicRoughnessTexture: { quality: 85 },
  occlusionTexture: { quality: 85 },
};

/** @type {Record<string, Profile>} */
export const DEFAULT_PROFILES = {
  desktop: {
    description: 'Default starting point for desktop-class GPUs: no geometry simplification, textures ≤ 2048 px.',
    compress: 'meshopt', meshoptLevel: 'medium', simplify: null,
    textures: { format: 'webp', maxSize: 2048, quality: 82, slots: DEFAULT_SLOT_RULES },
  },
  mobile: {
    description: 'Default starting point for phones/tablets: 75% of triangles (border-locked), textures ≤ 1024 px.',
    compress: 'meshopt', meshoptLevel: 'medium', simplify: { ratio: 0.75, error: 0.001 },
    textures: { format: 'webp', maxSize: 1024, quality: 80, slots: DEFAULT_SLOT_RULES },
  },
  'low-power': {
    description: 'Default starting point for low-power / data-saver devices: 50% of triangles (border-locked), textures ≤ 512 px.',
    compress: 'meshopt', meshoptLevel: 'medium', simplify: { ratio: 0.5, error: 0.002 },
    textures: { format: 'webp', maxSize: 512, quality: 78, slots: DEFAULT_SLOT_RULES },
  },
};

export const PROFILE_ORDER = ['desktop', 'mobile', 'low-power'];

/** @param {any} v */
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/**
 * Deep-merge profile objects (later wins; `null` replaces).
 * @param {any} base @param {any} over
 * @returns {any}
 */
export function mergeProfile(base, over) {
  if (!isObj(base) || !isObj(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(base[k]) ? mergeProfile(base[k], v) : v;
  return out;
}

/** @param {string} file */
function readJson(file) {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) throw new UserError(`Profile/budgets file not found: ${abs}`);
  try { return JSON.parse(fs.readFileSync(abs, 'utf8')); }
  catch (err) { throw new UserError(`Could not parse ${abs}: ${/** @type {any} */ (err).message}`); }
}

/**
 * Validate a profile's shape; throws a UserError naming the offending field.
 * @param {any} p @param {string} label
 * @returns {Profile}
 */
export function validateProfile(p, label) {
  if (!isObj(p)) throw new UserError(`Profile "${label}" must be a JSON object.`);
  if (p.compress !== undefined && !['meshopt', 'draco', 'none'].includes(p.compress)) throw new UserError(`Profile "${label}": compress must be meshopt, draco or none (got ${JSON.stringify(p.compress)}).`);
  if (p.meshoptLevel !== undefined && !['medium', 'high'].includes(p.meshoptLevel)) throw new UserError(`Profile "${label}": meshoptLevel must be medium or high.`);
  if (p.simplify) {
    const r = p.simplify.ratio;
    if (typeof r !== 'number' || !(r > 0 && r <= 1)) throw new UserError(`Profile "${label}": simplify.ratio must be a number in (0, 1] (got ${JSON.stringify(r)}).`);
    if (p.simplify.error !== undefined && !(typeof p.simplify.error === 'number' && p.simplify.error > 0)) throw new UserError(`Profile "${label}": simplify.error must be a positive number.`);
  }
  /** @param {any} rule @param {string} where */
  const checkRule = (rule, where) => {
    if (!isObj(rule)) throw new UserError(`Profile "${label}": ${where} must be an object.`);
    if (rule.format !== undefined && !['webp', 'keep', 'ktx2'].includes(rule.format)) throw new UserError(`Profile "${label}": ${where}.format must be webp, keep or ktx2.`);
    if (rule.maxSize !== undefined && !(Number.isInteger(rule.maxSize) && rule.maxSize >= 1)) throw new UserError(`Profile "${label}": ${where}.maxSize must be a positive integer (pixels).`);
    if (rule.quality !== undefined && !(typeof rule.quality === 'number' && rule.quality >= 1 && rule.quality <= 100)) throw new UserError(`Profile "${label}": ${where}.quality must be 1–100.`);
  };
  if (p.textures !== undefined) {
    checkRule(p.textures, 'textures');
    for (const [slot, rule] of Object.entries(p.textures.slots ?? {})) checkRule(rule, `textures.slots.${slot}`);
  }
  return p;
}

/**
 * Resolve a profile by built-in name or JSON file path.
 * A profile file is either a profile object, or `{ "extends": "mobile", ...overrides }`.
 * @param {string | undefined} nameOrFile
 * @param {Record<string, Profile>} [extra] additional named profiles (from a budgets file)
 * @returns {{ name: string, profile: Profile, origin: string }}
 */
export function resolveProfile(nameOrFile, extra = {}) {
  const key = nameOrFile ?? 'desktop';
  const table = { ...DEFAULT_PROFILES, ...extra };
  if (table[key]) {
    const builtIn = DEFAULT_PROFILES[key];
    const profile = extra[key] && builtIn ? mergeProfile(builtIn, extra[key]) : table[key];
    return { name: key, profile: validateProfile(profile, key), origin: extra[key] ? (builtIn ? 'built-in default + budgets file' : 'budgets file') : 'built-in default' };
  }
  if (/\.json$/i.test(key) || fs.existsSync(key)) {
    const json = readJson(key);
    const name = typeof json.name === 'string' ? json.name : path.basename(key).replace(/\.json$/i, '');
    let profile = json;
    if (typeof json.extends === 'string') {
      if (!DEFAULT_PROFILES[json.extends]) throw new UserError(`Profile file ${key}: "extends" must name a built-in profile (${Object.keys(DEFAULT_PROFILES).join(', ')}).`);
      profile = mergeProfile(DEFAULT_PROFILES[json.extends], json);
    }
    const { extends: _e, name: _n, ...rest } = profile;
    return { name, profile: validateProfile(rest, name), origin: `file ${path.resolve(key)}` };
  }
  throw new UserError(`Unknown profile "${key}". Built-in defaults: ${Object.keys(DEFAULT_PROFILES).join(', ')} — or pass a path to a profile .json file.`);
}

/**
 * Load a budgets file: `{ "profiles": { "<name>": Profile-overrides, ... } }`.
 * Entries matching a built-in name are merged over that default; new names define new profiles.
 * @param {string} file
 * @returns {Record<string, Profile>}
 */
export function loadBudgets(file) {
  const json = readJson(file);
  const profiles = isObj(json.profiles) ? json.profiles : json;
  if (!isObj(profiles)) throw new UserError(`Budgets file ${file} must be an object of the form { "profiles": { "<name>": { … } } }.`);
  for (const [k, v] of Object.entries(profiles)) if (!isObj(v)) throw new UserError(`Budgets file ${file}: profile "${k}" must be an object.`);
  return profiles;
}

/**
 * Apply CLI flag overrides on top of a profile.
 * @param {Profile} profile
 * @param {{ compress?: string, textureFormat?: string, textureMax?: number, textureQuality?: number, simplify?: number | null, simplifyError?: number, meshoptLevel?: string, quantize?: boolean }} flags
 * @returns {Profile}
 */
export function applyFlags(profile, flags) {
  /** @type {any} */
  const p = mergeProfile({}, profile);
  if (flags.compress !== undefined) p.compress = flags.compress;
  if (flags.meshoptLevel !== undefined) p.meshoptLevel = flags.meshoptLevel;
  if (flags.quantize === false) p.quantize = false;
  if (flags.textureFormat !== undefined || flags.textureMax !== undefined || flags.textureQuality !== undefined) {
    p.textures = { ...(p.textures ?? {}) };
    if (flags.textureFormat !== undefined) {
      p.textures.format = flags.textureFormat;
      // An explicit format flag applies to every slot.
      if (p.textures.slots) p.textures.slots = Object.fromEntries(Object.entries(p.textures.slots).map(([k, v]) => { const { format: _f, ...rest } = /** @type {any} */ (v); return [k, rest]; }));
    }
    if (flags.textureMax !== undefined) {
      p.textures.maxSize = flags.textureMax;
      if (p.textures.slots) p.textures.slots = Object.fromEntries(Object.entries(p.textures.slots).map(([k, v]) => { const { maxSize: _m, ...rest } = /** @type {any} */ (v); return [k, rest]; }));
    }
    if (flags.textureQuality !== undefined) p.textures.quality = flags.textureQuality;
  }
  if (flags.simplify !== undefined) {
    p.simplify = flags.simplify === null || flags.simplify >= 1 ? null : { ...(p.simplify || {}), ratio: flags.simplify };
  }
  if (flags.simplifyError !== undefined && p.simplify) p.simplify.error = flags.simplifyError;
  return p;
}

/**
 * Effective rule for one texture given the slots it is used in. When a texture
 * feeds several slots the most conservative rule wins (largest size, highest quality).
 * @param {Profile['textures']} textures @param {string[]} slots
 * @returns {Required<Pick<TextureRule, 'format' | 'quality'>> & { maxSize: number | null, lossless: boolean, appliedSlots: string[] }}
 */
export function textureRuleFor(textures, slots) {
  const base = { format: textures?.format ?? 'keep', maxSize: textures?.maxSize ?? null, quality: textures?.quality ?? 80, lossless: !!textures?.lossless };
  const rules = slots.filter((s) => textures?.slots?.[s]).map((s) => ({ slot: s, rule: { ...base, .../** @type {any} */ (textures).slots[s] } }));
  if (!rules.length) return { .../** @type {any} */ (base), appliedSlots: [] };
  // Slots without a specific rule fall back to the base rule and take part in the comparison.
  const candidates = [...rules.map((r) => r.rule), ...(slots.some((s) => !textures?.slots?.[s]) ? [base] : [])];
  const maxSizes = candidates.map((c) => c.maxSize);
  return {
    format: candidates.some((c) => c.format === 'keep') ? 'keep' : candidates[0].format,
    maxSize: maxSizes.some((m) => m == null) ? null : Math.max(.../** @type {number[]} */ (maxSizes)),
    quality: Math.max(...candidates.map((c) => c.quality)),
    lossless: candidates.some((c) => c.lossless),
    appliedSlots: rules.map((r) => r.slot),
  };
}

/**
 * Compare measured numbers against a profile's optional budgets. Budgets are
 * reported, never enforced by silently degrading the asset.
 * @param {Profile['budgets']} budgets @param {any} inspect inspect report of the output
 */
export function evaluateBudgets(budgets, inspect) {
  if (!budgets) return [];
  const maxTexture = Math.max(0, ...inspect.textures.map((/** @type {any} */ t) => Math.max(t.width ?? 0, t.height ?? 0)));
  /** @type {Record<string, number>} */
  const actual = {
    maxBytes: inspect.fileBytes, maxTriangles: inspect.totals.triangles, maxVertices: inspect.totals.vertices,
    maxTextureSize: maxTexture, maxGpuTextureBytesEstimate: inspect.totals.gpuTextureBytesEstimate, maxDrawCallsEstimate: inspect.totals.drawCallsEstimate,
  };
  return Object.entries(budgets).filter(([k]) => k in actual).map(([k, limit]) => ({ budget: k, limit, actual: actual[k], ok: actual[k] <= /** @type {number} */ (limit) }));
}
