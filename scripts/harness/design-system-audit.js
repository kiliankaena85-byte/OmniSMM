const fs = require("fs");
const path = require("path");

const SCAN_DIRS = ["src/components", "src/app"];

const FORBIDDEN_PATTERNS = [
  { pattern: /\bbg-\[#[0-9a-fA-F]{3,6}\]/g,     label: "Inline hex bg -> use bg-background or bg-card",      severity: "error" },
  { pattern: /\btext-\[#[0-9a-fA-F]{3,6}\]/g,   label: "Inline hex text -> use text-foreground",              severity: "error" },
  { pattern: /\bborder-\[#[0-9a-fA-F]{3,6}\]/g, label: "Inline hex border -> use border-border",              severity: "error" },
  { pattern: /\bbg-white\b/g,                    label: "bg-white -> use bg-card or bg-background",            severity: "error" },
  { pattern: /\bbg-black\b/g,                    label: "bg-black -> use bg-background",                       severity: "error" },
  { pattern: /\btext-white\b/g,                  label: "text-white -> use text-primary-foreground",           severity: "warn"  },
  { pattern: /\btext-black\b/g,                  label: "text-black -> use text-foreground",                   severity: "warn"  },
  { pattern: /\bbg-slate-[1-9]\d*\b/g,           label: "bg-slate-N -> use bg-muted or bg-card",               severity: "error" },
  { pattern: /\btext-slate-[1-9]\d*\b/g,         label: "text-slate-N -> use text-foreground or text-muted-foreground", severity: "error" },
  { pattern: /\bborder-slate-[1-9]\d*\b/g,       label: "border-slate-N -> use border-border",                 severity: "error" },
  { pattern: /\bbg-gray-[1-9]\d*\b/g,            label: "bg-gray-N -> use bg-muted",                           severity: "error" },
  { pattern: /\btext-gray-[1-9]\d*\b/g,          label: "text-gray-N -> use text-muted-foreground",            severity: "error" },
  { pattern: /\bbg-zinc-[1-9]\d*\b/g,            label: "bg-zinc-N -> use bg-muted",                           severity: "error" },
  { pattern: /\btext-zinc-[1-9]\d*\b/g,          label: "text-zinc-N -> use text-muted-foreground",            severity: "error" },
];

const SKIP_PATTERNS = [/node_modules/, /\.test\.(ts|tsx)$/, /__tests__/, /globals\.css/];

function shouldSkip(f) { return SKIP_PATTERNS.some(p => p.test(f)); }

function scanFile(filepath) {
  const violations = [];
  let content;
  try { content = fs.readFileSync(filepath, "utf-8"); } catch { return violations; }
  const lines = content.split("\n");
  for (const { pattern, label, severity } of FORBIDDEN_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const t = line.trim();
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) continue;
      const cloned = new RegExp(pattern.source, pattern.flags);
      let m;
      while ((m = cloned.exec(line)) !== null) {
        violations.push({ file: filepath, line: i+1, match: m[0], label, severity, context: t.substring(0,100) });
      }
    }
  }
  return violations;
}

function walk(dir, results) {
  if (!results) results = [];
  if (!fs.existsSync(dir)) return results;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, results);
    else if (e.isFile() && (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) && !shouldSkip(full)) results.push(full);
  }
  return results;
}

const showHint = process.argv.includes("--fix-hint");
const cwd = process.cwd();
const allFiles = [];
for (const d of SCAN_DIRS) walk(path.join(cwd, d), allFiles);

const allViolations = [];
for (const f of allFiles) {
  const v = scanFile(f);
  for (const x of v) allViolations.push(x);
}

const errors = allViolations.filter(v => v.severity === "error");
const warns  = allViolations.filter(v => v.severity === "warn");

const byFile = new Map();
for (const v of allViolations) {
  const rel = path.relative(cwd, v.file);
  if (!byFile.has(rel)) byFile.set(rel, []);
  byFile.get(rel).push(v);
}
const sorted = [...byFile.entries()].sort((a,b) => b[1].length - a[1].length);

console.log("\n=== SMMplan Design System Audit ===\n");
console.log("Scanned: " + allFiles.length + " files");
console.log("Results: " + errors.length + " errors, " + warns.length + " warnings\n");

if (allViolations.length === 0) {
  console.log("PERFECT - Zero violations found!");
  process.exit(0);
}

for (const [file, violations] of sorted) {
  const ec = violations.filter(v=>v.severity==="error").length;
  const wc = violations.filter(v=>v.severity==="warn").length;
  console.log("FILE: " + file + "  [" + ec + " err, " + wc + " warn]");
  for (const v of violations) {
    console.log("  " + (v.severity==="error"?"ERR":"WRN") + " L" + v.line + ": [" + v.match + "] -> " + v.label);
    if (showHint) console.log("      " + v.context);
  }
  console.log("");
}

console.log("---");
if (errors.length > 0) {
  console.log("FAILED: " + errors.length + " error violations must be fixed");
  process.exit(1);
} else {
  console.log("PASSED WITH WARNINGS: " + warns.length + " warnings to clean up");
  process.exit(0);
}
