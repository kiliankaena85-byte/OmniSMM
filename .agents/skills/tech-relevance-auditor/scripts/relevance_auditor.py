#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Tech Stack Relevance Auditor for Smmplan Workspace (Feb 2026 stack)
Designed to run in standard Python 3. Ensures compliance with AGENTS.md.
"""

import os
import sys
import json
import re
import argparse
from datetime import datetime

# Reconfigure stdout/stderr to UTF-8 to prevent encoding errors on Windows
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass


# Color Utilities for terminal output
def colored(text, color):
    if sys.platform == "win32":
        # Check if ANSI escapes are supported or enabled
        # Windows 10+ supports this, but let's enable it or print normally if not supported
        os.system("") # Enables ANSI escape processing in Windows console
    
    colors = {
        "red": "\033[91m",
        "green": "\033[92m",
        "yellow": "\033[93m",
        "blue": "\033[94m",
        "cyan": "\033[96m",
        "magenta": "\033[95m",
        "bold": "\033[1m",
        "reset": "\033[0m"
    }
    return f"{colors.get(color, '')}{text}{colors['reset']}"

DEFAULT_POLICY = {
    "models": {
        "valid": [
            "gemini-3.5-flash"
        ],
        "deprecated": [
            "gemini-1.5-pro",
            "gemini-1.5-flash",
            "gemini-2.0-flash",
            "gemini-2.0-pro",
            "gemini-2.5-pro",
            "gemini-2.5-flash",
            "gemini-3-flash-preview",
            "gemini-3-flash",
            "gemini-3.5-flash-high"
        ]
    },
    "dependencies": {
        "next": "^16.2.6",
        "react": "^19.2.6",
        "tailwindcss": "^4.0.0",
        "@tailwindcss/postcss": "^4.0.0",
        "@heroui/react": "^3.0.0",
        "prisma": "^5.20.0",
        "eslint": "^10.0.0",
        "typescript": ">=5.7.0"
    },
    "forbidden_patterns": [
        "forwardRef",
        "useFormState"
    ],
    "forbidden_colors": [
        "text-white",
        "bg-black",
        "text-black",
        "bg-white"
    ]
}

def parse_version_tuple(v_str):
    if not v_str:
        return (0, 0, 0)
    cleaned = "".join(c for c in v_str if c.isdigit() or c == ".")
    parts = cleaned.split(".")
    try:
        return tuple(int(x) for x in parts[:3]) + (0,) * (3 - len(parts))
    except ValueError:
        return (0, 0, 0)

def match_version(actual, target):
    """
    Checks if 'actual' version matches 'target' version constraint (e.g. ^16.2.6 or >=5.7.0).
    """
    actual_clean = actual.lstrip("^~>=< ")
    target_clean = target.lstrip("^~>=< ")
    
    act_tuple = parse_version_tuple(actual_clean)
    tgt_tuple = parse_version_tuple(target_clean)
    
    if target.startswith("^"):
        # ^16.2.6 allows [16.2.6, 17.0.0)
        # So major must match, and actual >= target
        return act_tuple[0] == tgt_tuple[0] and act_tuple >= tgt_tuple
    elif target.startswith(">="):
        return act_tuple >= tgt_tuple
    elif target.startswith("~"):
        # ~16.2.6 allows [16.2.6, 16.3.0)
        return act_tuple[0] == tgt_tuple[0] and act_tuple[1] == tgt_tuple[1] and act_tuple >= tgt_tuple
    else:
        # Exact match
        return act_tuple == tgt_tuple

class RelevanceAuditor:
    def __init__(self, workspace_path):
        self.workspace = os.path.abspath(workspace_path)
        self.agent_dir = os.path.join(self.workspace, ".agent")
        self.policy_file = os.path.join(self.agent_dir, "relevance_policy.json")
        self.log_file = os.path.join(self.agent_dir, "logs", "relevance_audit.jsonl")
        
        # Load policy
        self.policy = DEFAULT_POLICY
        if os.path.exists(self.policy_file):
            try:
                with open(self.policy_file, "r", encoding="utf-8") as f:
                    self.policy = json.load(f)
            except Exception as e:
                print(colored(f"Error reading policy file: {e}. Using defaults.", "yellow"))
        else:
            # Ensure agent directory exists
            os.makedirs(self.agent_dir, exist_ok=True)
            
    def init_policy(self, overwrite=False):
        if os.path.exists(self.policy_file) and not overwrite:
            print(colored(f"Policy file already exists at {self.policy_file}. Use --overwrite to replace it.", "yellow"))
            return False
        
        try:
            with open(self.policy_file, "w", encoding="utf-8") as f:
                json.dump(self.policy, f, indent=2, ensure_ascii=False)
            print(colored(f"Successfully initialized relevance policy at {self.policy_file}", "green"))
            return True
        except Exception as e:
            print(colored(f"Failed to write policy file: {e}", "red"))
            return False

    def log_audit(self, score, level, report):
        os.makedirs(os.path.dirname(self.log_file), exist_ok=True)
        log_entry = {
            "timestamp": datetime.isoformat(datetime.now()),
            "score": score,
            "level": level,
            "summary": report
        }
        try:
            with open(self.log_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
        except Exception as e:
            print(colored(f"Failed to write audit log: {e}", "yellow"))

    def get_logs(self):
        if not os.path.exists(self.log_file):
            print(colored("No audit logs found.", "yellow"))
            return []
        
        logs = []
        try:
            with open(self.log_file, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip():
                        logs.append(json.loads(line.strip()))
        except Exception as e:
            print(colored(f"Failed to read logs: {e}", "red"))
        return logs

    def run_audit(self, checks_to_run="all"):
        results = {
            "timestamp": datetime.isoformat(datetime.now()),
            "score": 100,
            "level": "NOMINAL",
            "dependencies": {},
            "models": {},
            "code_quality": {},
            "recommendations": []
        }
        
        deductions = 0
        
        # 1. DEPENDENCY SCAN
        if checks_to_run in ("all", "deps"):
            pkg_json_path = os.path.join(self.workspace, "package.json")
            if os.path.exists(pkg_json_path):
                try:
                    with open(pkg_json_path, "r", encoding="utf-8") as f:
                        pkg = json.load(f)
                    
                    deps = pkg.get("dependencies", {})
                    dev_deps = pkg.get("devDependencies", {})
                    all_deps = {**deps, **dev_deps}
                    
                    target_deps = self.policy.get("dependencies", {})
                    for lib, target_ver in target_deps.items():
                        actual_ver = all_deps.get(lib)
                        if not actual_ver:
                            results["dependencies"][lib] = {
                                "status": "CRITICAL",
                                "actual": "MISSING",
                                "target": target_ver,
                                "message": f"Dependency '{lib}' is missing from package.json."
                            }
                            deductions += 15
                            results["recommendations"].append(f"Install '{lib}' matching version constraint '{target_ver}'.")
                        else:
                            matched = match_version(actual_ver, target_ver)
                            if matched:
                                results["dependencies"][lib] = {
                                    "status": "NOMINAL",
                                    "actual": actual_ver,
                                    "target": target_ver
                                }
                            else:
                                results["dependencies"][lib] = {
                                    "status": "WARN",
                                    "actual": actual_ver,
                                    "target": target_ver,
                                    "message": f"Dependency '{lib}' version ({actual_ver}) does not satisfy required '{target_ver}'."
                                }
                                deductions += 5
                                results["recommendations"].append(f"Update dependency '{lib}' from {actual_ver} to {target_ver}.")
                except Exception as e:
                    results["dependencies"]["package.json"] = {
                        "status": "CRITICAL",
                        "message": f"Error parsing package.json: {e}"
                    }
                    deductions += 15
            else:
                results["dependencies"]["package.json"] = {
                    "status": "WARN",
                    "message": "package.json not found in workspace root."
                }
                deductions += 10
                results["recommendations"].append("Create a package.json file to manage project dependencies.")

        # 2. AI MODELS SCAN
        if checks_to_run in ("all", "models"):
            deprecated_models = self.policy.get("models", {}).get("deprecated", [])
            valid_models = self.policy.get("models", {}).get("valid", [])
            
            # Walk directory searching for model names in agent configs and source files
            model_occurences = {}
            ignore_dirs = {".git", "node_modules", ".next", "dist", "build", "out", ".versions"}
            target_extensions = {".json", ".ts", ".tsx", ".js", ".jsx", ".py", ".md"}
            for root, dirs, files in os.walk(self.workspace):
                dirs[:] = [d for d in dirs if d not in ignore_dirs]
                for file in files:
                    ext = os.path.splitext(file)[1]
                    if ext in target_extensions:
                        file_path = os.path.join(root, file)
                        rel_path = os.path.relpath(file_path, self.workspace)
                        if "relevance_policy.json" in rel_path or "relevance_audit.jsonl" in rel_path:
                            continue
                        try:
                            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                                lines = f.readlines()
                            
                            for idx, line in enumerate(lines):
                                # check for deprecated models
                                for model in deprecated_models:
                                    if model in line:
                                        if rel_path not in model_occurences:
                                            model_occurences[rel_path] = []
                                        model_occurences[rel_path].append({
                                            "line": idx + 1,
                                            "model": model,
                                            "status": "DEPRECATED",
                                            "content": line.strip()
                                        })
                                        deductions += 5
                                        results["recommendations"].append(
                                            f"Replace deprecated model '{model}' in '{rel_path}' at line {idx+1} with a valid model."
                                        )
                        except Exception:
                            pass
            
            results["models"] = model_occurences

        # 3. FORBIDDEN PATTERNS & STATIC SCAN
        if checks_to_run in ("all", "code"):
            code_violations = {}
            forbidden_patterns = self.policy.get("forbidden_patterns", [])
            forbidden_colors = self.policy.get("forbidden_colors", [])
            
            # Let's write regex to match inline colors accurately
            # Specifically text-white, bg-black, text-black, bg-white, plus text-blue-500, etc.
            # Avoid matching inside imports, CSS files, or markdown, focus on source files (.ts, .tsx)
            color_regex = re.compile(
                r'\b(text|bg|border|ring)-(white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\d+)?\b'
            )
            
            ignore_dirs = {".git", "node_modules", ".next", "dist", "build", "out", ".versions"}
            src_dir = os.path.join(self.workspace, "src")
            
            if os.path.exists(src_dir):
                for root, dirs, files in os.walk(src_dir):
                    dirs[:] = [d for d in dirs if d not in ignore_dirs]
                    for file in files:
                        if file.endswith((".ts", ".tsx")):
                            file_path = os.path.join(root, file)
                            rel_path = os.path.relpath(file_path, self.workspace)
                            
                            is_page_component = file in ("page.tsx", "layout.tsx", "template.tsx")
                            
                            try:
                                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                                    lines = f.readlines()
                                
                                for idx, line in enumerate(lines):
                                    line_num = idx + 1
                                    
                                    # Rule: No "use server" in Page/Layout components
                                    if is_page_component and ("\"use server\"" in line or "'use server'" in line):
                                        if rel_path not in code_violations:
                                            code_violations[rel_path] = []
                                        code_violations[rel_path].append({
                                            "line": line_num,
                                            "type": "CRITICAL_USE_SERVER_IN_PAGE",
                                            "message": "Forbidden 'use server' directive in Page Component. This causes production crashes."
                                        })
                                        deductions += 15
                                        results["recommendations"].append(
                                            f"Remove 'use server' directive from page component '{rel_path}' at line {line_num}."
                                        )
                                        
                                    # Rule: Forbidden hooks/patterns
                                    for pattern in forbidden_patterns:
                                        # Use boundary checking
                                        if re.search(r'\b' + re.escape(pattern) + r'\b', line):
                                            if rel_path not in code_violations:
                                                code_violations[rel_path] = []
                                            
                                            alt_msg = ""
                                            if pattern == "useFormState":
                                                alt_msg = "Replace with React 19 'useActionState'."
                                            elif pattern == "forwardRef":
                                                alt_msg = "Remove wrapper, React 19 supports direct 'ref' prop."
                                                
                                            code_violations[rel_path].append({
                                                "line": line_num,
                                                "type": f"FORBIDDEN_PATTERN_{pattern.upper()}",
                                                "message": f"Forbidden pattern '{pattern}' used. {alt_msg}"
                                            })
                                            deductions += 5
                                            if alt_msg:
                                                results["recommendations"].append(f"In '{rel_path}' at line {line_num}: {alt_msg}")
                                                
                                    # Rule: Inline raw tailwind colors
                                    color_matches = color_regex.findall(line)
                                    for match in color_matches:
                                        color_class = f"{match[0]}-{match[1]}{match[2] or ''}"
                                        
                                        # Let's check if it matches our forbidden explicit colors or generic colors
                                        # (text-white, bg-black, text-black, bg-white, text-blue-500, etc.)
                                        # Ignore safe semantic classes like bg-background, text-primary, text-muted-foreground
                                        if rel_path not in code_violations:
                                            code_violations[rel_path] = []
                                        
                                        code_violations[rel_path].append({
                                            "line": line_num,
                                            "type": "FORBIDDEN_INLINE_COLOR",
                                            "message": f"Inline color class '{color_class}' used. Use semantic tokens from globals.css instead."
                                        })
                                        deductions += 2
                                        results["recommendations"].append(
                                            f"In '{rel_path}' at line {line_num}: replace inline color '{color_class}' with semantic design tokens."
                                        )
                            except Exception:
                                pass
                                
            results["code_quality"] = code_violations

        # Calculate final score and level
        results["score"] = max(0, 100 - deductions)
        if results["score"] >= 95:
            results["level"] = "NOMINAL"
        elif results["score"] >= 75:
            results["level"] = "WARN"
        else:
            results["level"] = "CRITICAL"
            
        # De-duplicate recommendations
        results["recommendations"] = list(dict.fromkeys(results["recommendations"]))
        
        return results

    def print_report(self, results, format_json=False):
        if format_json:
            print(json.dumps(results, indent=2, ensure_ascii=False))
            return
            
        print("\n" + colored("🔎 Tech Stack Relevance Audit Report", "bold"))
        print(colored("════════════════════════════════════════════════════════", "blue"))
        print(f"Workspace      : {self.workspace}")
        
        # Color score
        score = results["score"]
        score_color = "green" if score >= 95 else "yellow" if score >= 75 else "red"
        grade = "A" if score >= 95 else "B" if score >= 85 else "C" if score >= 75 else "D" if score >= 60 else "F"
        level_emoji = "🟢" if score >= 95 else "🟡" if score >= 75 else "🔴"
        
        print(f"Score          : {colored(f'{score} / 100', score_color)}  ({grade} Grade — {results['level']} {level_emoji})")
        print(colored("════════════════════════════════════════════════════════", "blue"))
        
        # 1. DEPENDENCY AUDIT
        if results.get("dependencies"):
            print("\n" + colored("📦 DEPENDENCY AUDIT:", "bold"))
            for lib, data in results["dependencies"].items():
                if data["status"] == "NOMINAL":
                    print(f"  {colored('🟢', 'green')} {lib:<15}: {data['actual']} (target: {data['target']})")
                elif data["status"] == "WARN":
                    print(f"  {colored('🟡', 'yellow')} {lib:<15}: {data['actual']} (target: {data['target']}) — {data['message']}")
                else:
                    print(f"  {colored('🔴', 'red')} {lib:<15}: {data.get('actual', 'MISSING')} (target: {data.get('target', 'N/A')}) — {data['message']}")
                    
        # 2. MODEL AUDIT
        if results.get("models") is not None:
            print("\n" + colored("🤖 AI MODEL AUDIT:", "bold"))
            if not results["models"]:
                print(f"  {colored('🟢', 'green')} No deprecated AI model references found in codebase!")
            else:
                for file, occs in results["models"].items():
                    print(f"  {colored('🔴', 'red')} {file}:")
                    for occ in occs:
                        print(f"     - Found deprecated '{occ['model']}' at line {occ['line']}: \"{occ['content']}\"")
                        
        # 3. FORBIDDEN PATTERNS SCAN
        if results.get("code_quality") is not None:
            print("\n" + colored("⚠️ FORBIDDEN PATTERNS SCAN:", "bold"))
            if not results["code_quality"]:
                print(f"  {colored('🟢', 'green')} Zero-defect compliance! No forbidden patterns or inline colors detected in src/.")
            else:
                for file, violations in results["code_quality"].items():
                    print(f"  {colored('🔴', 'red')} {file}:")
                    for viol in violations:
                        bullet = "🔴" if "CRITICAL" in viol["type"] else "🟡"
                        print(f"     - [{bullet}] Line {viol['line']}: {viol['message']}")
                        
        print(colored("════════════════════════════════════════════════════════", "blue"))
        print(f"Assessment     : {colored(results['level'], score_color)} {level_emoji}")
        if results["recommendations"]:
            print(colored("\nRecommendations:", "bold"))
            for rec in results["recommendations"][:10]: # limit to top 10 recommendations
                print(f"  • {rec}")
            if len(results["recommendations"]) > 10:
                print(f"  • ... and {len(results['recommendations']) - 10} more suggestions.")
        else:
            print(colored("\nNo recommendations. Codebase is in pristine state!", "green"))
        print(colored("════════════════════════════════════════════════════════", "blue"))

    def fix_simple_issues(self, dry_run=True):
        """
        Auto-correct simple forbidden patterns like useFormState -> useActionState
        """
        code_violations = self.run_audit(checks_to_run="code").get("code_quality", {})
        fixed_count = 0
        
        for rel_path, violations in code_violations.items():
            form_state_viol = [v for v in violations if "USEFORMSTATE" in v["type"]]
            if not form_state_viol:
                continue
                
            file_path = os.path.join(self.workspace, rel_path)
            
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                
                # Check if useFormState is imported from react-dom
                new_content = content
                
                # Replace imports
                # case 1: import { useFormState } from 'react-dom' or "react-dom"
                # to: import { useActionState } from 'react'
                # case 2: import { useFormState, ... } from 'react-dom'
                # We can do regex replacement or standard replacement
                
                # Simple and robust replacements:
                if "useFormState" in content:
                    # Let's replace the usage in code
                    new_content = re.sub(r'\buseFormState\b', 'useActionState', new_content)
                    
                    # Fix react-dom import if it's there
                    if "import { useActionState } from 'react-dom'" in new_content:
                        # Wait, react-dom does not have useActionState in React 19 (it's in 'react')
                        # So we need to clean up imports:
                        # If 'react' import already exists, we should append useActionState to it.
                        # For simplicity in regex-replacement:
                        # We will replace useFormState import from 'react-dom'
                        new_content = re.sub(
                            r"import\s+\{\s*useFormState\s*\}\s+from\s+['\"]react-dom['\"];?", 
                            "import { useActionState } from 'react';", 
                            new_content
                        )
                        # Handlers for multi-named imports:
                        new_content = re.sub(
                            r"useFormState,\s*",
                            "",
                            new_content
                        )
                    
                    if new_content != content:
                        if dry_run:
                            print(colored(f"[DRY RUN] Would fix 'useFormState' -> 'useActionState' in '{rel_path}'", "cyan"))
                        else:
                            with open(file_path, "w", encoding="utf-8") as f:
                                f.write(new_content)
                            print(colored(f"[FIXED] Upgraded 'useFormState' to 'useActionState' in '{rel_path}'", "green"))
                        fixed_count += 1
            except Exception as e:
                print(colored(f"Error trying to fix '{rel_path}': {e}", "red"))
                
        return fixed_count

def main():
    parser = argparse.ArgumentParser(description="Tech Stack Relevance Auditor for Smmplan")
    parser.add_argument("command", choices=["init", "audit", "report", "fix", "log"], help="Auditor command to execute")
    parser.add_argument("--workspace", default=".", help="Workspace path to scan")
    parser.add_argument("--json", action="store_true", help="Output raw JSON for machines")
    parser.add_argument("--check", choices=["deps", "models", "code", "all"], default="all", help="Selective checks to run")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing policy file in 'init'")
    parser.add_argument("--confirm", action="store_true", help="Confirm execution of auto-fixes in 'fix'")
    
    args = parser.parse_args()
    
    auditor = RelevanceAuditor(args.workspace)
    
    if args.command == "init":
        auditor.init_policy(overwrite=args.overwrite)
        
    elif args.command == "audit":
        results = auditor.run_audit(args.check)
        auditor.print_report(results, args.json)
        
        # Log to file in non-json mode or always
        report_summary = f"Score: {results['score']}%, Level: {results['level']}, Recommendations: {len(results['recommendations'])}"
        auditor.log_audit(results["score"], results["level"], report_summary)
        
        if results["level"] == "CRITICAL" and not args.json:
            sys.exit(1)
            
    elif args.command == "report":
        results = auditor.run_audit(args.check)
        auditor.print_report(results, args.json)
        
    elif args.command == "fix":
        dry_run = not args.confirm
        fixed = auditor.fix_simple_issues(dry_run=dry_run)
        if fixed == 0:
            print(colored("No simple issues found that can be auto-corrected.", "green"))
        elif dry_run:
            print(colored(f"\nDry-run complete. Found {fixed} files to fix. Run with --confirm to apply changes.", "yellow"))
        else:
            print(colored(f"\nSuccessfully auto-corrected {fixed} files!", "green"))
            
    elif args.command == "log":
        logs = auditor.get_logs()
        if logs:
            print(colored("\n📋 Audit Execution Logs", "bold"))
            print(colored("════════════════════════════════════════════════════════", "blue"))
            for entry in logs:
                print(f"[{entry['timestamp']}] Score: {entry['score']}% | Level: {entry['level']} | {entry['summary']}")
            print(colored("════════════════════════════════════════════════════════", "blue"))

if __name__ == "__main__":
    main()
