import { describe, it, expect } from 'vitest';
import {
  hexToRgb, rgbToHex, hexToOklch, oklchToHex, gamutMap, inSrgbGamut, relativeLuminance, contrastRatio,
  fitContrast, formatOklch, parseOklch, token, deltaEOk, simulateCvd, srgbToLinear, linearToSrgb,
} from '../../../plugins/maquettekit/tools/design-intelligence/color.mjs';
import { createRng, stableStringify, hashOf, deepMerge } from '../../../plugins/maquettekit/tools/design-intelligence/util.mjs';
import { validateSchema } from '../../../plugins/maquettekit/tools/design-intelligence/schema.mjs';

describe('colour maths', () => {
  it('parses and formats hex', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 1, g: 1, b: 1 });
    expect(rgbToHex(hexToRgb('#0F62FE'))).toBe('#0f62fe');
    expect(() => hexToRgb('#12')).toThrow(/Invalid hex/);
  });
  it('round-trips the sRGB transfer function', () => {
    for (const v of [0, 0.01, 0.04045, 0.2, 0.5, 0.9, 1]) expect(linearToSrgb(srgbToLinear(v))).toBeCloseTo(v, 6);
  });
  it('converts sRGB primaries to the published OKLCH values', () => {
    // Reference values: CSS Color 4 / oklch.com
    const cases = { '#ff0000': [0.62796, 0.25768, 29.234], '#00ff00': [0.86644, 0.29483, 142.495], '#0000ff': [0.45201, 0.31321, 264.052], '#ffff00': [0.96798, 0.21101, 109.769] };
    for (const [hex, [l, c, h]] of Object.entries(cases)) {
      const o = hexToOklch(hex);
      expect(o.l).toBeCloseTo(l, 3);
      expect(o.c).toBeCloseTo(c, 3);
      expect(o.h).toBeCloseTo(h, 1);
    }
    expect(hexToOklch('#ffffff').l).toBeCloseTo(1, 4);
    expect(hexToOklch('#ffffff').c).toBeLessThan(1e-4);
    expect(hexToOklch('#000000').l).toBeCloseTo(0, 6);
    expect(hexToOklch('#808080').l).toBeCloseTo(0.5999, 3);
  });
  it('round-trips hex → OKLCH → hex for a spread of colours', () => {
    for (const hex of ['#000000', '#ffffff', '#ff0000', '#0f62fe', '#7c3aed', '#16a34a', '#f59e0b', '#123456', '#abcdef', '#808080']) expect(oklchToHex(hexToOklch(hex))).toBe(hex);
  });
  it('gamut-maps by reducing chroma only', () => {
    const wild = { l: 0.7, c: 0.4, h: 150 };
    expect(inSrgbGamut(wild)).toBe(false);
    const m = gamutMap(wild);
    expect(inSrgbGamut(m)).toBe(true);
    expect(m.l).toBe(0.7);
    expect(m.h).toBe(150);
    expect(m.c).toBeLessThan(0.4);
    expect(m.c).toBeGreaterThan(0.15);
    // the result sits on the gamut boundary: slightly more chroma leaves the gamut
    expect(inSrgbGamut({ ...m, c: m.c + 0.01 })).toBe(false);
    expect(gamutMap({ l: 0.5, c: 0.05, h: 20 })).toEqual({ l: 0.5, c: 0.05, h: 20 });
    expect(gamutMap({ l: 1.2, c: 0.2, h: 20 })).toEqual({ l: 1, c: 0, h: 20 });
    expect(gamutMap({ l: 0.5, c: 0.1, h: -30 }).h).toBe(330);
  });
  it('computes WCAG relative luminance and contrast', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 6);
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#808080')).toBeCloseTo(0.2159, 4);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 6);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 6);
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2); // lightest grey passing AA on white
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    expect(contrastRatio('#595959', '#ffffff')).toBeCloseTo(7.0, 1);
    expect(contrastRatio('#0000ff', '#ffffff')).toBeCloseTo(8.59, 2);
    expect(contrastRatio('#ff0000', '#ffffff')).toBeCloseTo(4.0, 1);
  });
  it('fitContrast darkens on light and lightens on dark until the target is met', () => {
    const a = fitContrast({ l: 0.8, c: 0.1, h: 250 }, ['#ffffff', '#f4f4f4'], 7);
    expect(a.adjusted).toBe(true);
    expect(a.lch.l).toBeLessThan(0.8);
    expect(contrastRatio(a.hex, '#ffffff')).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(a.hex, '#f4f4f4')).toBeGreaterThanOrEqual(7);
    const b = fitContrast({ l: 0.3, c: 0.1, h: 30 }, ['#111111'], 4.5);
    expect(b.lch.l).toBeGreaterThan(0.3);
    expect(contrastRatio(b.hex, '#111111')).toBeGreaterThanOrEqual(4.5);
    const c = fitContrast({ l: 0.2, c: 0.02, h: 0 }, ['#ffffff'], 4.5);
    expect(c.adjusted).toBe(false);
    expect(c.steps).toBe(0);
  });
  it('formats and parses oklch strings; tokens are self-consistent', () => {
    expect(formatOklch({ l: 0.62796, c: 0.25768, h: 29.234 })).toBe('oklch(62.8% 0.2577 29.23)');
    expect(parseOklch('oklch(62.8% 0.2577 29.23)')).toEqual({ l: 0.628, c: 0.2577, h: 29.23 });
    const t = token({ l: 0.6, c: 0.5, h: 300 });
    expect(t.hex).toMatch(/^#[0-9a-f]{6}$/);
    const back = hexToOklch(t.hex);
    const parsed = parseOklch(t.oklch);
    expect(parsed.l).toBeCloseTo(back.l, 3);
    expect(parsed.c).toBeCloseTo(back.c, 3);
  });
  it('ΔE and CVD simulation behave sensibly', () => {
    expect(deltaEOk('#336699', '#336699')).toBe(0);
    expect(deltaEOk('#000000', '#ffffff')).toBeCloseTo(1, 3);
    expect(simulateCvd('#808080', 'deutan')).toMatch(/^#7f7f7f|#808080|#818181$/); // greys are preserved
    // red and green collapse toward each other for a deuteranope
    expect(deltaEOk(simulateCvd('#d00000', 'deutan'), simulateCvd('#3a8f00', 'deutan'))).toBeLessThan(deltaEOk('#d00000', '#3a8f00') * 0.6);
  });
});

