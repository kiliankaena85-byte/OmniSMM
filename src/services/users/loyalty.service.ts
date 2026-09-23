import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

export class LoyaltyService {
  /**
   * Retrieves the current referral percentage for a user based on REFERRAL_TIERS.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static async getReferralPercent(userId: string, projectId?: string): Promise<number> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { 
        totalSpent: true, 
        createdAt: true,
        _count: { select: { referrals: true } }
      }
    });

    if (!user) return 5;

    // Pioneer Boost (First 30 days of platform launch):
    const isPioneer = user.createdAt.getTime() < new Date('2026-05-01').getTime();
    if (isPioneer) return 20;

    const referralsCount = user._count?.referrals ?? 0;
    const totalSpentRub = Number(user.totalSpent) / 100;

    // Aligned with 4-tier progression:
    // Tier 4: VIP Лидер (25+ refs or 50,000+ RUB) -> 15%
    if (referralsCount >= 25 || totalSpentRub >= 50000) return 15;
    // Tier 3: Профи (10+ refs or 30,000+ RUB) -> 10%
    if (referralsCount >= 10 || totalSpentRub >= 30000) return 10;
    // Tier 2: Партнёр (3+ refs or 10,000+ RUB) -> 7%
    if (referralsCount >= 3 || totalSpentRub >= 10000) return 7;

    // Tier 1: Старт -> 5%
    return 5;
  }

  /**
   * Awards a commission to the referrer when a referred user makes a deposit.
   * Safe to run inside an existing PostgreSQL transaction.
   */
  static async awardCommission(tx: Prisma.TransactionClient, referredUserId: string, depositAmountCents: number, orderId: string): Promise<void> {
    const user = await tx.user.findUnique({
      where: { id: referredUserId },
      select: { referredById: true }
    });

    if (!user || !user.referredById) return;

    // Cycle protection: Check if the referrer was referred by the current user (Cyclic loop attack)
    const referrer = await tx.user.findUnique({
      where: { id: user.referredById },
      select: { referredById: true, isActive: true, isDeleted: true }
    });

    if (!referrer) return;

    if (referrer.isDeleted || !referrer.isActive) {
      return;
    }

    if (referrer.referredById === referredUserId) {
        console.warn(`[SECURITY] Cyclic referral detected between ${referredUserId} and ${user.referredById}. Commission rejected.`);
        return;
    }

    const percent = await this.getReferralPercent(user.referredById);
    
    const commissionCents = Math.round((depositAmountCents * percent) / 100);
    if (commissionCents <= 0) return;

    // Idempotent check: prevent duplicate commissions for the same order and referrer
    const existingComm = await tx.commission.findFirst({
      where: { orderId, referrerId: user.referredById }
    });
    if (existingComm) return;

    // Create pending commission record
    await tx.commission.create({
      data: {
        orderId,
        referrerId: user.referredById,
        amount: commissionCents,
        status: 'PENDING'
      }
    });

    // Log the event for the user - status pending, balance not credited yet
    await tx.auditLog.create({
      data: {
        userId: user.referredById,
        action: 'REFERRAL_PENDING',
        details: `Ожидается комиссия ${percent}% (${commissionCents / 100} руб) за пополнение от привлеченного пользователя.`
      }
    });
  }

  /**
   * Confirms a pending commission when an order completes.
   * Moves it from PENDING to CONFIRMED.
   */
    static async confirmCommission(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
    const commissions = await tx.commission.findMany({
      where: { orderId, status: 'PENDING' }
    });

    for (const comm of commissions) {
      await tx.commission.update({
        where: { id: comm.id },
        data: { status: 'CONFIRMED' }
      });

      // Increment referrer's referral balance ONLY upon confirmation
      await tx.user.update({
        where: { id: comm.referrerId },
        data: { referralBalance: { increment: Number(comm.amount) } }
      });

      await tx.auditLog.create({
        data: {
          userId: comm.referrerId,
          action: 'REFERRAL_CONFIRMED',
          details: `Комиссия за заказ подтверждена и начислена: ${(Number(comm.amount) / 100).toFixed(2)} руб.`
        }
      });
    }
  }

  /**
   * Partially confirms a commission proportional to the delivered quantity.
   */
    static async handlePartialCommission(tx: Prisma.TransactionClient, orderId: string, remains: number, quantity: number): Promise<void> {
    const commissions = await tx.commission.findMany({
      where: { orderId, status: 'PENDING' }
    });

    for (const comm of commissions) {
      if (quantity <= 0 || remains >= quantity) {
        // If nothing was delivered or invalid numbers, reverse the entire pending commission
        await tx.commission.update({
          where: { id: comm.id },
          data: { status: 'REVERSED' }
        });
        
        await tx.auditLog.create({
          data: {
            userId: comm.referrerId,
            action: 'REFERRAL_REVERSED',
            details: `Комиссия отозвана полностью (0 выполненных запусков).`
          }
        });
        continue;
      }

      const originalAmount = Number(comm.amount);
      const confirmedAmount = Math.round((originalAmount * (quantity - remains)) / quantity);

      if (confirmedAmount > 0) {
        await tx.commission.update({
          where: { id: comm.id },
          data: { 
            status: 'CONFIRMED',
            amount: confirmedAmount
          }
        });

        // Increment balance by the partial confirmed amount
        await tx.user.update({
          where: { id: comm.referrerId },
          data: { referralBalance: { increment: confirmedAmount } }
        });

        await tx.auditLog.create({
          data: {
            userId: comm.referrerId,
            action: 'REFERRAL_CONFIRMED',
            details: `Комиссия за заказ подтверждена частично: ${confirmedAmount / 100} руб (оригинальная сумма: ${originalAmount / 100} руб).`
          }
        });
      } else {
        await tx.commission.update({
          where: { id: comm.id },
          data: { status: 'REVERSED' }
        });
      }
    }
  }

  /**
   * Reverses a pending or confirmed commission if the order fails.
   * Moves it to REVERSED and decrements referralBalance only if it was confirmed.
   */
    static async reverseCommission(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
    const commissions = await tx.commission.findMany({
      where: { orderId, status: { in: ['PENDING', 'CONFIRMED'] } }
    });

    for (const comm of commissions) {
      const wasConfirmed = comm.status === 'CONFIRMED';

      await tx.commission.update({
        where: { id: comm.id },
        data: { status: 'REVERSED' }
      });
      
      // Only withdraw if it was already credited to the spendable balance
      if (wasConfirmed) {
        await tx.user.update({
          where: { id: comm.referrerId },
          data: { referralBalance: { decrement: Number(comm.amount) } }
        });
      }

      await tx.auditLog.create({
        data: {
          userId: comm.referrerId,
          action: 'REFERRAL_REVERSED',
          details: `Комиссия отозвана из-за отмены/ошибки заказа.`
        }
      });
    }
  }
}
