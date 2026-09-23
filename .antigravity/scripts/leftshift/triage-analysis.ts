import fs from 'fs';
import path from 'path';

interface Finding {
  ruleId: string;
  severity: string;
  file: string;
  line: number;
  snippet: string;
  message: string;
}

const raw = fs.readFileSync(path.join(process.cwd(), '.antigravity/reports/leftshift-baseline-findings.json'), 'utf-8');
const data: { findings: Finding[] } = JSON.parse(raw);

const findings = data.findings;

console.log(`TOTAL FINDINGS: ${findings.length}\n`);

// 1. Severity Breakdown
const bySeverity: Record<string, number> = {};
// 2. Rule Breakdown
const byRule: Record<string, number> = {};
// 3. Location Breakdown
let prodCount = 0;
let testCount = 0;
let devScriptCount = 0;

for (const f of findings) {
  bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
  byRule[f.ruleId] = (byRule[f.ruleId] || 0) + 1;

  const fPath = f.file.replace(/\\/g, '/');
  if (fPath.includes('/__tests__/') || fPath.includes('.test.') || fPath.includes('.spec.')) {
    testCount++;
  } else if (fPath.includes('/scripts/') || fPath.includes('.antigravity/') || fPath.includes('/evals/')) {
    devScriptCount++;
  } else {
    prodCount++;
  }
}

console.log('--- SEVERITY BREAKDOWN ---');
console.dir(bySeverity);

console.log('\n--- RULE BREAKDOWN ---');
console.dir(byRule);

console.log('\n--- LOCATION BREAKDOWN ---');
console.log(`Production Code (src/ non-test): ${prodCount} (${((prodCount / findings.length) * 100).toFixed(1)}%)`);
console.log(`Test Files (__tests__, *.test.ts): ${testCount} (${((testCount / findings.length) * 100).toFixed(1)}%)`);
console.log(`Dev/Scripts/Harness (.antigravity, scripts): ${devScriptCount} (${((devScriptCount / findings.length) * 100).toFixed(1)}%)`);

// Sort rules by count descending
const sortedRules = Object.entries(byRule).sort((a, b) => b[1] - a[1]);
console.log('\n--- TOP NOISY RULES ---');
for (const [ruleId, count] of sortedRules.slice(0, 5)) {
  console.log(`Rule ${ruleId}: ${count} findings`);
  const ruleFindings = findings.filter(f => f.ruleId === ruleId);
  const prodRule = ruleFindings.filter(f => !f.file.includes('__tests__') && !f.file.includes('.test.') && !f.file.includes('/scripts/'));
  const testRule = ruleFindings.filter(f => f.file.includes('__tests__') || f.file.includes('.test.'));
  console.log(`  Prod: ${prodRule.length}, Tests: ${testRule.length}`);
  console.log('  Examples:');
  for (const ex of ruleFindings.slice(0, 5)) {
    console.log(`   - ${ex.file}:${ex.line} -> "${ex.snippet}"`);
  }
  console.log('');
}
