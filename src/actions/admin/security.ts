'use server';

import { requireStaffPermission } from '@/lib/server/rbac';
import { SecurityAlertService } from '@/services/security/security-alert.service';

export interface SecurityEventFilter {
  limit?: number;
  offset?: number;
  severity?: string;
  event?: string;
  ip?: string;
  tenantId?: string;
}

export async function getSecurityEventsAction(filters?: SecurityEventFilter) {
  const res = await requireStaffPermission('settings', 'view', async () => {
    const data = await SecurityAlertService.getRecentEvents(filters);
    return { success: true as const, ...data };
  });

  if ('success' in res && res.success === false) {
    return { success: false as const, error: 'Доступ запрещен', events: [], total: 0 };
  }
  return res;
}

export async function getSecurityStatsAction() {
  const fallbackStats = {
    total24h: 0,
    critical24h: 0,
    high24h: 0,
    warning24h: 0,
    uniqueIpsCount: 0,
    topEvents: [],
    topIps: []
  };

  const res = await requireStaffPermission('settings', 'view', async () => {
    const stats = await SecurityAlertService.getSecurityDashboardStats();
    return { success: true as const, stats };
  });

  if ('success' in res && res.success === false) {
    return { success: false as const, error: 'Доступ запрещен', stats: fallbackStats };
  }
  return res;
}
