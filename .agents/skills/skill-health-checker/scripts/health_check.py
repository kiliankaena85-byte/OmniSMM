#!/usr/bin/env python3
import os
import sys
import re
import json
import argparse

# Reconfigure stdout/stderr to use UTF-8 encoding on Windows to prevent UnicodeEncodeError
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass

# Try to use PyYAML for robust YAML parsing, fall back to manual parser
try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False
import difflib

# Add current directory to path for rule imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from rules import frontmatter_rules
    from rules import structure_rules
    from rules import instruction_rules
    from rules import activation_rules
except ImportError as e:
    print(f"❌ Error importing rules: {e}", file=sys.stderr)
    sys.exit(1)

def parse_frontmatter(content):
    lines = content.splitlines()
    if not lines or lines[0].strip() != '---':
        return None, ["Manifest must start with '---'"]
    
    end_idx = -1
    for i in range(1, len(lines)):
        if lines[i].strip() == '---':
            end_idx = i
            break
            
    if end_idx == -1:
        return None, ["Manifest must have a closing '---'"]
        
    fm_raw = "\n".join(lines[1:end_idx])
    
    # Use PyYAML if available (robust handling of quotes, comments, multi-line scalars)
    if HAS_YAML:
        try:
            fm_data = yaml.safe_load(fm_raw)
            if not isinstance(fm_data, dict):
                return None, ["Frontmatter YAML did not parse to a dictionary."]
            # Ensure all values are strings for downstream compatibility
            for k, v in fm_data.items():
                if v is not None:
                    fm_data[k] = str(v).strip()
            return fm_data, []
        except yaml.YAMLError as e:
            return None, [f"YAML parse error: {e}"]
    
    # Fallback: simple manual parser for environments without PyYAML
    fm_data = {}
    errors = []
    current_key = None
    current_value_lines = []
    is_multiline = False
    
    for idx, line_str in enumerate(lines[1:end_idx], start=2):
        if is_multiline:
            if not line_str.strip():
                current_value_lines.append("")
                continue
            match = re.match(r"^(\s+)(.*)", line_str)
            if match:
                current_value_lines.append(match.group(2))
                continue
            else:
                fm_data[current_key] = "\n".join(current_value_lines).strip()
                current_key = None
                current_value_lines = []
                is_multiline = False
        
        line = line_str.strip()
        if not line or line.startswith('#'):
            continue
            
        if ":" in line_str:
            parts = line_str.split(":", 1)
            key = parts[0].strip()
            val = parts[1].strip()
            
            if val in ("|", ">", ">-", "|-"):
                current_key = key
                current_value_lines = []
                is_multiline = True
            else:
                # Strip surrounding quotes
                if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                    val = val[1:-1]
                fm_data[key] = val
        else:
            errors.append(f"Invalid YAML syntax in frontmatter at line {idx}: {line_str}")
            
    if is_multiline and current_key:
        fm_data[current_key] = "\n".join(current_value_lines).strip()
        
    return fm_data, errors

def calculate_score(issues):
    # Start each category at 100
    scores = {
        "Frontmatter": 100,
        "Structure": 100,
        "Instruction quality": 100,
        "Activation": 100
    }
    
    deductions = {
        "CRITICAL": 40,
        "ERROR": 25,
        "WARNING": 10,
        "INFO": 2
    }
    
    for issue in issues:
        rule_id = issue.get("rule_id", "")
        severity = issue.get("severity", "INFO")
        deduction = deductions.get(severity, 2)
        
        # Categorize by Rule ID prefix
        if rule_id.startswith("FM-"):
            scores["Frontmatter"] = max(0, scores["Frontmatter"] - deduction)
        elif rule_id.startswith("ST-"):
            scores["Structure"] = max(0, scores["Structure"] - deduction)
        elif rule_id.startswith("IQ-"):
            scores["Instruction quality"] = max(0, scores["Instruction quality"] - deduction)
        elif rule_id.startswith("AR-"):
            scores["Activation"] = max(0, scores["Activation"] - deduction)
            
    # Calculate weighted total score
    weighted_score = (
        0.30 * scores["Frontmatter"] +
        0.25 * scores["Structure"] +
        0.30 * scores["Instruction quality"] +
        0.15 * scores["Activation"]
    )
    
    return int(round(weighted_score)), scores

