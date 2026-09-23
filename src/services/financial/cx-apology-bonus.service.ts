import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { CxCompensationGateService } from './cx-compensation-gate.service';

const log = logger.child({ component: 'CxApologyBonusService' });

export interface ApologyGrantResult {
  success: boolean;
  grantedAmountCents: bigint;
  userId: string;
  orderId: string;
  error?: string;
}

export class CxApologyBonusService {
  /**
   * Safely grants a strictly non-withdrawable promotional/apology bonus to User.bonusBalance.
   * Enforces Ledger-First and 5-point anti-fraud screening.
   */
  public static async grantApologyBonus(
    userId: string,
    orderId: string,
    amountCents: bigint,
    reason: string
  ): Promise<ApologyGrantResult> {
    const gateCheck = await CxCompensationGateService.evaluateCompensationEligibility(userId, amountCents);
    if (!gateCheck.allowed) {
      log.warn(`[Compensation Rejected] User ${userId}, Order ${orderId}: ${gateCheck.rejectionReason}`);
      return {
        success: false,
        grantedAmountCents: BigInt(0),
        userId,
        orderId,
        error: gateCheck.rejectionReason,
      };
    }

    try {
      await db.$transaction(async (tx) => {
        // 1. Fetch user
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true, balance: true, bonusBalance: true, tenantId: true },
        });

        if (!user) {
          throw new Error(`User ${userId} not found`);
        }

        const newBonusBalance = BigInt(user.bonusBalance || 0) + amountCents;

        // 2. Ledger-First Entry
        await tx.ledgerEntry.create({
          data: {
            userId: user.id,
            tenantId: user.tenantId || 'smmplan',
            transactionType: 'COMPENSATION',
            amount: amountCents,
            reason: `Sentinel AI CX Apology: ${reason} (Order #${orderId.slice(-6)})`,
            status: 'APPROVED',
          },
        });

        // 3. Update User bonusBalance
        await tx.user.update({
          where: { id: user.id },
          data: {
            bonusBalance: newBonusBalance,
          },
        });

        // 4. Record Compensation log
        await tx.cxApologyCompensation.create({
          data: {
            userId: user.id,
            orderId,
            amountCents,
            reason,
            status: 'GRANTED',
          },
        });
      });

      log.info(`[Compensation GRANTED] ${Number(amountCents) / 100} RUB bonus credited to User ${userId}`);

      return {
        success: true,
        grantedAmountCents: amountCents,
        userId,
        orderId,
      };
    } catch (err) {
      log.error(`[Compensation FAILED] User ${userId}: ${(err as Error).message}`);
      return {
        success: false,
        grantedAmountCents: BigInt(0),
        userId,
        orderId,
        error: (err as Error).message,
      };
    }
  }
}
