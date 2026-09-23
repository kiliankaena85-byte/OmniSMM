#!/usr/bin/env python3
"""
handoff_manager.py
Full lifecycle manager for agent handoff packages.

Commands:
  create           — create a new DRAFT handoff package
  add-completed    — record completed work summary
  add-artifact     — register a file artifact
  add-open-item    — add an open question or blocker
  add-decision     — record a closed decision with rationale
  set-continuation — set the entry point for the receiving agent
  seal             — validate and transition to READY_FOR_HANDOFF
  read             — read and display a package summary
  claim            — claim a package as receiving agent
  checkpoint       — record a progress update during execution
  complete         — mark task as COMPLETED and archive package
  lock-artifact    — set advisory lock on a file
  unlock-artifact  — release advisory lock on a file
  resolve-conflict — resolve an artifact checksum conflict
  emergency        — create emergency handoff from state snapshot
  list             — list all active handoff packages

Exit codes:
  0 — success
  1 — warning / validation issue
  2 — error
"""

import sys
import json
import hashlib
import argparse
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Any


# ── Config ────────────────────────────────────────────────────────────────────

SCHEMA_VERSION  = "1.0"
PACKAGE_TTL_H   = 24     # hours until a READY package expires if unclaimed
HANDOFF_GLOB    = "handoff_*.json"
ARCHIVE_DIR     = "_archive"

VALID_STATUSES  = {
    "DRAFT", "READY_FOR_HANDOFF", "CLAIMED",
    "IN_PROGRESS", "COMPLETED", "EXPIRED",
}

VALID_TRANSITIONS: dict[str, set[str]] = {
    "DRAFT":             {"READY_FOR_HANDOFF"},
    "READY_FOR_HANDOFF": {"CLAIMED", "EXPIRED"},
    "CLAIMED":           {"IN_PROGRESS", "READY_FOR_HANDOFF"},
    "IN_PROGRESS":       {"COMPLETED", "READY_FOR_HANDOFF"},
    "COMPLETED":         set(),
    "EXPIRED":           set(),
}

OPEN_ITEM_TYPES = {"DECISION_NEEDED", "INVESTIGATION_NEEDED", "BLOCKED"}
PRIORITY_LEVELS = {"HIGH", "MEDIUM", "LOW"}
ARTIFACT_STATUSES = {"COMPLETE", "IN_PROGRESS", "PLANNED", "DELETED"}


# ── Timestamp helper ──────────────────────────────────────────────────────────

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def file_checksum(path: str) -> str | None:
    p = Path(path)
    if not p.exists():
        return None
    h = hashlib.sha256()
    try:
        with open(p, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return f"sha256:{h.hexdigest()[:16]}"
    except OSError:
        return None


# ── Package I/O ───────────────────────────────────────────────────────────────

def package_path(
    task_id:      str,
    handoffs_dir: Path,
) -> Path | None:
    """Find the package file for a given task_id."""
    for p in handoffs_dir.glob(HANDOFF_GLOB):
        try:
            data = json.loads(p.read_text())
            if data.get("task_id") == task_id:
                return p
        except (json.JSONDecodeError, OSError):
            continue
    return None


def load_package(task_id: str, handoffs_dir: Path) -> tuple[dict[str, Any], Path]:
    path = package_path(task_id, handoffs_dir)
    if not path:
        raise FileNotFoundError(
            f"No handoff package found for task_id='{task_id}' "
            f"in {handoffs_dir}"
        )
    return json.loads(path.read_text()), path


def save_package(
    pkg:          dict[str, Any],
    path:         Path,
) -> None:
    pkg["updated_at"] = now_iso()
    path.write_text(json.dumps(pkg, indent=2))


def new_package(task_id: str, goal: str, agent_id: str) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "task_id":        task_id,
        "created_at":     now_iso(),
        "updated_at":     now_iso(),
        "expires_at":     (
            datetime.now(timezone.utc) + timedelta(hours=PACKAGE_TTL_H)
        ).isoformat(),
        "created_by":     agent_id,
        "status":         "DRAFT",
        "task": {
            "original_goal": goal,
            "decomposition": [],
        },
        "completed_work": {
            "summary":       "",
            "decisions_made": [],
        },
        "artifacts":   [],
        "open_items":  [],
        "continuation": {
            "next_task_id":       "",
            "entry_point":        "",
            "must_not_touch":     [],
            "must_resolve_first": [],
            "context_files":      [],
            "suggested_approach": "",
        },
        "environment": {
            "working_directory": str(Path.cwd()),
            "active_branch":     None,
            "last_commit":       None,
            "relevant_env_vars": [],
            "tools_used":        [],
        },
        "receiving_agent": {
            "recommended_skills": [],
            "warnings":           [],
        },
        "checkpoints":  [],
    }


