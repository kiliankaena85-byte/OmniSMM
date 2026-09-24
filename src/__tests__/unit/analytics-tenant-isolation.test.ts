import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyticsService } from '@/services/admin/analytics.service';
import { OrderAnalyticsService } from '@/services/admin/order/order-analytics.service';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    order: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe('Admin Analytics Multi-Tenant Isolation Unit Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.order.findMany).mockResolvedValue([]);
    vi.mocked(db.order.groupBy).mockResolvedValue([]);
    vi.mocked(db.user.count).mockResolvedValue(0);
    vi.mocked(db.user.findMany).mockResolvedValue([]);
  });

  it('AnalyticsService.getServiceProfitability strictly scopes queries to resolved tenantId', async () => {
    await analyticsService.getServiceProfitability(30, 'flux');

    expect(db.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'flux',
        }),
      })
    );
  });

  it('AnalyticsService.getServiceProfitability defaults to smmplan when tenantId is omitted', async () => {
    await analyticsService.getServiceProfitability(30);

    expect(db.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'smmplan',
        }),
      })
    );
  });

  it('AnalyticsService.getLTVAnalytics strictly scopes user count and list to target tenant', async () => {
    await analyticsService.getLTVAnalytics('flux');

    expect(db.user.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        role: 'USER',
        tenantId: 'flux',
      }),
    });

    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: 'USER',
          tenantId: 'flux',
        }),
      })
    );
  });

  it('OrderAnalyticsService.getOrderStats strictly scopes groupBy query to tenant', async () => {
    await OrderAnalyticsService.getOrderStats(undefined, undefined, 'flux');

    expect(db.order.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'flux',
        }),
      })
    );
  });

  it('OrderAnalyticsService.getRecentOrders strictly scopes findMany query to target tenant', async () => {
    await OrderAnalyticsService.getRecentOrders(6, 'smmplan');

    expect(db.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'smmplan',
        }),
      })
    );
  });
});
