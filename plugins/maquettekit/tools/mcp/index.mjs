// @ts-check
/**
 * `maquettekit mcp` — a Model Context Protocol server over stdio exposing Maquettekit's tools as typed tool calls.
 * Agents (Claude Code, Codex, OpenCode, Antigravity, any MCP client) call them with JSON arguments instead of
 * composing shell commands, which is more reliable for smaller models.
 *
 * Dependency-free: newline-delimited JSON-RPC 2.0 on stdin/stdout (the MCP stdio transport); supports initialize,
 * ping, tools/list and tools/call. Nothing but protocol messages is written to stdout — every other output, including
 * console.log from the tools, goes to stderr. Paths in arguments are resolved against the server's working directory.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { UserError } from '../lib/log.mjs';
import { PLUGIN_ROOT, TOOLS_DIR } from '../lib/resolve.mjs';

export const help = `maquettekit mcp — run the Maquettekit MCP server on stdio (for Claude Code, Codex, OpenCode, Antigravity…)

Usage: maquettekit mcp            (started by the MCP client, not by hand)

Tools: catalog_search, catalog_show, catalog_install, design_generate, design_validate, design_tokens, design_lint,
check, review_loop_status, assets_inspect, doctor.

Client configuration (the Claude Code plugin registers it automatically through its .mcp.json):
  command: node   args: ["<plugin>/tools/maquettekit.mjs", "mcp"]`;

function version() {
  try { return JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).version; }
  catch { return JSON.parse(fs.readFileSync(path.join(TOOLS_DIR, 'package.json'), 'utf8')).version; }
}

const abs = (p, fallback = '.') => path.resolve(typeof p === 'string' && p ? p : fallback);
const str = { type: 'string' };
const strList = { type: 'array', items: { type: 'string' } };
const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

/** @type {{ name: string, title: string, description: string, inputSchema: any, annotations?: any, run: (a: any) => Promise<any> }[]} */
export const TOOLS = [
  {
    name: 'catalog_search', title: 'Search the effect library',
    description: 'Search the Maquettekit Component & Effect Library (47 tested UI effects and 3D components, React + CSS/WAAPI/Motion/GSAP/three.js). Use before writing an effect from scratch. Returns ranked recipes with id, description, technology and npm dependencies.',
    inputSchema: { type: 'object', properties: { query: { ...str, description: 'Free text, e.g. "magnetic button" or "scroll pinned"' }, category: str, technology: { ...str, description: 'css, waapi, motion, gsap, three, r3f, glsl, d3, svg, canvas2d' }, specialty: { type: 'string', enum: ['product', 'cinematic', 'data', 'social', '3d'] }, interaction: str, intensity: { type: 'string', enum: ['subtle', 'moderate', 'bold'] }, max_complexity: { type: 'integer', minimum: 1, maximum: 3 }, no_dependencies: { type: 'boolean', description: 'Only recipes without npm dependencies' }, limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 } }, required: ['query'], additionalProperties: false },
    annotations: RO,
    async run(a) {
      const { loadCatalog, searchEffects } = await import('../catalog/index.mjs');
      const hits = searchEffects(loadCatalog().effects, a.query, { category: a.category, tech: a.technology, specialty: a.specialty, interaction: a.interaction, intensity: a.intensity, maxComplexity: a.max_complexity, noDeps: a.no_dependencies }).slice(0, a.limit ?? 10);
      return { results: hits.map((h) => ({ id: h.effect.id, name: h.effect.name, score: h.score, description: h.effect.description, category: h.effect.category, technology: h.effect.technology, specialties: h.effect.specialties, complexity: h.effect.complexity, intensity: h.effect.intensity, dependencies: h.effect.dependencies })) };
    },
  },
  {
    name: 'catalog_show', title: 'Show a recipe or demo',
    description: 'Metadata for one effect or demo: parameters, accessibility, reduced-motion and performance notes, files, and (with include_source) every source file. Read accessibility and reducedMotion as requirements.',
    inputSchema: { type: 'object', properties: { id: str, include_source: { type: 'boolean', default: false } }, required: ['id'], additionalProperties: false },
    annotations: RO,
    async run(a) {
      const { loadCatalog } = await import('../catalog/index.mjs');
      const cat = loadCatalog();
      const item = cat.effects.find((e) => e.id === a.id) ?? cat.demos.find((d) => d.id === a.id);
      if (!item) throw new UserError(`No effect or demo with id "${a.id}". Use catalog_search first.`);
      const dir = path.join(PLUGIN_ROOT, item.path);
      return { ...item, directory: dir, ...(a.include_source ? { sources: Object.fromEntries(item.files.map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')])) } : {}) };
    },
  },
  {
    name: 'catalog_install', title: 'Install recipes into a project',
    description: 'Copy recipes or demos and everything they import (motion engine, three-kit, types, other recipes) into a project folder (default src/maquettekit), keeping the library layout so imports resolve. Defaults to a dry run that returns the plan; pass dry_run: false to write. Never overwrites changed files unless force. Returns the npm install command for packages still missing (it installs nothing itself).',
    inputSchema: { type: 'object', properties: { ids: { ...strList, minItems: 1 }, project_dir: { ...str, description: 'Project root (default: working directory)' }, into: { ...str, description: 'Target folder, relative to project_dir' }, dry_run: { type: 'boolean', default: true }, force: { type: 'boolean', default: false } }, required: ['ids'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async run(a) {
      const { loadCatalog } = await import('../catalog/index.mjs');
      const { installItems } = await import('../catalog/install.mjs');
      return installItems(loadCatalog(), a.ids, { project: abs(a.project_dir), into: a.into, force: !!a.force, apply: a.dry_run === false });
    },
  },
  {
    name: 'design_generate', title: 'Generate a design system',
    description: 'Generate maquettekit.design.json (colour with contrast guarantees, type scale, spacing, radius, elevation, motion tokens and profile, component and accessibility rules) from a brief, deterministically. Returns a summary; writes out_file (and css_file tokens) when given. Refuses to overwrite an existing out_file unless force.',
    inputSchema: { type: 'object', properties: {
      brief: { type: 'object', description: 'Fields: productCategory, audience, brand {name, personality[], existingColors[], existingFonts[]}, businessGoals[], targetDevices[], preferredAesthetic, interactionComplexity (low|medium|high), accessibility {level AA|AAA, needs[]}, performance {budget tight|balanced|generous, lowEndDevices}, stack {framework, styling, libs[]}, motionIntensity (essential|expressive|immersive), requires3d, threeD {purpose}, specialty (product|cinematic|data|social|3d)', additionalProperties: true },
      seed: { ...str, description: 'Byte-reproducible output' }, direction: { ...str, description: 'Force an art direction id' }, out_file: { ...str, description: 'Write the design file here, e.g. maquettekit.design.json' }, css_file: { ...str, description: 'Also write CSS custom-property tokens here' }, force: { type: 'boolean', default: false } }, required: ['brief'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async run(a) {
      const { generateDesign, validateDesign, exportTokens } = await import('../design-intelligence/index.mjs');
      const seeded = typeof a.seed === 'string' && a.seed;
      const doc = generateDesign(a.brief ?? {}, { seed: seeded ? a.seed : undefined, direction: a.direction, now: seeded ? undefined : new Date().toISOString() });
      const v = validateDesign(doc);
      const written = {};
      if (a.out_file) {
        const p = abs(a.out_file);
        if (fs.existsSync(p) && !a.force) throw new UserError(`${p} already exists; pass force: true to replace it (or edit its "overrides").`);
        fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, `${JSON.stringify(doc, null, 2)}\n`); written.design = p;
      }
      if (a.css_file) { const p = abs(a.css_file); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, exportTokens(doc, 'css')); written.css = p; }
      return {
        direction: { id: doc.visualDirection.id, name: doc.visualDirection.name, thesis: doc.visualDirection.thesis },
        typography: { display: doc.typography.families.display.family, text: doc.typography.families.text.family, mono: doc.typography.families.mono.family },
        colour: { primaryLight: doc.color.light.roles.primary.hex, primaryDark: doc.color.dark.roles.primary.hex, brandHue: doc.color.brand.hue },
        motion: { profile: doc.motion.profile, durations: doc.motion.durations }, spacingScale: doc.spacing.scale, radiusScale: doc.radius.scale,
        valid: v.valid, errors: v.errors, assumptions: doc.meta.assumptions, written,
        ...(a.out_file ? {} : { note: 'Nothing written: pass out_file (and css_file) to save the design file and tokens.' }),
      };
    },
  },
  {
    name: 'design_validate', title: 'Validate a design file',
    description: 'Schema and semantic validation of maquettekit.design.json: contrast pairs, scale monotonicity, token references.',
    inputSchema: { type: 'object', properties: { file: { ...str, default: 'maquettekit.design.json' } }, additionalProperties: false },
    annotations: RO,
    async run(a) {
      const { validateDesign } = await import('../design-intelligence/index.mjs');
      const p = abs(a.file, 'maquettekit.design.json');
      if (!fs.existsSync(p)) throw new UserError(`${p} not found`);
      return validateDesign(JSON.parse(fs.readFileSync(p, 'utf8')));
    },
  },
  {
    name: 'design_tokens', title: 'Export design tokens',
    description: 'Export a design file as CSS custom properties, a Tailwind theme, a TypeScript module or W3C design tokens (json-dtcg).',
    inputSchema: { type: 'object', properties: { file: { ...str, default: 'maquettekit.design.json' }, format: { type: 'string', enum: ['css', 'tailwind', 'ts', 'json-dtcg'], default: 'css' } }, additionalProperties: false },
    annotations: RO,
    async run(a) {
      const { exportTokens } = await import('../design-intelligence/index.mjs');
      const p = abs(a.file, 'maquettekit.design.json');
      if (!fs.existsSync(p)) throw new UserError(`${p} not found`);
      return { format: a.format ?? 'css', text: exportTokens(JSON.parse(fs.readFileSync(p, 'utf8')), a.format ?? 'css') };
    },
  },
  {
    name: 'design_lint', title: 'Lint styles against the design system',
    description: 'Find colours, spacing, font sizes, radii and durations in the project\'s code that are not from its design tokens (maquettekit.design.json and the project\'s own :root/theme variables), each with the nearest token to use instead.',
    inputSchema: { type: 'object', properties: { project_dir: str, design_file: str, ignore: strList, max_findings: { type: 'integer', minimum: 1, maximum: 500, default: 100 } }, additionalProperties: false },
    annotations: RO,
    async run(a) {
      const { lintProject } = await import('../design-intelligence/lint.mjs');
      return lintProject({ dir: abs(a.project_dir), design: a.design_file, ignore: a.ignore, maxFindings: a.max_findings ?? 100 });
    },
  },
  {
    name: 'check', title: 'Verify a page (one ranked fix list)',
    description: 'The verify step in one call: validates the design file, lints tokens, reviews the page in a headless browser (layout, accessibility, keyboard, interaction reachability, reduced motion, 3D) and assesses interaction quality, then returns one ranked fix list (critical first) and writes .maquettekit/check/check.md. Needs a running local URL or a static folder for the browser steps; takes one to a few minutes.',
    inputSchema: { type: 'object', properties: { url: { ...str, description: 'e.g. http://localhost:3000/pricing' }, serve_dir: { ...str, description: 'Static folder to serve instead of url' }, project_dir: { ...str, description: 'Source to lint (default: working directory)' }, routes: strList, profile: { type: 'string', enum: ['essential', 'expressive', 'immersive'] }, viewports: strList, skip_review: { type: 'boolean' }, skip_experience: { type: 'boolean' }, skip_lint: { type: 'boolean' }, max_items: { type: 'integer', minimum: 1, maximum: 200, default: 40 } }, additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    async run(a) {
      const { runCheck } = await import('../check/index.mjs');
      const { result, files } = await runCheck({ url: a.url, serve: a.serve_dir ? abs(a.serve_dir) : undefined, routes: a.routes, dir: abs(a.project_dir), profile: a.profile, viewports: a.viewports, review: a.skip_review ? false : undefined, experience: a.skip_experience ? false : undefined, lint: a.skip_lint ? false : undefined });
      const max = a.max_items ?? 40;
      return { summary: result.summary, steps: result.steps, items: result.items.slice(0, max), truncated: result.items.length > max, notRun: result.notRun, files };
    },
  },
  {
    name: 'review_loop_status', title: 'Review loop status',
    description: 'State of the improve → retest loop for browser reviews: passes done, whether to stop, the fix list of the latest pass and the delta from the previous one.',
    inputSchema: { type: 'object', properties: { out_dir: { ...str, default: '.maquettekit/review' }, max_passes: { type: 'integer', minimum: 1, maximum: 10, default: 3 } }, additionalProperties: false },
    annotations: RO,
    async run(a) {
      const { loopStatus } = await import('../visual-director/loop.mjs');
      return loopStatus({ out: abs(a.out_dir, '.maquettekit/review'), maxPasses: a.max_passes ?? 3 });
    },
  },
  {
    name: 'assets_inspect', title: 'Inspect a 3D model',
    description: 'Inspect a glTF/GLB model without modifying it: hierarchy, triangles, materials, textures, estimated GPU memory and draw calls. Needs the optional glTF tooling (installed with "maquettekit setup").',
    inputSchema: { type: 'object', properties: { file: str }, required: ['file'], additionalProperties: false },
    annotations: RO,
    async run(a) {
      const { inspectFile } = await import('../asset-pipeline/inspect.mjs');
      return inspectFile(abs(a.file));
    },
  },
  {
    name: 'doctor', title: 'Diagnose the Maquettekit install',
    description: 'Check the runtime, plugin manifests, skills, catalogue, optional dependencies (Playwright, glTF tooling) and host installs; returns every check with pass/warn/fail and the fix.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: RO,
    async run() {
      const { collect } = await import('../doctor/index.mjs');
      return collect({});
    },
  },
];
const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

/**
 * Handle one JSON-RPC message; returns the response object (or null for notifications).
 * @param {any} msg
 */
export async function handle(msg) {
  const isReq = msg && typeof msg === 'object' && msg.jsonrpc === '2.0' && typeof msg.method === 'string';
  if (!isReq) return { jsonrpc: '2.0', id: msg?.id ?? null, error: { code: -32600, message: 'Invalid Request' } };
  const { id, method, params } = msg;
  const notification = id === undefined;
  const ok = (result) => (notification ? null : { jsonrpc: '2.0', id, result });
  const fail = (code, message, data) => (notification ? null : { jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } });
  switch (method) {
    case 'initialize': {
      const requested = params?.protocolVersion;
      return ok({
        protocolVersion: typeof requested === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'maquettekit', title: 'Maquettekit', version: version() },
        instructions: 'Maquettekit design-engineering tools. Before writing a UI effect, search the library (catalog_search) and install recipes with catalog_install. For design systems use design_generate then design_lint. To verify a page, call check with a local URL and fix its items in order.',
      });
    }
    case 'notifications/initialized': case 'notifications/cancelled': return null;
    case 'ping': return ok({});
    case 'tools/list': return ok({ tools: TOOLS.map(({ run, ...t }) => t) });
    case 'tools/call': {
      const tool = BY_NAME.get(params?.name);
      if (!tool) return fail(-32602, `Unknown tool: ${params?.name}`);
      const args = params?.arguments ?? {};
      if (typeof args !== 'object' || Array.isArray(args)) return fail(-32602, 'arguments must be an object');
      const missing = (tool.inputSchema.required ?? []).filter((k) => args[k] === undefined);
      if (missing.length) return ok({ isError: true, content: [{ type: 'text', text: `Missing required argument(s): ${missing.join(', ')}` }] });
      try {
        const data = await tool.run(args);
        return ok({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data && typeof data === 'object' && !Array.isArray(data) ? data : { value: data } });
      } catch (err) {
        const e = /** @type {any} */ (err);
        return ok({ isError: true, content: [{ type: 'text', text: e instanceof UserError ? e.message : `${tool.name} failed: ${e?.message ?? String(e)}` }] });
      }
    }
    default: return fail(-32601, `Method not found: ${method}`);
  }
}

/** Run the stdio server until stdin closes. */
export async function serve() {
  const write = process.stdout.write.bind(process.stdout);
  // the protocol owns stdout: route every console.log from the tools to stderr
  console.log = (...a) => console.error(...a);
  console.info = (...a) => console.error(...a);
  const pending = new Set();
  const send = (obj) => { if (obj) write(`${JSON.stringify(obj)}\n`); };
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', (line) => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch { send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); return; }
    const p = (async () => {
      if (Array.isArray(msg)) { const out = (await Promise.all(msg.map(handle))).filter(Boolean); if (out.length) send(out); }
      else send(await handle(msg));
    })().catch((err) => send({ jsonrpc: '2.0', id: msg?.id ?? null, error: { code: -32603, message: String(err?.message ?? err) } }));
    pending.add(p); p.finally(() => pending.delete(p));
  });
  await new Promise((resolve) => rl.on('close', resolve));
  await Promise.allSettled([...pending]);
}

/** @param {string[]} argv */
export async function main(argv) {
  if (argv.length && argv[0] !== 'serve') throw new UserError(`Unknown mcp argument "${argv[0]}".\n\n${help}`);
  await serve();
  return 0;
}
