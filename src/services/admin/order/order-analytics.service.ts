import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { OrderFailureStatsService } from './order-failure-stats.service';

export class OrderAnalyticsService {
  private static statsCache = new Map<
    string,
    {
      data: {
        total: number;
        pending: number;
        inProgress: number;
        completed: number;
        error: number;
        partial: number;
        canceled: number;
        awaitingPayment: number;
      };
      expiresAt: number;
    }
  >();

  /**
   * Retrieves order stats using a single high-performance groupBy query with 15s cache.
   */
  static async getOrderStats(startDate?: Date, endDate?: Date, tenantId?: string) {
    const cacheKey = `${startDate?.toISOString() || 'all'}_${endDate?.toISOString() || 'all'}_${tenantId || 'all'}`;
    const cached = OrderAnalyticsService.statsCache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const where: Prisma.OrderWhereInput = {};
    if (startDate && endDate) where.createdAt = { gte: startDate, lte: endDate };
    if (tenantId && tenantId !== 'all') where.tenantId = tenantId;

    const statusGroups = await db.order.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });

    let total = 0;
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let error = 0;
    let partial = 0;
    let canceled = 0;
    let awaitingPayment = 0;

    for (const group of statusGroups) {
      const count = group._count._all;
      total += count;
      if (group.status === 'PENDING') pending += count;
      else if (group.status === 'IN_PROGRESS') inProgress += count;
      else if (group.status === 'COMPLETED') completed += count;
      else if (group.status === 'ERROR') error += count;
      else if (group.status === 'PARTIAL') partial += count;
      else if (group.status === 'CANCELED') canceled += count;
      else if (group.status === 'AWAITING_PAYMENT') awaitingPayment += count;
    }

    const result = { total, pending, inProgress, completed, error, partial, canceled, awaitingPayment };
    OrderAnalyticsService.statsCache.set(cacheKey, { data: result, expiresAt: now + 15000 });
    return result;
  }

  /**
   * Get recent live orders for dashboard feed
   */
  static async getRecentOrders(limit = 6, tenantId?: string) {
    const isSingleTenant = tenantId && tenantId !== 'all';
    return db.order.findMany({
      where: isSingleTenant ? { tenantId } : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, email: true } },
        service: {
          select: {
            id: true,
            name: true,
            category: {
              select: {
                name: true,
                network: { select: { name: true, slug: true } },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get top services by volume and revenue for analytics
   */
  static async getTopServices(limit = 6, startDate?: Date, endDate?: Date, tenantId?: string) {
    const isSingleTenant = tenantId && tenantId !== 'all';
    const where: Prisma.OrderWhereInput = {};
    if (startDate && endDate) where.createdAt = { gte: startDate, lte: endDate };
    if (isSingleTenant) where.tenantId = tenantId;

    const orders = await db.order.findMany({
      where,
      select: {
        charge: true,
        providerCost: true,
        service: {
          select: {
            id: true,
            name: true,
            category: { select: { name: true, network: { select: { name: true } } } },
          },
        },
      },
    });

    const map = new Map<
      string,
      {
        id: string;
        name: string;
        networkName: string;
        categoryName: string;
        ordersCount: number;
        revenueKopecks: bigint;
        costKopecks: bigint;
        profitKopecks: bigint;
      }
    >();

    for (const o of orders) {
      const s = o.service;
      if (!s) continue;
      const existing = map.get(s.id) || {
        id: s.id,
        name: s.name,
        networkName: s.category?.network?.name || '—',
        categoryName: s.category?.name || '—',
        ordersCount: 0,
        revenueKopecks: BigInt(0),
        costKopecks: BigInt(0),
        profitKopecks: BigInt(0),
      };

      existing.ordersCount += 1;
      existing.revenueKopecks += BigInt(o.charge);
      existing.costKopecks += BigInt(o.providerCost || 0);
      existing.profitKopecks = existing.revenueKopecks - existing.costKopecks;
      map.set(s.id, existing);
    }

    const list = Array.from(map.values()).map((item) => {
      const rev = Number(item.revenueKopecks);
      const profit = Number(item.profitKopecks);
      const marginPct = rev > 0 ? Math.round((profit / rev) * 100) : 0;
      return { ...item, marginPct };
    });

    list.sort((a, b) => Number(b.revenueKopecks - a.revenueKopecks));
    return list.slice(0, limit);
  }

  /**
   * Get refund and failure monitoring stats
   */
  static async getRefundAndFailureStats(startDate?: Date, endDate?: Date, tenantId?: string) {
    return OrderFailureStatsService.getRefundAndFailureStats(startDate, endDate, tenantId);
  }
}
