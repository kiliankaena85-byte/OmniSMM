'use server';

import { db } from '@/lib/db';
import { requireStaffPermission } from '@/lib/server/rbac';
import { SystemLogsFilterSchema } from '@/types/system-logs.dto';
import {
  fetchSecurityLogs,
  fetchLoginLogs,
  fetchAuditLogs,
  fetchTelegramLogs,
} from './system-logs-fetchers';

export async function getSystemLogs(rawFilter: unknown) {
  const parsed = SystemLogsFilterSchema.safeParse(rawFilter ?? {});
  if (!parsed.success) {
    return { success: false as const, error: 'Неверные параметры запроса логов' };
  }

  const filter = parsed.data;

  return requireStaffPermission('SETTINGS', 'view', async (user, _role, sessionTenantId) => {
    try {
      const activeTenant = filter.tenantId || sessionTenantId || 'smmplan';
      const tenantCondition = user.role === 'OWNER' && filter.tenantId === 'all'
        ? {}
        : { tenantId: activeTenant };

      const skip = (filter.page - 1) * filter.pageSize;
      const take = filter.pageSize;

      // Parallel fetch counts for top stat cards
      const [secCount, failedLoginsCount, auditCount, tgCount] = await Promise.all([
        db.securityEvent.count({ where: tenantCondition }),
        db.loginLog.count({ where: { ...tenantCondition, success: false } }),
        db.adminAuditLog.count({ where: tenantCondition }),
        db.telegramErrorLog.count({ where: tenantCondition }),
      ]);

      const stats = {
        securityCount: secCount,
        failedLoginsCount,
        auditCount,
        telegramErrorsCount: tgCount,
      };

      if (filter.category === 'security') {
        const data = await fetchSecurityLogs(filter, tenantCondition, skip, take, stats);
        return { success: true as const, data };
      }

      if (filter.category === 'logins') {
        const data = await fetchLoginLogs(filter, tenantCondition, skip, take, stats);
        return { success: true as const, data };
      }

      if (filter.category === 'audit') {
        const data = await fetchAuditLogs(filter, tenantCondition, skip, take, stats);
        return { success: true as const, data };
      }

      // Default: telegram
      const data = await fetchTelegramLogs(filter, tenantCondition, skip, take, stats);
      return { success: true as const, data };
    } catch (err: unknown) {
      console.error('[getSystemLogs] Internal error:', err);
      return { success: false as const, error: 'Ошибка загрузки системных логов' };
    }
  });
}
