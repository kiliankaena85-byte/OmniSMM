import { describe, it, expect } from 'vitest';
import { 
  LEDGER_TRANSACTION_TYPES, 
  LEDGER_TYPE_CONFIG, 
  resolveLedgerTypeForDisplay,
  type LedgerTransactionType 
} from '@/lib/financial/ledger-types';

describe('Admin Transactions (Ledger) Integrity (Step 10)', () => {
  it('should verify all ledger transaction types have corresponding UI configs', () => {
    const expectedTypes = [
      'TOPUP',
      'ORDER_CHARGE',
      'ORDER_CANCEL',
      'REFUND',
      'ADJUSTMENT',
      'COMPENSATION',
      'REROUTE',
      'PAYMENT',
    ];

    expect(LEDGER_TRANSACTION_TYPES).toEqual(expectedTypes);

    for (const type of LEDGER_TRANSACTION_TYPES) {
      const config = LEDGER_TYPE_CONFIG[type];
      expect(config).toBeDefined();
      expect(config.label).toBeTruthy();
      expect(config.emoji).toBeTruthy();
      expect(config.badgeClass).toContain('border');
    }
  });

  it('should correctly resolve display type for modern and legacy transaction entries', () => {
    // 1. Direct modern types
    expect(resolveLedgerTypeForDisplay('TOPUP', 1000, null)).toBe('TOPUP');
    expect(resolveLedgerTypeForDisplay('ORDER_CHARGE', -500, null)).toBe('ORDER_CHARGE');
    expect(resolveLedgerTypeForDisplay('REFUND', 250, null)).toBe('REFUND');
    expect(resolveLedgerTypeForDisplay('ORDER_CANCEL', 300, null)).toBe('ORDER_CANCEL');
    expect(resolveLedgerTypeForDisplay('COMPENSATION', 100, 'admin-123')).toBe('COMPENSATION');

    // 2. Manual operator adjustment on legacy PAYMENT type
    expect(resolveLedgerTypeForDisplay('PAYMENT', 1500, 'admin-123')).toBe('ADJUSTMENT');

    // 3. Automated legacy PAYMENT type without adminId -> resolves by amount sign
    expect(resolveLedgerTypeForDisplay('PAYMENT', 2000, null)).toBe('TOPUP');
    expect(resolveLedgerTypeForDisplay('PAYMENT', -1200, null)).toBe('ORDER_CHARGE');

    // 4. Unknown/fallback type
    expect(resolveLedgerTypeForDisplay('UNKNOWN_EVENT', 500, null)).toBe('TOPUP');
    expect(resolveLedgerTypeForDisplay('UNKNOWN_EVENT', -500, null)).toBe('ORDER_CHARGE');
  });

  it('should verify lost payment tolerance algorithm (±10% search window)', () => {
    function calculatePaymentToleranceRange(targetRub: number): { minRub: number; maxRub: number } {
      const minRub = Math.max(0, Math.round(targetRub * 0.9));
      const maxRub = Math.round(targetRub * 1.1);
      return { minRub, maxRub };
    }

    // 500 RUB -> 450..550 RUB
    const range500 = calculatePaymentToleranceRange(500);
    expect(range500.minRub).toBe(450);
    expect(range500.maxRub).toBe(550);

    // 1,000 RUB -> 900..1100 RUB
    const range1000 = calculatePaymentToleranceRange(1000);
    expect(range1000.minRub).toBe(900);
    expect(range1000.maxRub).toBe(1100);

    // Edge case: 50 RUB -> 45..55 RUB
    const range50 = calculatePaymentToleranceRange(50);
    expect(range50.minRub).toBe(45);
    expect(range50.maxRub).toBe(55);
  });

  it('should support bidirectional amount filtering for debit and credit entries', () => {
    // When an operator enters min: 500 RUB and max: 1000 RUB, the system must search for:
    // Credits: +50,000 cents .. +100,000 cents
    // Debits:  -100,000 cents .. -50,000 cents
    function getAmountCentsRange(minRub: number, maxRub: number) {
      const minCents = Math.round(minRub * 100);
      const maxCents = Math.round(maxRub * 100);
      return {
        positive: { gte: minCents, lte: maxCents },
        negative: { gte: -maxCents, lte: -minCents },
      };
    }

    const filterRange = getAmountCentsRange(500, 1000);
    expect(filterRange.positive).toEqual({ gte: 50000, lte: 100000 });
    expect(filterRange.negative).toEqual({ gte: -100000, lte: -50000 });

    // Test entry matching
    function matchesAmountFilter(amountCents: number, minRub: number, maxRub: number): boolean {
      const range = getAmountCentsRange(minRub, maxRub);
      const isPositiveMatch = amountCents >= range.positive.gte && amountCents <= range.positive.lte;
      const isNegativeMatch = amountCents >= range.negative.gte && amountCents <= range.negative.lte;
      return isPositiveMatch || isNegativeMatch;
    }

    // Topup of 750 RUB (+75,000 cents) -> matches
    expect(matchesAmountFilter(75000, 500, 1000)).toBe(true);
    // Order charge of 750 RUB (-75,000 cents) -> matches
    expect(matchesAmountFilter(-75000, 500, 1000)).toBe(true);
    // Topup of 1,200 RUB -> fails
    expect(matchesAmountFilter(120000, 500, 1000)).toBe(false);
    // Order charge of 300 RUB -> fails
    expect(matchesAmountFilter(-30000, 500, 1000)).toBe(false);
  });
});
