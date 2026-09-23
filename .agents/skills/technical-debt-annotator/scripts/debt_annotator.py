#!/usr/bin/env python3
"""
debt_annotator.py

Technical debt detector, annotator, and tracker.

Commands:
  init     — initialize debt registry
  scan     — scan files for debt patterns (read-only)
  annotate — insert DEBT comments and register entries
  add      — manually register one debt item
  report   — generate prioritized debt report
  resolve  — mark a debt item as resolved
  check    — exit non-zero if debt above threshold exists

Exit codes:
  0 — no findings / resolved successfully
  1 — LOW or MEDIUM debt found
  2 — HIGH or CRITICAL debt found
  3 — error
"""

from __future__ import annotations

import os
import re
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime, timezone
from dataclasses import dataclass, field, asdict
from collections import Counter
from typing import Any

# Reconfigure stdout/stderr to use UTF-8 under Windows to prevent UnicodeEncodeError
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────

SCHEMA_VERSION = "1.0"
REGISTRY_REL   = ".agent/debt/debt_registry.jsonl"

SEVERITY_ORDER = {
    "CRITICAL": 4,
    "HIGH":     3,
    "MEDIUM":   2,
    "LOW":      1,
}

SEVERITY_ICONS = {
    "CRITICAL": "⛔",
    "HIGH":     "🔴",
    "MEDIUM":   "🟠",
    "LOW":      "🟡",
}

EFFORT_ORDER = {"XS": 1, "S": 2, "M": 3, "L": 4, "XL": 5}

VALID_CATEGORIES = {
    "HARDCODED", "NO_ERROR_HANDLING", "DEAD_CODE", "DUPLICATION",
    "NO_DOCS", "MAGIC_NUMBER",
    "NO_TEST", "SKIPPED_TEST", "COMMENTED_TEST", "NO_ASSERTION",
    "WORKAROUND", "DEPRECATED_API", "CIRCULAR", "COUPLING", "ABSTRACTION",
    "NO_LOGGING", "DEBUG", "NO_TIMEOUT", "NO_RETRY",
}

VALID_SEVERITIES = {"CRITICAL", "HIGH", "MEDIUM", "LOW"}
VALID_EFFORTS    = {"XS", "S", "M", "L", "XL"}

SKIP_DIRS = {
    ".git", "node_modules", "__pycache__", ".venv", "venv",
    "dist", "build", ".next", ".nuxt", "coverage", ".agent",
}

TEXT_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx",
    ".go", ".rs", ".java", ".kt", ".rb",
    ".swift", ".cs", ".cpp", ".c", ".h",
}

ANNOTATION_RE = re.compile(
    r"DEBT\[([A-Z]+)\|([A-Z_]+)\|([A-Z]+)\]:\s*(.+)"
)


# ─────────────────────────────────────────────────────────────────────────────
# Debt patterns
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class DebtPattern:
    category:  str
    severity:  str
    effort:    str
    title:     str
    regex:     str
    fix:       str
    languages: set[str] = field(default_factory=lambda: {
        "py", "ts", "js", "go", "java", "kt", "rb"
    })


