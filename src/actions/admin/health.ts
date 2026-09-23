'use server';

import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { ordersQueue } from '@/lib/queue-manager';
import { requireStaffPermission } from '@/lib/server/rbac';

export interface SystemHealthReport {
  timestamp: string;
  database: {
    status: 'connected' | 'error';
    latencyMs: number;
  };
  redis: {
    status: 'connected' | 'error';
    latencyMs: number;
  };
  worker: {
    status: 'alive' | 'stale' | 'not_running';
    lastSeenSeconds: number | null;
  };
  queues: {
    waitingOrders: number;
  };
  stuckOrders: {
    pendingOlderThan15m: number;
  };
  catalog: {
    activeServicesCount: number;
    quarantinedServicesCount: number;
  };
  users: {
    totalBalanceRub: number;
  };
}

export async function getSystemHealthReportAction(): Promise<{ success: boolean; data?: SystemHealthReport; error?: string }> {
  return requireStaffPermission('settings', 'view', async (admin) => {
    try {
      const now = Date.now();
      const tenantFilter = admin.tenantId ? { tenantId: admin.tenantId } : {};

      // 1. PostgreSQL Check
      let dbStatus: 'connected' | 'error' = 'error';
      let dbLatencyMs = 0;
      try {
        const dbStart = Date.now();
        await db.$queryRaw`SELECT 1`;
        dbLatencyMs = Date.now() - dbStart;
        dbStatus = 'connected';
      } catch (e) {
        console.error('Database ping error:', e);
      }

      // 2. Redis Check
      let redisStatus: 'connected' | 'error' = 'error';
      let redisLatencyMs = 0;
      try {
        const redisStart = Date.now();
        await redis.ping();
        redisLatencyMs = Date.now() - redisStart;
        redisStatus = 'connected';
      } catch (e) {
        console.error('Redis ping error:', e);
      }

      // 3. Worker Heartbeat
      let workerStatus: 'alive' | 'stale' | 'not_running' = 'not_running';
      let lastSeenSeconds: number | null = null;
      try {
        const lastHeartbeat = await redis.get('worker:heartbeat');
        if (lastHeartbeat) {
          lastSeenSeconds = Math.round((now - parseInt(lastHeartbeat, 10)) / 1000);
          if (lastSeenSeconds < 30) {
            workerStatus = 'alive';
          } else {
            workerStatus = 'stale';
          }
        }
      } catch (e) {
        console.error('Worker heartbeat error:', e);
      }

      // 4. Queue Depth
      let waitingOrders = 0;
      if (redisStatus === 'connected') {
        try {
          waitingOrders = await ordersQueue.getWaitingCount();
        } catch {
          waitingOrders = 0;
        }
      }

      // 5. Stuck Orders (> 15 min)
      const fifteenMinsAgo = new Date(now - 15 * 60 * 1000);
      const pendingOlderThan15m = await db.order.count({
        where: {
          status: 'PENDING',
          createdAt: { lt: fifteenMinsAgo },
          ...tenantFilter
        }
      });

      // 6. Catalog Stats
      const [activeServicesCount, quarantinedServicesCount] = await Promise.all([
        db.service.count({ where: { isActive: true, ...tenantFilter } }),
        db.service.count({ where: { isQuarantined: true, ...tenantFilter } })
      ]);

      // 7. Total User Balance
      const totalBalanceAgg = await db.user.aggregate({
        where: tenantFilter,
        _sum: { balance: true }
      });
      const totalBalanceRub = Number(totalBalanceAgg._sum.balance || 0) / 100;

      return {
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          database: { status: dbStatus, latencyMs: dbLatencyMs },
          redis: { status: redisStatus, latencyMs: redisLatencyMs },
          worker: { status: workerStatus, lastSeenSeconds },
          queues: { waitingOrders },
          stuckOrders: { pendingOlderThan15m },
          catalog: { activeServicesCount, quarantinedServicesCount },
          users: { totalBalanceRub }
        }
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка мониторинга';
      return { success: false, error: errorMessage };
    }
  });
}
