import 'server-only';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { runSerializableTransaction } from '@/lib/transactions';
import { ExactMath } from '@/lib/financial/exact-math';
import type { LedgerTransactionType } from '@/lib/financial/ledger-types';

export { ExactMath };

type PrismaTx = Omit<Prisma.TransactionClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export class WalletInsufficientFundsError extends Error {
  readonly code = 'INSUFFICIENT_FUNDS';
  constructor(needed: number | bigint, got: number | bigint) {
    super(`Insufficient funds: needed ${needed.toString()}, got ${got.toString()}`);
    this.name = 'WalletInsufficientFundsError';
  }
}

export class WalletUserNotFoundError extends Error {
  readonly code = 'USER_NOT_FOUND';
  constructor(userId: string) {
    super(`User ${userId} not found or tenant access forbidden.`);
    this.name = 'WalletUserNotFoundError';
  }
}

export class WalletInvalidAmountError extends Error {
  readonly code = 'INVALID_AMOUNT';
  constructor(action: 'Charge' | 'Credit' | 'Adjustment' | 'Refund') {
    super(`${action} amount must be a strictly positive finite number.`);
    this.name = 'WalletInvalidAmountError';
  }
}

export interface WalletOpsOptions {
  idempotencyKey?: string;
  adminId?: string;
  tenantId?: string;
  /** Явный тип транзакции. Если не задан — метод использует свой дефолт. */
  transactionType?: LedgerTransactionType;
  /** Разрешить повышенный лимит корректировки баланса (до 10 млн ₽ для OWNER) */
  allowElevatedCap?: boolean;
}

export const MAX_ADJUSTMENT_CAP_KOPECKS = BigInt(10_000_000); // 100,000.00 RUB safety cap
export const ELEVATED_ADJUSTMENT_CAP_KOPECKS = BigInt(1_000_000_000); // 10,000,000.00 RUB safety cap (Owner elevated)

