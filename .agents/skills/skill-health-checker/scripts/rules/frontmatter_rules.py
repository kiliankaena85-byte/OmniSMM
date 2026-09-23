import re

def check(skill_path, file_content, frontmatter, skill_dir_name, all_skills=None):
    issues = []
    
    # FM-001: name field present and non-empty
    name = frontmatter.get("name")
    if not name:
        issues.append({
            "rule_id": "FM-001",
            "severity": "CRITICAL",
            "section": "Frontmatter",
            "message": "The 'name' field is missing or empty in YAML frontmatter.",
            "fix": "Add 'name: <skill-name>' to the frontmatter."
        })
    
    # FM-002: description field present and non-empty
    description = frontmatter.get("description")
    if not description:
        issues.append({
            "rule_id": "FM-002",
            "severity": "CRITICAL",
            "section": "Frontmatter",
            "message": "The 'description' field is missing or empty in YAML frontmatter.",
            "fix": "Add 'description: <summary>' to the frontmatter describing when the agent should use this skill."
        })
    
    # FM-003: version field present and valid semver
    version = frontmatter.get("version")
    if not version:
        issues.append({
            "rule_id": "FM-003",
            "severity": "WARNING",
            "section": "Frontmatter",
            "message": "The 'version' field is missing in YAML frontmatter.",
            "fix": "Add 'version: 0.1.0' to the frontmatter. (Auto-fixable)",
            "auto_fixable": True,
            "fix_type": "add_version"
        })
    elif not re.match(r"^\d+\.\d+\.\d+$", str(version).strip()):
        issues.append({
            "rule_id": "FM-003",
            "severity": "WARNING",
            "section": "Frontmatter",
            "message": f"Version '{version}' is not valid SemVer. Must be in MAJOR.MINOR.PATCH format.",
            "fix": "Change version format to a standard SemVer string (e.g., '1.0.0')."
        })
        
    if description:
        desc_stripped = str(description).strip()
        desc_lower = desc_stripped.lower()
        
        # FM-004: description is written in third person
        # Checks if it starts with first person pronouns.
        # Note: "This skill scans..." is the standard Antigravity description format — NOT first person.
        first_person_patterns = [
            r"^(i|we|my|our)\b"
        ]
        is_first_person = False
        for pattern in first_person_patterns:
            if re.search(pattern, desc_lower):
                is_first_person = True
                break
                
        if is_first_person:
            issues.append({
                "rule_id": "FM-004",
                "severity": "WARNING",
                "section": "Frontmatter",
                "message": "Description is not written in the third person. Avoid 'I', 'We', or 'This skill...'. Start directly with an active verb (e.g. 'Scans files...', 'Validates manifests...').",
                "fix": "Rewrite description to start with an active third-person verb."
            })
            
        # FM-005: description contains activation keywords
        keywords = ["use when", "activate", "before", "after", "when the user", "if the user", "trigger", "when asking", "when parsing", "detects", "protects", "runs when"]
        has_keywords = any(kw in desc_lower for kw in keywords)
        if not has_keywords:
            issues.append({
                "rule_id": "FM-005",
                "severity": "WARNING",
                "section": "Frontmatter",
                "message": "Description does not contain activation trigger keywords. The agent might not know when to invoke this skill.",
                "fix": "Include explicit trigger phrases like 'Use when...', 'Activate before...', or 'Trigger when the user asks...'."
            })
            
        # FM-006: description length: 50–500 chars
        desc_len = len(desc_stripped)
        if desc_len < 50 or desc_len > 500:
            issues.append({
                "rule_id": "FM-006",
                "severity": "WARNING",
                "section": "Frontmatter",
                "message": f"Description length is {desc_len} characters. Ideal length is between 50 and 500 characters to prevent model memory bloat.",
                "fix": f"Adjust the description to be between 50 and 500 characters (currently {desc_len})."
            })
            
    # FM-007: No unknown frontmatter fields (typo guard)
    allowed_fields = {"name", "version", "description", "deprecated", "owner", "tier", "security_review_required"}
    unknown_fields = [k for k in frontmatter.keys() if k not in allowed_fields]
    if unknown_fields:
        issues.append({
            "rule_id": "FM-007",
            "severity": "INFO",
            "section": "Frontmatter",
            "message": f"Unknown frontmatter fields detected: {', '.join(unknown_fields)}.",
            "fix": "Remove unknown or misspelled YAML fields to avoid frontmatter parsing issues. (Auto-fixable)",
            "auto_fixable": True,
            "fix_type": "remove_unknown_fields",
            "fields": unknown_fields
        })
        
    # FM-008: name matches the directory name exactly
    if name and name != skill_dir_name:
        issues.append({
            "rule_id": "FM-008",
            "severity": "ERROR",
            "section": "Frontmatter",
            "message": f"YAML name '{name}' does not match directory name '{skill_dir_name}'.",
            "fix": f"Update the frontmatter name field to match the directory name exactly: 'name: {skill_dir_name}'."
        })
        
    # FM-009: deprecated field present if skill is stale
    if "deprecated" in frontmatter:
        issues.append({
            "rule_id": "FM-009",
            "severity": "INFO",
            "section": "Frontmatter",
            "message": f"Skill is marked as deprecated: {frontmatter['deprecated']}.",
            "fix": "No action needed. Deprecation flag is active."
        })
        
    return issues
