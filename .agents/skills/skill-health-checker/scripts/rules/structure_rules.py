import re

def check(skill_path, file_content, frontmatter, skill_dir_name, all_skills=None):
    issues = []
    lines = file_content.splitlines()
    
    # Parse headings
    headings = []
    code_block_stack = []
    for idx, line in enumerate(lines, start=1):
        striped = line.strip()
        cb_match = re.match(r"^(`{3,})", striped)
        if cb_match:
            ticks = cb_match.group(1)
            if code_block_stack and code_block_stack[-1] == ticks:
                code_block_stack.pop()
            else:
                code_block_stack.append(ticks)
            continue
        if code_block_stack:
            continue
            
        match = re.match(r"^(#+)\s+(.+)$", striped)
        if match:
            headings.append({
                "level": len(match.group(1)),
                "text": match.group(2).strip(),
                "line": idx,
                "start_idx": file_content.find(line)
            })
            
    # ST-006: Total SKILL.md length < 20,000 chars
    total_len = len(file_content)
    if total_len >= 20000:
        issues.append({
            "rule_id": "ST-006",
            "severity": "WARNING",
            "message": f"SKILL.md total length is {total_len} characters. Ideal length is under 20,000 characters to conserve context budget.",
            "fix": "Condense instructions, remove excessively verbose logs or boilerplate code blocks."
        })
        
    # ST-009: No duplicate section headings
    heading_occurrences = {}
    for h in headings:
        h_text_lower = h["text"].lower()
        if h_text_lower not in heading_occurrences:
            heading_occurrences[h_text_lower] = []
        heading_occurrences[h_text_lower].append(h)
        
    for text_lower, occurrences in heading_occurrences.items():
        if len(occurrences) > 1:
            duplicate_lines = [str(o["line"]) for o in occurrences]
            issues.append({
                "rule_id": "ST-009",
                "severity": "ERROR",
                "line": occurrences[1]["line"],
                "section": occurrences[1]["text"],
                "message": f"Duplicate section heading '{occurrences[0]['text']}' found at lines {', '.join(duplicate_lines)}.",
                "fix": "Rename duplicate headings to ensure a unique document outline structure."
            })
            
    # ST-005: No empty sections (heading with no content)
    for i, h in enumerate(headings):
        start_line = h["line"]
        end_line = headings[i+1]["line"] - 1 if i + 1 < len(headings) else len(lines)
        
        # Get content lines in between
        section_lines = lines[start_line:end_line]
        section_content = "\n".join(section_lines).strip()
        
        # Check if the next heading is a subheading (child section)
        is_parent = False
        if i + 1 < len(headings):
            next_h = headings[i+1]
            if next_h["level"] > h["level"]:
                is_parent = True
        
        # Filter out empty space and other headings or HTML comments
        clean_content = re.sub(r"<!--[\s\S]*?-->", "", section_content).strip()
        if not clean_content and not is_parent:
            issues.append({
                "rule_id": "ST-005",
                "severity": "ERROR",
                "line": h["line"],
                "section": h["text"],
                "message": f"Section heading '{h['text']}' has no content.",
                "fix": "Add detailed instructions/content under the section or remove the heading if it is redundant."
            })
            
    # Check specific sections
    has_when_to_activate = False
    has_step_by_step = False
    has_references = False
    has_scope = False
    
    when_to_activate_section_content = []
    
    for i, h in enumerate(headings):
        text_lower = h["text"].lower()
        
        # Find When to activate
        if "when to activate" in text_lower or "when to use" in text_lower:
            has_when_to_activate = True
            start_line = h["line"]
            end_line = headings[i+1]["line"] - 1 if i + 1 < len(headings) else len(lines)
            when_to_activate_section_content = lines[start_line:end_line]
            
        # Find Step-by-step or Protocol or Instructions
        if any(term in text_lower for term in ["step-by-step", "step by step", "protocol", "execution", "instructions", "инструкции"]):
            has_step_by_step = True
            
        # Find References or See also
        if any(term in text_lower for term in ["references", "see also", "links", "источники", "литература"]):
            has_references = True
            
        # Find Scope boundaries or Out of scope
        if any(term in text_lower for term in ["scope boundaries", "out of scope", "scope", "границы", "вне области"]):
            has_scope = True
            
    # ST-001: ## When to activate section present
    if not has_when_to_activate:
        issues.append({
            "rule_id": "ST-001",
            "severity": "ERROR",
            "message": "Missing required '## When to activate' or '## When to use' section.",
            "fix": "Add a '## When to activate' section listing conditions under which the skill must be triggered."
        })
    # ST-002: ## When to activate contains a table or list
    elif when_to_activate_section_content:
        content_block = "\n".join(when_to_activate_section_content)
        # check for markdown table pipe or list chars
        has_table_or_list = any(char in content_block for char in ["|", "* ", "- ", "+ ", "1. ", "□", "[ ]", "[x]", "[/]"])
        if not has_table_or_list:
            issues.append({
                "rule_id": "ST-002",
                "severity": "WARNING",
                "message": "The '## When to activate' section does not contain a structured table or bulleted list.",
                "fix": "Format the activation triggers as a Markdown table or a list for high readability."
            })
            
    # ST-003: At least one ## Step-by-step or ## Protocol section
    if not has_step_by_step:
        issues.append({
            "rule_id": "ST-003",
            "severity": "WARNING",
            "message": "Missing '## Step-by-step execution protocol' or another step-by-step instructions section.",
            "fix": "Add a '## Step-by-step execution protocol' section outlining exact execution steps."
        })
        
    # ST-004: Sections use proper markdown headings (not bold)
    # Search for bold pseudo-headings (lines consisting ONLY of bold text, e.g. **Heading**)
    # Skip content inside code blocks to avoid false positives
    code_block_stack = []
    for idx, line in enumerate(lines, start=1):
        striped = line.strip()
        match = re.match(r"^(`{3,})", striped)
        if match:
            ticks = match.group(1)
            if code_block_stack and code_block_stack[-1] == ticks:
                code_block_stack.pop()
            else:
                code_block_stack.append(ticks)
            continue
        if code_block_stack:
            continue
        # Ensure it's not empty, not a list item, and matches bold tags exactly at start/end
        if (striped.startswith("**") and striped.endswith("**") and not striped.startswith("- **") and not striped.startswith("* **")):
            bold_content = striped[2:-2].strip()
            if bold_content and len(bold_content) < 80 and not bold_content.endswith(".") and not bold_content.endswith(":") :
                issues.append({
                    "rule_id": "ST-004",
                    "severity": "INFO",
                    "line": idx,
                    "message": f"Bold pseudo-heading '{striped}' found instead of proper markdown heading structure.",
                    "fix": f"Replace bold line with proper markdown heading (e.g., '### {bold_content}'). (Auto-fixable)",
                    "auto_fixable": True,
                    "fix_type": "convert_pseudo_heading",
                    "line_content": line,
                    "heading_text": bold_content
                })
                
    # ST-007: ## References or ## See also section present
    if not has_references:
        issues.append({
            "rule_id": "ST-007",
            "severity": "INFO",
            "message": "Adding a '## References' section with links/references helps improve agent context.",
            "fix": "Add a '## References' section at the end of your SKILL.md file."
        })
        
    # ST-008: ## Scope boundaries or ## Out of scope present
    if not has_scope:
        issues.append({
            "rule_id": "ST-008",
            "severity": "WARNING",
            "message": "Missing '## Scope boundaries' or '## Out of scope' section.",
            "fix": "Add a '## Scope boundaries' section detailing what the skill does NOT do, protecting from scope creep."
        })
        
    return issues
