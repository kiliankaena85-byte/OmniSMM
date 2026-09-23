#!/usr/bin/env python3
"""
sandbox_manager.py
Manages a temporary sandbox environment and logs intended agent actions 
during a Dry-Run test of a skill.

Commands:
  init       — Create a temp directory and initialize the log
  log-intent — Record a simulated action (e.g., terminal command, file edit)
  report     — Print the chronological execution trace
  teardown   — Delete the sandbox and logs

Exit codes:
  0 — Success
  1 — Warning
  2 — Error
"""

import sys
import json
import uuid
import tempfile
import shutil
import argparse
from pathlib import Path
from datetime import datetime, timezone
from dataclasses import dataclass, asdict

LOG_FILENAME = "dry_run_intents.jsonl"

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

@dataclass
class IntentLog:
    timestamp: str
    action_type: str
    payload: str
    reason: str

def get_log_path(sandbox_dir: Path) -> Path:
    return sandbox_dir / LOG_FILENAME

def cmd_init(args: argparse.Namespace) -> int:
    """Initialize a safe temporary sandbox directory."""
    sandbox_id = str(uuid.uuid4())[:8]
    sandbox_dir = Path(tempfile.gettempdir()) / f"antigravity-sandbox-{sandbox_id}"
    
    try:
        sandbox_dir.mkdir(parents=True, exist_ok=True)
        # Create empty log file
        get_log_path(sandbox_dir).touch()
        
        print(style(f"✅ Sandbox initialized successfully.", COLOR_GREEN))
        print(style(f"📁 Sandbox Directory: {sandbox_dir}", COLOR_BOLD + COLOR_CYAN))
        print(style(f"🎯 Target Skill     : {args.target_skill}", COLOR_BOLD))
        print(style("\n⚠️ STRICT CONSTRAINTS ACTIVE:", COLOR_YELLOW))
        print("1. All mock files must be created INSIDE this sandbox.")
        print("2. Do NOT execute mutating terminal commands in the real workspace.")
        print("3. Use 'log-intent' to record actions you *would* have taken.")
        return 0
    except Exception as e:
        print(style(f"Error creating sandbox: {e}", COLOR_RED), file=sys.stderr)
        return 2

def cmd_log_intent(args: argparse.Namespace) -> int:
    """Log an intended action instead of actually executing it."""
    sandbox_dir = Path(args.sandbox_dir)
    if not sandbox_dir.exists():
        print(style(f"Error: Sandbox directory {sandbox_dir} does not exist.", COLOR_RED), file=sys.stderr)
        return 2

    intent = IntentLog(
        timestamp=datetime.now(timezone.utc).isoformat(),
        action_type=args.action_type,
        payload=args.payload,
        reason=args.reason
    )

    try:
        with open(get_log_path(sandbox_dir), "a", encoding="utf-8") as f:
            f.write(json.dumps(asdict(intent)) + "\n")
        print(style(f"✅ Logged intent: [{args.action_type}]", COLOR_GREEN))
        return 0
    except Exception as e:
        print(style(f"Error logging intent: {e}", COLOR_RED), file=sys.stderr)
        return 2

def cmd_report(args: argparse.Namespace) -> int:
    """Generate a readable report of all simulated actions."""
    sandbox_dir = Path(args.sandbox_dir)
    log_path = get_log_path(sandbox_dir)
    
    if not log_path.exists():
        print(style(f"Error: No logs found in {sandbox_dir}", COLOR_RED), file=sys.stderr)
        return 2

    intents = []
    with open(log_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                intents.append(json.loads(line))

    print(style(f"\n🧪 DRY-RUN EXECUTION REPORT", COLOR_BOLD + COLOR_CYAN))
    print(style("═" * 70, COLOR_CYAN))
    print(f"Sandbox : {sandbox_dir}")
    print(f"Actions : {len(intents)} simulated events")
    print(style("═" * 70, COLOR_CYAN))
    
    if not intents:
        print(style("No actions were logged. The skill simulation was empty.", COLOR_YELLOW))
        return 0

    for idx, intent in enumerate(intents, 1):
        print(f"\n[{idx}] 🔄 {style(intent['action_type'], COLOR_BOLD + COLOR_GREEN)}")
        print(f"    Payload : {style(intent['payload'], COLOR_YELLOW)}")
        print(f"    Reason  : {intent['reason']}")
        
    print(style("\n═" * 70, COLOR_CYAN))
    return 0

def cmd_teardown(args: argparse.Namespace) -> int:
    """Destroy the sandbox directory and its contents."""
    sandbox_dir = Path(args.sandbox_dir)
    if not sandbox_dir.exists():
        print(style(f"Warning: Sandbox directory {sandbox_dir} already gone.", COLOR_YELLOW), file=sys.stderr)
        return 1

    try:
        shutil.rmtree(sandbox_dir)
        print(style(f"🧹 Teardown complete. Sandbox {sandbox_dir} destroyed.", COLOR_GREEN))
        return 0
    except Exception as e:
        print(style(f"Error removing sandbox: {e}", COLOR_RED), file=sys.stderr)
        return 2

def main():
    parser = argparse.ArgumentParser(description="Dry-Run Sandbox Manager")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # init
    p_init = subparsers.add_parser("init", help="Initialize the sandbox")
    p_init.add_argument("--target-skill", required=True, help="Name of skill being tested")

    # log-intent
    p_log = subparsers.add_parser("log-intent", help="Log an action instead of executing it")
    p_log.add_argument("--sandbox-dir", required=True, help="Path to active sandbox")
    p_log.add_argument("--action-type", choices=["TERMINAL_COMMAND", "FILE_MODIFICATION", "API_CALL", "OTHER"], required=True)
    p_log.add_argument("--payload", required=True, help="What the agent intended to run or write")
    p_log.add_argument("--reason", required=True, help="Why the agent intended to do this (e.g., referencing a step in SKILL.md)")

    # report
    p_report = subparsers.add_parser("report", help="Output chronological log of intents")
    p_report.add_argument("--sandbox-dir", required=True, help="Path to active sandbox")

    # teardown
    p_teardown = subparsers.add_parser("teardown", help="Destroy the sandbox")
    p_teardown.add_argument("--sandbox-dir", required=True, help="Path to active sandbox")

    args = parser.parse_args()

    try:
        if args.command == "init":
            sys.exit(cmd_init(args))
        elif args.command == "log-intent":
            sys.exit(cmd_log_intent(args))
        elif args.command == "report":
            sys.exit(cmd_report(args))
        elif args.command == "teardown":
            sys.exit(cmd_teardown(args))
    except Exception as e:
        print(style(f"sandbox_manager ⚠️ Unexpected error: {e}", COLOR_RED), file=sys.stderr)
        sys.exit(2)

if __name__ == "__main__":
    main()
