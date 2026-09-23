/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Idempotent Bonus Issuer with Atomic Event De-duplication and Vesting Support.
 */

import { db } from '@/lib/db';
import { runSerializableTransaction } from '@/lib/transactions';
import { WalletOps } from '@/services/financial/wallet-ops';

export interface IssueBonusOptions {
  eventType: 'FIRST_DEPOSIT' | 'REFERRAL_SIGNUP' | 'ORDER_COMPLETE' | 'PROMO_CODE';
  eventId: string;
  userId: string;
  amountCents: bigint;
  reason: string;
  isVested?: boolean; // If true, put in 72-hour locked state
  paymentFingerprint?: string;
  ipAddress?: string;
  userAgent?: string;
  tenantId?: string;
}

export class BonusIssuerService {
  /**
   * Atomically issues a bonus with strict idempotency and anti-fraud de-duplication.
   */
  static async issueBonus(opts: IssueBonusOptions): Promise<{ success: boolean; cached?: boolean; bonusEventId: string }> {
    const amountBigInt = typeof opts.amountCents === 'bigint' ? opts.amountCents : BigInt(opts.amountCents);
    const tenantId = opts.tenantId || 'smmplan';

    return await runSerializableTransaction(async (tx) => {
      // 1. Idempotency Check via ProcessedBonusEvent
      const existing = await tx.processedBonusEvent.findUnique({
        where: {
          eventType_eventId: {
            eventType: opts.eventType,
            eventId: opts.eventId,
          },
        },
      });

      if (existing) {
        return { success: true, cached: true, bonusEventId: existing.id };
      }

      // 2. Create ProcessedBonusEvent atomically
      const bonusEvent = await tx.processedBonusEvent.create({
        data: {
          eventType: opts.eventType,
          eventId: opts.eventId,
          userId: opts.userId,
          amountCents: amountBigInt,
          status: opts.isVested ? 'PENDING' : 'PROCESSED',
        },
      });

      // 3. Create BonusRedemptionLog
      const unlockAt = opts.isVested ? new Date(Date.now() + 72 * 60 * 60 * 1000) : null;
      await tx.bonusRedemptionLog.create({
        data: {
          userId: opts.userId,
          bonusType: opts.eventType,
          amountCents: amountBigInt,
          paymentFingerprint: opts.paymentFingerprint,
          ipAddress: opts.ipAddress,
          userAgent: opts.userAgent,
          status: opts.isVested ? 'LOCKED' : 'GRANTED',
          unlockAt,
          reason: opts.reason,
          tenantId,
        },
      });

      // 4. Credit balance if immediate (or credit to quarantine/locked if vested)
      if (!opts.isVested) {
        await WalletOps.credit(tx, opts.userId, amountBigInt, opts.reason, {
          idempotencyKey: `bonus-${opts.eventType}-${opts.eventId}`,
          tenantId,
        });
      } else {
        // In locked vesting, increment user quarantineBalance
        await tx.user.update({
          where: { id: opts.userId },
          data: { quarantineBalance: { increment: amountBigInt } },
        });
      }

      return { success: true, cached: false, bonusEventId: bonusEvent.id };
    });
  }
}
