// @ts-check
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateDesign } from '../../../plugins/maquettekit/tools/design-intelligence/generate.mjs';
import { exportTokens } from '../../../plugins/maquettekit/tools/design-intelligence/exports.mjs';
import { lintProject, lintMarkdown, stripVarFallbacks, colourToHex, scanCss } from '../../../plugins/maquettekit/tools/design-intelligence/lint.mjs';
import { main } from '../../../plugins/maquettekit/tools/design-intelligence/index.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'maquettekit-lint-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

/** @param {string} name @param {Record<string, string>} files */
function project(name, files) {
  const dir = path.join(tmp, name);
  for (const [rel, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); }
  return dir;
}
const rules = (r, file) => r.findings.filter((f) => !file || f.file === file).map((f) => `${f.rule}:${f.value}`).sort();

describe('value helpers', () => {
  it('normalises colour literals and strips var() fallbacks', () => {
    expect(colourToHex('#ABC')).toBe('#aabbcc');
    expect(colourToHex('#11223380')).toBe('#112233');
    expect(colourToHex('rgb(255, 0, 0)')).toBe('#ff0000');
    expect(colourToHex('rgba(0 0 0 / 0.5)')).toBe('#000000');
    expect(colourToHex('hsl(0deg 100% 50%)')).toBe('#ff0000');
    expect(stripVarFallbacks('2px solid var(--focus, #1d4ed8)')).toBe('2px solid var(--focus)');
    expect(stripVarFallbacks('color-mix(in oklab, var(--a, rgb(0 0 0 / .5)) 30%, var(--b))')).toBe('color-mix(in oklab, var(--a) 30%, var(--b))');
  });

  it('scans nested CSS with line numbers and marks root custom properties as tokens', () => {
    const d = scanCss(':root {\n  --x: #fff;\n}\n@media (min-width: 1px) {\n  .a { color: red; padding: 4px }\n}\n.b:hover { margin: 0 }');
    expect(d.map((x) => [x.prop, x.line, x.token])).toEqual([['--x', 2, true], ['color', 5, false], ['padding', 5, false], ['margin', 7, false]]);
  });
});

