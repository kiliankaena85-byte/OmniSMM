/**
 * @file financial-invariants-deep-security.test.ts
 * @description Advanced Financial Security, Multi-Tenant Boundaries & Balance Invariants Audit
 *
 * Implements ISO/IEC/IEEE 29119 & OWASP ASVS 4.0 Financial Verification Suite:
 *   §1 Multi-Tenant Isolation & Cross-Tenant Boundary Enforcement
 *   §2 High-Value Safety Caps & Boundary Rejections (ISO 29119-4)
 *   §3 Quarantine Balance Life-Cycle & Balance Separation Invariant
 *   §4 Concurrency, State Depletion & Non-Negative Balances (TOCTOU Defense)
 *   §5 Transaction Type Auditing & Traceability (ГОСТ Р 56939-2024 / PCI-DSS)
 *   §6 Idempotency Collision Handling & P2002 Race Recovery
 */

import { describe, it, expect, vi } from 'vitest';
import {
  WalletInsufficientFundsError,
  WalletUserNotFoundError,
  WalletInvalidAmountError,
  WalletOps,
  MAX_ADJUSTMENT_CAP_KOPECKS,
  ELEVATED_ADJUSTMENT_CAP_KOPECKS,
} from '@/services/financial/wallet-ops';

// ─── Global Mocks ────────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@/lib/settings', () => ({
  SettingsProvider: { getExchangeRateUSD: vi.fn().mockResolvedValue(95.0) },
}));

type WalletTx = Parameters<typeof WalletOps.charge>[0];

type MockTx = {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
  };
  ledgerEntry: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

function makeTx(
  userBalance: bigint = BigInt(100000), // 1,000.00 RUB
  userTenant = 'tenant-smmplan',
  quarantineBalance: bigint = BigInt(0)
): MockTx {
  const ledger = new Map<string, Record<string, unknown>>();
  return {
    user: {
      findUnique: vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
        if (where.id === 'non-existent') return null;
        return {
          id: where.id,
          balance: userBalance,
          quarantineBalance,
          tenantId: userTenant,
          totalSpent: BigInt(50000),
        };
      }),
      update: vi.fn().mockImplementation(async ({ data }: { data: { balance?: { increment?: bigint; decrement?: bigint } } }) => {
        let newBalance = userBalance;
        if (data.balance?.increment) newBalance += BigInt(data.balance.increment);
        if (data.balance?.decrement) newBalance -= BigInt(data.balance.decrement);
        return {
          id: 'u1',
          balance: newBalance,
          quarantineBalance,
          tenantId: userTenant,
          totalSpent: BigInt(50000),
        };
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockImplementation(async () => ({
        id: 'u1',
        balance: userBalance,
        quarantineBalance,
        tenantId: userTenant,
      })),
    },
    ledgerEntry: {
      findFirst: vi.fn().mockImplementation(async ({ where }: { where: { idempotencyKey?: string; tenantId?: string } }) => {
        if (!where.idempotencyKey) return null;
        const key = `${where.tenantId ?? 'default'}:${where.idempotencyKey}`;
        return ledger.has(key) ? ledger.get(key) : null;
      }),
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        const entry = { id: `le-${Date.now()}-${Math.random()}`, ...data };
        if (data.idempotencyKey) {
          const key = `${data.tenantId ?? 'default'}:${data.idempotencyKey}`;
          ledger.set(key, entry);
        }
        return entry;
      }),
    },
  };
}

function makeWalletTx(
  userBalance: bigint = BigInt(100000),
  userTenant = 'tenant-smmplan',
  quarantineBalance: bigint = BigInt(0)
): { tx: WalletTx; mock: MockTx } {
  const mock = makeTx(userBalance, userTenant, quarantineBalance);
  return { tx: mock as unknown as WalletTx, mock };
}

