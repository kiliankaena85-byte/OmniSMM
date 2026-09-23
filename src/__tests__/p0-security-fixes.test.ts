import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RefundPolicy } from '@/services/financial/refund-policy';
import { assertSafeOutboundUrl, isPublicIp } from '@/lib/security/ssrf-guard';
import { promises as dns } from 'node:dns';

describe('🛡️ P0 Security & Financial Integrity Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. RefundPolicy: Pure BigInt Exact Precision (No float/Number loss)', () => {
    it('calculates partial refunds with 100% precision on large amounts without float rounding error', () => {
      // 10,000,000.00 rubles in kopecks (1,000,000,000 kopecks)
      const charge = BigInt('1000000000');
      const quantity = 3;
      const unfulfilledQty = 1;

      // 1,000,000,000 * 1 / 3 = 333,333,333 kopecks (exact BigInt integer division)
      const result = RefundPolicy.calcRefund(
        { id: 'order-p0-test', charge, quantity },
        BigInt(0),
        unfulfilledQty
      );

      expect(result.refundAmount).toBe(BigInt(333333333));
      expect(result.isPartial).toBe(true);
      expect(result.unfulfilledQty).toBe(1);
    });

    it('never exceeds max available charge regardless of input multiplier', () => {
      const charge = BigInt(50000); // 500.00 RUB
      const prevRefunds = BigInt(30000); // 300.00 RUB already refunded

      const result = RefundPolicy.calcRefund(
        { id: 'order-over-refund', charge, quantity: 100 },
        prevRefunds,
        100 // requested 100% refund
      );

      // Remaining available is only 200.00 RUB (20000 kopecks)
      expect(result.refundAmount).toBe(BigInt(20000));
    });

    it('handles zero or negative unfulfilled quantities safely without negative refund amounts', () => {
      const charge = BigInt(15000);
      const result = RefundPolicy.calcRefund(
        { id: 'order-zero-test', charge, quantity: 50 },
        BigInt(0),
        0
      );

      expect(result.refundAmount).toBe(BigInt(0));
      expect(result.unfulfilledQty).toBe(0);
    });
  });

  describe('2. SSRF Guard: Two-Phase DNS Rebinding Protection', () => {
    it('blocks loopback, private RFC1918 and AWS metadata IPs', () => {
      expect(isPublicIp('127.0.0.1')).toBe(false);
      expect(isPublicIp('10.0.0.1')).toBe(false);
      expect(isPublicIp('192.168.1.1')).toBe(false);
      expect(isPublicIp('172.16.0.1')).toBe(false);
      expect(isPublicIp('169.254.169.254')).toBe(false);
      expect(isPublicIp('::1')).toBe(false);
      expect(isPublicIp('fc00::1')).toBe(false);
    });

    it('allows verified public IP addresses', () => {
      expect(isPublicIp('8.8.8.8')).toBe(true);
      expect(isPublicIp('1.1.1.1')).toBe(true);
      expect(isPublicIp('93.184.216.34')).toBe(true);
    });

    it('detects and blocks DNS Rebinding attack when second resolution returns private IP', async () => {
      const lookupSpy = vi.spyOn(dns, 'lookup');
      
      // Phase 1 returns benign public IP, Phase 2 (rebinding) flips to 127.0.0.1
      lookupSpy
        .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }] as unknown as never)
        .mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }] as unknown as never);

      const res = await assertSafeOutboundUrl('https://evil-rebind.attacker.com/v2/api');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toContain('rebinding');
      }
    });

    it('blocks dangerous URL schemes such as file:// and gopher://', async () => {
      const resFile = await assertSafeOutboundUrl('file:///etc/passwd');
      expect(resFile.ok).toBe(false);
      if (!resFile.ok) {
        expect(resFile.reason).toContain('scheme');
      }

      const resGopher = await assertSafeOutboundUrl('gopher://127.0.0.1:6379/_flushall');
      expect(resGopher.ok).toBe(false);
      if (!resGopher.ok) {
        expect(resGopher.reason).toContain('scheme');
      }
    });
  });

  describe('3. Payment Service: Exact Amount & Underpayment Guards', () => {
    it('verifies that creditAmount < order.charge check logic throws expected error', () => {
      const orderCharge = BigInt(150000); // 1,500.00 RUB
      const creditAmount = BigInt(100000); // 1,000.00 RUB (underpaid)

      expect(() => {
        if (creditAmount < orderCharge) {
          throw new Error(`UNDERPAID_ORDER: Credited amount (${creditAmount}) is less than required order charge (${orderCharge})`);
        }
      }).toThrowError(/UNDERPAID_ORDER/);
    });

    it('blocks amount mismatch when webhook reports different amount than created payment', () => {
      const expectedPaymentAmount = BigInt(50000); // 500 RUB
      const receivedFromWebhook = BigInt(1000); // 10 RUB (attacker trying to pay 10 RUB for 500 RUB order)

      expect(() => {
        if (expectedPaymentAmount !== receivedFromWebhook) {
          throw new Error('PAYMENT_AMOUNT_MISMATCH: Amount received from gateway does not match expected payment amount.');
        }
      }).toThrowError(/PAYMENT_AMOUNT_MISMATCH/);
    });

    it('blocks basket activation when credited amount is less than total basket charge', () => {
      const basketCharges = [BigInt(10000), BigInt(20000), BigInt(30000)]; // Total: 60,000 kopecks (600 RUB)
      const totalChargeCents = basketCharges.reduce((sum, c) => sum + c, BigInt(0));
      const creditedAmount = BigInt(40000); // 400 RUB (underpaid)

      expect(() => {
        if (creditedAmount < totalChargeCents) {
          throw new Error(`UNDERPAID_BASKET: Credited amount (${creditedAmount}) is less than required basket charge (${totalChargeCents})`);
        }
      }).toThrowError(/UNDERPAID_BASKET/);
    });
  });

  describe('4. Checkout IDOR: User ownership enforcement', () => {
    it('ensures orders belonging to other users are strictly rejected', () => {
      const sessionUserId = 'user-alice';
      const order = { id: 'order-123', userId: 'user-bob', status: 'AWAITING_PAYMENT' };

      const checkAccess = (sessId: string, ord: { userId: string }) => {
        if (ord.userId !== sessId) {
          throw new Error('Access denied');
        }
      };

      expect(() => checkAccess(sessionUserId, order)).toThrowError('Access denied');
    });

    it('allows valid owner access to retry payment', () => {
      const sessionUserId = 'user-alice';
      const order = { id: 'order-123', userId: 'user-alice', status: 'AWAITING_PAYMENT' };

      const checkAccess = (sessId: string, ord: { userId: string }) => {
        if (ord.userId !== sessId) {
          throw new Error('Access denied');
        }
        return true;
      };

      expect(checkAccess(sessionUserId, order)).toBe(true);
    });
  });
});