# ── Validation ────────────────────────────────────────────────────────────────

class ValidationResult:
    def __init__(self, valid: bool, errors: list[str], warnings: list[str]):
        self.valid = valid
        self.errors = errors
        self.warnings = warnings


def validate_package(pkg: dict[str, Any]) -> ValidationResult:
    errors:   list[str] = []
    warnings: list[str] = []

    # Required top-level fields
    for required in ("task_id", "created_by", "schema_version"):
        if not pkg.get(required):
            errors.append(f"Missing required field: '{required}'")

    # Schema version
    if pkg.get("schema_version") != SCHEMA_VERSION:
        errors.append(
            f"Schema version mismatch: expected {SCHEMA_VERSION}, "
            f"got {pkg.get('schema_version')}"
        )

    # Goal
    goal = pkg.get("task", {}).get("original_goal", "")
    if not goal:
        errors.append("task.original_goal is empty")

    # Continuation entry point
    ep = pkg.get("continuation", {}).get("entry_point", "")
    if not ep:
        warnings.append(
            "continuation.entry_point is empty — "
            "receiving agent will not know where to start"
        )

    # Completed work summary
    summary = pkg.get("completed_work", {}).get("summary", "")
    if not summary:
        warnings.append(
            "completed_work.summary is empty — "
            "receiving agent has no context on what was done"
        )

    # Artifact integrity
    for art in pkg.get("artifacts", []):
        path_str = art.get("path", "")
        if not path_str:
            errors.append("Artifact missing 'path' field")
            continue
        if art.get("status") == "COMPLETE":
            stored_cs = art.get("checksum")
            current_cs = file_checksum(path_str)
            if current_cs is None:
                warnings.append(
                    f"Artifact '{path_str}' marked COMPLETE "
                    f"but file not found on disk"
                )
            elif stored_cs and stored_cs != current_cs:
                errors.append(
                    f"Artifact '{path_str}' checksum mismatch: "
                    f"stored={stored_cs}, current={current_cs} "
                    f"— file may have been modified since registration"
                )

    # Open item references
    decomp_ids = {
        t.get("id") for t in pkg.get("task", {}).get("decomposition", [])
    }
    for item in pkg.get("open_items", []):
        for blocking in item.get("blocking", []):
            if decomp_ids and blocking not in decomp_ids:
                warnings.append(
                    f"Open item '{item.get('id')}' references unknown "
                    f"task '{blocking}'"
                )

    return ValidationResult(
        valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
    )


# ── Status transition ─────────────────────────────────────────────────────────

def transition(
    pkg:        dict[str, Any],
    new_status: str,
    agent_id:   str = "",
) -> None:
    current = pkg.get("status", "DRAFT")
    allowed = VALID_TRANSITIONS.get(current, set())
    if new_status not in allowed:
        raise ValueError(
            f"Invalid transition: {current} → {new_status}. "
            f"Allowed: {allowed or 'none (terminal state)'}"
        )
    pkg["status"] = new_status
    if agent_id:
        pkg["last_actor"] = agent_id
    pkg["status_changed_at"] = now_iso()


# ── Report renderer ───────────────────────────────────────────────────────────

STATUS_ICONS = {
    "DRAFT":             "📝",
    "READY_FOR_HANDOFF": "📬",
    "CLAIMED":           "🤝",
    "IN_PROGRESS":       "⚙️ ",
    "COMPLETED":         "✅",
    "EXPIRED":           "⌛",
}

TASK_STATUS_ICONS = {
    "DONE":        "✅",
    "IN_PROGRESS": "⚙️",
    "NOT_STARTED": "⬜",
    "BLOCKED":     "🚫",
}


