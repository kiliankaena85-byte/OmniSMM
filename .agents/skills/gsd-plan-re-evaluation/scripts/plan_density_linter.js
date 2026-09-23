const fs = require('fs');
const path = require('path');

function calculateDensity(planPath) {
  if (!fs.existsSync(planPath)) {
    console.error(`[ERROR] Plan file not found at '${planPath}'`);
    process.exit(2);
  }

  const content = fs.readFileSync(planPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const totalChars = content.length;

  // 1. Check required sections
  const requiredSections = {
    "user review required": false,
    "премортем-анализ": false,
    "proposed changes": false,
    "verification plan": false
  };

  const sectionContents = {
    "user review required": "",
    "премортем-анализ": "",
    "proposed changes": "",
    "verification plan": ""
  };

  let currentSection = null;
  for (const line of lines) {
    const lineLower = line.toLowerCase();
    if (line.startsWith("# ") || line.startsWith("## ")) {
      let matchedAny = false;
      for (const sec of Object.keys(requiredSections)) {
        if (lineLower.includes(sec)) {
          requiredSections[sec] = true;
          currentSection = sec;
          matchedAny = true;
          break;
        }
      }
      if (!matchedAny) {
        currentSection = null;
      }
    } else if (currentSection) {
      sectionContents[currentSection] += line + "\n";
    }
  }

  // 2. Count file links
  const fileLinks = [];
  const fileLinkRegex = /\[([^\]]+)\]\(file:\/\/\/[^\)]+\)/g;
  let match;
  while ((match = fileLinkRegex.exec(content)) !== null) {
    fileLinks.push(match[1]);
  }

  // 3. Vague phrases
  const vaguePhrases = [
    "handle appropriately", "as needed", "добавить обработку", 
    "поправить стили", "как потребуется", "сделать красиво",
    "какие-то изменения", "сделать как обычно", "в нужных местах",
    "fix later", "позже", "сделать заглушку", "заглушка", "temporary", 
    "mock", "посмотреть", "проверить в проде", "do logic", "implement here", 
    "to be determined", "tbd", "some changes", "сделать заглушки", 
    "какие-то правки", "подправить", "поправить", "доработать логику", 
    "в будущем", "in the future", "later", "todo", "заглушки", "заглушку",
    "пока не знаю", "настроить как-то", "каким-то образом", "какие-то действия"
  ];
  const foundVague = [];
  lines.forEach((line, idx) => {
    const lineLower = line.toLowerCase();
    vaguePhrases.forEach(phrase => {
      if (lineLower.includes(phrase)) {
        foundVague.push({ lineNum: idx + 1, text: line.trim(), phrase });
      }
    });
  });

  // 4. Calculate Score
  let score = 100;
  const deductions = [];

  // Section check penalty
  const missingSections = Object.keys(requiredSections).filter(sec => !requiredSections[sec]);
  if (missingSections.length > 0) {
    const penalty = missingSections.length * 15;
    score -= penalty;
    deductions.push(`Missing required sections: ${missingSections.join(', ')} (-${penalty} pts)`);
  }

  // File link density
  if (fileLinks.length < 3) {
    score -= 20;
    deductions.push(`Low code anchoring: only ${fileLinks.length} file link(s) found (need at least 3) (-20 pts)`);
  }

  // Vague phrases penalty
  if (foundVague.length > 0) {
    const penalty = Math.min(foundVague.length * 5, 25);
    score -= penalty;
    deductions.push(`Vague phrases detected: ${foundVague.length} occurrences (-${penalty} pts)`);
  }

  // Plan length check
  if (totalChars < 1500) {
    score -= 15;
    deductions.push(`Low plan depth: total character length is ${totalChars} (need at least 1500 characters) (-15 pts)`);
  }

  // Pre-mortem check
  if (requiredSections["премортем-анализ"]) {
    const premortemText = sectionContents["премортем-анализ"].toLowerCase();
    const hasTable = premortemText.includes("|") && (premortemText.includes("-|-") || (premortemText.split("|").length - 1) >= 5);
    const hasKeywords = (premortemText.includes("риск") || premortemText.includes("risk")) &&
                        (premortemText.includes("предохранитель") || premortemText.includes("mitigation") || premortemText.includes("защит") || premortemText.includes("safeguard"));

    if (!hasTable && !hasKeywords) {
      score -= 15;
      deductions.push("Pre-mortem section is poorly structured: should contain a Markdown table or a list detailing 'Risk' and 'Mitigation/Safeguard' (-15 pts)");
    }

    const hasPxi = ["p×i", "p x i", "probability", "вероятность", "влияние", "impact"].some(term => premortemText.includes(term));
    if (!hasPxi) {
      score -= 10;
      deductions.push("Pre-mortem does not contain a P×I (Probability × Impact) risk matrix or scoring columns (-10 pts)");
    }
  }

  // Verification plan check
  if (requiredSections["verification plan"]) {
    const verificationText = sectionContents["verification plan"].toLowerCase();
    const testCommands = ["npm run", "vitest", "tsc", "eslint", "npx", "jest", "playwright", "cypress"];
    const hasCommand = testCommands.some(cmd => verificationText.includes(cmd));
    if (!hasCommand) {
      score -= 15;
      deductions.push("Verification plan does not specify active testing/compilation commands (e.g. 'npm run test', 'vitest', 'tsc --noEmit') (-15 pts)");
    }
  }

  // 5. AGENTS.md compliance check
  const contractViolations = [];
  const forbiddenColors = [
    /\btext-white\b/, /\bbg-white\b/, /\btext-black\b/, /\bbg-black\b/,
    /\btext-blue-\d+\b/, /\bbg-blue-\d+\b/, /\btext-red-\d+\b/, /\bbg-red-\d+\b/
  ];

  lines.forEach((line, idx) => {
    const lineLower = line.toLowerCase();
    if (lineLower.includes("forwardref")) {
      contractViolations.push({ lineNum: idx + 1, text: line.trim(), reason: "React 19 forbids forwardRef (use direct ref prop instead)" });
    }
    if (lineLower.includes("useformstate")) {
      contractViolations.push({ lineNum: idx + 1, text: line.trim(), reason: "React 19 / Next 16 forbids useFormState (use useActionState instead)" });
    }
    if (line.includes('"use server"') || line.includes("'use server'")) {
      if (lineLower.includes("page.tsx")) {
        contractViolations.push({ lineNum: idx + 1, text: line.trim(), reason: "Forbidden \"use server\" inside page.tsx Page Component (causes Next.js crash)" });
      }
    }
    forbiddenColors.forEach(pat => {
      if (pat.test(lineLower)) {
        if (!lineLower.includes("forbidden") && !lineLower.includes("contract") && !lineLower.includes("rule") && !lineLower.includes("visual")) {
          contractViolations.push({ lineNum: idx + 1, text: line.trim(), reason: "Forbidden inline color pattern detected (use semantic tokens from globals.css instead)" });
        }
      }
    });
    if (lineLower.includes("/ 1000") || lineLower.includes("1000 шт") || lineLower.includes("priceper1krub / 1000")) {
      if (!lineLower.includes("forbidden") && !lineLower.includes("priceperunitrub")) {
        contractViolations.push({ lineNum: idx + 1, text: line.trim(), reason: "Forbidden division by 1000 in UI / use pricePerUnitRub instead" });
      }
    }
    if (lineLower.includes("sms") || lineLower.includes("смс-шлюз") || lineLower.includes("request_contact")) {
      if (!lineLower.includes("forbidden") && !lineLower.includes("artifact")) {
        contractViolations.push({ lineNum: idx + 1, text: line.trim(), reason: "Forbidden SMS gateway integration or phone number collection pattern" });
      }
    }
  });

  if (contractViolations.length > 0) {
    const penalty = Math.min(contractViolations.length * 5, 20);
    score -= penalty;
    deductions.push(`AGENTS.md Contract Violations: ${contractViolations.length} violation(s) found (-${penalty} pts)`);
  }

  score = Math.max(0, score);

  console.log("Plan Density Verification Report (Node.js Engine)");
  console.log("========================================================");
  console.log(`Target Plan  : ${path.basename(planPath)}`);
  console.log(`Density Score: ${score} / 100  ` + (score >= 80 ? "[HEALTHY]" : "[UNHEALTHY]"));
  console.log(`Total Chars  : ${totalChars}`);
  console.log(`File Links   : ${fileLinks.length} anchored references`);
  console.log("========================================================");

  if (deductions.length > 0) {
    console.log("\nIssues Found:");
    deductions.forEach(dec => console.log(`  * ${dec}`));
  }

  if (contractViolations.length > 0) {
    console.log("\n[CRITICAL] AGENTS.md Contract Violations:");
    contractViolations.slice(0, 5).forEach(v => {
      console.log(`  Line ${v.lineNum}: "${v.text}" -> ${v.reason}`);
    });
  }

  if (foundVague.length > 0) {
    console.log("\n[WARNING] Vague/Fragile Lines:");
    foundVague.slice(0, 5).forEach(v => {
      console.log(`  Line ${v.lineNum}: "${v.text}" (Contains '${v.phrase}')`);
    });
  }
  console.log("========================================================");

  if (score < 80) {
    console.log("[RESULT] PLAN DENSITY CHECK FAILED. Plan needs deep-refinement before coding.");
    process.exit(1);
  } else {
    console.log("[RESULT] PLAN DENSITY CHECK PASSED. Excellent plan depth.");
    process.exit(0);
  }
}

const planPath = process.argv[2];
if (!planPath) {
  console.log("Usage: node plan_density_linter.js <path_to_implementation_plan.md>");
  process.exit(2);
}
calculateDensity(planPath);
