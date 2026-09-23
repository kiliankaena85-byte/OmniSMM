import os
import re
from rules.common import IQ_STOPWORDS

def check(skill_path, file_content, frontmatter, skill_dir_name, all_skills=None):
    issues = []
    lines = file_content.splitlines()
    
    # IQ-010: No hardcoded absolute paths (e.g., /Users/username or C:\Users\username)
    # Detect typical absolute user paths in macOS/Linux or Windows
    abs_path_patterns = [
        (r"(?i)/users/([a-zA-Z0-9_\-\.]+)(/[a-zA-Z0-9_\-\.]+)*", "Unix-style User absolute path"),
        (r"(?i)[a-zA-Z]:\\users\\([a-zA-Z0-9_\-\.]+)(\\[a-zA-Z0-9_\-\.]+)*", "Windows User absolute path")
    ]
    
    for idx, line in enumerate(lines, start=1):
        for pattern, path_type in abs_path_patterns:
            match = re.search(pattern, line)
            if match:
                matched_path = match.group(0)
                # Ignore system paths like just /Users/ or C:\Users without a specific user folder, but let's be careful
                if "Users" in matched_path and len(matched_path) > 10:
                    issues.append({
                        "rule_id": "IQ-010",
                        "severity": "ERROR",
                        "line": idx,
                        "message": f"Hardcoded absolute path '{matched_path}' ({path_type}) detected. This makes the skill non-portable.",
                        "fix": "Replace the absolute path with a generic placeholder like '{{WORKSPACE}}' or '{{SKILL_PATH}}'. (Auto-fixable)",
                        "auto_fixable": True,
                        "fix_type": "replace_absolute_path",
                        "line_content": line,
                        "absolute_path": matched_path
                    })
                    
    # IQ-001: No contradictory imperative pairs (always X vs never X)
    # Let's extract sentences with positive and negative imperatives
    # Then compare key subjects
    pos_imperatives = []
    neg_imperatives = []
    
    # Clean the content by removing non-prose blocks (frontmatter, code blocks, tables) to avoid false-positive contradictory imperatives
    nlp_content = re.sub(r"^---[\s\S]*?^---", "", file_content, flags=re.MULTILINE)
    nlp_content = re.sub(r"```[\s\S]*?```", "", nlp_content)
    nlp_content = re.sub(r"^\s*\|.*\|.*$", "", nlp_content, flags=re.MULTILINE)
    
    # Split content into lines, then split each line into sentences
    sentences = []
    for line in nlp_content.splitlines():
        trimmed_line = line.strip()
        if not trimmed_line:
            continue
        line_sentences = re.split(r'(?<=[.!?])\s+', trimmed_line)
        sentences.extend([s.strip() for s in line_sentences if s.strip()])
    
    stopwords = IQ_STOPWORDS
    
    pos_keywords = [r"\balways\b", r"\bmust\b", r"\bensure\b", r"\bguarantee\b", r"\brequire\b", r"\bstrictly\b"]
    neg_keywords = [r"\bnever\b", r"\bmust not\b", r"\bshould not\b", r"\bdo not\b", r"\bavoid\b", r"\bforbidden\b", r"\bprohibited\b"]
    
    for sentence in sentences:
        clean_sentence = sentence.strip().lower()
        if not clean_sentence:
            continue
            
        is_pos = any(re.search(kw, clean_sentence) for kw in pos_keywords)
        is_neg = any(re.search(kw, clean_sentence) for kw in neg_keywords)
        
        # Extract meaningful nouns/verbs
        words = re.findall(r"\b[a-zA-Z\-]{4,}\b", clean_sentence)
        meaningful_words = {w for w in words if w not in stopwords}
        
        if is_pos and meaningful_words:
            pos_imperatives.append({
                "sentence": sentence.strip(),
                "keywords": meaningful_words
            })
        if is_neg and meaningful_words:
            neg_imperatives.append({
                "sentence": sentence.strip(),
                "keywords": meaningful_words
            })
            
    # Check for contradictions where subject sets overlap significantly
    for pos in pos_imperatives:
        for neg in neg_imperatives:
            # Exclude self-comparison if a sentence got added to both groups
            if pos["sentence"] == neg["sentence"]:
                continue
            intersection = pos["keywords"].intersection(neg["keywords"])
            # If they share 2 or more meaningful words, check for high similarity conflict
            if len(intersection) >= 2:
                # Exclude case where the positive sentence actually contains a negation itself (like "always avoid")
                if "avoid" in pos["sentence"].lower() or "not" in pos["sentence"].lower():
                    continue
                issues.append({
                    "rule_id": "IQ-001",
                    "severity": "CRITICAL",
                    "message": f"Contradictory imperative pair detected:\n  - Positive: '{pos['sentence']}'\n  - Negative: '{neg['sentence']}'\nShared subject terms: {', '.join(intersection)}.",
                    "fix": "Clarify the instructions to eliminate opposing directions for the same context."
                })
                
    # IQ-002: No vague instructions
    vague_phrases = ["handle appropriately", "as needed", "do whatever", "where applicable", "as required", "etc.", "and so on", "if necessary", "accordingly"]
    for idx, line in enumerate(lines, start=1):
        line_lower = line.lower()
        for phrase in vague_phrases:
            if phrase in line_lower:
                issues.append({
                    "rule_id": "IQ-002",
                    "severity": "WARNING",
                    "line": idx,
                    "message": f"Vague instruction phrase '{phrase}' detected.",
                    "fix": "Replace vague instruction with explicit, actionable criteria and specific steps or numbers."
                })
                
    # IQ-003: All {{PLACEHOLDER}} variables documented or resolved
    placeholders = set(re.findall(r"\{\{([A-Z_0-9]+)\}\}", file_content))
    standard_placeholders = {"SKILL_PATH", "WORKSPACE"}
    for ph in placeholders:
        if ph not in standard_placeholders:
            # Check if this placeholder is documented in the file
            # Documented means the placeholder is followed by a dash/colon or in a table
            has_doc = False
            ph_str = "{{" + ph + "}}"
            for line in lines:
                if ph_str in line and any(sym in line for sym in ["—", "-", ":", "|"]):
                    # Make sure it's not just a usage in code block
                    if "python" not in line and "bash" not in line:
                        has_doc = True
                        break
            if not has_doc:
                issues.append({
                    "rule_id": "IQ-003",
                    "severity": "ERROR",
                    "message": f"Undocumented custom placeholder '{{{{{ph}}}}}' found.",
                    "fix": f"Add an explanation of the '{{{{{ph}}}}}' variable in a references or parameters list."
                })
                
    # IQ-004: No unresolved TODO / FIXME markers in instructions
    # Skip content inside code blocks to avoid false positives on examples
    code_block_stack = []
    for idx, line in enumerate(lines, start=1):
        trimmed = line.strip()
        match = re.match(r"^(`{3,})", trimmed)
        if match:
            ticks = match.group(1)
            if code_block_stack and code_block_stack[-1] == ticks:
                code_block_stack.pop()
            else:
                code_block_stack.append(ticks)
            continue
        if code_block_stack:
            continue
        if "TODO" in line or "FIXME" in line:
            issues.append({
                "rule_id": "IQ-004",
                "severity": "WARNING",
                "line": idx,
                "message": f"Unresolved developer marker found: '{line.strip()}'.",
                "fix": "Complete the task or remove the TODO/FIXME placeholder before publishing."
            })
            
    # IQ-005: Code blocks have language specifier
    # We look for lines containing only ```
    code_block_stack = []
    for idx, line in enumerate(lines, start=1):
        trimmed = line.strip()
        match = re.match(r"^(`{3,})", trimmed)
        if match:
            ticks = match.group(1)
            lang = trimmed[len(ticks):].strip()
            if code_block_stack and code_block_stack[-1] == ticks:
                code_block_stack.pop()
            else:
                code_block_stack.append(ticks)
                if not lang:
                    issues.append({
                        "rule_id": "IQ-005",
                        "severity": "INFO",
                        "line": idx,
                        "message": "Code block is missing a syntax language specifier.",
                        "fix": "Add a language tag (e.g. ```bash, ```python) to the opening backticks. (Auto-fixable)",
                        "auto_fixable": True,
                        "fix_type": "add_code_lang",
                        "line_content": line
                    })
                    
    # IQ-006: All referenced scripts exist in scripts/ subdirectory
    # Search for references to scripts/something.py or scripts/something.sh or scripts/rules/something.py
    script_refs = set(re.findall(r"\bscripts/[a-zA-Z0-9_\-\./]+\b", nlp_content))
    for ref in script_refs:
        # Resolve path relative to skill directory
        script_full_path = os.path.join(skill_path, ref.replace("/", os.sep))
        # Remove trailing periods or brackets
        script_full_path = script_full_path.rstrip(".:) ]")
        ref_cleaned = ref.rstrip(".:) ]")
        
        # Check if the script exists
        if not os.path.exists(script_full_path):
            issues.append({
                "rule_id": "IQ-006",
                "severity": "ERROR",
                "message": f"Referenced script '{ref_cleaned}' does not exist in the skill directory.",
                "fix": f"Create the missing script at '{ref_cleaned}' or update the path reference in SKILL.md."
            })
            
    # IQ-008: Decision trees / flowcharts are syntactically consistent (Mermaid labels check)
    # Check for unquoted node labels in Mermaid blocks containing special characters like parentheses or brackets
    inside_mermaid = False
    for idx, line in enumerate(lines, start=1):
        trimmed = line.strip()
        if trimmed.startswith("```mermaid"):
            inside_mermaid = True
            continue
        elif trimmed.startswith("```") and inside_mermaid:
            inside_mermaid = False
            continue
            
        if inside_mermaid:
            # Look for node descriptions like id[Label (Extra)] or id(Label [Extra])
            # If they contain brackets/parentheses and are NOT quoted with ""
            if any(char in trimmed for char in ["[", "(", "{"]):
                # check if there's unquoted parentheses or brackets
                # e.g., node[Some (Info)] is unquoted. node["Some (Info)"] is quoted.
                # Let's match: \w+\[[^"]*[\(\)][^"]*\] or \w+\([^"]*[\[\]][^"]*\)
                bad_mermaid_patterns = [
                    r"\w+\[[^\"\]]*[\(\)][^\"\]]*\]",
                    r"\w+\([^\"\) ]*[\{\[\]\}][^\"\) ]*\)"
                ]
                for pat in bad_mermaid_patterns:
                    if re.search(pat, trimmed):
                        issues.append({
                            "rule_id": "IQ-008",
                            "severity": "WARNING",
                            "line": idx,
                            "message": f"Mermaid node label '{trimmed}' has unquoted parentheses or brackets, which causes rendering syntax errors.",
                            "fix": "Enclose the label in double quotes (e.g., id[\"Label (Info)\"]) instead of id[Label (Info)]."
                        })
                        break
                        
    # IQ-009: Error handling section covers all failure modes
    has_error_handling = False
    for line in lines:
        if re.match(r"^#+\s+(?:error\s+handling|failure\s+modes|исключения)\b", line.strip().lower()):
            has_error_handling = True
            break
    if not has_error_handling:
        issues.append({
            "rule_id": "IQ-009",
            "severity": "WARNING",
            "message": "Missing '## Error handling' section to cover failure modes.",
            "fix": "Add an '## Error handling' section detailing standard recovery procedures or exit codes."
        })
        
    return issues