PATTERNS: list[DebtPattern] = [

    # ── HARDCODED ─────────────────────────────────────────────────────────────
    DebtPattern(
        category="HARDCODED",
        severity="CRITICAL",
        effort="S",
        title="hardcoded password or secret",
        regex=r"(?i)(password|passwd|secret|api_key|apikey|token|auth_key)\s*=\s*['\"][^'\"]{4,}['\"]",
        fix="Move to environment variable or secrets manager.",
        languages={"py", "ts", "js", "go", "java", "kt", "rb"},
    ),
    DebtPattern(
        category="HARDCODED",
        severity="HIGH",
        effort="S",
        title="hardcoded URL or IP address",
        regex=r"['\"]https?://[a-zA-Z0-9._/-]{8,}['\"]|['\"](?:[0-9]{1,3}\.){3}[0-9]{1,3}['\"]",
        fix="Move to configuration or environment variable.",
        languages={"py", "ts", "js", "go", "java", "kt"},
    ),
    DebtPattern(
        category="HARDCODED",
        severity="HIGH",
        effort="S",
        title="hardcoded port number",
        regex=r"(port|PORT)\s*=\s*[0-9]{4,5}(?!\s*\+)",
        fix="Move to configuration or environment variable.",
        languages={"py", "ts", "js", "go"},
    ),
    DebtPattern(
        category="MAGIC_NUMBER",
        severity="MEDIUM",
        effort="XS",
        title="unexplained magic number",
        regex=r"(?i)(?<!['\"])\b(86400|3600|1000|9999|99999|[0-9]{4,})\b(?!['\"])",
        fix="Extract to named constant with explanatory name.",
        languages={"py", "ts", "js", "go", "java"},
    ),

    # ── NO_ERROR_HANDLING ─────────────────────────────────────────────────────
    DebtPattern(
        category="NO_ERROR_HANDLING",
        severity="HIGH",
        effort="S",
        title="bare except swallowing all errors",
        regex=r"except\s*(\(Exception\)|Exception)?\s*:\s*\n?\s*pass",
        fix="Log the exception and handle specifically or re-raise.",
        languages={"py"},
    ),
    DebtPattern(
        category="NO_ERROR_HANDLING",
        severity="HIGH",
        effort="S",
        title="catch(e) {} swallowing error in JS/TS",
        regex=r"catch\s*\(\s*\w+\s*\)\s*\{\s*\}",
        fix="Log the error or handle it. Empty catch is a silent failure.",
        languages={"ts", "js"},
    ),
    DebtPattern(
        category="NO_ERROR_HANDLING",
        severity="MEDIUM",
        effort="XS",
        title="TODO/FIXME in error handler",
        regex=r"(except|catch)\s*.{0,30}(TODO|FIXME|hack|temp)",
        fix="Resolve the TODO before the code goes to production.",
        languages={"py", "ts", "js", "go"},
    ),

    # ── WORKAROUND ────────────────────────────────────────────────────────────
    DebtPattern(
        category="WORKAROUND",
        severity="HIGH",
        effort="M",
        title="explicit hack or workaround comment",
        regex=r"(?i)#\s*(hack|workaround|kludge|fixme|bandaid|band-aid|quick.fix)",
        fix="Replace workaround with proper implementation or file a ticket.",
        languages={"py", "rb", "go"},
    ),
    DebtPattern(
        category="WORKAROUND",
        severity="HIGH",
        effort="M",
        title="explicit hack or workaround comment (JS/TS)",
        regex=r"(?i)//\s*(hack|workaround|kludge|fixme|bandaid|band-aid|quick.fix)",
        fix="Replace workaround with proper implementation or file a ticket.",
        languages={"ts", "js"},
    ),
    DebtPattern(
        category="WORKAROUND",
        severity="MEDIUM",
        effort="M",
        title="temporary solution comment",
        regex=r"(?i)(#|//)\s*(temporary|temp\s|this is temp|tmp\s|short[- ]term)",
        fix="Document the long-term fix and file a tracking ticket.",
        languages={"py", "ts", "js", "go", "java"},
    ),

    # ── DEBUG ─────────────────────────────────────────────────────────────────
    DebtPattern(
        category="DEBUG",
        severity="MEDIUM",
        effort="XS",
        title="print() debug artifact in production code",
        regex=r"^\s*print\s*\(",
        fix="Remove print() or replace with proper logging.",
        languages={"py"},
    ),
    DebtPattern(
        category="DEBUG",
        severity="MEDIUM",
        effort="XS",
        title="console.log debug artifact",
        regex=r"^\s*console\.(log|debug|warn|error)\s*\(",
        fix="Remove console call or replace with structured logger.",
        languages={"ts", "js"},
    ),
    DebtPattern(
        category="DEBUG",
        severity="HIGH",
        effort="XS",
        title="debugger statement left in code",
        regex=r"^\s*debugger\s*;?$",
        fix="Remove debugger statement before committing.",
        languages={"ts", "js"},
    ),
    DebtPattern(
        category="DEBUG",
        severity="MEDIUM",
        effort="XS",
        title="fmt.Println debug artifact in Go",
        regex=r"^\s*fmt\.Println\s*\(",
        fix="Remove fmt.Println or replace with structured logger.",
        languages={"go"},
    ),

    # ── NO_TIMEOUT ────────────────────────────────────────────────────────────
    DebtPattern(
        category="NO_TIMEOUT",
        severity="HIGH",
        effort="XS",
        title="HTTP call without timeout",
        regex=r"requests\.(get|post|put|patch|delete|head)\s*\([^)]*\)(?!.*timeout)",
        fix="Add timeout= parameter to all requests calls.",
        languages={"py"},
    ),
    DebtPattern(
        category="NO_TIMEOUT",
        severity="HIGH",
        effort="XS",
        title="fetch() without timeout/AbortController",
        regex=r"\bfetch\s*\([^)]*\)(?!.*AbortController|.*signal)",
        fix="Add AbortController with timeout to all fetch calls.",
        languages={"ts", "js"},
    ),

    # ── SKIPPED_TEST ──────────────────────────────────────────────────────────
    DebtPattern(
        category="SKIPPED_TEST",
        severity="HIGH",
        effort="M",
        title="pytest.mark.skip on test",
        regex=r"@pytest\.mark\.skip",
        fix="Implement the skipped test or remove if no longer relevant.",
        languages={"py"},
    ),
    DebtPattern(
        category="SKIPPED_TEST",
        severity="HIGH",
        effort="M",
        title="xit() or xtest() skipped test",
        regex=r"\bx(it|test|describe)\s*\(",
        fix="Implement the skipped test or remove if no longer relevant.",
        languages={"ts", "js"},
    ),
    DebtPattern(
        category="SKIPPED_TEST",
        severity="MEDIUM",
        effort="M",
        title="test.skip() in Jest/Vitest",
        regex=r"\b(test|it)\.skip\s*\(",
        fix="Implement the skipped test or remove if no longer relevant.",
        languages={"ts", "js"},
    ),

    # ── COMMENTED_TEST ────────────────────────────────────────────────────────
    DebtPattern(
        category="COMMENTED_TEST",
        severity="MEDIUM",
        effort="M",
        title="commented-out test code",
        regex=r"#\s*(def test_|assert |assertEqual)",
        fix="Uncomment and fix the test, or delete it.",
        languages={"py"},
    ),
    DebtPattern(
        category="COMMENTED_TEST",
        severity="MEDIUM",
        effort="M",
        title="commented-out test block in JS/TS",
        regex=r"//\s*(it\(|test\(|expect\(|assert)",
        fix="Uncomment and fix the test, or delete it.",
        languages={"ts", "js"},
    ),

    # ── NO_ASSERTION ──────────────────────────────────────────────────────────
    DebtPattern(
        category="NO_ASSERTION",
        severity="MEDIUM",
        effort="S",
        title="test function with no assertion",
        regex=r"def test_[a-zA-Z0-9_]+\s*\([^)]*\):\s*\n(?:\s+(?!assert|self\.assert|pytest\.raises|with pytest).+\n)*\s*$",
        fix="Add at least one assertion to verify behavior.",
        languages={"py"},
    ),

    # ── NO_LOGGING ────────────────────────────────────────────────────────────
    DebtPattern(
        category="NO_LOGGING",
        severity="MEDIUM",
        effort="XS",
        title="exception caught without logging",
        regex=r"except\s+[A-Za-z]+.*:\s*\n\s+(?!.*log|.*logger|.*logging|.*print)",
        fix="Add logger.error() or logger.exception() call in except block.",
        languages={"py"},
    ),

    # ── DEAD_CODE ─────────────────────────────────────────────────────────────
    DebtPattern(
        category="DEAD_CODE",
        severity="LOW",
        effort="XS",
        title="commented-out code block",
        regex=r"^\s*#\s+(import |from |def |class |return |if |for |while )",
        fix="Remove commented-out code or restore with explanation.",
        languages={"py"},
    ),
    DebtPattern(
        category="DEAD_CODE",
        severity="LOW",
        effort="XS",
        title="commented-out code block JS/TS",
        regex=r"^\s*//\s+(import |const |let |var |function |class |return |if |for )",
        fix="Remove commented-out code or restore with explanation.",
        languages={"ts", "js"},
    ),

    # ── NO_RETRY ─────────────────────────────────────────────────────────────
    DebtPattern(
        category="NO_RETRY",
        severity="MEDIUM",
        effort="S",
        title="network call without retry logic",
        regex=r"requests\.(get|post|put)\s*\([^)]*\)(?!.*retry|.*Retry)",
        fix="Add retry logic with exponential backoff (tenacity, httpx).",
        languages={"py"},
    ),

    # ── DEPRECATED_API ────────────────────────────────────────────────────────
    DebtPattern(
        category="DEPRECATED_API",
        severity="MEDIUM",
        effort="M",
        title="@deprecated decorator or comment on called function",
        regex=r"@deprecated|#\s*deprecated|//\s*@deprecated|\/\*\s*@deprecated",
        fix="Replace with the recommended alternative.",
        languages={"py", "ts", "js", "java", "kt"},
    ),
]


