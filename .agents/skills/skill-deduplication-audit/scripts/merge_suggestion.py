#!/usr/bin/env python3
"""
merge_suggestion.py
Generates a draft merged SKILL.md from two overlapping skills.
Produces a unified skill with unique content from both,
a diff summary, and migration notes for each source skill.

Exit codes:
  0 — Merge draft generated successfully
  1 — Merge skipped (user confirmation required)
  2 — Error
"""

import re
import sys
import difflib
import argparse
from pathlib import Path
from datetime import datetime


# ── Section extractor ─────────────────────────────────────────────────────────

def extract_sections(text: str) -> dict[str, str]:
    """
    Parse a SKILL.md into a dict of {heading: content}.
    Special key '__frontmatter__' holds the YAML block.
    """
    sections: dict[str, str] = {}
    current_heading = "__frontmatter__"
    current_lines: list[str] = []
    in_fm = False
    fm_done = False

    for line in text.splitlines():
        if not fm_done:
            if line.strip() == "---":
                if not in_fm:
                    in_fm = True
                    current_lines.append(line)
                    continue
                else:
                    current_lines.append(line)
                    sections["__frontmatter__"] = "\n".join(current_lines)
                    current_lines = []
                    fm_done = True
                    continue
            current_lines.append(line)
            continue

        m = re.match(r"^(#{1,4})\s+(.+)", line)
        if m:
            if current_lines:
                sections[current_heading] = "\n".join(current_lines).strip()
            current_heading = line.strip()
            current_lines   = []
        else:
            current_lines.append(line)

    if current_lines:
        sections[current_heading] = "\n".join(current_lines).strip()

    return sections


def extract_name(frontmatter: str) -> str:
    m = re.search(r"^name:\s*(.+)$", frontmatter, re.MULTILINE)
    return m.group(1).strip() if m else "unknown"


def extract_description(frontmatter: str) -> str:
    lines = frontmatter.splitlines()
    result = []
    capturing = False
    for line in lines:
        if line.startswith("description:"):
            capturing = True
            val = line[len("description:"):].strip()
            if not val.startswith("|"):
                return val.strip("'\"")
            continue
        if capturing:
            if line.startswith("  ") or line.startswith("\t"):
                result.append(line.strip())
            else:
                break
    return " ".join(result)


# ── Content similarity ────────────────────────────────────────────────────────

def section_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    matcher = difflib.SequenceMatcher(None, a.lower(), b.lower())
    return matcher.ratio()


# ── Merge logic ───────────────────────────────────────────────────────────────

def merge_descriptions(desc_a: str, desc_b: str, name_a: str, name_b: str) -> str:
    """Produce a merged description that combines both skill scopes."""
    if section_similarity(desc_a, desc_b) > 0.7:
        # Nearly identical — use the longer one
        return desc_a if len(desc_a) >= len(desc_b) else desc_b
    # Different scopes — combine
    return (
        f"{desc_a.rstrip('.')}. "
        f"Also handles: {desc_b.rstrip('.')}"
    )


def merge_sections(
    sections_a: dict[str, str],
    sections_b: dict[str, str],
) -> tuple[dict[str, str], list[str]]:
    """
    Merge two section dicts.
    Returns merged sections + a changelog list.
    """
    merged    = {}
    changelog = []
    all_keys  = list(sections_a.keys()) + [
        k for k in sections_b.keys() if k not in sections_a
    ]

    for key in all_keys:
        if key == "__frontmatter__":
            continue

        has_a = key in sections_a
        has_b = key in sections_b

        if has_a and not has_b:
            merged[key] = sections_a[key]
            changelog.append(f"KEPT from A only  : {key}")

        elif has_b and not has_a:
            merged[key] = sections_b[key]
            changelog.append(f"KEPT from B only  : {key}")

        else:
            sim = section_similarity(sections_a[key], sections_b[key])
            if sim > 0.80:
                # Nearly identical — keep A's version
                merged[key] = sections_a[key]
                changelog.append(
                    f"DEDUPLICATED      : {key} "
                    f"(similarity {sim:.0%} — kept A's version)"
                )
            elif sim > 0.40:
                # Partial overlap — append unique content from B
                unique_b = _extract_unique_lines(
                    sections_a[key], sections_b[key]
                )
                if unique_b:
                    merged[key] = sections_a[key] + "\n\n" + unique_b
                    changelog.append(
                        f"MERGED            : {key} "
                        f"(appended unique content from B)"
                    )
                else:
                    merged[key] = sections_a[key]
                    changelog.append(
                        f"KEPT A (no unique B content): {key}"
                    )
            else:
                # Very different — keep both with clear dividers
                merged[key] = (
                    f"{sections_a[key]}\n\n"
                    f"<!-- merged from second skill -->\n\n"
                    f"{sections_b[key]}"
                )
                changelog.append(
                    f"COMBINED (low sim): {key} "
                    f"(similarity {sim:.0%} — manual review needed)"
                )

    return merged, changelog


def _extract_unique_lines(text_a: str, text_b: str) -> str:
    """Return lines in B not present in A (rough diff)."""
    lines_a = set(text_a.splitlines())
    unique  = [l for l in text_b.splitlines() if l not in lines_a and l.strip()]
    return "\n".join(unique)