def render_package_summary(pkg: dict[str, Any]) -> str:
    status = pkg.get("status", "?")
    icon   = STATUS_ICONS.get(status, "?")
    task   = pkg.get("task", {})
    cont   = pkg.get("continuation", {})
    arts   = pkg.get("artifacts", [])
    opens  = pkg.get("open_items", [])
    decs   = pkg.get("completed_work", {}).get("decisions_made", [])

    lines = [
        "",
        "🌐 Handoff Package Summary",
        "═" * 56,
        f"Task ID       : {pkg.get('task_id')}",
        f"Status        : {icon} {status}",
        f"Created by    : {pkg.get('created_by')}",
        f"Created at    : {pkg.get('created_at', '')[:19]}",
        f"Goal          : {task.get('original_goal', '')[:80]}",
        "═" * 56,
    ]

    # Task decomposition
    decomp = task.get("decomposition", [])
    if decomp:
        lines += ["", "📋 Task decomposition:"]
        for t in decomp:
            t_icon = TASK_STATUS_ICONS.get(t.get("status", ""), "❓")
            lines.append(
                f"  {t_icon} [{t.get('id')}] {t.get('description', '')}"
                f"  ({t.get('status', '')})"
            )

    # Completed work
    summary = pkg.get("completed_work", {}).get("summary", "")
    if summary:
        lines += ["", f"✅ Completed work:", f"  {summary[:200]}"]

    # Decisions
    if decs:
        lines += ["", f"🔒 Closed decisions ({len(decs)}):"]
        for d in decs:
            lines.append(f"  [{d.get('id')}] {d.get('decision', '')[:80]}")
            lines.append(f"       Rationale: {d.get('rationale', '')[:80]}")

    # Artifacts
    if arts:
        lines += ["", f"📁 Artifacts ({len(arts)}):"]
        for a in arts:
            lock_str = " 🔒 LOCKED" if a.get("lock") else ""
            lines.append(
                f"  [{a.get('status', '?')}] {a.get('path', '')}"
                f"{lock_str}"
            )
            if a.get("description"):
                lines.append(f"       {a.get('description', '')[:80]}")

    # Open items
    if opens:
        hi = [o for o in opens if o.get("priority") == "HIGH"]
        lines += ["", f"❓ Open items ({len(opens)}, {len(hi)} HIGH priority):"]
        for o in opens:
            p_icon = "🔴" if o.get("priority") == "HIGH" else \
                     "🟡" if o.get("priority") == "MEDIUM" else "⚪"
            lines.append(
                f"  {p_icon} [{o.get('id')}] {o.get('type', '')}: "
                f"{o.get('question', '')[:80]}"
            )
            blocking = o.get("blocking", [])
            if blocking:
                lines.append(f"       Blocking: {', '.join(blocking)}")

    # Continuation
    if cont.get("entry_point"):
        lines += [
            "",
            "▶️  Continuation instructions:",
            f"  Next task    : {cont.get('next_task_id', 'n/a')}",
            f"  Entry point  : {cont.get('entry_point', '')[:100]}",
        ]
        if cont.get("must_not_touch"):
            lines.append(
                f"  ⛔ Must NOT touch: "
                f"{', '.join(cont.get('must_not_touch', []))}"
            )
        if cont.get("must_resolve_first"):
            lines.append(
                f"  ⚠️  Resolve first: "
                f"{', '.join(cont.get('must_resolve_first', []))}"
            )
        if cont.get("context_files"):
            lines.append(
                f"  📄 Context files: "
                f"{', '.join(cont.get('context_files', []))}"
            )

    # Warnings
    warnings = pkg.get("receiving_agent", {}).get("warnings", [])
    if warnings:
        lines += ["", "⚠️  Warnings for receiving agent:"]
        for w in warnings:
            lines.append(f"  → {w}")

    lines += ["═" * 56, ""]
    return "\n".join(lines)


# ── Commands ──────────────────────────────────────────────────────────────────

def cmd_create(args: argparse.Namespace, handoffs_dir: Path) -> int:
    handoffs_dir.mkdir(parents=True, exist_ok=True)

    # Check for existing package with same task_id
    existing = package_path(args.task_id, handoffs_dir)
    if existing:
        print(f"⚠️  Package already exists for task '{args.task_id}': "
              f"{existing.name}")
        print("Use existing package or choose a different task_id.")
        return 1

    pkg = new_package(args.task_id, args.goal, args.agent_id)

    # Try to capture git info
    try:
        import subprocess
        def git(cmd: list[str]) -> str:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=3)
            return r.stdout.strip()
        pkg["environment"]["active_branch"] = git(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"]
        ) or None
        pkg["environment"]["last_commit"] = git(
            ["git", "rev-parse", "--short", "HEAD"]
        ) or None
    except Exception:
        pass

    ts    = datetime.now().strftime("%Y%m%d_%H%M%S")
    fpath = handoffs_dir / f"handoff_{args.task_id}_{ts}.json"
    fpath.write_text(json.dumps(pkg, indent=2))

    print(f"✅ Handoff package created: {fpath.name}")
    print(f"   Status  : DRAFT")
    print(f"   Task ID : {args.task_id}")
    print(f"   Goal    : {args.goal[:80]}")
    print(f"\nNext: populate the package, then run 'seal' when ready.")
    return 0


def cmd_add_completed(args: argparse.Namespace, handoffs_dir: Path) -> int:
    pkg, path = load_package(args.task_id, handoffs_dir)
    pkg["completed_work"]["summary"] = args.summary
    save_package(pkg, path)
    print(f"✅ Completed work summary updated for '{args.task_id}'")
    return 0


