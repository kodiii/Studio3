#!/usr/bin/env node
// @ts-check
/**
 * Maquettekit tool dispatcher.
 *   node maquettekit.mjs <command> [subcommand] [options]
 * Every command module exports `async function main(argv: string[]): Promise<number | void>`
 * (argv excludes the command name) and a `help` string.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { TOOLS_DIR, PLUGIN_ROOT } from './lib/resolve.mjs';
import { log, UserError } from './lib/log.mjs';

export const COMMANDS = {
  doctor: { file: 'doctor/index.mjs', summary: 'Diagnose runtime, dependencies, browsers and host installs' },
  setup: { file: 'setup/index.mjs', summary: 'Install optional tool dependencies (playwright, glTF tooling) into the Maquettekit deps dir' },
  design: { file: 'design-intelligence/index.mjs', summary: 'Design Intelligence Engine — generate/validate maquettekit.design.json and tokens' },
  review: { file: 'visual-director/index.mjs', summary: 'Visual Director — capture, analyse, 3D diagnostics, compare, report' },
  experience: { file: 'experience-lab/index.mjs', summary: 'Experience Lab — heuristic interaction-quality assessment' },
  assets: { file: 'asset-pipeline/index.mjs', summary: '3D Asset Pipeline — inspect, validate, optimize, variants, manifest' },
  catalog: { file: 'catalog/index.mjs', summary: 'Search the Component & Effect Library catalog' },
  check: { file: 'check/index.mjs', summary: 'Verify in one run: design file, token lint, browser review, experience → one ranked fix list' },
};

export function version() {
  try { return JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).version; }
  catch { return JSON.parse(fs.readFileSync(path.join(TOOLS_DIR, 'package.json'), 'utf8')).version; }
}

function usage() {
  const rows = Object.entries(COMMANDS).map(([k, v]) => `  ${k.padEnd(11)} ${v.summary}`).join('\n');
  return `Maquettekit v${version()} — Design Intelligence. Motion Engineering. Digital Experiences.\n\n` +
    `Usage: maquettekit <command> [options]\n\nCommands:\n${rows}\n\n` +
    `Run "maquettekit <command> --help" for command options. Output artefacts default to ./.maquettekit/.\n` +
    `Telemetry: none. Nothing is uploaded; nothing is downloaded except by an explicit "setup".`;
}

async function run(argv) {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') { console.log(usage()); return 0; }
  if (cmd === '--version' || cmd === '-v' || cmd === 'version') { console.log(version()); return 0; }
  const entry = COMMANDS[cmd];
  if (!entry) throw new UserError(`Unknown command "${cmd}".\n\n${usage()}`);
  const file = path.join(TOOLS_DIR, entry.file);
  if (!fs.existsSync(file)) throw new UserError(`Command "${cmd}" is not available in this build (missing ${entry.file}).`, 4);
  const mod = await import(pathToFileURL(file).href);
  if (rest.includes('--help') || rest.includes('-h')) { console.log(mod.help ?? entry.summary); return 0; }
  const code = await mod.main(rest);
  return typeof code === 'number' ? code : 0;
}

run(process.argv.slice(2)).then(
  (code) => { process.exitCode = code; },
  (err) => {
    if (err instanceof UserError) { log.error(err.message); process.exitCode = err.exitCode; }
    else { log.error(err?.stack ?? String(err)); process.exitCode = 1; }
  },
);
