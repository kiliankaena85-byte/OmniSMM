#!/usr/bin/env python3
"""
version_manager.py
Core versioning engine for SKILL.md files.

Commands:
  status    — show current version state
  snapshot  — save a versioned snapshot before editing
  record    — record a change with a message after editing
  rollback  — restore a previous version
  list      — list all available snapshots
  diff      — show structured diff between two versions

Exit codes:
  0 — success
  1 — warning (e.g. no changes detected)
  2 — error (file not found, parse error, etc.)
"""

import re
import sys
import shutil
import difflib
import argparse
from pathlib import Path
from datetime import datetime
from dataclasses import dataclass, field

# Sibling import
sys.path.insert(0, str(Path(__file__).parent))
from changelog_generator import (
    append_changelog_entry,
    ChangelogEntry,
)


# ── Constants ─────────────────────────────────────────────────────────────────

VERSIONS_DIR   = ".versions"
SNAPSHOT_GLOB  = "v*.md"
DATE_FMT       = "%Y-%m-%d"
DATETIME_FMT   = "%Y-%m-%d %H:%M"


# ── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class VersionInfo:
    version:       str           # e.g. "1.2.3"
    major:         int
    minor:         int
    patch:         int
    skill_name:    str
    last_modified: str
    snapshots:     list[str] = field(default_factory=list)
    is_dirty:      bool = False  # working copy differs from last snapshot


@dataclass
class DiffSummary:
    from_version:    str
    to_version:      str
    lines_added:     int
    lines_removed:   int
    sections_changed: list[str] = field(default_factory=list)


# ── Frontmatter utilities ─────────────────────────────────────────────────────

def read_frontmatter(text: str) -> dict[str, str]:
    """Parse YAML frontmatter into a flat string dict."""
    result: dict[str, str] = {}
    in_fm = False
    current_key = None
    ml_lines: list[str] = []

    for line in text.splitlines():
        if line.strip() == "---":
            if not in_fm:
                in_fm = True
                continue
            else:
                if current_key and ml_lines:
                    result[current_key] = " ".join(ml_lines).strip()
                break

        if not in_fm:
            continue

        kv = re.match(r"^([a-z_]+):\s*(.*)", line)
        if kv:
            if current_key and ml_lines:
                result[current_key] = " ".join(ml_lines).strip()
                ml_lines = []
            current_key = kv.group(1)
            val = kv.group(2).strip()
            if val and val != "|":
                result[current_key] = val.strip("'\"")
                current_key = None
        elif current_key and (line.startswith("  ") or line.startswith("\t")):
            ml_lines.append(line.strip())

    return result


def update_frontmatter_field(text: str, key: str, value: str) -> str:
    """Replace a field in YAML frontmatter. Adds it if not present."""
    lines  = text.splitlines()
    in_fm  = False
    fm_end = -1
    found  = False
    result = []

    for i, line in enumerate(lines):
        if line.strip() == "---":
            if not in_fm:
                in_fm = True
                result.append(line)
                continue
            else:
                fm_end = i
                if not found:
                    result.append(f"{key}: {value}")
                result.append(line)
                in_fm = False
                continue

        if in_fm and re.match(rf"^{key}:", line):
            result.append(f"{key}: {value}")
            found = True
        else:
            result.append(line)

    return "\n".join(result)


# ── Version parsing ───────────────────────────────────────────────────────────

def parse_version(version_str: str) -> tuple[int, int, int]:
    """Parse 'X.Y.Z' into (major, minor, patch). Defaults to (0,1,0)."""
    m = re.match(r"^(\d+)\.(\d+)\.(\d+)$", version_str.strip())
    if not m:
        return (0, 1, 0)
    return int(m.group(1)), int(m.group(2)), int(m.group(3))


def bump_version(version_str: str, bump: str) -> str:
    """Bump version string by 'major', 'minor', or 'patch'."""
    major, minor, patch = parse_version(version_str)
    if bump == "major":
        return f"{major + 1}.0.0"
    elif bump == "minor":
        return f"{major}.{minor + 1}.0"
    else:  # patch
        return f"{major}.{minor}.{patch + 1}"


def version_tag(version_str: str) -> str:
    return f"v{version_str}"


# ── Snapshot utilities ────────────────────────────────────────────────────────

def versions_dir(skill_dir: Path) -> Path:
    return skill_dir / VERSIONS_DIR


