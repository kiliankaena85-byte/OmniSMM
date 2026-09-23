#!/usr/bin/env python3
"""
secret-leak-guard scanner
Detects hardcoded secrets in files or stdin content.
Exit code 0 = clean | Exit code 1 = secrets found
"""

import re
import sys
import argparse
import json
from pathlib import Path

# ── Pattern registry ──────────────────────────────────────────────────────────
# Each entry: (label, regex_pattern, mask_group_index)
PATTERNS = [
    ("Google API Key",          r"AIza[0-9A-Za-z\-_]{35}",                       0),
    ("GCP Service Account Key", r'"private_key":\s*"-----BEGIN',                  0),
    ("AWS Access Key ID",       r"(?<![A-Z0-9])[A-Z0-9]{20}(?![A-Z0-9])",        0),
    ("AWS Secret Access Key",   r"(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])", 0),
    ("Generic Bearer Token",    r"(?i)bearer\s+[a-zA-Z0-9\-._~+/]{20,}",         0),
    ("Generic Secret= pattern", r"(?i)(secret|password|passwd|pwd|token|apikey|api_key|auth_key)\s*[:=]\s*['\"]?([A-Za-z0-9\-_./+@!#]{8,})['\"]?", 2),
    ("Private Key Block",       r"-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----", 0),
    ("Slack Token",             r"xox[baprs]-[0-9A-Za-z]{10,48}",                 0),
    ("GitHub Token",            r"(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}",        0),
    ("Stripe Secret Key",       r"sk_live_[A-Za-z0-9]{24}",                       0),
    ("SendGrid API Key",        r"SG\.[A-Za-z0-9\-._]{22}\.[A-Za-z0-9\-._]{43}", 0),
    ("Twilio API Key",          r"SK[a-z0-9]{32}",                                0),
    ("Firebase URL",            r"https://[a-z0-9-]+\.firebaseio\.com",            0),
    ("Hardcoded .env value",    r"(?i)^(API_KEY|SECRET|TOKEN|PASSWORD)\s*=\s*.{8,}$", 0),
    ("IP + Credentials",        r"(?i)(mysql|postgres|mongodb|redis):\/\/[^:]+:[^@]{4,}@", 0),
]

# Values that are obvious placeholders — skip them
PLACEHOLDER_PATTERNS = [
    r"(?i)your[_-]?(api[_-]?key|token|secret|password)",
    r"(?i)<(api[_-]?key|token|secret|password|your[_-]key)>",
    r"(?i)example|placeholder|changeme|replace.?me|dummy|fake|test",
    r"(?i)xxxx+",
    r"(?i)1234567890abcdef",
]

def mask(value: str) -> str:
    """Return a masked version of a secret value for safe display."""
    if len(value) <= 8:
        return "****"
    return value[:4] + "*" * (len(value) - 8) + value[-4:]

def is_placeholder(value: str) -> bool:
    return any(re.search(p, value) for p in PLACEHOLDER_PATTERNS)

def scan_lines(lines: list[str]) -> list[dict]:
    findings = []
    for line_num, line in enumerate(lines, start=1):
        for label, pattern, group_idx in PATTERNS:
            for match in re.finditer(pattern, line, re.MULTILINE):
                try:
                    value = match.group(group_idx) if group_idx else match.group(0)
                except IndexError:
                    value = match.group(0)
                if is_placeholder(value):
                    continue
                findings.append({
                    "line":    line_num,
                    "type":    label,
                    "masked":  mask(value),
                    "snippet": line.strip()[:80],
                })
    return findings

def main():
    parser = argparse.ArgumentParser(description="Secret Leak Guard Scanner")
    parser.add_argument("--target", help="Path to file or directory to scan")
    parser.add_argument("--stdin",  action="store_true", help="Read content from stdin")
    parser.add_argument("--json",   action="store_true", help="Output results as JSON")
    args = parser.parse_args()

    all_findings: list[dict] = []

    # ── Input mode ────────────────────────────────────────────────────────────
    if args.stdin:
        content = sys.stdin.read()
        findings = scan_lines(content.splitlines())
        for f in findings:
            f["file"] = "<stdin>"
        all_findings.extend(findings)

    elif args.target:
        target = Path(args.target)
        files = list(target.rglob("*")) if target.is_dir() else [target]
        for file_path in files:
            if not file_path.is_file():
                continue
            try:
                lines = file_path.read_text(errors="replace").splitlines()
            except (PermissionError, OSError) as e:
                print(f"[WARN] Cannot read {file_path}: {e}", file=sys.stderr)
                continue
            findings = scan_lines(lines)
            for f in findings:
                f["file"] = str(file_path)
            all_findings.extend(findings)
    else:
        print("Error: provide --target <path> or use --stdin", file=sys.stderr)
        sys.exit(2)

    # ── Output ────────────────────────────────────────────────────────────────
    if args.json:
        print(json.dumps(all_findings, indent=2))
    else:
        if not all_findings:
            print("secret-leak-guard ✅  No secrets detected.")
        else:
            print(f"secret-leak-guard 🚨  {len(all_findings)} potential secret(s) found:\n")
            for f in all_findings:
                print(f"  [{f['type']}]")
                print(f"    File   : {f['file']}")
                print(f"    Line   : {f['line']}")
                print(f"    Value  : {f['masked']}")
                print(f"    Snippet: {f['snippet']}")
                print()

    sys.exit(1 if all_findings else 0)

if __name__ == "__main__":
    main()
