#!/usr/bin/env bash
#
# Run the whole rd-os / AI Coding Studio test suite in one command.
# Mirrors what CI runs. Zero-dependency modules + root + consumers always run;
# studio/shell and studio/packaging run only when their node_modules exist
# (they need `npm ci` first — see .cursor/install.sh), otherwise they are
# reported as SKIP so a fresh clone still gets a useful signal.
#
set -uo pipefail

cd "$(dirname "$0")/.."

fail=0
declare -a failed=()

run() {
  local name="$1"
  local cmd="$2"
  echo "== ${name} =="
  if bash -c "${cmd}"; then
    echo "PASS ${name}"
  else
    echo "FAIL ${name}"
    fail=1
    failed+=("${name}")
  fi
  echo
}

run "root mcp-smoke" "npm run --silent mcp-smoke"

for d in auth chat-engine chrome-craft github hitl marketplace mcp modes seats sfx-engine; do
  run "studio/${d}" "npm --prefix studio/${d} test"
done

run "consumers/cursor-mcp" "npm --prefix consumers/cursor-mcp test"
run "consumers/llm-complete" "npm --prefix consumers/llm-complete test"

for d in shell packaging; do
  if [ -d "studio/${d}/node_modules" ]; then
    run "studio/${d}" "npm --prefix studio/${d} test"
  else
    echo "== studio/${d} =="
    echo "SKIP studio/${d} (run: cd studio/${d} && npm ci)"
    echo
  fi
done

echo "================================"
if [ "${fail}" -eq 0 ]; then
  echo "ALL GREEN"
else
  echo "FAILURES: ${failed[*]}"
fi
exit "${fail}"
