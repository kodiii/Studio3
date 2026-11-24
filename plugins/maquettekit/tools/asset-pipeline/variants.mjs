// @ts-check
/**
 * `maquettekit assets variants` — one optimised GLB per delivery profile plus a
 * manifest and a combined report.
 */
import fs from 'node:fs';
import path from 'node:path';
import { UserError, log } from '../lib/log.mjs';
import { GENERATOR, formatBytes, sha256File, toolVersions, loadSharp } from './io.mjs';
import { optimizeFile, defaultName } from './optimize.mjs';
import { createOutputGuard } from './safe-output.mjs';
import { resolveProfile, loadBudgets, applyFlags, PROFILE_ORDER } from './profiles.mjs';
import { assetEntry, manifestDocument } from './manifest.mjs';
import { renderThumbnail } from './thumbnail.mjs';

/**
 * @param {string} input absolute source path
 * @param {{ outDir: string, name?: string, profiles?: string[], budgets?: string, force?: boolean,
 *   flags?: Parameters<typeof applyFlags>[1], join?: boolean, pruneAttributes?: boolean, allowSkinnedSimplify?: boolean, boundsTolerance?: number,
 *   thumbnail?: boolean, thumbnailSize?: number, background?: string | null, env?: NodeJS.ProcessEnv }} opts
 */
