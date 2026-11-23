// @ts-check
/** Schema + semantic validation of a studio3.design.json document. */
import { loadSchema, validateSchema } from './schema.mjs';
import { applyOverrides } from './generate.mjs';
import { contrastReport, DATAVIZ_MIN_DELTA_E } from './palette.mjs';
import { hexToOklch, parseOklch, deltaEOk } from './color.mjs';
import { getPath, isPlainObject } from './util.mjs';
import { getDirection } from './directions.mjs';
import { isReactStack } from './brief.mjs';

/**
 * @param {any} input
 * @returns {{ valid: boolean, errors: { path: string, message: string, kind: 'schema' | 'semantic' }[], warnings: { path: string, message: string }[], checks: Record<string, number> }}
 */
export function validateDesign(input) {
  try { return validateDesignInner(input); } catch (e) {
    // Semantic checks assume the schema-required structure; report rather than crash on a malformed file.
    const schema = input && typeof input === 'object' ? validateSchema(input, loadSchema('studio3.design')) : { errors: [{ path: '', message: 'document must be a JSON object' }] };
    if (!schema.errors.length) throw e;
    return { valid: false, errors: [...schema.errors.map((x) => ({ ...x, kind: /** @type {'schema'} */ ('schema') })), { path: '', message: `semantic checks could not complete because the structure is invalid (${/** @type {Error} */ (e).message})`, kind: /** @type {'semantic'} */ ('semantic') }], warnings: [], checks: { schemaErrors: schema.errors.length, contrastPairs: 0, tokenReferences: 0, scales: 0, colorTokens: 0 } };
  }
}
function validateDesignInner(input) {
  /** @type {{ path: string, message: string, kind: 'schema' | 'semantic' }[]} */
  const errors = [];
  /** @type {{ path: string, message: string }[]} */
  const warnings = [];
  const checks = { schemaErrors: 0, contrastPairs: 0, tokenReferences: 0, scales: 0, colorTokens: 0 };
  if (!isPlainObject(input)) return { valid: false, errors: [{ path: '', message: 'document must be a JSON object', kind: 'schema' }], warnings, checks };
  const schema = validateSchema(input, loadSchema('studio3.design'));
  checks.schemaErrors = schema.errors.length;
  for (const e of schema.errors) errors.push({ ...e, kind: 'schema' });
  if (!input.color?.light?.roles || !input.color?.dark?.roles || !input.typography?.scale?.steps || !input.motion?.durations) return { valid: false, errors, warnings, checks };

  const doc = applyOverrides(input);
  const err = (path, message) => errors.push({ path, message, kind: 'semantic' });
  const level = doc.brief?.accessibility?.level ?? 'AA';

  // 1. Contrast — recomputed from the colour values, never trusted from the stored report.
  for (const mode of ['light', 'dark']) {
    const report = contrastReport(doc.color[mode], level);
    checks.contrastPairs += report.length;
    for (const r of report) if (!r.pass) err(`color.${mode}`, `${r.fg} on ${r.bg}: contrast ${r.ratio}:1 is below the required ${r.required}:1 (${r.kind}, ${level})`);
    const stored = input.color[mode].contrast;
    if (Array.isArray(stored)) {
      for (const s of stored) {
        const now = report.find((r) => r.fg === s.fg && r.bg === s.bg);
        if (now && Math.abs(now.ratio - s.ratio) > 0.011 && !doc.meta?.overridesApplied?.length) warnings.push({ path: `color.${mode}.contrast`, message: `stored ratio for ${s.fg} on ${s.bg} (${s.ratio}) differs from the recomputed value (${now.ratio}); the file was edited outside "overrides"` });
      }
    }
    const dv = doc.color[mode].dataViz;
    if (dv) {
      const hexes = dv.categorical.map((t) => t.hex);
      const min = Math.min(...hexes.map((h, i) => deltaEOk(h, hexes[(i + 1) % hexes.length])));
      if (min < DATAVIZ_MIN_DELTA_E) err(`color.${mode}.dataViz`, `adjacent categorical colours are too similar (min ΔE ${min.toFixed(3)} < ${DATAVIZ_MIN_DELTA_E})`);
    }
  }

  // 2. Colour tokens: hex and oklch must describe the same colour.
  const walk = (node, path) => {
    if (Array.isArray(node)) { node.forEach((n, i) => walk(n, `${path}.${i}`)); return; }
    if (!isPlainObject(node)) return;
    if (typeof node.hex === 'string' && typeof node.oklch === 'string') {
      checks.colorTokens++;
      const a = parseOklch(node.oklch);
      let b = null;
      try { b = hexToOklch(node.hex); } catch { /* reported by the schema */ }
      if (!a) err(path, `oklch value "${node.oklch}" is not parseable`);
      else if (b && (Math.abs(a.l - b.l) > 0.006 || Math.abs(a.c - b.c) > 0.006 || (b.c > 0.02 && Math.min(Math.abs(a.h - b.h), 360 - Math.abs(a.h - b.h)) > 2))) err(path, `hex ${node.hex} and ${node.oklch} describe different colours`);
      return;
    }
    for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
  };
  walk(input.color, 'color');

  // 3. Scale monotonicity.
  const increasing = (values, path, what) => {
    checks.scales++;
    for (let i = 1; i < values.length; i++) if (!(values[i] > values[i - 1])) { err(path, `${what} must increase strictly (${values[i - 1]} → ${values[i]} at position ${i})`); break; }
  };
  const steps = Object.values(doc.typography.scale.steps);
  increasing(steps.map((s) => s.minPx), 'typography.scale.steps', 'minPx');
  increasing(steps.map((s) => s.maxPx), 'typography.scale.steps', 'maxPx');
  for (const [k, s] of Object.entries(doc.typography.scale.steps)) if (s.maxPx < s.minPx) err(`typography.scale.steps.${k}`, `maxPx (${s.maxPx}) is smaller than minPx (${s.minPx})`);
  increasing(Object.entries(doc.spacing.scale).sort((a, b) => Number(a[0]) - Number(b[0])).map(([, v]) => v), 'spacing.scale', 'spacing values (by key)');
  const d = doc.motion.durations;
  increasing(['instant', 'fast', 'base', 'slow', 'slower', 'scene'].map((k) => d[k]), 'motion.durations', 'durations');
  const rs = doc.radius.scale;
  checks.scales++;
  const rv = ['none', 'sm', 'md', 'lg', 'xl', 'full'].map((k) => rs[k]);
  for (let i = 1; i < rv.length; i++) if (rv[i] < rv[i - 1]) { err('radius.scale', 'radius values must not decrease from none → full'); break; }
  for (const mode of ['light', 'dark']) {
    for (const ramp of Object.keys(doc.color.ramps)) {
      checks.scales++;
      const ls = Object.values(doc.color.ramps[ramp]).map((t) => { try { return hexToOklch(t.hex).l; } catch { return NaN; } });
      for (let i = 1; i < ls.length; i++) if (!(ls[i] < ls[i - 1])) { err(`color.ramps.${ramp}`, 'ramp lightness must decrease from 50 → 950'); break; }
    }
    break;
  }
  const ch = doc.spacing.density.controlHeight;
  if (Math.min(ch.sm, ch.md, ch.lg) < 24) err('spacing.density.controlHeight', 'control heights must be at least 24px (WCAG 2.5.8)');
  if (doc.components.targetSize.minimumPx < 24) err('components.targetSize.minimumPx', 'minimum target size must be at least 24px');
  for (const [k, e] of Object.entries(doc.motion.easings)) {
    const [x1, , x2] = e.bezier;
    if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) err(`motion.easings.${k}`, 'cubic-bezier x control points must be within 0–1');
  }
  if (doc.motion.reducedMotion.maxReplacementMs > 200) err('motion.reducedMotion.maxReplacementMs', 'reduced-motion replacement must be ≤ 200ms');

  // 4. Token references: every "{a.b.c}" must resolve inside the document.
  const refs = (node, path) => {
    if (typeof node === 'string') {
      for (const m of node.matchAll(/\{([a-zA-Z0-9_.-]+)\}/g)) {
        checks.tokenReferences++;
        const target = m[1].startsWith('color.roles.') || m[1].startsWith('color.semantic.') ? m[1].replace(/^color\./, `color.${doc.color.defaultMode}.`) : m[1];
        if (getPath(doc, target) === undefined) err(path, `token reference {${m[1]}} does not resolve`);
      }
    } else if (Array.isArray(node)) node.forEach((n, i) => refs(n, `${path}[${i}]`));
    else if (isPlainObject(node)) for (const [k, v] of Object.entries(node)) if (k !== 'overrides' && k !== 'brief') refs(v, path ? `${path}.${k}` : k);
  };
  refs(doc, '');

  // 5. Cross-section consistency.
  if (!getDirection(doc.visualDirection.id)) warnings.push({ path: 'visualDirection.id', message: `"${doc.visualDirection.id}" is not a built-in direction (custom directions are allowed)` });
  if (doc.brief.requires3d && !doc.threeD) err('threeD', 'brief.requires3d is true but the threeD section is missing');
  if (!doc.brief.requires3d && doc.threeD) warnings.push({ path: 'threeD', message: 'threeD section present although brief.requires3d is false' });
  if (doc.motion.profile !== doc.brief.motionIntensity) err('motion.profile', `motion.profile (${doc.motion.profile}) does not match brief.motionIntensity (${doc.brief.motionIntensity})`);
  if (doc.brief.specialty === 'data' && !doc.color.light.dataViz) err('color.light.dataViz', 'specialty is "data" but no data-visualisation palette is present');
  const react = isReactStack({ libs: [], ...doc.brief.stack });
  if (!react && doc.libraries.recommended.some((r) => /react-three|@react-three/.test(`${r.name} ${r.package ?? ''}`))) err('libraries.recommended', 'React Three Fiber is recommended for a non-React stack');
  if (doc.meta.overridesIgnored?.length) warnings.push({ path: 'overrides', message: `overrides for protected sections are ignored: ${doc.meta.overridesIgnored.join(', ')}` });

  return { valid: errors.length === 0, errors, warnings, checks };
}