def cmd_add_artifact(args: argparse.Namespace, handoffs_dir: Path) -> int:
    pkg, path = load_package(args.task_id, handoffs_dir)

    checksum = file_checksum(args.path) if args.status == "COMPLETE" else None

    artifact = {
        "path":        args.path,
        "status":      args.status,
        "description": args.description,
        "checksum":    checksum,
        "owner":       pkg.get("created_by", "unknown"),
        "lock":        args.lock,
        "registered_at": now_iso(),
    }

    # Update if already exists, else append
    existing = [
        a for a in pkg["artifacts"]
        if a["path"] == args.path
    ]
    if existing:
        pkg["artifacts"] = [
            artifact if a["path"] == args.path else a
            for a in pkg["artifacts"]
        ]
        print(f"📝 Artifact updated: {args.path}")
    else:
        pkg["artifacts"].append(artifact)
        print(f"📁 Artifact registered: {args.path} [{args.status}]")

    if checksum:
        print(f"   Checksum: {checksum}")

    save_package(pkg, path)
    return 0


def cmd_add_decision(args: argparse.Namespace, handoffs_dir: Path) -> int:
    pkg, path = load_package(args.task_id, handoffs_dir)

    decision_id = f"D{len(pkg['completed_work']['decisions_made']) + 1}"
    decision = {
        "id":                  decision_id,
        "decision":            args.decision,
        "rationale":           args.rationale,
        "alternatives_rejected": (
            args.alternatives.split("|") if args.alternatives else []
        ),
        "decided_at":          now_iso(),
    }
    pkg["completed_work"]["decisions_made"].append(decision)
    save_package(pkg, path)
    print(f"🔒 Decision [{decision_id}] recorded: {args.decision[:80]}")
    return 0


def cmd_add_open_item(args: argparse.Namespace, handoffs_dir: Path) -> int:
    pkg, path = load_package(args.task_id, handoffs_dir)

    item_id = f"O{len(pkg['open_items']) + 1}"
    item = {
        "id":       item_id,
        "type":     args.type,
        "priority": args.priority,
        "question": args.question,
        "context":  args.context or "",
        "blocking": (
            [b.strip() for b in args.blocking.split(",")]
            if args.blocking else []
        ),
        "added_at": now_iso(),
    }
    pkg["open_items"].append(item)
    save_package(pkg, path)

    p_icon = "🔴" if args.priority == "HIGH" else \
             "🟡" if args.priority == "MEDIUM" else "⚪"
    print(f"{p_icon} Open item [{item_id}] added: {args.question[:80]}")
    return 0


def cmd_set_continuation(
    args: argparse.Namespace,
    handoffs_dir: Path,
) -> int:
    pkg, path = load_package(args.task_id, handoffs_dir)

    pkg["continuation"]["next_task_id"]   = args.next_task or ""
    pkg["continuation"]["entry_point"]    = args.entry_point
    pkg["continuation"]["suggested_approach"] = args.approach or ""

    if args.must_not_touch:
        pkg["continuation"]["must_not_touch"] = [
            p.strip() for p in args.must_not_touch.split(",")
        ]
    if args.must_resolve:
        pkg["continuation"]["must_resolve_first"] = [
            i.strip() for i in args.must_resolve.split(",")
        ]
    if args.context_files:
        pkg["continuation"]["context_files"] = [
            f.strip() for f in args.context_files.split(",")
        ]

    save_package(pkg, path)
    print(f"▶️  Continuation set for '{args.task_id}'")
    print(f"   Entry point: {args.entry_point[:100]}")
    return 0


def cmd_seal(args: argparse.Namespace, handoffs_dir: Path) -> int:
    pkg, path = load_package(args.task_id, handoffs_dir)

    print(f"🔍 Validating package '{args.task_id}'...")
    result = validate_package(pkg)

    if result.warnings:
        print(f"\n⚠️  Warnings ({len(result.warnings)}):")
        for w in result.warnings:
            print(f"  → {w}")

    if not result.valid:
        print(f"\n❌ Validation failed ({len(result.errors)} errors):")
        for e in result.errors:
            print(f"  → {e}")
        print("\nPackage NOT sealed. Fix errors and try again.")
        return 1

    # Update all COMPLETE artifact checksums before sealing
    for art in pkg["artifacts"]:
        if art.get("status") == "COMPLETE":
            cs = file_checksum(art["path"])
            if cs:
                art["checksum"] = cs

    transition(pkg, "READY_FOR_HANDOFF")
    pkg["sealed_at"] = now_iso()
    save_package(pkg, path)

    print(f"\n✅ Package sealed: {path.name}")
    print(f"   Status: READY_FOR_HANDOFF")
    print(f"   Artifacts: {len(pkg['artifacts'])}")
    print(f"   Open items: {len(pkg['open_items'])}")
    print(f"   Expires at: {pkg.get('expires_at', 'n/a')[:19]}")
    return 0


