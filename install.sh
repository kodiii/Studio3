#!/usr/bin/env bash
# Maquettekit installer (macOS Apple Silicon / Intel, Linux). Usage: ./install.sh [--host claude|codex|all] [--mode auto|plugin|skills] [--dry-run] [--force] [--verify]
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
command -v node >/dev/null 2>&1 || { echo "✖ Node.js >= 20.11 is required (https://nodejs.org). On macOS: brew install node" >&2; exit 1; }
exec node "$DIR/scripts/install.mjs" install "$@"
