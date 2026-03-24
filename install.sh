#!/usr/bin/env bash
set -e

INSTALL_DIR="$HOME/.coop/cli"

if ! command -v bun &>/dev/null; then
  echo "Installing bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

echo "Installing coop..."

rm -rf "$INSTALL_DIR"
git clone --depth 1 https://github.com/cooperbench/claude-coop "$INSTALL_DIR" --quiet
cd "$INSTALL_DIR"
bun install --frozen-lockfile --quiet
bun link --quiet

echo "Done. Run 'coop login' to get started."
