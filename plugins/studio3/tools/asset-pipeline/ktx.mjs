// @ts-check
/**
 * KTX2 / Basis Universal encoding through the `ktx` CLI from KTX-Software.
 * @gltf-transform/functions 4.5.1 ships no toktx/ktx transform (those live in
 * the separate @gltf-transform/cli package), so the CLI is spawned directly —
 * always with an argv array, never through a shell.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

/**
 * Locate an executable on PATH without spawning a shell.
 * @param {string} name @param {NodeJS.ProcessEnv} [env]
 * @returns {string | null}
 */
export function findOnPath(name, env = process.env) {
  const dirs = (env.PATH ?? env.Path ?? '').split(path.delimiter).filter(Boolean);
  const exts = process.platform === 'win32' ? (env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';') : [''];
  for (const dir of dirs) {
    for (const ext of exts) {
      const p = path.join(dir, name + ext);
      try {
        const st = fs.statSync(p);
        if (!st.isFile()) continue;
        if (process.platform !== 'win32') fs.accessSync(p, fs.constants.X_OK);
        return p;
      } catch { /* next */ }
    }
  }
  return null;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ available: boolean, path: string | null, reason?: string }}
 */
export function detectKtx(env = process.env) {
  const override = env.STUDIO3_KTX;
  if (override) {
    return fs.existsSync(override) ? { available: true, path: override } : { available: false, path: null, reason: `STUDIO3_KTX points to a missing file: ${override}` };
  }
  const found = findOnPath('ktx', env);
  return found
    ? { available: true, path: found }
    : { available: false, path: null, reason: 'KTX2 requires the `ktx` CLI from KTX-Software (https://github.com/KhronosGroup/KTX-Software), not found on PATH.' };
}

/**
 * Arguments for `ktx create`. UASTC for linear data (normal/ORM maps), ETC1S
 * (BasisLZ) for colour — the usual quality/size trade-off, overridable by callers.
 * @param {{ input: string, output: string, srgb: boolean, mode?: 'uastc' | 'etc1s', quality?: number }} o
 * @returns {string[]}
 */
export function ktxCreateArgs(o) {
  const mode = o.mode ?? (o.srgb ? 'etc1s' : 'uastc');
  const args = ['create', '--format', o.srgb ? 'R8G8B8A8_SRGB' : 'R8G8B8A8_UNORM', '--assign-tf', o.srgb ? 'srgb' : 'linear', '--generate-mipmap'];
  if (mode === 'uastc') args.push('--encode', 'uastc', '--uastc-quality', '2', '--zstd', '18');
  else args.push('--encode', 'basis-lz', '--qlevel', String(Math.max(1, Math.min(255, Math.round(((o.quality ?? 80) / 100) * 255)))));
  args.push(o.input, o.output);
  return args;
}

/**
 * @param {string} bin @param {string[]} args @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<{ code: number | null, stdout: string, stderr: string }>}
 */
export function run(bin, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    const timer = opts.timeoutMs ? setTimeout(() => child.kill('SIGKILL'), opts.timeoutMs) : null;
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => { if (timer) clearTimeout(timer); reject(err); });
    child.on('close', (code) => { if (timer) clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}

/**
 * Encode PNG bytes to KTX2 with the `ktx` CLI.
 * @param {string} ktxPath @param {Uint8Array} png @param {{ srgb: boolean, quality?: number }} opts
 * @returns {Promise<Uint8Array>}
 */
export async function encodeKtx2(ktxPath, png, opts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio3-ktx-'));
  try {
    const input = path.join(dir, 'in.png'); const output = path.join(dir, 'out.ktx2');
    fs.writeFileSync(input, png);
    const res = await run(ktxPath, ktxCreateArgs({ input, output, srgb: opts.srgb, quality: opts.quality }), { timeoutMs: 10 * 60_000 });
    if (res.code !== 0 || !fs.existsSync(output)) throw new Error(`ktx create exited with ${res.code}: ${res.stderr.trim().split('\n').slice(-2).join(' ')}`);
    return new Uint8Array(fs.readFileSync(output));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