def list_snapshots(skill_dir: Path) -> list[Path]:
    vd = versions_dir(skill_dir)
    if not vd.exists():
        return []
    return sorted(
        vd.glob(SNAPSHOT_GLOB),
        key=lambda p: p.stat().st_mtime
    )


def snapshot_filename(version_str: str, suffix: str = "") -> str:
    date = datetime.now().strftime(DATE_FMT)
    tag  = version_tag(version_str)
    return f"{tag}_{date}{suffix}.md"


def find_snapshot_by_version(skill_dir: Path, version_str: str) -> Path | None:
    tag = version_tag(version_str)
    for snap in list_snapshots(skill_dir):
        if snap.name.startswith(tag):
            return snap
    return None


def is_dirty(skill_dir: Path) -> bool:
    """Return True if SKILL.md differs from the most recent snapshot."""
    snaps = list_snapshots(skill_dir)
    if not snaps:
        return True
    current = (skill_dir / "SKILL.md").read_text(errors="replace")
    latest  = snaps[-1].read_text(errors="replace")
    return current.strip() != latest.strip()


# ── Diff engine ───────────────────────────────────────────────────────────────

def section_headings(text: str) -> list[str]:
    return [l.strip() for l in text.splitlines()
            if re.match(r"^#{1,4}\s+", l)]


def structured_diff(text_a: str, text_b: str,
                    ver_a: str, ver_b: str) -> DiffSummary:
    lines_a = text_a.splitlines()
    lines_b = text_b.splitlines()

    added   = sum(1 for l in difflib.unified_diff(lines_a, lines_b)
                  if l.startswith("+") and not l.startswith("+++"))
    removed = sum(1 for l in difflib.unified_diff(lines_a, lines_b)
                  if l.startswith("-") and not l.startswith("---"))

    heads_a = set(section_headings(text_a))
    heads_b = set(section_headings(text_b))

    changed_sections = []
    for h in heads_a & heads_b:
        if h not in heads_a or h not in heads_b:
            changed_sections.append(f"REMOVED: {h}")
        # crude: check if content under heading changed
        # (full section extraction would be more accurate)
    for h in heads_b - heads_a:
        changed_sections.append(f"ADDED section: {h}")
    for h in heads_a - heads_b:
        changed_sections.append(f"REMOVED section: {h}")

    return DiffSummary(
        from_version=ver_a,
        to_version=ver_b,
        lines_added=added,
        lines_removed=removed,
        sections_changed=changed_sections,
    )


def render_diff(diff: DiffSummary, skill_name: str) -> str:
    lines = [
        "",
        f"📝 Diff: {skill_name}  {diff.from_version} → {diff.to_version}",
        "═" * 56,
        f"Lines added     : +{diff.lines_added}",
        f"Lines removed   : -{diff.lines_removed}",
        f"Net change      : {diff.lines_added - diff.lines_removed:+d} lines",
    ]
    if diff.sections_changed:
        lines += ["", "Section changes:"]
        for s in diff.sections_changed:
            lines.append(f"  {s}")
    lines += ["═" * 56, ""]
    return "\n".join(lines)


# ── Commands ──────────────────────────────────────────────────────────────────

def cmd_status(skill_dir: Path) -> int:
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        print(f"Error: SKILL.md not found in {skill_dir}", file=sys.stderr)
        return 2

    text   = skill_md.read_text(errors="replace")
    fm     = read_frontmatter(text)
    ver    = fm.get("version", "0.1.0")
    name   = fm.get("name", skill_dir.name)
    snaps  = list_snapshots(skill_dir)
    dirty  = is_dirty(skill_dir)

    print(f"\n🔖 Skill Version Status")
    print("─" * 40)
    print(f"  Skill         : {name}")
    print(f"  Current ver   : v{ver}")
    print(f"  Snapshots     : {len(snaps)}")
    print(f"  Working copy  : {'⚠️  MODIFIED (unsnaphotted changes)' if dirty else '✅ Clean'}")

    if snaps:
        latest = snaps[-1]
        mtime  = datetime.fromtimestamp(
            latest.stat().st_mtime).strftime(DATETIME_FMT)
        print(f"  Last snapshot : {latest.name} ({mtime})")
    print()
    return 0


