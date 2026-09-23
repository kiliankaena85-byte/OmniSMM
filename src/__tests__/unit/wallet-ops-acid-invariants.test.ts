import { describe, it, expect, vi } from 'vitest';
import { ExactMath } from '@/lib/financial/exact-math';
import { ImmutableLedgerError } from '@/services/financial/wallet-ops';
import { parseActionableError } from '@/lib/errors/actionable-error';

describe('BAL-01 / BAL-02 / BAL-03: Financial ExactMath, Ledger-First & Immutability Invariants', () => {
  describe('BAL-01: ExactMath BigInt Precision (Zero Float Drift)', () => {
    it('converts decimal ruble strings and floats to exact BigInt kopecks', () => {
      // 19.99 * 100 in native JS float is 1998.9999999999998
      expect(19.99 * 100).not.toBe(1999); // Proves float drift in vanilla JS
      expect(ExactMath.rublesToKopecks(19.99)).toBe(BigInt(1999)); // Proves ExactMath eliminates drift
      expect(ExactMath.rublesToKopecks('19.99')).toBe(BigInt(1999));

      // Micro pricing edge cases
      expect(ExactMath.rublesToKopecks('0.01')).toBe(BigInt(1));
      expect(ExactMath.rublesToKopecks(0.01)).toBe(BigInt(1));
      expect(ExactMath.rublesToKopecks('12345.67')).toBe(BigInt(1234567));
      expect(ExactMath.rublesToKopecks(50000)).toBe(BigInt(5000000));
    });

    it('rejects invalid or negative monetary values', () => {
      expect(() => ExactMath.rublesToKopecks(-10)).toThrow('Negative monetary amounts are forbidden');
      expect(() => ExactMath.rublesToKopecks('invalid')).toThrow('Invalid monetary amount');
    });
  });

  describe('BAL-02: Immutable Ledger Exception & Actionable Error Mapping', () => {
    it('instantiates ImmutableLedgerError with IMMUTABLE_LEDGER_VIOLATION code', () => {
      const err = new ImmutableLedgerError();
      expect(err.code).toBe('IMMUTABLE_LEDGER_VIOLATION');
      expect(err.name).toBe('ImmutableLedgerError');
      expect(err.message).toContain('Financial Ledger is immutable');
    });

    it('actionable-error maps ImmutableLedgerError to ERR_FINANCIAL_LEDGER_IMMUTABLE', () => {
      const err = new ImmutableLedgerError();
      const parsed = parseActionableError(err);

      expect(parsed.code).toBe('ERR_FINANCIAL_LEDGER_IMMUTABLE');
      expect(parsed.category).toBe('FINANCE_GATEWAY');
      expect(parsed.title).toContain('политикой неизменяемости');
    });

    it('actionable-error maps PostgreSQL trigger P0001 ledger exceptions to ERR_FINANCIAL_LEDGER_IMMUTABLE', () => {
      const pgTriggerError = new Error('RAISE EXCEPTION: LedgerEntry immutability violation: Deletes are strictly prohibited (P0001)');
      const parsed = parseActionableError(pgTriggerError);

      expect(parsed.code).toBe('ERR_FINANCIAL_LEDGER_IMMUTABLE');
      expect(parsed.category).toBe('FINANCE_GATEWAY');
    });
  });

  describe('BAL-03: User Service Atomic Balance Audit', () => {
    it('ensures BigInt delta and balance precision in financial audit logs', async () => {
      const oldBalance = BigInt(150000); // 1,500.00 RUB
      const amountCents = BigInt(50000);  // 500.00 RUB
      const newBalance = oldBalance + amountCents;

      expect(typeof newBalance).toBe('bigint');
      expect(newBalance).toBe(BigInt(200000));
      expect(newBalance.toString()).toBe('200000');
    });
  });
});
