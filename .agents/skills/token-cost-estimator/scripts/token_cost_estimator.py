#!/usr/bin/env python3
"""
token_cost_estimator.py

Pre-flight token and cost estimator for agent tasks.

Commands:
  estimate   — estimate cost of one task
  compare    — compare cost across multiple models
  split      — recommend task decomposition to fit context limit
  session    — summarize accumulated cost from log

Exit codes:
  0 — NOMINAL (≤70% context usage)
  1 — WARN    (71–95%)
  2 — ALERT   (>95% or overflow)
  3 — error
"""

from __future__ import annotations

import os
import re
import sys
import csv
import json
import argparse
from pathlib import Path
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, field, asdict
from typing import Any


# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────

CHARS_PER_TOKEN: dict[str, float] = {
    "prose_en":  4.0,
    "prose_ru":  3.0,
    "code":      3.5,
    "json_yaml": 3.0,
    "markdown":  3.8,
    "html":      2.8,
    "minified":  2.5,
    "default":   3.5,
}

# USD per 1,000,000 tokens: (input, output, context_limit)
MODEL_PRICING: dict[str, tuple[float, float, int]] = {
    "gemini-3.5-flash":         (1.50,   9.00,   1_048_576),
    "gemini-3.5-flash-high":    (1.50,   9.00,   1_048_576),
    "gemini-3-flash":           (0.50,   3.00,   1_048_576),
    "gemini-3-flash-preview":   (0.50,   3.00,   1_048_576),
    "gemini-2.0-flash":         (0.075,  0.30,   1_048_576),
    "gemini-2.5-pro":           (1.25,   10.00,  1_048_576),
    "claude-sonnet-4":          (3.00,   15.00,    200_000),
    "claude-opus-4":            (15.00,  75.00,    200_000),
    "gpt-4o":                   (2.50,   10.00,    128_000),
    "gpt-4o-mini":              (0.15,    0.60,    128_000),
    "o3":                       (10.00,  40.00,    200_000),
    "o4-mini":                  (1.10,    4.40,    200_000),
}

DEFAULT_MODEL = "gemini-3.5-flash"

PLATFORM_OVERHEAD_TOKENS = 3_000
SKILL_METADATA_TOKENS_PER_SKILL = 250
DEFAULT_HISTORY_TOKENS = 2_000
DEFAULT_OUTPUT_FACTOR = 1.5

LOG_REL = ".agent/logs/token_cost.jsonl"

SKIP_DIRS = {
    ".git", "node_modules", "__pycache__", ".venv", "venv",
    "dist", "build", ".next", ".nuxt", "coverage", ".agent",
}

TEXT_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx",
    ".go", ".rs", ".java", ".kt", ".rb",
    ".json", ".yaml", ".yml", ".toml", ".ini",
    ".md", ".txt", ".html", ".css", ".scss",
    ".sql", ".sh", ".tf",
}

CONTEXT_STATES = [
    (96, "OVERFLOW", "⛔"),
    (86, "ALERT",    "🔴"),
    (71, "WARN",     "orange"),  # Adjusted for ANSI display
    (51, "MONITOR",  "🟡"),
    (0,  "NOMINAL",  "🟢"),
]

# Premium Terminal Colors
COLOR_GREEN = "\033[92m"
COLOR_YELLOW = "\033[93m"
COLOR_CYAN = "\033[96m"
COLOR_RED = "\033[91m"
COLOR_BOLD = "\033[1m"
COLOR_RESET = "\033[0m"

def supports_color() -> bool:
    """Check if the current terminal supports color output."""
    plat = sys.platform
    supported_platform = plat != "win32" or "ANSICON" in os.environ or "WT_SESSION" in os.environ
    is_a_tty = hasattr(sys.stdout, "isatty") and sys.stdout.isatty()
    return supported_platform and is_a_tty

def colorize(text: str, color_code: str) -> str:
    if supports_color():
        return f"{color_code}{text}{COLOR_RESET}"
    return text


# ─────────────────────────────────────────────────────────────────────────────
# Data classes
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class FileTokens:
    path: str
    chars: int
    tokens: int
    content_type: str


