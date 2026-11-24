# Hosts: Claude Code and Codex

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

## Local installer

From a checkout or release archive:

```bash
./install.sh                 # detects installed host CLIs, plugin mode
./install.sh --host codex    # one host
./install.sh --mode skills   # link the 12 skills into the host skills directory (no plugin CLI needed)
./install.sh --dry-run       # print every action without doing it
./uninstall.sh               # remove what the installer recorded; add --purge to drop backups and deps
node scripts/install.mjs status
```

What it does: copies the marketplace payload to `~/.maquettekit/marketplace` (archiving any previous payload to
`~/.maquettekit/backups/`), registers that directory with each host CLI and installs `maquettekit@maquettekit-marketplace`,
then records the result in `~/.maquettekit/install.json`. Running it again with a newer checkout is the upgrade path;
it refuses to downgrade without `--force`.

In **skills mode** the skills are invoked without the plugin prefix (`/studio-product`, `$studio-product`) and
tools are reached through `~/.maquettekit/marketplace/plugins/maquettekit/tools/maquettekit.mjs`.

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
