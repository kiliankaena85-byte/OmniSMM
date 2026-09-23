/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * GDPR (Art. 17 Right to be Forgotten) & 152-ФЗ Account Deletion & Anonymization.
 */

import { db } from '@/lib/db';
import crypto from 'crypto';

export class AccountDeletionService {
  /**
   * Anonymizes and soft-deletes a user account.
   * - Anonymizes email and PII fields.
   * - Retains LedgerEntry and Order records for 5-year financial compliance.
   * - Revokes all active sessions, auth tokens and API keys.
   * - Records immutable audit trail.
   */
  static async anonymizeAndDeleteAccount(
    userId: string,
    opts?: { tenantId?: string; reason?: string; operatorEmail?: string }
  ): Promise<{ success: boolean; anonymizedId: string }> {
    const suffix = crypto.randomBytes(4).toString('hex');
    const anonymizedEmail = `deleted_${userId.slice(0, 8)}_${suffix}@anonymous.local`;

    return await db.$transaction(async (tx) => {
      // 1. Verify user exists and check tenant isolation
      const user = await tx.user.findFirst({
        where: {
          id: userId,
          ...(opts?.tenantId ? { tenantId: opts.tenantId } : {}),
        },
        select: { id: true, email: true, tenantId: true, isDeleted: true },
      });

      if (!user) {
        throw new Error(`User ${userId} not found or tenant access forbidden`);
      }

      if (user.isDeleted) {
        return { success: true, anonymizedId: user.id };
      }

      // 2. Anonymize user PII and set isDeleted = true
      await tx.user.update({
        where: { id: userId },
        data: {
          email: anonymizedEmail,
          passwordHash: null,
          telegramId: null,
          phoneHash: null,
          apiKeyHash: null,
          referralCode: null,
          referredById: null,
          companyName: null,
          inn: null,
          kpp: null,
          ogrn: null,
          legalAddress: null,
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: [],
          geminiApiKey: null,
          isActive: false,
          isDeleted: true,
        },
      });

      // 3. Revoke all active sessions and auth tokens
      await tx.session.deleteMany({ where: { userId } });
      await tx.authToken.deleteMany({ where: { userId } });

      // 4. Log immutable deletion audit event
      await tx.auditLog.create({
        data: {
          userId,
          action: 'GDPR_RIGHT_TO_BE_FORGOTTEN',
          details: JSON.stringify({
            reason: opts?.reason || 'User requested account deletion (GDPR Art. 17 / 152-FZ)',
            originalEmailMasked: user.email.slice(0, 3) + '••••@••••',
            anonymizedEmail,
            operator: opts?.operatorEmail || 'SELF_SERVICE',
            timestamp: new Date().toISOString(),
          }),
        },
      });

      return { success: true, anonymizedId: userId };
    });
  }
}
