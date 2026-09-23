#!/usr/bin/env python3
"""
find_duplicates.py
Analyzes all installed skills for overlap, duplication, and instruction
conflicts. Produces a ranked report of problematic skill pairs.

Exit codes:
  0 — No issues found
  1 — TYPE 2 or TYPE 3 issues found (warnings)
  2 — TYPE 1 or TYPE 4 issues found (action required)
  3 — Error
"""

import re
import sys
import json
import argparse
from pathlib import Path
from itertools import combinations
from dataclasses import dataclass, field, asdict


# ── Config ────────────────────────────────────────────────────────────────────

THRESHOLDS = {
    "description_jaccard": 0.30,   # trigram similarity on description
    "trigger_keyword":     0.40,   # shared trigger keyword ratio
    "exact_duplicate":     0.85,   # overall score → TYPE 1
    "conflict":            0.60,   # polarity conflict weight → TYPE 4
}

# Modal verbs indicating strong instructions
POSITIVE_MODALS = {"always", "must", "shall", "do", "ensure", "require"}
NEGATIVE_MODALS = {"never", "must not", "should not", "do not", "avoid",
                   "disallow", "prohibit", "forbid"}

# Stopwords to exclude from keyword extraction
STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "be", "been", "was", "were",
    "this", "that", "it", "its", "use", "used", "using", "when", "if",
    "all", "any", "as", "not", "no", "new", "file", "files", "code",
}

SEVERITY_ICONS = {1: "⚪", 2: "🟡", 3: "🟠", 4: "🔴"}
TYPE_LABELS = {
    1: "EXACT DUPLICATE",
    2: "PARTIAL OVERLAP",
    3: "TRIGGER COLLISION",
    4: "INSTRUCTION CONFLICT",
}


# ── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class SkillIndex:
    name:          str
    path:          str
    scope:         str
    description:   str
    trigger_text:  str
    imperatives:   list[str]    # sentences with modal verbs
    full_text:     str
    dedup_exempt:  list[str] = field(default_factory=list)


@dataclass
class OverlapResult:
    skill_a:          str
    skill_b:          str
    overlap_type:     int        # 1–4
    score:            float
    description_sim:  float
    trigger_overlap:  float
    conflicts:        list[str]  = field(default_factory=list)
    shared_keywords:  list[str]  = field(default_factory=list)
    recommended_action: str      = ""


# ── Text utilities ────────────────────────────────────────────────────────────

def trigrams(text: str) -> set[str]:
    t = re.sub(r"\s+", " ", text.lower().strip())
    return {t[i:i+3] for i in range(len(t) - 2)}


def jaccard(a: set, b: set) -> float:
    if not a and not b:
        return 0.0
    return len(a & b) / len(a | b)


def extract_keywords(text: str) -> set[str]:
    words = re.findall(r"\b[a-z][a-z0-9_-]{2,}\b", text.lower())
    return {w for w in words if w not in STOPWORDS}


def extract_frontmatter_field(text: str, field_name: str) -> str:
    """Extract a field value from YAML frontmatter."""
    in_fm = False
    result_lines = []
    capturing = False

    for line in text.splitlines():
        if line.strip() == "---":
            if not in_fm:
                in_fm = True
                continue
            else:
                break
        if not in_fm:
            continue

        if line.startswith(f"{field_name}:"):
            val = line[len(field_name)+1:].strip()
            if val.startswith("|"):
                capturing = True
            else:
                result_lines.append(val.strip("'\""))
        elif capturing:
            if line.startswith(" ") or line.startswith("\t"):
                result_lines.append(line.strip())
            else:
                capturing = False

    return " ".join(result_lines)


def extract_section(text: str, heading: str) -> str:
    """Extract content under a markdown heading."""
    lines    = text.splitlines()
    result   = []
    in_sec   = False
    h_level  = heading.count("#")

    for line in lines:
        if line.strip().lower().startswith(heading.lower()):
            in_sec = True
            continue
        if in_sec:
            # Stop at next heading of same or higher level
            m = re.match(r"^(#{1,6})\s", line)
            if m and len(m.group(1)) <= h_level:
                break
            result.append(line)

    return "\n".join(result)


def extract_imperatives(text: str) -> list[str]:
    """Extract sentences containing strong modal verbs."""
    sentences = re.split(r"(?<=[.!?])\s+", text)
    result    = []
    all_modals = POSITIVE_MODALS | NEGATIVE_MODALS | {"should"}
    for s in sentences:
        sl = s.lower()
        if any(f" {m} " in f" {sl} " for m in all_modals):
            result.append(s.strip())
    return result


