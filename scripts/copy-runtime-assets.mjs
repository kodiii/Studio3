#!/usr/bin/env node
// @ts-check
/**
 * Copies runtime binaries that recipes load at run time into the gallery's public folder, so they are served from
 * the gallery's own origin instead of a CDN (library contract: no external network requests).
 *   node scripts/copy-runtime-assets.mjs            (runs before the gallery's dev and build)
 *
 * - @rive-app/canvas-lite: rive.wasm and rive_fallback.wasm → apps/gallery/public/rive/
 *   The rive-state-machine recipe points RuntimeLoader.setWasmUrl / setWasmFallbackUrl at these files.
 * The copies are build output (gitignored); the .riv files next to them are committed assets (see NOTICE.md).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GALLERY = path.join(ROOT, 'apps', 'gallery');
// Resolve from the gallery, which is where Vercel installs (Root Directory apps/gallery).
const require = createRequire(path.join(GALLERY, 'package.json'));

const COPIES = [
  { pkg: '@rive-app/canvas-lite', files: ['rive.wasm', 'rive_fallback.wasm'], to: path.join(GALLERY, 'public', 'rive') },
];

let copied = 0;
for (const { pkg, files, to } of COPIES) {
  let dir;
  try { dir = path.dirname(require.resolve(`${pkg}/package.json`)); } catch {
    console.error(`copy-runtime-assets: ${pkg} is not installed; run npm install`);
    process.exit(1);
  }
  fs.mkdirSync(to, { recursive: true });
  for (const f of files) {
    const src = path.join(dir, f);
    const dst = path.join(to, f);
    const a = fs.statSync(src);
    const b = fs.existsSync(dst) ? fs.statSync(dst) : null;
    if (b && b.size === a.size && b.mtimeMs >= a.mtimeMs) continue;
    fs.copyFileSync(src, dst);
    copied++;
  }
}
console.log(`copy-runtime-assets: ${copied ? `${copied} file(s) copied` : 'up to date'}`);
