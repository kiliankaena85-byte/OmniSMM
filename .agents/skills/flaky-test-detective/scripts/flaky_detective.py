#!/usr/bin/env python3
"""
flaky_detective.py

Static flakiness detector for test files.

Commands:
  scan   — scan one file or directory for flaky test patterns

Exit codes:
  0 — no findings
  1 — LOW or MEDIUM findings only
  2 — HIGH or CRITICAL findings found
  3 — error
"""

from __future__ import annotations

import re
import sys
import json
import argparse
from pathlib import Path
from dataclasses import dataclass, field, asdict
from collections import Counter
from typing import Any

# Ensure standard output can print Unicode characters safely (especially on Windows)
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except AttributeError:
        pass


# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────

SEVERITY_ORDER = {
    "CRITICAL": 4,
    "HIGH":     3,
    "MEDIUM":   2,
    "LOW":      1,
}

SEVERITY_ICONS = {
    "CRITICAL": "💀 CRITICAL",
    "HIGH":     "🔴 HIGH",
    "MEDIUM":   "🟠 MEDIUM",
    "LOW":      "🟡 LOW",
}

SUPPORTED_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".java", ".kt",
}

SKIP_DIRS = {
    ".git", "node_modules", "__pycache__", ".venv", "venv",
    "dist", "build", ".next", ".nuxt", "coverage",
}


# ─────────────────────────────────────────────────────────────────────────────
# Data classes
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class FlakingPattern:
    category:  str
    severity:  str
    title:     str
    regex:     str
    detail:    str
    fix:       str
    languages: set[str] = field(default_factory=lambda: {"py", "ts", "js"})


@dataclass
class Finding:
    file:      str
    test_name: str
    line:      int
    category:  str
    severity:  str
    title:     str
    snippet:   str
    detail:    str
    fix:       str


# ─────────────────────────────────────────────────────────────────────────────
# Pattern registry
# ─────────────────────────────────────────────────────────────────────────────

