// @ts-check
import { describe, it, expect, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCheck, main, renderCheckMd } from '../../../plugins/maquettekit/tools/check/index.mjs';
import { generateDesign } from '../../../plugins/maquettekit/tools/design-intelligence/generate.mjs';
import { exportTokens } from '../../../plugins/maquettekit/tools/design-intelligence/exports.mjs';
import { launchBrowser } from '../../../plugins/maquettekit/tools/lib/browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const BROKEN = path.resolve(here, '../../fixtures/vd-broken');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'maquettekit-check-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const browserProbe = await (async () => {
  try { const b = await launchBrowser(); await b.close(); return { ok: true, reason: '' }; }
  catch (err) { return { ok: false, reason: String(/** @type {any} */ (err).message).split('\n')[0] }; }
})();
const bit = browserProbe.ok ? it : (name, ..._rest) => it.skip(`${name} [SKIPPED: Chromium unavailable — ${browserProbe.reason}]`, () => {});

function project(name) {
  const dir = path.join(tmp, name);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  const doc = generateDesign({ productCategory: 'scheduling SaaS', audience: 'clinics' }, { seed: '3' });
  fs.writeFileSync(path.join(dir, 'maquettekit.design.json'), JSON.stringify(doc));
  fs.writeFileSync(path.join(dir, 'src', 'tokens.css'), exportTokens(doc, 'css'));
  fs.writeFileSync(path.join(dir, 'src', 'app.css'), '.a { color: #123456; padding: 13px; }\n.b { color: #123456; }\n.c { box-shadow: 0 0 2px #654321; }\n');
  return dir;
}
const quietly = async (fn) => {
  const spies = [vi.spyOn(console, 'error').mockImplementation(() => {}), vi.spyOn(console, 'log').mockImplementation(() => {})];
  try { return await fn(); } finally { for (const s of spies) s.mockRestore(); }
};

describe('maquettekit check without a browser target', () => {
  it('validates the design file, lints the source, and reports the browser steps as skipped', async () => {
    const dir = project('source-only');
    const { result, files } = await quietly(() => runCheck({ dir, out: path.join(dir, '.maquettekit', 'check') }));
    expect(result.steps.design.status).toBe('passed');
    expect(result.steps.lint.status).toBe('failed');
    expect(result.steps.review).toMatchObject({ status: 'skipped', reason: 'no --url or --serve given' });
    expect(result.steps.experience.status).toBe('skipped');
    expect(result.ran).toEqual(['design', 'lint']);
    // same literal in one file → one item listing both lines; the shadow colour is minor
    const colour = result.items.find((i) => i.check === 'off-token-colour' && i.severity === 'major');
    expect(colour.where).toBe('src/app.css:1,2');
    expect(colour.fix).toMatch(/^Use var\(--mk-color-/);
    expect(result.items.map((i) => i.severity)).toEqual([...result.items.map((i) => i.severity)].sort((a, b) => ['critical', 'major', 'minor'].indexOf(a) - ['critical', 'major', 'minor'].indexOf(b)));
    expect(result.items.map((i) => i.n)).toEqual(result.items.map((_, k) => k + 1));
    const md = fs.readFileSync(files.md, 'utf8');
    expect(md).toMatch(/\| lint \| failed \|/);
    expect(md).toMatch(/- \[ \] \*\*1\.\*\* lint · `off-token-colour`/);
    expect(md).toMatch(/## Not run/);
  });

  it('exit code follows --fail-on', async () => {
    const dir = project('exit');
    const out = path.join(dir, '.maquettekit', 'check');
    expect(await quietly(() => main(['--dir', dir, '--out', out]))).toBe(1); // a major off-palette colour
    expect(await quietly(() => main(['--dir', dir, '--out', out, '--fail-on', 'critical']))).toBe(0);
    expect(await quietly(() => main(['--dir', dir, '--out', out, '--fail-on', 'none']))).toBe(0);
    await expect(main(['--dir', dir, '--fail-on', 'always'])).rejects.toThrow(/--fail-on/);
    await expect(main(['--url', 'http://localhost:1', '--serve', dir])).rejects.toThrow(/either --url or --serve/);
  });

  it('a broken design file is a major item, not a crash', async () => {
    const dir = project('bad-design');
    fs.writeFileSync(path.join(dir, 'maquettekit.design.json'), '{ not json');
    const { result } = await quietly(() => runCheck({ dir, out: path.join(dir, 'out') }));
    expect(result.steps.design.status).toBe('failed');
    expect(result.items[0]).toMatchObject({ source: 'design', severity: 'major', check: 'design-json' });
    expect(result.steps.lint.status).toBe('failed'); // still linted, against the project's own tokens
  });

  it('with Playwright unavailable the browser steps are "unavailable" with a remedy, and the rest still runs', async () => {
    const dir = project('no-browser');
    const prev = process.env.MAQUETTEKIT_DISABLE_PLAYWRIGHT;
    process.env.MAQUETTEKIT_DISABLE_PLAYWRIGHT = '1';
    try {
      const { result } = await quietly(() => runCheck({ dir, serve: BROKEN, out: path.join(dir, 'out'), reviewOut: path.join(dir, 'review'), experienceOut: path.join(dir, 'exp') }));
      expect(result.steps.review.status).toBe('unavailable');
      expect(result.steps.review.remedy).toMatch(/setup/);
      expect(result.steps.experience.status).toBe('unavailable');
      expect(result.steps.lint.status).toBe('failed');
      expect(renderCheckMd(result)).toMatch(/- review: unavailable — /);
    } finally {
      if (prev === undefined) delete process.env.MAQUETTEKIT_DISABLE_PLAYWRIGHT; else process.env.MAQUETTEKIT_DISABLE_PLAYWRIGHT = prev;
    }
  });
});

describe('maquettekit check with a browser target', () => {
  bit('runs review and experience on a static site and merges everything into one ranked list', async () => {
    const out = path.join(tmp, 'browser');
    const { result } = await quietly(() => runCheck({ serve: BROKEN, dir: BROKEN, viewports: ['desktop', 'mobile'], threeD: false, out: path.join(out, 'check'), reviewOut: path.join(out, 'review'), experienceOut: path.join(out, 'experience') }));
    expect(result.steps.review.status).toBe('failed');
    expect(result.steps.review.loop).toMatchObject({ passesDone: 1, maxPasses: 3 });
    expect(result.steps.experience.status).toBe('failed');
    expect(result.steps.lint.status).toBe('not-applicable'); // the fixture has no tokens
    expect(result.items[0].severity).toBe('critical');
    // review issues are grouped across viewports, with the review guidance as the fix
    const covered = result.items.find((i) => i.check === 'interaction-reachability' && /#save/.test(i.where));
    expect(covered.where).toMatch(/\(desktop, mobile\)/);
    expect(covered.fix).toMatch(/stretched link/);
    expect(result.items.some((i) => i.source === 'experience' && i.severity === 'major')).toBe(true);
    expect(result.items.filter((i) => i.source === 'review').every((i) => i.severity !== 'info')).toBe(true);
  }, 600_000);
});
