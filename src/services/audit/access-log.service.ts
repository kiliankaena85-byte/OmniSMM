/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * PII Access Logger (152-ФЗ & GDPR Operator Audit Trail).
 */

import { db } from '@/lib/db';

export interface PiiAccessLogInput {
  adminId: string;
  adminEmail?: string;
  targetUserId: string;
  action: 'VIEW_PROFILE' | 'VIEW_ORDERS' | 'VIEW_FINANCES' | 'EXPORT_DATA';
  fieldsAccessed: string[];
  ipAddress?: string;
  userAgent?: string;
  tenantId?: string;
}

export class PiiAccessLogService {
  /**
   * Records operator access to sensitive personal data for compliance auditing.
   */
  static async logAccess(input: PiiAccessLogInput): Promise<void> {
    try {
      await db.adminAuditLog.create({
        data: {
          tenantId: input.tenantId || 'smmplan',
          adminId: input.adminId,
          adminEmail: input.adminEmail || 'admin@smmplan.pro',
          action: `PII_ACCESS_${input.action}`,
          target: input.targetUserId,
          targetType: 'USER_PII',
          oldValue: null,
          newValue: JSON.stringify({
            fieldsAccessed: input.fieldsAccessed,
            userAgent: input.userAgent || 'system',
            timestamp: new Date().toISOString(),
          }),
          ipAddress: input.ipAddress || '127.0.0.1',
        },
      });
    } catch (err) {
      console.error('[PiiAccessLog] Failed to log PII access:', err);
    }
  }
}