# ─────────────────────────────────────────────────────────────────────────────
# Data classes
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class DebtFinding:
    file:            str
    line:            int
    category:        str
    severity:        str
    effort:          str
    title:           str
    snippet:         str
    fix:             str
    agent_generated: bool = False
    ref:             str  = ""
    status:          str  = "open"
    id:              str  = ""


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def utc_now() -> str:
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def make_id(file: str, line: int, category: str) -> str:
    ts = datetime.now().strftime("%Y%m%d")
    slug = re.sub(r"[^a-zA-Z0-9]", "", Path(file).stem)[:8]
    return f"debt-{ts}-{slug}-{line}-{category[:4].lower()}"


def detect_lang(path: Path) -> str:
    ext = path.suffix.lower()
    mapping = {
        ".py": "py", ".ts": "ts", ".tsx": "ts",
        ".js": "js", ".jsx": "js", ".go": "go",
        ".java": "java", ".kt": "kt", ".rb": "rb",
        ".swift": "swift", ".cs": "cs",
        ".cpp": "cpp", ".c": "c", ".h": "c",
    }
    return mapping.get(ext, "unknown")


def comment_prefix(lang: str) -> str:
    if lang in {"py", "rb"}:
        return "#"
    if lang in {"ts", "js", "go", "java", "kt", "swift", "cs", "cpp", "c"}:
        return "//"
    return "#"