PATTERNS: list[FlakingPattern] = [

    # ── TIME ──────────────────────────────────────────────────────────────────
    FlakingPattern(
        category="TIME",
        severity="CRITICAL",
        title="datetime.now() used directly in assertion",
        regex=r"(datetime\.now\(\)|datetime\.today\(\)|date\.today\(\))",
        detail=(
            "Calling datetime.now() inside an assertion makes the test "
            "time-dependent. Will fail across midnight, DST changes, or "
            "on CI servers in different timezones."
        ),
        fix="Inject a fixed date or use freezegun to freeze time.",
        languages={"py"},
    ),
    FlakingPattern(
        category="TIME",
        severity="CRITICAL",
        title="Date.now() or new Date() used in assertion",
        regex=r"(Date\.now\(\)|new Date\(\))",
        detail=(
            "Date.now() and new Date() are time-dependent. "
            "Will fail when time advances between call and assertion."
        ),
        fix="Use jest.useFakeTimers() or inject a fixed timestamp.",
        languages={"ts", "js"},
    ),
    FlakingPattern(
        category="TIME",
        severity="HIGH",
        title="time.time() used in test logic",
        regex=r"\btime\.time\(\)",
        detail=(
            "time.time() returns wall clock time. "
            "Tests using it for assertions are environment-dependent."
        ),
        fix="Mock time or use a fixed reference.",
        languages={"py"},
    ),

    # ── RANDOM ────────────────────────────────────────────────────────────────
    FlakingPattern(
        category="RANDOM",
        severity="HIGH",
        title="random module used without seed in test",
        regex=r"\brandom\.(randint|choice|shuffle|random|sample|uniform)\(",
        detail=(
            "Unseeded random produces different values each run. "
            "Any assertion on the result is non-deterministic."
        ),
        fix="Use random.seed(42) in setup, or use fixed test data instead.",
        languages={"py"},
    ),
    FlakingPattern(
        category="RANDOM",
        severity="HIGH",
        title="Math.random() used in test",
        regex=r"Math\.random\(\)",
        detail=(
            "Math.random() is unseeded. "
            "Assertions on random output will fail intermittently."
        ),
        fix="Mock Math.random with jest.spyOn or use a seeded PRNG.",
        languages={"ts", "js"},
    ),
    FlakingPattern(
        category="RANDOM",
        severity="MEDIUM",
        title="uuid4() / nanoid() used in test assertion",
        regex=r"(uuid4\(\)|uuid\.uuid4\(\)|nanoid\(\)|crypto\.randomUUID\(\))",
        detail=(
            "UUID generation produces unique values every time. "
            "Asserting on the exact value will always fail."
        ),
        fix="Assert on format/length only, or mock the UUID generator.",
        languages={"py", "ts", "js"},
    ),
    FlakingPattern(
        category="RANDOM",
        severity="MEDIUM",
        title="Faker / factory_boy without seed in test",
        regex=r"(Faker\(\)|factory\.build|factory\.create|fake\.)",
        detail=(
            "Faker and factory libraries without a fixed seed produce "
            "different data each run."
        ),
        fix="Use Faker(seed=12345) or set a global seed in conftest.",
        languages={"py"},
    ),

    # ── ASYNC ─────────────────────────────────────────────────────────────────
    FlakingPattern(
        category="ASYNC",
        severity="CRITICAL",
        title="asyncio.create_task without await in test",
        regex=r"asyncio\.create_task\(",
        detail=(
            "create_task() schedules work without blocking. "
            "The task may not complete before the assertion runs."
        ),
        fix="Await the task or use asyncio.gather().",
        languages={"py"},
    ),
    FlakingPattern(
        category="ASYNC",
        severity="HIGH",
        title="Promise without await in test",
        regex=r"(new Promise\(|\.then\(|\.catch\()(?!.*await)",
        detail=(
            "Unhandled promise in a test may resolve after the test ends, "
            "causing silent failures or affecting the next test."
        ),
        fix="Await all promises; use async/await consistently.",
        languages={"ts", "js"},
    ),
    FlakingPattern(
        category="ASYNC",
        severity="HIGH",
        title="fire-and-forget coroutine in test",
        regex=r"asyncio\.ensure_future\(",
        detail=(
            "ensure_future() runs a coroutine without waiting. "
            "State changes may not be visible during assertion."
        ),
        fix="Await the coroutine directly or use asyncio.gather().",
        languages={"py"},
    ),

    # ── STATE ─────────────────────────────────────────────────────────────────
    FlakingPattern(
        category="STATE",
        severity="HIGH",
        title="Module-level mutable list/dict modified in test",
        regex=r"^[a-zA-Z_][a-zA-Z0-9_]*\s*[=:]\s*(\[\]|\{\}|list\(\)|dict\(\))",
        detail=(
            "Module-level mutable containers persist between tests. "
            "Tests that mutate them depend on execution order."
        ),
        fix="Move to fixture with autouse=True and clear in teardown.",
        languages={"py"},
    ),
    FlakingPattern(
        category="STATE",
        severity="HIGH",
        title="Global variable mutation in test",
        regex=r"\bglobal\s+[a-zA-Z_]",
        detail=(
            "Global state mutation leaks between tests. "
            "Test results depend on execution order."
        ),
        fix="Use dependency injection or module-scoped fixtures with cleanup.",
        languages={"py"},
    ),
    FlakingPattern(
        category="STATE",
        severity="MEDIUM",
        title="Class-level variable used as counter or accumulator",
        regex=r"cls\.[a-zA-Z_]+\s*[\+\-\*]?=",
        detail=(
            "Class-level state accumulates across test methods. "
            "Later tests in the class see mutations from earlier ones."
        ),
        fix="Reset class state in setUp/tearDown or use instance scope.",
        languages={"py"},
    ),

    # ── NETWORK ───────────────────────────────────────────────────────────────
    FlakingPattern(
        category="NETWORK",
        severity="CRITICAL",
        title="HTTP call without mock: requests.get/post",
        regex=r"\brequests\.(get|post|put|patch|delete|head)\(",
        detail=(
            "Live HTTP call in test. "
            "Fails on network unavailability, rate limits, or API changes."
        ),
        fix="Use requests_mock, responses, or httpretty to mock HTTP.",
        languages={"py"},
    ),
    FlakingPattern(
        category="NETWORK",
        severity="CRITICAL",
        title="fetch() without mock in test",
        regex=r"\bfetch\(['\"]https?://",
        detail=(
            "Live fetch() call in test. "
            "Fails when network is unavailable or API is down."
        ),
        fix="Mock fetch with jest.fn() or msw (Mock Service Worker).",
        languages={"ts", "js"},
    ),
    FlakingPattern(
        category="NETWORK",
        severity="HIGH",
        title="Database call without transaction rollback",
        regex=r"(db\.execute|session\.add|session\.commit|cursor\.execute)(?!.*rollback)",
        detail=(
            "Database mutation without rollback pollutes test data. "
            "Tests pass in isolation but fail when run together."
        ),
        fix=(
            "Wrap in transaction and rollback, or use a test database "
            "fixture that resets state."
        ),
        languages={"py"},
    ),
    FlakingPattern(
        category="NETWORK",
        severity="HIGH",
        title="subprocess call to external service in test",
        regex=r"subprocess\.(run|call|check_output|Popen)\(",
        detail=(
            "Subprocess call may invoke external tools or services. "
            "Behavior depends on environment."
        ),
        fix="Mock subprocess or use a test-specific binary stub.",
        languages={"py"},
    ),

    # ── ORDER ─────────────────────────────────────────────────────────────────
    FlakingPattern(
        category="ORDER",
        severity="HIGH",
        title="Test reads file written by another test",
        regex=r"(open\(['\"]tests?/|open\(['\"]fixtures?/)",
        detail=(
            "If a previous test is responsible for writing this file, "
            "test order determines whether it exists."
        ),
        fix="Use pytest tmp_path fixture or setup the file in a fixture.",
        languages={"py"},
    ),

    # ── FS ────────────────────────────────────────────────────────────────────
    FlakingPattern(
        category="FS",
        severity="HIGH",
        title="os.listdir() order assumed in assertion",
        regex=r"os\.listdir\(",
        detail=(
            "os.listdir() returns files in filesystem order, which "
            "is not guaranteed to be stable across OSes or runs."
        ),
        fix="Sort the result: sorted(os.listdir(...)) before asserting.",
        languages={"py"},
    ),
    FlakingPattern(
        category="FS",
        severity="MEDIUM",
        title="Hardcoded /tmp path in test",
        regex=r"['\"/]/tmp/[a-zA-Z0-9_.-]+['\"]",
        detail=(
            "Hardcoded /tmp paths may collide across parallel test runs "
            "or persist between test sessions."
        ),
        fix="Use pytest's tmp_path or tempfile.mkdtemp() fixture.",
        languages={"py", "ts", "js"},
    ),
    FlakingPattern(
        category="FS",
        severity="MEDIUM",
        title="glob() result order assumed",
        regex=r"(glob\.glob\(|glob\()",
        detail=(
            "glob() does not guarantee result order. "
            "Assertions that depend on order are fragile."
        ),
        fix="Sort glob results before asserting: sorted(glob.glob(...)).",
        languages={"py"},
    ),

    # ── PORT ─────────────────────────────────────────────────────────────────
    FlakingPattern(
        category="PORT",
        severity="HIGH",
        title="Hardcoded port number in test",
        regex=r"(port\s*=\s*[0-9]{4,5}|localhost:[0-9]{4,5}|127\.0\.0\.1:[0-9]{4,5})",
        detail=(
            "Hardcoded ports fail when the port is already in use. "
            "Common in parallel CI environments."
        ),
        fix="Use port=0 to let the OS assign a free port, or use fixtures.",
        languages={"py", "ts", "js"},
    ),

    # ── SLEEP ─────────────────────────────────────────────────────────────────
    FlakingPattern(
        category="SLEEP",
        severity="HIGH",
        title="time.sleep() used to wait for async result",
        regex=r"\btime\.sleep\([0-9]",
        detail=(
            "Fixed sleep is brittle. On slow CI the operation may "
            "not complete in time; on fast machines it wastes time."
        ),
        fix="Use polling with timeout: wait_until(condition, timeout=10).",
        languages={"py"},
    ),
    FlakingPattern(
        category="SLEEP",
        severity="HIGH",
        title="setTimeout/setInterval in test without fake timers",
        regex=r"(setTimeout|setInterval)\(",
        detail=(
            "Real timers in tests introduce time dependency and "
            "slow down the test suite."
        ),
        fix="Use jest.useFakeTimers() and jest.runAllTimers().",
        languages={"ts", "js"},
    ),
    FlakingPattern(
        category="SLEEP",
        severity="MEDIUM",
        title="asyncio.sleep() used as wait in test",
        regex=r"asyncio\.sleep\([0-9]",
        detail=(
            "Fixed async sleep may not be enough on slow environments. "
            "Prefer polling with a timeout."
        ),
        fix="Poll the condition instead: use a wait_for helper.",
        languages={"py"},
    ),

    # ── ENV ───────────────────────────────────────────────────────────────────
    FlakingPattern(
        category="ENV",
        severity="HIGH",
        title="os.environ read directly in test",
        regex=r"os\.environ(\[|\.get\()",
        detail=(
            "Tests that read os.environ directly depend on the host "
            "environment. Results differ between developer machines and CI."
        ),
        fix=(
            "Use monkeypatch.setenv in pytest, or mock os.environ "
            "with unittest.mock.patch.dict."
        ),
        languages={"py"},
    ),
    FlakingPattern(
        category="ENV",
        severity="MEDIUM",
        title="process.env read directly in test",
        regex=r"process\.env\.",
        detail=(
            "process.env depends on the execution environment. "
            "Tests may pass locally but fail in CI."
        ),
        fix="Use jest.resetModules() and mock process.env per test.",
        languages={"ts", "js"},
    ),

    # ── FLOAT ─────────────────────────────────────────────────────────────────
    FlakingPattern(
        category="FLOAT",
        severity="MEDIUM",
        title="assertEqual on float values",
        regex=r"(assertEqual|assert_equal|assertEquals)\(.*(0\.[0-9]+|[0-9]+\.[0-9]+)",
        detail=(
            "Exact float equality fails due to floating-point "
            "representation differences across platforms."
        ),
        fix="Use pytest.approx(), math.isclose(), or round() before asserting.",
        languages={"py"},
    ),
    FlakingPattern(
        category="FLOAT",
        severity="MEDIUM",
        title="toEqual on float value in Jest/Vitest",
        regex=r"\.toEqual\([0-9]+\.[0-9]+\)",
        detail=(
            "Exact float equality in Jest fails due to floating-point drift."
        ),
        fix="Use .toBeCloseTo(value, precision) instead of .toEqual.",
        languages={"ts", "js"},
    ),

    # ── ORDER_CMP ─────────────────────────────────────────────────────────────
    FlakingPattern(
        category="ORDER_CMP",
        severity="MEDIUM",
        title="assertEqual on dict keys list",
        regex=r"(assertEqual|assert_equal)\(list\(.+\.keys\(\)",
        detail=(
            "dict.keys() order is insertion-order in Python 3.7+, but "
            "tests asserting exact key order are fragile when refactoring."
        ),
        fix="Use assertEqual(set(result.keys()), {'a', 'b', 'c'}).",
        languages={"py"},
    ),
    FlakingPattern(
        category="ORDER_CMP",
        severity="MEDIUM",
        title="assertEqual on set converted to list",
        regex=r"(assertEqual|assert_equal)\(list\(.*set\(",
        detail=(
            "Set iteration order is not guaranteed. "
            "Converting to list and comparing is non-deterministic."
        ),
        fix="Compare sets directly without converting to list.",
        languages={"py"},
    ),
    FlakingPattern(
        category="ORDER_CMP",
        severity="LOW",
        title="expect(array).toEqual() without sorting",
        regex=r"\.toEqual\(\[",
        detail=(
            "Array comparison with toEqual fails if elements arrive in "
            "different order, e.g. from async operations or DB queries."
        ),
        fix=(
            "Sort both arrays before comparing, "
            "or use expect.arrayContaining()."
        ),
        languages={"ts", "js"},
    ),
]


