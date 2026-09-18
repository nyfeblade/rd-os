#!/usr/bin/env bash
# Eng Proof dual-gate: stranger-check + proof-layer + kill14d day0 + UI already in stranger.
# Does not start the 14-day clock. Does not set verdict.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

chmod +x scripts/stranger-check.sh scripts/kill14d.sh scripts/proof-layer.sh scripts/wedge-measure.sh

./scripts/stranger-check.sh
./scripts/wedge-measure.sh
./scripts/proof-layer.sh
./scripts/kill14d.sh --arm markdown --day 0
if [[ -d "${APL_DIR:-/tmp/rd-os-agent-proof-layer}" ]]; then
  ./scripts/kill14d.sh --arm rdos --day 0
else
  ./scripts/kill14d.sh --arm rdos --day 0 --skip-m1
fi

echo "PASS dual-gate (stranger + measure + proof-layer + kill14d day0; not a 14d verdict)"