def cmd_snapshot(
    skill_dir: Path,
    bump:      str,
    message:   str,
    git_commit: bool = False,
) -> int:
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        print(f"Error: SKILL.md not found in {skill_dir}", file=sys.stderr)
        return 2

    text = skill_md.read_text(errors="replace")
    fm   = read_frontmatter(text)
    old_ver = fm.get("version", "0.1.0")
    new_ver = bump_version(old_ver, bump)
    name    = fm.get("name", skill_dir.name)

    # Ensure .versions dir exists
    vd = versions_dir(skill_dir)
    vd.mkdir(exist_ok=True)

    # Check for collision
    snap_name = snapshot_filename(new_ver)
    snap_path = vd / snap_name
    if snap_path.exists():
        snap_name = snapshot_filename(new_ver, suffix="-b")
        snap_path = vd / snap_name
        print(f"⚠️  Version {new_ver} snapshot already exists — "
              f"saving as {snap_name}")

    # Save snapshot of CURRENT content (before bump)
    shutil.copy2(skill_md, snap_path)

    # Update version in frontmatter
    new_text = update_frontmatter_field(text, "version", new_ver)
    skill_md.write_text(new_text)

    # Write changelog entry
    entry = ChangelogEntry(
        version=new_ver,
        date=datetime.now().strftime(DATE_FMT),
        message=message,
        bump_type=bump,
        snapshot_file=snap_name,
    )
    append_changelog_entry(vd / "CHANGELOG.md", name, entry)

    print(f"✅ Snapshot saved: {snap_path.name}")
    print(f"   Version bumped: v{old_ver} → v{new_ver}")
    print(f"   Message       : {message}")

    # Optional git commit
    if git_commit:
        _try_git_commit(
            skill_dir,
            f"skill({name}): bump to v{new_ver}\n\n{message}\n\n"
            f"Versioned by: skill-versioning"
        )

    return 0


def cmd_record(
    skill_dir: Path,
    message:   str,
    author:    str = "agent",
) -> int:
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        print(f"Error: SKILL.md not found in {skill_dir}", file=sys.stderr)
        return 2

    text  = skill_md.read_text(errors="replace")
    fm    = read_frontmatter(text)
    ver   = fm.get("version", "0.1.0")
    name  = fm.get("name", skill_dir.name)
    snaps = list_snapshots(skill_dir)

    vd = versions_dir(skill_dir)
    vd.mkdir(exist_ok=True)

    # Diff against last snapshot
    diff_summary = None
    if snaps:
        prev_text    = snaps[-1].read_text(errors="replace")
        prev_fm      = read_frontmatter(prev_text)
        prev_ver     = prev_fm.get("version", "?")
        diff_summary = structured_diff(prev_text, text, prev_ver, ver)

    entry = ChangelogEntry(
        version=ver,
        date=datetime.now().strftime(DATE_FMT),
        message=message,
        author=author,
        lines_added=diff_summary.lines_added if diff_summary else 0,
        lines_removed=diff_summary.lines_removed if diff_summary else 0,
    )
    append_changelog_entry(vd / "CHANGELOG.md", name, entry,
                           mode="record")

    print(f"✅ Change recorded for {name} v{ver}")
    print(f"   Author : {author}")
    print(f"   Message: {message}")
    if diff_summary:
        print(render_diff(diff_summary, name))

    return 0


def cmd_rollback(skill_dir: Path, to_version: str) -> int:
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        print(f"Error: SKILL.md not found in {skill_dir}", file=sys.stderr)
        return 2

    snap = find_snapshot_by_version(skill_dir, to_version)
    if not snap:
        print(f"Error: No snapshot found for version {to_version}",
              file=sys.stderr)
        print("Available versions:")
        for s in list_snapshots(skill_dir):
            print(f"  {s.name}")
        return 2

    # Snapshot the current (broken) state first
    text   = skill_md.read_text(errors="replace")
    fm     = read_frontmatter(text)
    cur_ver = fm.get("version", "0.0.0")
    name    = fm.get("name", skill_dir.name)

    vd = versions_dir(skill_dir)
    pre_rb_name = snapshot_filename(cur_ver, suffix="-pre-rollback")
    shutil.copy2(skill_md, vd / pre_rb_name)
    print(f"📦 Pre-rollback snapshot saved: {pre_rb_name}")

    # Restore target version
    restored_text = snap.read_text(errors="replace")
    skill_md.write_text(restored_text)

    entry = ChangelogEntry(
        version=to_version,
        date=datetime.now().strftime(DATE_FMT),
        message=f"ROLLBACK from v{cur_ver} to {to_version}",
        bump_type="rollback",
        snapshot_file=snap.name,
    )
    append_changelog_entry(vd / "CHANGELOG.md", name, entry,
                           mode="rollback")

    print(f"✅ Rolled back: v{cur_ver} → {to_version}")
    print(f"   Source     : {snap.name}")
    print(f"   SKILL.md   : restored")
    return 0


