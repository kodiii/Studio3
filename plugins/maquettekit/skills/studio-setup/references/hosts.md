# Hosts: Claude Code, Codex, OpenCode and Antigravity

Maquettekit ships one plugin directory (`plugins/maquettekit/`) with a manifest per host and a marketplace file per host
at the repository root. The two hosts do not share manifest formats or command syntax.

| | Claude Code | Codex |
| - | - | - |
| Plugin manifest | `plugins/maquettekit/.claude-plugin/plugin.json` | `plugins/maquettekit/.codex-plugin/plugin.json` |
| Marketplace file | `.claude-plugin/marketplace.json` | `.agents/plugins/marketplace.json` |
| Marketplace name | `maquettekit-marketplace` | `maquettekit-marketplace` |
| Add marketplace | `claude plugin marketplace add <path-or-repo>` | `codex plugin marketplace add <path-or-repo>` |
| Install | `claude plugin install maquettekit@maquettekit-marketplace` | `codex plugin add maquettekit@maquettekit-marketplace` |
| List / inspect | `claude plugin list`, `claude plugin details maquettekit` | `codex plugin list`, `/plugins` in the TUI |
| Remove | `claude plugin uninstall maquettekit@maquettekit-marketplace` | `codex plugin remove maquettekit@maquettekit-marketplace` |
| Validate | `claude plugin validate <dir>` (plugin dir and marketplace root) | no validator CLI; `npm run validate` checks the manifest against the fields the Codex loader reads |
| Invoke a skill | `/maquettekit:studio-product` | `$maquettekit:studio-product` (also listed under `/skills`) |
| Plugin root in skills | `${CLAUDE_PLUGIN_ROOT}` is substituted | no substitution: use paths relative to the `SKILL.md` |
| Standalone skills dir | `~/.claude/skills/` | `~/.agents/skills/` |

The Codex column was derived from the Codex source (plugin loader, marketplace parser and CLI) because the
official documentation site was unreachable when this was written; see `docs/SOURCE-RESEARCH.md`. If a Codex
command differs in the installed version, trust `codex plugin --help`.

## OpenCode and Google Antigravity (Agent Skills hosts)

Neither has a plugin CLI; both load Agent Skills folders. The installer renders the skills (replacing
`${CLAUDE_PLUGIN_ROOT}` with the absolute payload path, since neither substitutes it) into
`~/.maquettekit/marketplace/rendered-skills/` and symlinks each one into the host's directory.

| | OpenCode | Antigravity (IDE, Antigravity 2.0, `agy` CLI) |
| - | - | - |
| Install | `./install.sh --host opencode` | `./install.sh --host antigravity` |
| Global skills | `$XDG_CONFIG_HOME/opencode/skills/` (default `~/.config/opencode/skills/`) | `~/.gemini/config/skills/` |
| Also reads | `~/.claude/skills/`, `~/.agents/skills/` | — (legacy `~/.gemini/antigravity/skills/` in older builds) |
| Workspace skills | `.opencode/skills/`, `.agents/skills/`, `.claude/skills/` | `.agents/skills/` (legacy `.agent/skills/`) |
| Invoke | the agent loads a skill on demand; ask for the task or name the skill | `/studio-product`, or describe the task |
| Pick-up | start a new session | start a new conversation / reload the window |

When Claude Code or Codex are installed in skills mode, OpenCode already sees those links, so the installer records
OpenCode as `shared` instead of adding a duplicate. Paths follow the `vercel-labs/skills` agent table (Nov 2026); if a
host reports no skills, check its docs for the current directory and pass the skills there by hand.

## Making sure the skills load (routing)

Agents decide for themselves whether to open a skill, and smaller models often answer UI requests directly without
loading one (see `evals/README.md`). Two mechanisms make the choice explicit:

- **Claude Code (plugin mode):** the plugin ships a `UserPromptSubmit` hook (`hooks/hooks.json`, `hooks/route-hint.mjs`).
  When a prompt names a concrete UI surface or technique — a pricing page, a dashboard, a staggered entrance, a GLB
  viewer — it adds one line of context naming the skill to load. It suggests each skill at most once per session,
  never blocks or stores the prompt (only the names of skills already suggested, per session id, in the plugin data
  folder) and is switched off with `MAQUETTEKIT_ROUTING_HINTS=0`.
- **Other hosts and skills mode:** `./install.sh --routing-rules` adds a short "which skill for which UI work" block to
  each installed host's global rules file — Codex `~/.codex/AGENTS.md` (`$CODEX_HOME`), OpenCode
  `~/.config/opencode/AGENTS.md`, Antigravity `~/.gemini/GEMINI.md` (shared with Gemini CLI), Claude Code
  `~/.claude/CLAUDE.md` when installed in skills mode. The block sits between `maquettekit:routing-rules` markers; the
  rest of the file is never changed, and uninstall removes the block (and the file, if the installer created it).

## MCP server

`maquettekit mcp` serves the same tools over MCP (stdio). Claude Code (plugin mode) starts it from the plugin's
`.mcp.json` as `plugin:maquettekit:maquettekit`; its tools appear as `mcp__plugin_maquettekit_maquettekit__<tool>`.
Codex (`[mcp_servers.maquettekit]` in `~/.codex/config.toml`), OpenCode (`"mcp"` in `opencode.json`, `type: "local"`)
and Antigravity (MCP server settings, raw config) need it added by hand with `command: node` and
`args: ["<payload>/plugins/maquettekit/tools/maquettekit.mjs", "mcp"]`; the installer prints the payload path. If a
client lists no Maquettekit tools, run `maquettekit doctor` and check the client's MCP log for the server's stderr.

## Local installer

From a checkout or release archive:

```bash
./install.sh                 # detects installed host CLIs, plugin mode
./install.sh --host codex    # one host (claude, codex, opencode, antigravity, or a comma list)
./install.sh --mode skills   # link the 12 skills into the host skills directory (no plugin CLI needed)
./install.sh --routing-rules # also add the skill-routing block to each host's global rules file (opt-in)
./install.sh --dry-run       # print every action without doing it
./uninstall.sh               # remove what the installer recorded; add --purge to drop backups and deps
node scripts/install.mjs status
```

What it does: copies the marketplace payload to `~/.maquettekit/marketplace` (archiving any previous payload to
`~/.maquettekit/backups/`), registers that directory with each host CLI and installs `maquettekit@maquettekit-marketplace`,
then records the result in `~/.maquettekit/install.json`. Running it again with a newer checkout is the upgrade path;
it refuses to downgrade without `--force`.

In **skills mode** the skills are invoked without the plugin prefix (`/studio-product`, `$studio-product`) and
tools are reached through `~/.maquettekit/marketplace/plugins/maquettekit/tools/maquettekit.mjs` (already written into the
rendered skills).

## Versions and updates

- Both manifests carry the same `version`; `maquettekit doctor` fails when they differ.
- Claude Code pins a marketplace-installed plugin to its `version`; a new version is picked up by
  `claude plugin marketplace update maquettekit-marketplace` followed by `claude plugin update maquettekit@maquettekit-marketplace`
  (or by re-running the installer). Codex refreshes its cache when the version string changes.
- Tool dependencies live outside the plugin directory (`$CLAUDE_PLUGIN_DATA/maquettekit-deps` or `~/.maquettekit/deps`)
  so they survive plugin updates.

## Developing against a checkout

```bash
claude --plugin-dir ./plugins/maquettekit     # load the plugin without installing
npm install && npm run dev                # gallery on http://localhost:3333
npm test && npm run test:e2e              # unit + plugin tests, then browser tests
```
