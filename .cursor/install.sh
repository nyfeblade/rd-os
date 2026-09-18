#!/usr/bin/env bash
#
# Cloud Agent install for rd-os / AI Coding Studio.
# Idempotent: safe to run repeatedly and against cached/partial state.
#
# Prepares the whole dev experience:
#   - system packages for native node modules (better-sqlite3)
#   - node deps for the root lab, the Electron shell, and the Mac packager
#   - zero-dependency studio/* modules need no install
#
set -euo pipefail

cd "$(dirname "$0")/.."
echo "install.sh: repo root = $(pwd)"

# --- system packages (only apt when something is actually missing) -------------
NEED_PKGS=(build-essential python3)
missing=()
for p in "${NEED_PKGS[@]}"; do
  dpkg -s "$p" >/dev/null 2>&1 || missing+=("$p")
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "install.sh: installing system packages: ${missing[*]}"
  sudo apt-get update -qq
  sudo apt-get install -y -qq "${missing[@]}"
else
  echo "install.sh: system packages already present"
fi

# --- node dependencies ---------------------------------------------------------
echo "install.sh: root deps (rd-os lab)"
npm install --no-audit --no-fund

echo "install.sh: studio/shell deps (electron + prove suite)"
( cd studio/shell && npm install --no-audit --no-fund )

echo "install.sh: studio/packaging deps (electron-builder recipe)"
( cd studio/packaging && npm install --no-audit --no-fund )

# studio/{auth,chat-engine,chrome-craft,github,hitl,marketplace,mcp,modes,seats,sfx-engine}
# are zero-dependency — nothing to install.

echo "install.sh: done"
echo "  node = $(node -v)"
echo "  npm  = $(npm -v)"
