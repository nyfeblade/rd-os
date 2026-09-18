#!/usr/bin/env bash
# First instrument hook: clone/call agent-proof-layer `npm run demo:reject`.
# Does not fork Proof Layer. Does not set verdict.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
chmod +x bin/proof-layer.js
exec node bin/proof-layer.js "$@"
