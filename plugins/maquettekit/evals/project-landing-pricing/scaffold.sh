#!/usr/bin/env bash
# Copies this case's fixture project into the eval workspace (the current directory).
set -euo pipefail
cp -R "$(cd "$(dirname "$0")" && pwd)/fixture/." .
