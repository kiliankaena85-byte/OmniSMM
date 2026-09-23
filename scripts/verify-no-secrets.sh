#!/bin/bash
set -e

echo "🔍 Scanning build artifacts for leaked secrets..."

# 1. Check for QA secret pattern
if grep -r "smmplan_qa_sec" .next/static/ 2>/dev/null; then
  echo "❌ CRITICAL: Leaked smmplan_qa_sec found in .next/static/!"
  exit 1
fi

# 2. Check for default encryption key
if grep -r "smmplan_default_32_bytes" .next/static/ 2>/dev/null; then
  echo "❌ CRITICAL: Leaked default encryption key found in .next/static/!"
  exit 1
fi

# 3. Check for leaked DB password
if grep -r "StrongProdDbPassword2026" .next/static/ 2>/dev/null; then
  echo "❌ CRITICAL: Leaked DB password found in .next/static/!"
  exit 1
fi

echo "✅ No leaked secrets found in .next/static/ build artifacts!"
