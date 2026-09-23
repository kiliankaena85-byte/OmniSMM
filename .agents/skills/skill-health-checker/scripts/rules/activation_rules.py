import re
from rules.common import STOPWORDS

def check(skill_path, file_content, frontmatter, skill_dir_name, all_skills=None):
    issues = []
    
    description = frontmatter.get("description", "")
    if not description:
        return issues
        
    desc_stripped = str(description).strip()
    desc_lower = desc_stripped.lower()
    
    # AR-005: description does not exceed 500 chars (model memory limit)
    desc_len = len(desc_stripped)
    if desc_len > 500:
        issues.append({
            "rule_id": "AR-005",
            "severity": "ERROR",
            "section": "Activation",
            "message": f"Description length is {desc_len} characters, which exceeds the strict 500-character agent memory limit.",
            "fix": "Shorten the description in YAML frontmatter to under 500 characters."
        })
        
    # AR-001: description contains at least 3 activation trigger phrases
    # Let's count potential triggers. Triggers usually start with "when", "before", "after", "if the user", "to scan", etc.
    # Or split by commas/newlines and look for phrases detailing conditions.
    trigger_indicators = [
        r"\bwhen\b", r"\bbefore\b", r"\bafter\b", r"\bduring\b", r"\bif\b", 
        r"\buse\b", r"\bto\s+[a-z]{3,}\b", r"\bfor\s+[a-z]{3,}\b", r"\bprotects\b",
        r"\bdetects\b", r"\btracks\b", r"\bvalidates\b", r"\bscans\b", r"\bmonitors\b"
    ]
    
    trigger_count = 0
    for ind in trigger_indicators:
        matches = re.findall(ind, desc_lower)
        trigger_count += len(matches)
        
    if trigger_count < 3:
        issues.append({
            "rule_id": "AR-001",
            "severity": "WARNING",
            "section": "Activation",
            "message": f"Description contains only {trigger_count} activation trigger indicator(s) (needs at least 3). The agent might fail to activate this skill.",
            "fix": "Expand the description to list at least 3 explicit trigger situations (e.g. 'Use before committing, after editing a skill, or when...')."
        })
        
    # AR-002: Trigger phrases use action verbs (not just nouns)
    action_verbs = {
        "scan", "scans", "detect", "detects", "protect", "protects", "run", "runs", "validate", "validates",
        "compare", "compares", "analyze", "analyzes", "monitor", "monitors", "check", "checks", "track", "tracks",
        "manage", "manages", "archive", "archives", "delete", "deletes", "clean", "cleans", "resolve", "resolves",
        "handle", "handles", "lint", "lints", "audit", "audits"
    }
    
    words = re.findall(r"\b[a-zA-Z]{3,}\b", desc_lower)
    has_action_verb = any(word in action_verbs for word in words)
    if not has_action_verb:
        issues.append({
            "rule_id": "AR-002",
            "severity": "WARNING",
            "section": "Activation",
            "message": "Description does not contain clear action verbs (e.g. 'scans', 'lints', 'validates'). Purely nominal descriptions weaken model intent understanding.",
            "fix": "Rephrase description to include action verbs describing exactly what the skill does."
        })
        
    # AR-003: description does not overlap >50% with another installed skill (Jaccard similarity)
    if all_skills:
        stopwords = STOPWORDS
        
        target_words = set(re.findall(r"\b[a-z]{4,}\b", desc_lower)) - stopwords
        
        if target_words:
            for other_skill in all_skills:
                other_name = other_skill.get("name")
                if other_name == skill_dir_name:
                    continue
                    
                other_desc = other_skill.get("description", "").lower()
                other_words = set(re.findall(r"\b[a-z]{4,}\b", other_desc)) - stopwords
                
                if other_words:
                    intersection = target_words.intersection(other_words)
                    union = target_words.union(other_words)
                    overlap = len(intersection) / len(union)
                    
                    if overlap > 0.50:
                        issues.append({
                            "rule_id": "AR-003",
                            "severity": "WARNING",
                            "section": "Activation",
                            "message": f"Description overlaps {overlap:.1%} with installed skill '{other_name}'. Overlapping skills cause activation confusion.",
                            "fix": f"Differentiate description keywords from '{other_name}' to clarify unique responsibilities."
                        })
                        
    # AR-004: Activation conditions are mutually exclusive with ## Scope / ## Out of scope
    # Find ## Scope boundaries or ## Out of scope section, and see if negative scope items contradict positive triggers
    lines = file_content.splitlines()
    scope_content = []
    inside_scope = False
    
    for line in lines:
        if re.match(r"^#+\s+(?:scope boundaries|out of scope|scope|границы)\b", line.strip().lower()):
            inside_scope = True
            continue
        elif re.match(r"^#+\s+", line.strip()) and inside_scope:
            inside_scope = False
            
        if inside_scope:
            scope_content.append(line.strip().lower())
            
    scope_text = " ".join(scope_content)
    # Check if there are scope boundaries detailing things we don't do
    # For example: if scope says "does not run scripts" and trigger has "runs scripts"
    # Let's see if there are shared nouns in the scope text and the trigger text that have different polarities.
    # This can be simplified to checking if positive trigger words are explicitly negated in scope
    negated_scope_terms = re.findall(r"(?:not|never|no|doesn't|does not|don't|won't)\s+([a-z]{4,})", scope_text)
    for term in negated_scope_terms:
        if term in desc_lower and term not in {"this", "file", "code", "user", "skill"}:
            issues.append({
                "rule_id": "AR-004",
                "severity": "WARNING",
                "section": "Activation",
                "message": f"Potential conflict between activation trigger and scope boundary for keyword '{term}'. Description implies it does it, but scope boundaries negate it.",
                "fix": f"Clarify whether '{term}' is in scope or out of scope."
            })
            
    return issues
