import { db } from '@/lib/db';

interface ServiceProfitability {
  serviceId: string;
  serviceName: string;
  categoryName: string;
  revenue: number;
  cogs: number;
  profit: number;
  marginPct: number;
  ordersCount: number;
}

interface CategoryProfitability {
  categoryId: string;
  categoryName: string;
  revenue: number;
  cogs: number;
  profit: number;
  marginPct: number;
  ordersCount: number;
}

class AnalyticsService {
  async getServiceProfitability(days: number, tenantId?: string): Promise<ServiceProfitability[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    // Fetch orders with service and category info
    const orders = await db.order.findMany({
      where: {
        createdAt: { gte: cutoff },
        status: { notIn: ['AWAITING_PAYMENT', 'PENDING', 'ERROR'] },
        ...(tenantId ? { tenantId } : {})
      },
      include: {
        service: {
          include: {
            category: true
          }
        }
      }
    });

    const stats: Record<string, ServiceProfitability> = {};

    for (const order of orders) {
      const s = order.service;
      if (!stats[s.id]) {
        stats[s.id] = {
          serviceId: s.id,
          serviceName: s.name,
          categoryName: s.category.name,
          revenue: 0,
          cogs: 0,
          profit: 0,
          marginPct: 0,
          ordersCount: 0
        };
      }

      const item = stats[s.id];
      item.ordersCount++;

      // Revenue calculation (accounting for partials/cancels)
      let revenue = Number(order.charge);
      let cogs = Number(order.providerCost);

      if (order.quantity > 0) {
        const deliveredQty = Math.max(0, order.quantity - order.remains);
        revenue = Math.round((deliveredQty / order.quantity) * Number(order.charge));
        cogs = Math.round((deliveredQty / order.quantity) * Number(order.providerCost));
      } else if (order.status === 'CANCELED') {
        revenue = 0;
        cogs = 0;
      }

      item.revenue += revenue;
      item.cogs += cogs;
    }

    // Finalize stats
    return Object.values(stats).map(item => {
      item.profit = item.revenue - item.cogs;
      item.marginPct = item.revenue > 0 ? (item.profit / item.revenue) * 100 : 0;
      return item;
    }).sort((a, b) => b.profit - a.profit);
  }

  async getCategoryProfitability(days: number, tenantId?: string): Promise<CategoryProfitability[]> {
    const serviceStats = await this.getServiceProfitability(days, tenantId);
    const catStats: Record<string, CategoryProfitability> = {};

    for (const s of serviceStats) {
      const catKey = s.categoryName; 
      if (!catStats[catKey]) {
        catStats[catKey] = {
          categoryId: '',
          categoryName: s.categoryName,
          revenue: 0,
          cogs: 0,
          profit: 0,
          marginPct: 0,
          ordersCount: 0
        };
      }

      const item = catStats[catKey];
      item.revenue += s.revenue;
      item.cogs += s.cogs;
      item.profit += s.profit;
      item.ordersCount += s.ordersCount;
    }

    return Object.values(catStats).map(item => {
      item.marginPct = item.revenue > 0 ? (item.profit / item.revenue) * 100 : 0;
      return item;
    }).sort((a, b) => b.profit - a.profit);
  }

  async getLTVAnalytics(tenantId?: string) {
    const userFilter = {
      role: 'USER' as const,
      ...(tenantId ? { tenantId } : {})
    };
    const totalUsers = await db.user.count({ where: userFilter });
    const users = await db.user.findMany({
      where: userFilter,
      select: { totalSpent: true },
      orderBy: { totalSpent: 'desc' }
    });

    if (users.length === 0) return { 
      totalUsers: 0, 
      top10PercentShare: 0, 
      buckets: [] 
    };

    const totalRevenue = users.reduce((sum, u) => sum + Number(u.totalSpent), 0);
    const top10Count = Math.max(1, Math.floor(users.length * 0.1));
    const top10Revenue = users.slice(0, top10Count).reduce((sum, u) => sum + Number(u.totalSpent), 0);

    const top10PercentShare = totalRevenue > 0 ? (top10Revenue / totalRevenue) * 100 : 0;

    // LTV Buckets (in RUB)
    const bucketRanges = [
      { label: '0 ₽', max: 1 },
      { label: '1-500 ₽', max: 50000 },
      { label: '500-2k ₽', max: 200000 },
      { label: '2k-10k ₽', max: 1000000 },
      { label: '10k-50k ₽', max: 5000000 },
      { label: '50k+ ₽', max: Infinity },
    ];

    const buckets = bucketRanges.map(range => ({
      label: range.label,
      count: 0
    }));

    users.forEach(u => {
      const spent = Number(u.totalSpent);
      for (let i = 0; i < bucketRanges.length; i++) {
        if (spent < bucketRanges[i].max) {
          buckets[i].count++;
          break;
        }
      }
    });

    return {
      totalUsers,
      top10PercentShare,
      buckets
    };
  }
}

export const analyticsService = new AnalyticsService();