def cmd_list(skill_dir: Path) -> int:
    snaps = list_snapshots(skill_dir)
    if not snaps:
        print("No snapshots found.")
        return 1

    print(f"\n🔖 Snapshots for {skill_dir.name}:")
    print("─" * 48)
    for i, snap in enumerate(reversed(snaps)):
        mtime = datetime.fromtimestamp(
            snap.stat().st_mtime).strftime(DATETIME_FMT)
        marker = " ← latest" if i == 0 else ""
        print(f"  {snap.name:<40} {mtime}{marker}")
    print()
    return 0


def cmd_diff(skill_dir: Path, from_ver: str, to_ver: str) -> int:
    snap_a = find_snapshot_by_version(skill_dir, from_ver)
    snap_b = find_snapshot_by_version(skill_dir, to_ver) \
        if to_ver != "current" else skill_dir / "SKILL.md"

    if not snap_a:
        print(f"Error: snapshot not found for {from_ver}", file=sys.stderr)
        return 2
    if not snap_b or not snap_b.exists():
        print(f"Error: snapshot not found for {to_ver}", file=sys.stderr)
        return 2

    text_a = snap_a.read_text(errors="replace")
    text_b = snap_b.read_text(errors="replace")
    fm_a   = read_frontmatter(text_a)
    name   = fm_a.get("name", skill_dir.name)

    diff = structured_diff(text_a, text_b, from_ver, to_ver)
    print(render_diff(diff, name))
    return 0


# ── Git helper ────────────────────────────────────────────────────────────────

def _try_git_commit(skill_dir: Path, message: str) -> None:
    import subprocess
    try:
        subprocess.run(
            ["git", "add", str(skill_dir)],
            check=True, capture_output=True
        )
        subprocess.run(
            ["git", "commit", "-m", message],
            check=True, capture_output=True
        )
        print("✅ Git commit created.")
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        print(f"⚠️  Git commit skipped: {e}", file=sys.stderr)


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Skill Version Manager")
    sub    = parser.add_subparsers(dest="command", required=True)

    # status
    p_status = sub.add_parser("status", help="Show current version state")
    p_status.add_argument("--skill-dir", required=True)

    # snapshot
    p_snap = sub.add_parser("snapshot",
                             help="Save versioned snapshot before editing")
    p_snap.add_argument("--skill-dir",  required=True)
    p_snap.add_argument("--bump",       choices=["patch", "minor", "major"],
                        default="patch")
    p_snap.add_argument("--message",    required=True)
    p_snap.add_argument("--git-commit", action="store_true")

    # record
    p_rec = sub.add_parser("record",
                            help="Record a change message after editing")
    p_rec.add_argument("--skill-dir", required=True)
    p_rec.add_argument("--message",   required=True)
    p_rec.add_argument("--author",    default="agent")

    # rollback
    p_rb = sub.add_parser("rollback", help="Restore a previous version")
    p_rb.add_argument("--skill-dir", required=True)
    p_rb.add_argument("--to",        required=True,
                      help="Version to restore (e.g. v1.1.0)")

    # list
    p_list = sub.add_parser("list", help="List available snapshots")
    p_list.add_argument("--skill-dir", required=True)

    # diff
    p_diff = sub.add_parser("diff",
                             help="Structured diff between two versions")
    p_diff.add_argument("--skill-dir", required=True)
    p_diff.add_argument("--from",      dest="from_ver", required=True)
    p_diff.add_argument("--to",        dest="to_ver",   default="current")

    args = parser.parse_args()

    try:
        skill_dir = Path(args.skill_dir)

        if args.command == "status":
            sys.exit(cmd_status(skill_dir))

        elif args.command == "snapshot":
            sys.exit(cmd_snapshot(
                skill_dir, args.bump, args.message, args.git_commit
            ))

        elif args.command == "record":
            sys.exit(cmd_record(skill_dir, args.message, args.author))

        elif args.command == "rollback":
            sys.exit(cmd_rollback(skill_dir, args.to))

        elif args.command == "list":
            sys.exit(cmd_list(skill_dir))

        elif args.command == "diff":
            sys.exit(cmd_diff(skill_dir, args.from_ver, args.to_ver))

    except Exception as e:
        print(f"version_manager ⚠️  Unexpected error: {e}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
