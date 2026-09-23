#!/usr/bin/env python3
"""
skill_cleanup.py

Ephemeral skill lifecycle manager and retired retirement planner.

Commands:
  init     — create default cleanup policy
  scan     — scan skills and produce retirement plan (read-only)
  plan     — human-friendly retirement plan (read-only)
  apply    — apply retirement plan actions
  archive  — archive one specific skill
  trash    — move one skill to trash (recoverable)
  recover  — restore a skill from trash
  purge    — permanently delete trash older than N days
  log      — show cleanup action history

Exit codes:
  0 — success / no skills need retirement
  1 — skills found for retirement (dry-run or review needed)
  2 — actions applied
  3 — error
"""

from __future__ import annotations

import os
import re
import sys
import json
import shutil
import argparse
from pathlib import Path
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, field, asdict
from typing import Any


# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────

SCHEMA_VERSION = "1.0"

POLICY_REL       = ".agent/cleanup_policy.json"
LOG_REL          = ".agent/logs/cleanup.jsonl"
ACTIVATION_LOG   = ".agent/logs/skill_activations.jsonl"
GOVERNANCE_REG   = ".agent/governance/registry.json"

ARCHIVE_DIR_NAME = "_archive"
TRASH_DIR_NAME   = "_trash"

TRASH_RECOVERY_DAYS = 7

DEFAULT_POLICY = {
    "schema_version": SCHEMA_VERSION,
    "stale_days": 60,
    "ephemeral_patterns": [
        "-tmp", "-test", "-draft", "-exp", "-wip", "-poc",
        "_tmp", "_test", "_draft", "_exp", "_wip", "_poc",
    ],
    "never_archive": [
        "ephemeral-skill-cleanup",
        "secret-leak-guard",
        "context-budget-monitor",
        "skill-governance-policy",
    ],
    "auto_archive_categories": ["DEPRECATED", "EPHEMERAL"],
    "require_review_categories": ["STALE", "DUPLICATE", "ORPHAN", "DRAFT", "SUPERSEDED"],
    "delete_categories": ["BROKEN"],
    "estimate_tokens_per_skill": 250,
}

CATEGORY_ICONS = {
    "DEPRECATED":  "⛔",
    "EPHEMERAL":   "🏷️",
    "STALE":       "📅",
    "DUPLICATE":   "🔀",
    "SUPERSEDED":  "🆕",
    "DRAFT":       "✏️",
    "BROKEN":      "💀",
    "ORPHAN":      "👻",
}

SEMVER_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")

# ANSI color codes
COLOR_GREEN = "\033[92m"
COLOR_YELLOW = "\033[93m"
COLOR_RED = "\033[91m"
COLOR_CYAN = "\033[96m"
COLOR_BOLD = "\033[1m"
COLOR_DIM = "\033[2m"
COLOR_RESET = "\033[0m"


# ─────────────────────────────────────────────────────────────────────────────
# Data classes
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class RetirementCandidate:
    skill_name:    str
    skill_dir:     str
    category:      str
    reason:        str
    version:       str
    last_activation: str | None
    days_since_use:  int | None
    recommended_action: str
    token_savings:   int
    auto:            bool
    protected:       bool = False


@dataclass
class CleanupAction:
    timestamp:    str
    skill_name:   str
    action:       str
    category:     str
    reason:       str
    source_path:  str
    dest_path:    str
    success:      bool
    error:        str = ""


# ─────────────────────────────────────────────────────────────────────────────
# File helpers
# ─────────────────────────────────────────────────────────────────────────────

def utc_now() -> str:
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def today_str() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def read_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        if default is not None:
            return default
        raise FileNotFoundError(path)
    try:
        return json.loads(path.read_text(encoding="utf-8", errors="replace"))
    except json.JSONDecodeError:
        return default


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def append_log(workspace: Path, entry: dict[str, Any]) -> None:
    path = workspace / LOG_REL
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False, sort_keys=True) + "\n")


def load_policy(workspace: Path) -> dict[str, Any]:
    return read_json(workspace / POLICY_REL, DEFAULT_POLICY)


# ─────────────────────────────────────────────────────────────────────────────
# Frontmatter parsing
# ─────────────────────────────────────────────────────────────────────────────