def detect_conflicts(
    imperatives_a: list[str],
    imperatives_b: list[str],
) -> list[str]:
    """
    Find pairs of imperative sentences that contradict each other.
    Strategy: if skill A says MUST X and skill B says MUST NOT X
    (where X shares significant keyword overlap), flag as conflict.
    """
    conflicts = []

    def modal_polarity(sentence: str) -> tuple[str, set[str]]:
        sl = sentence.lower()
        polarity = "positive"
        for neg in NEGATIVE_MODALS:
            if neg in sl:
                polarity = "negative"
                break
        keywords = extract_keywords(sentence) - STOPWORDS
        return polarity, keywords

    for sa in imperatives_a:
        pol_a, kw_a = modal_polarity(sa)
        for sb in imperatives_b:
            pol_b, kw_b = modal_polarity(sb)
            shared = kw_a & kw_b
            # Conflict: opposing polarity + significant keyword overlap
            if pol_a != pol_b and len(shared) >= 2:
                conflicts.append(
                    f"CONFLICT:\n"
                    f"  A: {sa[:100]}\n"
                    f"  B: {sb[:100]}\n"
                    f"  Shared subject: {', '.join(list(shared)[:5])}"
                )

    return conflicts


# ── Skill loader ──────────────────────────────────────────────────────────────

def load_skill(skill_dir: Path, scope: str) -> SkillIndex | None:
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        return None
    try:
        text = skill_md.read_text(errors="replace")
    except OSError:
        return None

    description  = extract_frontmatter_field(text, "description")
    trigger_text = extract_section(text, "## When to activate")
    imperatives  = extract_imperatives(text)
    full_text    = text

    # Check for dedup_exempt in frontmatter
    exempt_raw  = extract_frontmatter_field(text, "dedup_exempt")
    dedup_exempt = [e.strip() for e in exempt_raw.split(",") if e.strip()]

    return SkillIndex(
        name=skill_dir.name,
        path=str(skill_dir),
        scope=scope,
        description=description,
        trigger_text=trigger_text,
        imperatives=imperatives,
        full_text=full_text,
        dedup_exempt=dedup_exempt,
    )


def load_all_skills(
    local_dir:  Path,
    global_dir: Path | None,
) -> list[SkillIndex]:
    skills = []
    for d in sorted(local_dir.iterdir()):
        if d.is_dir():
            s = load_skill(d, "local")
            if s:
                skills.append(s)
    if global_dir and global_dir.exists():
        for d in sorted(global_dir.iterdir()):
            if d.is_dir():
                s = load_skill(d, "global")
                if s:
                    skills.append(s)
    return skills


# ── Pairwise analysis ─────────────────────────────────────────────────────────

def analyze_pair(a: SkillIndex, b: SkillIndex) -> OverlapResult | None:
    # Skip exempt pairs
    if b.name in a.dedup_exempt or a.name in b.dedup_exempt:
        return None

    # ── Signal 1: description Jaccard ────────────────────────────────────────
    tg_a = trigrams(a.description)
    tg_b = trigrams(b.description)
    desc_sim = jaccard(tg_a, tg_b)

    # ── Signal 2: trigger keyword overlap ────────────────────────────────────
    kw_a = extract_keywords(a.description + " " + a.trigger_text)
    kw_b = extract_keywords(b.description + " " + b.trigger_text)
    shared_kw = sorted(kw_a & kw_b)
    trigger_overlap = jaccard(kw_a, kw_b)

    # ── Signal 3: instruction polarity conflicts ──────────────────────────────
    conflicts = detect_conflicts(a.imperatives, b.imperatives)

    # ── Overall score (weighted) ──────────────────────────────────────────────
    conflict_weight = min(len(conflicts) * 0.15, 0.40)
    score = (
        desc_sim       * 0.40 +
        trigger_overlap * 0.35 +
        conflict_weight * 0.25
    )

    # Skip pairs with negligible overlap
    if (score < 0.20
            and not conflicts
            and desc_sim < THRESHOLDS["description_jaccard"]
            and trigger_overlap < THRESHOLDS["trigger_keyword"]):
        return None

    # ── Classify type ─────────────────────────────────────────────────────────
    if score >= THRESHOLDS["exact_duplicate"]:
        overlap_type = 1
        action = (
            f"Archive the older skill immediately. "
            f"Saves ~{len(a.full_text)//4 :,} tokens/session."
        )
    elif conflicts and conflict_weight >= 0.25:
        overlap_type = 4
        action = (
            "Resolve contradicting instructions immediately. "
            "Merge into one authoritative skill or remove conflicting rule."
        )
    elif trigger_overlap >= THRESHOLDS["trigger_keyword"] and desc_sim < 0.50:
        overlap_type = 3
        action = (
            f"Narrow trigger scope: remove shared keywords "
            f"({', '.join(shared_kw[:4])}) from one skill's description."
        )
    else:
        overlap_type = 2
        action = (
            "Run merge_suggestion.py to generate a unified skill draft. "
            "Extract shared content into a base skill."
        )

    return OverlapResult(
        skill_a=a.name,
        skill_b=b.name,
        overlap_type=overlap_type,
        score=round(score, 3),
        description_sim=round(desc_sim, 3),
        trigger_overlap=round(trigger_overlap, 3),
        conflicts=conflicts,
        shared_keywords=shared_kw[:10],
        recommended_action=action,
    )