# ─────────────────────────────────────────────────────────────────────────────
# Language detection
# ─────────────────────────────────────────────────────────────────────────────

def detect_lang(path: Path) -> str:
    ext = path.suffix.lower()
    if ext == ".py":
        return "py"
    if ext in {".ts", ".tsx"}:
        return "ts"
    if ext in {".js", ".jsx"}:
        return "js"
    if ext == ".go":
        return "go"
    if ext == ".java":
        return "java"
    if ext == ".kt":
        return "kt"
    return "unknown"


def is_test_file(path: Path, lang: str) -> bool:
    name = path.name.lower()
    if lang == "py":
        return name.startswith("test_") or name.endswith("_test.py")
    if lang in {"ts", "js"}:
        return (
            ".test." in name
            or ".spec." in name
            or name.startswith("test")
        )
    if lang == "go":
        return name.endswith("_test.go")
    if lang in {"java", "kt"}:
        return name.startswith("Test") or name.endswith("Test.java")
    return False


# ─────────────────────────────────────────────────────────────────────────────
# Test function extraction
# ─────────────────────────────────────────────────────────────────────────────

TEST_FUNC_PATTERNS: dict[str, re.Pattern] = {
    "py": re.compile(
        r"^\s*(async\s+)?def\s+(test[a-zA-Z0-9_]+)\s*\(",
        re.MULTILINE
    ),
    "ts": re.compile(
        r"^\s*(it|test|describe)\s*\(\s*['\"]([^'\"]+)['\"]",
        re.MULTILINE
    ),
    "js": re.compile(
        r"^\s*(it|test|describe)\s*\(\s*['\"]([^'\"]+)['\"]",
        re.MULTILINE
    ),
    "go": re.compile(
        r"^\s*func\s+(Test[a-zA-Z0-9_]+)\s*\(",
        re.MULTILINE
    ),
    "java": re.compile(
        r"@Test\s+.*?void\s+([a-zA-Z0-9_]+)\s*\(",
        re.MULTILINE | re.DOTALL
    ),
    "kt": re.compile(
        r"@Test\s+.*?fun\s+([a-zA-Z0-9_]+)\s*\(",
        re.MULTILINE | re.DOTALL
    ),
}


