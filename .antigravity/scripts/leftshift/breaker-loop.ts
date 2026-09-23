import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export interface BreakerAttempt {
  vector: string;
  command: string;
  result: 'blocked' | 'exploited';
  evidence: string;
  durationMs: number;
}

export interface BreakerReport {
  attempts: BreakerAttempt[];
  exploits_found: number;
  iterationsRun: number;
  passed: boolean;
  timestamp: string;
  executionMode: 'REAL_EXECUTABLE_ATTACK_RUNNER';
}

export function runBreakerLoop(): BreakerReport {
  const attackVectors = [
    {
      vector: 'static-vulnerability-injection-attacks (SC01-SC12)',
      command: 'npx vitest run .antigravity/tests/leftshift.test.ts',
      description: 'Executes 24-test two-sided static vulnerability injection attack suite.'
    },
    {
      vector: 'financial-reconciliation-and-overrefund-attacks',
      command: 'npx vitest run .antigravity/tests/reconciliation.test.ts',
      description: 'Executes 8-test DB reconciliation attack suite (ledger mismatch, over-refund, duplicate idempotency).'
    },
    {
      vector: 'smart-drip-race-condition-attacks',
      command: 'npx vitest run test/integration/smart-drip.test.ts',
      description: 'Executes integration attack test verifying parallel task claim locks and campaign transaction isolation.'
    }
  ];

  const attempts: BreakerAttempt[] = [];

  for (const vec of attackVectors) {
    const start = Date.now();
    // eslint-disable-next-line no-useless-assignment
    let result: 'blocked' | 'exploited' = 'blocked';
    // eslint-disable-next-line no-useless-assignment
    let evidence = '';

    try {
      const output = execSync(vec.command, {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'test' }
      });
      result = 'blocked'; // Attack was successfully blocked/caught by test assertions!
      const lines = output.split('\n');
      const passLine = lines.find(l => l.includes('passed') || l.includes('Test Files')) || lines.slice(-5).join(' ');
      evidence = `Command executed cleanly. Summary: ${passLine.trim()}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      result = 'exploited'; // Test suite failed -> attack succeeded in exploiting system!
      evidence = `Attack test failed with exit code ${err.status}: ${err.stderr || err.stdout || err.message}`;
    }

    attempts.push({
      vector: vec.vector,
      command: vec.command,
      result,
      evidence: evidence.slice(0, 300),
      durationMs: Date.now() - start
    });
  }

  const exploits_found = attempts.filter(a => a.result === 'exploited').length;
  const report: BreakerReport = {
    attempts,
    exploits_found,
    iterationsRun: attackVectors.length,
    passed: exploits_found === 0,
    timestamp: new Date().toISOString(),
    executionMode: 'REAL_EXECUTABLE_ATTACK_RUNNER'
  };

  const outDir = path.resolve(process.cwd(), '.antigravity/reports');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'breaker-report.json'), JSON.stringify(report, null, 2));

  return report;
}

if (require.main === module) {
  console.log('=== ALSH REAL EXECUTABLE BREAKER AGENT RUNNER ===');
  const res = runBreakerLoop();
  console.log(JSON.stringify(res, null, 2));
  if (!res.passed) {
    process.exit(1);
  }
}
