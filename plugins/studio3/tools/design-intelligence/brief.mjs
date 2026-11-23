// @ts-check
/**
 * Brief handling: template, normalisation (with every default recorded as an
 * explicit assumption), CLI-flag mapping and specialty inference.
 */
import { UserError } from '../lib/log.mjs';
import { isHex } from './color.mjs';

export const MOTION_PROFILES = ['essential', 'expressive', 'immersive'];
export const SPECIALTIES = ['product', 'cinematic', 'data', 'social', '3d'];
export const COMPLEXITY = ['low', 'medium', 'high'];
export const BUDGETS = ['tight', 'balanced', 'generous'];

/** Canonical category → synonyms (matched as whole words / substrings of the supplied category). */
export const CATEGORIES = {
  saas: ['saas', 'b2b', 'software', 'platform', 'crm', 'productivity', 'workspace', 'collaboration', 'tool'],
  fintech: ['fintech', 'finance', 'financial', 'bank', 'banking', 'invest', 'investing', 'trading', 'payments', 'insurance', 'wealth', 'crypto'],
  ecommerce: ['ecommerce', 'e-commerce', 'commerce', 'shop', 'store', 'retail', 'marketplace', 'dtc'],
  portfolio: ['portfolio', 'personal', 'freelance', 'showreel', 'cv'],
  agency: ['agency', 'studio', 'consultancy', 'creative'],
  editorial: ['editorial', 'media', 'news', 'magazine', 'blog', 'publication', 'publishing', 'journal', 'newsletter'],
  devtool: ['devtool', 'developer', 'dev', 'api', 'cli', 'infrastructure', 'open-source', 'opensource', 'sdk', 'docs', 'documentation', 'devops'],
  healthcare: ['healthcare', 'health', 'medical', 'clinic', 'wellness', 'pharma', 'biotech', 'therapy'],
  education: ['education', 'learning', 'edtech', 'course', 'school', 'university', 'kids'],
  gaming: ['gaming', 'game', 'games', 'esports'],
  dashboard: ['dashboard', 'analytics', 'bi', 'monitoring', 'observability', 'admin', 'data', 'reporting'],
  social: ['social', 'community', 'chat', 'messaging', 'forum', 'network', 'dating', 'creator'],
  entertainment: ['entertainment', 'film', 'music', 'streaming', 'festival', 'event', 'video', 'podcast'],
  luxury: ['luxury', 'fashion', 'jewellery', 'jewelry', 'hospitality', 'hotel', 'beauty', 'fragrance', 'interior', 'architecture', 'real-estate'],
  government: ['government', 'civic', 'public', 'nonprofit', 'non-profit', 'ngo', 'charity', 'municipal'],
  ai: ['ai', 'ml', 'llm', 'agent', 'research', 'lab', 'science', 'scientific'],
  hardware: ['hardware', 'automotive', 'product', 'device', 'consumer-electronics', 'electronics', 'configurator', 'showcase', 'robotics', 'mobility'],
  food: ['food', 'restaurant', 'beverage', 'coffee', 'bakery', 'grocery', 'farm', 'travel', 'outdoor'],
};
const SPECIALTY_BY_CATEGORY = {
  dashboard: 'data', fintech: 'data', ai: 'data', gaming: 'cinematic', entertainment: 'cinematic', agency: 'cinematic',
  portfolio: 'cinematic', luxury: 'cinematic', social: 'social', hardware: '3d',
};

/** @param {string} raw @returns {string | null} canonical category id or null when unknown */
export function canonicalCategory(raw) {
  const s = String(raw ?? '').toLowerCase();
  const words = s.split(/[^a-z0-9-]+/).filter(Boolean);
  for (const [id, syn] of Object.entries(CATEGORIES)) if (words.includes(id)) return id;
  let best = null;
  let bestAt = Infinity;
  for (const [id, syn] of Object.entries(CATEGORIES)) {
    for (const w of syn) {
      const at = words.indexOf(w);
      if (at !== -1 && at < bestAt) { best = id; bestAt = at; }
    }
  }
  return best;
}

const list = (v) => (v == null || v === true || v === '' ? [] : (Array.isArray(v) ? v : String(v).split(',')).map((x) => String(x).trim()).filter(Boolean));
const bool = (v) => (typeof v === 'boolean' ? v : v == null ? undefined : !/^(false|0|no|off)$/i.test(String(v)));

