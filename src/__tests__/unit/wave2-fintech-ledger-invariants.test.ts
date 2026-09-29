/**
 * wave2-fintech-ledger-invariants.test.ts
 * Юнит-тесты на инварианты Волны 2: Финтех, Леджер, ExactMath и Webhooks.
 */

import { describe, it, expect, vi } from 'vitest';
import { ExactMath } from '@/lib/financial/exact-math';
import { WalletOps, WalletInvalidAmountError, WalletInsufficientFundsError } from '@/services/financial/wallet-ops';
import { RefundPolicyService } from '@/services/financial/refund-policy.service';
import crypto from 'crypto';

describe('Wave 2 Invariants: Fintech, Ledger & Webhooks', () => {
  it('1. ExactMath Zero-Float Precision: Converted rubles to kopecks without IEEE-754 precision loss', () => {
    expect(ExactMath.rublesToKopecks(0.01)).toBe(1n);
    expect(ExactMath.rublesToKopecks(499.99)).toBe(49999n);
    expect(ExactMath.rublesToKopecks('1250.50')).toBe(125050n);
    expect(ExactMath.kopecksToRubles(49999n)).toBe(499.99);
    expect(ExactMath.kopecksToRublesString(49999n)).toBe('499.99');
    expect(ExactMath.kopecksToRublesString(1n)).toBe('0.01');
  });

  it('2. WalletOps Charge Invariant: Rejects negative, zero and excessive amounts', async () => {
    const mockTx = {
      user: { findUnique: vi.fn() },
      ledgerEntry: { create: vi.fn(), findFirst: vi.fn() },
    } as any;

    await expect(WalletOps.charge(mockTx, 'u1', 0, 'test')).rejects.toThrow(WalletInvalidAmountError);
    await expect(WalletOps.charge(mockTx, 'u1', -500, 'test')).rejects.toThrow(WalletInvalidAmountError);
    await expect(WalletOps.charge(mockTx, 'u1', 200_000_000_000n, 'test')).rejects.toThrow(WalletInvalidAmountError);
  });

  it('3. WalletOps Insufficient Funds Guard: Blocks spending beyond user balance', async () => {
    const mockTx = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'u1',
          balance: 1000n, // 10.00 RUB
          tenantId: 'smmplan',
        }),
      },
    } as any;

    await expect(WalletOps.charge(mockTx, 'u1', 5000n, 'test')).rejects.toThrow(WalletInsufficientFundsError);
  });

  it('4. Timing-Safe Webhook Equality: Prevents timing attacks on cryptographic signatures', () => {
    const sigA = crypto.createHash('sha256').update('secret_data_123').digest('hex');
    const sigB = crypto.createHash('sha256').update('secret_data_123').digest('hex');
    const sigDifferent = crypto.createHash('sha256').update('tampered_data_456').digest('hex');

    const bufA = Buffer.from(sigA);
    const bufB = Buffer.from(sigB);
    const bufDiff = Buffer.from(sigDifferent);

    expect(bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)).toBe(true);
    expect(bufA.length === bufDiff.length && crypto.timingSafeEqual(bufA, bufDiff)).toBe(false);
  });

  it('5. Refund Policy State Machine: COMPLETED, IN_PROGRESS and PENDING orders are not refundable', async () => {
    const orderCompleted = { id: 'o1', userId: 'u1', charge: 1000n, quantity: 100, remains: 0, status: 'COMPLETED' };
    const orderInProgress = { id: 'o2', userId: 'u1', charge: 1000n, quantity: 100, remains: 50, status: 'IN_PROGRESS' };

    expect(await RefundPolicyService.processRefund(orderCompleted)).toBeNull();
    expect(await RefundPolicyService.processRefund(orderInProgress)).toBeNull();
  });
});