def find_test_names(text: str, lang: str) -> list[tuple[int, str]]:
    """Return list of (line_number_1indexed, test_name)."""
    pattern = TEST_FUNC_PATTERNS.get(lang)
    if not pattern:
        return []

    results = []
    for m in pattern.finditer(text):
        line_no = text[:m.start()].count("\n") + 1
        # For ts/js: group(2) is the test description; for others group(1) or group(2)
        name = m.group(2) if lang in {"ts", "js"} and m.lastindex >= 2 else m.group(1)
        results.append((line_no, name))

    return results


def find_test_at_line(
    test_positions: list[tuple[int, str]],
    line: int,
) -> str:
    """Return the test function name that contains the given line."""
    current = "module-level"
    for test_line, name in test_positions:
        if test_line <= line:
            current = name
        else:
            break
    return current


# ─────────────────────────────────────────────────────────────────────────────
# Scanner
# ─────────────────────────────────────────────────────────────────────────────

def scan_file(
    path: Path,
    min_severity: str = "LOW",
    test_pattern: str = "",
) -> list[Finding]:
    lang = detect_lang(path)

    if lang == "unknown":
        return []

    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return []

    test_positions = find_test_names(text, lang)
    lines = text.splitlines()
    findings: list[Finding] = []
    min_order = SEVERITY_ORDER.get(min_severity, 1)

    for pattern in PATTERNS:
        if lang not in pattern.languages:
            continue

        if SEVERITY_ORDER[pattern.severity] < min_order:
            continue

        try:
            rx = re.compile(pattern.regex, re.IGNORECASE)
        except re.error:
            continue

        for idx, line in enumerate(lines, start=1):
            if not rx.search(line):
                continue

            test_name = find_test_at_line(test_positions, idx)

            # Optional filter by test name.
            if test_pattern and test_pattern.lower() not in test_name.lower():
                continue

            findings.append(Finding(
                file=str(path),
                test_name=test_name,
                line=idx,
                category=pattern.category,
                severity=pattern.severity,
                title=pattern.title,
                snippet=line.strip()[:120],
                detail=pattern.detail,
                fix=pattern.fix,
            ))

    return findings