export function briefTemplate() {
  return {
    $schema: 'https://studio3.dev/schemas/brief.schema.json',
    _help: 'Fill every field, then run: studio3 design generate --brief brief.json. Keys starting with "_" are comments and are ignored.',
    productCategory: 'saas',
    _productCategory: `Free text; recognised families: ${Object.keys(CATEGORIES).join(', ')}.`,
    audience: 'Who uses it, in their words (e.g. "operations leads at mid-size logistics firms").',
    brand: {
      name: 'Acme',
      personality: ['precise', 'calm', 'confident'],
      existingColors: [],
      _existingColors: 'Hex values. The first chromatic colour becomes the brand hue; the second (if any) the accent.',
      existingFonts: [],
      _existingFonts: 'Family names already licensed by the brand. First = display, second = text.',
    },
    businessGoals: ['Increase trial-to-paid conversion', 'Reduce onboarding drop-off'],
    targetDevices: ['desktop', 'mobile'],
    preferredAesthetic: 'editorial, restrained, high-contrast',
    _preferredAesthetic: 'Adjectives or a direction id from "studio3 design directions".',
    interactionComplexity: 'medium',
    _interactionComplexity: 'low | medium | high',
    accessibility: { level: 'AA', needs: [] },
    _accessibility: 'level: AA | AAA. needs: e.g. "low-vision", "vestibular", "keyboard-only", "screen-reader", "dyslexia".',
    performance: { budget: 'balanced', lowEndDevices: false },
    _performance: 'budget: tight | balanced | generous',
    stack: { framework: 'next', styling: 'tailwind', libs: [] },
    _stack: 'framework: next | react | remix | vue | nuxt | svelte | sveltekit | astro | solid | angular | vanilla …',
    motionIntensity: 'expressive',
    _motionIntensity: 'Studio³ Experience profile: essential | expressive | immersive',
    requires3d: false,
    threeD: { purpose: '' },
    _threeD: 'Only read when requires3d is true. purpose: e.g. "interactive product configurator", "ambient hero object", "data globe".',
    specialty: '',
    _specialty: 'product | cinematic | data | social | 3d — leave empty to infer from the category.',
  };
}

/** Map CLI flags to a partial brief. @param {Record<string, any>} a */
export function briefFromFlags(a) {
  /** @type {any} */
  const b = {};
  const put = (path, v) => {
    if (v === undefined) return;
    let cur = b;
    const keys = path.split('.');
    keys.slice(0, -1).forEach((k) => { cur = cur[k] ??= {}; });
    cur[keys.at(-1)] = v;
  };
  const str = (v) => (v === undefined || v === true ? undefined : String(v));
  put('productCategory', str(a.category));
  put('audience', str(a.audience));
  put('brand.name', str(a.name ?? a['brand-name']));
  if (a.personality !== undefined) put('brand.personality', list(a.personality));
  if (a.colors !== undefined) put('brand.existingColors', list(a.colors));
  if (a.fonts !== undefined) put('brand.existingFonts', list(a.fonts));
  if (a.goals !== undefined) put('businessGoals', list(a.goals));
  if (a.devices !== undefined) put('targetDevices', list(a.devices));
  put('preferredAesthetic', str(a.aesthetic));
  put('interactionComplexity', str(a.complexity));
  put('accessibility.level', str(a.a11y ?? a['a11y-level']));
  if (a['a11y-needs'] !== undefined) put('accessibility.needs', list(a['a11y-needs']));
  put('performance.budget', str(a.budget));
  put('performance.lowEndDevices', bool(a['low-end']));
  put('stack.framework', str(a.framework));
  put('stack.styling', str(a.styling));
  if (a.libs !== undefined) put('stack.libs', list(a.libs));
  put('motionIntensity', str(a.motion));
  put('requires3d', bool(a['3d']));
  put('threeD.purpose', str(a['3d-purpose']));
  put('specialty', str(a.specialty));
  return b;
}

/**
 * Normalise a (possibly partial) brief. Missing fields get conservative defaults and
 * each default is recorded in `assumptions` so nothing is assumed silently.
 * @param {any} input
 * @returns {{ brief: any, assumptions: string[] }}
 */
