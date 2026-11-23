// @ts-check
/**
 * Optional-dependency resolution for Studio³ tools.
 *
 * The plugin is copied into a host cache without `npm install`, so heavy
 * dependencies (playwright, @gltf-transform/*, sharp…) are resolved lazily from,
 * in order:
 *   1. $STUDIO3_DEPS                (explicit override, a dir containing node_modules)
 *   2. the tools directory itself   (repo checkout / workspace install)
 *   3. $CLAUDE_PLUGIN_DATA/studio3-deps or ~/.studio3/deps  (created by `studio3 setup`)
 *   4. the current project          (process.cwd())
 * Nothing is ever downloaded implicitly: a missing dependency yields an
 * actionable error naming the command that installs it.
 */
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { UserError } from './log.mjs';

export const TOOLS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PLUGIN_ROOT = path.resolve(TOOLS_DIR, '..');

export function depsDir() {
  if (process.env.STUDIO3_DEPS) return path.resolve(process.env.STUDIO3_DEPS);
  if (process.env.CLAUDE_PLUGIN_DATA) return path.join(process.env.CLAUDE_PLUGIN_DATA, 'studio3-deps');
  return path.join(os.homedir(), '.studio3', 'deps');
}

function searchRoots() {
  const roots = [];
  if (process.env.STUDIO3_DEPS) roots.push(path.resolve(process.env.STUDIO3_DEPS));
  roots.push(TOOLS_DIR, depsDir(), process.cwd());
  return [...new Set(roots)];
}

/**
 * Resolve a package specifier to an absolute file path, or null.
 * @param {string} specifier
 * @returns {string | null}
 */
export function resolveDep(specifier) {
  for (const root of searchRoots()) {
    try {
      return createRequire(path.join(root, 'noop.js')).resolve(specifier);
    } catch { /* try next root */ }
  }
  return null;
}

/** @param {string} specifier */
export function hasDep(specifier) { return resolveDep(specifier) !== null; }

/**
 * Import an optional dependency, throwing an actionable UserError when absent.
 * @param {string} specifier
 * @param {string} [purpose] what the dependency is needed for (shown in the error)
 * @returns {Promise<any>}
 */
export async function importDep(specifier, purpose) {
  const resolved = resolveDep(specifier);
  if (!resolved) {
    throw new UserError(
      `Missing dependency "${specifier}"${purpose ? ` (needed for ${purpose})` : ''}.\n` +
      `  Install the tool dependencies once with:  node "${path.join(TOOLS_DIR, 'studio3.mjs')}" setup\n` +
      `  or add it to your project:               npm install -D ${specifier.split('/').slice(0, specifier.startsWith('@') ? 2 : 1).join('/')}`,
      3,
    );
  }
  return import(pathToFileURL(resolved).href);
}

/** Read the installed version of a dependency, or null. @param {string} name */
export function depVersion(name) {
  for (const root of searchRoots()) {
    let dir = root;
    for (let i = 0; i < 8; i++) {
      const p = path.join(dir, 'node_modules', name, 'package.json');
      if (fs.existsSync(p)) { try { return JSON.parse(fs.readFileSync(p, 'utf8')).version; } catch { return null; } }
      const up = path.dirname(dir);
      if (up === dir) break;
      dir = up;
    }
  }
  return null;
}