def scan_directory(
    dir_path: Path,
    min_severity: str = "LOW",
    test_pattern: str = "",
) -> tuple[list[Finding], int, int]:
    """Returns (findings, files_scanned, tests_found)."""
    all_findings: list[Finding] = []
    files_scanned = 0
    tests_found = 0

    for root, dirs, files in __import__("os").walk(dir_path):
        dirs[:] = [
            d for d in dirs
            if d not in SKIP_DIRS and not d.startswith(".")
        ]
        for fname in files:
            fpath = Path(root) / fname
            lang  = detect_lang(fpath)

            if lang == "unknown":
                continue
            if not is_test_file(fpath, lang):
                continue

            files_scanned += 1

            try:
                text = fpath.read_text(encoding="utf-8", errors="replace")
                tests_found += len(find_test_names(text, lang))
            except OSError:
                pass

            findings = scan_file(fpath, min_severity, test_pattern)
            all_findings.extend(findings)

    return all_findings, files_scanned, tests_found


# ─────────────────────────────────────────────────────────────────────────────
# Report rendering
# ─────────────────────────────────────────────────────────────────────────────

def render_report(
    findings:      list[Finding],
    source_label:  str,
    files_scanned: int,
    tests_found:   int,
    suggest_fixes: bool,
) -> str:
    findings = sorted(
        findings,
        key=lambda f: (
            -SEVERITY_ORDER.get(f.severity, 0),
            f.file,
            f.line,
        )
    )

    by_sev = Counter(f.severity for f in findings)
    by_cat = Counter(f.category for f in findings)

    lines = [
        "",
        "🔍 Flaky Test Detective Report",
        "═" * 56,
        f"Source         : {source_label}",
        f"Files scanned  : {files_scanned}",
        f"Tests found    : {tests_found}",
        f"Flaky findings : {len(findings)}",
        "═" * 56,
    ]

    if not findings:
        lines += [
            "",
            "✅ No flaky patterns detected.",
            "═" * 56,
            "",
        ]
        return "\n".join(lines)

    for f in findings:
        sev_label = SEVERITY_ICONS.get(f.severity, f.severity)
        lines += [
            "",
            f"{sev_label}  [{f.category}]  {Path(f.file).name}",
            f"  Test     : {f.test_name}",
            f"  Line     : {f.line}",
            f"  Pattern  : {f.title}",
            f"  Snippet  : `{f.snippet}`",
            f"  Detail   : {f.detail}",
            f"  Fix      : {f.fix}",
        ]

        if suggest_fixes:
            lines += [
                "",
                f"  Suggested fix for [{f.category}]:",
                f"  {f.fix}",
            ]

    lines += [
        "",
        "═" * 56,
        "By severity:  " + "  ".join(
            f"{sev}={count}"
            for sev, count in sorted(
                by_sev.items(),
                key=lambda x: -SEVERITY_ORDER.get(x[0], 0)
            )
        ),
        "By category:  " + "  ".join(
            f"{cat}={count}"
            for cat, count in by_cat.most_common()
        ),
        "═" * 56,
        "",
    ]

    return "\n".join(lines)


