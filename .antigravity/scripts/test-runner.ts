import { execSync } from 'child_process';

export interface TestRunnerResult {
  passed: number;
  failed: number;
  testFiles: string[];
  output: string;
  timestamp: string;
}

export function runTests(testPath?: string): TestRunnerResult {
  const target = testPath || 'test/integration/smart-drip.test.ts';
  // eslint-disable-next-line no-useless-assignment
  let rawOutput = '';
  let failed = 0;
  let passed = 0;

  try {
    rawOutput = execSync(`npx vitest run ${target}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    rawOutput = (err.stdout || '') + '\n' + (err.stderr || '');
  }

  // Parse Vitest summary numbers
  const passedMatch = rawOutput.match(/Tests\s+.*(\d+)\s+passed/);
  const failedMatch = rawOutput.match(/Tests\s+.*(\d+)\s+failed/);

  if (passedMatch) passed = parseInt(passedMatch[1], 10);
  if (failedMatch) failed = parseInt(failedMatch[1], 10);

  // Fallback heuristic if not parsed directly
  if (rawOutput.includes('✓') && passed === 0) {
    const checks = (rawOutput.match(/✓/g) || []).length;
    passed = checks;
  }
  if (rawOutput.includes('×') && failed === 0) {
    const crosses = (rawOutput.match(/×/g) || []).length;
    failed = crosses;
  }

  const result: TestRunnerResult = {
    passed,
    failed,
    testFiles: [target],
    output: rawOutput.slice(0, 1000), // First 1000 chars snippet
    timestamp: new Date().toISOString()
  };

  return result;
}

if (require.main === module) {
  const target = process.argv[2];
  const result = runTests(target);
  console.log('=== AEARH TEST RUNNER REPORT ===');
  console.log(JSON.stringify(result, null, 2));

  if (result.failed > 0) {
    process.exit(1);
  }
}
