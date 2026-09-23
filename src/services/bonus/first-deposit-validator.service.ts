/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * First Deposit Bonus Anti-Fraud & Payment Fingerprint Validator.
 */

import { db } from '@/lib/db';
import crypto from 'crypto';

export class FirstDepositValidatorService {
  /**
   * Computes a privacy-preserving payment fingerprint (SHA-256).
   */
  static computeFingerprint(paymentDetails: {
    cardBin?: string;
    cardLast4?: string;
    cryptoAddress?: string;
    payerEmail?: string;
  }): string {
    const raw = `${paymentDetails.cardBin || ''}:${paymentDetails.cardLast4 || ''}:${paymentDetails.cryptoAddress || ''}:${paymentDetails.payerEmail || ''}`;
    return crypto.createHash('sha256').update(raw.trim().toLowerCase()).digest('hex');
  }

  /**
   * Verifies that the payment fingerprint has never received a First Deposit bonus before.
   */
  static async validateFirstDepositBonus(
    userId: string,
    paymentFingerprint: string,
    tenantId?: string
  ): Promise<{ eligible: boolean; reason?: string }> {
    if (!paymentFingerprint) {
      return { eligible: true };
    }

    // 1. Check if user already claimed first deposit bonus
    const userClaimed = await db.bonusRedemptionLog.findFirst({
      where: {
        userId,
        bonusType: 'FIRST_DEPOSIT',
        status: { in: ['GRANTED', 'LOCKED'] },
      },
    });

    if (userClaimed) {
      return { eligible: false, reason: 'USER_ALREADY_CLAIMED_FIRST_DEPOSIT' };
    }

    // 2. Check if another account used this payment fingerprint
    const duplicateFingerprint = await db.bonusRedemptionLog.findFirst({
      where: {
        paymentFingerprint,
        bonusType: 'FIRST_DEPOSIT',
        status: { in: ['GRANTED', 'LOCKED'] },
        userId: { not: userId },
      },
    });

    if (duplicateFingerprint) {
      return { eligible: false, reason: 'DUPLICATE_PAYMENT_METHOD_FINGERPRINT' };
    }

    return { eligible: true };
  }
}
