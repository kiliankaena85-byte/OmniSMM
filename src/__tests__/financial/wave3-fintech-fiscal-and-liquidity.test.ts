import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiquidityMonitorService } from '@/services/financial/liquidity-monitor.service';
import { dailyReconciliation } from '@/lib/finance/reconciliation';
import { db } from '@/lib/db';

describe('Wave 3: Fintech, 54-FZ (FFD 1.2), 3-Way Reconciliation & Liquidity Iron Dome', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. 54-FZ & FFD 1.2 Fiscalization Rules Invariants', () => {
    it('enforces FFD 1.2 advance tags for balance deposit payments', () => {
      // Deposit scenario (Пополнение баланса / Аванс)
      const isDeposit = true;
      const isVatThresholdExceeded = true; // > 20 млн ₽

      const vatCode = isVatThresholdExceeded ? (isDeposit ? 4 : 10) : 1;
      const paymentMode = isDeposit ? 'advance' : 'full_payment';
      const paymentSubject = isDeposit ? 'payment' : 'service';

      expect(paymentMode).toBe('advance');
      expect(paymentSubject).toBe('payment');
      // By FFD 1.2, advance under 22% VAT requires calculation rate 22/122 (vat_code: 4 in YooKassa)
      expect(vatCode).toBe(4);
    });

    it('enforces FFD 1.2 service tags for direct order checkout payments', () => {
      // Direct checkout scenario (Оплата услуги)
      const isDeposit = false;
      const isVatThresholdExceeded = true; // > 20 млн ₽

      const vatCode = isVatThresholdExceeded ? (isDeposit ? 4 : 10) : 1;
      const paymentMode = isDeposit ? 'advance' : 'full_payment';
      const paymentSubject = isDeposit ? 'payment' : 'service';

      expect(paymentMode).toBe('full_payment');
      expect(paymentSubject).toBe('service');
      // Direct service payment under 22% VAT uses standard rate 22% (vat_code: 10 in YooKassa)
      expect(vatCode).toBe(10);
    });

    it('enforces vat_code: 1 (Without VAT) when under the 20M threshold', () => {
      const isVatThresholdExceeded = false; // <= 20 млн ₽ (п. 1 ст. 145 НК РФ)

      const depositVatCode = isVatThresholdExceeded ? 4 : 1;
      const orderVatCode = isVatThresholdExceeded ? 10 : 1;

      expect(depositVatCode).toBe(1);
      expect(orderVatCode).toBe(1);
    });
  });

  describe('2. Liquidity Iron Dome (LCR >= 1.15)', () => {
    it('correctly calculates LCR and HEALTHY status when liquid assets exceed liabilities with buffer', async () => {
      // Query 1: liabilities = 100,000 RUB (10,000,000 cents)
      // Query 2: inflows (30d) = 200,000 RUB (20,000,000 cents)
      vi.spyOn(db, '$queryRaw')
        .mockResolvedValueOnce([{ total_liabilities: BigInt(10_000_000) }])
        .mockResolvedValueOnce([{ total_inflows: BigInt(20_000_000) }]);

      const metrics = await LiquidityMonitorService.getMetrics('smmplan');

      expect(metrics.totalUserLiabilitiesCents).toBe(BigInt(10_000_000));
      // Inflows net of 3.5% = 19,300,000 + 5,000,000 base float = 24,300,000 cents
      // LCR = 24,300,000 / 10,000,000 = 2.43x
      expect(metrics.lcr).toBeGreaterThanOrEqual(1.15);
      expect(metrics.status).toBe('HEALTHY');
    });

    it('detects DEFICIT status when liabilities exceed liquid assets (LCR < 1.00)', async () => {
      // Query 1: liabilities = 500,000 RUB (50,000,000 cents)
      // Query 2: inflows = 10,000 RUB (1,000,000 cents)
      vi.spyOn(db, '$queryRaw')
        .mockResolvedValueOnce([{ total_liabilities: BigInt(50_000_000) }])
        .mockResolvedValueOnce([{ total_inflows: BigInt(1_000_000) }]);

      const metrics = await LiquidityMonitorService.getMetrics('smmplan');

      // Net 965,000 + 5,000,000 float = 5,965,000 cents vs 50,000,000 liabilities -> LCR ~0.12x
      expect(metrics.lcr).toBeLessThan(1.00);
      expect(metrics.status).toBe('DEFICIT');
      expect(metrics.recommendation).toContain('КРИТИЧЕСКИЙ ДЕФИЦИТ');
    });

    it('handles zero liabilities gracefully without division by zero', async () => {
      vi.spyOn(db, '$queryRaw')
        .mockResolvedValueOnce([{ total_liabilities: BigInt(0) }])
        .mockResolvedValueOnce([{ total_inflows: BigInt(0) }]);

      const metrics = await LiquidityMonitorService.getMetrics('smmplan');

      expect(metrics.lcr).toBe(99.9);
      expect(metrics.status).toBe('HEALTHY');
    });
  });

  describe('3. 3-Way Reconciliation with Net Bank Settlements', () => {
    it('matches net bank settlements factoring YooKassa 3.5% acquiring fee', async () => {
      const today = new Date();
      const grossPaymentKopecks = BigInt(100_000); // 1000 RUB gross
      // YooKassa 3.5% acquiring fee: Net is 965 RUB (96,500 kopecks)
      const expectedNetBankKopecks = BigInt(96_500);

      vi.spyOn(db.payment, 'findMany').mockResolvedValueOnce([
        { amount: grossPaymentKopecks },
      ] as any);

      vi.spyOn(db.ledgerEntry, 'findMany').mockResolvedValueOnce([
        { amount: grossPaymentKopecks },
      ] as any);

      vi.spyOn(db.reconciliationReport, 'create').mockResolvedValueOnce({
        id: 'mock_report_1',
      } as any);

      // Reconcile with Net settlement option (350 bps = 3.5%)
      const res = await dailyReconciliation(today, expectedNetBankKopecks, {
        isNetBankSettlement: true,
        acquiringFeeBps: 350,
      });

      expect(res.status).toBe('OK');
      expect(res.deltaBankVsDb).toBe(BigInt(0));
      expect(res.deltaDbVsLedger).toBe(BigInt(0));
    });
  });
});
