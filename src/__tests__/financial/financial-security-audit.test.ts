/**
 * @file financial-security-audit.test.ts
 * @description Comprehensive Financial Security Audit — SMMplan / OmniSMM 1.0
 *
 * 66 pure unit tests (no real DB) across 10 audit sections:
 *   §1  Currency ops & conversion
 *   §2  Margin / BPS math
 *   §3  Error classes & message hygiene
 *   §4  Race conditions (mocked)
 *   §5  Idempotency
 *   §6  Float drift & BigInt precision
 *   §7  Partial refunds
 *   §8  VAT & gateway boundaries
 *   §9  Ledger-First invariant
 *   §10 UX error quality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExactMath } from '@/lib/financial/exact-math';
import { getCostRub } from '@/lib/pricing/currency-invariant';
import {
  WalletInsufficientFundsError,
  WalletUserNotFoundError,
  WalletInvalidAmountError,
  WalletOps,
} from '@/services/financial/wallet-ops';
import { RefundPolicy } from '@/services/financial/refund-policy';
import { IdempotencyKeys } from '@/services/financial/idempotency-keys';
import { CurrencyService } from '@/services/financial/currency.service';
import { calculateVat, formatMoneyCents, parseRublesToCents } from '@/utils/money';

// ─── Global Mocks ────────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@/lib/settings', () => ({
  SettingsProvider: { getExchangeRateUSD: vi.fn().mockResolvedValue(95.0) },
}));

// ─── Tx Factory ──────────────────────────────────────────────────────────────
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

function makeTx(userBalance: bigint = BigInt(10000), userTenant = 'smmplan'): MockTx {
  const ledger: Map<string, object> = new Map();
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'u1',
        balance: userBalance,
        tenantId: userTenant,
        totalSpent: BigInt(5000),
      }),
      update: vi.fn().mockImplementation(async () => ({
        balance: userBalance,
        totalSpent: BigInt(4700),
        tenantId: userTenant,
      })),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ balance: userBalance - BigInt(1000) }),
    },
    ledgerEntry: {
      findFirst: vi.fn().mockImplementation(
        async ({ where }: { where: { idempotencyKey?: string } }) =>
          where.idempotencyKey && ledger.has(where.idempotencyKey)
            ? ledger.get(where.idempotencyKey)
            : null
      ),
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        const entry = { id: `le-${Date.now()}`, ...data };
        if (data.idempotencyKey) ledger.set(data.idempotencyKey as string, entry);
        return entry;
      }),
    },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// §1  CURRENCY OPERATIONS & CONVERSION  (12 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('§1 Currency Operations & Conversion', () => {
  it('Case 1 — GBP throws CURRENCY_UNSUPPORTED (fail-closed on unknown currency)', () => {
    expect(() => getCostRub(100, 'GBP', 95.0)).toThrow('CURRENCY_UNSUPPORTED');
  });

  it('Case 2 — negative usdRate throws INVALID_USD_RATE for USD', () => {
    expect(() => getCostRub(100, 'USD', -95.0)).toThrow('INVALID_USD_RATE');
  });

  it('Case 3 — zero usdRate throws INVALID_USD_RATE for USD', () => {
    expect(() => getCostRub(100, 'USD', 0)).toThrow('INVALID_USD_RATE');
  });

  it('Case 4 — empty string currency throws CURRENCY_UNSUPPORTED', () => {
    expect(() => getCostRub(100, '', 95.0)).toThrow('CURRENCY_UNSUPPORTED');
  });

  it('Case 5 — whitespace + lowercase "  usd  " normalised to USD correctly', () => {
    expect(() => getCostRub(100, '  usd  ', 95.0)).not.toThrow();
    expect(getCostRub(100, '  usd  ', 95.0)).toBeCloseTo(100 * 95.0, 2);
  });

  it('Case 6 — EUR with custom eurToUsd=1.10: result = rate * 1.10 * usdRate', () => {
    const result = getCostRub(100, 'EUR', 95.0, { eurToUsd: 1.10 });
    expect(result).toBeCloseTo(100 * 1.10 * 95.0, 1); // 10450
  });

  it('Case 7 — negative provider rate throws INVALID_RATE', () => {
    expect(() => getCostRub(-50, 'USD', 95.0)).toThrow('INVALID_RATE');
  });

  it('rate=0 with RUB returns 0 (documented: buildCurrencySnapshot catches cost<=0)', () => {
    // getCostRub itself allows zero-rate RUB; the downstream snapshot guard blocks it
    expect(getCostRub(0, 'RUB', 95.0)).toBe(0);
  });

  it('UAH with default cross-rate 0.027 converts correctly', () => {
    const result = getCostRub(100, 'UAH', 95.0);
    expect(result).toBeCloseTo(100 * 0.027 * 95.0, 1); // ≈ 256.5
  });

  it('KZT with default cross-rate 0.0023 converts correctly', () => {
    const result = getCostRub(100, 'KZT', 95.0);
    expect(result).toBeCloseTo(100 * 0.0023 * 95.0, 1); // ≈ 21.85
  });

  it('Infinity usdRate throws INVALID_USD_RATE', () => {
    expect(() => getCostRub(100, 'USD', Infinity)).toThrow('INVALID_USD_RATE');
  });

  it('NaN usdRate throws INVALID_USD_RATE', () => {
    expect(() => getCostRub(100, 'USD', NaN)).toThrow('INVALID_USD_RATE');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §2  MARGIN & BPS MATH  (8 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('§2 Margin & BPS Math (ExactMath)', () => {
  it('Case 11 — marginBps=0n: cost = qty * rate / 1000 exactly', () => {
    // qty=1000, rate=100n kopecks/1k → exactly 100n kopecks, no markup
    const cost = ExactMath.calculateOrderCostKopecks(1000, BigInt(100), BigInt(0), BigInt(1));
    expect(cost).toBe(BigInt(100));
  });

  it('Case 12a — Banker\'s Rounding: 2.5 → 2 (nearest even)', () => {
    expect(ExactMath.roundHalfEven(BigInt(25000), BigInt(10000))).toBe(BigInt(2));
  });

  it('Case 12b — Banker\'s Rounding: 3.5 → 4 (nearest even)', () => {
    expect(ExactMath.roundHalfEven(BigInt(35000), BigInt(10000))).toBe(BigInt(4));
  });

  it('Case 12c — Banker\'s Rounding: 1.5 → 2 (nearest even)', () => {
    expect(ExactMath.roundHalfEven(BigInt(15000), BigInt(10000))).toBe(BigInt(2));
  });

  it('Case 13 — negative marginBps throws', () => {
    expect(() =>
      ExactMath.calculateOrderCostKopecks(1000, BigInt(100), BigInt(-500))
    ).toThrow(/Margin bps cannot be negative/);
  });

  it('Case 14 — extreme 999999 bps (9999.99%) does not throw or overflow', () => {
    const cost = ExactMath.calculateOrderCostKopecks(1000, BigInt(100), BigInt(999999));
    expect(typeof cost).toBe('bigint');
    expect(cost).toBeGreaterThan(BigInt(0));
  });

  it('minChargeKopecks=1n enforces floor for micro-quantity (anti zero-charge)', () => {
    // qty=1, rate=1n → raw ≈ 0.001 kopecks → floored to minCharge=1n
    const cost = ExactMath.calculateOrderCostKopecks(1, BigInt(1), BigInt(0), BigInt(1));
    expect(cost).toBe(BigInt(1));
  });

  it('negative ratePer1kKopecks throws', () => {
    expect(() =>
      ExactMath.calculateOrderCostKopecks(1000, BigInt(-100), BigInt(0))
    ).toThrow(/Rate cannot be negative/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §3  ERROR CLASSES & MESSAGE HYGIENE  (6 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('§3 Error Classes & Message Hygiene', () => {
  it('WalletInsufficientFundsError: code=INSUFFICIENT_FUNDS, message contains both amounts', () => {
    const err = new WalletInsufficientFundsError(BigInt(5000), BigInt(1000));
    expect(err.code).toBe('INSUFFICIENT_FUNDS');
    expect(err.message).toContain('5000');
    expect(err.message).toContain('1000');
  });

  it('WalletUserNotFoundError: code=USER_NOT_FOUND, is instanceof Error', () => {
    const err = new WalletUserNotFoundError('user-abc');
    expect(err.code).toBe('USER_NOT_FOUND');
    expect(err instanceof Error).toBe(true);
  });

  it('WalletUserNotFoundError message does not leak SQL or DB internals', () => {
    const err = new WalletUserNotFoundError('u-secret');
    expect(err.message).not.toMatch(/SELECT|FROM|WHERE|prisma|postgresql|pg_/i);
  });

  it('WalletInvalidAmountError: code=INVALID_AMOUNT, action named in message', () => {
    const err = new WalletInvalidAmountError('Charge');
    expect(err.code).toBe('INVALID_AMOUNT');
    expect(err.message).toContain('Charge');
  });

  it('WalletOps.charge rejects amount=0 with WalletInvalidAmountError', async () => {
    const tx = makeTx();
    await expect(WalletOps.charge(tx as never, 'u1', BigInt(0), 'Zero')).rejects.toThrow(
      WalletInvalidAmountError
    );
  });

  it('WalletOps.charge rejects amount > 100_000_000n (1M RUB cap)', async () => {
    const tx = makeTx(BigInt(999_999_999));
    await expect(
      WalletOps.charge(tx as never, 'u1', BigInt(100_000_001), 'Overflow')
    ).rejects.toThrow(WalletInvalidAmountError);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §4  RACE CONDITIONS (mocked)  (5 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('§4 Race Conditions (mocked Serializable)', () => {
  it('charge succeeds when balance >= amount', async () => {
    const tx = makeTx(BigInt(10000));
    const result = await WalletOps.charge(tx as never, 'u1', BigInt(1000), 'Order');
    expect(result.success).toBe(true);
  });

  it('charge throws INSUFFICIENT_FUNDS when balance pre-check fails (< amount)', async () => {
    const tx = makeTx(BigInt(500)); // balance=500 < charge=1000
    await expect(
      WalletOps.charge(tx as never, 'u1', BigInt(1000), 'Order')
    ).rejects.toThrow(WalletInsufficientFundsError);
  });

  it('charge throws INSUFFICIENT_FUNDS when updateMany.count=0 (concurrent depletion)', async () => {
    const tx = makeTx(BigInt(10000));
    (tx.user.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
    (tx.user.findUniqueOrThrow as ReturnType<typeof vi.fn>).mockResolvedValue({ balance: BigInt(0) });
    await expect(
      WalletOps.charge(tx as never, 'u1', BigInt(1000), 'Race')
    ).rejects.toThrow(WalletInsufficientFundsError);
  });

  it('credit throws WalletInvalidAmountError for amount=0', async () => {
    const tx = makeTx();
    await expect(
      WalletOps.credit(tx as never, 'u1', BigInt(0), 'Bonus')
    ).rejects.toThrow(WalletInvalidAmountError);
  });

  it('cross-tenant charge rejected: user.tenantId !== supplied tenantId', async () => {
    const tx = makeTx(BigInt(10000), 'smmplan');
    await expect(
      WalletOps.charge(tx as never, 'u1', BigInt(1000), 'Attack', { tenantId: 'flux' })
    ).rejects.toThrow(WalletUserNotFoundError);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §5  IDEMPOTENCY  (5 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('§5 Idempotency', () => {
  it('Case 15 — second call with same key returns cached=true, user.update called once', async () => {
    const tx = makeTx();
    const key = 'idem-test-abc';

    const first = await WalletOps.credit(tx as never, 'u1', BigInt(2500), 'Topup', {
      idempotencyKey: key,
    });
    expect(first.cached).toBe(false);

    const second = await WalletOps.credit(tx as never, 'u1', BigInt(2500), 'Topup', {
      idempotencyKey: key,
    });
    expect(second.cached).toBe(true);
    // user.update should have been called only once
    expect((tx.user.update as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it('without idempotencyKey every call is independent (no guard)', async () => {
    const tx = makeTx();
    await WalletOps.credit(tx as never, 'u1', BigInt(100), 'No key A');
    await WalletOps.credit(tx as never, 'u1', BigInt(100), 'No key B');
    expect((tx.user.update as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
  });

  it('IdempotencyKeys.forOrderCharge produces stable deterministic key', () => {
    expect(IdempotencyKeys.forOrderCharge('ord-123')).toBe(
      IdempotencyKeys.forOrderCharge('ord-123')
    );
  });

  it('IdempotencyKeys.forOrderCharge throws on empty orderId', () => {
    expect(() => IdempotencyKeys.forOrderCharge('')).toThrow(/orderId is required/);
  });

  it('IdempotencyKeys.forDeposit returns stable "deposit:<paymentId>" format', () => {
    expect(IdempotencyKeys.forDeposit('pay-xyz-999')).toBe('deposit:pay-xyz-999');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §6  FLOAT DRIFT & BIGINT PRECISION  (8 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('§6 Float Drift & BigInt Precision', () => {
  it('Case 18 — rublesToKopecks(12.34) === 1234n (no IEEE-754 drift)', () => {
    expect(ExactMath.rublesToKopecks(12.34)).toBe(BigInt(1234));
  });

  it('Case 19 — 1000 iterations of +0.01 RUB sum to exactly 1000n kopecks', () => {
    let balance = BigInt(0);
    for (let i = 0; i < 1000; i++) {
      balance += ExactMath.rublesToKopecks(0.01);
    }
    expect(balance).toBe(BigInt(1000));
  });

  it('Case 20 — kopecksToRublesString(123456n) === "1234.56"', () => {
    expect(ExactMath.kopecksToRublesString(BigInt(123456))).toBe('1234.56');
  });

  it('kopecksToRublesString(1n) === "0.01" (leading zero preserved)', () => {
    expect(ExactMath.kopecksToRublesString(BigInt(1))).toBe('0.01');
  });

  it('Case 21a — roundHalfEven: 1.5 → 2 (nearest even)', () => {
    expect(ExactMath.roundHalfEven(BigInt(15000), BigInt(10000))).toBe(BigInt(2));
  });

  it('Case 21b — roundHalfEven: 2.5 → 2 (nearest even)', () => {
    expect(ExactMath.roundHalfEven(BigInt(25000), BigInt(10000))).toBe(BigInt(2));
  });

  it('Case 21c — roundHalfEven: 3.5 → 4 (nearest even)', () => {
    expect(ExactMath.roundHalfEven(BigInt(35000), BigInt(10000))).toBe(BigInt(4));
  });

  it('roundHalfEven throws on divisor=0', () => {
    expect(() => ExactMath.roundHalfEven(BigInt(10000), BigInt(0))).toThrow(
      /Divisor must be positive/
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §7  PARTIAL REFUNDS  (8 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('§7 Partial Refunds', () => {
  it('Case 23 — 300 remains of 1000 → 300n kopecks refund', () => {
    expect(ExactMath.calculatePartialRefund(BigInt(1000), 1000, 300)).toBe(BigInt(300));
  });

  it('Case 24 — remains > initialQty → returns full charge (over-refund cap)', () => {
    expect(ExactMath.calculatePartialRefund(BigInt(1000), 1000, 1500)).toBe(BigInt(1000));
  });

  it('Case 25 — remains=0 → 0n (nothing to refund)', () => {
    expect(ExactMath.calculatePartialRefund(BigInt(1000), 1000, 0)).toBe(BigInt(0));
  });

  it('RefundPolicy.calcRefund clamps below maxAvailableRefund (previous refunds exist)', () => {
    // charge=1000n, prev refunded=800n → max=200n; raw ratio would be 500n → clamped to 200n
    const result = RefundPolicy.calcRefund(
      { id: 'ord-1', charge: BigInt(1000), quantity: 100 },
      BigInt(800),
      50
    );
    expect(result.refundAmount).toBe(BigInt(200));
  });

  it('RefundPolicy.calcRefund returns full charge when all items remain', () => {
    const result = RefundPolicy.calcRefund(
      { id: 'ord-2', charge: BigInt(5000), quantity: 500 },
      BigInt(0),
      500
    );
    expect(result.refundAmount).toBe(BigInt(5000));
    expect(result.isPartial).toBe(false);
  });

  it('RefundPolicy.calcRefund isPartial=true when some items fulfilled', () => {
    const result = RefundPolicy.calcRefund(
      { id: 'ord-3', charge: BigInt(1000), quantity: 100 },
      BigInt(0),
      40
    );
    expect(result.isPartial).toBe(true);
  });

  it('RefundPolicy.calcRefund idempotencyKey is deterministic for same inputs', () => {
    const r1 = RefundPolicy.calcRefund({ id: 'ord-4', charge: BigInt(500), quantity: 50 }, BigInt(0), 25);
    const r2 = RefundPolicy.calcRefund({ id: 'ord-4', charge: BigInt(500), quantity: 50 }, BigInt(0), 25);
    expect(r1.idempotencyKey).toBe(r2.idempotencyKey);
  });

  it('WalletOps.refund throws WalletInvalidAmountError for amount=0', async () => {
    const tx = makeTx();
    await expect(
      WalletOps.refund(tx as never, 'u1', BigInt(0), 'Zero refund')
    ).rejects.toThrow(WalletInvalidAmountError);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §8  VAT & GATEWAY BOUNDARIES  (6 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('§8 VAT & Gateway Boundaries', () => {
  it('Case 26 — calculateVat(10001n, 22) === 1804n (54-FZ, zero float leakage)', () => {
    // floor(10001 * 22 / 122) = floor(1804.26...) = 1804
    expect(calculateVat(BigInt(10001), 22)).toBe(BigInt(1804));
  });

  it('calculateVat(10000n, 22): result is 1804n (ceiling rounding for tax compliance)', () => {
    // Formula: (10000 * 22 + 122 - 1) / 122 = 220121 / 122 = 1804 (ceiling)
    expect(calculateVat(BigInt(10000), 22)).toBe(BigInt(1804));
  });

  it('calculateVat with vatRate=0 → 0n', () => {
    expect(calculateVat(BigInt(10000), 0)).toBe(BigInt(0));
  });

  it('calculateVat(0n, 22) → 0n', () => {
    expect(calculateVat(BigInt(0), 22)).toBe(BigInt(0));
  });

  it('formatMoneyCents / parseRublesToCents roundtrip without float loss', () => {
    const original = BigInt(10001); // 100.01 RUB
    const str = formatMoneyCents(original);
    const parsed = parseRublesToCents(str);
    expect(str).toBe('100.01');
    expect(parsed).toBe(original);
  });

  it('CurrencyService.calculatePricing: volatility_mode applies 1.05x hedge (higher price)', () => {
    const normal = CurrencyService.calculatePricing(1.0, 100.0, 1.5, false);
    const volatile = CurrencyService.calculatePricing(1.0, 100.0, 1.5, true);
    // normal: floor(1*100*100)=10000 → floor(10000*1.5)=15000
    // volatile: floor(floor(10000*1.05)*1.5)=floor(10500*1.5)=15750
    expect(volatile).toBeGreaterThan(normal);
    expect(normal).toBe(15000);
    expect(volatile).toBe(15750);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §9  LEDGER-FIRST INVARIANT  (4 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('§9 Ledger-First Invariant (call-order assertions)', () => {
  it('charge: ledgerEntry.create is called BEFORE user.updateMany', async () => {
    const callOrder: string[] = [];
    const tx: MockTx = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'u1', balance: BigInt(10000), tenantId: 'smmplan' }),
        update: vi.fn(),
        updateMany: vi.fn().mockImplementation(async () => {
          callOrder.push('updateMany');
          return { count: 1 };
        }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ balance: BigInt(9000) }),
      },
      ledgerEntry: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
          callOrder.push('ledgerCreate');
          return { id: 'le-c', ...data };
        }),
      },
    };

    await WalletOps.charge(tx as never, 'u1', BigInt(1000), 'Order charge');

    expect(callOrder.indexOf('ledgerCreate')).toBeLessThan(callOrder.indexOf('updateMany'));
  });

  it('refund: ledgerEntry.create is called BEFORE user.update (P0 fix verified)', async () => {
    const callOrder: string[] = [];
    const tx: MockTx = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'u1', balance: BigInt(5000), totalSpent: BigInt(1000), tenantId: 'smmplan',
        }),
        update: vi.fn().mockImplementation(async () => {
          callOrder.push('userUpdate');
          return { balance: BigInt(5300), totalSpent: BigInt(700) };
        }),
        updateMany: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
      ledgerEntry: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
          callOrder.push('ledgerCreate');
          return { id: 'le-r', ...data };
        }),
      },
    };

    await WalletOps.refund(tx as never, 'u1', BigInt(300), 'Partial refund');

    expect(callOrder.indexOf('ledgerCreate')).toBeLessThan(callOrder.indexOf('userUpdate'));
  });

  it('charge ledger entry has transactionType=ORDER_CHARGE and status=APPROVED', async () => {
    const tx = makeTx();
    const result = await WalletOps.charge(tx as never, 'u1', BigInt(500), 'Order');
    expect(result.entry).toMatchObject({ transactionType: 'ORDER_CHARGE', status: 'APPROVED' });
  });

  it('refund ledger entry has transactionType=REFUND and status=APPROVED', async () => {
    const tx = makeTx();
    const result = await WalletOps.refund(tx as never, 'u1', BigInt(300), 'Refund');
    expect(result.entry).toMatchObject({ transactionType: 'REFUND', status: 'APPROVED' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §10 UX ERROR QUALITY & REPUTATION RISKS  (4 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('§10 UX Error Quality & Reputation Risks', () => {
  it('INSUFFICIENT_FUNDS message includes both needed and available amounts (user-readable)', () => {
    const err = new WalletInsufficientFundsError(BigInt(5000), BigInt(1000));
    expect(err.message).toContain('5000');
    expect(err.message).toContain('1000');
    expect(err.code).toBe('INSUFFICIENT_FUNDS');
  });

  it('CURRENCY_UNSUPPORTED message names the unsupported currency', () => {
    let caught: Error | null = null;
    try { getCostRub(100, 'GBP', 95.0); } catch (e) { caught = e as Error; }
    expect(caught).not.toBeNull();
    expect(caught!.message).toContain('GBP');
  });

  it('adminAdjust with amount=0 throws INVALID_AMOUNT (prevents no-op silent adjustments)', async () => {
    const tx = makeTx();
    await expect(
      WalletOps.adminAdjust(tx as never, 'u1', BigInt(0), 'Zero adjust')
    ).rejects.toThrow(WalletInvalidAmountError);
  });

  it('negative balance is architecturally impossible: pre-check fires BEFORE updateMany', async () => {
    const tx = makeTx(BigInt(0)); // user with 0 balance
    await expect(
      WalletOps.charge(tx as never, 'u1', BigInt(1), 'Overdraft')
    ).rejects.toThrow(WalletInsufficientFundsError);
    // updateMany must NOT have been called
    expect((tx.user.updateMany as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });
});
