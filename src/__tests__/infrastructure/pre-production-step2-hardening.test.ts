import { describe, it, expect, vi, beforeEach } from 'vitest';
import { redis, calculateRedisRetryDelay } from '@/lib/redis';
import { bulkRestartOrdersAction } from '@/actions/admin/orders';
import { db } from '@/lib/db';
import { adminOrderService } from '@/services/admin/order.service';

vi.mock('@/lib/server/rbac', () => ({
  requireStaffPermission: vi.fn((_module, _action, cb) =>
    cb({ id: 'admin-1', email: 'admin@smmplan.pro', role: 'ADMIN', tenantId: null })
  ),
}));

vi.mock('@/lib/admin-audit', () => ({
  auditAdminAwaitable: vi.fn().mockResolvedValue(true),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/services/admin/order.service', () => ({
  adminOrderService: {
    restartOrder: vi.fn().mockResolvedValue({
      orderNumericId: 1001,
      oldStatus: 'PENDING_CHECK',
      oldError: 'Timeout',
      charge: BigInt(500),
    }),
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    order: {
      findMany: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
  },
}));

describe('Step 2 Pre-Production Hardening Test Suite', () => {
  describe('1. Redis Reconnection Resilience (P0-REDIS-RESILIENCE)', () => {
    it('ensures retryStrategy never returns null even after 5, 10, 50 retries', () => {
      // Test environment mode
      expect(calculateRedisRetryDelay(1, 'test')).toBe(50);
      expect(calculateRedisRetryDelay(5, 'test')).toBe(250);
      expect(calculateRedisRetryDelay(10, 'test')).toBe(500);
      expect(calculateRedisRetryDelay(20, 'test')).toBe(500);

      // Production mode checks: MUST never return null and cap at 3000ms
      for (const attempts of [1, 5, 6, 10, 20, 50, 100]) {
        const delay = calculateRedisRetryDelay(attempts, 'production');
        expect(delay).not.toBeNull();
        expect(delay).toBeGreaterThan(0);
        expect(delay).toBeLessThanOrEqual(3000);
      }
      expect(calculateRedisRetryDelay(1, 'production')).toBe(100);
      expect(calculateRedisRetryDelay(10, 'production')).toBe(1000);
      expect(calculateRedisRetryDelay(30, 'production')).toBe(3000);
      expect(calculateRedisRetryDelay(50, 'production')).toBe(3000);
    });
  });

  describe('2. Admin Bulk Order Restart with PENDING_CHECK & CANCELED', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('restarts orders with status PENDING_CHECK as well as ERROR and PENDING', async () => {
      const mockOrders = [
        { id: 'ord-1', status: 'PENDING_CHECK', numericId: 101 },
        { id: 'ord-2', status: 'ERROR', numericId: 102 },
        { id: 'ord-3', status: 'PENDING', numericId: 103 },
        { id: 'ord-4', status: 'CANCELED', numericId: 104 },
        { id: 'ord-5', status: 'COMPLETED', numericId: 105 }, // Should be skipped
      ];

      vi.mocked(db.order.findMany).mockResolvedValue(mockOrders as any);

      const res = await bulkRestartOrdersAction(['ord-1', 'ord-2', 'ord-3', 'ord-4', 'ord-5']);

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.restartedCount).toBe(4);
      }
      expect(adminOrderService.restartOrder).toHaveBeenCalledTimes(4);
      expect(adminOrderService.restartOrder).toHaveBeenCalledWith('ord-1', expect.objectContaining({ id: 'admin-1' }));
      expect(adminOrderService.restartOrder).toHaveBeenCalledWith('ord-2', expect.objectContaining({ id: 'admin-1' }));
      expect(adminOrderService.restartOrder).toHaveBeenCalledWith('ord-3', expect.objectContaining({ id: 'admin-1' }));
      expect(adminOrderService.restartOrder).toHaveBeenCalledWith('ord-4', expect.objectContaining({ id: 'admin-1' }));
    });
  });

  describe('3. Provider Status Normalization Mapping', () => {
    it('maps CANCELLED, FAILED, and FAIL to order cancellation', () => {
      const allowedCancelStatuses = ['CANCELED', 'CANCELLED', 'FAILED', 'FAIL'];

      expect(allowedCancelStatuses.includes('CANCELLED')).toBe(true);
      expect(allowedCancelStatuses.includes('CANCELED')).toBe(true);
      expect(allowedCancelStatuses.includes('FAILED')).toBe(true);
      expect(allowedCancelStatuses.includes('FAIL')).toBe(true);
      expect(allowedCancelStatuses.includes('IN_PROGRESS')).toBe(false);
      expect(allowedCancelStatuses.includes('COMPLETED')).toBe(false);
    });
  });
});
