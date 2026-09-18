#!/usr/bin/env bash
# Contract presence check for the Exp-2 research PR.
# Does not PASS the 14-day kill. Does not self-cert the wedge.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

need_file() {
  test -f "$1" || fail "missing $1"
}

need_file ARCHITECTURE.md
need_file KILL_14D.md
need_file INSTRUMENTS.md
need_file MCP_CONTRACT.md
need_file schema/machine-time.ts
need_file schema/experiment.ts
need_file schema/mcp.ts
need_file schema/attention.ts

for doc in ARCHITECTURE.md MCP_CONTRACT.md; do
  grep -qi "HARD LAW" "$doc" || fail "$doc missing HARD LAW heading"
  grep -q "estimate_ca_hours" "$doc" || fail "$doc missing estimate_ca_hours"
  grep -q "estimate_proof_min" "$doc" || fail "$doc missing estimate_proof_min"
  grep -q "human_gates" "$doc" || fail "$doc missing human_gates"
  grep -q "actuals" "$doc" || fail "$doc missing actuals"
  grep -qi "anti-single-lane" "$doc" || fail "$doc missing anti-single-lane"
  grep -qi "research-before-claim" "$doc" || fail "$doc missing research-before-claim"
  grep -qi "weight-only\|WEIGHT_ONLY" "$doc" || fail "$doc missing weight-only reject"
  grep -qi "envelope" "$doc" || fail "$doc missing envelope"
  grep -qi "attention" "$doc" || fail "$doc missing attention pane"
done

grep -q "WEIGHT_ONLY" MCP_CONTRACT.md || fail "MCP_CONTRACT.md missing WEIGHT_ONLY code"
grep -q "UNDER_SCOPE" MCP_CONTRACT.md || fail "MCP_CONTRACT.md missing UNDER_SCOPE code"
grep -q "Δ=+0.20\|DELTA=+0.20\|+0.20" KILL_14D.md ARCHITECTURE.md MCP_CONTRACT.md \
  || fail "CNP v2 FAIL +0.20 not cited"

for field in estimate_ca_hours estimate_proof_min human_gates actuals; do
  grep -q "$field" schema/machine-time.ts || fail "schema/machine-time.ts missing $field"
done

echo "PASS stranger-check (docs+schema contract only; not a 14d verdict)"
