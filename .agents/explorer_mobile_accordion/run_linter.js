const fs = require('fs');
const path = require('path');

const planPath = 'd:/SMM_plan_2/.agents/orchestrator_mobile_accordion/plan.md';

if (!fs.existsSync(planPath)) {
  console.error(`[ERROR] Plan file not found at '${planPath}'`);
  process.exit(2);
}

const content = fs.readFileSync(planPath, 'utf8');
const lines = content.split(/\r?\n/);
const totalChars = content.length;

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
    for (const sec in requiredSections) {
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
const fileLinkRegex = /\[([^\]]+)\]\(file:\/\/\/[^\)]+\)/g;
let fileLinksCount = 0;
while (fileLinkRegex.exec(content) !== null) {
  fileLinksCount++;
}

// 3. Check vague phrases
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
      foundVague.push({ idx: idx + 1, line: line.trim(), phrase });
    }
  });
});

// 4. Calculate Score
let score = 100;
const deductions = [];

// Section check penalty
const missingSections = Object.keys(requiredSections).filter(k => !requiredSections[k]);
if (missingSections.length > 0) {
  const penalty = missingSections.length * 15;
  score -= penalty;
  deductions.push(`Missing required sections: ${missingSections.join(', ')} (-${penalty} pts)`);
}

// File link density check
if (fileLinksCount < 3) {
  score -= 20;
  deductions.push(`Low code anchoring: only ${fileLinksCount} file link(s) found (need at least 3) (-20 pts)`);
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

// Pre-mortem structure check
if (requiredSections["премортем-анализ"]) {
  const premortemText = sectionContents["премортем-анализ"].toLowerCase();
  const hasTable = premortemText.includes("|") && (premortemText.includes("-|-") || (premortemText.split("|").length - 1) >= 5);
  
  const hasKeywords = (premortemText.includes("риск") || premortemText.includes("risk")) &&
                      (premortemText.includes("предохранитель") || premortemText.includes("mitigation") || premortemText.includes("защит") || premortemText.includes("safeguard"));
                      
  if (!(hasTable || hasKeywords)) {
    score -= 15;
    deductions.push("Pre-mortem section is poorly structured: should contain a Markdown table or a list detailing 'Risk' and 'Mitigation/Safeguard' (-15 pts)");
  }
  
  const pxiTerms = ["p\u00d7i", "p x i", "probability", "вероятность", "влияние", "impact"];
  const hasPxi = pxiTerms.some(term => premortemText.includes(term));
  if (!hasPxi) {
    score -= 10;
    deductions.push("Pre-mortem does not contain a P\u00d7I (Probability \u00d7 Impact) risk matrix or scoring columns (-10 pts)");
  }
}

// Verification plan commands check
if (requiredSections["verification plan"]) {
  const verificationText = sectionContents["verification plan"].toLowerCase();
  const testCommands = ["npm run", "vitest", "tsc", "eslint", "npx", "jest", "playwright", "cypress"];
  const hasCommand = testCommands.some(cmd => verificationText.includes(cmd));
  if (!hasCommand) {
    score -= 15;
    deductions.push("Verification plan does not specify active testing/compilation commands (e.g. 'npm run test', 'vitest', 'tsc --noEmit') (-15 pts)");
  }
}

// 5. AGENTS.md Contract Compliance Check
const contractViolations = [];
const forbiddenColors = [
  /\btext-white\b/, /\bbg-white\b/, /\btext-black\b/, /\bbg-black\b/, 
  /\btext-blue-\d+\b/, /\bbg-blue-\d+\b/, /\btext-red-\d+\b/, /\bbg-red-\d+\b/
];

lines.forEach((line, idx) => {
  const lineLower = line.toLowerCase();
  const lineNum = idx + 1;
  
  if (lineLower.includes("forwardref")) {
    contractViolations.push({ idx: lineNum, line: line.trim(), reason: "React 19 forbids forwardRef (use direct ref prop instead)" });
  }
  if (lineLower.includes("useformstate")) {
    contractViolations.push({ idx: lineNum, line: line.trim(), reason: "React 19 / Next 16 forbids useFormState (use useActionState instead)" });
  }
  if (line.includes('"use server"') || line.includes("'use server'")) {
    if (lineLower.includes("page.tsx")) {
      contractViolations.push({ idx: lineNum, line: line.trim(), reason: "Forbidden \"use server\" inside page.tsx Page Component (causes Next.js crash)" });
    }
  }
  
  for (const colorPat of forbiddenColors) {
    if (colorPat.test(lineLower)) {
      if (!lineLower.includes("forbidden") && !lineLower.includes("contract") && !lineLower.includes("rule") && !lineLower.includes("visual")) {
        contractViolations.push({ idx: lineNum, line: line.trim(), reason: "Forbidden inline color pattern detected (use semantic tokens from globals.css instead)" });
        break;
      }
    }
  }
  
  if (lineLower.includes("/ 1000") || lineLower.includes("1000 шт") || lineLower.includes("priceper1krub / 1000")) {
    if (!lineLower.includes("forbidden") && !lineLower.includes("priceperunitrub")) {
      contractViolations.push({ idx: lineNum, line: line.trim(), reason: "Forbidden division by 1000 in UI / use pricePerUnitRub instead" });
    }
  }
  
  if (lineLower.includes("sms") || lineLower.includes("смс-шлюз") || lineLower.includes("request_contact")) {
    if (!lineLower.includes("forbidden") && !lineLower.includes("artifact")) {
      contractViolations.push({ idx: lineNum, line: line.trim(), reason: "Forbidden SMS gateway integration or phone number collection pattern" });
    }
  }
});

if (contractViolations.length > 0) {
  const penalty = Math.min(contractViolations.length * 5, 20);
  score -= penalty;
  deductions.push(`AGENTS.md Contract Violations: ${contractViolations.length} violation(s) found (-${penalty} pts)`);
}

score = Math.max(0, score);

console.log("Plan Density Verification Report");
console.log("========================================================");
console.log(`Target Plan  : ${path.basename(planPath)}`);
console.log(`Density Score: ${score} / 100  ${score >= 80 ? '[HEALTHY]' : '[UNHEALTHY]'}`);
console.log(`Total Chars  : ${totalChars}`);
console.log(`File Links   : ${fileLinksCount} anchored references`);
console.log("========================================================");

if (deductions.length > 0) {
  console.log("\nIssues Found:");
  deductions.forEach(dec => {
    console.log(`  * ${dec}`);
  });
}

if (contractViolations.length > 0) {
  console.log("\n[CRITICAL] AGENTS.md Contract Violations:");
  contractViolations.slice(0, 5).forEach(violation => {
    console.log(`  Line ${violation.idx}: "${violation.line}" -> ${violation.reason}`);
  });
}

if (foundVague.length > 0) {
  console.log("\n[WARNING] Vague/Fragile Lines:");
  foundVague.slice(0, 5).forEach(vague => {
    console.log(`  Line ${vague.idx}: "${vague.line}" (Contains '${vague.phrase}')`);
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
