import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { closePeriod } from '../period-close';
import { dailyReconciliation } from '../reconciliation';
import { recognizeOrderRevenue, reverseOrderRevenue } from '../revenue-recognition';

describe('PREM-10: Immutable Ledger, Period Close & Tax Audit Reconciliation', () => {
  const testMonth = '2026-08';
  const staffId = 'staff_fin_auditor_1';

  beforeEach(async () => {
    await db.reconciliationReport.deleteMany({ where: { status: { in: ['OK', 'MISMATCH'] } } });
    await db.revenueRecognition.deleteMany({});
    await db.ledgerPeriod.deleteMany({ where: { month: testMonth } });
  });

  afterEach(async () => {
    await db.reconciliationReport.deleteMany({ where: { status: { in: ['OK', 'MISMATCH'] } } });
    await db.revenueRecognition.deleteMany({});
    await db.ledgerPeriod.deleteMany({ where: { month: testMonth } });
  });

  describe('Period Close & Immutability', () => {
    it('freezes period and prevents duplicate close', async () => {
      // Mock db transaction for period close
      const res = await closePeriod(testMonth, staffId);
      expect(res.success).toBe(true);

      // Attempt to close again must fail
      const repeatRes = await closePeriod(testMonth, staffId);
      expect(repeatRes.success).toBe(false);
      expect(repeatRes.message).toContain('уже был заморожен');
    });
  });

  describe('Daily Reconciliation', () => {
    it('returns OK status when DB payments and ledger entries match', async () => {
      const today = new Date();

      vi.spyOn(db.payment, 'findMany').mockResolvedValueOnce([
        { amount: BigInt(50000) },
        { amount: BigInt(25000) },
      ] as any);

      vi.spyOn(db.ledgerEntry, 'findMany').mockResolvedValueOnce([
        { amount: BigInt(75000) },
      ] as any);

      const res = await dailyReconciliation(today, BigInt(75000));

      expect(res.status).toBe('OK');
      expect(res.dbTotal).toBe(BigInt(75000));
      expect(res.ledgerTotal).toBe(BigInt(75000));
      expect(res.deltaDbVsLedger).toBe(BigInt(0));
    });

    it('returns MISMATCH when ledger entries diverge from payments', async () => {
      const today = new Date();

      vi.spyOn(db.payment, 'findMany').mockResolvedValueOnce([
        { amount: BigInt(100000) },
      ] as any);

      vi.spyOn(db.ledgerEntry, 'findMany').mockResolvedValueOnce([
        { amount: BigInt(80000) }, // 200 RUB discrepancy
      ] as any);

      const res = await dailyReconciliation(today, BigInt(100000));

      expect(res.status).toBe('MISMATCH');
      expect(res.deltaDbVsLedger).toBe(BigInt(20000));
    });
  });

  describe('Revenue Recognition & Reversal', () => {
    it('recognizes revenue on completion and allows immutable reversal', async () => {
      const orderId = 'order_rev_test_100';

      const recRes = await recognizeOrderRevenue(orderId, BigInt(50000));
      expect(recRes.success).toBe(true);

      const revRes = await reverseOrderRevenue(orderId, 'Client requested refund');
      expect(revRes.success).toBe(true);

      const record = await db.revenueRecognition.findUnique({
        where: { orderId },
      });

      expect(record?.reversed).toBe(true);
      expect(record?.reversalReason).toBe('Client requested refund');
    });
  });
});