def parse_frontmatter(text: str) -> dict[str, str]:
    result: dict[str, str] = {}
    in_fm = False
    cur_key = None
    buf: list[str] = []

    for line in text.splitlines():
        if line.strip() == "---":
            if not in_fm:
                in_fm = True
                continue
            else:
                if cur_key and buf:
                    result[cur_key] = " ".join(buf).strip()
                break
        if not in_fm:
            continue

        m = re.match(r"^([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)$", line)
        if m:
            if cur_key and buf:
                result[cur_key] = " ".join(buf).strip()
                buf = []
            cur_key = m.group(1)
            val = m.group(2).strip()
            if val and val != "|":
                result[cur_key] = val.strip("'\"")
                cur_key = None
        elif cur_key and (line.startswith("  ") or line.startswith("\t")):
            buf.append(line.strip())

    return result


def load_skill_fm(skill_dir: Path) -> dict[str, str]:
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        return {}
    text = skill_md.read_text(encoding="utf-8", errors="replace")
    return parse_frontmatter(text)


# ─────────────────────────────────────────────────────────────────────────────
# Activation log analysis
# ─────────────────────────────────────────────────────────────────────────────

def load_last_activations(workspace: Path) -> dict[str, str]:
    path = workspace / ACTIVATION_LOG
    if not path.exists():
        return {}

    last: dict[str, str] = {}

    with path.open("r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue

            skill = entry.get("skill_name", "")
            ts    = entry.get("timestamp", "")
            event = entry.get("event", "")

            if not skill or not ts:
                continue
            if event not in {"activate", "complete"}:
                continue

            if skill not in last or ts > last[skill]:
                last[skill] = ts

    return last


def days_since(ts_str: str) -> int | None:
    if not ts_str:
        return None
    try:
        ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        delta = datetime.now(timezone.utc) - ts
        return max(0, delta.days)
    except ValueError:
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Registry
# ─────────────────────────────────────────────────────────────────────────────

def load_registry(workspace: Path) -> dict[str, Any]:
    return read_json(workspace / GOVERNANCE_REG, {"published_skills": {}})


def update_registry_status(
    workspace: Path,
    skill_name: str,
    status: str,
) -> None:
    reg_path = workspace / GOVERNANCE_REG
    if not reg_path.exists():
        return

    try:
        registry = read_json(reg_path)
        skills = registry.setdefault("published_skills", {})
        if skill_name in skills:
            skills[skill_name]["status"] = status
            skills[skill_name]["status_updated_at"] = utc_now()
            write_json(reg_path, registry)
    except Exception:
        pass


# ─────────────────────────────────────────────────────────────────────────────
# Token estimation
# ─────────────────────────────────────────────────────────────────────────────

def estimate_skill_metadata_tokens(skill_dir: Path, default: int = 250) -> int:
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        return default

    try:
        text = skill_md.read_text(encoding="utf-8", errors="replace")
        fm_lines = []
        in_fm = False
        for line in text.splitlines():
            if line.strip() == "---":
                if not in_fm:
                    in_fm = True
                    continue
                else:
                    break
            if in_fm:
                fm_lines.append(line)
        fm_text = "\n".join(fm_lines)
        return max(50, int(len(fm_text) / 4.0))
    except OSError:
        return default


# ─────────────────────────────────────────────────────────────────────────────
# Category detection
# ─────────────────────────────────────────────────────────────────────────────

def detect_category(
    skill_dir:         Path,
    fm:                dict[str, str],
    policy:            dict[str, Any],
    last_activations:  dict[str, str],
    registry:          dict[str, Any],
) -> tuple[str, str] | None:
    """
    Returns (category, reason) or None if skill is healthy.
    """
    name    = fm.get("name", skill_dir.name)
    version = fm.get("version", "")

    # BROKEN — no SKILL.md
    if not (skill_dir / "SKILL.md").exists():
        return "BROKEN", "SKILL.md missing"

    # DEPRECATED
    if str(fm.get("deprecated", "")).lower() == "true":
        reason_detail = fm.get("deprecated_reason", "no reason given")
        return "DEPRECATED", f"deprecated: true — {reason_detail}"

    # EPHEMERAL — name pattern
    patterns = policy.get("ephemeral_patterns", [])
    if str(fm.get("ephemeral", "")).lower() == "true":
        return "EPHEMERAL", "ephemeral: true in frontmatter"
    for pat in patterns:
        if pat.lower() in name.lower():
            return "EPHEMERAL", f"name contains '{pat}'"

    # DRAFT — version 0.x.x and not in registry
    if version and SEMVER_RE.match(version):
        major = int(SEMVER_RE.match(version).group(1))
        if major == 0:
            published = registry.get("published_skills", {})
            if name not in published:
                return "DRAFT", f"version {version} is a draft and skill is not published"

    # SUPERSEDED — registry has newer version
    published = registry.get("published_skills", {})
    if name in published:
        reg_version = published[name].get("version", "")
        if reg_version and version and reg_version != version:
            try:
                def ver_tuple(v: str) -> tuple[int, ...]:
                    return tuple(int(x) for x in v.split(".")[:3])
                if ver_tuple(reg_version) > ver_tuple(version):
                    return "SUPERSEDED", (
                        f"registry has v{reg_version}, "
                        f"installed is v{version}"
                    )
            except ValueError:
                pass

    # STALE — no activation within threshold
    stale_days = int(policy.get("stale_days", 60))
    last_ts = last_activations.get(name)

    if last_ts:
        age = days_since(last_ts)
        if age is not None and age > stale_days:
            return "STALE", f"no activation in {age} days (threshold: {stale_days})"
    else:
        # Never activated — check file modification date as proxy.
        try:
            mtime = datetime.fromtimestamp(
                (skill_dir / "SKILL.md").stat().st_mtime, tz=timezone.utc
            )
            age = (datetime.now(timezone.utc) - mtime).days
            if age > stale_days:
                return "STALE", f"never activated, created {age} days ago"
        except OSError:
            pass

    # ORPHAN — not in registry, no owner, never activated
    has_owner = bool(fm.get("owner", ""))
    in_registry = name in published
    never_used = name not in last_activations

    if not has_owner and not in_registry and never_used:
        return "ORPHAN", "no owner, not published, never activated"

    return None


# ─────────────────────────────────────────────────────────────────────────────
# Scanner
# ─────────────────────────────────────────────────────────────────────────────

def scan_skills(
    workspace:  Path,
    skills_dir: Path,
    policy:     dict[str, Any],
) -> list[RetirementCandidate]:
    last_activations = load_last_activations(workspace)
    registry         = load_registry(workspace)
    never_archive    = set(policy.get("never_archive", []))
    auto_categories  = set(policy.get("auto_archive_categories", []))
    delete_categories = set(policy.get("delete_categories", []))

    candidates: list[RetirementCandidate] = []

    for entry in sorted(skills_dir.iterdir()):
        if not entry.is_dir():
            continue

        # Skip archive and trash dirs.
        if entry.name.startswith("_"):
            continue

        fm   = load_skill_fm(entry)
        name = fm.get("name", entry.name)

        # Skip protected skills.
        if name in never_archive:
            continue

        result = detect_category(entry, fm, policy, last_activations, registry)
        if result is None:
            continue

        category, reason = result
        last_ts = last_activations.get(name)
        d_since = days_since(last_ts) if last_ts else None
        token_savings = estimate_skill_metadata_tokens(entry)
        auto = category in auto_categories

        if category in delete_categories:
            recommended_action = "Delete (move to _trash)"
        elif auto:
            recommended_action = "Archive immediately"
        else:
            recommended_action = "Archive? (requires review)"

        candidates.append(RetirementCandidate(
            skill_name=name,
            skill_dir=str(entry),
            category=category,
            reason=reason,
            version=fm.get("version", "unknown"),
            last_activation=last_ts,
            days_since_use=d_since,
            recommended_action=recommended_action,
            token_savings=token_savings,
            auto=auto,
        ))

    return candidates


# ─────────────────────────────────────────────────────────────────────────────
# Reporting
# ─────────────────────────────────────────────────────────────────────────────

def render_plan(
    candidates:  list[RetirementCandidate],
    skills_dir:  Path,
    workspace:   Path,
    policy:      dict[str, Any],
) -> str:
    total_scanned = sum(
        1 for e in skills_dir.iterdir()
        if e.is_dir() and not e.name.startswith("_")
    )
    total_savings = sum(c.token_savings for c in candidates)
    never_archive = set(policy.get("never_archive", []))

    protected = [
        e.name for e in skills_dir.iterdir()
        if e.is_dir()
        and not e.name.startswith("_")
        and e.name in never_archive
    ]

    lines = [
        "",
        f"{COLOR_BOLD}♻️  Skill Cleanup Plan{COLOR_RESET}",
        "═" * 56,
        f"Workspace      : {workspace}",
        f"Skills scanned : {total_scanned}",
        f"For retirement : {len(candidates)}",
        f"Token savings  : ~{total_savings:,} tokens/session if all archived",
        "═" * 56,
    ]

    auto_list   = [c for c in candidates if c.auto]
    review_list = [c for c in candidates if not c.auto]

    if auto_list:
        lines += ["", f"{COLOR_BOLD}AUTOMATIC — no review needed:{COLOR_RESET}", ""]
        for c in auto_list:
            icon = CATEGORY_ICONS.get(c.category, "•")
            last = (
                f"{c.last_activation[:10]} ({c.days_since_use} days ago)"
                if c.last_activation else "never"
            )
            lines += [
                f"  {icon} {COLOR_CYAN}{c.category}{COLOR_RESET}",
                f"     {COLOR_BOLD}{c.skill_name}{COLOR_RESET}",
                f"     Reason  : {c.reason}",
                f"     Version : {c.version}",
                f"     Last use: {last}",
                f"     Action  : {COLOR_YELLOW}{c.recommended_action}{COLOR_RESET}",
                f"     Savings : {c.token_savings} tokens/session",
                "",
            ]

    if review_list:
        lines += [f"{COLOR_BOLD}REQUIRES REVIEW:{COLOR_RESET}", ""]
        for c in review_list:
            icon = CATEGORY_ICONS.get(c.category, "•")
            last = (
                f"{c.last_activation[:10]} ({c.days_since_use} days ago)"
                if c.last_activation else "never"
            )
            lines += [
                f"  {icon} {COLOR_CYAN}{c.category}{COLOR_RESET}",
                f"     {COLOR_BOLD}{c.skill_name}{COLOR_RESET}",
                f"     Reason  : {c.reason}",
                f"     Version : {c.version}",
                f"     Last use: {last}",
                f"     Action  : {COLOR_YELLOW}{c.recommended_action}{COLOR_RESET}",
                f"     Savings : {c.token_savings} tokens/session",
                "",
            ]

    if protected:
        lines += [f"{COLOR_BOLD}PROTECTED — will not be archived:{COLOR_RESET}", ""]
        for name in protected:
            lines.append(f"  🔒 {name}")
        lines.append("")

    if not candidates:
        lines += ["", f"{COLOR_GREEN}✅ No skills need retirement. Workspace is clean.{COLOR_RESET}", ""]

    total_archive = sum(1 for c in candidates if "Archive" in c.recommended_action)
    total_delete  = sum(1 for c in candidates if "Delete" in c.recommended_action)

    lines += [
        "═" * 56,
        f"Total if all applied   : {total_archive} archived, {total_delete} trashed",
        f"Token savings estimate : ~{total_savings:,} tokens/session",
        "═" * 56,
        "",
    ]

    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# Archive / trash operations
# ─────────────────────────────────────────────────────────────────────────────

def archive_skill(
    skill_dir:  Path,
    skills_dir: Path,
    reason:     str,
    category:   str,
    dry_run:    bool,
) -> CleanupAction:
    date_str    = today_str()
    archive_dir = skills_dir / ARCHIVE_DIR_NAME / date_str / skill_dir.name
    ts          = utc_now()

    if dry_run:
        return CleanupAction(
            timestamp=ts,
            skill_name=skill_dir.name,
            action="archive (dry-run)",
            category=category,
            reason=reason,
            source_path=str(skill_dir),
            dest_path=str(archive_dir),
            success=True,
        )

    try:
        archive_dir.parent.mkdir(parents=True, exist_ok=True)
        # Handle existing destination
        final_dest = archive_dir
        if final_dest.exists():
            final_dest = archive_dir.parent / f"{archive_dir.name}_{datetime.now().strftime('%H%M%S')}"

        shutil.copytree(str(skill_dir), str(final_dest))

        manifest = {
            "skill_name": skill_dir.name,
            "archived_at": ts,
            "archived_by": "ephemeral-skill-cleanup",
            "reason": reason,
            "category": category,
            "restore_command": (
                f"mv {final_dest} {skills_dir}/{skill_dir.name}"
            ),
        }
        write_json(final_dest / "ARCHIVE_MANIFEST.json", manifest)
        shutil.rmtree(str(skill_dir))

        return CleanupAction(
            timestamp=ts,
            skill_name=skill_dir.name,
            action="archive",
            category=category,
            reason=reason,
            source_path=str(skill_dir),
            dest_path=str(final_dest),
            success=True,
        )
    except Exception as e:
        return CleanupAction(
            timestamp=ts,
            skill_name=skill_dir.name,
            action="archive",
            category=category,
            reason=reason,
            source_path=str(skill_dir),
            dest_path=str(archive_dir),
            success=False,
            error=str(e),
        )


def trash_skill(
    skill_dir:  Path,
    skills_dir: Path,
    reason:     str,
    category:   str,
    dry_run:    bool,
) -> CleanupAction:
    date_str  = today_str()
    trash_dir = skills_dir / TRASH_DIR_NAME / date_str / skill_dir.name
    ts        = utc_now()

    if dry_run:
        return CleanupAction(
            timestamp=ts,
            skill_name=skill_dir.name,
            action="trash (dry-run)",
            category=category,
            reason=reason,
            source_path=str(skill_dir),
            dest_path=str(trash_dir),
            success=True,
        )

    try:
        trash_dir.parent.mkdir(parents=True, exist_ok=True)
        # Handle existing destination
        final_dest = trash_dir
        if final_dest.exists():
            final_dest = trash_dir.parent / f"{trash_dir.name}_{datetime.now().strftime('%H%M%S')}"

        shutil.copytree(str(skill_dir), str(final_dest))

        manifest = {
            "skill_name": skill_dir.name,
            "trashed_at": ts,
            "trashed_by": "ephemeral-skill-cleanup",
            "reason": reason,
            "category": category,
            "recovery_window_days": TRASH_RECOVERY_DAYS,
            "restore_command": (
                f"mv {final_dest} {skills_dir}/{skill_dir.name}"
            ),
        }
        write_json(final_dest / "TRASH_MANIFEST.json", manifest)
        shutil.rmtree(str(skill_dir))

        return CleanupAction(
            timestamp=ts,
            skill_name=skill_dir.name,
            action="trash",
            category=category,
            reason=reason,
            source_path=str(skill_dir),
            dest_path=str(final_dest),
            success=True,
        )
    except Exception as e:
        return CleanupAction(
            timestamp=ts,
            skill_name=skill_dir.name,
            action="trash",
            category=category,
            reason=reason,
            source_path=str(skill_dir),
            dest_path=str(trash_dir),
            success=False,
            error=str(e),
        )


# ─────────────────────────────────────────────────────────────────────────────
# Recovery
# ─────────────────────────────────────────────────────────────────────────────

def find_in_trash(skills_dir: Path, skill_name: str) -> list[Path]:
    trash_root = skills_dir / TRASH_DIR_NAME
    if not trash_root.exists():
        return []

    matches = []
    for date_dir in sorted(trash_root.iterdir(), reverse=True):
        if not date_dir.is_dir():
            continue
        # Scan date_dir for matching folder or folders starting with skill_name_ (timestamps)
        for cur in date_dir.iterdir():
            if cur.is_dir() and (cur.name == skill_name or cur.name.startswith(f"{skill_name}_")):
                matches.append(cur)

    return matches


def recover_skill(
    skills_dir: Path,
    skill_name: str,
    dry_run:    bool,
) -> tuple[bool, str]:
    matches = find_in_trash(skills_dir, skill_name)

    if not matches:
        return False, f"No trashed skill found for '{skill_name}'"

    latest = matches[0]
    dest   = skills_dir / skill_name

    if dest.exists():
        return False, (
            f"Destination already exists: {dest}. "
            f"Rename or remove it first."
        )

    if dry_run:
        return True, f"[dry-run] would restore {latest} → {dest}"

    try:
        shutil.copytree(str(latest), str(dest))
        # Remove manifest files before exposing back to active skills
        for item in ["TRASH_MANIFEST.json", "ARCHIVE_MANIFEST.json"]:
            if (dest / item).exists():
                (dest / item).unlink()
        shutil.rmtree(str(latest))
        return True, f"Restored: {latest} → {dest}"
    except Exception as e:
        return False, f"Recovery failed: {e}"


# ─────────────────────────────────────────────────────────────────────────────
# Purge
# ─────────────────────────────────────────────────────────────────────────────

def purge_old_trash(
    skills_dir:  Path,
    older_than:  int,
    dry_run:     bool,
) -> list[str]:
    trash_root = skills_dir / TRASH_DIR_NAME
    if not trash_root.exists():
        return []

    cutoff  = datetime.now(timezone.utc) - timedelta(days=older_than)
    removed = []

    for date_dir in trash_root.iterdir():
        if not date_dir.is_dir():
            continue
        # Date subfolders are named YYYY-MM-DD
        try:
            dir_date = datetime.strptime(date_dir.name, "%Y-%m-%d").replace(
                tzinfo=timezone.utc
            )
        except ValueError:
            continue

        if dir_date < cutoff:
            for skill_dir in date_dir.iterdir():
                if skill_dir.is_dir():
                    removed.append(str(skill_dir))
                    if not dry_run:
                        shutil.rmtree(str(skill_dir))

            # Remove empty date dir.
            if not dry_run:
                try:
                    date_dir.rmdir()
                except OSError:
                    pass

    return removed


# ─────────────────────────────────────────────────────────────────────────────
# Command handlers
# ─────────────────────────────────────────────────────────────────────────────

def cmd_init(args: argparse.Namespace) -> int:
    workspace = Path(args.workspace).resolve()
    path = workspace / POLICY_REL

    if path.exists() and not args.force:
        print(f"ℹ️  Policy already exists: {path}")
        return 0

    write_json(path, DEFAULT_POLICY)
    print(f"✅ Cleanup policy created: {path}")
    return 0


def cmd_scan(args: argparse.Namespace) -> int:
    workspace  = Path(args.workspace).resolve()
    skills_dir = Path(args.skills_dir)

    if not skills_dir.is_absolute():
        skills_dir = workspace / skills_dir

    if not skills_dir.exists():
        print(f"❌ skills dir not found: {skills_dir}", file=sys.stderr)
        return 3

    policy     = load_policy(workspace)
    candidates = scan_skills(workspace, skills_dir, policy)

    if args.json:
        print(json.dumps([asdict(c) for c in candidates], indent=2, ensure_ascii=False))
        return 1 if candidates else 0

    print(render_plan(candidates, skills_dir, workspace, policy))
    return 1 if candidates else 0


def cmd_plan(args: argparse.Namespace) -> int:
    return cmd_scan(args)


def cmd_apply(args: argparse.Namespace) -> int:
    workspace  = Path(args.workspace).resolve()
    skills_dir = Path(args.skills_dir)

    if not skills_dir.is_absolute():
        skills_dir = workspace / skills_dir

    policy     = load_policy(workspace)
    candidates = scan_skills(workspace, skills_dir, policy)

    if not candidates:
        print("✅ No skills need retirement.")
        return 0

    dry_run     = not args.confirm
    auto_only   = args.auto_only
    delete_cats = set(policy.get("delete_categories", []))
    actions:   list[CleanupAction] = []

    if dry_run:
        print("🔍 Dry-run mode. Use --confirm to apply changes.")
        print()

    for c in candidates:
        if auto_only and not c.auto:
            continue

        s_dir = Path(c.skill_dir)

        if c.category in delete_cats:
            action = trash_skill(
                s_dir, skills_dir, c.reason, c.category, dry_run
            )
        else:
            action = archive_skill(
                s_dir, skills_dir, c.reason, c.category, dry_run
            )

        actions.append(action)
        status = f"{COLOR_GREEN}✅{COLOR_RESET}" if action.success else f"{COLOR_RED}❌{COLOR_RESET}"
        mode   = "(dry-run)" if dry_run else ""
        print(
            f"  {status} {action.action} {mode}  {COLOR_BOLD}{action.skill_name}{COLOR_RESET}"
            f"  [{COLOR_CYAN}{action.category}{COLOR_RESET}]"
        )
        if not action.success:
            print(f"       Error: {action.error}")
        elif not dry_run:
            update_registry_status(workspace, action.skill_name, "archived")
            append_log(workspace, {
                **asdict(action),
                "workspace": str(workspace),
            })

    print()
    applied = sum(1 for a in actions if a.success and "dry-run" not in a.action)
    if dry_run:
        print(f"Dry-run complete. {len(actions)} action(s) would be applied.")
        print("Re-run with --confirm to apply.")
    else:
        print(f"✅ {applied} action(s) applied.")

    return 2 if (actions and not dry_run) else 1


def cmd_archive(args: argparse.Namespace) -> int:
    workspace  = Path(args.workspace).resolve()
    skill_dir  = Path(args.skill_dir)

    if not skill_dir.is_absolute():
        skill_dir = workspace / skill_dir

    skills_dir = skill_dir.parent
    dry_run    = not args.confirm

    fm       = load_skill_fm(skill_dir)
    name     = fm.get("name", skill_dir.name)
    policy   = load_policy(workspace)
    never    = set(policy.get("never_archive", []))

    if name in never:
        print(f"⛔ '{name}' is in never_archive list. Skipping.")
        return 1

    action = archive_skill(
        skill_dir, skills_dir,
        args.reason, "MANUAL", dry_run
    )

    status = f"{COLOR_GREEN}✅{COLOR_RESET}" if action.success else f"{COLOR_RED}❌{COLOR_RESET}"
    mode   = " (dry-run)" if dry_run else ""
    print(f"{status} {action.action}{mode}: {name} → {action.dest_path}")

    if action.success and not dry_run:
        update_registry_status(workspace, name, "archived")
        append_log(workspace, {**asdict(action), "workspace": str(workspace)})

    return 0 if action.success else 3


def cmd_trash(args: argparse.Namespace) -> int:
    workspace  = Path(args.workspace).resolve()
    skill_dir  = Path(args.skill_dir)

    if not skill_dir.is_absolute():
        skill_dir = workspace / skill_dir

    skills_dir = skill_dir.parent
    dry_run    = not args.confirm

    fm     = load_skill_fm(skill_dir)
    name   = fm.get("name", skill_dir.name)

    action = trash_skill(
        skill_dir, skills_dir,
        args.reason, "MANUAL", dry_run
    )

    status = f"{COLOR_GREEN}✅{COLOR_RESET}" if action.success else f"{COLOR_RED}❌{COLOR_RESET}"
    mode   = " (dry-run)" if dry_run else ""
    print(f"{status} {action.action}{mode}: {name} → {action.dest_path}")

    if action.success and not dry_run:
        update_registry_status(workspace, name, "trashed")
        append_log(workspace, {**asdict(action), "workspace": str(workspace)})

    return 0 if action.success else 3


def cmd_recover(args: argparse.Namespace) -> int:
    workspace  = Path(args.workspace).resolve()
    skills_dir = Path(args.skills_dir)

    if not skills_dir.is_absolute():
        skills_dir = workspace / skills_dir

    dry_run = not args.confirm
    ok, msg = recover_skill(skills_dir, args.skill_name, dry_run)

    print(f"{f'{COLOR_GREEN}✅{COLOR_RESET}' if ok else f'{COLOR_RED}❌{COLOR_RESET}'} {msg}")

    if ok and not dry_run:
        append_log(workspace, {
            "timestamp": utc_now(),
            "skill_name": args.skill_name,
            "action": "recover",
            "category": "RECOVERED",
            "reason": "manual recovery",
            "source_path": "",
            "dest_path": str(skills_dir / args.skill_name),
            "success": True,
            "workspace": str(workspace),
        })

    return 0 if ok else 3


def cmd_purge(args: argparse.Namespace) -> int:
    workspace  = Path(args.workspace).resolve()
    skills_dir = Path(args.skills_dir)

    if not skills_dir.is_absolute():
        skills_dir = workspace / skills_dir

    dry_run = not args.confirm
    removed = purge_old_trash(skills_dir, args.older_than, dry_run)

    if not removed:
        print(f"✅ No trash items older than {args.older_than} days found.")
        return 0

    mode = " (dry-run)" if dry_run else ""
    print(f"{'🔍' if dry_run else '🗑️'} Purge{mode}: {len(removed)} item(s)")
    for path in removed:
        print(f"  {'would remove' if dry_run else 'removed'}: {path}")

    if dry_run:
        print("\nRe-run with --confirm to permanently delete.")

    return 0


def cmd_log(args: argparse.Namespace) -> int:
    workspace = Path(args.workspace).resolve()
    path      = workspace / LOG_REL

    if not path.exists():
        print("No cleanup log found.")
        return 0

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

    if not entries:
        print("Log exists but contains no actions.")
        return 0

    print()
    print(f"{COLOR_BOLD}♻️ Cleanup Actions Log{COLOR_RESET}")
    print("═" * 72)
    print(f"{'Timestamp':<20} {'Action':<15} {'Skill':<25} Status")
    print("─" * 72)
    for e in entries:
        ts = e.get("timestamp", "")[:19].replace("T", " ")
        action = e.get("action", "")
        skill = e.get("skill_name", "")
        success = e.get("success", False)
        status_str = f"{COLOR_GREEN}Success{COLOR_RESET}" if success else f"{COLOR_RED}Failed{COLOR_RESET}"
        print(f"{ts:<20} {action:<15} {skill:<25} {status_str}")
    print("═" * 72)
    print()
    return 0


# ─────────────────────────────────────────────────────────────────────────────
# Main / CLI
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Ephemeral skill lifecycle retirement manager.")
    sub = parser.add_subparsers(dest="command", required=True)

    # init
    p = sub.add_parser("init", help="Create default cleanup policy")
    p.add_argument("--workspace", default=".", help="Root workspace directory")
    p.add_argument("--force", action="store_true", help="Force overwrite existing policy")
    p.set_defaults(func=cmd_init)

    # scan
    p = sub.add_parser("scan", help="Scan skills and produce retirement plan")
    p.add_argument("--workspace", default=".", help="Root workspace directory")
    p.add_argument("--skills-dir", default=".agent/skills", help="Directory where skills are stored")
    p.add_argument("--json", action="store_true", help="Output JSON only")
    p.set_defaults(func=cmd_scan)

    # plan
    p = sub.add_parser("plan", help="Human-friendly retirement plan scan")
    p.add_argument("--workspace", default=".", help="Root workspace directory")
    p.add_argument("--skills-dir", default=".agent/skills", help="Directory where skills are stored")
    p.add_argument("--json", action="store_true", help="Output JSON only")
    p.set_defaults(func=cmd_plan)

    # apply
    p = sub.add_parser("apply", help="Apply retirement actions")
    p.add_argument("--workspace", default=".", help="Root workspace directory")
    p.add_argument("--skills-dir", default=".agent/skills", help="Directory where skills are stored")
    p.add_argument("--auto-only", action="store_true", help="Only apply automatic (DEPRECATED, EPHEMERAL) actions")
    p.add_argument("--confirm", action="store_true", help="Confirm execution (otherwise runs dry-run)")
    p.set_defaults(func=cmd_apply)

    # archive
    p = sub.add_parser("archive", help="Archive one specific skill")
    p.add_argument("--workspace", default=".", help="Root workspace directory")
    p.add_argument("--skill-dir", required=True, help="Path to specific skill directory")
    p.add_argument("--reason", required=True, help="Reason for archiving")
    p.add_argument("--confirm", action="store_true", help="Confirm execution (otherwise runs dry-run)")
    p.set_defaults(func=cmd_archive)

    # trash
    p = sub.add_parser("trash", help="Move one skill to trash (recoverable)")
    p.add_argument("--workspace", default=".", help="Root workspace directory")
    p.add_argument("--skill-dir", required=True, help="Path to specific skill directory")
    p.add_argument("--reason", required=True, help="Reason for trashing")
    p.add_argument("--confirm", action="store_true", help="Confirm execution (otherwise runs dry-run)")
    p.set_defaults(func=cmd_trash)

    # recover
    p = sub.add_parser("recover", help="Restore a skill from trash")
    p.add_argument("--workspace", default=".", help="Root workspace directory")
    p.add_argument("--skills-dir", default=".agent/skills", help="Directory where skills are stored")
    p.add_argument("--skill-name", required=True, help="Name of the skill to restore")
    p.add_argument("--confirm", action="store_true", help="Confirm restoration")
    p.set_defaults(func=cmd_recover)

    # purge
    p = sub.add_parser("purge", help="Permanently delete old trash")
    p.add_argument("--workspace", default=".", help="Root workspace directory")
    p.add_argument("--skills-dir", default=".agent/skills", help="Directory where skills are stored")
    p.add_argument("--older-than", type=int, default=TRASH_RECOVERY_DAYS, help="Purge older than N days")
    p.add_argument("--confirm", action="store_true", help="Confirm permanent purge")
    p.set_defaults(func=cmd_purge)

    # log
    p = sub.add_parser("log", help="Show cleanup log history")
    p.add_argument("--workspace", default=".", help="Root workspace directory")
    p.set_defaults(func=cmd_log)

    args = parser.parse_args()

    try:
        sys.exit(args.func(args))
    except KeyboardInterrupt:
        sys.exit(1)
    except Exception as e:
        print(f"skill_cleanup ⚠️ unexpected error: {e}", file=sys.stderr)
        sys.exit(3)


if __name__ == "__main__":
    main()
