import sys
import os
import re

# Reconfigure stdout to use UTF-8 to prevent encoding crashes on Windows PowerShell
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def calculate_density(plan_path):
    if not os.path.exists(plan_path):
        print(f"[ERROR] Plan file not found at '{plan_path}'")
        sys.exit(2)
        
    with open(plan_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    lines = content.splitlines()
    total_chars = len(content)
    
    # 1. Check required sections and extract their content
    required_sections = {
        "user review required": False,
        "премортем-анализ": False,
        "proposed changes": False,
        "verification plan": False
    }
    
    section_contents = {
        "user review required": "",
        "премортем-анализ": "",
        "proposed changes": "",
        "verification plan": ""
    }
    
    current_section = None
    for line in lines:
        line_lower = line.lower()
        # Only parse major headers (H1 and H2) for section transitions, so H3 (###) subheadings do not reset context
        if line.startswith("# ") or line.startswith("## "):
            matched_any = False
            for sec in required_sections:
                if sec in line_lower:
                    required_sections[sec] = True
                    current_section = sec
                    matched_any = True
                    break
            if not matched_any:
                current_section = None
        elif current_section:
            section_contents[current_section] += line + "\n"
                    
    # 2. Count file links (file:///)
    file_links = re.findall(r'\[([^\]]+)\]\(file:///[^\)]+\)', content)
    
    # 3. Check for vague phrases
    vague_phrases = [
        "handle appropriately", "as needed", "добавить обработку", 
        "поправить стили", "как потребуется", "сделать красиво",
        "какие-то изменения", "сделать как обычно", "в нужных местах",
        "fix later", "позже", "сделать заглушку", "заглушка", "temporary", 
        "mock", "посмотреть", "проверить в проде", "do logic", "implement here", 
        "to be determined", "tbd", "some changes", "сделать заглушки", 
        "какие-то правки", "подправить", "поправить", "доработать логику", 
        "в будущем", "in the future", "later", "todo", "заглушки", "заглушку",
        "пока не знаю", "настроить как-то", "каким-то образом", "какие-то действия"
    ]
    found_vague = []
    for idx, line in enumerate(lines, start=1):
        line_lower = line.lower()
        for phrase in vague_phrases:
            if phrase in line_lower:
                found_vague.append((idx, line.strip(), phrase))
                
    # 4. Calculate Score
    score = 100
    deductions = []
    
    # Section check penalty
    missing_sections = [k for k, v in required_sections.items() if not v]
    if missing_sections:
        penalty = len(missing_sections) * 15
        score -= penalty
        deductions.append(f"Missing required sections: {', '.join(missing_sections)} (-{penalty} pts)")
        
    # File link density check
    if len(file_links) < 3:
        score -= 20
        deductions.append(f"Low code anchoring: only {len(file_links)} file link(s) found (need at least 3) (-20 pts)")
        
    # Vague phrases penalty
    if found_vague:
        penalty = min(len(found_vague) * 5, 25)
        score -= penalty
        deductions.append(f"Vague phrases detected: {len(found_vague)} occurrences (-{penalty} pts)")
        
    # Plan length check (Planning Myopia / Happy Path Prevention)
    if total_chars < 1500:
        score -= 15
        deductions.append(f"Low plan depth: total character length is {total_chars} (need at least 1500 characters) (-15 pts)")
        
    # Pre-mortem structure check
    if required_sections["премортем-анализ"]:
        premortem_text = section_contents["премортем-анализ"]
        has_table = "|" in premortem_text and ("-|-" in premortem_text or premortem_text.count("|") >= 5)
        has_keywords = ("риск" in premortem_text.lower() or "risk" in premortem_text.lower()) and \
                       ("предохранитель" in premortem_text.lower() or "mitigation" in premortem_text.lower() or "защит" in premortem_text.lower() or "safeguard" in premortem_text.lower())
        
        if not (has_table or has_keywords):
            score -= 15
            deductions.append("Pre-mortem section is poorly structured: should contain a Markdown table or a list detailing 'Risk' and 'Mitigation/Safeguard' (-15 pts)")
            
        has_pxi = any(term in premortem_text.lower() for term in ["p×i", "p x i", "probability", "вероятность", "влияние", "impact"])
        if not has_pxi:
            score -= 10
            deductions.append("Pre-mortem does not contain a P×I (Probability × Impact) risk matrix or scoring columns (-10 pts)")
            
    # Verification plan commands check
    if required_sections["verification plan"]:
        verification_text = section_contents["verification plan"]
        test_commands = ["npm run", "vitest", "tsc", "eslint", "npx", "jest", "playwright", "cypress"]
        has_command = any(cmd in verification_text.lower() for cmd in test_commands)
        if not has_command:
            score -= 15
            deductions.append("Verification plan does not specify active testing/compilation commands (e.g. 'npm run test', 'vitest', 'tsc --noEmit') (-15 pts)")
            
    # 5. AGENTS.md Contract Compliance Check
    contract_violations = []
    forbidden_colors = [r'\btext-white\b', r'\bbg-white\b', r'\btext-black\b', r'\bbg-black\b', 
                        r'\btext-blue-\d+\b', r'\bbg-blue-\d+\b', r'\btext-red-\d+\b', r'\bbg-red-\d+\b']
    
    for idx, line in enumerate(lines, start=1):
        line_lower = line.lower()
        
        # Check forbidden React 19/Next 16 patterns
        if "forwardref" in line_lower:
            contract_violations.append((idx, line.strip(), "React 19 forbids forwardRef (use direct ref prop instead)"))
        if "useformstate" in line_lower:
            contract_violations.append((idx, line.strip(), "React 19 / Next 16 forbids useFormState (use useActionState instead)"))
            
        # Check forbidden Next.js Page Actions
        if '"use server"' in line or "'use server'" in line:
            if "page.tsx" in line_lower:
                contract_violations.append((idx, line.strip(), "Forbidden \"use server\" inside page.tsx Page Component (causes Next.js crash)"))
                
        # Check forbidden inline colors
        for color_pat in forbidden_colors:
            if re.search(color_pat, line_lower):
                if "forbidden" not in line_lower and "contract" not in line_lower and "rule" not in line_lower and "visual" not in line_lower:
                    contract_violations.append((idx, line.strip(), f"Forbidden inline color pattern detected (use semantic tokens from globals.css instead)"))
                    break
                    
        # Check Pricing Model rules
        if "/ 1000" in line_lower or "1000 шт" in line_lower or "priceper1krub / 1000" in line_lower:
            if "forbidden" not in line_lower and "priceperunitrub" not in line_lower:
                contract_violations.append((idx, line.strip(), "Forbidden division by 1000 in UI / use pricePerUnitRub instead"))
                
        # Check SMS / Phone collection rules
        if "sms" in line_lower or "смс-шлюз" in line_lower or "request_contact" in line_lower:
            if "forbidden" not in line_lower and "artifact" not in line_lower:
                contract_violations.append((idx, line.strip(), "Forbidden SMS gateway integration or phone number collection pattern"))

    if contract_violations:
        penalty = min(len(contract_violations) * 5, 20)
        score -= penalty
        deductions.append(f"AGENTS.md Contract Violations: {len(contract_violations)} violation(s) found (-{penalty} pts)")
        
    score = max(0, score)
    
    # Print report
    print("Plan Density Verification Report")
    print("========================================================")
    print(f"Target Plan  : {os.path.basename(plan_path)}")
    print(f"Density Score: {score} / 100  " + ("[HEALTHY]" if score >= 80 else "[UNHEALTHY]"))
    print(f"Total Chars  : {total_chars}")
    print(f"File Links   : {len(file_links)} anchored references")
    print("========================================================")
    
    if deductions:
        print("\nIssues Found:")
        for dec in deductions:
            print(f"  * {dec}")
            
    if contract_violations:
        print("\n[CRITICAL] AGENTS.md Contract Violations:")
        for idx, line, reason in contract_violations[:5]:
            print(f"  Line {idx}: \"{line}\" -> {reason}")
            
    if found_vague:
        print("\n[WARNING] Vague/Fragile Lines:")
        for idx, line, phrase in found_vague[:5]:
            print(f"  Line {idx}: \"{line}\" (Contains '{phrase}')")
            
    print("========================================================")
    
    if score < 80:
        print("[RESULT] PLAN DENSITY CHECK FAILED. Plan needs deep-refinement before coding.")
        sys.exit(1)
    else:
        print("[RESULT] PLAN DENSITY CHECK PASSED. Excellent plan depth.")
        sys.exit(0)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python plan_density_linter.py <path_to_implementation_plan.md>")
        sys.exit(2)
    calculate_density(sys.argv[1])