def registry_path(workspace: Path) -> Path:
    return workspace / REGISTRY_REL


def load_registry(workspace: Path) -> list[dict[str, Any]]:
    path = registry_path(workspace)
    if not path.exists():
        return []
    entries: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return entries


def append_registry(workspace: Path, entry: dict[str, Any]) -> None:
    path = registry_path(workspace)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False, sort_keys=True) + "\n")


def update_registry_status(workspace: Path, debt_id: str, status: str) -> bool:
    path = registry_path(workspace)
    if not path.exists():
        return False

    entries = load_registry(workspace)
    updated = False
    lines = []

    for e in entries:
        if e.get("id") == debt_id:
            e["status"] = status
            e["resolved_at"] = utc_now() if status == "resolved" else e.get("resolved_at")
            updated = True
        lines.append(json.dumps(e, ensure_ascii=False, sort_keys=True))

    if updated:
        path.write_text("\n".join(lines) + "\n")

    return updated


def already_annotated(line_text: str) -> bool:
    return "DEBT[" in line_text


def skip_path(path: Path) -> bool:
    return any(part in SKIP_DIRS for part in path.parts)


# ─────────────────────────────────────────────────────────────────────────────
# Scanner
# ─────────────────────────────────────────────────────────────────────────────

def scan_file(
    path:         Path,
    min_severity: str = "LOW",
) -> list[DebtFinding]:
    lang = detect_lang(path)
    if lang == "unknown":
        return []

    try:
        text = path.read_text(errors="replace")
    except OSError:
        return []

    lines = text.splitlines()
    min_order = SEVERITY_ORDER.get(min_severity, 1)
    findings: list[DebtFinding] = []
    seen_lines: set[int] = set()

    for pattern in PATTERNS:
        if lang not in pattern.languages:
            continue
        if SEVERITY_ORDER[pattern.severity] < min_order:
            continue

        try:
            rx = re.compile(pattern.regex, re.MULTILINE | re.IGNORECASE)
        except re.error:
            continue

        for idx, line in enumerate(lines, start=1):
            if idx in seen_lines:
                continue
            if already_annotated(line):
                continue
            if not rx.search(line):
                continue

            seen_lines.add(idx)
            findings.append(DebtFinding(
                file=str(path),
                line=idx,
                category=pattern.category,
                severity=pattern.severity,
                effort=pattern.effort,
                title=pattern.title,
                snippet=line.strip()[:120],
                fix=pattern.fix,
                id=make_id(str(path), idx, pattern.category),
            ))

    return findings