# ── Report renderer ───────────────────────────────────────────────────────────

def render_report(
    results:    list[OverlapResult],
    skills:     list[SkillIndex],
    min_score:  float,
) -> str:
    filtered = [r for r in results if r.score >= min_score]
    filtered.sort(key=lambda r: (-r.overlap_type, -r.score))

    total_pairs = len(skills) * (len(skills) - 1) // 2
    lines = [
        "",
        "🧬 Skill Deduplication Audit",
        "═" * 56,
        f"Skills scanned : {len(skills)}",
        f"Pairs analyzed : {total_pairs}",
        f"Issues found   : {len(filtered)}",
        "═" * 56,
    ]

    if not filtered:
        lines += ["", "✅ No overlaps detected above threshold.", ""]
        return "\n".join(lines)

    for r in filtered:
        icon  = SEVERITY_ICONS.get(r.overlap_type, "?")
        label = TYPE_LABELS.get(r.overlap_type, "UNKNOWN")
        lines += [
            "",
            f"{icon} TYPE {r.overlap_type} — {label}  (score: {r.score:.2f})",
            f"  Pair         : '{r.skill_a}' ↔ '{r.skill_b}'",
            f"  Desc sim     : {r.description_sim:.2f}  |  "
            f"Trigger overlap: {r.trigger_overlap:.2f}",
        ]

        if r.shared_keywords:
            lines.append(
                f"  Shared KW    : {', '.join(r.shared_keywords[:6])}"
            )

        if r.conflicts:
            lines.append(f"  Conflicts    : {len(r.conflicts)} found")
            for c in r.conflicts[:2]:        # show max 2 conflict previews
                for cl in c.splitlines():
                    lines.append(f"    {cl}")

        lines += [
            f"  Action       : {r.recommended_action}",
        ]

    # Token savings estimate
    type1 = [r for r in filtered if r.overlap_type == 1]
    type2 = [r for r in filtered if r.overlap_type == 2]
    estimated_savings = len(type1) * 2_000 + len(type2) * 800

    lines += [
        "",
        "═" * 56,
        f"Estimated token savings if resolved: ~{estimated_savings:,} tokens/session",
        "═" * 56,
        "",
    ]
    return "\n".join(lines)


# ── Exit code ─────────────────────────────────────────────────────────────────

def exit_code(results: list[OverlapResult]) -> int:
    types = {r.overlap_type for r in results}
    if 1 in types or 4 in types:
        return 2
    if 2 in types or 3 in types:
        return 1
    return 0


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Skill Deduplication Auditor"
    )
    parser.add_argument("--skills-dir",        required=True,
                        help="Local .agent/skills directory")
    parser.add_argument("--global-skills-dir", default=None,
                        help="Global ~/.agent/skills directory")
    parser.add_argument("--min-score",         type=float, default=0.20,
                        help="Minimum overlap score to include in report")
    parser.add_argument("--json",              action="store_true",
                        help="Output results as JSON")
    args = parser.parse_args()

    try:
        local  = Path(args.skills_dir)
        glob   = Path(args.global_skills_dir).expanduser() \
                 if args.global_skills_dir else None

        if not local.exists():
            print(f"Error: skills directory not found: {local}",
                  file=sys.stderr)
            sys.exit(3)

        skills  = load_all_skills(local, glob)

        if len(skills) < 2:
            print("skill-deduplication-audit ✅  "
                  "Fewer than 2 skills found — nothing to compare.")
            sys.exit(0)

        results = []
        for a, b in combinations(skills, 2):
            result = analyze_pair(a, b)
            if result:
                results.append(result)

        if args.json:
            print(json.dumps([asdict(r) for r in results], indent=2))
        else:
            print(render_report(results, skills, args.min_score))

        sys.exit(exit_code(results))

    except Exception as e:
        print(f"skill-deduplication-audit ⚠️  Error: {e}", file=sys.stderr)
        sys.exit(3)


if __name__ == "__main__":
    main()
