import { execSync } from 'child_process';
import { categorizeFile, RiskCategory } from './sensitive-paths';

export interface TestGateResult {
  passed: boolean;
  changedFiles: string[];
  requiredCategories: RiskCategory[];
  missingTestCategories: RiskCategory[];
  errors: string[];
  timestamp: string;
}

export function runTestGate(baseCommit?: string): TestGateResult {
  // eslint-disable-next-line no-useless-assignment
  let changedFiles: string[] = [];
  try {
    const gitDiffOutput = baseCommit
      ? execSync(`git diff --name-only ${baseCommit}...HEAD`, { encoding: 'utf8' })
      : execSync('git status --porcelain', { encoding: 'utf8' });

    changedFiles = gitDiffOutput
      .split('\n')
      .map(line => line.trim().replace(/^..\s+/, ''))
      .filter(Boolean);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (err) {
    changedFiles = [];
  }

  const requiredCategories = new Set<RiskCategory>();
  let hasTestAdded = false;

  for (const file of changedFiles) {
    const cats = categorizeFile(file);
    cats.forEach(c => requiredCategories.add(c));

    if (file.includes('test') || file.endsWith('.test.ts') || file.endsWith('.spec.ts')) {
      hasTestAdded = true;
    }
  }

  const missingTestCategories: RiskCategory[] = [];
  const errors: string[] = [];

  if (requiredCategories.size > 0 && !hasTestAdded) {
    for (const cat of Array.from(requiredCategories)) {
      missingTestCategories.push(cat);
      errors.push(`TG01_MISSING_${cat.toUpperCase()}_TEST: Sensitive file modified in category '${cat}' without corresponding test addition.`);
    }
  }

  const passed = errors.length === 0;

  return {
    passed,
    changedFiles,
    requiredCategories: Array.from(requiredCategories),
    missingTestCategories,
    errors,
    timestamp: new Date().toISOString()
  };
}

if (require.main === module) {
  console.log('=== ALSH TEST-FIRST GATE ===');
  const baseCommit = process.argv[2];
  const res = runTestGate(baseCommit);
  console.log(JSON.stringify(res, null, 2));

  if (!res.passed) {
    console.error('\nBLOCKED: Test-first gate failed!');
    process.exit(1);
  }
}
