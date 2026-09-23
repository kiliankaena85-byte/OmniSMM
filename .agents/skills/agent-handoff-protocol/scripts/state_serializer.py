#!/usr/bin/env python3
"""
state_serializer.py
Serializes current agent workspace state into a portable snapshot.
Used primarily for emergency handoffs when context budget is exhausted.

Exit codes:
  0 — Snapshot created successfully
  1 — Partial snapshot (some files unreadable)
  2 — Error
"""

import os
import sys
import json
import hashlib
import argparse
from pathlib import Path
from datetime import datetime, timezone
from dataclasses import dataclass, field, asdict


# ── Config ────────────────────────────────────────────────────────────────────

# File extensions considered as "source artifacts"
SOURCE_EXTENSIONS = {
    ".py", ".ts", ".js", ".go", ".rs", ".java", ".kt",
    ".tf", ".yaml", ".yml", ".json", ".toml", ".sh",
    ".md", ".sql", ".html", ".css", ".env.example",
}

# Directories to always skip
SKIP_DIRS = {
    ".git", "node_modules", "__pycache__", ".venv", "venv",
    "dist", "build", ".next", ".nuxt", "coverage",
    ".agent",       # skip skill directories themselves
}

MAX_FILE_SIZE_BYTES = 500_000   # 500KB — skip giant files
MAX_FILES_PER_SNAPSHOT = 200    # cap to avoid huge snapshots


# ── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class ArtifactSnapshot:
    path:      str
    checksum:  str
    size:      int
    modified:  str
    readable:  bool = True


@dataclass
class WorkspaceSnapshot:
    task_id:         str
    captured_at:     str
    working_dir:     str
    git_branch:      str | None
    git_commit:      str | None
    git_dirty_files: list[str]
    artifacts:       list[ArtifactSnapshot] = field(default_factory=list)
    env_vars_present: list[str]             = field(default_factory=list)
    notes:           str = ""


# ── Utilities ─────────────────────────────────────────────────────────────────

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    try:
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return f"sha256:{h.hexdigest()[:16]}"
    except OSError:
        return "sha256:unreadable"


def get_git_info(workspace: Path) -> tuple[str | None, str | None, list[str]]:
    """Return (branch, commit_hash, dirty_files)."""
    import subprocess

    def run(cmd: list[str]) -> str:
        try:
            result = subprocess.run(
                cmd, cwd=workspace,
                capture_output=True, text=True, timeout=5
            )
            return result.stdout.strip()
        except Exception:
            return ""

    branch      = run(["git", "rev-parse", "--abbrev-ref", "HEAD"]) or None
    commit      = run(["git", "rev-parse", "--short", "HEAD"])       or None
    dirty_raw   = run(["git", "status", "--porcelain"])
    dirty_files = [
        line[3:].strip()
        for line in dirty_raw.splitlines()
        if line.strip()
    ]
    return branch, commit, dirty_files


def relevant_env_vars() -> list[str]:
    """Return names (not values) of env vars that are likely relevant."""
    sensitive_patterns = [
        "KEY", "TOKEN", "SECRET", "PASSWORD", "PASS",
        "CREDENTIAL", "AUTH", "API", "DB", "DATABASE",
        "HOST", "PORT", "URL", "DSN",
    ]
    present = []
    for key in os.environ:
        ku = key.upper()
        if any(pat in ku for pat in sensitive_patterns):
            present.append(key)   # names only, never values
    return sorted(present)


# ── Core snapshot ─────────────────────────────────────────────────────────────

def snapshot_workspace(
    task_id:   str,
    workspace: Path,
    notes:     str = "",
) -> WorkspaceSnapshot:

    branch, commit, dirty = get_git_info(workspace)

    snap = WorkspaceSnapshot(
        task_id=task_id,
        captured_at=datetime.now(timezone.utc).isoformat(),
        working_dir=str(workspace),
        git_branch=branch,
        git_commit=commit,
        git_dirty_files=dirty,
        env_vars_present=relevant_env_vars(),
        notes=notes,
    )

    file_count = 0
    for root, dirs, files in os.walk(workspace):
        # Prune skip dirs in-place
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS
                   and not d.startswith(".")]

        for fname in files:
            if file_count >= MAX_FILES_PER_SNAPSHOT:
                break
            fpath = Path(root) / fname
            if fpath.suffix.lower() not in SOURCE_EXTENSIONS:
                continue
            try:
                size = fpath.stat().st_size
            except OSError:
                continue
            if size > MAX_FILE_SIZE_BYTES:
                continue

            rel_path = str(fpath.relative_to(workspace))
            mtime    = datetime.fromtimestamp(
                fpath.stat().st_mtime, tz=timezone.utc
            ).isoformat()

            snap.artifacts.append(ArtifactSnapshot(
                path=rel_path,
                checksum=sha256_file(fpath),
                size=size,
                modified=mtime,
                readable=True,
            ))
            file_count += 1

    return snap


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Agent State Serializer")
    sub    = parser.add_subparsers(dest="command", required=True)

    p_snap = sub.add_parser("snapshot",
                             help="Capture current workspace state")
    p_snap.add_argument("--task-id",    required=True)
    p_snap.add_argument("--workspace",  default=".",
                        help="Workspace root (default: current dir)")
    p_snap.add_argument("--output-dir", required=True)
    p_snap.add_argument("--notes",      default="")
    p_snap.add_argument("--json",       action="store_true")
    args = parser.parse_args()

    try:
        workspace  = Path(args.workspace).resolve()
        output_dir = Path(args.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        snap = snapshot_workspace(args.task_id, workspace, args.notes)

        ts        = datetime.now().strftime("%Y%m%d_%H%M%S")
        snap_file = output_dir / f"snapshot_{args.task_id}_{ts}.json"
        snap_file.write_text(
            json.dumps(asdict(snap), indent=2)
        )

        if args.json:
            print(json.dumps(asdict(snap), indent=2))
        else:
            print(f"\n📦 Workspace Snapshot")
            print("─" * 48)
            print(f"  Task ID      : {snap.task_id}")
            print(f"  Captured at  : {snap.captured_at}")
            print(f"  Git branch   : {snap.git_branch or 'n/a'}")
            print(f"  Git commit   : {snap.git_commit or 'n/a'}")
            print(f"  Dirty files  : {len(snap.git_dirty_files)}")
            print(f"  Artifacts    : {len(snap.artifacts)} files")
            print(f"  Env vars     : {len(snap.env_vars_present)} relevant vars present")
            print(f"  Saved to     : {snap_file}")
            print()

        sys.exit(0)

    except Exception as e:
        print(f"state_serializer ⚠️  Error: {e}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
