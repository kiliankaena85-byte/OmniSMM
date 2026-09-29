/**
 * verify-decision-coverage.ts
 * CI Gate: Проверка математически доказуемого 100% покрытия решений ActionArbiter
 * перед выкаткой в продакшн платформы OmniSMM 1.0.
 */

import fs from 'fs';
import path from 'path';

const INDEX_FILE = path.join(process.cwd(), '.planning', 'DECISION_COVERAGE_INDEX.json');

export function verifyDecisionCoverage(): boolean {
  if (!fs.existsSync(INDEX_FILE)) {
    console.error(`❌ [DECISION GATE] Index file missing: ${INDEX_FILE}`);
    return false;
  }

  const raw = fs.readFileSync(INDEX_FILE, 'utf-8');
  const index = JSON.parse(raw);

  console.log(`📊 [DECISION GATE] Checking decision coverage index (v${index.version})...`);
  console.log(`   Total Decision Points: ${index.totalDecisionPoints}`);
  console.log(`   Evaluated Decisions:   ${index.evaluatedDecisions}`);
  console.log(`   Coverage Percentage:   ${index.coveragePercentage}%`);

  if (typeof index.coveragePercentage !== 'number' || index.coveragePercentage < 100.0) {
    console.error(`❌ [DECISION GATE FAILED] Incomplete decision coverage: ${index.coveragePercentage}% < 100.0%`);
    return false;
  }

  console.log(`✅ [DECISION GATE PASSED] 100% Decision Coverage Verified! Ready for production deployment.`);
  return true;
}

if (process.argv[1]?.includes('verify-decision-coverage.ts')) {
  const ok = verifyDecisionCoverage();
  process.exit(ok ? 0 : 1);
}
