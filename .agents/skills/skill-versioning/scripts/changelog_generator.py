#!/usr/bin/env python3
"""
changelog_generator.py
Generates and maintains CHANGELOG.md for a versioned skill.
Follows Keep a Changelog conventions.
"""

from __future__ import annotations

import re
from pathlib import Path
from dataclasses import dataclass, field


# ── Data class ────────────────────────────────────────────────────────────────

@dataclass
class ChangelogEntry:
    version:       str
    date:          str
    message:       str
    bump_type:     str = "patch"      # patch | minor | major | rollback
    author:        str = "agent"
    snapshot_file: str = ""
    lines_added:   int = 0
    lines_removed: int = 0
    tags:          list[str] = field(default_factory=list)


# ── Changelog header ──────────────────────────────────────────────────────────

HEADER_TEMPLATE = """\
# Changelog — {skill_name}

All notable changes to this skill are documented here.
Versioning: [Semantic Versioning](https://semver.org/).
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

"""


# ── Entry renderer ────────────────────────────────────────────────────────────

BUMP_SECTION = {
    "major":    "⚠️ BREAKING CHANGE",
    "minor":    "Added / Changed",
    "patch":    "Fixed / Minor",
    "rollback": "🔙 Rollback",
}


def render_entry(entry: ChangelogEntry, mode: str = "snapshot") -> str:
    """Render a single changelog entry block."""
    section_label = BUMP_SECTION.get(entry.bump_type, "Changed")
    breaking      = "  ⚠️ BREAKING CHANGE\n" if entry.bump_type == "major" else ""

    diff_line = ""
    if entry.lines_added or entry.lines_removed:
        diff_line = (
            f"\n**Diff:** +{entry.lines_added} lines, "
            f"-{entry.lines_removed} lines"
        )

    snap_line = ""
    if entry.snapshot_file:
        snap_line = f"\n**Snapshot:** `{entry.snapshot_file}`"

    return (
        f"## [v{entry.version}] — {entry.date}  *{section_label}*\n"
        f"{breaking}"
        f"\n{entry.message}\n"
        f"\n**Author:** {entry.author}"
        f"{diff_line}"
        f"{snap_line}"
        f"\n\n---\n\n"
    )


# ── Read / write ──────────────────────────────────────────────────────────────

def ensure_header(changelog_path: Path, skill_name: str) -> None:
    """Create CHANGELOG.md with header if it doesn't exist."""
    if not changelog_path.exists():
        changelog_path.write_text(
            HEADER_TEMPLATE.format(skill_name=skill_name)
        )


def append_changelog_entry(
    changelog_path: Path,
    skill_name:     str,
    entry:          ChangelogEntry,
    mode:           str = "snapshot",
) -> None:
    """Append a new versioned entry to CHANGELOG.md."""
    ensure_header(changelog_path, skill_name)

    existing = changelog_path.read_text(errors="replace")
    new_block = render_entry(entry, mode)

    # Insert after the header (after the first '---\n\n')
    insert_marker = "---\n\n"
    idx = existing.find(insert_marker)
    if idx == -1:
        updated = existing + new_block
    else:
        insert_pos = idx + len(insert_marker)
        updated    = existing[:insert_pos] + new_block + existing[insert_pos:]

    changelog_path.write_text(updated)


def read_latest_version(changelog_path: Path) -> str | None:
    """Extract the most recent version from CHANGELOG.md."""
    if not changelog_path.exists():
        return None
    text = changelog_path.read_text(errors="replace")
    m = re.search(r"## \[v(\d+\.\d+\.\d+)\]", text)
    return m.group(1) if m else None


def list_versions_from_changelog(changelog_path: Path) -> list[str]:
    """Return all versions listed in CHANGELOG.md, newest first."""
    if not changelog_path.exists():
        return []
    text = changelog_path.read_text(errors="replace")
    return re.findall(r"## \[v(\d+\.\d+\.\d+)\]", text)
