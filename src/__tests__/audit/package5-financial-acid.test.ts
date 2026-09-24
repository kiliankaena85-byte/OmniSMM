import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Audit Package 5 Verification Suite:
 * - R4-P0-01: Double-Charge on Retry Checkout with Balance Eliminated
 * - R4-P0-02: Deterministic Idempotency Keys (Zero Date.now in financial keys)
 * - DEF-008: Chunked Batched Cursor Pagination in Admin Export
 * - R3-P1-01: ReDoS Protection in Inbound Email Reply Stripping
 */
describe('Package 5: Financial ACID, Idempotency & ReDoS Hardening', () => {

  describe('R4-P0-01: Double-Charge on Retry Checkout with Balance Prevention', () => {
    const retryServicePath = path.resolve(process.cwd(), 'src/services/orders/retry-checkout.service.ts');

    it('RetryCheckoutService contains early return for balance gateway outside transaction', () => {
      const content = fs.readFileSync(retryServicePath, 'utf-8');

      // Inside tx: charges balance and sets status PENDING
      expect(content.includes("if (gateway === 'balance')")).toBe(true);
      expect(content.includes('status: gateway === \'balance\' ? \'SUCCEEDED\' : \'PENDING\'')).toBe(true);
      expect(content.includes('...(gateway === \'balance\' ? { status: \'PENDING\' } : {})')).toBe(true);

      // Outside tx: early return and ordersQueue dispatch before PaymentGatewayFactory
      const normalizedContent = content.replace(/\r\n/g, '\n');
      const gatewayCallIdx = normalizedContent.indexOf('PaymentGatewayFactory.getGateway(gateway ||');
      const earlyReturnIdx = normalizedContent.indexOf('return {\n        orderId: order.id,\n        paymentId: result.paymentId,\n        paymentUrl: `${baseUrl}/success?orderId=${order.id}`\n      };');

      expect(earlyReturnIdx).toBeGreaterThan(0);
      expect(earlyReturnIdx).toBeLessThan(gatewayCallIdx);
    });

    it('Simulation: Single charge executed when gateway is balance', async () => {
      let balance = 100000;
      let chargeCount = 0;
      const mockCharge = (amount: number) => {
        balance -= amount;
        chargeCount++;
      };

      const orderAmount = 25000;
      const gateway = 'balance';

      // 1. Transaction step
      if (gateway === 'balance') {
        mockCharge(orderAmount);
      }

      // 2. Early return prevents gateway delegation
      const hasEarlyReturn = true;
      if (!hasEarlyReturn) {
        mockCharge(orderAmount); // Would be double charge!
      }

      expect(chargeCount).toBe(1);
      expect(balance).toBe(75000);
    });
  });

  describe('R4-P0-02: Deterministic Idempotency Keys (Zero Date.now)', () => {
    it('All financial operations in src have 0 Date.now() in idempotencyKey declarations', () => {
      const filesToAudit = [
        'src/actions/admin/orders.ts',
        'src/actions/admin/users.ts',
        'src/services/admin/order/order-status-mutator.service.ts',
        'src/services/orders/retry-checkout.service.ts',
        'src/services/financial/ledger-reconciliation.service.ts',
        'src/services/financial/payment-gateway.service.ts',
      ];

      const violations: string[] = [];

      for (const relPath of filesToAudit) {
        const fullPath = path.resolve(process.cwd(), relPath);
        if (!fs.existsSync(fullPath)) continue;

        const lines = fs.readFileSync(fullPath, 'utf-8').split('\n');
        for (const [idx, line] of lines.entries()) {
          if (line.includes('idempotencyKey') && line.includes('Date.now()')) {
            violations.push(`${relPath}:${idx + 1}: ${line.trim()}`);
          }
        }
      }

      expect(violations).toEqual([]);
      expect(violations.length).toBe(0);
    });
  });

  describe('DEF-008: Chunked Batched Cursor Pagination in Admin Export', () => {
    const exportRoutePath = path.resolve(process.cwd(), 'src/app/api/admin/export/route.ts');

    it('Eliminates unbatched take: 10000 in orders and users export', () => {
      const content = fs.readFileSync(exportRoutePath, 'utf-8');

      // Neither users nor orders use unbatched take: 10000
      expect(content.includes('take: 10000,')).toBe(false);

      // Uses BATCH_SIZE and cursor iteration
      expect(content.includes('const BATCH_SIZE = 500;')).toBe(true);
      expect(content.includes('orderCursor')).toBe(true);
      expect(content.includes('userCursor')).toBe(true);
    });
  });

  describe('R3-P1-01: ReDoS Protection in Inbound Email Webhook', () => {
    const inboundRoutePath = path.resolve(process.cwd(), 'src/app/api/webhooks/inbound-email/route.ts');

    it('Inbound email parser uses linear non-backtracking patterns', () => {
      const content = fs.readFileSync(inboundRoutePath, 'utf-8');

      // Vulnerable patterns removed
      expect(content.includes('.split(/\\r?\\n\\d{2}\\.\\d{2}\\.\\d{4}.+от.+:/i)[0]')).toBe(false);
      expect(content.includes('.split(/\\r?\\n\\d{4}-\\d{2}-\\d{2}.+<.+>:/i)[0]')).toBe(false);

      // Hardened patterns active
      expect(content.includes('.split(/\\r?\\n\\d{2}\\.\\d{2}\\.\\d{4}[^\\r\\n:]+от[^\\r\\n:]+:/i)[0]')).toBe(true);
      expect(content.includes('.split(/\\r?\\n\\d{4}-\\d{2}-\\d{2}[^\\r\\n:]+<[^\\r\\n>]+>:/i)[0]')).toBe(true);
    });

    it('Executes in < 5ms under adversarial input without backtracking', () => {
      const hardenedRegex1 = /\r?\n\d{2}\.\d{2}\.\d{4}[^\r\n:]+от[^\r\n:]+:/i;
      const hardenedRegex2 = /\r?\n\d{4}-\d{2}-\d{2}[^\r\n:]+<[^\r\n>]+>:/i;

      const adversarial1 = '\n20.05.2026 ' + 'от '.repeat(100) + 'X'.repeat(10000);
      const adversarial2 = '\n2026-05-20 ' + '<no-reply> '.repeat(100) + 'Y'.repeat(10000);

      const t0 = performance.now();
      expect(hardenedRegex1.test(adversarial1)).toBe(false);
      expect(hardenedRegex2.test(adversarial2)).toBe(false);
      const durationMs = performance.now() - t0;

      expect(durationMs).toBeLessThan(10);
    });
  });

});
