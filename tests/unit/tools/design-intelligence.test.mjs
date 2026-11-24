import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { generateDesign, regenerateDesign, applyOverrides } from '../../../plugins/maquettekit/tools/design-intelligence/generate.mjs';
import { validateDesign } from '../../../plugins/maquettekit/tools/design-intelligence/validate.mjs';
import { explainDesign } from '../../../plugins/maquettekit/tools/design-intelligence/explain.mjs';
import { toCss, toTailwind, toTs, toDtcg, exportTokens } from '../../../plugins/maquettekit/tools/design-intelligence/exports.mjs';
import { DIRECTIONS, GLOBAL_AVOID } from '../../../plugins/maquettekit/tools/design-intelligence/directions.mjs';
import { FONTS, resolveFont } from '../../../plugins/maquettekit/tools/design-intelligence/fonts.mjs';
import { normalizeBrief, briefTemplate, canonicalCategory, isReactStack } from '../../../plugins/maquettekit/tools/design-intelligence/brief.mjs';
import { loadSchema, validateSchema } from '../../../plugins/maquettekit/tools/design-intelligence/schema.mjs';
import { contrastRatio, hexToOklch } from '../../../plugins/maquettekit/tools/design-intelligence/color.mjs';
import { getPath } from '../../../plugins/maquettekit/tools/design-intelligence/util.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const CLI = path.join(ROOT, 'plugins/maquettekit/tools/maquettekit.mjs');
const cli = (args, opts = {}) => spawnSync(process.execPath, [CLI, 'design', ...args], { encoding: 'utf8', ...opts });

const BASE = {
  productCategory: 'saas', audience: 'operations leads', brand: { name: 'Acme', personality: ['precise', 'calm'], existingColors: [], existingFonts: [] },
  businessGoals: ['Increase trial conversion'], targetDevices: ['desktop', 'mobile'], preferredAesthetic: 'clean, modern', interactionComplexity: 'medium',
  accessibility: { level: 'AA', needs: [] }, performance: { budget: 'balanced', lowEndDevices: false }, stack: { framework: 'next', styling: 'tailwind', libs: [] },
  motionIntensity: 'expressive', requires3d: false,
};
const brief = (over = {}) => ({ ...BASE, ...over });
const hueDiff = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

describe('art directions', () => {
  it('ships at least 12 distinct, complete directions', () => {
    expect(DIRECTIONS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(DIRECTIONS.map((d) => d.id)).size).toBe(DIRECTIONS.length);
    expect(new Set(DIRECTIONS.map((d) => d.thesis)).size).toBe(DIRECTIONS.length);
    for (const d of DIRECTIONS) {
      expect(d.thesis.length, d.id).toBeGreaterThan(40);
      expect(d.principles.length, d.id).toBeGreaterThanOrEqual(3);
      expect(d.avoid.length, d.id).toBeGreaterThanOrEqual(3);
      for (const k of ['display', 'text', 'mono']) expect(FONTS[d.fonts[k]], `${d.id}.${k}`).toBeDefined();
      expect(d.threeD.artDirection.length, d.id).toBeGreaterThan(20);
      expect(Object.keys(d.fit.categories).length, d.id).toBeGreaterThanOrEqual(5);
    }
  });
  it('uses varied, open-licensed type pairings (not Inter everywhere)', () => {
    const pairings = new Set(DIRECTIONS.map((d) => `${d.fonts.display}/${d.fonts.text}`));
    expect(pairings.size).toBe(DIRECTIONS.length);
    const displays = new Set(DIRECTIONS.map((d) => d.fonts.display));
    expect(displays.size).toBeGreaterThanOrEqual(12);
    expect(DIRECTIONS.filter((d) => d.fonts.display === 'inter' || d.fonts.text === 'inter').length).toBeLessThanOrEqual(1);
    for (const f of Object.values(FONTS)) {
      expect(f.license).toBe('SIL Open Font License 1.1');
      expect(f.package).toMatch(/^@fontsource(-variable)?\/[a-z0-9-]+$/);
    }
  });
  it('bans formulaic AI aesthetics in every generated direction', () => {
    expect(GLOBAL_AVOID.join(' ')).toMatch(/purple→blue/);
    expect(GLOBAL_AVOID.join(' ')).toMatch(/[Gg]lassmorphism/);
    expect(GLOBAL_AVOID.join(' ')).toMatch(/centred hero/);
    for (const d of DIRECTIONS) {
      const doc = generateDesign(brief(), { seed: 1, direction: d.id });
      expect(doc.visualDirection.id).toBe(d.id);
      for (const a of GLOBAL_AVOID) expect(doc.visualDirection.avoid).toContain(a);
      for (const a of d.avoid) expect(doc.visualDirection.avoid).toContain(a);
    }
  });
});

describe('contrast guarantees', () => {
  for (const level of ['AA', 'AAA']) {
    it(`every direction × light/dark passes all required pairs at ${level}`, () => {
      const textTarget = level === 'AAA' ? 7 : 4.5;
      for (const d of DIRECTIONS) {
        for (const seed of [1, 7]) {
          const doc = generateDesign(brief({ accessibility: { level, needs: [] }, specialty: 'data' }), { seed, direction: d.id });
          for (const mode of ['light', 'dark']) {
            const m = doc.color[mode];
            expect(m.contrast.length).toBeGreaterThan(40);
            for (const pair of m.contrast) {
              // recompute independently of the stored report
              const ratio = contrastRatio(getPath(m, pair.fg).hex, getPath(m, pair.bg).hex);
              const required = pair.kind === 'text' ? textTarget : 3;
              expect(pair.required).toBe(required);
              expect(ratio, `${d.id} ${mode} ${level} ${pair.fg} on ${pair.bg}`).toBeGreaterThanOrEqual(required);
              expect(pair.pass).toBe(true);
              expect(Math.abs(pair.ratio - ratio)).toBeLessThan(0.011);
            }
            // spot-check the pairs that matter most are in the report
            for (const [fg, bg] of [['roles.text', 'roles.bg'], ['roles.textMuted', 'roles.surfaceSunken'], ['roles.onPrimary', 'roles.primary'], ['roles.focusRing', 'roles.bg'], ['semantic.danger.text', 'semantic.danger.subtle']]) {
              expect(m.contrast.some((p) => p.fg === fg && p.bg === bg), `${fg} on ${bg}`).toBe(true);
            }
            expect(m.dataViz.check.pass, `${d.id} ${mode} dataviz`).toBe(true);
          }
          expect(validateDesign(doc).errors, `${d.id} ${level}`).toEqual([]);
        }
      }
    });
  }
  it('records lightness adjustments when a brand colour cannot meet contrast as supplied', () => {
    const doc = generateDesign(brief({ brand: { ...BASE.brand, existingColors: ['#ffd400'] }, accessibility: { level: 'AAA', needs: [] } }), { seed: 3 });
    expect(doc.color.adjustments.length).toBeGreaterThan(0);
    const adj = doc.color.adjustments.find((a) => a.role === 'primaryText' && a.mode === 'light');
    expect(adj).toBeDefined();
    expect(adj.from).not.toBe(adj.to);
    expect(adj.lightnessSteps).toBeGreaterThan(0);
    expect(contrastRatio(doc.color.light.roles.primaryText.hex, doc.color.light.roles.bg.hex)).toBeGreaterThanOrEqual(7);
  });
});

