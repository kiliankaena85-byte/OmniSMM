/**
 * security-auditor.test.ts
 * Юнит-тесты на модуль PentestSecurityAuditor (@omnismm/agent-task-pipeline).
 */

import { describe, it, expect } from 'vitest';
import { PentestSecurityAuditor } from '../index';

describe('PentestSecurityAuditor (@omnismm/agent-task-pipeline)', () => {
  it('1. Should detect timing attack vulnerability on raw string comparison of secrets', () => {
    const dangerousCode = `
      export function verifyWebhook(req: Request) {
        const receivedSignature = req.headers.get('x-signature');
        const expectedSignature = 'my-secret-key';
        if (receivedSignature === expectedSignature) {
          return true;
        }
        return false;
      }
    `;

    const threats = PentestSecurityAuditor.auditCode('src/api/webhook/route.ts', dangerousCode);
    const timingThreat = threats.find(t => t.category === 'TIMING_ATTACK_CRYPTO');

    expect(timingThreat).toBeDefined();
    expect(timingThreat?.severity).toBe('CRITICAL');
    expect(timingThreat?.mitigationRequirement).toContain('timingSafeEqual');
  });

  it('2. Should detect financial precision leaks in financial modules', () => {
    const dangerousFinanceCode = `
      export function calculateDeposit(amountRub: number) {
        const kopecks = Math.round(amountRub * 100);
        return kopecks;
      }
    `;

    const threats = PentestSecurityAuditor.auditCode('src/services/financial/deposit.ts', dangerousFinanceCode);
    const finThreat = threats.find(t => t.category === 'FINANCIAL_EXACT_MATH');

    expect(finThreat).toBeDefined();
    expect(finThreat?.severity).toBe('CRITICAL');
    expect(finThreat?.mitigationRequirement).toContain('ExactMath');
  });

  it('3. Should detect SSRF risk when using unshielded raw fetch', () => {
    const ssrfCode = `
      export async function checkProvider(url: string) {
        const res = await fetch(url);
        return res.json();
      }
    `;

    const threats = PentestSecurityAuditor.auditCode('src/services/provider/probe.ts', ssrfCode);
    const ssrfThreat = threats.find(t => t.category === 'SSRF_INJECTION');

    expect(ssrfThreat).toBeDefined();
    expect(ssrfThreat?.severity).toBe('HIGH');
    expect(ssrfThreat?.mitigationRequirement).toContain('safeFetch');
  });

  it('4. Should confirm immunity for well-guarded production code', () => {
    const safeCode = `
      import { safeFetch } from '@/lib/security/ssrf-guard';
      import { ExactMath } from '@/lib/financial/exact-math';
      import crypto from 'crypto';

      export function verifySecureWebhook(received: Buffer, expected: Buffer) {
        return crypto.timingSafeEqual(received, expected);
      }
    `;

    const report = PentestSecurityAuditor.generateAuditReport('src/services/financial/safe.ts', safeCode);
    expect(report.isImmune).toBe(true);
    expect(report.threatsIdentified.filter(t => t.severity === 'CRITICAL').length).toBe(0);
  });
});
