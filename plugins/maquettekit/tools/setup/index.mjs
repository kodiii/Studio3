// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from '../lib/args.mjs';
import { TOOLS_DIR, depsDir } from '../lib/resolve.mjs';
import { log, UserError } from '../lib/log.mjs';

export const help = `maquettekit setup — install optional tool dependencies (explicit, local, no telemetry)

  setup [--only review|assets] [--browsers] [--dry-run] [--dir <path>]

Installs the pinned dependencies from tools/package.json into the Maquettekit deps directory
($MAQUETTEKIT_DEPS, else $CLAUDE_PLUGIN_DATA/maquettekit-deps, else ~/.maquettekit/deps) with
"npm install --ignore-scripts=false --no-audit --no-fund". Nothing else is downloaded.
  --only review   playwright, axe-core, pixelmatch, pngjs      (Visual Director, Experience Lab)
  --only export   vite, react, react-dom                       (catalog export --format web-component)
  --only assets   @gltf-transform/*, meshoptimizer, draco3dgltf, sharp, gltf-validator, playwright (thumbnails)
  --browsers      also run "npx playwright install chromium" (downloads a browser build)
  --dry-run       print what would run`;

const GROUPS = {
  review: ['playwright', 'axe-core', 'pixelmatch', 'pngjs'],
  export: ['vite', 'react', 'react-dom'],
  assets: ['@gltf-transform/core', '@gltf-transform/extensions', '@gltf-transform/functions', 'meshoptimizer', 'draco3dgltf', 'sharp', 'gltf-validator', 'playwright'],
};

/** Build the package.json written to the deps dir. Exported for tests. */
export function planDeps(only) {
  const all = JSON.parse(fs.readFileSync(path.join(TOOLS_DIR, 'package.json'), 'utf8')).dependencies;
  if (only && !GROUPS[only]) throw new UserError(`--only must be one of: ${Object.keys(GROUPS).join(', ')}`);
  const names = only ? GROUPS[only] : Object.keys(all);
  return Object.fromEntries(names.filter((n) => all[n]).map((n) => [n, all[n]]));
}

export async function main(argv) {
  const args = parseArgs(argv, { boolean: ['browsers', 'dry-run'] });
  const dir = path.resolve(args.dir ?? depsDir());
  const dependencies = planDeps(args.only);
  const pkg = { name: 'maquettekit-deps', private: true, description: 'Optional dependencies for Maquettekit tools', dependencies };
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  /** @type {[string, string[]][]} */
  const steps = [[npm, ['install', '--no-audit', '--no-fund', '--loglevel', 'error']]];
  if (args.browsers) steps.push([process.platform === 'win32' ? 'npx.cmd' : 'npx', ['playwright', 'install', 'chromium']]);
  if (args['dry-run']) {
    console.log(JSON.stringify({ dir, dependencies, commands: steps.map(([c, a]) => [c, ...a].join(' ')) }, null, 2));
    return 0;
  }
  fs.mkdirSync(dir, { recursive: true });
  const pkgFile = path.join(dir, 'package.json');
  if (fs.existsSync(pkgFile)) {
    // merge so a later "--only assets" does not drop the review deps
    try { Object.assign(pkg.dependencies, { ...JSON.parse(fs.readFileSync(pkgFile, 'utf8')).dependencies, ...dependencies }); } catch { /* rewrite */ }
  }
  fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n');
  for (const [cmd, a] of steps) {
    log.step(`${cmd} ${a.join(' ')}  (in ${dir})`);
    const r = spawnSync(cmd, a, { cwd: dir, stdio: 'inherit' });
    if (r.status !== 0) throw new UserError(`"${cmd} ${a.join(' ')}" failed with exit code ${r.status}.`, 1);
  }
  log.ok(`Maquettekit tool dependencies installed in ${dir}`);
  if (!args.browsers) log.info('  Browser not installed by this command. If Chromium is missing run: maquettekit setup --browsers');
  return 0;
}
