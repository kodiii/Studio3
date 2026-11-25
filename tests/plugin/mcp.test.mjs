// The Maquettekit MCP server (tools/mcp): stdio JSON-RPC protocol, tool catalogue and tool calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT } from '../../scripts/validate-plugin.mjs';
import { TOOLS, handle } from '../../plugins/maquettekit/tools/mcp/index.mjs';

const PLUGIN = path.join(ROOT, 'plugins', 'maquettekit');
const CLI = path.join(PLUGIN, 'tools', 'maquettekit.mjs');

/** Run a scripted session against the real server process; resolves with responses by id. */
function session(messages, { raw = [] } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [CLI, 'mcp'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = ''; let err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', reject);
    p.on('exit', (code) => {
      const lines = out.split('\n').filter(Boolean);
      let parsed;
      try { parsed = lines.map((l) => JSON.parse(l)); } catch (e) { reject(new Error(`stdout carried a non-JSON line: ${out}`)); return; }
      resolve({ code, err, responses: parsed, byId: Object.fromEntries(parsed.filter((m) => m.id != null).map((m) => [m.id, m])) });
    });
    for (const m of messages) p.stdin.write(`${JSON.stringify(m)}\n`);
    for (const r of raw) p.stdin.write(`${r}\n`);
    p.stdin.end();
  });
}

test('the plugin registers the server for Claude Code', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(PLUGIN, '.mcp.json'), 'utf8'));
  assert.deepEqual(cfg.mcpServers.maquettekit, { command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/tools/maquettekit.mjs', 'mcp'] });
});

test('tool catalogue: unique snake_case names, object schemas, descriptions, required keys declared', () => {
  const names = TOOLS.map((t) => t.name);
  assert.equal(new Set(names).size, names.length);
  for (const t of TOOLS) {
    assert.match(t.name, /^[a-z][a-z0-9_]*$/);
    assert.ok(t.description.length > 40, `${t.name}: description`);
    assert.equal(t.inputSchema.type, 'object', `${t.name}: object schema`);
    for (const k of t.inputSchema.required ?? []) assert.ok(k in t.inputSchema.properties, `${t.name}: required ${k} is a property`);
    assert.equal(typeof t.annotations?.readOnlyHint, 'boolean', `${t.name}: annotations`);
  }
  assert.deepEqual(names.sort(), ['assets_inspect', 'catalog_install', 'catalog_search', 'catalog_show', 'check', 'design_generate', 'design_lint', 'design_tokens', 'design_validate', 'doctor', 'review_loop_status']);
});

test('stdio session: initialize, list, call, errors — and nothing but JSON-RPC on stdout', async () => {
  const s = await session([
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'catalog_search', arguments: { query: 'magnetic button', limit: 1 } } },
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'catalog_show', arguments: {} } },
    { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'nope', arguments: {} } },
    { jsonrpc: '2.0', id: 6, method: 'ping' },
    { jsonrpc: '2.0', id: 7, method: 'resources/list' },
  ], { raw: ['{not json'] });
  assert.equal(s.code, 0);
  assert.equal(s.byId[1].result.serverInfo.name, 'maquettekit');
  assert.equal(s.byId[1].result.protocolVersion, '2025-06-18');
  assert.ok(s.byId[1].result.capabilities.tools);
  assert.equal(s.byId[2].result.tools.length, TOOLS.length);
  assert.ok(s.byId[2].result.tools.every((t) => !('run' in t)));
  assert.equal(s.byId[3].result.structuredContent.results[0].id, 'magnetic-button');
  assert.equal(JSON.parse(s.byId[3].result.content[0].text).results[0].id, 'magnetic-button');
  assert.equal(s.byId[4].result.isError, true);
  assert.match(s.byId[4].result.content[0].text, /Missing required argument\(s\): id/);
  assert.equal(s.byId[5].error.code, -32602);
  assert.deepEqual(s.byId[6].result, {});
  assert.equal(s.byId[7].error.code, -32601);
  assert.ok(s.responses.some((m) => m.id === null && m.error?.code === -32700), 'parse error reported');
  assert.equal(s.responses.filter((m) => m.id === undefined).length, 0, 'notifications get no response');
});

test('tool calls: lint, install dry run by default, design generate + validate, errors as tool results', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-mcp-'));
  try {
    fs.mkdirSync(path.join(tmp, 'src'));
    fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"x","dependencies":{"react":"^19.0.0"}}');
    const call = async (name, args) => (await handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })).result;
    const dry = await call('catalog_install', { ids: ['magnetic-button'], project_dir: tmp });
    assert.equal(dry.structuredContent.applied, false);
    assert.ok(!fs.existsSync(path.join(tmp, 'src', 'maquettekit')), 'dry run by default');
    const real = await call('catalog_install', { ids: ['magnetic-button'], project_dir: tmp, dry_run: false });
    assert.equal(real.structuredContent.applied, true);
    const gen = await call('design_generate', { brief: { productCategory: 'fintech', audience: 'retail investors', brand: { personality: ['calm'] } }, seed: '1', out_file: path.join(tmp, 'maquettekit.design.json'), css_file: path.join(tmp, 'src', 'tokens.css') });
    assert.equal(gen.structuredContent.valid, true);
    assert.ok(fs.existsSync(path.join(tmp, 'maquettekit.design.json')));
    const again = await call('design_generate', { brief: {}, out_file: path.join(tmp, 'maquettekit.design.json') });
    assert.equal(again.isError, true, 'refuses to overwrite');
    assert.equal((await call('design_validate', { file: path.join(tmp, 'maquettekit.design.json') })).structuredContent.valid, true);
    fs.writeFileSync(path.join(tmp, 'src', 'a.css'), '.a { color: #123456 }');
    const lint = await call('design_lint', { project_dir: tmp });
    assert.ok(lint.structuredContent.findings.some((f) => f.rule === 'off-token-colour' && f.value === '#123456'));
    const missing = await call('design_validate', { file: path.join(tmp, 'nope.json') });
    assert.equal(missing.isError, true);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
