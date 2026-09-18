#!/usr/bin/env bash
# Wedge vs markdown-baseline on packet completeness and time-to-falsify setup.
# If this does not beat markdown, stop expand and report INCONCLUSIVE.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

exec node bin/wedge-measure.js "$@"
