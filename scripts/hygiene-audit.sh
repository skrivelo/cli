#!/usr/bin/env bash
#
# Repo-hygiene gate for the public client. Fails if any private-repo path, corpus
# internal, or engine/fork detail leaked into this repo. The open-core line is
# strict: this repo consumes exactly one cross-boundary artifact — the vendored
# OpenAPI contract — and reveals nothing about how the service renders.
#
# Exemptions: this script (it necessarily names the banned tokens), the vendored
# contract (contract/openapi.yaml — the sanctioned public artifact), the
# generated lockfile, and build/vendor directories.
set -uo pipefail

cd "$(dirname "$0")/.." || exit 2

# Banned tokens: private source paths, corpus internals, rendering-engine / fork
# names. Case-insensitive.
# `src/main/` needs the slash: this repo's own `src/main.ts` is legitimate.
PATTERN='src/(core|api|renderer)|src/main/|\.templates-by-type|resources/vendor|agent-os|weasyprint|paged\.?js|nunjucks|denoise/|/Users/|monorepo'

matches=$(grep -rniE "$PATTERN" . \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=coverage \
  --exclude-dir=.git \
  --exclude='hygiene-audit.sh' \
  --exclude='openapi.yaml' \
  --exclude='package-lock.json' 2>/dev/null || true)

if [ -n "$matches" ]; then
  echo "✗ repo-hygiene gate FAILED — banned tokens found:"
  echo "$matches"
  exit 1
fi

echo "✓ repo-hygiene gate clean — no private paths, corpus internals, or engine/fork details."