def scan_path(
    target:       Path,
    min_severity: str = "LOW",
) -> list[DebtFinding]:
    all_findings: list[DebtFinding] = []

    if target.is_file():
        return scan_file(target, min_severity)

    for root, dirs, files in os.walk(target):
        dirs[:] = [
            d for d in dirs
            if d not in SKIP_DIRS and not d.startswith(".")
        ]
        for fname in files:
            fpath = Path(root) / fname
            if skip_path(fpath):
                continue
            if fpath.suffix.lower() not in TEXT_EXTENSIONS:
                continue
            all_findings.extend(scan_file(fpath, min_severity))

    return all_findings


# ─────────────────────────────────────────────────────────────────────────────
# Annotation
# ─────────────────────────────────────────────────────────────────────────────

def annotate_file(
    path:     Path,
    findings: list[DebtFinding],
    dry_run:  bool,
) -> tuple[int, str]:
    """
    Insert DEBT comment above each finding line.
    Returns (count_inserted, modified_text_or_empty).
    """
    if not findings:
        return 0, ""

    lang    = detect_lang(path)
    prefix  = comment_prefix(lang)

    try:
        original = path.read_text(errors="replace")
    except OSError as e:
        return 0, f"ERROR: {e}"

    lines = original.splitlines(keepends=True)

    # Sort findings by line descending so insertions don't shift offsets.
    sorted_findings = sorted(findings, key=lambda f: f.line, reverse=True)

    inserted = 0
    for f in sorted_findings:
        idx = f.line - 1
        if idx < 0 or idx >= len(lines):
            continue

        debt_comment = (
            f"{prefix} DEBT[{f.severity}|{f.category}|{f.effort}]: {f.title}\n"
        )

        # Avoid double-annotation.
        if idx > 0 and "DEBT[" in lines[idx - 1]:
            continue

        if not dry_run:
            lines.insert(idx, debt_comment)
        inserted += 1

    if dry_run:
        return inserted, ""

    new_text = "".join(lines)
    path.write_text(new_text)
    return inserted, new_text


# ─────────────────────────────────────────────────────────────────────────────
# Report rendering
# ─────────────────────────────────────────────────────────────────────────────

def render_report(
    findings:      list[DebtFinding],
    source_label:  str,
    min_severity:  str,
) -> str:
    sorted_f = sorted(
        findings,
        key=lambda f: (
            -SEVERITY_ORDER.get(f.severity, 0),
            f.file,
            f.line,
        )
    )

    open_items = [f for f in sorted_f if f.status != "resolved"]
    by_sev   = Counter(f.severity for f in open_items)
    by_cat   = Counter(f.category for f in open_items)
    by_effort = Counter(f.effort for f in open_items)

    lines = [
        "",
        "🏗️ Technical Debt Report",
        "═" * 56,
        f"Source         : {source_label}",
        f"Min severity   : {min_severity}",
        f"Open debt items: {len(open_items)}",
        "═" * 56,
    ]

    if not open_items:
        lines += ["", "✅ No open debt items found.", "═" * 56, ""]
        return "\n".join(lines)

    current_sev = None

    for f in open_items:
        if f.severity != current_sev:
            current_sev = f.severity
            count       = by_sev.get(f.severity, 0)
            icon        = SEVERITY_ICONS.get(f.severity, "•")
            lines += [
                "",
                f"{icon} {f.severity} ({count}):",
            ]

        lines += [
            f"  {SEVERITY_ICONS.get(f.severity, '•')} "
            f"{f.category}  {Path(f.file).name}:{f.line}",
            f"     {f.snippet}",
            f"     Severity: {f.severity}  Effort: {f.effort}",
            f"     Fix: {f.fix}",
        ]
        if f.ref:
            lines.append(f"     Ref: {f.ref}")
        if f.id:
            lines.append(f"     ID: {f.id}")
        lines.append("")

    effort_str = "  ".join(
        f"{e}×{c}"
        for e, c in sorted(by_effort.items(), key=lambda x: EFFORT_ORDER.get(x[0], 9))
        if c > 0
    )

    lines += [
        "═" * 56,
        "By category:  " + "  ".join(
            f"{cat}={cnt}" for cat, cnt in by_cat.most_common(10)
        ),
        f"Total effort: {effort_str}",
        "═" * 56,
        "",
    ]

    return "\n".join(lines)


