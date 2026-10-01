'use server';

import { requireOperatorPermission } from '@/lib/operator/rbac';
import { db } from '@/lib/db';

/**
 * Example operator action fetching dashboard metadata.
 * Guarded by 'orders' section 'view' permission.
 */
export async function getOperatorDashboardData() {
  return requireOperatorPermission('orders', 'view', async (user) => {
    const last30days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const tenantFilter = user.tenantId ? { tenantId: user.tenantId } : {};

    const [activeOrders, openTickets, newClients, transactions] = await Promise.all([
      db.order.count({ where: { status: { in: ['PENDING', 'IN_PROGRESS', 'PROVISIONING'] }, ...tenantFilter } }),
      db.ticket.count({ where: { status: 'OPEN', ...tenantFilter } }),
      db.user.count({ where: { createdAt: { gte: last30days }, ...tenantFilter } }),
      db.payment.count({ where: { status: 'SUCCEEDED', ...tenantFilter } }),
    ]);

    return {
      success: true,
      stats: {
        activeOrders,
        openTickets,
        newClients,
        transactions,
      }
    };
  });
}
