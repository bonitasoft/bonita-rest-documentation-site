#!/usr/bin/env bash
set -euo pipefail

echo "Using Node $(node --version)..."
rm -rf build/
node 'scripts/restdoc-site.js' "$@"
