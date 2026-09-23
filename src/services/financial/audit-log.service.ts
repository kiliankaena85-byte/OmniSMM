/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Financial Audit Trail & Security Event Logger
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export interface FinancialAuditLogInput {
  userId: string;
  adminId?: string;
  adminEmail?: string;
  action: 'CHARGE' | 'CREDIT' | 'REFUND' | 'ADMIN_ADJUST' | 'QUARANTINE_HOLD' | 'QUARANTINE_RELEASE';
  amountCents: bigint | number;
  reason: string;
  ipAddress?: string;
  userAgent?: string;
  tenantId?: string;
  metadata?: Record<string, unknown>;
}

export class FinancialAuditLogService {
  /**
   * Records a strictly auditable financial action in AdminAuditLog.
   */
  static async logAction(input: FinancialAuditLogInput, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx || db;
    const amountBigInt = typeof input.amountCents === 'bigint' ? input.amountCents : BigInt(input.amountCents);
    const tenantId = input.tenantId || 'smmplan';

    try {
      await client.adminAuditLog.create({
        data: {
          tenantId,
          adminId: input.adminId || 'SYSTEM',
          adminEmail: input.adminEmail || (input.adminId ? 'admin@smmplan.pro' : 'system@smmplan.pro'),
          action: `FINANCIAL_${input.action}`,
          target: input.userId,
          targetType: 'USER',
          oldValue: null,
          newValue: JSON.stringify({
            amountCents: amountBigInt.toString(),
            reason: input.reason,
            metadata: input.metadata,
            userAgent: input.userAgent
          }),
          ipAddress: input.ipAddress || '127.0.0.1'
        }
      });
    } catch (err) {
      console.error('[FinancialAuditLog] Failed to persist audit log entry:', err);
    }
  }
}