describe('lint against a design file', () => {
  /** @type {any} */ let doc; let dir = ''; /** @type {any} */ let r;
  beforeAll(() => {
    doc = generateDesign({ productCategory: 'project management SaaS', audience: 'teams', brand: { personality: ['calm'] } }, { seed: '7' });
    const sp = doc.spacing.scale['4']; const rad = doc.radius.scale.md; const text = doc.color.light.roles.text.hex;
    dir = project('design', {
      'maquettekit.design.json': JSON.stringify(doc),
      'src/tokens.css': exportTokens(doc, 'css'),
      'src/app.css': [
        '.off { color: #123456; padding: 13px; font-size: 15px; border-radius: 5px; transition: opacity 333ms ease; }',
        '.on { color: var(--mk-color-text); padding: var(--mk-space-4); margin: 0 auto; border-radius: 50%; }',
        `.scale { padding: ${sp}px; border-radius: ${rad}px; }`,
        `.same { background: ${text}; }`,
        '.fallback { outline: 2px solid var(--mk-color-focus-ring, #ff0000); }',
        '@media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; } }',
        '.ignored { color: #abcdef; } /* maquettekit-lint-ignore */',
        '.shadow { box-shadow: 0 1px 2px rgba(12, 34, 56, 0.2); }',
        '/* maquettekit-lint-ignore */',
        '.next { color: #fedcba; }',
      ].join('\n'),
    });
    r = lintProject({ dir });
  });

  it('uses the design file and the generated token CSS as sources, without linting the generated file', () => {
    expect(r.tokenSources).toContain('maquettekit.design.json');
    expect(r.tokenSources).toContain('src/tokens.css');
    expect(r.findings.some((f) => f.file === 'src/tokens.css')).toBe(false);
    expect(r.notJudged).toEqual([]);
  });

  it('flags each off-system value with the nearest token, and nothing on-system', () => {
    const lines = r.findings.filter((f) => f.file === 'src/app.css');
    expect(lines.filter((f) => f.line === 1).map((f) => f.rule).sort()).toEqual(['off-scale-font-size', 'off-scale-radius', 'off-scale-spacing', 'off-token-colour', 'off-token-duration']);
    const colour = lines.find((f) => f.rule === 'off-token-colour' && f.line === 1);
    expect(colour).toMatchObject({ severity: 'major', property: 'color', value: '#123456' });
    expect(colour.suggestion).toMatch(/^--mk-color-/);
    expect(lines.find((f) => f.rule === 'off-scale-spacing').suggestion).toMatch(/^--mk-space-/);
    expect(lines.find((f) => f.rule === 'off-token-duration').suggestion).toMatch(/^--mk-duration-/);
    for (const ok of [2, 3, 5, 6, 7, 10]) expect(lines.filter((f) => f.line === ok), `line ${ok}`).toEqual([]);
  });

  it('a literal that equals a token is minor and names the variable; shadow colours are minor', () => {
    const same = r.findings.find((f) => f.file === 'src/app.css' && f.line === 4);
    expect(same).toMatchObject({ rule: 'literal-token-colour', severity: 'minor' });
    expect(same.message).toMatch(/var\(--mk-color-/);
    expect(r.findings.find((f) => f.line === 8 && f.file === 'src/app.css')).toMatchObject({ rule: 'off-token-colour', severity: 'minor', property: 'box-shadow' });
  });

  it('writes a markdown report', () => {
    const md = lintMarkdown(r);
    expect(md).toMatch(/# Design-token lint/);
    expect(md).toMatch(/src\/app\.css:1/);
  });
});

describe('lint across file types', () => {
  it('finds values in JSX style objects, styled templates, Tailwind arbitrary values and markup', () => {
    const dir = project('types', {
      'tokens.css': ':root { --c-bg: #ffffff; --c-ink: #111111; --c-a: #2255aa; --c-b: #aa5522; --space-1: 4px; --space-2: 8px; --space-4: 16px; --space-6: 24px; }',
      'src/Card.tsx': [
        "export const Card = () => <div style={{ color: '#123456', padding: 13 }} className=\"bg-[#654321] p-[13px] text-sm\" />;",
        'const Button = styled.button`',
        '  color: #0a0a0a;',
        '  padding: ${(p) => p.pad}px 16px;',
        '`;',
      ].join('\n'),
      'index.html': '<style>\n.x { color: #777777 }\n</style>\n<div style="padding: 13px"></div>',
      'App.vue': '<template><p class="text-[#999999]">hi</p></template>\n<style scoped>\n.y { gap: 7px }\n</style>',
    });
    const r = lintProject({ dir });
    expect(rules(r, 'src/Card.tsx')).toEqual(['off-scale-spacing:13px', 'off-scale-spacing:13px', 'off-token-colour:#0a0a0a', 'off-token-colour:#123456', 'off-token-colour:#654321']);
    expect(r.findings.find((f) => f.value === '#654321').tailwind).toBe('bg-[#654321]');
    expect(r.findings.find((f) => f.value === '#0a0a0a').line).toBe(3);
    expect(rules(r, 'index.html')).toEqual(['off-scale-spacing:13px', 'off-token-colour:#777777']);
    expect(rules(r, 'App.vue')).toEqual(['off-scale-spacing:7px', 'off-token-colour:#999999']);
    expect(r.notJudged).toEqual(expect.arrayContaining(['radius', 'fontSize', 'duration']));
  });

  it('a variables-only block that redefines root tokens is a theme; component-local variables are linted', () => {
    const dir = project('theme', {
      'tokens.css': ':root { --c-bg: #ffffff; --c-ink: #111111; --c-a: #2255aa; --c-b: #aa5522; }\n[data-stage="ink"] { --c-bg: #000000; --c-ink: #f0f0f0; color-scheme: dark; }',
      'card.css': '.card { --card-tint: #444444; }\n.x { color: #000000; }',
    });
    const r = lintProject({ dir });
    expect(rules(r)).toEqual(['literal-token-colour:#000000', 'off-token-colour:#444444']);
    expect(r.findings.find((f) => f.value === '#444444').property).toBe('--card-tint');
  });

  it('without tokens nothing is judged; distinct literals are still counted', () => {
    const dir = project('none', { 'a.css': '.a { color: #123456; padding: 13px } .b { color: #654321; font-size: 15px }' });
    const r = lintProject({ dir });
    expect(r.findings).toEqual([]);
    expect(r.notJudged).toEqual(['colours', 'spacing', 'radius', 'fontSize', 'duration']);
    expect(r.metrics).toMatchObject({ distinctColourLiterals: 2, distinctFontSizes: 1, distinctSpacingValues: 1 });
  });

  it('skips build output and dependencies, and honours --ignore', () => {
    const dir = project('skip', {
      'tokens.css': ':root { --c-bg: #ffffff; --c-ink: #111111; --c-a: #2255aa; --c-b: #aa5522; }',
      'node_modules/x/a.css': '.a { color: #123456 }', 'dist/a.css': '.a { color: #123456 }', 'legacy/a.css': '.a { color: #123456 }', 'src/a.css': '.a { color: #123456 }',
    });
    expect(lintProject({ dir }).findings.map((f) => f.file).sort()).toEqual(['legacy/a.css', 'src/a.css']);
    expect(lintProject({ dir, ignore: ['legacy'] }).findings.map((f) => f.file)).toEqual(['src/a.css']);
  });
});

describe('design lint CLI', () => {
  it('exits 1 on findings at or above --fail-on, 0 otherwise, and writes --out', async () => {
    const dir = project('cli', { 'tokens.css': ':root { --c-bg: #ffffff; --c-ink: #111111; --c-a: #2255aa; --c-b: #aa5522; }', 'a.css': '.a { box-shadow: 0 0 2px #123456 }' });
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      expect(await main(['lint', '--dir', dir])).toBe(1); // a minor finding fails the default --fail-on minor
      expect(await main(['lint', '--dir', dir, '--fail-on', 'major'])).toBe(0);
      expect(await main(['lint', '--dir', dir, '--fail-on', 'none', '--out', path.join(dir, 'lint.md')])).toBe(0);
      expect(fs.readFileSync(path.join(dir, 'lint.md'), 'utf8')).toMatch(/0 major, 1 minor/);
      await expect(main(['lint', '--dir', dir, '--fail-on', 'sometimes'])).rejects.toThrow(/--fail-on/);
    } finally { quiet.mockRestore(); out.mockRestore(); }
  });
});