def exit_code(findings: list[Finding]) -> int:
    if not findings:
        return 0
    sevs = {f.severity for f in findings}
    if "CRITICAL" in sevs or "HIGH" in sevs:
        return 2
    return 1


# ─────────────────────────────────────────────────────────────────────────────
# Commands
# ─────────────────────────────────────────────────────────────────────────────

def cmd_scan(args: argparse.Namespace) -> int:
    min_sev = args.min_severity.upper()
    test_pat = args.test_pattern or ""
    suggest = args.suggest_fixes

    if args.file:
        path = Path(args.file)
        if not path.exists():
            print(f"❌ File not found: {path}", file=sys.stderr)
            return 3

        lang = detect_lang(path)
        if lang == "unknown":
            print(f"❌ Unsupported file type: {path.suffix}", file=sys.stderr)
            return 3

        try:
            text     = path.read_text(encoding="utf-8", errors="replace")
            n_tests  = len(find_test_names(text, lang))
        except OSError:
            n_tests = 0

        findings = scan_file(path, min_sev, test_pat)

        if args.json:
            print(json.dumps([asdict(f) for f in findings], indent=2,
                              ensure_ascii=False))
            return exit_code(findings)

        report = render_report(findings, str(path), 1, n_tests, suggest)
        print(report)
        return exit_code(findings)

    if args.dir:
        dir_path = Path(args.dir)
        if not dir_path.exists():
            print(f"❌ Directory not found: {dir_path}", file=sys.stderr)
            return 3

        findings, n_files, n_tests = scan_directory(dir_path, min_sev, test_pat)

        if args.json:
            print(json.dumps([asdict(f) for f in findings], indent=2,
                              ensure_ascii=False))
            return exit_code(findings)

        report = render_report(findings, str(dir_path), n_files, n_tests, suggest)
        print(report)

        if args.output:
            out = Path(args.output)
            out.parent.mkdir(parents=True, exist_ok=True)
            if args.json:
                out.write_text(json.dumps(
                    [asdict(f) for f in findings], indent=2,
                    ensure_ascii=False
                ), encoding="utf-8")
            else:
                out.write_text(report, encoding="utf-8")
            print(f"✅ Report written to {out}")

        return exit_code(findings)

    print("❌ Provide --file or --dir", file=sys.stderr)
    return 3


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Flaky Test Detective")
    sub    = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("scan", help="Scan test files for flaky patterns")
    target = p.add_mutually_exclusive_group()
    target.add_argument("--file", default="", help="Single test file to scan")
    target.add_argument("--dir",  default="", help="Directory of test files")

    p.add_argument(
        "--min-severity",
        choices=["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        default="LOW",
        help="Minimum severity level to report (default: LOW)",
    )
    p.add_argument(
        "--test-pattern",
        default="",
        help="Only report findings in tests matching this name substring",
    )
    p.add_argument(
        "--suggest-fixes",
        action="store_true",
        help="Include fix suggestions in the report",
    )
    p.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON",
    )
    p.add_argument(
        "--output",
        default="",
        help="Write report to this file path",
    )
    p.set_defaults(func=cmd_scan)

    args = parser.parse_args()

    try:
        sys.exit(args.func(args))
    except KeyboardInterrupt:
        print("flaky_detective interrupted", file=sys.stderr)
        sys.exit(3)
    except Exception as e:
        print(f"flaky_detective ⚠️ unexpected error: {e}", file=sys.stderr)
        sys.exit(3)


if __name__ == "__main__":
    main()