export async function buildVariants(input, opts) {
  const outDir = path.resolve(opts.outDir);
  const name = opts.name ?? defaultName(input);
  const extra = opts.budgets ? loadBudgets(opts.budgets) : {};
  const names = opts.profiles?.length ? opts.profiles : PROFILE_ORDER;
  if (new Set(names).size !== names.length) throw new UserError(`--profiles lists a profile twice: ${names.join(',')}`);
  const profiles = names.map((n) => {
    const r = resolveProfile(n, extra);
    return { ...r, profile: applyFlags(r.profile, opts.flags ?? {}) };
  });

  const manifestPath = path.join(outDir, `${name}.manifest.json`);
  const reportJson = path.join(outDir, `${name}.variants.report.json`);
  const reportMd = path.join(outDir, `${name}.variants.report.md`);
  const thumbPng = path.join(outDir, `${name}.png`);
  const thumbWebp = path.join(outDir, `${name}.webp`);
  const guard = createOutputGuard({ outDir, sources: [input], force: opts.force });
  guard.check([
    ...profiles.map((p) => path.join(outDir, `${name}.${p.name}.glb`)), manifestPath, reportJson, reportMd,
    ...(opts.thumbnail ? [thumbPng, thumbWebp] : []),
  ]);

  const reports = [];
  for (const p of profiles) {
    log.step(`${name}: building "${p.name}" variant (${p.origin})`);
    const report = await optimizeFile(input, {
      outDir, name: `${name}.${p.name}`, profile: p, guard, writeReports: false, force: opts.force,
      join: opts.join, pruneAttributes: opts.pruneAttributes, allowSkinnedSimplify: opts.allowSkinnedSimplify, boundsTolerance: opts.boundsTolerance, env: opts.env,
    });
    reports.push(report);
  }

  // Optional preview images, rendered from the first (highest-fidelity) variant.
  /** @type {any} */
  let thumbnail = { status: 'skipped', reason: 'Not requested (--thumbnail).' };
  let thumbRel = null; let fallbackRel = null;
  if (opts.thumbnail) {
    const size = opts.thumbnailSize ?? 512;
    const res = await renderThumbnail(/** @type {any} */ (reports[0]).outputPath, { size: Math.max(size, 1024), background: opts.background ?? null });
    if (res.status === 'ok') {
      const sharp = await loadSharp();
      if (sharp) {
        guard.write(thumbPng, await sharp(res.png).resize(size, size, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toBuffer());
        guard.write(thumbWebp, await sharp(res.png).webp({ quality: 88 }).toBuffer());
        thumbRel = path.basename(thumbPng); fallbackRel = path.basename(thumbWebp);
        thumbnail = { status: 'ok', thumbnail: thumbRel, thumbnailSize: size, fallbackImage: fallbackRel, fallbackSize: Math.max(size, 1024), renderedFrom: reports[0].output.file, renderer: res.renderer, three: res.three };
      } else {
        guard.write(thumbPng, res.png);
        thumbRel = path.basename(thumbPng); fallbackRel = thumbRel;
        thumbnail = { status: 'ok', thumbnail: thumbRel, thumbnailSize: Math.max(size, 1024), fallbackImage: fallbackRel, note: 'sharp not installed: PNG written at render size, no WebP fallback.', renderedFrom: reports[0].output.file };
      }
    } else thumbnail = { status: res.status, reason: res.reason };
  }

  const sourceInfo = { path: input, sha256: sha256File(input), bytes: fs.statSync(input).size };
  const entry = assetEntry({
    id: name, baseDir: outDir, source: sourceInfo,
    variants: profiles.map((p, i) => ({ profile: p.name, inspect: /** @type {any} */ (reports[i]).outputInspect })),
    thumbnail: thumbRel, fallbackImage: fallbackRel,
  });
  const manifest = manifestDocument([entry]);
  guard.write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const ok = reports.every((r) => r.ok);
  const combined = {
    generator: GENERATOR, generatedAt: new Date().toISOString(), tools: toolVersions(), ok, name,
    source: reports[0].source,
    note: 'Profiles are default starting points unless overridden by a budgets/profile file; they are not universal budgets.',
    manifest: path.basename(manifestPath),
    thumbnail,
    variants: reports,
    backups: guard.backups.map((b) => ({ file: path.relative(outDir, b.file), backup: path.relative(outDir, b.backup) })),
  };
  guard.write(reportJson, `${JSON.stringify(combined, null, 2)}\n`);
  guard.write(reportMd, formatVariantsMarkdown(combined));
  return { ...combined, manifestPath, reportJson, reportMd, manifestDoc: manifest };
}

/** @param {any} c */
export function formatVariantsMarkdown(c) {
  const L = [];
  const src = c.variants[0];
  L.push(`# Variant report — ${c.name}`);
  L.push('');
  L.push(`- Result: **${c.ok ? 'all variants verified' : 'VERIFICATION FAILED for at least one variant'}**`);
  L.push(`- Source: \`${c.source.file}\` — ${formatBytes(c.source.bytes)} — sha256 \`${c.source.sha256}\` (unchanged by this run)`);
  L.push(`- Manifest: \`${c.manifest}\``);
  L.push(`- Thumbnail: ${c.thumbnail.status}${c.thumbnail.reason ? ` — ${c.thumbnail.reason}` : c.thumbnail.thumbnail ? ` — \`${c.thumbnail.thumbnail}\`${c.thumbnail.fallbackImage ? `, fallback \`${c.thumbnail.fallbackImage}\`` : ''}` : ''}`);
  L.push(`- ${c.note}`);
  L.push(`- Generated: ${c.generatedAt} by ${c.generator}`);
  L.push('');
  L.push('| Variant | File | Size | vs source | Triangles | Vertices | Textures (largest) | GPU texture memory (estimate) | Compression | Verified |');
  L.push('| --- | --- | ---: | ---: | ---: | ---: | --- | ---: | --- | --- |');
  const srcTex = src.inspect.source.textures;
  /** @param {any[]} t */
  const tex = (t) => (t.length ? `${t.length} × ≤${Math.max(...t.map((x) => Math.max(x.width ?? 0, x.height ?? 0)))}px (${[...new Set(t.map((x) => String(x.mimeType).split('/')[1]))].join('/')})` : 'none');
  L.push(`| source | \`${c.source.file}\` | ${formatBytes(c.source.bytes)} | — | ${src.summary.triangles.before.toLocaleString('en-US')} | ${src.summary.vertices.before.toLocaleString('en-US')} | ${tex(srcTex)} | ${formatBytes(src.summary.gpuTextureBytesEstimate.before)} | ${src.inspect.source.totals ? 'as authored' : ''} | — |`);
  for (const v of c.variants) {
    const comp = v.extensionsUsed.includes('EXT_meshopt_compression') ? 'meshopt' : v.extensionsUsed.includes('KHR_draco_mesh_compression') ? 'draco' : 'none';
    L.push(`| ${v.profile.name} | \`${v.output.file}\` | ${formatBytes(v.output.bytes)} | ${v.summary.bytes.percent}% | ${v.summary.triangles.after.toLocaleString('en-US')} | ${v.summary.vertices.after.toLocaleString('en-US')} | ${tex(v.inspect.output.textures)} | ${formatBytes(v.summary.gpuTextureBytesEstimate.after)} | ${comp} | ${v.ok ? 'yes' : 'NO'} |`);
  }
  for (const v of c.variants) {
    L.push('');
    L.push(`## ${v.profile.name}`);
    L.push('');
    L.push(`Profile origin: ${v.profile.origin}. Settings: \`${JSON.stringify(v.profile.settings)}\``);
    L.push('');
    L.push('Steps: ' + v.steps.map((/** @type {any} */ s) => `${s.id} (${s.status}${s.status === 'skipped' ? `: ${s.reason}` : ''})`).join(' → '));
    L.push('');
    for (const t of v.textures) L.push(`- texture ${t.name} [${t.slots.join(', ') || 'unused'}, ${t.colorSpace}]: ${t.from.mimeType} ${t.from.width}×${t.from.height} ${formatBytes(t.from.bytes)} → ${t.to.mimeType} ${t.to.width}×${t.to.height} ${formatBytes(t.to.bytes)} (${t.action}${t.note ? `; ${t.note}` : ''}${t.reason ? `; ${t.reason}` : ''})`);
    L.push('');
    for (const k of v.verification.checks) L.push(`- ${k.status === 'pass' ? '✔' : k.status === 'skipped' ? '○ skipped' : '✖ FAILED'} ${k.id} — ${k.detail}`);
    if (v.decoderRequirements.length) {
      L.push('');
      L.push('Consumer requirements: ' + v.decoderRequirements.map((/** @type {any} */ d) => `\`${d.extension}\`${d.needs ? ` → ${d.needs}` : ''}`).join('; '));
    }
  }
  L.push('');
  return L.join('\n');
}