@dataclass
class CostEstimate:
    model: str
    task_tokens: int
    file_tokens: int
    history_tokens: int
    skill_tokens: int
    overhead_tokens: int
    total_input_tokens: int
    output_tokens: int
    total_tokens: int
    context_limit: int
    context_pct: float
    context_state: str
    cost_input_usd: float
    cost_output_usd: float
    total_cost_usd: float
    files_analyzed: list[FileTokens] = field(default_factory=list)


@dataclass
class SessionEntry:
    timestamp: str
    task: str
    model: str
    total_tokens: int
    total_cost_usd: float


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def classify_content(text: str) -> str:
    lines = text.splitlines()
    if not lines:
        return "prose_en"

    total = max(len(lines), 1)

    code_count = sum(
        1 for l in lines
        if l.strip() and re.match(r"^\s*(def |class |import |from |#|//|\{|\}|;|func |pub |let |const )", l)
        if True
    )
    html_count = sum(1 for l in lines if re.search(r"<[a-zA-Z/]", l))
    json_count = text.strip().startswith(("{", "["))
    md_count = sum(1 for l in lines if re.match(r"^#{1,6} |^\s*[-*] |\*\*|```|\|", l))

    cyr_chars = len(re.findall(r"[а-яёА-ЯЁ]", text))
    lat_chars = len(re.findall(r"[a-zA-Z]", text))
    is_russian = (cyr_chars / max(cyr_chars + lat_chars, 1)) > 0.5

    if json_count:
        return "json_yaml"
    if code_count / total > 0.25:
        return "code"
    if html_count / total > 0.20:
        return "html"
    if md_count / total > 0.20:
        return "markdown"
    if is_russian:
        return "prose_ru"
    return "prose_en"


def text_to_tokens(text: str, content_type: str = "") -> int:
    ct = content_type or classify_content(text)
    ratio = CHARS_PER_TOKEN.get(ct, CHARS_PER_TOKEN["default"])
    return max(1, int(len(text) / ratio))


def context_state(pct: float) -> tuple[str, str]:
    for threshold, state, icon in CONTEXT_STATES:
        if pct >= threshold:
            return state, icon
    return "NOMINAL", "🟢"


def format_usd(value: float) -> str:
    if value < 0.0001:
        return f"${value:.6f}"
    if value < 0.01:
        return f"${value:.4f}"
    return f"${value:.4f}"


def model_pricing(model: str) -> tuple[float, float, int]:
    key = model.lower()
    if key in MODEL_PRICING:
        return MODEL_PRICING[key]
    # Fuzzy match
    for k, v in MODEL_PRICING.items():
        if key in k or k in key:
            return v
    return MODEL_PRICING[DEFAULT_MODEL]


# ─────────────────────────────────────────────────────────────────────────────
# File scanner
# ─────────────────────────────────────────────────────────────────────────────

def scan_files(paths: list[str], workspace: Path) -> list[FileTokens]:
    results: list[FileTokens] = []
    seen: set[str] = set()

    for raw in paths:
        p = Path(raw)
        if not p.is_absolute():
            p = workspace / p

        if not p.exists():
            continue

        if p.is_file():
            if p.suffix.lower() in TEXT_EXTENSIONS and str(p) not in seen:
                seen.add(str(p))
                results.extend(_analyze_file(p))
        elif p.is_dir():
            for child in p.rglob("*"):
                if child.is_file() and child.suffix.lower() in TEXT_EXTENSIONS:
                    if str(child) not in seen:
                        skip = any(part in SKIP_DIRS for part in child.parts)
                        if not skip:
                            seen.add(str(child))
                            results.extend(_analyze_file(child))

    return results


def _analyze_file(path: Path) -> list[FileTokens]:
    try:
        text = path.read_text(errors="replace")
        ct = classify_content(text)
        tokens = text_to_tokens(text, ct)
        return [FileTokens(
            path=str(path),
            chars=len(text),
            tokens=tokens,
            content_type=ct,
        )]
    except OSError:
        return []


# ─────────────────────────────────────────────────────────────────────────────
# Skill scanner
# ─────────────────────────────────────────────────────────────────────────────