describe('determinism', () => {
  it('same brief + seed → byte-identical JSON; no timestamp when seeded', () => {
    const a = JSON.stringify(generateDesign(brief({ requires3d: true, threeD: { purpose: 'interactive product configurator' } }), { seed: 42 }));
    const b = JSON.stringify(generateDesign(brief({ requires3d: true, threeD: { purpose: 'interactive product configurator' } }), { seed: 42 }));
    expect(a).toBe(b);
    expect(a).not.toMatch(/generatedAt/);
    expect(JSON.parse(a).history[0].date).toBeUndefined();
  });
  it('different seeds vary the palette when no brand colour is given; key order in the brief is irrelevant', () => {
    const hues = new Set([1, 2, 3, 4, 5].map((seed) => generateDesign(brief(), { seed, direction: 'playful-geometric' }).color.brand.hue));
    expect(hues.size).toBeGreaterThan(3);
    const shuffled = Object.fromEntries(Object.entries(brief()).reverse());
    expect(generateDesign(shuffled, { seed: 9 })).toEqual(generateDesign(brief(), { seed: 9 }));
    expect(generateDesign(shuffled).meta.briefHash).toBe(generateDesign(brief()).meta.briefHash);
  });
  it('without a seed the brief hash seeds the generator (still deterministic) and `now` is recorded', () => {
    const a = generateDesign(brief(), { now: '2026-01-01T00:00:00.000Z' });
    const b = generateDesign(brief(), { now: '2026-01-01T00:00:00.000Z' });
    expect(a).toEqual(b);
    expect(a.meta.generatedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(a.meta.seedSource).toBe('brief-hash');
    expect(a.meta.seed).toBe(a.meta.briefHash);
  });
});

describe('schema validity across a matrix of briefs', () => {
  const schema = loadSchema('maquettekit.design');
  const specialties = ['product', 'cinematic', 'data', 'social', '3d'];
  const motions = ['essential', 'expressive', 'immersive'];
  const stacks = [{ framework: 'next', styling: 'tailwind', libs: [] }, { framework: 'vue', styling: 'css', libs: [] }, { framework: 'sveltekit', styling: 'scss', libs: ['gsap'] }, { framework: 'astro', styling: 'tailwind', libs: [] }, { framework: 'react', styling: 'css-modules', libs: ['framer-motion'] }];
  let n = 0;
  for (const specialty of specialties) {
    for (const motionIntensity of motions) {
      for (const requires3d of [false, true]) {
        const stack = stacks[n++ % stacks.length];
        it(`${specialty} / ${motionIntensity} / 3d=${requires3d} / ${stack.framework}`, () => {
          const doc = generateDesign(brief({ specialty, motionIntensity, requires3d, stack, ...(requires3d ? { threeD: { purpose: 'interactive product viewer' } } : {}) }), { seed: n });
          const res = validateSchema(doc, schema);
          expect(res.errors).toEqual([]);
          const sem = validateDesign(doc);
          expect(sem.errors).toEqual([]);
          expect(sem.checks.tokenReferences).toBeGreaterThan(10);
          expect(doc.motion.profile).toBe(motionIntensity);
          expect(Boolean(doc.threeD)).toBe(requires3d);
          expect(Boolean(doc.color.light.dataViz)).toBe(specialty === 'data');
          expect(doc.specialtyNotes.specialty).toBe(specialty);
          const recommended = JSON.stringify(doc.libraries.recommended);
          if (!isReactStack(stack)) {
            expect(recommended).not.toMatch(/react-three|React Three Fiber|motion\/react|for React/);
            if (requires3d) expect(doc.threeD.technology.recommendation).toBe('Three.js');
            expect(doc.libraries.avoid.some((x) => /React Three Fiber/.test(x.name))).toBe(true);
          } else if (requires3d) {
            expect(doc.threeD.technology.recommendation).toBe('React Three Fiber');
            expect(doc.threeD.technology.packages).toEqual(['three', '@react-three/fiber', '@react-three/drei']);
          }
          if (requires3d) {
            expect(doc.threeD.technology.webgpu).toMatch(/feature detection/);
            expect(doc.threeD.qualityProfiles.note).toMatch(/[Ss]tarting points/);
            expect(doc.threeD.qualityProfiles.lowPower.dprMax).toBeLessThanOrEqual(doc.threeD.qualityProfiles.desktop.dprMax);
          }
          expect(doc.performance.note).toMatch(/starting budgets/);
        });
      }
    }
  }
  it('profile changes the motion system', () => {
    const [e, x, i] = motions.map((m) => generateDesign(brief({ motionIntensity: m }), { seed: 1, direction: 'soft-tactile' }));
    expect(e.motion.durations.base).toBeLessThan(i.motion.durations.base);
    expect(e.motion.presets.length).toBeLessThan(x.motion.presets.length);
    expect(x.motion.presets.length).toBeLessThan(i.motion.presets.length);
    expect(e.motion.stagger.eachMs).toBe(0);
    expect(e.motion.presets.every((p) => p.minProfile === 'essential')).toBe(true);
    expect(i.motion.presets.some((p) => p.name === 'scroll-scene' && p.reducedMotionTier === 'remove')).toBe(true);
    for (const d of [e, x, i]) {
      expect(Object.keys(d.motion.reducedMotion.tiers)).toEqual(['remove', 'replace', 'keep']);
      expect(d.motion.reducedMotion.maxReplacementMs).toBeLessThanOrEqual(200);
      expect(Object.keys(d.motion.springs)).toEqual(['default', 'snappy', 'smooth', 'gentle', 'bouncy']);
    }
    expect(i.libraries.recommended.some((r) => r.package === 'gsap')).toBe(true);
    expect(e.libraries.recommended.some((r) => r.package === 'gsap')).toBe(false);
  });
  it('Rapier is recommended only when physics is justified; simple purposes get CSS 3D or static renders', () => {
    const mk = (purpose, extra = {}) => generateDesign(brief({ requires3d: true, threeD: { purpose }, ...extra }), { seed: 1 }).threeD.technology;
    expect(mk('physics sandbox with collisions').packages).toContain('@react-three/rapier');
    expect(mk('interactive product configurator').packages).not.toContain('@react-three/rapier');
    expect(mk('card tilt on hover').recommendation).toBe('CSS 3D');
    expect(mk('decorative ambient background', { performance: { budget: 'tight', lowEndDevices: true } }).recommendation).toBe('Static renders');
    expect(mk('designer-authored Spline scene').recommendation).toBe('Spline embed');
    expect(mk('interactive product configurator').considered.map((c) => c.option)).toEqual(['CSS 3D', 'Three.js', 'React Three Fiber', 'Spline embed', 'Static renders']);
  });
  it('respects libraries already in the stack', () => {
    const doc = generateDesign(brief({ stack: { framework: 'next', styling: 'tailwind', libs: ['gsap'] }, motionIntensity: 'immersive' }), { seed: 1 });
    const gsap = doc.libraries.recommended.filter((r) => r.package === 'gsap');
    expect(gsap.length).toBe(1);
    expect(gsap[0].status).toBe('already in stack');
  });
});

describe('brief handling', () => {
  it('normalises partial briefs and records every assumption', () => {
    const { brief: b, assumptions } = normalizeBrief({ productCategory: 'Analytics dashboard' });
    expect(validateSchema(b, loadSchema('brief')).errors).toEqual([]);
    expect(b.specialty).toBe('data');
    expect(assumptions.some((a) => /audience not supplied/.test(a))).toBe(true);
    expect(assumptions.some((a) => /specialty inferred/.test(a))).toBe(true);
    expect(() => normalizeBrief({ motionIntensity: 'wild' })).toThrow(/essential \| expressive \| immersive/);
    expect(() => normalizeBrief({ brand: { existingColors: ['blue'] } })).toThrow(/hex/);
    expect(canonicalCategory('B2B fintech for SMEs')).toBe('fintech');
    expect(canonicalCategory('zzz')).toBeNull();
  });
  it('the init template normalises cleanly once comment keys are stripped', () => {
    const t = briefTemplate();
    const clean = JSON.parse(JSON.stringify(t, (k, v) => (k.startsWith('_') || k === '$schema' ? undefined : v)));
    const doc = generateDesign(clean, { seed: 1 });
    expect(validateDesign(doc).valid).toBe(true);
  });
  it('selection is transparent: breakdown sums to the score and a runner-up is named', () => {
    const doc = generateDesign(brief({ productCategory: 'developer tools', audience: 'backend engineers', preferredAesthetic: 'technical, minimal, precise', interactionComplexity: 'high' }), { seed: 1 });
    const sel = doc.meta.selection;
    expect(['technical-mono', 'terminal-dense']).toContain(doc.visualDirection.id);
    const sum = Object.values(sel.chosen.breakdown).reduce((s, p) => s + p.contribution, 0) + sel.chosen.jitter;
    expect(sum).toBeCloseTo(sel.chosen.score, 3);
    expect(Object.values(sel.weights).reduce((s, w) => s + w, 0)).toBeCloseTo(1, 10);
    expect(sel.runnerUp.id).not.toBe(sel.chosen.id);
    expect(sel.ranking.length).toBe(DIRECTIONS.length);
    expect(sel.ranking[0].score).toBeGreaterThanOrEqual(sel.ranking[1].score);
  });
  it('different briefs select different directions', () => {
    const pick = (o) => generateDesign(brief(o), { seed: 1 }).visualDirection.id;
    const ids = new Set([
      pick({ productCategory: 'luxury fashion', audience: 'affluent collectors', preferredAesthetic: 'quiet, elegant, refined', brand: { ...BASE.brand, personality: ['timeless'] } }),
      pick({ productCategory: 'government service', audience: 'citizens and seniors', preferredAesthetic: 'plain, accessible, clear', accessibility: { level: 'AAA', needs: ['low-vision'] }, motionIntensity: 'essential' }),
      pick({ productCategory: 'film festival', audience: 'film fans', preferredAesthetic: 'dark, cinematic, dramatic', motionIntensity: 'immersive', brand: { ...BASE.brand, personality: ['bold'] } }),
      pick({ productCategory: 'kids education', audience: 'students and teachers', preferredAesthetic: 'playful, colourful, fun', brand: { ...BASE.brand, personality: ['joyful'] } }),
      pick({ productCategory: 'developer tools', audience: 'developers', preferredAesthetic: 'terminal, dense, keyboard', interactionComplexity: 'high', motionIntensity: 'essential' }),
    ]);
    expect(ids).toEqual(new Set(['luxury-quiet', 'civic-clear', 'dark-cinema', 'playful-geometric', 'terminal-dense']));
    expect(pick({ preferredAesthetic: 'something like neo-retro-signal please' })).toBe('neo-retro-signal');
  });
});

describe('brand respect', () => {
  it('derives the palette from brand.existingColors', () => {
    const brand = '#e4572e';
    const doc = generateDesign(brief({ brand: { ...BASE.brand, existingColors: [brand, '#17bebb'] } }), { seed: 5 });
    const bh = hexToOklch(brand).h;
    expect(doc.color.brand.source).toBe(brand);
    expect(hueDiff(doc.color.brand.hue, bh)).toBeLessThan(0.5);
    for (const mode of ['light', 'dark']) {
      expect(hueDiff(hexToOklch(doc.color[mode].roles.primary.hex).h, bh), mode).toBeLessThan(4);
      expect(hueDiff(hexToOklch(doc.color[mode].roles.accent.hex).h, hexToOklch('#17bebb').h), mode).toBeLessThan(6);
    }
    expect(hueDiff(hexToOklch(doc.color.ramps.brand['500'].hex).h, bh)).toBeLessThan(4);
    // neutrals are tinted toward the brand hue (warm side for an orange brand), not pure grey
    const n = hexToOklch(doc.color.ramps.neutral['500'].hex);
    expect(n.c).toBeGreaterThan(0.002);
    expect(hueDiff(n.h, bh)).toBeLessThan(40);
    // a compliant brand colour is used exactly when it already passes
    const exact = generateDesign(brief({ brand: { ...BASE.brand, existingColors: ['#0b5fff'] } }), { seed: 5 });
    expect(exact.color.light.roles.primary.hex).toBe('#0b5fff');
  });
  it('ignores achromatic brand colours for hue and keeps existing fonts', () => {
    const doc = generateDesign(brief({ brand: { ...BASE.brand, existingColors: ['#111111'], existingFonts: ['Söhne', 'Fraunces'] } }), { seed: 5 });
    expect(doc.color.brand.source).toBe('direction-default');
    expect(doc.typography.families.display.family).toBe('Söhne');
    expect(doc.typography.families.display.source).toBe('brand-supplied');
    expect(doc.typography.families.display.license).toMatch(/confirm/i);
    expect(doc.typography.families.text.family).toBe('Fraunces');
    expect(doc.typography.families.text.source).toBe('@fontsource-variable/fraunces');
    expect(resolveFont('inter', 'text').stack).toMatch(/^"Inter Variable", "Inter", ui-sans-serif/);
  });
});

describe('typography and scales', () => {
  it('fluid clamp() values are computed from the min/max viewport and are monotonic', () => {
    for (const d of DIRECTIONS) {
      const t = generateDesign(brief(), { seed: 1, direction: d.id }).typography;
      const steps = Object.values(t.scale.steps);
      for (let i = 1; i < steps.length; i++) {
        expect(steps[i].minPx).toBeGreaterThan(steps[i - 1].minPx);
        expect(steps[i].maxPx).toBeGreaterThan(steps[i - 1].maxPx);
      }
      for (const s of steps) {
        expect(s.maxPx).toBeGreaterThanOrEqual(s.minPx);
        const m = /^clamp\(([\d.]+)rem, (-?[\d.]+)rem \+ ([\d.]+)vw, ([\d.]+)rem\)$/.exec(s.clamp);
        if (!m) { expect(s.clamp).toMatch(/^[\d.]+rem$/); continue; }
        const [min, intercept, vw, max] = m.slice(1).map(Number);
        expect(min * 16).toBeCloseTo(s.minPx, 1);
        expect(max * 16).toBeCloseTo(s.maxPx, 1);
        // the preferred value hits min at 360px and max at 1440px
        expect(intercept * 16 + (vw / 100) * 360).toBeCloseTo(s.minPx, 0);
        expect(intercept * 16 + (vw / 100) * 1440).toBeCloseTo(s.maxPx, 0);
      }
      expect(t.rules.join(' ')).toMatch(/45–75 characters/);
      for (const f of Object.values(t.families)) { expect(f.license).toBeTruthy(); expect(f.fallbackMetrics).toBeTruthy(); expect(f.stack).toMatch(/,/); }
    }
  });
  it('components guarantee target sizes and the full state list', () => {
    const doc = generateDesign(brief(), { seed: 1, direction: 'terminal-dense' });
    expect(doc.components.targetSize.minimumPx).toBe(24);
    expect(doc.components.targetSize.recommendedTouchPx).toBe(44);
    expect(Math.min(...Object.values(doc.spacing.density.controlHeight))).toBeGreaterThanOrEqual(24);
    expect(doc.components.states).toEqual(['default', 'hover', 'focus-visible', 'active', 'disabled', 'loading', 'error']);
    expect(doc.typography.scale.basePx.min).toBeGreaterThanOrEqual(14); // raised for touch devices
  });
});

describe('semantic validation catches broken documents', () => {
  const good = () => generateDesign(brief({ specialty: 'data' }), { seed: 11 });
  it('fails on insufficient contrast', () => {
    const doc = good();
    doc.color.light.roles.textMuted = { hex: '#c8c8c8', oklch: 'oklch(83.2% 0 0)' };
    const res = validateDesign(doc);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.kind === 'semantic' && /roles\.textMuted on roles\.bg: contrast .* below the required 4\.5:1/.test(e.message))).toBe(true);
  });
  it('fails on non-monotonic scales, bad references, mismatched tokens and schema violations', () => {
    const a = good(); a.typography.scale.steps.lg.minPx = 10;
    expect(validateDesign(a).errors.some((e) => /minPx must increase/.test(e.message))).toBe(true);
    const b = good(); b.motion.durations.slow = 100;
    expect(validateDesign(b).errors.some((e) => e.path === 'motion.durations')).toBe(true);
    const c = good(); c.components.buttons.radius = '{radius.scale.huge}';
    expect(validateDesign(c).errors.some((e) => /\{radius\.scale\.huge\} does not resolve/.test(e.message))).toBe(true);
    const d = good(); d.color.dark.roles.bg.oklch = 'oklch(90% 0.1 20)';
    expect(validateDesign(d).errors.some((e) => /describe different colours/.test(e.message))).toBe(true);
    const e = good(); delete e.motion.reducedMotion; e.color.space = 'hsl';
    const res = validateDesign(e);
    expect(res.errors.some((x) => x.kind === 'schema' && x.path === 'motion.reducedMotion')).toBe(true);
    expect(res.errors.some((x) => x.kind === 'schema' && x.path === 'color.space')).toBe(true);
    const f = good(); f.libraries.recommended.push({ name: 'React Three Fiber', package: '@react-three/fiber', why: 'x' }); f.brief.stack.framework = 'vue';
    expect(validateDesign(f).errors.some((x) => /non-React stack/.test(x.message))).toBe(true);
    expect(validateDesign(null).valid).toBe(false);
  });
});

