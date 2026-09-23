import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'CxCompensationGate' });

export interface FraudGateCheckResult {
  allowed: boolean;
  rejectionReason?: string;
}

export class CxCompensationGateService {
  private static readonly MAX_DAILY_BONUS_CENTS = BigInt(5000); // 50.00 RUB max per day
  private static readonly MIN_ACCOUNT_AGE_HOURS = 72; // Account must be at least 3 days old
  private static readonly MIN_HISTORICAL_DEPOSIT_CENTS = BigInt(30000); // Must have deposited at least 300.00 RUB
  private static readonly MAX_BONUSES_PER_72H = 2;

  /**
   * 5-point Anti-Fraud Gate for Automatic CX Apology Compensations.
   */
  public static async evaluateCompensationEligibility(
    userId: string,
    requestedAmountCents: bigint
  ): Promise<FraudGateCheckResult> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        createdAt: true,
        payments: {
          where: { status: 'SUCCEEDED' },
          select: { amount: true },
        },
        cxCompensations: {
          where: {
            createdAt: { gte: new Date(Date.now() - 72 * 60 * 60 * 1000) },
          },
          select: { amountCents: true, createdAt: true },
        },
      },
    });

    if (!user) {
      return { allowed: false, rejectionReason: 'User not found' };
    }

    // 1. Account Age Check (>= 72 hours)
    const accountAgeHours = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60);
    if (accountAgeHours < this.MIN_ACCOUNT_AGE_HOURS) {
      return {
        allowed: false,
        rejectionReason: `Account age (${accountAgeHours.toFixed(1)}h) is below required ${this.MIN_ACCOUNT_AGE_HOURS}h threshold`,
      };
    }

    // 2. Total Historical Deposit Check (>= 300 RUB)
    const totalDeposited = user.payments.reduce((acc, p) => acc + BigInt(p.amount), BigInt(0));
    if (totalDeposited < this.MIN_HISTORICAL_DEPOSIT_CENTS) {
      return {
        allowed: false,
        rejectionReason: `Total lifetime deposit (${Number(totalDeposited) / 100} RUB) is below required ${
          Number(this.MIN_HISTORICAL_DEPOSIT_CENTS) / 100
        } RUB minimum`,
      };
    }

    // 3. Compensation Frequency Check (<= 2 in 72h)
    if (user.cxCompensations.length >= this.MAX_BONUSES_PER_72H) {
      return {
        allowed: false,
        rejectionReason: `Exceeded maximum of ${this.MAX_BONUSES_PER_72H} compensation grants in 72h window`,
      };
    }

    // 4. Daily Volume Cap Check (<= 50 RUB in 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last24hCompensations = user.cxCompensations.filter((c) => c.createdAt >= oneDayAgo);
    const sum24h = last24hCompensations.reduce((acc, c) => acc + BigInt(c.amountCents), BigInt(0));

    if (sum24h + requestedAmountCents > this.MAX_DAILY_BONUS_CENTS) {
      return {
        allowed: false,
        rejectionReason: `Requested bonus breaches daily ceiling of ${Number(this.MAX_DAILY_BONUS_CENTS) / 100} RUB`,
      };
    }

    // 5. Hard Single-Transaction Cap
    if (requestedAmountCents > this.MAX_DAILY_BONUS_CENTS) {
      return { allowed: false, rejectionReason: 'Single compensation exceeds allowable cap' };
    }

    return { allowed: true };
  }
}
