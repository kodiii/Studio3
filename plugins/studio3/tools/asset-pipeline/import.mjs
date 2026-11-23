// @ts-check
/**
 * `studio3 assets import` — convert FBX/OBJ/DAE/BLEND/USDZ to GLB through
 * Blender's command line. Blender is never bundled or downloaded; when it is
 * not installed the command reports `unavailable` and exits with code 3.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findOnPath, run } from './ktx.mjs';

export const IMPORT_EXTENSIONS = ['.fbx', '.obj', '.dae', '.blend', '.usdz', '.usd', '.usda', '.usdc', '.stl', '.ply'];
export const CONVERT_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'blender', 'convert.py');

/**
 * @param {{ blender?: string, env?: NodeJS.ProcessEnv }} [opts]
 * @returns {{ available: boolean, path: string | null, reason?: string }}
 */
export function detectBlender(opts = {}) {
  const env = opts.env ?? process.env;
  const explicit = opts.blender ?? env.STUDIO3_BLENDER;
  if (explicit) {
    return fs.existsSync(explicit)
      ? { available: true, path: explicit }
      : { available: false, path: null, reason: `Blender executable not found at ${explicit}.` };
  }
  const found = findOnPath('blender', env);
  return found
    ? { available: true, path: found }
    : { available: false, path: null, reason: 'Blender is not installed or not on PATH. Install Blender (https://www.blender.org/download/) and make `blender` available on PATH, or pass --blender <path> / set STUDIO3_BLENDER.' };
}

/**
 * Argument vector for the conversion (no shell involved).
 * @param {string} input @param {string} output @param {string} [script]
 * @returns {string[]}
 */
export function blenderArgs(input, output, script = CONVERT_SCRIPT) {
  return ['-b', '-P', script, '--', input, output];
}

/**
 * @param {string} input absolute path @param {string} output absolute .glb path
 * @param {{ blender?: string, env?: NodeJS.ProcessEnv, timeoutMs?: number, dryRun?: boolean }} [opts]
 */
export async function importWithBlender(input, output, opts = {}) {
  const det = detectBlender(opts);
  const args = blenderArgs(input, output);
  if (!det.available || !det.path) {
    return { status: 'unavailable', reason: det.reason, command: ['blender', ...args], output: null };
  }
  if (opts.dryRun) return { status: 'dry-run', command: [det.path, ...args], output };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const res = await run(det.path, args, { timeoutMs: opts.timeoutMs ?? 15 * 60_000 });
  if (res.code !== 0 || !fs.existsSync(output)) {
    return {
      status: 'failed', command: [det.path, ...args], output: null, exitCode: res.code,
      reason: `Blender exited with code ${res.code}${fs.existsSync(output) ? '' : ' and produced no output'}.`,
      log: (res.stderr || res.stdout).trim().split('\n').slice(-15),
    };
  }
  return { status: 'converted', command: [det.path, ...args], output, bytes: fs.statSync(output).size };
}