def exit_code(findings: list[DebtFinding], fail_on: str = "CRITICAL") -> int:
    threshold = SEVERITY_ORDER.get(fail_on, 4)
    open_f    = [f for f in findings if f.status != "resolved"]

    if not open_f:
        return 0

    max_sev = max(SEVERITY_ORDER.get(f.severity, 0) for f in open_f)

    if max_sev >= threshold:
        return 2
    if max_sev >= SEVERITY_ORDER.get("MEDIUM", 2):
        return 1

    return 0


# ─────────────────────────────────────────────────────────────────────────────
# Commands
# ─────────────────────────────────────────────────────────────────────────────

def cmd_init(args: argparse.Namespace) -> int:
    workspace = Path(args.workspace).resolve()
    path      = registry_path(workspace)
    path.parent.mkdir(parents=True, exist_ok=True)

    if path.exists() and not args.force:
        print(f"ℹ️  Registry already exists: {path}")
        return 0

    path.write_text("")
    print(f"✅ Debt registry created: {path}")
    return 0


def cmd_scan(args: argparse.Namespace) -> int:
    workspace = Path(args.workspace).resolve()
    target    = Path(args.path)

    if not target.is_absolute():
        target = workspace / target

    if not target.exists():
        print(f"❌ Path not found: {target}", file=sys.stderr)
        return 3

    min_sev  = args.min_severity.upper()
    findings = scan_path(target, min_sev)

    if args.json:
        print(json.dumps([asdict(f) for f in findings],
                         indent=2, ensure_ascii=False))
        return exit_code(findings, args.fail_on)

    print(render_report(findings, str(target), min_sev))
    return exit_code(findings, args.fail_on)


def cmd_annotate(args: argparse.Namespace) -> int:
    workspace = Path(args.workspace).resolve()
    target    = Path(args.path)

    if not target.is_absolute():
        target = workspace / target

    if not target.exists():
        print(f"❌ Path not found: {target}", file=sys.stderr)
        return 3

    dry_run  = not args.confirm
    min_sev  = args.min_severity.upper()
    findings = scan_path(target, min_sev)

    if not findings:
        print("✅ No debt patterns found. Nothing to annotate.")
        return 0

    if dry_run:
        print(f"🔍 Dry-run: would annotate {len(findings)} item(s). "
              f"Use --confirm to apply.")

    # Group by file.
    from collections import defaultdict
    by_file: dict[str, list[DebtFinding]] = defaultdict(list)
    for f in findings:
        by_file[f.file].append(f)

    total_inserted = 0

    for file_path, file_findings in by_file.items():
        count, _ = annotate_file(
            Path(file_path), file_findings, dry_run
        )
        total_inserted += count
        mode = "(dry-run)" if dry_run else ""
        print(f"  {'📝' if not dry_run else '🔍'} {mode} "
              f"{Path(file_path).name}: {count} annotation(s)")

        if not dry_run:
            for f in file_findings:
                append_registry(workspace, {
                    "id":            f.id,
                    "timestamp":     utc_now(),
                    "schema_version": SCHEMA_VERSION,
                    "file":          f.file,
                    "line":          f.line,
                    "category":      f.category,
                    "severity":      f.severity,
                    "effort":        f.effort,
                    "description":   f.title,
                    "snippet":       f.snippet,
                    "fix":           f.fix,
                    "ref":           f.ref,
                    "agent_generated": f.agent_generated,
                    "status":        "open",
                })

    if dry_run:
        print(f"\nDry-run: {total_inserted} annotation(s) would be inserted.")
        print("Re-run with --confirm to apply.")
    else:
        print(f"\n✅ {total_inserted} annotation(s) inserted and registered.")

    return exit_code(findings)


