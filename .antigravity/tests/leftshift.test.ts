import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { runAllRulesOnContent } from '../scripts/leftshift/rules/index';

describe('ALSH Left-Shift Rules Two-Sided Test Suite (v1.0)', () => {
  const codes = [
    'SC01_DIRECT_BALANCE_MUTATION',
    'SC02_UNSTABLE_IDEMPOTENCY_KEY',
    'SC03_TENANTLESS_LOOKUP',
    'SC04_WEBHOOK_FAIL_OPEN',
    'SC05_REFUND_OVERCHARGE',
    'SC06_COMMISSION_NO_UNIQUE',
    'SC07_OWNER_FROM_METADATA',
    'SC08_UNSAFE_MUTEX_RELEASE',
    'SC09_FLOAT_MONEY',
    'SC10_CAMPAIGN_OUTSIDE_TX',
    'SC11_MISSING_CURRENCY_CHECK',
    'SC12_LOG_SECRET'
  ];

  for (const code of codes) {
    describe(`Rule ${code}`, () => {
      const posFile = path.resolve(process.cwd(), `.antigravity/evals/leftshift/${code}.positive.ts`);
      const negFile = path.resolve(process.cwd(), `.antigravity/evals/leftshift/${code}.negative.ts`);

      it(`detects anti-pattern in ${code}.positive.ts`, () => {
        expect(fs.existsSync(posFile)).toBe(true);
        const posContent = fs.readFileSync(posFile, 'utf8');
        const findings = runAllRulesOnContent(posContent, posFile);

        const ruleFinding = findings.find(f => f.ruleId === code);
        expect(ruleFinding).toBeDefined();
        expect(ruleFinding?.ruleId).toBe(code);
      });

      it(`does NOT flag safe pattern in ${code}.negative.ts`, () => {
        expect(fs.existsSync(negFile)).toBe(true);
        const negContent = fs.readFileSync(negFile, 'utf8');
        const findings = runAllRulesOnContent(negContent, negFile);

        const ruleFinding = findings.find(f => f.ruleId === code);
        expect(ruleFinding).toBeUndefined();
      });
    });
  }
});
