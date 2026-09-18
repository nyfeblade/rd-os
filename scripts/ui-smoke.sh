#!/usr/bin/env bash
# HTTP smoke for the steer cockpit. No glass theater. No 14d PASS.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

fail() {
  echo "FAIL ui-smoke: $*" >&2
  exit 1
}

home="$(mktemp -d "${TMPDIR:-/tmp}/rdos-ui.XXXXXX")"
port="$(node -e 'const s=require("net").createServer(); s.listen(0,"127.0.0.1",()=>{process.stdout.write(String(s.address().port)); s.close();})')"
node bin/lab.js --home "$home" --port "$port" --host 127.0.0.1 >"$home/lab.log" 2>&1 &
pid=$!
cleanup() {
  kill "$pid" >/dev/null 2>&1 || true
}
trap cleanup EXIT

ok=0
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf "http://127.0.0.1:${port}/" >/dev/null; then
    ok=1
    break
  fi
  sleep 0.2
done
test "$ok" = 1 || fail "lab did not listen; $(cat "$home/lab.log")"

html="$(curl -sf "http://127.0.0.1:${port}/")"
echo "$html" | grep -q "Active thesis" || fail "UI missing Active thesis"
echo "$html" | grep -q "HARD LAW" || fail "UI missing HARD LAW"
echo "$html" | grep -q "Bottleneck" || fail "UI missing Bottleneck"
echo "$html" | grep -q "Redirect" || fail "UI missing Redirect"

state="$(curl -sf "http://127.0.0.1:${port}/api/state")"
echo "$state" | grep -q '"hard_law"' || fail "state missing hard_law"
echo "$state" | grep -q '"p0"' || fail "state missing p0"
echo "$state" | grep -q 'exp-2-rd-os-lab' || fail "seed experiment missing"
echo "$state" | grep -q '"clock_started": false' || fail "UI started 14d clock"

incomplete="$(curl -s -o "$home/incomplete.json" -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -d '{"tool":"experiment.open","payload":{"experiment_id":"ui-incomplete","title":"no fields"},"actor":"agent"}' \
  "http://127.0.0.1:${port}/api/tool")"
test "$incomplete" != "200" || fail "incomplete open must not 200"
grep -q 'MISSING_MACHINE_TIME' "$home/incomplete.json" || fail "UI open missing MISSING_MACHINE_TIME"

agent_steer="$(curl -s -o "$home/agent-steer.json" -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -d '{"tool":"steer.gate","payload":{"experiment_id":"exp-2-rd-os-lab","kind":"scope_change","reason":"agent"},"actor":"agent"}' \
  "http://127.0.0.1:${port}/api/tool")"
test "$agent_steer" != "200" || fail "agent steer.gate must not 200"
grep -q 'NOT_HUMAN' "$home/agent-steer.json" || fail "agent steer missing NOT_HUMAN"

curl -sf -H 'Content-Type: application/json' \
  -d '{"experiment_id":"exp-2-rd-os-lab","kind":"scope_change","reason":"human redirect"}' \
  "http://127.0.0.1:${port}/api/steer" | grep -q '"ok": true' \
  || fail "human steer.gate must work"

echo "PASS ui-smoke (thesis + attention + bottleneck + redirect + rejects)"
