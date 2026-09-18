#!/usr/bin/env bash
# Cold-clone check for the Exp-2 runnable wedge.
# Exercises local board + attention.dump + packet path.
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
need_file bin/rdos.js
need_file src/kernel.js
need_file scripts/kill14d.sh
need_file scripts/proof-layer.sh

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

command -v node >/dev/null || fail "node >=18 required"
chmod +x bin/rdos.js scripts/kill14d.sh scripts/proof-layer.sh scripts/wedge-measure.sh

home="$(mktemp -d "${TMPDIR:-/tmp}/rdos-stranger.XXXXXX")"
export RDOS_HOME="$home"

if node bin/rdos.js experiment.open --in fixtures/wedge/open-incomplete.json --home "$home" --out "$home/incomplete.json"; then
  fail "incomplete packet must reject"
fi
grep -q '"code": "MISSING_MACHINE_TIME"' "$home/incomplete.json" || fail "incomplete open missing MISSING_MACHINE_TIME"

node bin/rdos.js experiment.open --in fixtures/wedge/open-valid.json --home "$home" --out "$home/open.json" \
  || fail "valid packet must open"
grep -q '"ok": true' "$home/open.json" || fail "valid open not ok"
test -f "$home/board/experiments/exp-2-wedge-build.json" || fail "board packet not written"
grep -q '"estimate_ca_hours": 2' "$home/board/experiments/exp-2-wedge-build.json" || fail "packet missing estimate_ca_hours"
grep -q '"estimate_proof_min": 25' "$home/board/experiments/exp-2-wedge-build.json" || fail "packet missing estimate_proof_min"
grep -q '"human_gates"' "$home/board/experiments/exp-2-wedge-build.json" || fail "packet missing human_gates"
grep -q '"actuals"' "$home/board/experiments/exp-2-wedge-build.json" || fail "packet missing actuals"

node bin/rdos.js attention.dump --home "$home" --out "$home/attention.json" || fail "attention.dump failed"
test -f "$home/board/attention.dump.json" || fail "attention.dump file missing"
node -e '
const dump = require(process.argv[1]);
if (!dump.p0 || !Array.isArray(dump.hard_law)) process.exit(1);
if (!dump.p0.id || dump.hard_law.length < 5) process.exit(1);
console.log("attention.dump siblings ok");
' "$home/board/attention.dump.json" || fail "attention.dump missing p0/hard_law siblings"

if node bin/rdos.js claim.submit --in fixtures/wedge/weight-only.json --home "$home" --out "$home/weight.json"; then
  fail "weight-only claim must reject"
fi
grep -q '"code": "WEIGHT_ONLY"' "$home/weight.json" || fail "weight-only missing WEIGHT_ONLY"

# 14d stubs must run without starting the clock. Skip live APL on this check
# so a cold rd-os clone does not require a second repo; Proof Layer hook is
# scripts/proof-layer.sh (Eng Proof / M1).
node bin/kill14d.js --arm markdown --day 0 --home "$home/md" --skip-m1 > "$home/day0-markdown.json"
node bin/kill14d.js --arm rdos --day 7 --home "$home/rdos" --skip-m1 > "$home/day7-rdos.json"
for key in m1_rejected m1_n m2_illegal_accepts m3_weight_only_rejected m3_n \
  m4_underscope_rejected m4_n m5_compliant m5_n m6_baselines m6_accepts_without_query \
  m7_p0_present m7_hard_law_n; do
  grep -q "\"$key\"" "$home/day0-markdown.json" || fail "day0 markdown missing $key"
  grep -q "\"$key\"" "$home/day7-rdos.json" || fail "day7 rdos missing $key"
done
grep -q '"verdict": null' "$home/day7-rdos.json" || fail "harness self-certified verdict"
grep -q '"clock_started": false' "$home/day7-rdos.json" || fail "harness started 14d clock"
grep -q '"m2_illegal_accepts": 0' "$home/day7-rdos.json" || fail "rdos arm accepted a single-lane plant"
grep -q '"m3_weight_only_rejected": 5' "$home/day7-rdos.json" || fail "rdos arm missed a WEIGHT_ONLY plant"
grep -q '"m4_underscope_rejected": 5' "$home/day7-rdos.json" || fail "rdos arm missed an UNDER_SCOPE plant"
grep -q '"m7_p0_present": true' "$home/day7-rdos.json" || fail "rdos arm missing live P0"

echo "PASS stranger-check (board + attention + packet + 14d stubs; not a 14d verdict)"
