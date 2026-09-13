#!/usr/bin/env bash
# scripts/install.sh
# OmniSMM Skills Suite — Linux/macOS Installer
set -e

TARGET_DIR="${1:-$(pwd)}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================================="
echo "  OmniSMM Architectural Skills Suite Installer (v1.0.0)"
echo "=========================================================="
echo "Target directory: $TARGET_DIR"

mkdir -p "$TARGET_DIR/.agents"
cp -R "$PACKAGE_ROOT/.agents/"* "$TARGET_DIR/.agents/"
cp "$PACKAGE_ROOT/AGENTS.md" "$TARGET_DIR/AGENTS.md"

# Copy IDE templates if requested or detected
if [ -f "$PACKAGE_ROOT/templates/.cursorrules" ]; then
    cp "$PACKAGE_ROOT/templates/.cursorrules" "$TARGET_DIR/.cursorrules"
    echo "  + Configured .cursorrules"
fi
if [ -f "$PACKAGE_ROOT/templates/CLAUDE.md" ]; then
    cp "$PACKAGE_ROOT/templates/CLAUDE.md" "$TARGET_DIR/CLAUDE.md"
    echo "  + Configured CLAUDE.md"
fi

echo "=========================================================="
echo "  Installation completed successfully!"
echo "=========================================================="
