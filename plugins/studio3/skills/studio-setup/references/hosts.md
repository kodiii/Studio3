# Hosts: Claude Code and Codex

Studio³ ships one plugin directory (`plugins/studio3/`) with a manifest per host and a marketplace file per host
at the repository root. The two hosts do not share manifest formats or command syntax.

| | Claude Code | Codex |
| - | - | - |
| Plugin manifest | `plugins/studio3/.claude-plugin/plugin.json` | `plugins/studio3/.codex-plugin/plugin.json` |
| Marketplace file | `.claude-plugin/marketplace.json` | `.agents/plugins/marketplace.json` |
| Marketplace name | `studio3-marketplace` | `studio3-marketplace` |
| Add marketplace | `claude plugin marketplace add <path-or-repo>` | `codex plugin marketplace add <path-or-repo>` |
| Install | `claude plugin install studio3@studio3-marketplace` | `codex plugin add studio3@studio3-marketplace` |
| List / inspect | `claude plugin list`, `claude plugin details studio3` | `codex plugin list`, `/plugins` in the TUI |
| Remove | `claude plugin uninstall studio3@studio3-marketplace` | `codex plugin remove studio3@studio3-marketplace` |
| Validate | `claude plugin validate <dir>` (plugin dir and marketplace root) | no validator CLI; `npm run validate` checks the manifest against the fields the Codex loader reads |
| Invoke a skill | `/studio3:studio-product` | `$studio3:studio-product` (also listed under `/skills`) |
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

What it does: copies the marketplace payload to `~/.studio3/marketplace` (archiving any previous payload to
`~/.studio3/backups/`), registers that directory with each host CLI and installs `studio3@studio3-marketplace`,
then records the result in `~/.studio3/install.json`. Running it again with a newer checkout is the upgrade path;
it refuses to downgrade without `--force`.

In **skills mode** the skills are invoked without the plugin prefix (`/studio-product`, `$studio-product`) and
tools are reached through `~/.studio3/marketplace/plugins/studio3/tools/studio3.mjs`.

## Versions and updates

- Both manifests carry the same `version`; `studio3 doctor` fails when they differ.
- Claude Code pins a marketplace-installed plugin to its `version`; a new version is picked up by
  `claude plugin marketplace update studio3-marketplace` followed by `claude plugin update studio3@studio3-marketplace`
  (or by re-running the installer). Codex refreshes its cache when the version string changes.
- Tool dependencies live outside the plugin directory (`$CLAUDE_PLUGIN_DATA/studio3-deps` or `~/.studio3/deps`)
  so they survive plugin updates.

## Developing against a checkout

```bash
claude --plugin-dir ./plugins/studio3     # load the plugin without installing
npm install && npm run dev                # gallery on http://localhost:3333
npm test && npm run test:e2e              # unit + plugin tests, then browser tests
```
