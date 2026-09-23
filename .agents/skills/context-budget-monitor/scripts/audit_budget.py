#!/usr/bin/env python3
"""
audit_budget.py
Audits all installed skills and produces a token budget report.

Exit codes:
  0 — NOMINAL  (≤50% budget used by skills metadata)
  1 — WARN     (51–85%)
  2 — ALERT    (86–95%)
  3 — OVERFLOW (>95%)
  4 — Error
"""

import sys
import json
import argparse
from pathlib import Path
from dataclasses import dataclass, field, asdict

# Reuse estimator from sibling script
sys.path.insert(0, str(Path(__file__).parent))
from estimate_tokens import estimate


# ── Config ────────────────────────────────────────────────────────────────────

DEFAULT_MODEL_LIMIT    = 1_000_000   # tokens
SYSTEM_PROMPT_RESERVE  =     3_000   # platform system prompt estimate
CONVERSATION_RESERVE   =    10_000   # typical ongoing conversation overhead

THRESHOLDS = {
    "NOMINAL":  (0,    50),
    "MONITOR":  (51,   70),
    "WARN":     (71,   85),
    "ALERT":    (86,   95),
    "OVERFLOW": (96,  100),
}

STATE_ICONS = {
    "NOMINAL":  "🟢",
    "MONITOR":  "🟡",
    "WARN":     "🟠",
    "ALERT":    "🔴",
    "OVERFLOW": "⛔",
}

HEAVY_SKILL_THRESHOLD = 5_000   # tokens — full content


# ── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class SkillAudit:
    name:             str
    path:             str
    scope:            str          # "local" | "global"
    meta_tokens:      int          # description field only
    full_tokens:      int          # entire SKILL.md + scripts
    has_scripts:      bool
    last_modified:    str
    warnings:         list[str] = field(default_factory=list)


@dataclass
class BudgetReport:
    model_limit:          int
    system_reserve:       int
    conversation_reserve: int
    skills_meta_total:    int
    skills_full_total:    int
    estimated_used:       int
    remaining:            int
    usage_pct:            float
    state:                str
    skills:               list[SkillAudit] = field(default_factory=list)
    recommendations:      list[str]        = field(default_factory=list)


# ── Skill scanner ─────────────────────────────────────────────────────────────

def scan_skill(skill_dir: Path, scope: str) -> SkillAudit | None:
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        return None

    try:
        content = skill_md.read_text(errors="replace")
    except OSError:
        return None

    # Extract description for metadata estimate
    meta_text = ""
    in_frontmatter = False
    for line in content.splitlines():
        if line.strip() == "---":
            in_frontmatter = not in_frontmatter
            continue
        if in_frontmatter:
            meta_text += line + "\n"

    meta_tokens = estimate(meta_text).token_estimate if meta_text else 100
    full_tokens = estimate(content).token_estimate

    # Include scripts
    scripts_dir  = skill_dir / "scripts"
    has_scripts  = scripts_dir.exists() and any(scripts_dir.iterdir())
    if has_scripts:
        for script in scripts_dir.rglob("*"):
            if script.is_file():
                try:
                    full_tokens += estimate(
                        script.read_text(errors="replace")
                    ).token_estimate
                except OSError:
                    pass

    import datetime
    last_mod = datetime.datetime.fromtimestamp(
        skill_md.stat().st_mtime
    ).strftime("%Y-%m-%d")

    warnings = []
    if full_tokens > HEAVY_SKILL_THRESHOLD:
        warnings.append(
            f"Heavy skill ({full_tokens:,}t full content) — consider splitting"
        )
    if meta_tokens > 500:
        warnings.append(
            f"Large description ({meta_tokens}t) — increases metadata load every session"
        )

    return SkillAudit(
        name=skill_dir.name,
        path=str(skill_dir),
        scope=scope,
        meta_tokens=meta_tokens,
        full_tokens=full_tokens,
        has_scripts=has_scripts,
        last_modified=last_mod,
        warnings=warnings,
    )


def scan_skills_dir(skills_dir: Path, scope: str) -> list[SkillAudit]:
    if not skills_dir.exists():
        return []
    audits = []
    for entry in sorted(skills_dir.iterdir()):
        if entry.is_dir():
            audit = scan_skill(entry, scope)
            if audit:
                audits.append(audit)
    return audits


# ── Budget calculator ─────────────────────────────────────────────────────────

def calculate_budget(
    skills:       list[SkillAudit],
    model_limit:  int,
    conversation: int,
) -> BudgetReport:

    meta_total = sum(s.meta_tokens for s in skills)
    full_total = sum(s.full_tokens for s in skills)

    # Metadata is ALWAYS loaded; full content only on activation
    # We estimate "typical session" as metadata + ~30% of skills activated
    activated_estimate = int(full_total * 0.3)
    estimated_used = (
        SYSTEM_PROMPT_RESERVE
        + meta_total
        + activated_estimate
        + conversation
    )
    remaining  = max(model_limit - estimated_used, 0)
    usage_pct  = round((estimated_used / model_limit) * 100, 1)

    state = "NOMINAL"
    for s, (lo, hi) in THRESHOLDS.items():
        if lo <= usage_pct <= hi:
            state = s
            break

    # Sort by meta_tokens descending for display
    skills_sorted = sorted(skills, key=lambda x: x.meta_tokens, reverse=True)

    recommendations = _build_recommendations(
        skills_sorted, state, meta_total, model_limit
    )

    return BudgetReport(
        model_limit=model_limit,
        system_reserve=SYSTEM_PROMPT_RESERVE,
        conversation_reserve=conversation,
        skills_meta_total=meta_total,
        skills_full_total=full_total,
        estimated_used=estimated_used,
        remaining=remaining,
        usage_pct=usage_pct,
        state=state,
        skills=skills_sorted,
        recommendations=recommendations,
    )