def count_skill_tokens(
    workspace: Path,
    skill_names: list[str],
) -> int:
    if not skill_names:
        # Try to count all installed skills' metadata.
        skills_dir = workspace / ".agent" / "skills"
        if skills_dir.exists():
            count = sum(1 for d in skills_dir.iterdir() if d.is_dir())
            return count * SKILL_METADATA_TOKENS_PER_SKILL
        return 0

    total = 0
    for name in skill_names:
        skill_md = workspace / ".agent" / "skills" / name / "SKILL.md"
        if skill_md.exists():
            try:
                text = skill_md.read_text(errors="replace")
                # Only frontmatter/description contributes to metadata load.
                meta = _extract_frontmatter_text(text)
                total += text_to_tokens(meta)
            except OSError:
                total += SKILL_METADATA_TOKENS_PER_SKILL
        else:
            total += SKILL_METADATA_TOKENS_PER_SKILL

    return total


def _extract_frontmatter_text(text: str) -> str:
    lines = text.splitlines()
    in_fm = False
    result: list[str] = []

    for line in lines:
        if line.strip() == "---":
            if not in_fm:
                in_fm = True
                continue
            else:
                break
        if in_fm:
            result.append(line)

    return "\n".join(result)


# ─────────────────────────────────────────────────────────────────────────────
# Core estimator
# ─────────────────────────────────────────────────────────────────────────────

