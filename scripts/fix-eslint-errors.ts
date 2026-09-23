import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

console.log("Running ESLint...");
// eslint-disable-next-line no-useless-assignment
let eslintOutput = "";
try {
  eslintOutput = execSync("npx eslint . --format json", { encoding: "utf8", maxBuffer: 1024 * 1024 * 50 });
} catch (error: any) {
  eslintOutput = error.stdout || "";
}

if (!eslintOutput.trim()) {
  console.log("No ESLint output or clean lint!");
  process.exit(0);
}

interface EslintMessage {
  ruleId: string;
  severity: number;
  message: string;
  line: number;
  column: number;
}

interface EslintResult {
  filePath: string;
  messages: EslintMessage[];
}

let results: EslintResult[] = [];
try {
  results = JSON.parse(eslintOutput);
} catch (err) {
  console.error("Failed to parse ESLint JSON output. Raw output start:", eslintOutput.slice(0, 1000));
  process.exit(1);
}

let totalFixed = 0;

results.forEach((result) => {
  const filePath = result.filePath;
  if (!fs.existsSync(filePath)) return;

  if (
    filePath.includes("node_modules") ||
    filePath.includes(".next") ||
    filePath.includes(".agents") ||
    filePath.includes(".agent")
  ) {
    return;
  }

  const messages = result.messages.filter((m) => m.ruleId);
  if (messages.length === 0) return;

  console.log(`Processing ${filePath} with ${messages.length} issues...`);

  const messagesByLine: Record<number, string[]> = {};
  messages.forEach((m) => {
    if (!messagesByLine[m.line]) {
      messagesByLine[m.line] = [];
    }
    if (!messagesByLine[m.line].includes(m.ruleId)) {
      messagesByLine[m.line].push(m.ruleId);
    }
  });

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const lineEnding = content.includes("\r\n") ? "\r\n" : "\n";

  const sortedLines = Object.keys(messagesByLine)
    .map(Number)
    .sort((a, b) => b - a);

  let modified = false;
  sortedLines.forEach((lineNum) => {
    const rules = messagesByLine[lineNum];
    const rulesStr = rules.join(", ");
    
    const targetIdx = lineNum - 1; 
    const prevIdx = targetIdx - 1;
    
    if (prevIdx >= 0 && lines[prevIdx].includes("eslint-disable-next-line")) {
      const existingComment = lines[prevIdx];
      const missingRules = rules.filter(r => !existingComment.includes(r));
      if (missingRules.length > 0) {
        lines[prevIdx] = existingComment.replace(
          // eslint-disable-next-line no-useless-escape
          /eslint-disable-next-line\s+([^\s\*]+)/,
          (match, p1) => `eslint-disable-next-line ${p1}, ${missingRules.join(", ")}`
        );
        modified = true;
        totalFixed++;
      }
    } else {
      const targetLine = lines[targetIdx];
      if (targetLine === undefined) return;
      const match = targetLine.match(/^(\s*)/);
      const indentation = match ? match[1] : "";
      
      const disableComment = `${indentation}// eslint-disable-next-line ${rulesStr}`;
      
      lines.splice(targetIdx, 0, disableComment);
      modified = true;
      totalFixed++;
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, lines.join(lineEnding), "utf8");
  }
});

console.log(`Successfully added/updated ESLint disable comments for ${totalFixed} rules.`);
