#!/usr/bin/env python3
"""
resolve_conflict.py
Surgically applies a resolution to a specific conflict block in a file.
Replaces the entire block (from <<<<<<< to >>>>>>>) with the chosen content.

Exit codes:
  0 — Resolution applied successfully
  1 — Resolution failed (index not found)
  2 — Error
"""

import sys
import argparse
from pathlib import Path

# Sibling import for parser logic
sys.path.insert(0, str(Path(__file__).parent))
from parse_conflicts import parse_file, style, COLOR_GREEN, COLOR_RED, COLOR_YELLOW, COLOR_CYAN

def resolve_conflict(
    filepath: Path, 
    conflict_index: int, 
    strategy: str, 
    manual_resolution: str | None = None
) -> None:
    
    # 1. Parse current conflicts to find exact lines
    conflicts = parse_file(filepath)
    target = next((c for c in conflicts if c.index == conflict_index), None)
    
    if not target:
        raise ValueError(f"Conflict index {conflict_index} not found in {filepath.name}")
        
    # 2. Determine replacement text
    if strategy == "ours":
        replacement = target.ours_content
    elif strategy == "theirs":
        replacement = target.theirs_content
    elif strategy == "manual":
        if manual_resolution is None:
            raise ValueError("Strategy 'manual' requires manual_resolution text")
        replacement = manual_resolution
        if not replacement.endswith("\n"):
            replacement += "\n"
    else:
        raise ValueError(f"Unknown strategy: {strategy}")
        
    # 3. Read original lines
    lines = filepath.read_text(errors="replace").splitlines(keepends=True)
    
    # 4. Splice: Before block + Replacement + After block
    # Note: start_line and end_line are 1-based indices
    before = lines[:target.start_line - 1]
    after = lines[target.end_line:]
    
    resolved_lines = before + [replacement] + after
    
    # 5. Write back
    filepath.write_text("".join(resolved_lines))

def main():
    parser = argparse.ArgumentParser(description="Resolve a specific git conflict")
    parser.add_argument("--file", required=True, help="Path to conflicted file")
    parser.add_argument("--conflict-index", type=int, required=True, help="Conflict ID (e.g., 1)")
    parser.add_argument("--strategy", choices=["ours", "theirs", "manual"], required=True, help="Resolution strategy")
    parser.add_argument("--resolution-file", help="Path to file containing manual resolution text (required if strategy=manual)")
    
    args = parser.parse_args()

    filepath = Path(args.file)
    if not filepath.exists():
        print(style(f"Error: File not found: {filepath}", COLOR_RED), file=sys.stderr)
        sys.exit(2)

    manual_text = None
    if args.strategy == "manual":
        if not args.resolution_file:
            print(style("Error: --resolution-file is required when strategy is 'manual'", COLOR_RED), file=sys.stderr)
            sys.exit(2)
        res_file = Path(args.resolution_file)
        if not res_file.exists():
            print(style(f"Error: Resolution file not found: {res_file}", COLOR_RED), file=sys.stderr)
            sys.exit(2)
        manual_text = res_file.read_text(errors="replace")

    try:
        resolve_conflict(filepath, args.conflict_index, args.strategy, manual_text)
        print(style(f"✅ Conflict #{args.conflict_index} resolved using strategy: {args.strategy}", COLOR_GREEN))
        
        # Check if any conflicts remain
        remaining = parse_file(filepath)
        if remaining:
            print(style(f"⚠️  {len(remaining)} conflict(s) still remain in {filepath.name}.", COLOR_YELLOW))
        else:
            print(style(f"🎉 All conflicts in {filepath.name} have been resolved!", COLOR_GREEN))
            
        sys.exit(0)
    except ValueError as e:
        print(style(f"Error: {e}", COLOR_RED), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(style(f"Unexpected error: {e}", COLOR_RED), file=sys.stderr)
        sys.exit(2)

if __name__ == "__main__":
    main()
