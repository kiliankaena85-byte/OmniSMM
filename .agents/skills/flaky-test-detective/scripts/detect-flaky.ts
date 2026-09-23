import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

function getArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  const argv = process.argv;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--') && argv[i + 1]) {
      const key = argv[i].slice(2);
      args[key] = argv[i + 1];
      i++;
    }
  }
  return args;
}

function runTestOnce(testPath: string): boolean {
  try {
    // Run vitest in non-watch single-run mode for the specific test path
    execSync(`npx vitest run ${testPath}`, { stdio: 'ignore', encoding: 'utf-8' });
    return true;
  } catch (err) {
    return false;
  }
}

function main() {
  console.log('🧪 Flaky Test Detective: Investigating test suite stability...');
  const args = getArgs();
  const testPath = args.test;
  const runsCount = parseInt(args.runs || '10', 10);

  if (!testPath) {
    console.error('❌ Error: Missing required argument --test <test-file-path>');
    console.log('Usage: npx tsx detect-flaky.ts --test <test-file-path> [--runs 10]');
    process.exit(1);
  }

  const resolvedTestPath = path.resolve(process.cwd(), testPath);
  if (!fs.existsSync(resolvedTestPath)) {
    console.error(`❌ Error: Test file not found at ${resolvedTestPath}`);
    process.exit(1);
  }

  console.log(`🔎 Target test suite: ${testPath}`);
  console.log(`🔄 Performing ${runsCount} consecutive iterations...`);
  console.log('----------------------------------------------------');

  let passed = 0;
  let failed = 0;
  const results: boolean[] = [];

  for (let i = 1; i <= runsCount; i++) {
    process.stdout.write(`  Iteration ${i}/${runsCount}... `);
    const success = runTestOnce(testPath);
    results.push(success);
    if (success) {
      passed++;
      console.log('✅ PASSED');
    } else {
      failed++;
      console.log('❌ FAILED');
    }
  }

  const passRate = (passed / runsCount) * 100;
  
  console.log('----------------------------------------------------');
  console.log('📊 Investigation Results Summary:');
  console.log(`  Total Iterations: ${runsCount}`);
  console.log(`  Passed:           ${passed}`);
  console.log(`  Failed:           ${failed}`);
  console.log(`  Stability Rate:   ${passRate.toFixed(1)}%`);

  if (passRate === 100) {
    console.log('\n🟢 Verdict: PERFECTLY STABLE. Test suite is robust!');
    process.exit(0);
  } else if (passRate === 0) {
    console.error('\n🔴 Verdict: CONSISTENTLY FAILING. This is a deterministic bug, not flakiness.');
    process.exit(1);
  } else {
    console.warn(`\n⚠️  Verdict: FLAKY TEST DETECTED! Stability rate is ${passRate.toFixed(1)}%.`);
    console.warn('  This indicates potential state leakage, database locks, or time-sensitive race conditions.');
    console.warn('  Consider isolating DB state with transaction rollbacks or CUID identifiers.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
