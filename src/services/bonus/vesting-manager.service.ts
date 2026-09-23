/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Vesting Manager (72-hour Bonus Hold, Early Approval & Confiscation).
 */

import { db } from '@/lib/db';
import { runSerializableTransaction } from '@/lib/transactions';
import { WalletOps } from '@/services/financial/wallet-ops';

export class VestingManagerService {
  /**
   * Releases matured vested bonuses (72h hold expired).
   */
  static async releaseMaturedBonuses(): Promise<number> {
    const now = new Date();
    const maturedLogs = await db.bonusRedemptionLog.findMany({
      where: {
        status: 'LOCKED',
        unlockAt: { lte: now },
      },
    });

    let releasedCount = 0;

    for (const log of maturedLogs) {
      try {
        await runSerializableTransaction(async (tx) => {
          // Unlock bonus
          await tx.bonusRedemptionLog.update({
            where: { id: log.id },
            data: { status: 'GRANTED' },
          });

          // Decrement quarantine and credit main balance
          await tx.user.update({
            where: { id: log.userId },
            data: { quarantineBalance: { decrement: log.amountCents } },
          });

          await WalletOps.credit(tx, log.userId, log.amountCents, `Разблокировка бонуса: ${log.reason || log.bonusType}`, {
            idempotencyKey: `vesting-release-${log.id}`,
            tenantId: log.tenantId || 'smmplan',
          });
        });
        releasedCount++;
      } catch (err) {
        console.error(`[VestingManager] Failed to release bonus log ${log.id}:`, err);
      }
    }

    return releasedCount;
  }

  /**
   * Operator early approval of a locked bonus.
   */
  static async approveEarly(bonusLogId: string, adminId?: string): Promise<{ success: boolean }> {
    const log = await db.bonusRedemptionLog.findUnique({ where: { id: bonusLogId } });
    if (!log || log.status !== 'LOCKED') {
      throw new Error('Bonus log not found or already processed');
    }

    return await runSerializableTransaction(async (tx) => {
      await tx.bonusRedemptionLog.update({
        where: { id: bonusLogId },
        data: { status: 'GRANTED', unlockAt: new Date() },
      });

      await tx.user.update({
        where: { id: log.userId },
        data: { quarantineBalance: { decrement: log.amountCents } },
      });

      await WalletOps.credit(tx, log.userId, log.amountCents, `Досрочное одобрение бонуса админом: ${log.bonusType}`, {
        idempotencyKey: `vesting-early-${log.id}`,
        adminId,
        tenantId: log.tenantId || 'smmplan',
      });

      return { success: true };
    });
  }

  /**
   * Confiscates a fraudulent locked bonus.
   */
  static async confiscateBonus(bonusLogId: string, reason: string, adminId?: string): Promise<{ success: boolean }> {
    const log = await db.bonusRedemptionLog.findUnique({ where: { id: bonusLogId } });
    if (!log || log.status !== 'LOCKED') {
      throw new Error('Bonus log not found or already processed');
    }

    return await runSerializableTransaction(async (tx) => {
      await tx.bonusRedemptionLog.update({
        where: { id: bonusLogId },
        data: { status: 'CONFISCATED', reason: `Конфисковано: ${reason}` },
      });

      // Clear quarantine balance
      await tx.user.update({
        where: { id: log.userId },
        data: { quarantineBalance: { decrement: log.amountCents } },
      });

      await tx.adminAuditLog.create({
        data: {
          tenantId: log.tenantId || 'smmplan',
          adminId: adminId || 'SYSTEM',
          adminEmail: 'admin@smmplan.pro',
          action: 'BONUS_CONFISCATED',
          target: log.userId,
          targetType: 'USER',
          oldValue: null,
          newValue: JSON.stringify({ bonusLogId, amountCents: log.amountCents.toString(), reason }),
          ipAddress: '127.0.0.1',
        },
      });

      return { success: true };
    });
  }
}
