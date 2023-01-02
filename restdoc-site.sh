#!/usr/bin/env bash
set -euo pipefail

echo "Using Node $(node --version)..."
rm -rf build/
node 'cli/restdoc-site.js' "$@"
