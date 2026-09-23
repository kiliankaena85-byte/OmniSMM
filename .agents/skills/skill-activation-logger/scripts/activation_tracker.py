#!/usr/bin/env python3
"""
activation_tracker.py
Records and queries agent skill activations. Uses a robust JSONL format
for easy appending and parsing.

Commands:
  record   — Log a new skill activation intent
  error    — Log a skill failure
  history  — View recent activations
  stats    — View aggregation statistics

Exit codes:
  0 — Success
  2 — Error
"""

import sys
import json
import argparse
from pathlib import Path
from datetime import datetime, timezone
from collections import Counter
from dataclasses import dataclass, asdict

# ── Config ────────────────────────────────────────────────────────────────────

# Logs are stored at the workspace level, not inside the specific skill folder,
# so they persist across skill updates and can be globally queried.
LOG_DIR_NAME = ".agent/logs"
LOG_FILE_NAME = "skill_activations.jsonl"


# ── ANSI Terminal Styling ─────────────────────────────────────────────────────

COLOR_GREEN = "\033[92m"
COLOR_RED = "\033[91m"
COLOR_YELLOW = "\033[93m"
COLOR_CYAN = "\033[96m"
COLOR_BOLD = "\033[1m"
COLOR_RESET = "\033[0m"

def supports_color() -> bool:
    """Returns True if the terminal supports ANSI colors."""
    # Check if stdout is a tty, standard checks
    import os
    if os.name == "nt":
        # Windows supports color in modern terminals, especially under PowerShell/CMD
        # when initialized, but we can default to True for premium styling
        return True
    return sys.stdout.isatty()

def style(text: str, color_code: str) -> str:
    if supports_color():
        return f"{color_code}{text}{COLOR_RESET}"
    return text


# ── Data Classes ──────────────────────────────────────────────────────────────

@dataclass
class ActivationRecord:
    timestamp: str
    event_type: str  # "ACTIVATION", "ERROR"
    skill: str
    reason: str = ""
    trigger: str = ""
    error_msg: str = ""

def get_log_file() -> Path:
    """Finds or creates the workspace log file."""
    workspace_root = Path.cwd()
    for parent in Path(__file__).resolve().parents:
        if (parent / ".agent").exists():
            workspace_root = parent
            break
            
    log_dir = workspace_root / LOG_DIR_NAME
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir / LOG_FILE_NAME

def append_record(record: ActivationRecord) -> None:
    log_file = get_log_file()
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(asdict(record)) + "\n")

def read_records() -> list[ActivationRecord]:
    log_file = get_log_file()
    if not log_file.exists():
        return []
    
    records = []
    with open(log_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                # Safeguard: handle missing fields by providing default values
                records.append(ActivationRecord(
                    timestamp=data.get("timestamp", ""),
                    event_type=data.get("event_type", ""),
                    skill=data.get("skill", ""),
                    reason=data.get("reason", ""),
                    trigger=data.get("trigger", ""),
                    error_msg=data.get("error_msg", "")
                ))
            except json.JSONDecodeError:
                continue
    return records

# ── Commands ──────────────────────────────────────────────────────────────────

def cmd_record(args: argparse.Namespace) -> int:
    record = ActivationRecord(
        timestamp=datetime.now(timezone.utc).isoformat(),
        event_type="ACTIVATION",
        skill=args.skill,
        reason=args.reason,
        trigger=args.trigger
    )
    append_record(record)
    print(style(f"✅ Logged activation of '{args.skill}'.", COLOR_GREEN))
    return 0

def cmd_error(args: argparse.Namespace) -> int:
    record = ActivationRecord(
        timestamp=datetime.now(timezone.utc).isoformat(),
        event_type="ERROR",
        skill=args.skill,
        error_msg=args.error_msg
    )
    append_record(record)
    print(style(f"⚠️ Logged error for '{args.skill}'.", COLOR_YELLOW))
    return 0

def cmd_history(args: argparse.Namespace) -> int:
    records = read_records()
    if not records:
        print("No activation history found.")
        return 0
        
    records = records[-args.limit:]  # Get the last N records
    
    print(style(f"\n📜 Recent Skill Activations (Last {len(records)})", COLOR_BOLD + COLOR_CYAN))
    print(style("═" * 70, COLOR_CYAN))
    for r in records:
        time_str = r.timestamp[:19].replace("T", " ")
        if r.event_type == "ACTIVATION":
            print(f"[{time_str}] {style('🟢 ACTIVATED', COLOR_GREEN)}: {style(r.skill, COLOR_BOLD)}")
            print(f"    Trigger : {r.trigger}")
            print(f"    Reason  : {r.reason}")
        elif r.event_type == "ERROR":
            print(f"[{time_str}] {style('🔴 ERROR', COLOR_RED)}: {style(r.skill, COLOR_BOLD)}")
            print(f"    Message : {style(r.error_msg, COLOR_YELLOW)}")
        print(style("─" * 70, COLOR_CYAN))
    return 0

def cmd_stats(args: argparse.Namespace) -> int:
    records = read_records()
    if not records:
        print("No activation history found to generate stats.")
        return 0

    activations = Counter([r.skill for r in records if r.event_type == "ACTIVATION"])
    errors = Counter([r.skill for r in records if r.event_type == "ERROR"])
    
    print(style("\n📊 Skill Usage Statistics", COLOR_BOLD + COLOR_CYAN))
    print(style("═" * 58, COLOR_CYAN))
    print(style(f"{'Skill Name':<30} | {'Activations':<11} | {'Errors'}", COLOR_BOLD))
    print(style("─" * 58, COLOR_CYAN))
    
    # Sort by most activated
    all_skills = sorted(list(set(activations.keys()) | set(errors.keys())), key=lambda s: activations.get(s, 0), reverse=True)
    for skill in all_skills:
        act_count = activations.get(skill, 0)
        err_count = errors.get(skill, 0)
        
        # Colorize error count if > 0
        err_str = style(str(err_count), COLOR_RED) if err_count > 0 else str(err_count)
        act_str = style(str(act_count), COLOR_GREEN) if act_count > 0 else str(act_count)
        
        print(f"{style(skill, COLOR_BOLD):<39} | {act_str:<20} | {err_str}")
        
    print(style("═" * 58, COLOR_CYAN))
    return 0

# ── CLI Entrypoint ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Agent Skill Activation Logger")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # record
    p_record = subparsers.add_parser("record", help="Record a skill activation")
    p_record.add_argument("--skill", required=True, help="Name of the skill")
    p_record.add_argument("--reason", required=True, help="Why was it activated?")
    p_record.add_argument("--trigger", default="Implicit context", help="What user text triggered it?")

    # error
    p_error = subparsers.add_parser("error", help="Record a skill failure")
    p_error.add_argument("--skill", required=True, help="Name of the skill")
    p_error.add_argument("--error-msg", required=True, help="Error description")

    # history
    p_history = subparsers.add_parser("history", help="View recent activations")
    p_history.add_argument("--limit", type=int, default=10, help="Number of records to show")

    # stats
    subparsers.add_parser("stats", help="View aggregate usage statistics")

    args = parser.parse_args()

    try:
        if args.command == "record":
            sys.exit(cmd_record(args))
        elif args.command == "error":
            sys.exit(cmd_error(args))
        elif args.command == "history":
            sys.exit(cmd_history(args))
        elif args.command == "stats":
            sys.exit(cmd_stats(args))
    except Exception as e:
        print(f"skill-activation-logger ⚠️ Unexpected error: {e}", file=sys.stderr)
        sys.exit(2)

if __name__ == "__main__":
    main()
