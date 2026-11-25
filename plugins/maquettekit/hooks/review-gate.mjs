#!/usr/bin/env node
// @ts-check
/**
 * Claude Code Stop hook — the opt-in Maquettekit review gate. Off unless MAQUETTEKIT_REVIEW_GATE is set:
 *   MAQUETTEKIT_REVIEW_GATE=1 (or "critical")  block finishing while the latest `maquettekit check` lists critical items
 *   MAQUETTEKIT_REVIEW_GATE=major              … critical or major items
 * It reads <cwd>/.maquettekit/check/check.json only. It never blocks twice in a row (stop_hook_active), never when
 * the review budget is used up (the skills say to report what remains instead), and ignores results older than
 * MAQUETTEKIT_REVIEW_GATE_MAX_AGE_HOURS (default 12). Any error lets the agent stop normally.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Decide whether to block. Pure apart from reading the check file.
 * @param {{ cwd?: string, stop_hook_active?: boolean }} input
 * @param {Record<string, string | undefined>} env
 * @param {number} [now]
 * @returns {{ decision: 'block', reason: string } | null}
 */
export function gate(input, env, now = Date.now()) {
  const level = String(env.MAQUETTEKIT_REVIEW_GATE ?? '').trim().toLowerCase();
  if (!level || /^(0|false|off|no)$/.test(level)) return null;
  if (input?.stop_hook_active) return null;
  const file = path.join(input?.cwd || process.cwd(), '.maquettekit', 'check', 'check.json');
  let stat;
  try { stat = fs.statSync(file); } catch { return null; }
  const maxAgeH = Number(env.MAQUETTEKIT_REVIEW_GATE_MAX_AGE_HOURS ?? 12);
  if (now - stat.mtimeMs > (Number.isFinite(maxAgeH) ? maxAgeH : 12) * 3_600_000) return null;
  let result;
  try { result = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
  const critical = result?.summary?.critical ?? 0;
  const major = result?.summary?.major ?? 0;
  const counted = level === 'major' ? critical + major : critical;
  if (!counted) return null;
  const loop = result?.steps?.review?.loop;
  if (loop && loop.passesDone >= loop.maxPasses) return null;
  const what = level === 'major' ? `${critical} critical and ${major} major` : `${critical} critical`;
  const left = loop ? ` The review budget allows ${loop.maxPasses - loop.passesDone} more pass(es).` : '';
  return {
    decision: 'block',
    reason: `Maquettekit review gate: the latest check still lists ${what} item(s) — see .maquettekit/check/check.md. Fix them and run "maquettekit check" again, or, if they cannot be fixed now, tell the user which remain and why.${left} (Gate enabled by MAQUETTEKIT_REVIEW_GATE.)`,
  };
}

async function main() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  let input = {};
  try { input = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return; }
  const verdict = gate(input, process.env);
  if (verdict) process.stdout.write(JSON.stringify(verdict));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {}).finally(() => process.exit(0));
}