export const WalletOps = {
  /**
   * Safe charge mechanism without creating a new transaction.
   * Modifying balances using this guarantees no double-spending.
   * Strictly enforces Ledger-First Principle (LedgerEntry created BEFORE balance mutation).
   */
  async charge(
    tx: PrismaTx,
    userId: string,
    amountCents: number | bigint,
    reason: string,
    opts?: WalletOpsOptions
  ) {
    const rawCents = typeof amountCents === 'bigint' ? amountCents : BigInt(amountCents);
    const MAX_SINGLE_CHARGE_CENTS = BigInt(100_000_000); // 1M RUB safety cap
    if (rawCents <= BigInt(0) || rawCents > MAX_SINGLE_CHARGE_CENTS) {
      throw new WalletInvalidAmountError('Charge');
    }

    const { idempotencyKey, adminId, tenantId, transactionType: txTypeOverride } = opts || {};

    // 1. Validate User existence and tenant isolation
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, balance: true, tenantId: true }
    });

    if (!user) {
      throw new WalletUserNotFoundError(userId);
    }

    if (tenantId && user.tenantId !== tenantId) {
      throw new WalletUserNotFoundError(userId);
    }

    if (user.balance < rawCents) {
      throw new WalletInsufficientFundsError(rawCents, user.balance);
    }

    const resolvedTenantId = tenantId || user.tenantId || 'smmplan';

    // 2. Idempotency pre-check
    if (idempotencyKey) {
      const existing = await tx.ledgerEntry.findFirst({
        where: { idempotencyKey, tenantId: resolvedTenantId },
      });
      
      if (existing) {
        return { success: true, balance: user.balance, cached: true, entry: existing };
      }
    }

    // 3. LEDGER-FIRST INVARIANT: Create LedgerEntry FIRST before updating User.balance
    try {
      const entry = await tx.ledgerEntry.create({
        data: {
          userId,
          tenantId: resolvedTenantId,
          adminId,
          amount: -rawCents,
          reason,
          status: 'APPROVED',
          idempotencyKey,
          transactionType: txTypeOverride ?? 'ORDER_CHARGE',
        }
      });

      // 4. Atomically mutate balance with concurrency check
      const updatedUserBatch = await tx.user.updateMany({
        where: { 
          id: userId,
          balance: { gte: rawCents },
          ...(tenantId ? { tenantId } : {})
        },
        data: {
          balance: { decrement: rawCents },
          totalSpent: { increment: rawCents }
        }
      });

      if (updatedUserBatch.count === 0) {
        const checkUser = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true, balance: true },
        });
        throw new WalletInsufficientFundsError(rawCents, checkUser?.balance ?? BigInt(0));
      }

      const finalUser = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { balance: true }
      });

      return { success: true, balance: finalUser.balance, cached: false, entry };
    } catch (error: unknown) {
      if (
        idempotencyKey &&
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        const existing = await tx.ledgerEntry.findFirst({
          where: { idempotencyKey, tenantId: resolvedTenantId },
        });
        if (existing) {
          const userCurrent = await tx.user.findUnique({ where: { id: userId }, select: { balance: true } });
          return { success: true, balance: userCurrent?.balance ?? null, cached: true, entry: existing };
        }
      }
      throw error;
    }
  },

  /**
   * Refill user balance (e.g., from Yookassa top-up) without creating a new transaction.
   */
  async credit(
    tx: PrismaTx,
    userId: string,
    amountCents: number | bigint,
    reason: string,
    opts?: WalletOpsOptions
  ) {
    const rawCents = typeof amountCents === 'bigint' ? amountCents : BigInt(amountCents);
    const MAX_SINGLE_CREDIT_CENTS = BigInt(100_000_000); // 1M RUB safety cap
    if (rawCents <= BigInt(0) || rawCents > MAX_SINGLE_CREDIT_CENTS) {
      throw new WalletInvalidAmountError('Credit');
    }

    const { idempotencyKey, adminId, tenantId, transactionType: txTypeOverride } = opts || {};

    // Fetch user once for both tenant-check and tenantId fallback
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true }
    });

    if (tenantId) {
      if (!user || user.tenantId !== tenantId) {
        throw new WalletUserNotFoundError(userId);
      }
    } else if (!user) {
      throw new WalletUserNotFoundError(userId);
    }

    const resolvedTenantId = tenantId || user?.tenantId || 'smmplan';

    if (idempotencyKey) {
      const existing = await tx.ledgerEntry.findFirst({
        where: { idempotencyKey, tenantId: resolvedTenantId },
      });
      if (existing) {
        return { success: true, balance: null, cached: true, entry: existing };
      }
    }

    try {
      const entry = await tx.ledgerEntry.create({
        data: {
          userId,
          tenantId: resolvedTenantId,  // Bug #3 fixed: was tenantId || 'smmplan', missing user.tenantId fallback
          adminId,
          amount: rawCents,
          reason,
          status: 'APPROVED',
          idempotencyKey,
          transactionType: txTypeOverride ?? 'TOPUP',
        }
      });

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { balance: { increment: rawCents } },
        select: { balance: true }
      });

      return { success: true, balance: updatedUser.balance, cached: false, entry };
    } catch (error: unknown) {
      if (
        idempotencyKey && 
        typeof error === 'object' && 
        error !== null && 
        'code' in error && 
        (error as { code: string }).code === 'P2002'
      ) {
        // Bug #1 fixed: use tx.* instead of db.* to stay within transaction isolation boundary
        const existing = await tx.ledgerEntry.findFirst({
          where: { idempotencyKey, tenantId: resolvedTenantId },
        });
        if (existing) {
          const updatedUser = await tx.user.findUnique({ where: { id: userId }, select: { balance: true } });
          return { success: true, balance: updatedUser?.balance ?? null, cached: true, entry: existing };
        }
      }
      throw error;
    }
  },

  /**
   * Universal adjustment for admin operations (can be positive or negative)
   * Does NOT affect totalSpent.
   */
  async adminAdjust(
    tx: PrismaTx,
    userId: string,
    amountCents: number | bigint,
    reason: string,
    opts?: WalletOpsOptions
  ) {
    const rawCents = typeof amountCents === 'bigint' ? amountCents : BigInt(amountCents);
    if (rawCents === BigInt(0)) {
      throw new WalletInvalidAmountError('Adjustment');
    }

    const { idempotencyKey, adminId, tenantId, transactionType: txTypeOverride, allowElevatedCap } = opts || {};
    const effectiveCap = allowElevatedCap ? ELEVATED_ADJUSTMENT_CAP_KOPECKS : MAX_ADJUSTMENT_CAP_KOPECKS;

    // Safety cap check: prevent unbounded negative/positive adjustments (P2-14)
    if (rawCents < -effectiveCap) {
      throw new Error(`🚨 [WALLET-OPS] Negative adjustment exceeds safety cap limit (-${effectiveCap / BigInt(100)} ₽)!`);
    }
    if (rawCents > effectiveCap) {
      throw new Error(`🚨 [WALLET-OPS] Positive adjustment exceeds safety cap limit (+${effectiveCap / BigInt(100)} ₽)!`);
    }

    // Fetch user tenantId for ledger entry (also validates user existence)
    const userRecord = await tx.user.findUnique({
      where: { id: userId },
      select: { tenantId: true }
    });
    if (!userRecord) throw new WalletUserNotFoundError(userId);

    if (tenantId && userRecord.tenantId !== tenantId) {
      throw new WalletUserNotFoundError(userId);
    }

    const resolvedTenantId = tenantId || userRecord.tenantId || 'smmplan';

    if (idempotencyKey) {
      const existing = await tx.ledgerEntry.findFirst({
        where: { idempotencyKey, tenantId: resolvedTenantId },
      });
      if (existing) {
        return { success: true, balance: null, cached: true, entry: existing };
      }
    }

    // Bug fixed: create ledger entry FIRST, then update balance
    // (matches immutable ledger pattern — if ledger.create fails, balance stays unchanged)
    const entry = await tx.ledgerEntry.create({
      data: {
        userId,
        tenantId: resolvedTenantId,
        adminId,
        amount: rawCents,
        reason,
        status: 'APPROVED',
        idempotencyKey,
        transactionType: txTypeOverride ?? 'ADJUSTMENT',
      }
    });

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { balance: { increment: rawCents } },
      select: { balance: true }
    });

    return { success: true, balance: updatedUser.balance, cached: false, entry };
  },

  /**
   * Refund user balance: increments balance, decrements totalSpent, creates ledger entry.
   */
  async refund(
    tx: PrismaTx,
    userId: string,
    amountCents: number | bigint,
    reason: string,
    opts?: WalletOpsOptions
  ) {
    const rawCents = typeof amountCents === 'bigint' ? amountCents : BigInt(amountCents);
    if (rawCents <= BigInt(0)) {
      throw new WalletInvalidAmountError('Refund');
    }

    const { idempotencyKey, adminId, tenantId, transactionType: txTypeOverride } = opts || {};

    // Fetch user for tenant and totalSpent calculation
    const existingUser = await tx.user.findUnique({
      where: { id: userId },
      select: { balance: true, totalSpent: true, tenantId: true }
    });
    if (!existingUser) throw new WalletUserNotFoundError(userId);

    if (tenantId && existingUser.tenantId !== tenantId) {
      throw new WalletUserNotFoundError(userId);
    }

    const resolvedTenantId = tenantId || existingUser.tenantId || 'smmplan';

    if (idempotencyKey) {
      const existing = await tx.ledgerEntry.findFirst({
        where: { idempotencyKey, tenantId: resolvedTenantId },
      });
      if (existing) {
        return { success: true, balance: null, cached: true, entry: existing };
      }
    }

    // Calculate safe totalSpent (down to 0 if order was paid via external gateway without prior balance charge)
    const currentTotalSpent = existingUser.totalSpent ?? BigInt(0);
    const newTotalSpent = currentTotalSpent > rawCents ? currentTotalSpent - rawCents : BigInt(0);

    // LEDGER-FIRST INVARIANT: Create LedgerEntry BEFORE updating User.balance.
    // If ledger.create fails, the balance is never touched — preserving financial integrity.
    const entry = await tx.ledgerEntry.create({
      data: {
        userId,
        tenantId: resolvedTenantId,
        adminId,
        amount: rawCents,
        reason,
        status: 'APPROVED',
        idempotencyKey,
        // adminId present → ручная отмена заказа (ORDER_CANCEL), иначе авто-возврат (REFUND)
        transactionType: txTypeOverride ?? (adminId ? 'ORDER_CANCEL' : 'REFUND'),
      }
    });

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        balance: { increment: rawCents },
        totalSpent: newTotalSpent
      },
      select: { balance: true, totalSpent: true }
    });

    return { success: true, balance: updatedUser.balance, cached: false, entry };
  },

  /**
   * Add funds to user quarantine balance bubble instead of main balance.
   */
  async quarantineAdd(
    tx: PrismaTx,
    userId: string,
    amountCents: number | bigint,
    reason: string,
    opts?: WalletOpsOptions
  ) {
    const { idempotencyKey, adminId, tenantId } = opts || {};
    const rawCents = typeof amountCents === 'bigint' ? amountCents : BigInt(amountCents);
    const absAmount = rawCents < BigInt(0) ? -rawCents : rawCents;

    if (tenantId) {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, tenantId: true }
      });
      if (!user || user.tenantId !== tenantId) {
        throw new WalletUserNotFoundError(userId);
      }
    }

    const user = await tx.user.update({
      where: { id: userId },
      data: { quarantineBalance: { increment: absAmount } },
      select: { tenantId: true }
    });

    return await tx.ledgerEntry.create({
      data: {
        userId,
        tenantId: tenantId || user.tenantId || 'smmplan',
        adminId,
        amount: rawCents,
        reason,
        status: 'QUARANTINE',
        idempotencyKey,
        transactionType: 'COMPENSATION'
      }
    });
  },

  /**
   * Release or clear quarantine balance for a user.
   *
   * CONTRACT: quarantineRelease ONLY decrements quarantineBalance.
   * It does NOT create a new LedgerEntry — the original QUARANTINE entry
   * in the journal (now APPROVED or REJECTED) IS the audit record.
   * Creating another entry here would produce duplicates in financial reports.
   */
  async quarantineRelease(
    tx: PrismaTx,
    userId: string,
    amountCents: number | bigint,
    opts?: WalletOpsOptions & { reason?: string }
  ) {
    const rawCents = typeof amountCents === 'bigint' ? amountCents : BigInt(amountCents);
    const absAmount = rawCents < BigInt(0) ? -rawCents : rawCents;

    const updated = await tx.user.updateMany({
      where: { 
        id: userId, 
        quarantineBalance: { gte: absAmount },
        ...(opts?.tenantId ? { tenantId: opts.tenantId } : {})
      },
      data: { quarantineBalance: { decrement: absAmount } }
    });

    if (updated.count === 0) {
      // Insufficient quarantine balance — data integrity violation.
      console.error(`[WalletOps.quarantineRelease] CRITICAL: Cannot release ${absAmount} kopecks from quarantine for user ${userId} — insufficient quarantine balance.`);
      throw new Error(`Quarantine release failed: insufficient quarantine balance (requested: ${absAmount}, user: ${userId}). Manual review required.`);
    }

    // No ledgerEntry.create here intentionally.
    // The caller (escrow.service resolveQuarantine) already updated the original
    // QUARANTINE entry to APPROVED/REJECTED via updateMany before calling this method.
  },
};

/**
 * Direct balance adjustment with mandatory tenant context and serializable transaction.
 */
export async function adjustBalance(
  userId: string, 
  amountCents: bigint | number, 
  context: { actorId: string; tenantId: string; reason: string }
) {
  const user = await db.user.findFirst({
    where: {
      id: userId,
      tenantId: context.tenantId
    }
  });

  if (!user) {
    throw new Error(`User ${userId} not found in tenant ${context.tenantId} or access denied`);
  }

  return await runSerializableTransaction(async (tx) => {
    return await WalletOps.adminAdjust(
      tx,
      userId,
      amountCents,
      context.reason,
      { adminId: context.actorId, tenantId: context.tenantId }
    );
  });
}
