// @ts-check
/**
 * Source-preserving output guard. The pipeline never writes to a source asset:
 *  - a target equal to a protected source path is always refused;
 *  - an output directory that contains the source, or a target that already
 *    exists, is refused unless `force` is set;
 *  - with `force`, an existing target is first copied to `<out>/.backup/<timestamp>/`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { UserError } from '../lib/log.mjs';

/** @param {string} p */
function real(p) {
  const abs = path.resolve(p);
  try { return fs.realpathSync(abs); }
  catch {
    // Resolve the deepest existing ancestor so symlinked parents compare equal.
    const parent = path.dirname(abs);
    return parent === abs ? abs : path.join(real(parent), path.basename(abs));
  }
}

/** @param {string} dir @param {string} file */
function contains(dir, file) {
  const rel = path.relative(real(dir), real(file));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

export function backupStamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

/**
 * @param {{ outDir: string, sources?: string[], force?: boolean }} opts
 */
export function createOutputGuard(opts) {
  const outDir = path.resolve(opts.outDir);
  const sources = (opts.sources ?? []).map((s) => path.resolve(s));
  const force = !!opts.force;
  const stamp = backupStamp();
  /** @type {{ file: string, backup: string }[]} */
  const backups = [];

  /** @param {string} target */
  function assertNotSource(target) {
    for (const src of sources) {
      if (real(target) === real(src)) {
        throw new UserError(`Refusing to write to the source asset: ${src}\n  Outputs must go to a different path (source assets are never modified, even with --force).`);
      }
    }
  }

  /**
   * Validate every planned target before anything is written.
   * @param {string[]} targets
   */
  function check(targets) {
    if (fs.existsSync(outDir) && !fs.statSync(outDir).isDirectory()) throw new UserError(`Output path is not a directory: ${outDir}`);
    for (const src of sources) {
      if (contains(outDir, src) && !force) {
        throw new UserError(`Output directory ${outDir} contains the source asset ${path.basename(src)}.\n  Choose a separate output directory, or pass --force (the source itself is still never overwritten).`);
      }
    }
    const existing = [];
    for (const t of targets) {
      assertNotSource(t);
      if (fs.existsSync(t)) existing.push(t);
    }
    if (existing.length && !force) {
      throw new UserError(`Refusing to overwrite existing file${existing.length > 1 ? 's' : ''}:\n${existing.map((e) => `  ${e}`).join('\n')}\n  Pass --force to overwrite (the previous files are first copied to ${path.join(outDir, '.backup', '<timestamp>')}).`);
    }
  }

  /**
   * Write a file, backing up a previous version when `force` allows overwriting.
   * @param {string} target @param {string | Uint8Array} data
   */
  function write(target, data) {
    const abs = path.resolve(target);
    assertNotSource(abs);
    if (fs.existsSync(abs)) {
      if (!force) throw new UserError(`Refusing to overwrite existing file: ${abs} (pass --force).`);
      const dir = path.join(outDir, '.backup', stamp);
      fs.mkdirSync(dir, { recursive: true });
      const backup = path.join(dir, path.basename(abs));
      fs.copyFileSync(abs, backup);
      backups.push({ file: abs, backup });
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, data);
    return abs;
  }

  return { outDir, force, check, write, backups };
}