def build_merged_skill(
    sections: dict[str, str],
    merged_name: str,
    merged_description: str,
) -> str:
    """Assemble the merged SKILL.md content."""
    lines = [
        "---",
        f"name: {merged_name}",
        "description: |",
    ]
    for desc_line in merged_description.splitlines():
        lines.append(f"  {desc_line}")
    lines += [
        f"  Generated by skill-deduplication-audit on "
        f"{datetime.now().strftime('%Y-%m-%d')}.",
        "---",
        "",
        f"# {merged_name.replace('-', ' ').title()}",
        "",
        "> ⚠️ This skill was auto-generated by `skill-deduplication-audit`.",
        "> Review all sections marked `<!-- merged from second skill -->`",
        "> before using in production.",
        "",
    ]

    for heading, content in sections.items():
        if heading == "__frontmatter__":
            continue
        lines += [heading, "", content, ""]

    return "\n".join(lines)


def build_migration_note(
    original_name: str,
    merged_name:   str,
) -> str:
    return (
        f"---\n"
        f"name: {original_name}\n"
        f"description: |\n"
        f"  DEPRECATED: This skill has been merged into '{merged_name}'.\n"
        f"  Please update any references and archive this skill.\n"
        f"  Merged on: {datetime.now().strftime('%Y-%m-%d')}\n"
        f"  Use skill '{merged_name}' for all functionality\n"
        f"  previously provided by '{original_name}'.\n"
        f"---\n\n"
        f"# ⚠️ {original_name} — DEPRECATED\n\n"
        f"This skill has been merged into **`{merged_name}`**.\n\n"
        f"Please archive this directory:\n\n"
        f"```bash\n"
        f"mv .agent/skills/{original_name} "
        f".agent/skills/_archive/{original_name}\n"
        f"```\n"
    )


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Skill Merge Suggestion Generator"
    )
    parser.add_argument("--skill-a", required=True,
                        help="Path to first skill directory")
    parser.add_argument("--skill-b", required=True,
                        help="Path to second skill directory")
    parser.add_argument("--output",  default=None,
                        help="Output directory for merged skill "
                             "(default: print to stdout)")
    parser.add_argument("--name",    default=None,
                        help="Name for merged skill "
                             "(default: skill-a-name + '-merged')")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print merge plan without writing files")
    args = parser.parse_args()

    try:
        path_a = Path(args.skill_a)
        path_b = Path(args.skill_b)

        for p in (path_a, path_b):
            if not (p / "SKILL.md").exists():
                print(f"Error: SKILL.md not found in {p}", file=sys.stderr)
                sys.exit(2)

        text_a     = (path_a / "SKILL.md").read_text(errors="replace")
        text_b     = (path_b / "SKILL.md").read_text(errors="replace")
        sections_a = extract_sections(text_a)
        sections_b = extract_sections(text_b)

        name_a = extract_name(sections_a.get("__frontmatter__", ""))
        name_b = extract_name(sections_b.get("__frontmatter__", ""))
        desc_a = extract_description(sections_a.get("__frontmatter__", ""))
        desc_b = extract_description(sections_b.get("__frontmatter__", ""))

        merged_name = args.name or f"{name_a}-merged"
        merged_desc = merge_descriptions(desc_a, desc_b, name_a, name_b)

        merged_sections, changelog = merge_sections(sections_a, sections_b)
        merged_content = build_merged_skill(
            merged_sections, merged_name, merged_desc
        )

        # ── Dry run output ────────────────────────────────────────────────────
        print(f"\n🧬 Merge Plan: '{name_a}' + '{name_b}' → '{merged_name}'\n")
        print("─" * 56)
        print("Changelog:")
        for entry in changelog:
            print(f"  {entry}")
        print("─" * 56)

        if args.dry_run:
            print("\n[DRY RUN] Merged SKILL.md preview:\n")
            print(merged_content[:2000])
            if len(merged_content) > 2000:
                print(f"\n... ({len(merged_content) - 2000} more chars)")
            print("\n[DRY RUN] No files written.")
            sys.exit(0)

        # ── Write output ──────────────────────────────────────────────────────
        if args.output:
            out_dir = Path(args.output)

            if out_dir.exists():
                print(
                    f"⚠️  Output directory already exists: {out_dir}\n"
                    f"Overwrite? [y/N] ",
                    end="",
                )
                if input().strip().lower() != "y":
                    print("Merge aborted.")
                    sys.exit(1)

            out_dir.mkdir(parents=True, exist_ok=True)
            (out_dir / "SKILL.md").write_text(merged_content)

            # Write migration notes
            note_a = build_migration_note(name_a, merged_name)
            note_b = build_migration_note(name_b, merged_name)
            (out_dir / f"MIGRATION_FROM_{name_a}.md").write_text(note_a)
            (out_dir / f"MIGRATION_FROM_{name_b}.md").write_text(note_b)

            print(f"\n✅ Merged skill written to: {out_dir}/SKILL.md")
            print(f"   Migration notes: MIGRATION_FROM_{name_a}.md")
            print(f"                   MIGRATION_FROM_{name_b}.md")
            print(f"\nNext steps:")
            print(f"  1. Review {out_dir}/SKILL.md — check all "
                  f"'<!-- merged from second skill -->' sections")
            print(f"  2. Archive original skills:")
            print(f"     mv .agent/skills/{name_a} .agent/skills/_archive/")
            print(f"     mv .agent/skills/{name_b} .agent/skills/_archive/")
            print(f"  3. Run 'skill-deduplication-audit' again to confirm")
            print(f"  4. Run 'skill-health-checker' on the merged skill")
        else:
            print("\n── Merged SKILL.md ──────────────────────────────────\n")
            print(merged_content)

        sys.exit(0)

    except Exception as e:
        print(f"merge_suggestion ⚠️  Error: {e}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
