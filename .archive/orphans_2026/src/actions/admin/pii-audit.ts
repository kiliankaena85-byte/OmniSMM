'use server';

import { db } from '@/lib/db';
import { requireStaffPermission } from '@/lib/server/rbac';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'PiiAuditAction' });

export interface PiiAccessLogFilter {
  limit?: number;
  offset?: number;
  staffEmail?: string;
  targetType?: string;
  targetId?: string;
}

export async function getPiiAccessLogsAction(filter: PiiAccessLogFilter = {}) {
  return requireStaffPermission('settings', 'view', async () => {
    try {
      const limit = Math.min(100, Math.max(1, filter.limit || 50));
      const offset = Math.max(0, filter.offset || 0);

      const where: Record<string, unknown> = {};
      if (filter.staffEmail) {
        where.staffEmail = { contains: filter.staffEmail, mode: 'insensitive' };
      }
      if (filter.targetType) {
        where.targetType = filter.targetType;
      }
      if (filter.targetId) {
        where.targetId = filter.targetId;
      }

      const [logs, total] = await Promise.all([
        db.piiAccessLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        db.piiAccessLog.count({ where }),
      ]);

      return { success: true, logs, total };
    } catch (err) {
      log.error('Failed to get PII access logs', { error: err });
      return { success: false, logs: [], total: 0, error: 'Ошибка запроса логов' };
    }
  });
}

