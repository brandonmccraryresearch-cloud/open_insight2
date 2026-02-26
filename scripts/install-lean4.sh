#!/usr/bin/env bash
# Install elan (Lean 4 version manager) and the toolchain specified in lean-toolchain.
# This script is idempotent — safe to re-run.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ── 1. Install elan if not already present ────────────────────────────────────
if command -v elan &>/dev/null; then
  echo "✓ elan already installed: $(elan --version)"
else
  echo "Installing elan (Lean 4 version manager)…"
  curl -sSf https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh | sh -s -- -y --default-toolchain none
  export PATH="$HOME/.elan/bin:$PATH"
  echo "✓ elan installed: $(elan --version)"
fi

# Ensure elan bin is on PATH for the rest of the script
export PATH="$HOME/.elan/bin:$PATH"

# ── 2. Install the toolchain from lean-toolchain ──────────────────────────────
TOOLCHAIN_FILE="$PROJECT_ROOT/lean-toolchain"
if [ ! -f "$TOOLCHAIN_FILE" ]; then
  echo "Error: lean-toolchain file not found at $TOOLCHAIN_FILE"
  exit 1
fi

TOOLCHAIN=$(head -1 "$TOOLCHAIN_FILE" | tr -d '[:space:]')
echo "Installing toolchain: $TOOLCHAIN"
elan toolchain install "$TOOLCHAIN"
elan default "$TOOLCHAIN"

echo "✓ Lean 4 ready: $(lean --version)"
echo "  Binary: $(which lean)"