def _build_recommendations(
    skills: list[SkillAudit],
    state:  str,
    meta_total: int,
    model_limit: int,
) -> list[str]:
    recs = []

    heavy = [s for s in skills if s.full_tokens > HEAVY_SKILL_THRESHOLD]
    for s in heavy[:3]:
        recs.append(
            f"Split '{s.name}' ({s.full_tokens:,}t full) into focused sub-skills"
        )

    if state in ("ALERT", "OVERFLOW"):
        recs.append(
            "Start a new session to reset conversation overhead immediately"
        )

    if state in ("WARN", "ALERT", "OVERFLOW"):
        recs.append(
            "Run 'skill-deduplication-audit' to find overlapping skills"
        )
        recs.append(
            "Run 'ephemeral-skill-cleanup' to archive unused project skills"
        )

    if meta_total > 15_000:
        recs.append(
            f"Metadata total ({meta_total:,}t) is high — "
            f"consider reducing skill descriptions or archiving inactive skills"
        )

    if not recs:
        recs.append("No action required. Budget is healthy ✅")

    return recs


# ── Report renderer ───────────────────────────────────────────────────────────

def render_report(report: BudgetReport) -> str:
    icon  = STATE_ICONS.get(report.state, "?")
    lines = [
        "",
        "📦 Context Budget Report",
        "═" * 56,
        f"Session state   : {icon} {report.state} ({report.usage_pct}% estimated used)",
        f"Model limit     : {report.model_limit:>12,} tokens",
        f"System reserve  : {report.system_reserve:>12,} tokens",
        f"Skills metadata : {report.skills_meta_total:>12,} tokens  ← always loaded",
        f"Skills (30% act): {int(report.skills_full_total * 0.3):>12,} tokens  ← estimated",
        f"Conversation    : {report.conversation_reserve:>12,} tokens",
        f"─" * 56,
        f"Estimated used  : {report.estimated_used:>12,} tokens",
        f"Remaining       : {report.remaining:>12,} tokens",
        "═" * 56,
        "",
        f"📊 Installed Skills ({len(report.skills)} total):",
        "",
        f"  {'#':<4} {'Skill name':<32} {'Meta':>6}  {'Full':>8}  Scope",
        f"  {'─'*4} {'─'*32} {'─'*6}  {'─'*8}  {'─'*6}",
    ]

    for i, s in enumerate(report.skills, start=1):
        warn_flag = " ⚠️" if s.warnings else ""
        lines.append(
            f"  {i:<4} {s.name:<32} {s.meta_tokens:>5}t  "
            f"{s.full_tokens:>7}t  {s.scope}{warn_flag}"
        )

    # Warnings
    warned_skills = [s for s in report.skills if s.warnings]
    if warned_skills:
        lines += ["", "⚠️  Skill warnings:"]
        for s in warned_skills:
            for w in s.warnings:
                lines.append(f"  → {s.name}: {w}")

    # Recommendations
    lines += ["", "💡 Recommendations:"]
    for i, rec in enumerate(report.recommendations, start=1):
        lines.append(f"  {i}. {rec}")

    lines += ["", "═" * 56, ""]
    return "\n".join(lines)


# ── Exit code mapper ──────────────────────────────────────────────────────────

EXIT_CODES = {
    "NOMINAL":  0,
    "MONITOR":  0,
    "WARN":     1,
    "ALERT":    2,
    "OVERFLOW": 3,
}


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Context Budget Monitor")
    parser.add_argument("--skills-dir",        required=True,
                        help="Path to local .agent/skills directory")
    parser.add_argument("--global-skills-dir", default=None,
                        help="Path to global ~/.agent/skills directory")
    parser.add_argument("--model-limit",       type=int,
                        default=DEFAULT_MODEL_LIMIT,
                        help=f"Model context limit in tokens (default: {DEFAULT_MODEL_LIMIT:,})")
    parser.add_argument("--conversation",      type=int,
                        default=CONVERSATION_RESERVE,
                        help="Estimated conversation token overhead")
    parser.add_argument("--json",              action="store_true",
                        help="Output full report as JSON")
    args = parser.parse_args()

    try:
        skills = scan_skills_dir(Path(args.skills_dir), scope="local")
        if args.global_skills_dir:
            skills += scan_skills_dir(
                Path(args.global_skills_dir).expanduser(), scope="global"
            )

        report = calculate_budget(
            skills=skills,
            model_limit=args.model_limit,
            conversation=args.conversation,
        )

        if args.json:
            print(json.dumps(asdict(report), indent=2))
        else:
            print(render_report(report))

        sys.exit(EXIT_CODES.get(report.state, 4))

    except Exception as e:
        print(f"context-budget-monitor ⚠️  Error: {e}", file=sys.stderr)
        sys.exit(4)


if __name__ == "__main__":
    main()
