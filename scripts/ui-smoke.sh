#!/usr/bin/env bash
# HTTP smoke for Designer steer cockpit v1. Dump remains SoT. No 14d PASS.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

fail() {
  echo "FAIL ui-smoke: $*" >&2
  exit 1
}

start_lab() {
  local home="$1"
  local extra=("${@:2}")
  local port
  port="$(node -e 'const s=require("net").createServer(); s.listen(0,"127.0.0.1",()=>{process.stdout.write(String(s.address().port)); s.close();})')"
  node bin/lab.js --home "$home" --port "$port" --host 127.0.0.1 "${extra[@]}" >"$home/lab.log" 2>&1 &
  echo $! >"$home/lab.pid"
  echo "$port" >"$home/lab.port"
  local ok=0
  local _
  for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
    if curl -sf "http://127.0.0.1:${port}/" >/dev/null; then
      ok=1
      break
    fi
    sleep 0.15
  done
  test "$ok" = 1 || fail "lab did not listen; $(cat "$home/lab.log")"
}

stop_lab() {
  local home="$1"
  if test -f "$home/lab.pid"; then
    kill "$(cat "$home/lab.pid")" >/dev/null 2>&1 || true
  fi
}

home_default="$(mktemp -d "${TMPDIR:-/tmp}/rdos-ui.XXXXXX")"
start_lab "$home_default"
port="$(cat "$home_default/lab.port")"
html="$(curl -sf "http://127.0.0.1:${port}/")"
echo "$html" | grep -q 'data-nav="waiting"' || fail "missing Waiting nav"
echo "$html" | grep -q 'data-nav="experiments"' || fail "missing Experiments nav"
echo "$html" | grep -q 'data-nav="history"' || fail "missing History nav"
echo "$html" | grep -q 'data-nav="settings"' || fail "missing Settings nav"
if echo "$html" | grep -qi "ink-desk\|steer-ui-v2\|Active thesis\|HARD LAW"; then
  fail "home chrome must not ship costume / HARD LAW chip strip"
fi
curl -sf "http://127.0.0.1:${port}/experiments" | grep -q "rd-os" || fail "SPA experiments route"
curl -sf "http://127.0.0.1:${port}/settings" | grep -q "rd-os" || fail "SPA settings route"

state="$(curl -sf "http://127.0.0.1:${port}/api/state")"
echo "$state" | grep -q '"p0"' || fail "state missing p0"
echo "$state" | grep -q '"hard_law"' || fail "dump missing hard_law"
echo "$state" | grep -q '"clock_started": false' || fail "lab started 14d clock"

incomplete="$(curl -s -o "$home_default/incomplete.json" -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -d '{"tool":"experiment.open","payload":{"experiment_id":"ui-incomplete","title":"no fields"},"actor":"agent"}' \
  "http://127.0.0.1:${port}/api/tool")"
test "$incomplete" != "200" || fail "incomplete open must not 200"
grep -q 'MISSING_MACHINE_TIME' "$home_default/incomplete.json" || fail "open missing MISSING_MACHINE_TIME"

stop_lab "$home_default"

home_empty="$(mktemp -d "${TMPDIR:-/tmp}/rdos-ui-empty.XXXXXX")"
start_lab "$home_empty" --no-seed
port="$(cat "$home_empty/lab.port")"
empty_state="$(curl -sf "http://127.0.0.1:${port}/api/state")"
echo "$empty_state" | grep -q '"experiments": \[]' || fail "empty board should have no experiments"
stop_lab "$home_empty"

home_need="$(mktemp -d "${TMPDIR:-/tmp}/rdos-ui-need.XXXXXX")"
start_lab "$home_need" --no-seed --fixture needs-you
port="$(cat "$home_need/lab.port")"
need="$(curl -sf "http://127.0.0.1:${port}/api/state")"
echo "$need" | grep -q '"waiting_on": "human"' || fail "needs-you fixture must be waiting_on=human"
echo "$need" | grep -q 'exp-wait-merge' || fail "needs-you missing experiment"
curl -sf -H 'Content-Type: application/json' \
  -d '{"action":"approve","experiment_id":"exp-wait-merge"}' \
  "http://127.0.0.1:${port}/api/human" | grep -q '"ok": true' \
  || fail "human approve must resolve gate"
stop_lab "$home_need"

echo "PASS ui-smoke (Waiting nav + dump SoT + empty/needs-you fixtures + API rejects)"
