#!/usr/bin/env bash
#
# Cloud Agent install for rd-os / AI Coding Studio.
# Idempotent: safe to run repeatedly and against cached/partial state.
#
# Prepares:
#   - system packages for native node modules (better-sqlite3) and for building
#     a macOS .dmg on Linux (genisoimage + libdmg-hfsplus + librsvg)
#   - the `dmg` tool (libdmg-hfsplus) on PATH
#   - node dependencies for the root lab and the Electron shell
#
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
echo "install.sh: repo root = $ROOT"

# --- 1. System packages (only apt when something is actually missing) ----------
NEED_PKGS=(build-essential python3 cmake zlib1g-dev libbz2-dev genisoimage librsvg2-bin p7zip-full)
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

# --- 2. libdmg-hfsplus `dmg` (Linux -> macOS UDIF .dmg writer) ------------------
if ! command -v dmg >/dev/null 2>&1; then
  echo "install.sh: building libdmg-hfsplus"
  tmp="$(mktemp -d)"
  git clone --depth 1 https://github.com/fanquake/libdmg-hfsplus.git "$tmp"
  ( cd "$tmp" && CC=gcc CXX=g++ cmake . -DCMAKE_BUILD_TYPE=Release && make -j"$(nproc)" )
  sudo install -m755 "$tmp/dmg/dmg" /usr/local/bin/dmg
  rm -rf "$tmp"
else
  echo "install.sh: dmg tool already on PATH ($(command -v dmg))"
fi

# --- 3. Node dependencies ------------------------------------------------------
echo "install.sh: installing root deps (rd-os lab)"
npm install --no-audit --no-fund

echo "install.sh: installing studio/shell deps (electron + electron-builder)"
( cd studio/shell && npm install --no-audit --no-fund )

# studio/{chat-engine,chrome-craft,github,seats,sfx-engine} are zero-dependency.

echo "install.sh: done"
echo "  node = $(node -v)"
echo "  npm  = $(npm -v)"
echo "  dmg  = $(command -v dmg || echo MISSING)"
