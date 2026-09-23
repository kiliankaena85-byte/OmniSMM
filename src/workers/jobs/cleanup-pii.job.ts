/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Automated Data Retention & PII Cleanup Job (152-ФЗ & GDPR Retention Policy).
 *
 * Retention Rules:
 * - General access and security logs: purged after 365 days (1 year).
 * - Financial Ledgers (LedgerEntry, Payment records): STRICTLY RETAINED FOR 5 YEARS (Law requirement).
 */

import { db } from '@/lib/db';

export class DataRetentionJob {
  static async cleanupExpiredPiiLogs(retentionDays: number = 365): Promise<{ deletedAuditLogs: number; deletedSecurityLogs: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    let deletedAuditLogs = 0;
    let deletedSecurityLogs = 0;

    try {
      // 1. Purge general audit logs older than retention period (excluding legal/financial actions)
      const auditResult = await db.auditLog.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
          action: { notIn: ['GDPR_RIGHT_TO_BE_FORGOTTEN', 'FINANCIAL_TRANSACTION'] },
        },
      });
      deletedAuditLogs = auditResult.count;

      // 2. Purge old security events
      const secResult = await db.securityEvent.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
          severity: { in: ['INFO', 'LOW'] },
        },
      });
      deletedSecurityLogs = secResult.count;

      console.info(`[DataRetention] Purged ${deletedAuditLogs} old audit logs and ${deletedSecurityLogs} security events older than ${retentionDays} days.`);
    } catch (err) {
      console.error('[DataRetention] Failed to run PII cleanup job:', err);
    }

    return { deletedAuditLogs, deletedSecurityLogs };
  }
}
