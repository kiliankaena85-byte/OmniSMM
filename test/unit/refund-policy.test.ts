/**
 * QA-1: Financial Transaction Engineer
 * Test Suite: RefundPolicyService
 * Standards: ISTQB §4.2.2 (BVA), IEEE 829 §8, ISO 25010 §6.2
 * Coverage Target: 100% line, 100% branch for refund-policy.service.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock WalletService to isolate RefundPolicyService logic
vi.mock('@/services/financial/wallet.service', () => ({
  WalletService: {
    refund: vi.fn().mockResolvedValue({ success: true, balance: 9999, cached: false }),
  },
}));

// Mock db (RefundPolicyService imports it but doesn't use it directly)
vi.mock('@/lib/db', () => ({
  db: {
    ledgerEntry: {
      findFirst: vi.fn().mockResolvedValue(null),
    }
  },
}));

import { RefundPolicyService } from '@/services/financial/refund-policy.service';
import { WalletService } from '@/services/financial/wallet.service';

const mockedRefund = vi.mocked(WalletService.refund);

describe('RefundPolicyService (QA-1: Financial Transaction Engineer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── TC-FIN-001: CANCELED → 100% refund ──
  it('TC-FIN-001: CANCELED order gets 100% full refund', async () => {
    const order = { id: 'ord-1', userId: 'usr-1', charge: 5000, quantity: 1000, remains: 1000, status: 'CANCELED' };
    await RefundPolicyService.processRefund(order);

    expect(mockedRefund).toHaveBeenCalledOnce();
    expect(mockedRefund).toHaveBeenCalledWith(
      'usr-1',
      5000, // Full charge refunded
      expect.stringContaining('Полный возврат (CANCELED)'),
      'refund_ord-1_CANCELED'
    );
  });

  // ── TC-FIN-002: ERROR → 100% refund ──
  it('TC-FIN-002: ERROR order gets 100% full refund', async () => {
    const order = { id: 'ord-2', userId: 'usr-1', charge: 3000, quantity: 500, remains: 500, status: 'ERROR' };
    await RefundPolicyService.processRefund(order);

    expect(mockedRefund).toHaveBeenCalledOnce();
    expect(mockedRefund).toHaveBeenCalledWith(
      'usr-1',
      3000,
      expect.stringContaining('Полный возврат (ERROR)'),
      'refund_ord-2_ERROR'
    );
  });

  // ── TC-FIN-003: PARTIAL proportional refund ──
  it('TC-FIN-003: PARTIAL order gets proportional refund (300/1000 * 5000 = 1500)', async () => {
    const order = { id: 'ord-3', userId: 'usr-1', charge: 5000, quantity: 1000, remains: 300, status: 'PARTIAL' };
    await RefundPolicyService.processRefund(order);

    expect(mockedRefund).toHaveBeenCalledOnce();
    // Math.floor(300/1000 * 5000) = Math.floor(1500) = 1500
    expect(mockedRefund).toHaveBeenCalledWith(
      'usr-1',
      1500,
      expect.stringContaining('Частичный возврат'),
      'refund_ord-3_PARTIAL'
    );
  });

  // ── TC-FIN-004: PARTIAL with remains=0 → refund = 0 ──
  it('TC-FIN-004: PARTIAL with remains=0 produces zero refund (no credit call)', async () => {
    const order = { id: 'ord-4', userId: 'usr-1', charge: 100, quantity: 1, remains: 0, status: 'PARTIAL' };
    const result = await RefundPolicyService.processRefund(order);

    expect(mockedRefund).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  // ── TC-FIN-005: PARTIAL with quantity=0 → no division by zero ──
  it('TC-FIN-005: PARTIAL with quantity=0 does NOT divide by zero', async () => {
    const order = { id: 'ord-5', userId: 'usr-1', charge: 500, quantity: 0, remains: 0, status: 'PARTIAL' };
    const result = await RefundPolicyService.processRefund(order);

    expect(mockedRefund).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  // ── TC-FIN-006: COMPLETED → null (skipped) ──
  it('TC-FIN-006: COMPLETED order is skipped (no refund)', async () => {
    const order = { id: 'ord-6', userId: 'usr-1', charge: 5000, quantity: 1000, remains: 0, status: 'COMPLETED' };
    const result = await RefundPolicyService.processRefund(order);

    expect(mockedRefund).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  // ── TC-FIN-007: PENDING → null (skipped) ──
  it('TC-FIN-007: PENDING order is skipped (no refund)', async () => {
    const order = { id: 'ord-7', userId: 'usr-1', charge: 5000, quantity: 1000, remains: 1000, status: 'PENDING' };
    const result = await RefundPolicyService.processRefund(order);

    expect(mockedRefund).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  // ── TC-FIN-008: Idempotency key uniqueness ──
  it('TC-FIN-008: Idempotency key is deterministic for same order+status', async () => {
    const order = { id: 'ord-8', userId: 'usr-1', charge: 1000, quantity: 100, remains: 100, status: 'CANCELED' };

    await RefundPolicyService.processRefund(order);
    await RefundPolicyService.processRefund(order);

    // Both calls should pass the SAME idempotency key
    expect(mockedRefund).toHaveBeenCalledTimes(2);
    const key1 = mockedRefund.mock.calls[0][3];
    const key2 = mockedRefund.mock.calls[1][3];
    expect(key1).toBe('refund_ord-8_CANCELED');
    expect(key2).toBe('refund_ord-8_CANCELED');
    expect(key1).toBe(key2); // WalletService handles dedup via this key
  });

  // ── TC-FIN-009: Boundary — minimum values (1 cent) ──
  it('TC-FIN-009: Boundary — charge=1, remains=1, qty=1 → refund=1 cent', async () => {
    const order = { id: 'ord-9', userId: 'usr-1', charge: 1, quantity: 1, remains: 1, status: 'PARTIAL' };
    await RefundPolicyService.processRefund(order);

    expect(mockedRefund).toHaveBeenCalledWith('usr-1', 1, expect.any(String), 'refund_ord-9_PARTIAL');
  });

  // ── TC-FIN-010: Safety bound — refund never exceeds charge ──
  it('TC-FIN-010: Safety bound ensures refund <= charge even with bad data', async () => {
    // Scenario: remains > quantity (corrupted data) — refund should be capped at charge
    const order = { id: 'ord-10', userId: 'usr-1', charge: 500, quantity: 100, remains: 200, status: 'PARTIAL' };
    await RefundPolicyService.processRefund(order);

    const refundAmount = mockedRefund.mock.calls[0][1];
    expect(refundAmount).toBeLessThanOrEqual(500); // Math.min(calculated, charge)
  });

  // ── Additional: IN_PROGRESS skipped ──
  it('TC-FIN-EXTRA: IN_PROGRESS order is skipped', async () => {
    const order = { id: 'ord-ex1', userId: 'usr-1', charge: 5000, quantity: 1000, remains: 500, status: 'IN_PROGRESS' };
    const result = await RefundPolicyService.processRefund(order);
    expect(mockedRefund).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  // ── Additional: AWAITING_PAYMENT skipped ──
  it('TC-FIN-EXTRA: AWAITING_PAYMENT order is skipped', async () => {
    const order = { id: 'ord-ex2', userId: 'usr-1', charge: 5000, quantity: 1000, remains: 1000, status: 'AWAITING_PAYMENT' };
    const result = await RefundPolicyService.processRefund(order);
    expect(mockedRefund).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  // ── Reason detail propagation ──
  it('TC-FIN-EXTRA: reasonDetail is appended to refund reason', async () => {
    const order = { id: 'ord-rd', userId: 'usr-1', charge: 1000, quantity: 1, remains: 1, status: 'ERROR' };
    await RefundPolicyService.processRefund(order, '(Provider timeout)');

    expect(mockedRefund).toHaveBeenCalledWith(
      'usr-1',
      1000,
      expect.stringContaining('(Provider timeout)'),
      expect.any(String)
    );
  });

  // ── Math precision: non-round proportional refund ──
  it('TC-FIN-EXTRA: floor() prevents rounding UP (333/1000 * 5000 = 1665, not 1666)', async () => {
    const order = { id: 'ord-math', userId: 'usr-1', charge: 5000, quantity: 1000, remains: 333, status: 'PARTIAL' };
    await RefundPolicyService.processRefund(order);

    // Math.floor(333/1000 * 5000) = Math.floor(1665.0) = 1665
    expect(mockedRefund).toHaveBeenCalledWith('usr-1', 1665, expect.any(String), expect.any(String));
  });
});