export function normalizeBrief(input) {
  const src = input && typeof input === 'object' ? input : {};
  /** @type {string[]} */
  const assumptions = [];
  const pick = (v, fallback, label) => {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) {
      assumptions.push(`${label} not supplied — assumed ${JSON.stringify(fallback)}.`);
      return fallback;
    }
    return v;
  };
  const oneOf = (v, allowed, label) => {
    const s = String(v).trim();
    const hit = allowed.find((x) => x.toLowerCase() === s.toLowerCase());
    if (!hit) throw new UserError(`Brief: ${label} must be one of ${allowed.join(' | ')} (got "${s}").`);
    return hit;
  };
  const brandIn = src.brand ?? {};
  const colors = list(brandIn.existingColors);
  for (const c of colors) if (!isHex(c)) throw new UserError(`Brief: brand.existingColors must be hex values like "#0f62fe" (got "${c}").`);
  const productCategory = String(pick(src.productCategory, 'saas', 'productCategory'));
  const requires3d = Boolean(pick(src.requires3d, false, 'requires3d'));
  const stackIn = src.stack ?? {};
  const brief = {
    productCategory,
    audience: String(pick(src.audience, 'general audience', 'audience')),
    brand: {
      name: String(pick(brandIn.name, 'Untitled', 'brand.name')),
      personality: list(brandIn.personality).map((s) => s.toLowerCase()),
      existingColors: colors.map((c) => c.toLowerCase()),
      existingFonts: list(brandIn.existingFonts),
    },
    businessGoals: list(src.businessGoals),
    targetDevices: list(pick(src.targetDevices, ['desktop', 'mobile'], 'targetDevices')).map((s) => s.toLowerCase()),
    preferredAesthetic: String(src.preferredAesthetic ?? ''),
    interactionComplexity: oneOf(pick(src.interactionComplexity, 'medium', 'interactionComplexity'), COMPLEXITY, 'interactionComplexity'),
    accessibility: {
      level: oneOf(pick(src.accessibility?.level, 'AA', 'accessibility.level'), ['AA', 'AAA'], 'accessibility.level'),
      needs: list(src.accessibility?.needs).map((s) => s.toLowerCase()),
    },
    performance: {
      budget: oneOf(pick(src.performance?.budget, 'balanced', 'performance.budget'), BUDGETS, 'performance.budget'),
      lowEndDevices: Boolean(pick(src.performance?.lowEndDevices, false, 'performance.lowEndDevices')),
    },
    stack: {
      framework: String(pick(stackIn.framework, 'unspecified', 'stack.framework')).toLowerCase(),
      styling: String(pick(stackIn.styling, 'css', 'stack.styling')).toLowerCase(),
      libs: list(stackIn.libs ?? stackIn.existingLibs ?? stackIn.existing).map((s) => s.toLowerCase()),
    },
    motionIntensity: oneOf(pick(src.motionIntensity, 'expressive', 'motionIntensity'), MOTION_PROFILES, 'motionIntensity'),
    requires3d,
    ...(requires3d ? { threeD: { purpose: String(pick(src.threeD?.purpose, 'ambient hero object', 'threeD.purpose')) } } : {}),
    specialty: '',
  };
  if (!brief.brand.personality.length) assumptions.push('brand.personality not supplied — direction scoring ignores personality.');
  if (!brief.businessGoals.length) assumptions.push('businessGoals not supplied — layout and component guidance is not goal-specific.');
  if (!brief.preferredAesthetic) assumptions.push('preferredAesthetic not supplied — direction chosen from category, audience and constraints only.');
  if (src.specialty) brief.specialty = oneOf(src.specialty, SPECIALTIES, 'specialty');
  else {
    const cat = canonicalCategory(productCategory);
    brief.specialty = (cat && SPECIALTY_BY_CATEGORY[cat]) || 'product';
    if (brief.specialty === '3d' && !requires3d) brief.specialty = 'product';
    assumptions.push(`specialty inferred from category "${productCategory}" → "${brief.specialty}".`);
  }
  return { brief, assumptions };
}

/** React-family frameworks (React Three Fiber / Motion for React are only valid here). */
export function isReactStack(stack) {
  const f = `${stack.framework} ${stack.libs.join(' ')}`;
  return /\b(react|next|nextjs|next\.js|remix|gatsby|react-router|tanstack-start|expo|preact)\b/.test(f) && !/\b(vue|nuxt|svelte|sveltekit|angular|solid|qwik)\b/.test(stack.framework);
}
