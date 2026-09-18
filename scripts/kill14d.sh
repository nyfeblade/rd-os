#!/usr/bin/env bash
# 14-day kill harness stub. Eng Proof runs this. Does not start the clock.
# Does not set verdict. Frozen command shape from KILL_14D.md.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

exec node bin/kill14d.js "$@"
