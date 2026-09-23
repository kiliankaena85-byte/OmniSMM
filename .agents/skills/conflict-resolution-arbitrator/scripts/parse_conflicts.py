#!/usr/bin/env python3
"""
parse_conflicts.py
Extracts standard Git conflict markers from a file into a structured summary.
Supports both standard and diff3 conflict styles.

Exit codes:
  0 — Conflicts found and parsed successfully
  1 — No conflicts found
  2 — Error (file not found, malformed markers)
"""

import sys
import re
import json
import argparse
from pathlib import Path
from dataclasses import dataclass, asdict

# Regex for standard git conflict markers
MARKER_OURS   = re.compile(r"^<<<<<<< (.*)$")
MARKER_BASE   = re.compile(r"^\|\|\|\|\|\|\| (.*)$")
MARKER_SEP    = re.compile(r"^=======$")
MARKER_THEIRS = re.compile(r"^>>>>>>> (.*)$")

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
class ConflictBlock:
    index: int
    start_line: int
    end_line: int
    ours_name: str
    theirs_name: str
    ours_content: str
    base_content: str | None
    theirs_content: str

def parse_file(filepath: Path) -> list[ConflictBlock]:
    lines = filepath.read_text(errors="replace").splitlines(keepends=True)
    
    conflicts = []
    in_conflict = False
    state = "NONE" # NONE -> OURS -> BASE (optional) -> THEIRS
    
    current_conflict = {}
    
    for i, line in enumerate(lines, start=1):
        m_ours = MARKER_OURS.match(line.strip())
        m_base = MARKER_BASE.match(line.strip())
        m_sep  = MARKER_SEP.match(line.strip())
        m_theirs = MARKER_THEIRS.match(line.strip())
        
        if m_ours:
            if in_conflict:
                raise ValueError(f"Malformed conflict at line {i}: Nested <<<<<<<")
            in_conflict = True
            state = "OURS"
            current_conflict = {
                "index": len(conflicts) + 1,
                "start_line": i,
                "ours_name": m_ours.group(1).strip(),
                "theirs_name": "",
                "ours_content": [],
                "base_content": None,
                "theirs_content": []
            }
        elif m_base:
            if not in_conflict or state != "OURS":
                raise ValueError(f"Malformed conflict at line {i}: Unexpected |||||||")
            state = "BASE"
            current_conflict["base_content"] = []
        elif m_sep:
            if not in_conflict or state not in ["OURS", "BASE"]:
                raise ValueError(f"Malformed conflict at line {i}: Unexpected =======")
            state = "THEIRS"
        elif m_theirs:
            if not in_conflict or state != "THEIRS":
                raise ValueError(f"Malformed conflict at line {i}: Unexpected >>>>>>>")
            current_conflict["end_line"] = i
            current_conflict["theirs_name"] = m_theirs.group(1).strip()
            
            # Join contents
            cb = ConflictBlock(
                index=current_conflict["index"],
                start_line=current_conflict["start_line"],
                end_line=current_conflict["end_line"],
                ours_name=current_conflict["ours_name"],
                theirs_name=current_conflict["theirs_name"],
                ours_content="".join(current_conflict["ours_content"]),
                base_content="".join(current_conflict["base_content"]) if current_conflict["base_content"] is not None else None,
                theirs_content="".join(current_conflict["theirs_content"])
            )
            conflicts.append(cb)
            
            in_conflict = False
            state = "NONE"
            current_conflict = {}
        else:
            if in_conflict:
                if state == "OURS":
                    current_conflict["ours_content"].append(line)
                elif state == "BASE":
                    current_conflict["base_content"].append(line)
                elif state == "THEIRS":
                    current_conflict["theirs_content"].append(line)
                    
    if in_conflict:
        raise ValueError(f"Malformed conflict: Missing >>>>>>> before EOF")
        
    return conflicts

def render_human_readable(conflicts: list[ConflictBlock], filepath: str) -> str:
    lines = [
        style(f"⚔️  Conflict Report: {filepath}", COLOR_BOLD + COLOR_CYAN),
        style(f"Found {len(conflicts)} conflict(s).", COLOR_BOLD),
        style("═" * 70, COLOR_CYAN)
    ]
    
    for c in conflicts:
        lines += [
            style(f"🔴 CONFLICT #{c.index} (Lines {c.start_line} - {c.end_line})", COLOR_BOLD + COLOR_RED),
            style(f"── [OURS] ({c.ours_name}) ".ljust(70, "─"), COLOR_GREEN),
            c.ours_content.rstrip("\n") if c.ours_content else "(empty)",
        ]
        if c.base_content is not None:
            lines += [
                style(f"── [BASE] (Original ancestor) ".ljust(70, "─"), COLOR_YELLOW),
                c.base_content.rstrip("\n") if c.base_content else "(empty)",
            ]
        lines += [
            style(f"── [THEIRS] ({c.theirs_name}) ".ljust(70, "─"), COLOR_CYAN),
            c.theirs_content.rstrip("\n") if c.theirs_content else "(empty)",
            style("═" * 70, COLOR_CYAN)
        ]
        
    lines.append(style("\n👉 Use resolve_conflict.py to surgically resolve each block.", COLOR_BOLD + COLOR_GREEN))
    return "\n".join(lines)

def main():
    parser = argparse.ArgumentParser(description="Parse git conflict markers")
    parser.add_argument("--file", required=True, help="Path to conflicted file")
    parser.add_argument("--json", action="store_true", help="Output JSON")
    args = parser.parse_args()

    filepath = Path(args.file)
    if not filepath.exists():
        print(style(f"Error: File not found: {filepath}", COLOR_RED), file=sys.stderr)
        sys.exit(2)

    try:
        conflicts = parse_file(filepath)
    except ValueError as e:
        print(style(f"Error: {e}", COLOR_RED), file=sys.stderr)
        sys.exit(2)

    if not conflicts:
        if not args.json:
            print(style(f"✅ No conflicts found in {filepath.name}", COLOR_GREEN))
        else:
            print("[]")
        sys.exit(1)

    if args.json:
        print(json.dumps([asdict(c) for c in conflicts], indent=2))
    else:
        print(render_human_readable(conflicts, filepath.name))
        
    sys.exit(0)

if __name__ == "__main__":
    main()