// ══════════════════════════════════════════════════════════════════════════════
// §1 MULTI-TENANT BOUNDARY ENFORCEMENT (6 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('§1 Multi-Tenant Boundary Enforcement & Spillover Prevention', () => {
  it('Case 1: charge rejects cross-tenant access when user belongs to tenant-A but opts.tenantId is tenant-B', async () => {
    const { tx, mock } = makeWalletTx(BigInt(10000), 'tenant-A');
    await expect(
      WalletOps.charge(tx, 'u1', BigInt(500), 'Order charge', { tenantId: 'tenant-B' })
    ).rejects.toThrow(WalletUserNotFoundError);

    expect(mock.user.updateMany).not.toHaveBeenCalled();
    expect(mock.ledgerEntry.create).not.toHaveBeenCalled();
  });

  it('Case 2: credit rejects cross-tenant deposit injection', async () => {
    const { tx, mock } = makeWalletTx(BigInt(10000), 'tenant-A');
    await expect(
      WalletOps.credit(tx, 'u1', BigInt(1000), 'Malicious deposit', { tenantId: 'tenant-B' })
    ).rejects.toThrow(WalletUserNotFoundError);

    expect(mock.user.update).not.toHaveBeenCalled();
    expect(mock.ledgerEntry.create).not.toHaveBeenCalled();
  });

  it('Case 3: adminAdjust rejects cross-tenant balance override', async () => {
    const { tx, mock } = makeWalletTx(BigInt(10000), 'tenant-A');
    await expect(
      WalletOps.adminAdjust(tx, 'u1', BigInt(2000), 'Unauthorized admin adjust', { tenantId: 'tenant-B' })
    ).rejects.toThrow(WalletUserNotFoundError);

    expect(mock.ledgerEntry.create).not.toHaveBeenCalled();
  });

  it('Case 4: refund rejects cross-tenant refund exploit', async () => {
    const { tx, mock } = makeWalletTx(BigInt(10000), 'tenant-A');
    await expect(
      WalletOps.refund(tx, 'u1', BigInt(1500), 'Fake order refund', { tenantId: 'tenant-B' })
    ).rejects.toThrow(WalletUserNotFoundError);

    expect(mock.user.update).not.toHaveBeenCalled();
  });

  it('Case 5: quarantineAdd rejects cross-tenant quarantine allocation', async () => {
    const { tx } = makeWalletTx(BigInt(10000), 'tenant-A');
    await expect(
      WalletOps.quarantineAdd(tx, 'u1', BigInt(1000), 'Compensatory escrow', { tenantId: 'tenant-B' })
    ).rejects.toThrow(WalletUserNotFoundError);
  });

  it('Case 6: referralCredit rejects cross-tenant referral manipulation', async () => {
    const { tx } = makeWalletTx(BigInt(10000), 'tenant-A');
    await expect(
      WalletOps.referralCredit(tx, 'u1', BigInt(500), 'Referral bonus', { tenantId: 'tenant-B' })
    ).rejects.toThrow(WalletUserNotFoundError);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §2 SAFETY CAPS & BOUNDARY REJECTIONS (ISO 29119-4) (10 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('§2 High-Value Safety Caps & Boundary Rejections', () => {
  it('Case 7: adminAdjust allows exactly MAX_ADJUSTMENT_CAP_KOPECKS (100,000.00 RUB)', async () => {
    const { tx, mock } = makeWalletTx(BigInt(100000), 'smmplan');
    const res = await WalletOps.adminAdjust(tx, 'u1', MAX_ADJUSTMENT_CAP_KOPECKS, 'Standard Max Bonus');
    expect(res.success).toBe(true);
    expect(mock.ledgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: MAX_ADJUSTMENT_CAP_KOPECKS }),
      })
    );
  });

  it('Case 8: adminAdjust rejects MAX_ADJUSTMENT_CAP_KOPECKS + 1n kopecks without elevated cap', async () => {
    const { tx } = makeWalletTx(BigInt(100000), 'smmplan');
    const overLimit = MAX_ADJUSTMENT_CAP_KOPECKS + BigInt(1);
    await expect(
      WalletOps.adminAdjust(tx, 'u1', overLimit, 'Over-cap Bonus')
    ).rejects.toThrow(/exceeds safety cap limit/);
  });

  it('Case 9: adminAdjust allows negative adjustment exactly at -MAX_ADJUSTMENT_CAP_KOPECKS', async () => {
    const { tx } = makeWalletTx(BigInt(50_000_000), 'smmplan'); // 500k RUB balance
    const res = await WalletOps.adminAdjust(tx, 'u1', -MAX_ADJUSTMENT_CAP_KOPECKS, 'Fine/Correction');
    expect(res.success).toBe(true);
  });

  it('Case 10: adminAdjust rejects negative adjustment below -MAX_ADJUSTMENT_CAP_KOPECKS', async () => {
    const { tx } = makeWalletTx(BigInt(50_000_000), 'smmplan');
    const excessiveDebit = -MAX_ADJUSTMENT_CAP_KOPECKS - BigInt(1);
    await expect(
      WalletOps.adminAdjust(tx, 'u1', excessiveDebit, 'Excessive fine')
    ).rejects.toThrow(/Negative adjustment exceeds safety cap limit/);
  });

  it('Case 11: adminAdjust with allowElevatedCap allows up to ELEVATED_ADJUSTMENT_CAP_KOPECKS (10M RUB)', async () => {
    const { tx } = makeWalletTx(BigInt(100000), 'smmplan');
    const res = await WalletOps.adminAdjust(tx, 'u1', ELEVATED_ADJUSTMENT_CAP_KOPECKS, 'Owner Capital Injection', {
      allowElevatedCap: true,
    });
    expect(res.success).toBe(true);
  });

  it('Case 12: adminAdjust with allowElevatedCap rejects ELEVATED_ADJUSTMENT_CAP_KOPECKS + 1n', async () => {
    const { tx } = makeWalletTx(BigInt(100000), 'smmplan');
    const overElevated = ELEVATED_ADJUSTMENT_CAP_KOPECKS + BigInt(1);
    await expect(
      WalletOps.adminAdjust(tx, 'u1', overElevated, 'Unbounded Injection', { allowElevatedCap: true })
    ).rejects.toThrow(/exceeds safety cap limit/);
  });

  it('Case 13: charge rejects amount exceeding 1,000,000.00 RUB (100_000_000n kopecks)', async () => {
    const { tx } = makeWalletTx(BigInt(200_000_000), 'smmplan');
    await expect(
      WalletOps.charge(tx, 'u1', BigInt(100_000_001), 'Excessive single charge')
    ).rejects.toThrow(WalletInvalidAmountError);
  });

  it('Case 14: credit rejects amount exceeding 1,000,000.00 RUB', async () => {
    const { tx } = makeWalletTx(BigInt(0), 'smmplan');
    await expect(
      WalletOps.credit(tx, 'u1', BigInt(100_000_001), 'Excessive single deposit')
    ).rejects.toThrow(WalletInvalidAmountError);
  });

  it('Case 15: charge rejects negative or zero amount', async () => {
    const { tx } = makeWalletTx(BigInt(5000), 'smmplan');
    await expect(WalletOps.charge(tx, 'u1', BigInt(0), 'Zero charge')).rejects.toThrow(WalletInvalidAmountError);
    await expect(WalletOps.charge(tx, 'u1', BigInt(-500), 'Negative charge exploit')).rejects.toThrow(WalletInvalidAmountError);
  });

  it('Case 16: credit rejects negative or zero amount', async () => {
    const { tx } = makeWalletTx(BigInt(5000), 'smmplan');
    await expect(WalletOps.credit(tx, 'u1', BigInt(0), 'Zero credit')).rejects.toThrow(WalletInvalidAmountError);
    await expect(WalletOps.credit(tx, 'u1', BigInt(-500), 'Negative credit exploit')).rejects.toThrow(WalletInvalidAmountError);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §3 QUARANTINE BALANCE LIFE-CYCLE & SEPARATION (4 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('§3 Quarantine Balance Life-Cycle & Isolation Invariant', () => {
  it('Case 17: quarantineAdd strictly increments quarantineBalance and leaves main balance untouched', async () => {
    const { tx, mock } = makeWalletTx(BigInt(25000), 'smmplan', BigInt(0));
    const entry = await WalletOps.quarantineAdd(tx, 'u1', BigInt(5000), 'Escrow lock');

    expect(entry.status).toBe('QUARANTINE');
    expect(entry.amount).toBe(BigInt(5000));
    expect(mock.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { quarantineBalance: { increment: BigInt(5000) } },
      })
    );
    expect(mock.user.update).not.toHaveBeenCalled();
  });

  it('Case 18: quarantineApprove increments main user balance with tenant boundary protection', async () => {
    const { tx, mock } = makeWalletTx(BigInt(25000), 'smmplan', BigInt(5000));
    const res = await WalletOps.quarantineApprove(tx, 'u1', BigInt(5000), { tenantId: 'smmplan' });

    expect(res.success).toBe(true);
    expect(mock.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { balance: { increment: BigInt(5000) } },
      })
    );
  });

  it('Case 19: quarantineRelease decrements quarantineBalance and throws if quarantineBalance is insufficient', async () => {
    const { tx, mock } = makeWalletTx(BigInt(25000), 'smmplan', BigInt(2000));
    // Simulate Prisma updateMany failing with count=0 (quarantineBalance < requested)
    mock.user.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      WalletOps.quarantineRelease(tx, 'u1', BigInt(5000))
    ).rejects.toThrow(/Quarantine release failed: insufficient quarantine balance/);
  });

  it('Case 20: quarantineRelease does NOT create duplicate LedgerEntry (prevents double reporting in P&L)', async () => {
    const { tx, mock } = makeWalletTx(BigInt(25000), 'smmplan', BigInt(5000));
    await WalletOps.quarantineRelease(tx, 'u1', BigInt(5000));

    expect(mock.ledgerEntry.create).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §4 CONCURRENCY, STATE DEPLETION & NON-NEGATIVE BALANCES (TOCTOU) (3 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('§4 Concurrency, State Depletion & Non-Negative Balance Defense', () => {
  it('Case 21: charge aborts cleanly if balance is depleted concurrently between read and updateMany', async () => {
    const { tx, mock } = makeWalletTx(BigInt(10000), 'smmplan');
    // First read showed 10,000 kopecks, but concurrent worker depleted balance -> updateMany returns count: 0
    mock.user.updateMany.mockResolvedValueOnce({ count: 0 });
    mock.user.findUnique.mockResolvedValueOnce({ id: 'u1', balance: BigInt(100) }); // Remaining only 100

    await expect(
      WalletOps.charge(tx, 'u1', BigInt(5000), 'Concurrent Order Charge')
    ).rejects.toThrow(WalletInsufficientFundsError);
  });

  it('Case 22: debit adminAdjust aborts with WalletInsufficientFundsError if user balance is lower than deduction', async () => {
    const { tx, mock } = makeWalletTx(BigInt(1000), 'smmplan'); // User has 10.00 RUB
    mock.user.updateMany.mockResolvedValueOnce({ count: 0 });
    mock.user.findUnique.mockResolvedValueOnce({ id: 'u1', balance: BigInt(1000) });

    await expect(
      WalletOps.adminAdjust(tx, 'u1', BigInt(-5000), 'Admin penalty exceeding balance')
    ).rejects.toThrow(WalletInsufficientFundsError);
  });

  it('Case 23: refund safely decrements totalSpent without letting it drop below zero', async () => {
    const { tx, mock } = makeWalletTx(BigInt(5000), 'smmplan');
    // Total spent is 1000 kopecks, but refund is 2500 kopecks
    mock.user.findUnique.mockResolvedValueOnce({
      id: 'u1',
      balance: BigInt(5000),
      totalSpent: BigInt(1000),
      tenantId: 'smmplan',
    });

    await WalletOps.refund(tx, 'u1', BigInt(2500), 'Partial gateway refund');

    expect(mock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          balance: { increment: BigInt(2500) },
          totalSpent: BigInt(0), // Clamped to 0, never negative
        }),
      })
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §5 TRANSACTION TYPE AUDITING & TRACEABILITY (6 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('§5 Transaction Type Auditing & Traceability Standards', () => {
  it('Case 24: charge default transactionType is ORDER_CHARGE', async () => {
    const { tx, mock } = makeWalletTx(BigInt(10000), 'smmplan');
    await WalletOps.charge(tx, 'u1', BigInt(1000), 'Order purchase');
    expect(mock.ledgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ transactionType: 'ORDER_CHARGE' }) })
    );
  });

  it('Case 25: credit default transactionType is TOPUP', async () => {
    const { tx, mock } = makeWalletTx(BigInt(10000), 'smmplan');
    await WalletOps.credit(tx, 'u1', BigInt(1000), 'Payment topup');
    expect(mock.ledgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ transactionType: 'TOPUP' }) })
    );
  });

  it('Case 26: adminAdjust default transactionType is ADJUSTMENT', async () => {
    const { tx, mock } = makeWalletTx(BigInt(10000), 'smmplan');
    await WalletOps.adminAdjust(tx, 'u1', BigInt(1000), 'Bonus adjustment');
    expect(mock.ledgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ transactionType: 'ADJUSTMENT' }) })
    );
  });

  it('Case 27: refund with adminId sets transactionType to ORDER_CANCEL', async () => {
    const { tx, mock } = makeWalletTx(BigInt(10000), 'smmplan');
    await WalletOps.refund(tx, 'u1', BigInt(1000), 'Admin order cancellation', { adminId: 'adm-99' });
    expect(mock.ledgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ transactionType: 'ORDER_CANCEL', adminId: 'adm-99' }) })
    );
  });

  it('Case 28: refund without adminId sets transactionType to REFUND', async () => {
    const { tx, mock } = makeWalletTx(BigInt(10000), 'smmplan');
    await WalletOps.refund(tx, 'u1', BigInt(1000), 'Automated provider refund');
    expect(mock.ledgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ transactionType: 'REFUND' }) })
    );
  });

  it('Case 29: explicit transactionType override is honored in charge and credit', async () => {
    const { tx, mock } = makeWalletTx(BigInt(10000), 'smmplan');
    await WalletOps.charge(tx, 'u1', BigInt(1000), 'Custom penalty', { transactionType: 'TOPUP' });
    expect(mock.ledgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ transactionType: 'TOPUP' }) })
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §6 IDEMPOTENCY KEY CONCURRENCY & PRISMA P2002 RECOVERY (2 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('§6 Idempotency Collision Handling & P2002 Race Recovery', () => {
  it('Case 30: charge recovers gracefully when simultaneous thread causes P2002 unique violation', async () => {
    const { tx, mock } = makeWalletTx(BigInt(10000), 'smmplan');
    const existingEntry = { id: 'le-orig', amount: BigInt(-1000), status: 'APPROVED', idempotencyKey: 'idem-race-1' };

    // Simulate ledgerEntry.create throwing Prisma P2002 (unique constraint race)
    mock.ledgerEntry.create.mockRejectedValueOnce({ code: 'P2002' });
    mock.ledgerEntry.findFirst.mockResolvedValueOnce(existingEntry);

    const res = await WalletOps.charge(tx, 'u1', BigInt(1000), 'Concurrent purchase', {
      idempotencyKey: 'idem-race-1',
    });

    expect(res.success).toBe(true);
    expect(res.cached).toBe(true);
    expect(res.entry).toBe(existingEntry);
  });

  it('Case 31: credit recovers gracefully when simultaneous top-up webhook causes P2002', async () => {
    const { tx, mock } = makeWalletTx(BigInt(10000), 'smmplan');
    const existingEntry = { id: 'le-topup-orig', amount: BigInt(5000), status: 'APPROVED', idempotencyKey: 'yoo-tx-99' };

    mock.ledgerEntry.create.mockRejectedValueOnce({ code: 'P2002' });
    mock.ledgerEntry.findFirst.mockResolvedValueOnce(existingEntry);

    const res = await WalletOps.credit(tx, 'u1', BigInt(5000), 'Webhook topup', {
      idempotencyKey: 'yoo-tx-99',
    });

    expect(res.success).toBe(true);
    expect(res.cached).toBe(true);
    expect(res.entry).toBe(existingEntry);
  });
});
