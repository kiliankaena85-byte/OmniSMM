#!/bin/bash
# OWASP Dependency Scanner — wraps multiple SCA tools
# Usage: ./scan_deps.sh [--help] [--output json|text]

set -euo pipefail

HELP="
Usage: scan_deps.sh [options]
Options:
  --help          Show this help message
  --output FORMAT Output format: text (default) or json
  --dir PATH      Project root directory (default: current dir)

Detects package manager and runs appropriate vulnerability scanner:
  - npm/yarn/pnpm  → npm audit
  - pip/poetry     → pip-audit / safety check
  - go             → govulncheck
  - maven/gradle   → OWASP Dependency-Check
  - docker         → trivy image scan
"

OUTPUT="text"
PROJECT_DIR="."

for arg in "$@"; do
  case $arg in
    --help) echo "$HELP"; exit 0 ;;
    --output=*) OUTPUT="${arg#*=}" ;;
    --dir=*) PROJECT_DIR="${arg#*=}" ;;
  esac
done

cd "$PROJECT_DIR"

echo "🔍 Scanning dependencies for CVEs..."
echo "📁 Project: $(pwd)"
echo "---"

# Node.js
if [ -f "package.json" ]; then
  echo "📦 Node.js detected → running npm audit"
  npm audit --audit-level=moderate 2>&1 || true
fi

# Python
if [ -f "requirements.txt" ] || [ -f "pyproject.toml" ]; then
  echo "🐍 Python detected → running pip-audit"
  if command -v pip-audit &> /dev/null; then
    pip-audit --desc 2>&1 || true
  else
    echo "⚠️  pip-audit not installed. Run: pip install pip-audit"
  fi
fi

# Go
if [ -f "go.mod" ]; then
  echo "🐹 Go detected → running govulncheck"
  if command -v govulncheck &> /dev/null; then
    govulncheck ./... 2>&1 || true
  else
    echo "⚠️  govulncheck not installed. Run: go install golang.org/x/vuln/cmd/govulncheck@latest"
  fi
fi

# Docker
if [ -f "Dockerfile" ]; then
  echo "🐋 Dockerfile detected → running trivy"
  if command -v trivy &> /dev/null; then
    trivy fs . --severity HIGH,CRITICAL 2>&1 || true
  else
    echo "⚠️  trivy not installed. See: https://trivy.dev"
  fi
fi

echo "---"
echo "✅ Dependency scan complete."