def cmd_read(args: argparse.Namespace, handoffs_dir: Path) -> int:
    pkg, path = load_package(args.task_id, handoffs_dir)

    # Check expiry
    expires_at = pkg.get("expires_at")
    if expires_at:
        try:
            exp = datetime.fromisoformat(expires_at)
            if datetime.now(timezone.utc) > exp \
                    and pkg.get("status") == "READY_FOR_HANDOFF":
                pkg["status"] = "EXPIRED"
                save_package(pkg, path)
                print("⌛ Warning: this package has expired (unclaimed past TTL)")
        except ValueError:
            pass

    # Validate on read
    result = validate_package(pkg)
    if not result.valid:
        print("⚠️  Package has validation errors:")
        for e in result.errors:
            print(f"  → {e}")

    print(render_package_summary(pkg))
    return 0


def cmd_claim(args: argparse.Namespace, handoffs_dir: Path) -> int:
    pkg, path = load_package(args.task_id, handoffs_dir)

    if pkg.get("status") != "READY_FOR_HANDOFF":
        print(
            f"❌ Cannot claim: package status is '{pkg.get('status')}', "
            f"expected 'READY_FOR_HANDOFF'",
            file=sys.stderr
        )
        return 2

    # Check if already claimed by someone else
    if pkg.get("claimed_by") and pkg.get("claimed_by") != args.agent_id:
        print(
            f"❌ Package already claimed by '{pkg.get('claimed_by')}'",
            file=sys.stderr
        )
        return 2

    transition(pkg, "CLAIMED", args.agent_id)
    pkg["claimed_by"] = args.agent_id
    pkg["claimed_at"] = now_iso()
    save_package(pkg, path)

    print(f"🤝 Package claimed by '{args.agent_id}'")
    print(f"   Task ID: {args.task_id}")
    print(f"   Entry point: "
          f"{pkg.get('continuation', {}).get('entry_point', 'n/a')[:100]}")

    # Print warnings for receiving agent
    warnings = pkg.get("receiving_agent", {}).get("warnings", [])
    if warnings:
        print("\n⚠️  Warnings:")
        for w in warnings:
            print(f"  → {w}")
    return 0


def cmd_checkpoint(args: argparse.Namespace, handoffs_dir: Path) -> int:
    pkg, path = load_package(args.task_id, handoffs_dir)

    current_status = pkg.get("status", "DRAFT")
    if current_status == "CLAIMED":
        try:
            transition(pkg, "IN_PROGRESS")
        except ValueError as e:
            print(f"⚠️ Could not transition to IN_PROGRESS: {e}")
    elif current_status not in ("CLAIMED", "IN_PROGRESS"):
        print(f"⚠️ Warning: checkpoint recorded while status is '{current_status}' (not CLAIMED or IN_PROGRESS)")

    # Update decomposition if matched
    decomp = pkg.setdefault("task", {}).setdefault("decomposition", [])
    found = False
    for item in decomp:
        if item.get("id") == args.subtask_id:
            item["status"] = args.status
            found = True
            break

    if not found:
        new_step = {
            "id": args.subtask_id,
            "description": args.note or f"Subtask {args.subtask_id}",
            "status": args.status
        }
        decomp.append(new_step)
        print(f"📝 Subtask '{args.subtask_id}' not found in decomposition, added it.")

    # Append checkpoint log
    checkpoint_log = {
        "timestamp": now_iso(),
        "subtask_id": args.subtask_id,
        "status": args.status,
        "note": args.note or ""
    }
    pkg.setdefault("checkpoints", []).append(checkpoint_log)
    save_package(pkg, path)

    print(f"✅ Checkpoint added for subtask '{args.subtask_id}': status={args.status}")
    return 0


def cmd_complete(args: argparse.Namespace, handoffs_dir: Path) -> int:
    pkg, path = load_package(args.task_id, handoffs_dir)

    current_status = pkg.get("status", "DRAFT")

    try:
        if current_status == "READY_FOR_HANDOFF":
            transition(pkg, "CLAIMED")
            transition(pkg, "IN_PROGRESS")
        elif current_status == "CLAIMED":
            transition(pkg, "IN_PROGRESS")

        transition(pkg, "COMPLETED")
    except ValueError:
        pkg["status"] = "COMPLETED"
        pkg["status_changed_at"] = now_iso()

    if args.summary:
        pkg["completed_work"]["summary"] = args.summary

    # Archive the package
    archive_dir = handoffs_dir / ARCHIVE_DIR
    archive_dir.mkdir(parents=True, exist_ok=True)

    dest_path = archive_dir / path.name

    save_package(pkg, path)

    try:
        path.rename(dest_path)
        print(f"✅ Task '{args.task_id}' marked COMPLETED and archived to {ARCHIVE_DIR}/{path.name}")
    except OSError as e:
        print(f"⚠️ Saved package but failed to move to archive directory: {e}")
        return 1

    return 0