def get_grade_info(score):
    if score >= 90:
        return "A", "🟢 HEALTHY", "\033[92m"
    elif score >= 75:
        return "B", "🟡 GOOD", "\033[93m"
    elif score >= 55:
        return "C", "🟠 FAIR", "\033[38;5;208m"
    elif score >= 30:
        return "D", "🔴 POOR", "\033[91m"
    else:
        return "F", "⛔ CRITICAL", "\033[31;1m"

def run_health_check(skill_dir, all_skills=None):
    skill_name = os.path.basename(skill_dir)
    skill_md_path = os.path.join(skill_dir, "SKILL.md")
    
    if not os.path.exists(skill_md_path):
        return {
            "skill_name": skill_name,
            "exists": False,
            "issues": [{
                "rule_id": "ST-000",
                "severity": "CRITICAL",
                "message": f"SKILL.md file not found in skill directory: {skill_dir}",
                "fix": "Create a valid SKILL.md file in the root of the skill folder."
            }],
            "score": 0,
            "category_scores": {"Frontmatter": 0, "Structure": 0, "Instruction quality": 0, "Activation": 0},
            "grade": "F",
            "label": "CRITICAL"
        }
        
    try:
        with open(skill_md_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        return {
            "skill_name": skill_name,
            "exists": True,
            "issues": [{
                "rule_id": "ST-000",
                "severity": "CRITICAL",
                "message": f"Failed to read SKILL.md file: {e}",
                "fix": "Fix file access/permissions or check for encoding issues."
            }],
            "score": 0,
            "category_scores": {"Frontmatter": 0, "Structure": 0, "Instruction quality": 0, "Activation": 0},
            "grade": "F",
            "label": "CRITICAL"
        }
        
    frontmatter, fm_errors = parse_frontmatter(content)
    issues = []
    
    # If frontmatter YAML is unparseable
    if fm_errors:
        for err in fm_errors:
            issues.append({
                "rule_id": "FM-000",
                "severity": "CRITICAL",
                "section": "Frontmatter",
                "message": err,
                "fix": "Format the frontmatter starting and ending with exactly '---' lines."
            })
        # Basic calculations on unparseable frontmatter
        return {
            "skill_name": skill_name,
            "exists": True,
            "issues": issues,
            "score": 0,
            "category_scores": {"Frontmatter": 0, "Structure": 0, "Instruction quality": 0, "Activation": 0},
            "grade": "F",
            "label": "CRITICAL"
        }
        
    # Run all checks
    issues.extend(frontmatter_rules.check(skill_dir, content, frontmatter, skill_name, all_skills))
    issues.extend(structure_rules.check(skill_dir, content, frontmatter, skill_name, all_skills))
    issues.extend(instruction_rules.check(skill_dir, content, frontmatter, skill_name, all_skills))
    issues.extend(activation_rules.check(skill_dir, content, frontmatter, skill_name, all_skills))
    
    score, category_scores = calculate_score(issues)
    grade, label, _ = get_grade_info(score)
    
    return {
        "skill_name": skill_name,
        "exists": True,
        "version": frontmatter.get("version", "unknown"),
        "issues": issues,
        "score": score,
        "category_scores": category_scores,
        "grade": grade,
        "label": label,
        "content": content,
        "frontmatter": frontmatter
    }

def apply_auto_fixes(skill_dir, result):
    skill_md_path = os.path.join(skill_dir, "SKILL.md")
    content = result["content"]
    frontmatter = result["frontmatter"]
    issues = result["issues"]
    
    auto_fixable_issues = [i for i in issues if i.get("auto_fixable")]
    if not auto_fixable_issues:
        return content, False
        
    lines = content.splitlines()
    modified = False
    
    # 1. FM-003 Add version if missing
    add_version_issue = next((i for i in auto_fixable_issues if i.get("fix_type") == "add_version"), None)
    if add_version_issue:
        new_lines = []
        injected = False
        for line in lines:
            new_lines.append(line)
            if line.strip() == '---' and not injected:
                new_lines.append("version: 0.1.0")
                injected = True
        lines = new_lines
        modified = True
        
    # 2. FM-007 Remove unknown frontmatter fields
    remove_fields_issue = next((i for i in auto_fixable_issues if i.get("fix_type") == "remove_unknown_fields"), None)
    if remove_fields_issue:
        fields_to_remove = remove_fields_issue.get("fields", [])
        new_lines = []
        inside_fm = False
        fm_count = 0
        for line in lines:
            if line.strip() == '---':
                fm_count += 1
                inside_fm = (fm_count == 1)
            
            if inside_fm:
                # check if line starts with any of unknown fields
                should_remove = False
                for f in fields_to_remove:
                    if line.strip().startswith(f"{f}:"):
                        should_remove = True
                        break
                if should_remove:
                    modified = True
                    continue
            new_lines.append(line)
        lines = new_lines
        
    # 3. ST-004 Convert bold pseudo-headings to proper markdown headings
    convert_heading_issues = [i for i in auto_fixable_issues if i.get("fix_type") == "convert_pseudo_heading"]
    if convert_heading_issues:
        for issue in convert_heading_issues:
            target_content = issue["line_content"]
            h_text = issue["heading_text"]
            for idx, line in enumerate(lines):
                if line == target_content:
                    lines[idx] = f"### {h_text}"
                    modified = True
                    break
                    
    # 4. IQ-005 Add syntax language specifier to bare code blocks
    add_lang_issues = [i for i in auto_fixable_issues if i.get("fix_type") == "add_code_lang"]
    if add_lang_issues:
        inside = False
        for idx, line in enumerate(lines):
            trimmed = line.strip()
            if trimmed == "```":
                if inside:
                    inside = False
                else:
                    inside = True
                    # Check if this specific line was flagged
                    for issue in add_lang_issues:
                        if issue["line_content"] == line:
                            lines[idx] = "```text"
                            modified = True
                            break
            elif trimmed.startswith("```"):
                if inside:
                    inside = False
                else:
                    inside = True
                    
    # 5. IQ-010 Replace absolute paths with {{WORKSPACE}}
    replace_path_issues = [i for i in auto_fixable_issues if i.get("fix_type") == "replace_absolute_path"]
    if replace_path_issues:
        new_content = "\n".join(lines)
        for issue in replace_path_issues:
            abs_path = issue["absolute_path"]
            new_content = new_content.replace(abs_path, "{{WORKSPACE}}")
            modified = True
        lines = new_content.splitlines()
        
    return "\n".join(lines), modified

def format_text_report(result, use_colors=True):
    skill_name = result["skill_name"]
    version = result.get("version", "unknown")
    score = result["score"]
    issues = result["issues"]
    
    grade, label, color_code = get_grade_info(score)
    color_reset = "\033[0m" if use_colors else ""
    color = color_code if use_colors else ""
    
    errors = [i for i in issues if i["severity"] in ("CRITICAL", "ERROR")]
    warnings = [i for i in issues if i["severity"] == "WARNING"]
    infos = [i for i in issues if i["severity"] == "INFO"]
    
    report = []
    report.append("🏥 Skill Health Report")
    report.append("════════════════════════════════════════════════════════")
    report.append(f"Skill         : {skill_name}")
    report.append(f"Version       : v{version}")
    report.append(f"Health score  : {score} / 100  {color}{grade} — {label}{color_reset}")
    total_rules = len({i['rule_id'] for i in issues}) if issues else 28
    # Count unique rule IDs checked (minimum 28 if none fired — all rules pass)
    report.append(f"Rules checked : {max(total_rules, 28)}")
    report.append(f"Issues found  : {len(issues)}  ({len(errors)} ERROR, {len(warnings)} WARNING, {len(infos)} INFO)")
    report.append("════════════════════════════════════════════════════════\n")
    
    if not issues:
        report.append(f" {color}🟢 PASS: All rules pass, zero warnings! Perfect quality skill.{color_reset}\n")
    else:
        # Group issues by severity
        severity_order = ["CRITICAL", "ERROR", "WARNING", "INFO"]
        severity_colors = {
            "CRITICAL": "\033[31;1m" if use_colors else "",
            "ERROR": "\033[91m" if use_colors else "",
            "WARNING": "\033[93m" if use_colors else "",
            "INFO": "\033[94m" if use_colors else ""
        }
        severity_icons = {
            "CRITICAL": "⛔ CRITICAL",
            "ERROR": "❌ ERROR   ",
            "WARNING": "⚠️  WARNING ",
            "INFO": "ℹ️  INFO    "
        }
        
        for sev in severity_order:
            sev_issues = [i for i in issues if i["severity"] == sev]
            for issue in sev_issues:
                scolor = severity_colors[sev]
                sicon = severity_icons[sev]
                rule_id = issue["rule_id"]
                msg = issue["message"]
                fix = issue.get("fix", "")
                line = issue.get("line", "")
                section = issue.get("section", "")
                
                loc = f"Line {line}" if line else ""
                if section:
                    loc = f"Section '{section}'" + (f", Line {line}" if line else "")
                
                report.append(f"{scolor}{sicon}  [{rule_id}]{color_reset}  {msg}")
                if loc:
                    report.append(f"  Location: {loc}")
                if fix:
                    report.append(f"  Fix     : {fix}")
                report.append("")
                
    report.append("════════════════════════════════════════════════════════")
    report.append("Category breakdown:")
    for cat, cscore in result["category_scores"].items():
        ccolor = "\033[92m" if cscore >= 90 else ("\033[93m" if cscore >= 75 else ("\033[38;5;208m" if cscore >= 55 else "\033[91m"))
        cicon = "🟢" if cscore >= 90 else ("🟡" if cscore >= 75 else ("🟠" if cscore >= 55 else "🔴"))
        if not use_colors:
            ccolor = ""
        report.append(f"  {cat:<20}: {cscore}/100 {ccolor}{cicon}{color_reset}")
    report.append("════════════════════════════════════════════════════════")
    
    if score >= 90:
        report.append(f"Suggested next step: Skill is in excellent health! Safe to share and publish.")
    elif errors:
        first_err = errors[0]["rule_id"]
        report.append(f"Suggested next step: Fix {first_err} (ERROR) and address warnings.")
    elif warnings:
        first_warn = warnings[0]["rule_id"]
        report.append(f"Suggested next step: Address warning {first_warn} to reach Grade A.")
    else:
        report.append(f"Suggested next step: Resolve Info logs to polish the skill.")
    report.append("════════════════════════════════════════════════════════")
    
    return "\n".join(report)

def format_github_annotations(result):
    annotations = []
    skill_md_path = f".agent/skills/{result['skill_name']}/SKILL.md"
    for issue in result["issues"]:
        severity = issue["severity"]
        rule_id = issue["rule_id"]
        msg = issue["message"]
        line = issue.get("line", 1)
        
        github_severity = "error" if severity in ("CRITICAL", "ERROR") else "warning"
        annotations.append(f"::{github_severity} file={skill_md_path},line={line},col=1::[{rule_id}] {msg}")
    return "\n".join(annotations)

def main():
    parser = argparse.ArgumentParser(description="🏥 Antigravity Skill Health Checker")
    parser.add_argument("--skill-dir", help="Path to a single skill directory")
    parser.add_argument("--skills-dir", help="Path to a directory containing multiple skills")
    parser.add_argument("--context-skills-dir", help="Path to all installed skills for cross-skill AR-003 overlap check")
    parser.add_argument("--min-grade", default="B", choices=["A", "B", "C", "D", "F"], help="Minimum acceptable grade (default: B)")
    parser.add_argument("--output-format", default="text", choices=["text", "json", "github-annotations"], help="Output format")
    parser.add_argument("--auto-fix", action="store_true", help="Generate safe, deterministic fixes")
    parser.add_argument("--confirm", action="store_true", help="Confirm writing auto-fixes to disk")
    parser.add_argument("--no-color", action="store_true", help="Disable ANSI color codes in output")
    
    args = parser.parse_args()
    
    if not args.skill_dir and not args.skills_dir:
        print("❌ Error: Must specify either --skill-dir or --skills-dir", file=sys.stderr)
        sys.exit(2)
        
    use_colors = sys.stdout.isatty() and args.output_format == "text" and not args.no_color
    
    # Gather other skills if doing cross-skill audit
    all_skills = []
    skills_to_check = []
    
    # Load context skills from --context-skills-dir if provided (for cross-skill AR-003 check)
    context_skills_dir = getattr(args, 'context_skills_dir', None)
    if context_skills_dir and os.path.exists(context_skills_dir):
        for item in sorted(os.listdir(context_skills_dir)):
            full_path = os.path.join(context_skills_dir, item)
            if os.path.isdir(full_path):
                skill_md = os.path.join(full_path, "SKILL.md")
                if os.path.exists(skill_md):
                    try:
                        with open(skill_md, "r", encoding="utf-8") as f:
                            content = f.read()
                        fm, _ = parse_frontmatter(content)
                        if fm:
                            fm["dir_name"] = item
                            all_skills.append(fm)
                    except Exception:
                        pass

    if args.skills_dir:
        if not os.path.exists(args.skills_dir):
            print(f"❌ Error: Skills directory does not exist at {args.skills_dir}", file=sys.stderr)
            sys.exit(2)
            
        for item in sorted(os.listdir(args.skills_dir)):
            if item.startswith('_') or item.startswith('.') or item.startswith('ex-'):
                continue
            full_path = os.path.join(args.skills_dir, item)
            if os.path.isdir(full_path):
                # parse and register in all_skills
                skill_md = os.path.join(full_path, "SKILL.md")
                if os.path.exists(skill_md):
                    try:
                        with open(skill_md, "r", encoding="utf-8") as f:
                            content = f.read()
                        fm, _ = parse_frontmatter(content)
                        if fm:
                            fm["dir_name"] = item
                            all_skills.append(fm)
                    except Exception:
                        pass
                skills_to_check.append(full_path)
    elif args.skill_dir:
        if not os.path.exists(args.skill_dir):
            print(f"❌ Error: Skill directory does not exist at {args.skill_dir}", file=sys.stderr)
            sys.exit(2)
            
        skills_to_check.append(args.skill_dir)
        
        # Load other skills from parent if available for cross-skill checking
        parent_dir = os.path.dirname(args.skill_dir)
        if os.path.basename(parent_dir) == "skills":
            for item in sorted(os.listdir(parent_dir)):
                full_path = os.path.join(parent_dir, item)
                if os.path.isdir(full_path) and full_path != args.skill_dir:
                    skill_md = os.path.join(full_path, "SKILL.md")
                    if os.path.exists(skill_md):
                        try:
                            with open(skill_md, "r", encoding="utf-8") as f:
                                content = f.read()
                            fm, _ = parse_frontmatter(content)
                            if fm:
                                fm["dir_name"] = item
                                all_skills.append(fm)
                        except Exception:
                            pass
                            
    # Run scans
    results = []
    for skill_dir in skills_to_check:
        res = run_health_check(skill_dir, all_skills)
        results.append(res)
        
    # Check grades for exit codes
    grade_values = {"A": 4, "B": 3, "C": 2, "D": 1, "F": 0}
    min_val = grade_values[args.min_grade]
    
    has_blocking_errors = False
    
    # Process Auto-Fixes if single directory and auto-fix enabled
    if args.auto_fix:
        if len(skills_to_check) > 1:
            print("⚠️ Auto-fix is only supported for single skill scans (--skill-dir). Skipping bulk auto-fix.", file=sys.stderr)
        else:
            res = results[0]
            skill_dir = skills_to_check[0]
            
            # Check for safety lock: .versions/ folder MUST exist
            versions_path = os.path.join(skill_dir, ".versions")
            if not os.path.exists(versions_path):
                print(f"⛔ Safety Lock Abort: Snapshot directory '{versions_path}' does not exist.", file=sys.stderr)
                print("Auto-fix is disabled until you create a backup snapshot. Run 'skill-versioning snapshot' first.", file=sys.stderr)
                sys.exit(3)
                
            fixed_content, modified = apply_auto_fixes(skill_dir, res)
            if modified:
                # Generate diff
                original_lines = res["content"].splitlines()
                fixed_lines = fixed_content.splitlines()
                
                diff = list(difflib.unified_diff(
                    original_lines,
                    fixed_lines,
                    fromfile="SKILL.md (original)",
                    tofile="SKILL.md (auto-fixed)",
                    lineterm=""
                ))
                
                print("\n🔧 Generated Auto-Fix Diff Preview:")
                print("════════════════════════════════════════════════════════")
                for line in diff:
                    if line.startswith("+"):
                        print(f"\033[92m{line}\033[0m" if use_colors else line)
                    elif line.startswith("-"):
                        print(f"\033[91m{line}\033[0m" if use_colors else line)
                    else:
                        print(line)
                print("════════════════════════════════════════════════════════")
                
                if args.confirm:
                    try:
                        with open(os.path.join(skill_dir, "SKILL.md"), "w", encoding="utf-8") as f:
                            f.write(fixed_content)
                        print("✅ Success: Auto-fixes successfully written to SKILL.md!")
                        # Re-run check on the newly written file
                        res = run_health_check(skill_dir, all_skills)
                        results[0] = res
                    except Exception as e:
                        print(f"❌ Error writing auto-fixes: {e}", file=sys.stderr)
                        sys.exit(1)
                else:
                    print("ℹ️ Dry-run mode: Diff preview generated. Run with --confirm to apply changes.")
            else:
                print("ℹ️ No auto-fixable issues were found.")
                
    # Output formatting
    if args.output_format == "json":
        json_out = []
        for r in results:
            issues_list = []
            for issue in r["issues"]:
                issues_list.append({
                    "rule_id": issue["rule_id"],
                    "severity": issue["severity"],
                    "line": issue.get("line"),
                    "section": issue.get("section"),
                    "message": issue["message"],
                    "fix": issue.get("fix")
                })
            json_out.append({
                "skill": r["skill_name"],
                "score": r["score"],
                "grade": r["grade"],
                "label": r["label"],
                "issues": issues_list,
                "category_scores": r["category_scores"]
            })
        print(json.dumps(json_out, indent=2))
        
    elif args.output_format == "github-annotations":
        for r in results:
            ann = format_github_annotations(r)
            if ann:
                print(ann)
                
    else: # text
        for r in results:
            print(format_text_report(r, use_colors))
            print("\n")
            
        if len(results) > 1:
            # Print beautiful bulk summary table
            print("🏥 All Skills Health Summary")
            print("════════════════════════════════════════════════════════")
            print(f"{'Skill Name':<30} | {'Score':<5} | {'Grade':<5} | {'Issues':<6}")
            print("───────────────────────────────┼───────┼───────┼───────")
            for r in results:
                skill_name = r["skill_name"]
                score = r["score"]
                grade = r["grade"]
                issues_cnt = len(r["issues"])
                
                grade_label, _, color_code = get_grade_info(score)
                color_reset = "\033[0m" if use_colors else ""
                color = color_code if use_colors else ""
                
                # Check min grade violation
                val = grade_values.get(grade, 0)
                if val < min_val:
                    has_blocking_errors = True
                    
                # Mark errors
                errors_cnt = len([i for i in r["issues"] if i["severity"] in ("CRITICAL", "ERROR")])
                if errors_cnt > 0:
                    has_blocking_errors = True
                    
                print(f"{skill_name:<30} | {score:<5} | {color}{grade:<5}{color_reset} | {issues_cnt:<6}")
            print("════════════════════════════════════════════════════════")
            
    # Check single run for blocking errors or min-grade failures
    if len(results) == 1:
        r = results[0]
        val = grade_values.get(r["grade"], 0)
        if val < min_val:
            has_blocking_errors = True
        errors_cnt = len([i for i in r["issues"] if i["severity"] in ("CRITICAL", "ERROR")])
        if errors_cnt > 0:
            has_blocking_errors = True
            
    if has_blocking_errors:
        print("⛔ Health Check Failed: One or more skills do not meet the minimum quality requirements.", file=sys.stderr)
        sys.exit(1)
    else:
        print("🟢 Health Check Passed: All skills meet quality benchmarks.")
        sys.exit(0)

if __name__ == "__main__":
    main()
