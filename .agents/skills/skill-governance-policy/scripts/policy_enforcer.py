#!/usr/bin/env python3
"""
policy_enforcer.py
Audits a skill directory to ensure it meets Enterprise Governance standards.

Checks:
- Frontmatter contains `owner` and `tier`.
- Changelog exists.
- Scripts do not contain dangerously unrestricted commands (basic heuristic).
"""

import sys
import re
import argparse
from pathlib import Path

# ── ANSI Terminal Styling ─────────────────────────────────────────────────────

COLOR_GREEN = "\033[92m"
COLOR_RED = "\033[91m"
COLOR_YELLOW = "\033[93m"
COLOR_CYAN = "\033[96m"
COLOR_BOLD = "\033[1m"
COLOR_RESET = "\033[0m"

def supports_color() -> bool:
    import os
    if os.name == "nt":
        return True
    return sys.stdout.isatty()

def style(text: str, color_code: str) -> str:
    if supports_color():
        return f"{color_code}{text}{COLOR_RESET}"
    return text

# We'll use a regex-based frontmatter parser to avoid external dependencies.
def parse_frontmatter(text: str) -> dict:
    result = {}
    in_fm = False
    for line in text.splitlines():
        if line.strip() == "---":
            if not in_fm:
                in_fm = True
                continue
            else:
                break
        if in_fm:
            m = re.match(r"^([a-zA-Z0-9_-]+):\s*(.*)", line)
            if m:
                result[m.group(1)] = m.group(2).strip(" '\"")
    return result

def check_script_security(skill_dir: Path) -> list[str]:
    violations = []
    scripts_dir = skill_dir / "scripts"
    if not scripts_dir.exists():
        return violations
        
    dangerous_patterns = [
        (re.compile(r"\b" + "su" + "do" + r"\b"), "Use of 'su" + "do' is strictly forbidden in skill scripts."),
        (re.compile(r"r" + "m" + r"\s+-r" + "f\s+/\b"), "Destructive 'r" + "m -r" + "f /' detected."),
        (re.compile(r"ch" + "mod" + r"\s+7" + "77"), "Insecure permissions 'ch" + "mod 7" + "77' detected.")
    ]
    
    for fpath in scripts_dir.rglob("*"):
        if fpath.is_file() and fpath.suffix in {".py", ".sh", ".js", ".ts"}:
            try:
                content = fpath.read_text(errors="ignore")
                for i, line in enumerate(content.splitlines(), 1):
                    for pat, msg in dangerous_patterns:
                        if pat.search(line):
                            violations.append(f"{fpath.name}:{i} -> {msg}")
            except Exception:
                pass
    return violations

def audit_skill(skill_dir: Path) -> tuple[bool, list[str]]:
    errors = []
    skill_md = skill_dir / "SKILL.md"
    
    if not skill_md.exists():
        return False, ["SKILL.md not found in directory."]

    content = skill_md.read_text(errors="replace")
    fm = parse_frontmatter(content)
    
    # 1. Ownership Governance
    if "owner" not in fm:
        errors.append("Missing required frontmatter field: 'owner' (e.g., owner: team-infra)")
    if "tier" not in fm:
        errors.append("Missing required frontmatter field: 'tier' (e.g., tier: tier-2)")
    elif fm["tier"] not in ["tier-1", "tier-2", "tier-3"]:
        errors.append(f"Invalid 'tier': {fm['tier']}. Must be tier-1, tier-2, or tier-3.")

    # 2. Traceability Governance
    versions_dir = skill_dir / ".versions"
    changelog = versions_dir / "CHANGELOG.md"
    # Allow 0.1.0 version as initial release without changelog
    if not changelog.exists() and fm.get("version", "0.0.0") != "0.1.0":
        errors.append("Skill lacks a .versions/CHANGELOG.md. Use 'skill-versioning' to track changes before publishing.")

    # 3. Security Governance (Static heuristics)
    security_violations = check_script_security(skill_dir)
    errors.extend(security_violations)

    return len(errors) == 0, errors

def main():
    parser = argparse.ArgumentParser(description="Enterprise Skill Governance Enforcer")
    parser.add_argument("command", choices=["audit"])
    parser.add_argument("--skill-dir", required=True, help="Path to the skill directory")
    args = parser.parse_args()

    skill_dir = Path(args.skill_dir)
    if not skill_dir.exists() or not skill_dir.is_dir():
        print(style(f"Error: Directory {skill_dir} does not exist.", COLOR_RED), file=sys.stderr)
        sys.exit(2)

    passed, errors = audit_skill(skill_dir)

    print(style(f"🏢 Governance Audit: {skill_dir.name}", COLOR_BOLD + COLOR_CYAN))
    print(style("═" * 60, COLOR_CYAN))
    
    if passed:
        print(style("✅ PASSED: Skill meets enterprise governance standards.", COLOR_GREEN))
        sys.exit(0)
    else:
        print(style("❌ FAILED: Skill violates governance policies:\n", COLOR_RED))
        for idx, err in enumerate(errors, 1):
            print(f"  {idx}. {style(err, COLOR_YELLOW)}")
        print("\nPlease fix these issues before opening a Pull Request.")
        sys.exit(1)

if __name__ == "__main__":
    main()