describe('exports', () => {
  const doc = generateDesign(brief({ specialty: 'data', requires3d: true }), { seed: 21, direction: 'scientific-precision' });
  it('CSS: every referenced custom property is defined; both modes and reduced motion are present', () => {
    for (const fmt of ['hex', 'oklch']) {
      const css = toCss(doc, { colorFormat: fmt });
      const defined = new Set([...css.matchAll(/(--[a-z0-9_-]+)\s*:/g)].map((m) => m[1]));
      const used = [...css.matchAll(/var\((--[a-z0-9_-]+)/g)].map((m) => m[1]);
      expect(used.length).toBeGreaterThan(3);
      for (const u of used) expect(defined.has(u), u).toBe(true);
      expect((css.match(/\{/g) ?? []).length).toBe((css.match(/\}/g) ?? []).length);
      expect(css).toMatch(/prefers-color-scheme: dark/);
      expect(css).toMatch(/:root\[data-theme="dark"\]/);
      expect(css).toMatch(/prefers-reduced-motion: reduce/);
      expect(css).toContain(`--mk-color-primary: ${fmt === 'hex' ? doc.color.light.roles.primary.hex : doc.color.light.roles.primary.oklch};`);
      expect(css).toContain('--mk-color-data-8:');
      expect(css).toContain(`--mk-text-5xl: ${doc.typography.scale.steps['5xl'].clamp};`);
      // every declaration has a value
      for (const m of css.matchAll(/(--mk-[a-z0-9_-]+):\s*([^;]*);/g)) expect(m[2].trim().length, m[1]).toBeGreaterThan(0);
      const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
      for (const m of reduced.matchAll(/--mk-duration-[a-z]+: (\d+)ms/g)) expect(Number(m[1])).toBeLessThanOrEqual(200);
    }
    const darkFirst = toCss(generateDesign(brief(), { seed: 1, direction: 'dark-cinema' }));
    expect(darkFirst).toMatch(/:root \{\n {2}color-scheme: dark;/);
    expect(darkFirst).toMatch(/prefers-color-scheme: light/);
  });
  it('Tailwind: v4 @theme with balanced braces and the token values', () => {
    const tw = toTailwind(doc);
    expect(tw).toMatch(/@import "tailwindcss";/);
    expect(tw).toMatch(/@theme \{/);
    expect((tw.match(/\{/g) ?? []).length).toBe((tw.match(/\}/g) ?? []).length);
    expect(tw).toContain(`--color-primary: ${doc.color.light.roles.primary.hex};`);
    expect(tw).toContain(`--color-primary: ${doc.color.dark.roles.primary.hex};`);
    expect(tw).toMatch(/--font-sans: /);
    expect(tw).toMatch(/--ease-signature: cubic-bezier\(/);
    const defined = new Set([...tw.matchAll(/(--[a-z0-9_-]+)\s*:/g)].map((m) => m[1]));
    for (const m of tw.matchAll(/var\((--[a-z0-9_-]+)/g)) expect(defined.has(m[1]), m[1]).toBe(true);
  });
  it('TypeScript: module body is valid JSON `as const`', () => {
    const ts = toTs(doc);
    const m = /export const tokens = (\{[\s\S]*\}) as const;/.exec(ts);
    expect(m).not.toBeNull();
    const obj = JSON.parse(m[1]);
    expect(obj.color.light.primary).toBe(doc.color.light.roles.primary.hex);
    expect(obj.color.dark.semantic.danger.text).toBe(doc.color.dark.semantic.danger.text.hex);
    expect(obj.color.light.dataViz.length).toBe(8);
    expect(obj.duration.base).toBe(doc.motion.durations.base);
    expect(obj.ease.standard).toEqual([0.2, 0, 0, 1]);
    expect(obj.spring.bouncy).toEqual({ stiffness: 420, damping: 16, mass: 1 });
    expect(ts).toMatch(/export type Tokens = typeof tokens;/);
  });
  it('DTCG: every token has $type/$value of the right shape and aliases resolve', () => {
    const dtcg = JSON.parse(exportTokens(doc, 'json-dtcg'));
    expect(toDtcg(doc)).toEqual(dtcg);
    let count = 0;
    const aliases = [];
    const walk = (node, p) => {
      if (node && typeof node === 'object' && '$value' in node) {
        count++;
        expect(typeof node.$type, p).toBe('string');
        const v = node.$value;
        if (typeof v === 'string' && /^\{.+\}$/.test(v)) { aliases.push([p, v]); return; }
        switch (node.$type) {
          case 'color': expect(v.colorSpace).toBe('oklch'); expect(v.components.length).toBe(3); expect(v.hex).toMatch(/^#[0-9a-f]{6}$/); break;
          case 'dimension': expect(typeof v.value).toBe('number'); expect(['px', 'rem']).toContain(v.unit); break;
          case 'duration': expect(typeof v.value).toBe('number'); expect(v.unit).toBe('ms'); break;
          case 'cubicBezier': expect(v.length).toBe(4); break;
          case 'fontFamily': expect(Array.isArray(v)).toBe(true); break;
          case 'fontWeight': case 'number': expect(typeof v).toBe('number'); break;
          case 'shadow': expect(Array.isArray(v)).toBe(true); for (const l of v) expect(Object.keys(l).sort()).toEqual(['blur', 'color', 'offsetX', 'offsetY', 'spread']); break;
          default: throw new Error(`unexpected $type ${node.$type} at ${p}`);
        }
        return;
      }
      if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) if (!k.startsWith('$')) walk(v, p ? `${p}.${k}` : k);
    };
    walk(dtcg, '');
    expect(count).toBeGreaterThan(150);
    expect(aliases.length).toBeGreaterThan(0);
    for (const [p, a] of aliases) expect(getPath(dtcg, a.slice(1, -1))?.$value, `${p} → ${a}`).toBeDefined();
    expect(dtcg.color.light.primary.$value.hex).toBe(doc.color.light.roles.primary.hex);
    expect(dtcg.motion.duration.base.$value).toEqual({ value: doc.motion.durations.base, unit: 'ms' });
    expect(() => exportTokens(doc, 'scss')).toThrow(/Unknown token format/);
  });
  it('explain produces Markdown with the selection rationale; --section narrows it', () => {
    const md = explainDesign(doc);
    for (const h of ['## Visual direction', '## Colour', '## Typography', '## Motion', '## 3D', '## Libraries', '## Accessibility']) expect(md).toContain(h);
    expect(md).toContain(doc.visualDirection.thesis);
    expect(md).toMatch(/Runner-up: `[a-z-]+`/);
    const motion = explainDesign(doc, { section: 'motion' });
    expect(motion.startsWith('## Motion')).toBe(true);
    expect(motion).not.toContain('## Colour');
    expect(explainDesign(doc, { section: 'typography' })).toContain('## Typography');
    expect(() => explainDesign(doc, { section: 'nope' })).toThrow(/Unknown section/);
    expect(() => explainDesign(generateDesign(brief(), { seed: 1 }), { section: '3d' })).toThrow(/no 3D section/);
  });
});

describe('overrides, merge and history (library)', () => {
  it('applies overrides on top of generated values and reflects them in exports', () => {
    const doc = generateDesign(brief(), { seed: 31 });
    doc.overrides = { color: { light: { roles: { primary: { hex: '#0A3D91' } } } }, motion: { durations: { base: 260 } }, meta: { generator: 'hack' } };
    const out = applyOverrides(doc);
    expect(out.color.light.roles.primary.hex).toBe('#0a3d91');
    expect(out.color.light.roles.primary.oklch).toMatch(/^oklch\(/);
    expect(out.color.light.roles.primary.oklch).not.toBe(doc.color.light.roles.primary.oklch);
    expect(out.motion.durations.base).toBe(260);
    expect(out.meta.generator).toBe('maquettekit-design-intelligence');
    expect(out.meta.overridesIgnored).toEqual(['meta']);
    expect(out.meta.overridesApplied).toEqual(['color.light.roles.primary.hex', 'motion.durations.base']);
    expect(applyOverrides(out)).toEqual(out); // idempotent
    expect(toCss(doc)).toContain('--mk-color-primary: #0a3d91;');
    expect(toCss(doc)).toContain('--mk-duration-base: 260ms;');
    expect(JSON.parse(/= (\{[\s\S]*\}) as const/.exec(toTs(doc))[1]).color.light.primary).toBe('#0a3d91');
    expect(toDtcg(doc).color.light.primary.$value.hex).toBe('#0a3d91');
    expect(doc.color.light.roles.primary.hex).not.toBe('#0a3d91'); // input not mutated
    // contrast is recomputed, so a bad override is caught by validation
    const pair = out.color.light.contrast.find((p) => p.fg === 'roles.onPrimary' && p.bg === 'roles.primary');
    expect(pair.ratio).toBeCloseTo(Math.floor(contrastRatio(out.color.light.roles.onPrimary.hex, '#0a3d91') * 100) / 100, 2);
    doc.overrides = { color: { light: { roles: { text: { hex: '#bbbbbb' } } } } };
    const res = validateDesign(doc);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => /roles\.text on roles\.bg/.test(e.message))).toBe(true);
  });
  it('regenerate keeps overrides with keepOverrides, drops them otherwise, and appends history', () => {
    const first = generateDesign(brief(), { seed: 31 });
    first.overrides = { radius: { scale: { md: 6 } } };
    const merged = regenerateDesign(brief({ motionIntensity: 'immersive' }), first, { seed: 32, keepOverrides: true });
    expect(merged.overrides).toEqual({ radius: { scale: { md: 6 } } });
    expect(merged.radius.scale.md).toBe(6);
    expect(merged.motion.profile).toBe('immersive');
    expect(merged.history.length).toBe(2);
    expect(merged.history[1]).toMatchObject({ action: 'regenerate-merge', briefHash: merged.meta.briefHash, previousBriefHash: first.meta.briefHash });
    expect(merged.history[0]).toEqual(first.history[0]);
    expect(validateDesign(merged).errors).toEqual([]);
    const forced = regenerateDesign(brief(), merged, { seed: 33 });
    expect(forced.overrides).toEqual({});
    expect(forced.radius.scale.md).not.toBe(6);
    expect(forced.history.map((h) => h.action)).toEqual(['generate', 'regenerate-merge', 'regenerate-force']);
  });
});

describe('CLI', () => {
  it('generate --out - prints the design file to stdout and validate - reads it from stdin (read-only sandboxes)', () => {
    const r = cli(['generate', '--category', 'retail investing app', '--personality', 'calm,precise', '--seed', '7', '--out', '-']);
    expect(r.status).toBe(0);
    const doc = JSON.parse(r.stdout);
    expect(doc.meta.schemaVersion).toBeTruthy();
    expect(r.stderr).toMatch(/design file on stdout/);
    const v = cli(['validate', '-'], { input: r.stdout });
    expect(v.status).toBe(0);
    expect(cli(['generate', '--category', 'x', '--out', '-', '--json']).status).toBe(2);
    expect(cli(['generate', '--category', 'x', '--out', '-', '--merge']).status).toBe(2);
    expect(cli(['validate', '-'], { input: 'not json' }).stderr).toMatch(/on stdin is not valid JSON/);
    const t = cli(['init', '--out', '-']);
    expect(t.status).toBe(0);
    expect(JSON.parse(t.stdout)).toBeTypeOf('object');
  });

  let dir;
  beforeAll(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 's3-design-')); });
  afterAll(() => { fs.rmSync(dir, { recursive: true, force: true }); });
  const p = (f) => path.join(dir, f);

  it('init writes a template and refuses to overwrite it', () => {
    expect(cli(['init', '--out', p('brief.json')]).status).toBe(0);
    const t = JSON.parse(fs.readFileSync(p('brief.json'), 'utf8'));
    for (const k of ['productCategory', 'audience', 'brand', 'businessGoals', 'targetDevices', 'preferredAesthetic', 'interactionComplexity', 'accessibility', 'performance', 'stack', 'motionIntensity', 'requires3d', 'threeD', 'specialty']) expect(t).toHaveProperty(k);
    const again = cli(['init', '--out', p('brief.json')]);
    expect(again.status).toBe(2);
    expect(again.stderr).toMatch(/already exists/);
  });
  it('generate from a brief file writes the design and all exports; seeded output is byte-reproducible', () => {
    const args = ['generate', '--brief', p('brief.json'), '--seed', '7', '--out', p('a/maquettekit.design.json'), '--css', p('a/tokens.css'), '--tailwind', p('a/theme.css'), '--ts', p('a/tokens.ts'), '--dtcg', p('a/tokens.json')];
    const r = cli(args);
    expect(r.status, r.stderr).toBe(0);
    for (const f of ['a/maquettekit.design.json', 'a/tokens.css', 'a/theme.css', 'a/tokens.ts', 'a/tokens.json']) expect(fs.statSync(p(f)).size).toBeGreaterThan(500);
    const r2 = cli(args.map((x) => x.replace(`${path.sep}a${path.sep}`, `${path.sep}b${path.sep}`)));
    expect(r2.status).toBe(0);
    expect(fs.readFileSync(p('b/maquettekit.design.json'), 'utf8')).toBe(fs.readFileSync(p('a/maquettekit.design.json'), 'utf8'));
    expect(fs.readFileSync(p('b/tokens.css'), 'utf8')).toBe(fs.readFileSync(p('a/tokens.css'), 'utf8'));
    expect(fs.readFileSync(p('a/maquettekit.design.json'), 'utf8')).not.toMatch(/generatedAt/);
  });
  it('refuses to overwrite without --force/--merge; --merge keeps overrides and records history', () => {
    const out = p('a/maquettekit.design.json');
    const refuse = cli(['generate', '--brief', p('brief.json'), '--out', out]);
    expect(refuse.status).toBe(2);
    expect(refuse.stderr).toMatch(/refusing to overwrite/);
    expect(refuse.stderr).toMatch(/--merge/);
    const doc = JSON.parse(fs.readFileSync(out, 'utf8'));
    doc.overrides = { color: { light: { roles: { primary: { hex: '#123a8c' } } } }, typography: { weights: { display: 900 } } };
    fs.writeFileSync(out, JSON.stringify(doc, null, 2));
    const merged = cli(['generate', '--brief', p('brief.json'), '--motion', 'immersive', '--out', out, '--css', p('a/tokens.css'), '--merge', '--json']);
    expect(merged.status, merged.stderr).toBe(0);
    expect(JSON.parse(merged.stdout).valid).toBe(true);
    const after = JSON.parse(fs.readFileSync(out, 'utf8'));
    expect(after.overrides).toEqual(doc.overrides);
    expect(after.color.light.roles.primary.hex).toBe('#123a8c');
    expect(after.typography.weights.display).toBe(900);
    expect(after.motion.profile).toBe('immersive');
    expect(after.history.length).toBe(2);
    expect(after.history[1].action).toBe('regenerate-merge');
    expect(after.history[1].date).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(after.history[1].briefHash).not.toBe(after.history[0].briefHash);
    expect(after.meta.generatedAt).toMatch(/^\d{4}-/);
    expect(fs.readFileSync(p('a/tokens.css'), 'utf8')).toContain('--mk-color-primary: #123a8c;');
    const forced = cli(['generate', '--brief', p('brief.json'), '--out', out, '--force']);
    expect(forced.status).toBe(0);
    const reset = JSON.parse(fs.readFileSync(out, 'utf8'));
    expect(reset.overrides).toEqual({});
    expect(reset.history.length).toBe(3);
    expect(cli(['generate', '--brief', p('brief.json'), '--out', out, '--force', '--merge']).status).toBe(2);
  });
  it('generate works from inline flags alone (non-React stack ⇒ no R3F)', () => {
    const out = p('flags.json');
    const r = cli(['generate', '--category', 'fintech', '--audience', 'retail investors', '--aesthetic', 'calm, precise', '--motion', 'expressive', '--3d', '--3d-purpose', 'interactive portfolio globe',
      '--framework', 'vue', '--styling', 'css', '--name', 'Ledgerly', '--personality', 'calm,trustworthy', '--colors', '#0b6e4f', '--goals', 'grow deposits', '--devices', 'mobile,desktop',
      '--complexity', 'high', '--a11y', 'AAA', '--a11y-needs', 'low-vision', '--budget', 'tight', '--low-end', '--libs', 'pinia', '--seed', '3', '--out', out]);
    expect(r.status, r.stderr).toBe(0);
    const doc = JSON.parse(fs.readFileSync(out, 'utf8'));
    expect(doc.brief).toMatchObject({ productCategory: 'fintech', audience: 'retail investors', interactionComplexity: 'high', requires3d: true, specialty: 'data', motionIntensity: 'expressive' });
    expect(doc.brief.brand).toEqual({ name: 'Ledgerly', personality: ['calm', 'trustworthy'], existingColors: ['#0b6e4f'], existingFonts: [] });
    expect(doc.brief.performance).toEqual({ budget: 'tight', lowEndDevices: true });
    expect(doc.brief.accessibility).toEqual({ level: 'AAA', needs: ['low-vision'] });
    expect(doc.brief.stack).toEqual({ framework: 'vue', styling: 'css', libs: ['pinia'] });
    expect(doc.threeD.technology.recommendation).toBe('Three.js');
    expect(JSON.stringify(doc.libraries.recommended)).not.toMatch(/react/i);
    expect(doc.color.contrastPolicy.textRatio).toBe(7);
    expect(cli(['generate']).status).toBe(2);
    expect(cli(['generate', '--category', 'saas', '--motion', 'frantic', '--out', p('x.json')]).stderr).toMatch(/motionIntensity must be one of/);
  });
  it('validate exits 0 for a good file and 1 with explanations for a broken one', () => {
    const ok = cli(['validate', p('flags.json')]);
    expect(ok.status).toBe(0);
    expect(ok.stderr).toMatch(/Valid — \d+ contrast pairs/);
    const doc = JSON.parse(fs.readFileSync(p('flags.json'), 'utf8'));
    doc.color.dark.roles.text = { hex: '#444444', oklch: 'oklch(38.67% 0 0)' };
    delete doc.typography.rules;
    fs.writeFileSync(p('broken.json'), JSON.stringify(doc));
    const bad = cli(['validate', p('broken.json'), '--json']);
    expect(bad.status).toBe(1);
    const res = JSON.parse(bad.stdout);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.kind === 'schema' && e.path === 'typography.rules')).toBe(true);
    expect(res.errors.some((e) => e.kind === 'semantic' && /roles\.text on roles\.bg/.test(e.message))).toBe(true);
    expect(cli(['validate', p('missing.json')]).status).toBe(2);
  });
  it('tokens, explain and directions commands work', () => {
    for (const format of ['css', 'tailwind', 'ts', 'json-dtcg']) {
      const r = cli(['tokens', p('flags.json'), '--format', format]);
      expect(r.status, format).toBe(0);
      expect(r.stdout.length, format).toBeGreaterThan(1000);
    }
    expect(JSON.parse(cli(['tokens', p('flags.json'), '--format', 'json-dtcg']).stdout).color.light.bg.$type).toBe('color');
    expect(cli(['tokens', p('flags.json'), '--format', 'css', '--out', p('out/t.css')]).status).toBe(0);
    expect(fs.existsSync(p('out/t.css'))).toBe(true);
    expect(cli(['tokens', p('flags.json')]).status).toBe(2);
    expect(cli(['tokens', p('flags.json'), '--format', 'less']).status).toBe(2);
    const ex = cli(['explain', p('flags.json'), '--section', 'color']);
    expect(ex.status).toBe(0);
    expect(ex.stdout).toMatch(/^## Colour/);
    expect(cli(['explain', p('flags.json')]).stdout).toMatch(/^# Ledgerly — design rationale/);
    const list = JSON.parse(cli(['directions', '--json']).stdout);
    expect(list.length).toBe(DIRECTIONS.length);
    expect(list[0]).toHaveProperty('fonts.display.license');
    expect(cli(['directions']).stdout).toMatch(/built-in art directions/);
    expect(cli(['--help']).stdout).toMatch(/Design Intelligence Engine/);
    expect(cli(['bogus']).status).toBe(2);
  });
});

describe('library alias layer (CSS export ↔ component library contract)', () => {
  // Variables that library recipes and demos read WITHOUT a design-system-independent default.
  const LIBRARY_VARS = ['bg', 'surface', 'surface-2', 'ink', 'ink-muted', 'line', 'line-strong', 'signal', 'on-signal',
    'accent', 'focus', 'font-display', 'font-text', 'font-mono', 'font-serif', 'radius-s', 'radius-m', 'radius-l'];
  for (const direction of DIRECTIONS.map((d) => d.id)) {
    it(`${direction}: every recipe-facing variable is defined and resolves to a defined token`, () => {
      const doc = generateDesign(brief(), { seed: 3, direction });
      const css = toCss(doc);
      const defined = new Set([...css.matchAll(/(--mk-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
      for (const v of LIBRARY_VARS) expect(defined.has(`--mk-${v}`), `--mk-${v} defined`).toBe(true);
      for (const [, target] of css.matchAll(/--mk-(?:bg|surface|surface-2|ink|ink-muted|line|line-strong|signal|on-signal|accent|focus|success|danger|font-serif|radius-[sml]):\s*var\((--mk-[a-z0-9-]+)\)/g)) {
        expect(defined.has(target), `alias target ${target} defined`).toBe(true);
      }
    });
  }
  const aliasBlock = (css) => css.split('/* Library aliases')[1].split('@media')[0];
  it('motion: library duration names the design lacks are references to design durations (reduced-motion caps apply)', () => {
    const doc = generateDesign(brief(), { seed: 3 });
    expect(Object.keys(doc.motion.durations)).toEqual(expect.arrayContaining(['instant', 'fast', 'base', 'slow', 'slower', 'scene']));
    const css = toCss(doc);
    const defined = new Set([...css.matchAll(/(--mk-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    for (const k of ['instant', 'fast', 'base', 'moderate', 'slow', 'cinematic']) expect(defined.has(`--mk-duration-${k}`), `--mk-duration-${k}`).toBe(true);
    for (const k of ['standard', 'enter', 'exit', 'emphasized']) expect(defined.has(`--mk-ease-${k}`), `--mk-ease-${k}`).toBe(true);
    const aliases = aliasBlock(css);
    expect(aliases).toMatch(/--mk-duration-moderate: calc\(\(var\(--mk-duration-base\) \+ var\(--mk-duration-slow\)\) \/ 2\);/);
    expect(aliases).toMatch(/--mk-duration-cinematic: var\(--mk-duration-scene\);/);
    // never literal values: the reduced-motion block caps the design durations they point at
    for (const [, v] of aliases.matchAll(/--mk-duration-[a-z]+: ([^;]+);/g)) expect(v).not.toMatch(/^\d/);
    const reduced = css.split('@media (prefers-reduced-motion: reduce)')[1];
    for (const k of ['base', 'slow', 'scene']) expect(reduced).toContain(`--mk-duration-${k}:`);
    // inOut is left to the recipes' own symmetric fallback (no design easing is an in-out curve)
    expect(defined.has('--mk-ease-inOut')).toBe(false);
  });
  it('motion: names the design already defines are not re-declared; cinematic falls back to slower', () => {
    const doc = generateDesign(brief(), { seed: 3 });
    doc.motion.durations.moderate = 333;
    delete doc.motion.durations.scene;
    const css = toCss(doc);
    expect(css.match(/--mk-duration-moderate:/g)).toHaveLength(2); // the design token + its reduced-motion cap, no alias
    expect(aliasBlock(css)).not.toContain('--mk-duration-moderate');
    expect(aliasBlock(css)).toMatch(/--mk-duration-cinematic: var\(--mk-duration-slower\);/);
  });
});