def cmd_add(args: argparse.Namespace) -> int:
    workspace = Path(args.workspace).resolve()

    category = args.category.upper()
    severity = args.severity.upper()
    effort   = args.effort.upper()

    if category not in VALID_CATEGORIES:
        print(
            f"❌ Unknown category: {category}\n"
            f"Valid: {', '.join(sorted(VALID_CATEGORIES))}",
            file=sys.stderr,
        )
        return 3

    if severity not in VALID_SEVERITIES:
        print(f"❌ Unknown severity: {severity}", file=sys.stderr)
        return 3

    if effort not in VALID_EFFORTS:
        print(f"❌ Unknown effort: {effort}", file=sys.stderr)
        return 3

    debt_id = make_id(args.file, args.line, category)

    entry = {
        "id":              debt_id,
        "timestamp":       utc_now(),
        "schema_version":  SCHEMA_VERSION,
        "file":            args.file,
        "line":            args.line,
        "category":        category,
        "severity":        severity,
        "effort":          effort,
        "description":     args.description,
        "snippet":         "",
        "fix":             "",
        "ref":             args.ref or "",
        "agent_generated": args.agent_generated,
        "status":          "open",
    }

    append_registry(workspace, entry)

    print()
    print("🏗️  Debt item registered")
    print("─" * 48)
    print(f"ID         : {debt_id}")
    print(f"File       : {args.file}:{args.line}")
    print(f"Category   : {category}")
    print(f"Severity   : {severity}")
    print(f"Effort     : {effort}")
    print(f"Description: {args.description}")
    if args.ref:
        print(f"Ref        : {args.ref}")
    print()
    return 0


def cmd_report(args: argparse.Namespace) -> int:
    workspace = Path(args.workspace).resolve()
    entries   = load_registry(workspace)
    min_sev   = args.min_severity.upper()
    min_order = SEVERITY_ORDER.get(min_sev, 1)

    findings = [
        DebtFinding(
            file=e.get("file", ""),
            line=e.get("line", 0),
            category=e.get("category", ""),
            severity=e.get("severity", "LOW"),
            effort=e.get("effort", "M"),
            title=e.get("description", ""),
            snippet=e.get("snippet", ""),
            fix=e.get("fix", ""),
            agent_generated=bool(e.get("agent_generated", False)),
            ref=e.get("ref", ""),
            status=e.get("status", "open"),
            id=e.get("id", ""),
        )
        for e in entries
        if SEVERITY_ORDER.get(e.get("severity", "LOW"), 1) >= min_order
    ]

    if args.json:
        print(json.dumps([asdict(f) for f in findings],
                         indent=2, ensure_ascii=False))
        return exit_code(findings, args.fail_on)

    print(render_report(findings, str(registry_path(workspace)), min_sev))
    return exit_code(findings, args.fail_on)


def cmd_resolve(args: argparse.Namespace) -> int:
    workspace = Path(args.workspace).resolve()
    ok        = update_registry_status(workspace, args.id, "resolved")

    if ok:
        print(f"✅ Debt item '{args.id}' marked as resolved.")
        return 0
    else:
        print(f"❌ Debt item '{args.id}' not found.", file=sys.stderr)
        entries = load_registry(workspace)
        open_ids = [
            e.get("id", "") for e in entries
            if e.get("status") != "resolved"
        ]
        if open_ids:
            print("Open IDs:")
            for d_id in open_ids[:20]:
                print(f"  {d_id}")
        return 3


