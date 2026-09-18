#!/usr/bin/env bash
# Eng Proof consumer: run dual-gate on the installed rd-os lab (main), not this tree.
# Does not set verdict. Does not start the 14-day clock.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

fail() {
  echo "FAIL eng-proof: $*" >&2
  exit 1
}

resolve_lab() {
  if [[ -n "${RDOS_LAB:-}" ]]; then
    printf '%s\n' "$RDOS_LAB"
    return
  fi
  node -e 'const path = require("path"); process.stdout.write(path.dirname(require.resolve("rd-os/package.json")));' \
    || fail "rd-os is not installed. From consumers/eng-proof run: npm install"
}

lab="$(resolve_lab)"
test -f "$lab/package.json" || fail "lab package.json missing at $lab"
test -f "$lab/scripts/dual-gate.sh" || fail "installed lab missing scripts/dual-gate.sh"
test -f "$lab/bin/mcp.js" || fail "installed lab missing bin/mcp.js"

node -e '
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (pkg.name !== "rd-os") process.exit(1);
' "$lab/package.json" || fail "resolved package is not rd-os"

lab_abs="$(cd "$lab" && pwd)"
if [[ "$lab_abs" == "$root" ]]; then
  fail "refusing to dual-gate the consumer tree; install rd-os from main"
fi

echo "eng-proof: dual-gate against installed lab ${lab_abs}"
(
  cd "$lab_abs"
  chmod +x scripts/*.sh bin/mcp.js
  npm run dual-gate
)
