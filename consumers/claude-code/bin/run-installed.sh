#!/usr/bin/env bash
# Claude Code consumer: run a measured lab command on the installed rd-os (main),
# not this tree. Does not set verdict. Does not start the 14-day clock.
# Does not implement llm.complete.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

cmd="${1:-}"
case "$cmd" in
  mcp-smoke|dual-gate) ;;
  *)
    echo "FAIL claude-code: usage: $0 mcp-smoke|dual-gate" >&2
    exit 1
    ;;
esac

fail() {
  echo "FAIL claude-code: $*" >&2
  exit 1
}

resolve_lab() {
  if [[ -n "${RDOS_LAB:-}" ]]; then
    printf '%s\n' "$RDOS_LAB"
    return
  fi
  node -e 'const path = require("path"); process.stdout.write(path.dirname(require.resolve("rd-os/package.json")));' \
    || fail "rd-os is not installed. From consumers/claude-code run: npm install"
}

lab="$(resolve_lab)"
test -f "$lab/package.json" || fail "lab package.json missing at $lab"
test -f "$lab/bin/mcp.js" || fail "installed lab missing bin/mcp.js"

node -e '
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (pkg.name !== "rd-os") process.exit(1);
' "$lab/package.json" || fail "resolved package is not rd-os"

lab_abs="$(cd "$lab" && pwd)"
if [[ "$lab_abs" == "$root" ]]; then
  fail "refusing to measure the consumer tree; install rd-os from main"
fi

if [[ "$cmd" == "mcp-smoke" ]]; then
  test -f "$lab_abs/bin/mcp-smoke.js" || fail "installed lab missing bin/mcp-smoke.js"
else
  test -f "$lab_abs/scripts/dual-gate.sh" || fail "installed lab missing scripts/dual-gate.sh"
fi

echo "claude-code: ${cmd} against installed lab ${lab_abs}"
(
  cd "$lab_abs"
  chmod +x scripts/*.sh bin/mcp.js bin/mcp-smoke.js 2>/dev/null || true
  npm run "$cmd"
)