def cmd_lock_artifact(args: argparse.Namespace, handoffs_dir: Path) -> int:
    pkg, path = load_package(args.task_id, handoffs_dir)

    found = False
    for art in pkg.setdefault("artifacts", []):
        if art.get("path") == args.path:
            art["lock"] = True
            if args.agent_id:
                art["owner"] = args.agent_id
            found = True
            break

    if not found:
        new_art = {
            "path": args.path,
            "status": "IN_PROGRESS",
            "description": "Registered via lock",
            "checksum": None,
            "owner": args.agent_id or pkg.get("created_by", "unknown"),
            "lock": True,
            "registered_at": now_iso()
        }
        pkg["artifacts"].append(new_art)

    save_package(pkg, path)
    print(f"🔒 Advisory lock set on: {args.path}")
    return 0


def cmd_unlock_artifact(args: argparse.Namespace, handoffs_dir: Path) -> int:
    pkg, path = load_package(args.task_id, handoffs_dir)

    found = False
    for art in pkg.setdefault("artifacts", []):
        if art.get("path") == args.path:
            art["lock"] = False
            found = True
            break

    if not found:
        print(f"⚠️ Artifact '{args.path}' not found in package.")
        return 1

    save_package(pkg, path)
    print(f"🔓 Advisory lock released on: {args.path}")
    return 0


def cmd_resolve_conflict(args: argparse.Namespace, handoffs_dir: Path) -> int:
    pkg, path = load_package(args.task_id, handoffs_dir)

    found = False
    for art in pkg.setdefault("artifacts", []):
        if art.get("path") == args.artifact:
            current_cs = file_checksum(args.artifact)
            if current_cs:
                art["checksum"] = current_cs
                art["status"] = "COMPLETE"
                art["lock"] = False
                print(f"✅ Checksum updated for '{args.artifact}' to match disk state: {current_cs}")
            else:
                art["checksum"] = None
                print(f"⚠️ File '{args.artifact}' not found on disk. Checksum cleared.")

            notes = f"Conflict resolved using winner={args.winner} at {now_iso()}"
            art["description"] = (art.get("description") or "") + f" ({notes})"
            found = True
            break

    if not found:
        print(f"❌ Artifact '{args.artifact}' not registered in package.")
        return 1

    save_package(pkg, path)
    return 0


def cmd_emergency(args: argparse.Namespace, handoffs_dir: Path) -> int:
    snap_pattern = f"snapshot_{args.task_id}_*.json"
    snaps = list(handoffs_dir.glob(snap_pattern))
    if not snaps:
        print(f"❌ No snapshot found matching '{snap_pattern}' in {handoffs_dir}")
        print("Please run state_serializer.py first to create a snapshot.")
        return 2

    snaps.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    latest_snap_path = snaps[0]
    print(f"📦 Found latest snapshot: {latest_snap_path.name}")

    try:
        snap_data = json.loads(latest_snap_path.read_text())
    except (json.JSONDecodeError, OSError) as e:
        print(f"❌ Failed to parse snapshot file: {e}")
        return 2

    existing_pkg = None
    existing_path = package_path(args.task_id, handoffs_dir)
    if existing_path:
        try:
            existing_pkg = json.loads(existing_path.read_text())
        except Exception:
            pass

    goal = existing_pkg.get("task", {}).get("original_goal", "") if existing_pkg else f"Emergency handoff for task {args.task_id}"
    agent_id = snap_data.get("created_by") or "emergency-agent"

    pkg = new_package(args.task_id, goal, agent_id)

    pkg["status"] = "DRAFT"
    pkg["completed_work"]["summary"] = (
        f"Emergency handoff initiated at {now_iso()}. "
        f"Reason: {args.reason or 'context-budget-exhaustion'}. "
        f"Workspace state captured automatically."
    )

    dirty_files = snap_data.get("git_dirty_files", [])
    if dirty_files:
        pkg.setdefault("receiving_agent", {}).setdefault("warnings", []).append(
            f"Git workspace has modified/dirty files: {', '.join(dirty_files)}"
        )

    for snap_art in snap_data.get("artifacts", []):
        rel_path = snap_art.get("path")
        checksum = snap_art.get("checksum")
        is_dirty = rel_path in dirty_files
        status = "IN_PROGRESS" if is_dirty else "COMPLETE"

        art = {
            "path": rel_path,
            "status": status,
            "description": "Recovered from snapshot",
            "checksum": checksum,
            "owner": agent_id,
            "lock": is_dirty,
            "registered_at": now_iso()
        }
        pkg["artifacts"].append(art)

    pkg["environment"]["working_directory"] = snap_data.get("working_dir") or str(Path.cwd())
    pkg["environment"]["active_branch"] = snap_data.get("git_branch")
    pkg["environment"]["last_commit"] = snap_data.get("git_commit")
    pkg["environment"]["relevant_env_vars"] = snap_data.get("env_vars_present", [])

    pkg["continuation"]["entry_point"] = (
        f"Resume from emergency snapshot. Check modified files: {', '.join(dirty_files) or 'none'}."
    )
    if dirty_files:
        pkg["continuation"]["context_files"] = dirty_files
        pkg["continuation"]["suggested_approach"] = (
            "Review the dirty files, complete the in-progress edits, and commit them."
        )

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    fpath = handoffs_dir / f"handoff_{args.task_id}_{ts}.json"

    if existing_path and existing_path.exists():
        try:
            archive_dir = handoffs_dir / ARCHIVE_DIR
            archive_dir.mkdir(parents=True, exist_ok=True)
            existing_path.rename(archive_dir / existing_path.name)
            print(f"📦 Archived old handoff package: {existing_path.name}")
        except Exception as e:
            print(f"⚠️ Failed to archive old package: {e}")

    print("🔍 Validating emergency handoff package...")
    result = validate_package(pkg)

    if not result.valid:
        print(f"⚠️ Emergency package has validation errors, saving as DRAFT:")
        for e in result.errors:
            print(f"  → {e}")
        pkg["status"] = "DRAFT"
    else:
        pkg["status"] = "READY_FOR_HANDOFF"
        pkg["sealed_at"] = now_iso()
        print("✅ Emergency package validated and set to READY_FOR_HANDOFF")

    fpath.write_text(json.dumps(pkg, indent=2))
    print(f"💾 Emergency handoff package saved to: {fpath.name}")
    return 0