def estimate(
    task_text: str,
    file_paths: list[str],
    skill_names: list[str],
    model: str,
    workspace: Path,
    history_tokens: int = DEFAULT_HISTORY_TOKENS,
    output_factor: float = DEFAULT_OUTPUT_FACTOR,
) -> CostEstimate:
    price_in, price_out, ctx_limit = model_pricing(model)

    task_tokens = text_to_tokens(task_text) if task_text else 0
    files = scan_files(file_paths, workspace)
    file_token_total = sum(f.tokens for f in files)
    skill_token_total = count_skill_tokens(workspace, skill_names)

    total_input = (
        task_tokens
        + file_token_total
        + history_tokens
        + skill_token_total
        + PLATFORM_OVERHEAD_TOKENS
    )

    output_tokens = int(total_input * output_factor)
    total_tokens = total_input + output_tokens
    ctx_pct = round((total_tokens / ctx_limit) * 100, 1)
    state, _ = context_state(ctx_pct)

    cost_in = (total_input / 1_000_000) * price_in
    cost_out = (output_tokens / 1_000_000) * price_out
    total_cost = cost_in + cost_out

    return CostEstimate(
        model=model,
        task_tokens=task_tokens,
        file_tokens=file_token_total,
        history_tokens=history_tokens,
        skill_tokens=skill_token_total,
        overhead_tokens=PLATFORM_OVERHEAD_TOKENS,
        total_input_tokens=total_input,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
        context_limit=ctx_limit,
        context_pct=ctx_pct,
        context_state=state,
        cost_input_usd=cost_in,
        cost_output_usd=cost_out,
        total_cost_usd=total_cost,
        files_analyzed=files,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Report rendering
# ─────────────────────────────────────────────────────────────────────────────

def render_estimate(est: CostEstimate, task_label: str = "") -> str:
    _, icon = context_state(est.context_pct)
    
    # Format State Label cleanly with ANSI colors
    if est.context_state == "OVERFLOW":
        state_str = colorize(f"⛔ OVERFLOW", COLOR_RED)
    elif est.context_state == "ALERT":
        state_str = colorize(f"🔴 ALERT", COLOR_RED)
    elif est.context_state == "WARN":
        state_str = colorize(f"🟠 WARN", COLOR_YELLOW)
    elif est.context_state == "MONITOR":
        state_str = colorize(f"🟡 MONITOR", COLOR_YELLOW)
    else:
        state_str = colorize(f"🟢 NOMINAL", COLOR_GREEN)

    border = colorize("═" * 56, COLOR_CYAN)

    lines = [
        "",
        colorize("💰 Token Cost Estimate", COLOR_CYAN + COLOR_BOLD),
        border,
        f"Task           : {task_label[:60] or '(no description)'}",
        f"Model          : {est.model}",
        f"Context limit  : {est.context_limit:>12,} tokens",
        border,
        "",
        "Input breakdown:",
        f"  Task description          : {est.task_tokens:>8,} tokens",
        f"  Files ({len(est.files_analyzed)} files){'':<16} : {est.file_tokens:>8,} tokens",
        f"  Conversation history      : {est.history_tokens:>8,} tokens",
        f"  Skills metadata           : {est.skill_tokens:>8,} tokens",
        f"  Platform overhead         : {est.overhead_tokens:>8,} tokens",
        "  " + "─" * 44,
        f"  Total input               : {est.total_input_tokens:>8,} tokens",
        "",
        f"Output estimate (factor {DEFAULT_OUTPUT_FACTOR}x input):",
        f"  Estimated output          : {est.output_tokens:>8,} tokens",
        "",
        f"Total estimate              : {est.total_tokens:>8,} tokens",
        f"Context usage               : {state_str} "
        f"({est.context_pct}% of {est.context_limit:,})",
        border,
        "",
        f"Cost estimate ({est.model}):",
        f"  Input  {est.total_input_tokens:>8,}t × "
        f"${model_pricing(est.model)[0]:.3f}/1M  = {format_usd(est.cost_input_usd)}",
        f"  Output {est.output_tokens:>8,}t × "
        f"${model_pricing(est.model)[1]:.2f}/1M  = {format_usd(est.cost_output_usd)}",
        "  " + "─" * 44,
        f"  Total estimated cost              = {colorize(format_usd(est.total_cost_usd), COLOR_GREEN + COLOR_BOLD)}",
        "",
        border,
        f"Assessment     : {state_str}",
    ]

    if est.context_state == "OVERFLOW":
        lines.append(
            colorize("Recommendation : ⛔ Task will exceed context limit. Run split command.", COLOR_RED)
        )
    elif est.context_state == "ALERT":
        lines.append(
            colorize("Recommendation : 🔴 Context is nearly full. Consider splitting the task.", COLOR_RED)
        )
    elif est.context_state == "WARN":
        lines.append(
            colorize("Recommendation : 🟠 Context is elevated. Monitor during execution.", COLOR_YELLOW)
        )
    else:
        lines.append(
            colorize("Recommendation : No action needed. Budget is healthy.", COLOR_GREEN)
        )

    if est.files_analyzed:
        top5 = sorted(est.files_analyzed, key=lambda f: f.tokens, reverse=True)[:5]
        lines += ["", "Top files by token count:"]
        for f in top5:
            rel = Path(f.path).name
            lines.append(f"  {f.tokens:>6,}t  {rel}")

    lines += [border, ""]
    return "\n".join(lines)


def render_comparison(
    estimates: list[tuple[str, CostEstimate]],
    task_label: str,
) -> str:
    border = colorize("═" * 56, COLOR_CYAN)
    lines = [
        "",
        colorize("💰 Model Cost Comparison", COLOR_CYAN + COLOR_BOLD),
        border,
        f"Task    : {task_label[:60] or '(no description)'}",
        border,
        "",
        f"{'Model':<22} {'Input':>8} {'Output':>8} {'Total $':>10}  {'Context%':>9}  State",
        "─" * 72,
    ]

    for model, est in estimates:
        if est.context_state == "OVERFLOW":
            state_str = colorize("⛔ OVERFLOW", COLOR_RED)
        elif est.context_state == "ALERT":
            state_str = colorize("🔴 ALERT", COLOR_RED)
        elif est.context_state == "WARN":
            state_str = colorize("🟠 WARN", COLOR_YELLOW)
        elif est.context_state == "MONITOR":
            state_str = colorize("🟡 MONITOR", COLOR_YELLOW)
        else:
            state_str = colorize("🟢 NOMINAL", COLOR_GREEN)

        lines.append(
            f"{model:<22} "
            f"{est.total_input_tokens:>7,}t "
            f"{est.output_tokens:>7,}t "
            f"{format_usd(est.total_cost_usd):>10}  "
            f"{est.context_pct:>8.1f}%  "
            f"{state_str}"
        )

    # Recommendations.
    sorted_by_cost = sorted(estimates, key=lambda x: x[1].total_cost_usd)
    sorted_by_fit = [
        (m, e) for m, e in sorted_by_cost
        if e.context_state not in {"OVERFLOW", "ALERT"}
    ]

    cheapest_model, cheapest = sorted_by_cost[0]
    lines += [
        "",
        border,
        f"Cheapest  : {colorize(cheapest_model, COLOR_GREEN)} ({colorize(format_usd(cheapest.total_cost_usd), COLOR_GREEN + COLOR_BOLD)})",
    ]

    if sorted_by_fit:
        best_model = sorted_by_fit[0][0]
        lines.append(f"Best fit  : {colorize(best_model, COLOR_CYAN)} (lowest cost that fits context)")

    lines += [border, ""]
    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# Task splitter
# ─────────────────────────────────────────────────────────────────────────────

def recommend_split(
    files: list[FileTokens],
    workspace: Path,
    model: str,
    task_text: str,
    max_tokens: int,
    skill_names: list[str],
    history_tokens: int,
) -> str:
    price_in, price_out, ctx_limit = model_pricing(model)
    effective_max = max_tokens or int(ctx_limit * 0.75)

    # Overhead that appears in every chunk.
    per_chunk_overhead = (
        PLATFORM_OVERHEAD_TOKENS
        + history_tokens
        + count_skill_tokens(workspace, skill_names)
        + text_to_tokens(task_text)
    )

    # Greedy bin-packing.
    chunks: list[list[FileTokens]] = []
    current_chunk: list[FileTokens] = []
    current_size = per_chunk_overhead

    for f in files:
        if current_size + f.tokens > effective_max:
            if current_chunk:
                chunks.append(current_chunk)
            current_chunk = [f]
            current_size = per_chunk_overhead + f.tokens
        else:
            current_chunk.append(f)
            current_size += f.tokens

    if current_chunk:
        chunks.append(current_chunk)

    if not chunks:
        return "No files to split."

    total_tokens = sum(f.tokens for f in files) + per_chunk_overhead * len(chunks)
    cost_per_chunk = (
        (effective_max / 1_000_000) * price_in
        + (int(effective_max * DEFAULT_OUTPUT_FACTOR) / 1_000_000) * price_out
    )
    total_cost = cost_per_chunk * len(chunks)

    border = colorize("═" * 56, COLOR_CYAN)
    lines = [
        "",
        colorize("💰 Task Split Recommendation", COLOR_CYAN + COLOR_BOLD),
        border,
        f"Total files     : {len(files)}",
        f"Total tokens    : {total_tokens:,}",
        f"Max per chunk   : {effective_max:,}",
        f"Chunks needed   : {len(chunks)}",
        border,
    ]

    for idx, chunk in enumerate(chunks, start=1):
        chunk_tokens = sum(f.tokens for f in chunk) + per_chunk_overhead
        suffix = " — last" if idx == len(chunks) else ""
        lines += [
            "",
            colorize(f"Chunk {idx} ({chunk_tokens:,} tokens){suffix}:", COLOR_BOLD),
        ]

        # Group by directory for readability.
        dirs: dict[str, int] = {}
        for f in chunk:
            d = str(Path(f.path).parent)
            dirs[d] = dirs.get(d, 0) + 1

        for d, count in list(dirs.items())[:8]:
            # Clean directory display
            lines.append(f"  {d}  — {count} file(s)")

    lines += [
        "",
        f"Estimated total cost ({model}):",
        f"  {len(chunks)} chunks × ~{format_usd(cost_per_chunk)} = {colorize('~' + format_usd(total_cost), COLOR_GREEN + COLOR_BOLD)}",
        "",
        border,
        "",
    ]

    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# Session log
# ─────────────────────────────────────────────────────────────────────────────

def log_estimate(workspace: Path, entry: dict[str, Any]) -> None:
    path = workspace / LOG_REL
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def load_session_entries(workspace: Path, days: int = 1) -> list[dict[str, Any]]:
    path = workspace / LOG_REL
    if not path.exists():
        return []

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    entries: list[dict[str, Any]] = []

    with path.open("r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                e = json.loads(line)
                ts_str = e.get("timestamp", "")
                try:
                    ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                    if ts >= cutoff:
                        entries.append(e)
                except ValueError:
                    entries.append(e)
            except json.JSONDecodeError:
                continue

    return entries


def render_session(workspace: Path, days: int = 1) -> tuple[str, int]:
    entries = load_session_entries(workspace, days)
    path = workspace / LOG_REL

    total_tokens = sum(e.get("total_tokens", 0) for e in entries)
    total_cost = sum(e.get("total_cost_usd", 0.0) for e in entries)

    most_expensive = max(
        entries,
        key=lambda e: e.get("total_cost_usd", 0),
        default=None,
    )

    period = "today" if days == 1 else f"last {days} days"
    border = colorize("═" * 56, COLOR_CYAN)

    lines = [
        "",
        colorize("💰 Session Token Accumulation", COLOR_CYAN + COLOR_BOLD),
        border,
        f"Period         : {period}",
        f"Log file       : {path}",
        f"Entries        : {len(entries)}",
        border,
    ]

    if not entries:
        lines += ["", "No entries found for this period.", border, ""]
        return "\n".join(lines), 0

    for e in entries:
        ts = e.get("timestamp", "")[:16].replace("T", "  ")
        task = e.get("task", "(no label)")[:30]
        tokens = e.get("total_tokens", 0)
        cost = e.get("total_cost_usd", 0.0)
        lines.append(
            f"  {ts}  {task:<30} {tokens:>8,}t  {format_usd(cost)}"
        )

    lines += [
        "",
        "  " + "─" * 54,
        f"  Total tokens {period:<20}: {total_tokens:>10,}",
        f"  Total cost   {period:<20}: {colorize(format_usd(total_cost), COLOR_GREEN + COLOR_BOLD)}",
    ]

    if most_expensive:
        lines.append(
            f"  Most expensive task          : "
            f"{colorize(most_expensive.get('task', '?')[:30], COLOR_YELLOW)}"
        )

    lines += [border, ""]
    return "\n".join(lines), 0


# ─────────────────────────────────────────────────────────────────────────────
# CLI command handlers
# ─────────────────────────────────────────────────────────────────────────────

def cmd_estimate(args: argparse.Namespace) -> int:
    workspace = Path(args.workspace).resolve()

    if args.stdin:
        task_text = sys.stdin.read()
    else:
        task_text = args.task or ""

    file_paths = [p.strip() for p in args.files.split(",") if p.strip()] if args.files else []
    skill_names = [s.strip() for s in args.skills.split(",") if s.strip()] if args.skills else []
    model = args.model or DEFAULT_MODEL
    history = args.history_tokens
    factor = args.output_factor

    est = estimate(
        task_text=task_text,
        file_paths=file_paths,
        skill_names=skill_names,
        model=model,
        workspace=workspace,
        history_tokens=history,
        output_factor=factor,
    )

    if args.json:
        print(json.dumps(asdict(est), indent=2, ensure_ascii=False))
    else:
        print(render_estimate(est, task_label=task_text[:80]))

    if not args.no_log:
        log_estimate(workspace, {
            "timestamp": utc_now(),
            "task": task_text[:80] or "(no description)",
            "model": model,
            "total_tokens": est.total_tokens,
            "total_cost_usd": est.total_cost_usd,
            "context_state": est.context_state,
        })

    if est.context_state == "OVERFLOW":
        return 2
    if est.context_state in {"WARN", "ALERT"}:
        return 1
    return 0


def cmd_compare(args: argparse.Namespace) -> int:
    workspace = Path(args.workspace).resolve()

    task_text = args.task or ""
    file_paths = [p.strip() for p in args.files.split(",") if p.strip()] if args.files else []
    skill_names = [s.strip() for s in args.skills.split(",") if s.strip()] if args.skills else []
    models = [m.strip() for m in args.models.split(",") if m.strip()]

    if not models:
        models = list(MODEL_PRICING.keys())

    estimates_list: list[tuple[str, CostEstimate]] = []
    for model in models:
        est = estimate(
            task_text=task_text,
            file_paths=file_paths,
            skill_names=skill_names,
            model=model,
            workspace=workspace,
        )
        estimates_list.append((model, est))

    if args.json:
        print(json.dumps(
            [{"model": m, **asdict(e)} for m, e in estimates_list],
            indent=2, ensure_ascii=False
        ))
    else:
        print(render_comparison(estimates_list, task_label=task_text[:60]))

    return 0


def cmd_split(args: argparse.Namespace) -> int:
    workspace = Path(args.workspace).resolve()

    task_text = args.task or ""
    file_paths = [p.strip() for p in args.files.split(",") if p.strip()] if args.files else []
    skill_names = [s.strip() for s in args.skills.split(",") if s.strip()] if args.skills else []
    model = args.model or DEFAULT_MODEL

    files = scan_files(file_paths, workspace)

    if not files:
        print("No files found to split.")
        return 0

    max_tokens = args.max_tokens or 0

    result = recommend_split(
        files=files,
        workspace=workspace,
        model=model,
        task_text=task_text,
        max_tokens=max_tokens,
        skill_names=skill_names,
        history_tokens=args.history_tokens,
    )

    print(result)
    return 0


def cmd_session(args: argparse.Namespace) -> int:
    workspace = Path(args.workspace).resolve()
    output, code = render_session(workspace, days=args.days)
    print(output)
    return code


def cmd_models(args: argparse.Namespace) -> int:
    if args.json:
        out = [
            {
                "model": name,
                "input_usd_per_1m": price_in,
                "output_usd_per_1m": price_out,
                "context_limit": ctx,
            }
            for name, (price_in, price_out, ctx) in MODEL_PRICING.items()
        ]
        print(json.dumps(out, indent=2, ensure_ascii=False))
        return 0

    border = colorize("═" * 68, COLOR_CYAN)
    print()
    print(colorize("💰 Supported Models", COLOR_CYAN + COLOR_BOLD))
    print(border)
    print(f"{'Model':<22} {'Input $/1M':>12} {'Output $/1M':>12} {'Context':>12}")
    print("─" * 68)
    for name, (price_in, price_out, ctx) in MODEL_PRICING.items():
        print(
            f"{name:<22} ${price_in:>10.3f} ${price_out:>10.3f} {ctx:>11,}"
        )
    print(border)
    print()
    return 0


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Token Cost Estimator")
    sub = parser.add_subparsers(dest="command", required=True)

    # estimate
    p = sub.add_parser("estimate", help="Estimate cost of one task")
    p.add_argument("--workspace", default=".")
    p.add_argument("--task", default="")
    p.add_argument("--files", default="")
    p.add_argument("--skills", default="")
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--history-tokens", type=int, default=DEFAULT_HISTORY_TOKENS)
    p.add_argument("--output-factor", type=float, default=DEFAULT_OUTPUT_FACTOR)
    p.add_argument("--stdin", action="store_true")
    p.add_argument("--no-log", action="store_true")
    p.add_argument("--json", action="store_true")
    p.set_defaults(func=cmd_estimate)

    # compare
    p = sub.add_parser("compare", help="Compare cost across models")
    p.add_argument("--workspace", default=".")
    p.add_argument("--task", default="")
    p.add_argument("--files", default="")
    p.add_argument("--skills", default="")
    p.add_argument("--models", default="")
    p.add_argument("--json", action="store_true")
    p.set_defaults(func=cmd_compare)

    # split
    p = sub.add_parser("split", help="Recommend task decomposition")
    p.add_argument("--workspace", default=".")
    p.add_argument("--task", default="")
    p.add_argument("--files", required=True)
    p.add_argument("--skills", default="")
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--max-tokens", type=int, default=0,
                   help="Token budget per chunk (default: 75%% of model context limit)")
    p.add_argument("--history-tokens", type=int, default=DEFAULT_HISTORY_TOKENS)
    p.set_defaults(func=cmd_split)

    # session
    p = sub.add_parser("session", help="Summarize accumulated cost")
    p.add_argument("--workspace", default=".")
    p.add_argument("--days", type=int, default=1)
    p.set_defaults(func=cmd_session)

    # models
    p = sub.add_parser("models", help="List supported models and pricing")
    p.add_argument("--json", action="store_true")
    p.set_defaults(func=cmd_models)

    args = parser.parse_args()

    try:
        sys.exit(args.func(args))
    except KeyboardInterrupt:
        print("token_cost_estimator interrupted", file=sys.stderr)
        sys.exit(3)
    except Exception as e:
        print(f"token_cost_estimator ⚠️ unexpected error: {e}", file=sys.stderr)
        sys.exit(3)


if __name__ == "__main__":
    main()
