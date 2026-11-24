#!/usr/bin/env bash
# Maquettekit uninstaller. Usage: ./uninstall.sh [--host claude|codex|opencode|antigravity|all] [--purge] [--dry-run]
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
command -v node >/dev/null 2>&1 || { echo "✖ Node.js is required to run the uninstaller." >&2; exit 1; }
exec node "$DIR/scripts/install.mjs" uninstall "$@"