describe('utilities', () => {
  it('seeded PRNG is reproducible, stream-independent and roughly uniform', () => {
    const a = createRng(42)('x'); const b = createRng(42)('x'); const c = createRng(43)('x'); const d = createRng(42)('y');
    const seqA = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(seqA);
    expect(Array.from({ length: 5 }, c)).not.toEqual(seqA);
    expect(Array.from({ length: 5 }, d)).not.toEqual(seqA);
    const r = createRng('u')('s');
    const xs = Array.from({ length: 4000 }, r);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    expect(xs.reduce((s, x) => s + x, 0) / xs.length).toBeGreaterThan(0.47);
    expect(xs.reduce((s, x) => s + x, 0) / xs.length).toBeLessThan(0.53);
  });
  it('stable stringify / hash ignore key order', () => {
    expect(stableStringify({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe('{"a":[2,{"c":2,"d":1}],"b":1}');
    expect(hashOf({ a: 1, b: 2 })).toBe(hashOf({ b: 2, a: 1 }));
    expect(hashOf({ a: 1 })).not.toBe(hashOf({ a: 2 }));
  });
  it('deepMerge merges objects and replaces arrays/scalars without mutating', () => {
    const base = { a: { b: 1, c: [1, 2] }, d: 1 };
    const out = deepMerge(base, { a: { c: [3], e: 2 }, d: 5 });
    expect(out).toEqual({ a: { b: 1, c: [3], e: 2 }, d: 5 });
    expect(base).toEqual({ a: { b: 1, c: [1, 2] }, d: 1 });
  });
});

describe('in-house JSON Schema validator', () => {
  const schema = {
    type: 'object', required: ['name', 'level'], additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 2, pattern: '^[a-z]+$' }, level: { type: 'string', enum: ['AA', 'AAA'] },
      n: { type: 'integer', minimum: 1, maximum: 5 }, tags: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 2 },
      c: { $ref: '#/$defs/color' }, map: { type: 'object', additionalProperties: { type: 'number' } }, nullable: { type: ['string', 'null'] },
    },
    $defs: { color: { type: 'object', required: ['hex'], properties: { hex: { type: 'string', pattern: '^#[0-9a-f]{6}$' } } } },
  };
  it('accepts a valid document', () => {
    expect(validateSchema({ name: 'abc', level: 'AA', n: 3, tags: ['x'], c: { hex: '#00ff00' }, map: { a: 1 }, nullable: null }, schema)).toEqual({ valid: true, errors: [] });
  });
  it('reports each kind of violation with a path', () => {
    const res = validateSchema({ name: 'A', level: 'A', n: 7.5, tags: [], c: { hex: 'red' }, map: { a: 'x' }, extra: 1, nullable: 3 }, schema);
    expect(res.valid).toBe(false);
    const byPath = Object.fromEntries(res.errors.map((e) => [e.path, e.message]));
    expect(byPath.level).toMatch(/one of/);
    expect(byPath.n).toMatch(/expected integer/);
    expect(byPath.tags).toMatch(/at least 1/);
    expect(byPath['c.hex']).toMatch(/must match/);
    expect(byPath['map.a']).toMatch(/expected number/);
    expect(byPath.extra).toMatch(/not an allowed property/);
    expect(byPath.nullable).toMatch(/expected string \| null/);
    expect(res.errors.filter((e) => e.path === 'name').length).toBe(2); // minLength + pattern
    expect(validateSchema({ level: 'AA' }, schema).errors[0]).toEqual({ path: 'name', message: 'is required' });
    expect(validateSchema({ name: 'ab', level: 'AA', n: 9 }, schema).errors[0].message).toMatch(/≤ 5/);
    expect(validateSchema({ name: 'ab', level: 'AA', tags: [1, 'a', 'b'] }, schema).errors.map((e) => e.path)).toEqual(['tags', 'tags[0]']);
  });
});