def cmd_check(args: argparse.Namespace) -> int:
    workspace = Path(args.workspace).resolve()
    entries   = load_registry(workspace)
    fail_on   = args.fail_on.upper()
    threshold = SEVERITY_ORDER.get(fail_on, 4)

    open_critical = [
        e for e in entries
        if e.get("status") != "resolved"
        and SEVERITY_ORDER.get(e.get("severity", "LOW"), 0) >= threshold
    ]

    if open_critical:
        print(
            f"❌ {len(open_critical)} open debt item(s) at "
            f"{fail_on}+ severity."
        )
        for e in open_critical[:10]:
            sev = e.get("severity", "?")
            icon = SEVERITY_ICONS.get(sev, "•")
            print(
                f"  {icon} {sev}  {e.get('category','')}  "
                f"{Path(e.get('file','')).name}:{e.get('line',0)}  "
                f"{e.get('description','')[:60]}"
            )
        return 2

    print(f"✅ No open debt at {fail_on}+ severity.")
    return 0


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Technical Debt Annotator")
    sub    = parser.add_subparsers(dest="command", required=True)

    # init
    p = sub.add_parser("init")
    p.add_argument("--workspace", default=".")
    p.add_argument("--force",     action="store_true")
    p.set_defaults(func=cmd_init)

    # scan
    p = sub.add_parser("scan")
    p.add_argument("--workspace",    default=".")
    p.add_argument("--path",         required=True)
    p.add_argument("--min-severity",
                   choices=["LOW", "MEDIUM", "HIGH", "CRITICAL"],
                   default="LOW")
    p.add_argument("--fail-on",
                   choices=["LOW", "MEDIUM", "HIGH", "CRITICAL"],
                   default="CRITICAL")
    p.add_argument("--json", action="store_true")
    p.set_defaults(func=cmd_scan)

    # annotate
    p = sub.add_parser("annotate")
    p.add_argument("--workspace",    default=".")
    p.add_argument("--path",         required=True)
    p.add_argument("--min-severity",
                   choices=["LOW", "MEDIUM", "HIGH", "CRITICAL"],
                   default="MEDIUM")
    p.add_argument("--confirm",      action="store_true")
    p.set_defaults(func=cmd_annotate)

    # add
    p = sub.add_parser("add", help="Manually register one debt item")
    p.add_argument("--workspace",      default=".")
    p.add_argument("--file",           required=True)
    p.add_argument("--line",           type=int, required=True)
    p.add_argument("--category",       required=True)
    p.add_argument("--severity",       required=True,
                   choices=["LOW", "MEDIUM", "HIGH", "CRITICAL"])
    p.add_argument("--effort",         required=True,
                   choices=["XS", "S", "M", "L", "XL"])
    p.add_argument("--description",    required=True)
    p.add_argument("--ref",            default="")
    def parse_bool(v: str) -> bool:
        if isinstance(v, bool):
            return v
        return v.lower() in ("yes", "true", "t", "1")
    p.add_argument("--agent-generated", type=parse_bool, default=False)
    p.set_defaults(func=cmd_add)

    # report
    p = sub.add_parser("report")
    p.add_argument("--workspace",    default=".")
    p.add_argument("--min-severity",
                   choices=["LOW", "MEDIUM", "HIGH", "CRITICAL"],
                   default="MEDIUM")
    p.add_argument("--fail-on",
                   choices=["LOW", "MEDIUM", "HIGH", "CRITICAL"],
                   default="CRITICAL")
    p.add_argument("--json", action="store_true")
    p.set_defaults(func=cmd_report)

    # resolve
    p = sub.add_parser("resolve")
    p.add_argument("--workspace",    default=".")
    p.add_argument("--id",           required=True)
    p.set_defaults(func=cmd_resolve)

    # check
    p = sub.add_parser("check")
    p.add_argument("--workspace",    default=".")
    p.add_argument("--fail-on",
                   choices=["LOW", "MEDIUM", "HIGH", "CRITICAL"],
                   default="CRITICAL")
    p.set_defaults(func=cmd_check)

    args = parser.parse_args()
    if hasattr(args, "func"):
        try:
            sys.exit(args.func(args))
        except Exception as e:
            print(f"❌ Error: {e}", file=sys.stderr)
            sys.exit(3)
    else:
        parser.print_help()
        sys.exit(3)


if __name__ == "__main__":
    main()
