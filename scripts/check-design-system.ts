import fs from "fs";
import path from "path";

// List of raw color patterns that are forbidden in JSX classes (must use semantic tokens instead)
const BANNED_COLOR_PATTERNS = [
  { pattern: /\bbg-black\b/, replacement: "bg-background or bg-card" },
  { pattern: /\bbg-white\b/, replacement: "bg-card or bg-background" },
  { pattern: /\btext-black\b/, replacement: "text-foreground" },
  { pattern: /\btext-white\b/, replacement: "text-primary-foreground or text-foreground" },
  { pattern: /\bbg-blue-\d+\b/, replacement: "bg-primary or bg-secondary" },
  { pattern: /\btext-blue-\d+\b/, replacement: "text-primary" },
  { pattern: /\bbg-red-\d+\b/, replacement: "bg-destructive/10" },
  { pattern: /\btext-red-\d+\b/, replacement: "text-destructive" },
  { pattern: /\bbg-green-\d+\b/, replacement: "bg-success/10" },
  { pattern: /\btext-green-\d+\b/, replacement: "text-success" },
  { pattern: /\bbg-gray-\d+\b/, replacement: "bg-muted" },
  { pattern: /\btext-gray-\d+\b/, replacement: "text-muted-foreground" },
  { pattern: /\bbg-slate-\d+\b/, replacement: "bg-muted or bg-card" },
  { pattern: /\btext-slate-\d+\b/, replacement: "text-muted-foreground" },
  { pattern: /\bbg-zinc-\d+\b/, replacement: "bg-muted or bg-card" },
  { pattern: /\btext-zinc-\d+\b/, replacement: "text-muted-foreground" },
];

function getFilesRecursively(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const name = path.join(dir, file);
    if (fs.statSync(name).isDirectory()) {
      if (!name.includes("node_modules") && !name.includes(".next") && !name.includes("__tests__")) {
        getFilesRecursively(name, fileList);
      }
    } else {
      if ((name.endsWith(".tsx") || name.endsWith(".ts")) && !name.includes(".test.") && !name.includes(".spec.")) {
        fileList.push(name);
      }
    }
  }
  return fileList;
}

function runAudit() {
  const targetSubDir = process.argv[2] || "src";
  const srcDir = path.resolve(process.cwd(), targetSubDir);
  if (!fs.existsSync(srcDir)) {
    console.error(`Error: target directory "${targetSubDir}" not found.`);
    process.exit(1);
  }

  const files = getFilesRecursively(srcDir);
  let totalViolations = 0;
  const violationsReport: { file: string; line: number; text: string; matched: string; replacement: string }[] = [];

  for (const file of files) {
    // Skip globals.css or pure styles definitions
    if (file.endsWith("globals.css") || file.includes("design_tokens")) continue;

    const content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n");

    lines.forEach((line, index) => {
      if (line.includes("className=") || line.includes("class=")) {
        for (const item of BANNED_COLOR_PATTERNS) {
          const match = line.match(item.pattern);
          if (match) {
            // Check if it is a legitimate text-white inside unified SMMflux buttons or primary buttons
            const isIntentionalWhiteOnColoredButton = 
              line.includes("bg-gradient-to-r") || 
              line.includes("bg-primary") || 
              line.includes("bg-destructive") ||
              line.includes("bg-green-500") ||
              line.includes("bg-emerald-500");

            if (match[0] === "text-white" && isIntentionalWhiteOnColoredButton) {
              continue; // Allowed on solid primary/gradient buttons
            }

            violationsReport.push({
              file: path.relative(process.cwd(), file),
              line: index + 1,
              text: line.trim(),
              matched: match[0],
              replacement: item.replacement,
            });
            totalViolations++;
          }
        }
      }
    });
  }

  console.log(`\n🔍 [Design System Auditor] Audited ${files.length} UI components.`);

  if (totalViolations > 0) {
    console.log(`\n\x1b[31m=== DESIGN SYSTEM AUDIT: FAILED (${totalViolations} violations) ===\x1b[0m`);
    violationsReport.slice(0, 10).forEach((v) => {
      console.log(`\x1b[33m[Violation]\x1b[0m \x1b[36m${v.file}:${v.line}\x1b[0m -> Found raw class: \x1b[31m"${v.matched}"\x1b[0m`);
      console.log(`   💡 Recommended: "${v.replacement}"`);
      console.log(`   Line: ${v.text}\n`);
    });
    if (violationsReport.length > 10) {
      console.log(`... and ${violationsReport.length - 10} more violations.`);
    }
    console.log("\x1b[35mHow to fix: Replace raw color classes with semantic tokens defined in globals.css.\x1b[0m\n");
    process.exit(1);
  } else {
    console.log("\x1b[32m=== DESIGN SYSTEM AUDIT: PASSED (0 token violations found) ===\x1b[0m\n");
    process.exit(0);
  }
}

runAudit();