def cmd_list(args: argparse.Namespace, handoffs_dir: Path) -> int:
    packages = []
    if not handoffs_dir.exists():
        print(f"🔍 No handoff directory found at {handoffs_dir}")
        return 0

    for p in handoffs_dir.glob(HANDOFF_GLOB):
        try:
            data = json.loads(p.read_text())
            packages.append((p, data))
        except Exception:
            continue

    if not packages:
        print(f"🔍 No active handoff packages found in {handoffs_dir}")
        return 0

    packages.sort(key=lambda item: item[1].get("updated_at", ""), reverse=True)

    print(f"\n📬 Active Handoff Packages in {handoffs_dir}")
    print("═" * 90)
    print(f"{'Task ID':<30} | {'Status':<18} | {'Created By':<15} | {'Updated At':<20}")
    print("─" * 90)
    for p, pkg in packages:
        status = pkg.get("status", "UNKNOWN")
        icon = STATUS_ICONS.get(status, "❓")
        status_str = f"{icon} {status}"
        print(f"{pkg.get('task_id', 'n/a'):<30} | {status_str:<18} | {pkg.get('created_by', 'n/a'):<15} | {pkg.get('updated_at', '')[:19]}")
    print("═" * 90)
    print()
    return 0


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Agent Handoff Protocol Manager")
    parser.add_argument("--handoffs-dir", default=".agent/handoffs",
                        help="Directory for handoff packages")
    sub = parser.add_subparsers(dest="command", required=True)

    # 1. create
    p_create = sub.add_parser("create", help="Create a new DRAFT handoff package")
    p_create.add_argument("--task-id", required=True)
    p_create.add_argument("--goal", required=True)
    p_create.add_argument("--agent-id", required=True)
    p_create.add_argument("--output-dir")

    # 2. add-completed
    p_add_comp = sub.add_parser("add-completed", help="Record completed work summary")
    p_add_comp.add_argument("--task-id", required=True)
    p_add_comp.add_argument("--summary", required=True)

    # 3. add-artifact
    p_add_art = sub.add_parser("add-artifact", help="Register a file artifact")
    p_add_art.add_argument("--task-id", required=True)
    p_add_art.add_argument("--path", required=True)
    p_add_art.add_argument("--status", choices=ARTIFACT_STATUSES, default="COMPLETE")
    p_add_art.add_argument("--description", default="")
    p_add_art.add_argument("--lock", action="store_true")

    # 4. add-decision
    p_add_dec = sub.add_parser("add-decision", help="Record a closed decision with rationale")
    p_add_dec.add_argument("--task-id", required=True)
    p_add_dec.add_argument("--decision", required=True)
    p_add_dec.add_argument("--rationale", required=True)
    p_add_dec.add_argument("--alternatives", default="")

    # 5. add-open-item
    p_add_open = sub.add_parser("add-open-item", help="Add an open question or blocker")
    p_add_open.add_argument("--task-id", required=True)
    p_add_open.add_argument("--type", choices=OPEN_ITEM_TYPES, required=True)
    p_add_open.add_argument("--priority", choices=PRIORITY_LEVELS, default="MEDIUM")
    p_add_open.add_argument("--question", required=True)
    p_add_open.add_argument("--context", default="")
    p_add_open.add_argument("--blocking", default="")

    # 6. set-continuation
    p_set_cont = sub.add_parser("set-continuation", help="Set entry point for receiving agent")
    p_set_cont.add_argument("--task-id", required=True)
    p_set_cont.add_argument("--next-task")
    p_set_cont.add_argument("--entry-point", required=True)
    p_set_cont.add_argument("--approach")
    p_set_cont.add_argument("--must-not-touch")
    p_set_cont.add_argument("--must-resolve")
    p_set_cont.add_argument("--context-files")

    # 7. seal
    p_seal = sub.add_parser("seal", help="Validate and seal package (READY_FOR_HANDOFF)")
    p_seal.add_argument("--task-id", required=True)

    # 8. read
    p_read = sub.add_parser("read", help="Read and display a package summary")
    p_read.add_argument("--task-id", required=True)

    # 9. claim
    p_claim = sub.add_parser("claim", help="Claim a package as receiving agent")
    p_claim.add_argument("--task-id", required=True)
    p_claim.add_argument("--agent-id", required=True)

    # 10. checkpoint
    p_check = sub.add_parser("checkpoint", help="Record a progress update during execution")
    p_check.add_argument("--task-id", required=True)
    p_check.add_argument("--subtask-id", required=True)
    p_check.add_argument("--status", choices={"DONE", "IN_PROGRESS", "NOT_STARTED", "BLOCKED"}, required=True)
    p_check.add_argument("--note", default="")

    # 11. complete
    p_comp = sub.add_parser("complete", help="Mark task as COMPLETED and archive package")
    p_comp.add_argument("--task-id", required=True)
    p_comp.add_argument("--summary")

    # 12. lock-artifact
    p_lock = sub.add_parser("lock-artifact", help="Set advisory lock on a file")
    p_lock.add_argument("--task-id", required=True)
    p_lock.add_argument("--path", required=True)
    p_lock.add_argument("--agent-id")

    # 13. unlock-artifact
    p_unlock = sub.add_parser("unlock-artifact", help="Release advisory lock on a file")
    p_unlock.add_argument("--task-id", required=True)
    p_unlock.add_argument("--path", required=True)

    # 14. resolve-conflict
    p_res = sub.add_parser("resolve-conflict", help="Resolve an artifact checksum conflict")
    p_res.add_argument("--task-id", required=True)
    p_res.add_argument("--artifact", required=True)
    p_res.add_argument("--winner", choices={"agent-a", "agent-b", "manual"}, default="manual")

    # 15. emergency
    p_emerg = sub.add_parser("emergency", help="Create emergency handoff from state snapshot")
    p_emerg.add_argument("--task-id", required=True)
    p_emerg.add_argument("--reason", default="context-budget-exhaustion")

    # 16. list
    p_list = sub.add_parser("list", help="List all active handoff packages")

    args = parser.parse_args()

    h_dir = Path(args.output_dir if (hasattr(args, "output_dir") and args.output_dir) else args.handoffs_dir)

    try:
        if args.command == "create":
            sys.exit(cmd_create(args, h_dir))
        elif args.command == "add-completed":
            sys.exit(cmd_add_completed(args, h_dir))
        elif args.command == "add-artifact":
            sys.exit(cmd_add_artifact(args, h_dir))
        elif args.command == "add-decision":
            sys.exit(cmd_add_decision(args, h_dir))
        elif args.command == "add-open-item":
            sys.exit(cmd_add_open_item(args, h_dir))
        elif args.command == "set-continuation":
            sys.exit(cmd_set_continuation(args, h_dir))
        elif args.command == "seal":
            sys.exit(cmd_seal(args, h_dir))
        elif args.command == "read":
            sys.exit(cmd_read(args, h_dir))
        elif args.command == "claim":
            sys.exit(cmd_claim(args, h_dir))
        elif args.command == "checkpoint":
            sys.exit(cmd_checkpoint(args, h_dir))
        elif args.command == "complete":
            sys.exit(cmd_complete(args, h_dir))
        elif args.command == "lock-artifact":
            sys.exit(cmd_lock_artifact(args, h_dir))
        elif args.command == "unlock-artifact":
            sys.exit(cmd_unlock_artifact(args, h_dir))
        elif args.command == "resolve-conflict":
            sys.exit(cmd_resolve_conflict(args, h_dir))
        elif args.command == "emergency":
            sys.exit(cmd_emergency(args, h_dir))
        elif args.command == "list":
            sys.exit(cmd_list(args, h_dir))
    except Exception as e:
        print(f"handoff_manager ⚠️  Error: {e}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
